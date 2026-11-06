plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// 웹앱 소스(레포 루트의 index.html 등)를 APK assets로 복사한다.
// index.html 하나만 고치면 PWA와 안드로이드 앱이 같이 바뀐다.
val webAssetsDir = layout.buildDirectory.dir("generated/webAssets")
val copyWebAssets by tasks.registering(Sync::class) {
    from(rootDir) {
        include("index.html", "manifest.json", "sw.js", "icons/**", "vendor/**", "src/**")
    }
    into(webAssetsDir)
}

android {
    namespace = "com.etaeho.violintuner"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.etaeho.violintuner"
        minSdk = 24
        targetSdk = 35
        // CI 빌드 번호가 올라가면 versionCode도 올라가서 덮어쓰기 설치가 된다.
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "0.1.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
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
