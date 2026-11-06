# Violin-Tuner

바이올린 튜너 · 메트로놈 · 지판 (React 웹앱 + 안드로이드 WebView 앱)

## 📱 최신 안드로이드 빌드 받기
**[violin-tuner.apk 다운로드](https://github.com/etaeho/Violin-Tuner/releases/download/dev/violin-tuner.apk)**

push 할 때마다 GitHub Actions가 자동으로 새 APK를 빌드해서 위 링크를 갱신합니다.
처음 설치할 때는 브라우저/파일 앱에 "출처를 알 수 없는 앱 설치"를 허용해야 합니다.

## 개발
- 앱 기능: `index.html` 수정
- 안드로이드 껍데기: `app/`
- 로컬 빌드(Android SDK 필요): `./gradlew assembleDebug`
