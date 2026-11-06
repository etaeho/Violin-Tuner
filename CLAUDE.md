# Violin Tuner — 작업 가이드

바이올린 튜너 · 메트로놈 · 지판 앱. 사용자는 **모바일에서 바이브 코딩**으로 개발하고, 폰에서 바로 APK를 받아 테스트한다.

## 구조
- `index.html` — 껍데기(head, 로딩화면, 스크립트 로드 순서). 앱 코드는 없음.
- `src/` — 앱 코드 (React 18 + Babel standalone, 빌드 없이 브라우저에서 JSX 변환). **로드 순서 중요**:
  1. `core.jsx` — 공통 상수(음이름·현·조표), 설정(DEFAULT_SETTINGS, localStorage), 피치 검출(detectPitch)
  2. `theme.jsx` — 화면 모드(UI_MODES), ThemeContext/useVintage, 공용 UI(DrumDigits, Screw, BrassPlate)
  3. `tuner.jsx` — 튜너 탭: useTunerLogic, StringBars, NoteTape, SettingsSheet, Tuner
  4. `metronome.jsx` — 메트로놈 탭
  5. `fingerboard.jsx` — 지판 탭
  6. `app.jsx` — 탭 전환, 테마 적용, 마운트
  - 파일 간 공유는 전역 top-level `const`로 한다 (import/export 없음). 새 파일을 만들면 index.html, sw.js PRECACHE에 추가.
- `src/theme.css` — 테마 색 변수. `<html data-theme="tape|vintage">`.
  **컴포넌트에서 배경/테두리 색을 직접 쓰지 말고 `t-panel`, `t-chip`, `t-inset`, `t-board`, `t-card`, `t-sheet`, `t-nav`, `t-app` 클래스 사용.**
  모양 자체가 다른 부분만 `useVintage()`로 분기. 새 테마 = theme.css 변수 블록 + UI_MODES 항목 + core.jsx loadSettings 허용 목록.
- `vendor/` — React/ReactDOM/Lucide/Babel 고정 버전. Tailwind만 CDN.
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
- React/ReactDOM/Lucide/Babel은 `vendor/`에 버전 고정으로 포함 (CDN `@latest` 쓰지 말 것 — lucide-react 1.x는 UMD 빌드가 없어 앱이 로딩화면에서 멈췄었음).
- Tailwind만 CDN 사용 → 첫 실행 시 인터넷 필요.
- 로딩 중 JS 에러가 나면 로딩화면에 빨간 글씨로 표시됨.
