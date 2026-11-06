# Violin Tuner — 작업 가이드

바이올린 튜너 · 메트로놈 · 지판 앱. 사용자는 **모바일에서 바이브 코딩**으로 개발하고, 폰에서 바로 APK를 받아 테스트한다.

## 구조
- `index.html` — 앱 본체 (React 18 + Tailwind CDN + Babel standalone, 단일 파일). **기능 수정은 거의 항상 여기.**
- `manifest.json`, `sw.js`, `icons/` — PWA 리소스
- `app/` — 안드로이드 네이티브 껍데기 (Kotlin, WebView). 빌드 시 위 웹 파일들을 assets로 복사해서
  `https://appassets.androidplatform.net/index.html` 로 띄움. 마이크 권한(RECORD_AUDIO)을 WebView에 연결.
- `Verson_*`, `verson_*`, `tuner_tab_*`, `tempo_tab_*` — 예전 버전 백업. 수정하지 말 것.

## 테스트 흐름
1. 수정 → commit → push (어느 브랜치든)
2. GitHub Actions `Android APK` 워크플로가 빌드 (약 3~5분)
3. 폰에서 https://github.com/etaeho/Violin-Tuner/releases/download/dev/violin-tuner.apk 받아 설치
   (고정 디버그 키로 서명 → 기존 앱 위에 덮어쓰기 설치됨)

## 주의
- 이 클라우드 환경에는 Android SDK가 없어 로컬 빌드 불가. 빌드 검증은 GitHub Actions 결과로 확인.
- `app/debug.keystore`는 업데이트 설치용 고정 디버그 키. 삭제/재생성하면 폰에서 앱을 지우고 다시 깔아야 함.
- 앱은 첫 실행 시 CDN(React/Tailwind/Babel)을 받아야 하므로 인터넷 필요.
