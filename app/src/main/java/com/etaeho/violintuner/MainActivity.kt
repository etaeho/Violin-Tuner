package com.etaeho.violintuner

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import androidx.annotation.RequiresApi
import androidx.appcompat.app.AlertDialog
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewFeature

/**
 * 레포 루트의 index.html(React 웹앱)을 WebView로 띄우는 얇은 네이티브 껍데기.
 * 실제 튜너 로직은 전부 index.html 안에 있다.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var pendingPermission: PermissionRequest? = null

    // assets/ 를 https://appassets.androidplatform.net/ 루트로 서빙 (보안 컨텍스트 → getUserMedia 동작)
    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private val micPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val req = pendingPermission ?: return@registerForActivityResult
            pendingPermission = null
            if (granted) req.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) else req.deny()
        }

    // ── 강제 종료 진단: 원인을 파일로 남겼다가 다음 실행 때 보여준다 ──
    private val crashFile by lazy { File(filesDir, "crash.txt") }

    private fun writeCrash(title: String, detail: String) {
        try {
            val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.KOREA).format(Date())
            crashFile.writeText("[$time] $title\n앱 버전 ${packageManager.getPackageInfo(packageName, 0).versionName} · Android ${Build.VERSION.RELEASE} · ${Build.MODEL}\n\n$detail")
        } catch (_: Throwable) {}
    }

    private fun installCrashHandler() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, e ->
            val sw = StringWriter(); e.printStackTrace(PrintWriter(sw))
            writeCrash("앱 오류로 종료됨", sw.toString())
            previous?.uncaughtException(thread, e)
        }
    }

    private fun showPreviousCrashIfAny() {
        if (!crashFile.exists()) return
        val text = crashFile.readText().take(4000)
        crashFile.delete()
        AlertDialog.Builder(this)
            .setTitle("지난번 앱이 종료된 원인")
            .setMessage(text)
            .setPositiveButton("복사") { _, _ ->
                val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("crash", text))
            }
            .setNegativeButton("닫기", null)
            .show()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installCrashHandler()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        WebView.setWebContentsDebuggingEnabled(true) // PC 크롬 chrome://inspect 로 디버깅 가능

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(
                object : ServiceWorkerClientCompat() {
                    override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? =
                        assetLoader.shouldInterceptRequest(request.url)
                }
            )
        }

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            setBackgroundColor(0xFF000000.toInt())

            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)

                // 웹 화면(렌더러)이 죽어도 앱 전체가 강제 종료되지 않게: 기록 후 화면만 다시 만든다
                @RequiresApi(Build.VERSION_CODES.O)
                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    writeCrash(
                        "웹 화면 엔진(WebView) 종료",
                        if (detail.didCrash()) "렌더러 크래시 — 최근 JS 로그:\n$recentConsole"
                        else "메모리 부족으로 시스템이 종료 — 최근 JS 로그:\n$recentConsole"
                    )
                    recreate()
                    return true
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread { handlePermission(request) }
                }

                // JS 에러/경고를 최근 20줄 보관 → 크래시 기록에 같이 남김
                override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                    if (msg.messageLevel() == ConsoleMessage.MessageLevel.ERROR ||
                        msg.messageLevel() == ConsoleMessage.MessageLevel.WARNING) {
                        consoleLines.addLast("${msg.messageLevel()}: ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
                        while (consoleLines.size > 20) consoleLines.removeFirst()
                        Log.w("ViolinTuner", msg.message())
                    }
                    return super.onConsoleMessage(msg)
                }
            }
        }
        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        val restored = savedInstanceState?.let { runCatching { webView.restoreState(it) }.getOrNull() }
        if (restored == null) webView.loadUrl("https://appassets.androidplatform.net/index.html")
        showPreviousCrashIfAny()
    }

    private val consoleLines = ArrayDeque<String>()
    private val recentConsole get() = consoleLines.joinToString("\n").ifEmpty { "(없음)" }

    private fun handlePermission(request: PermissionRequest) {
        if (!request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
            request.deny()
            return
        }
        val hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        if (hasMic) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            pendingPermission = request
            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        runCatching { webView.saveState(outState) }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
