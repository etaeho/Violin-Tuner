plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// v2: web/ 를 Vite로 빌드한 결과(web/dist)를 APK assets로 복사한다.
// CI가 먼저 `npm ci && npm run build` 를 실행한다 (.github/workflows/android.yml)
val webAssetsDir = layout.buildDirectory.dir("generated/webAssets")
val webDist = rootDir.resolve("web/dist")
val copyWebAssets by tasks.registering(Sync::class) {
    doFirst {
        check(webDist.resolve("index.html").exists()) { "web/dist 가 없습니다. 먼저 web 폴더에서 npm run build 를 실행하세요." }
    }
    from(webDist)
    into(webAssetsDir)
}

android {
    namespace = "com.etaeho.violintuner"
    compileSdk = 35

    defaultConfig {
        // v2는 앱 ID를 따로 → 폰에 v1과 동시에 설치해 비교 가능 (v1 교체 시점에 원래 ID로 되돌림)
        applicationId = "com.etaeho.violintuner.v2"
        minSdk = 24
        targetSdk = 35
        // CI 빌드 번호가 올라가면 versionCode도 올라가서 덮어쓰기 설치가 된다.
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "2.0.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
    }

    signingConfigs {
        // 레포에 고정된 디버그 키 → 매 빌드 서명이 같아서 지우지 않고 업데이트 설치 가능
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    sourceSets["main"].assets.srcDir(webAssetsDir)

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

tasks.named("preBuild") { dependsOn(copyWebAssets) }

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
