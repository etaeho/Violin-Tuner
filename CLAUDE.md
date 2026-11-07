# Violin Tuner — 작업 가이드 (v2 브랜치)

> **이 브랜치(`v2`)는 전면 재구성 중.** 계획: `docs/redesign-v2.md`. 지금 앱(v1) 코드는 루트의 `index.html`·`src/`·`vendor/`에 참고용으로 남아 있음 (APK에는 안 들어감).
> v1 개발은 다른 브랜치에서 계속됨 — v1 파일은 이 브랜치에서 수정하지 말 것.

## v2 구조 (`web/`)
- Vite + React 18 + TypeScript + Tailwind(빌드 시 생성, 오프라인) + zustand
- `web/src/ui/themes.css` — **디자인 토큰. 테마 = 변수 블록 하나** (tape / vintage / light). 컴포넌트는 tailwind 색 이름(`bg-panel`, `text-ink`, `text-accent`, `border-line` …)과 `.card` `.chip` `.inset` 만 사용, 색 직접 쓰지 말 것
- `web/src/ui/components/` — 공용 부품 (Sheet, TabBar, Brass(BrassPlate·Screw·DrumDigits), PlannedScreen)
- `web/src/features/<탭>/` — 탭별 화면: tuning · practice · fingerboard · log, `SettingsSheet.tsx`
- `web/src/audio/` — 오디오 (DOM 의존 없는 순수 로직은 테스트 필수)
  - `detector.ts` 음정 검출(NSDF) · `pitch-worklet.ts` **오디오 스레드**에서 2048샘플/1024마다 분석 → 메인으로 전달
  - `engine.ts` 마이크·AudioContext·워크렛 연결 (`mic` 싱글턴) · `tracker.ts` 게이트·신뢰도·확정·평균·유지 (순수 클래스)
  - `strings.ts` 현·조율 방식(평균율/순정 5도) · `synth.ts` 기준음
- `web/src/store/` — zustand. `settings.ts`(테마·탭, `vt2.settings`), `tuner.ts`(A4·범위·조율·감도, `vt2.tuner`), `live.ts`(실시간 상태, 저장 안 함 — 엔진→트래커→상태 연결, 소음 측정). **사용자가 바꾸는 값은 저장되어야 함**
- `web/src/features/tuning/` — TuningScreen(조절줄·현별 세로 테이프·숫자 표시), VTape, Ripple("울림")
- `web/tests/` — vitest. 음정 검출은 합성 음원으로 테스트 (`npm test`)
- 명령: `cd web && npm install && npm run dev`(개발 서버) / `npm test` / `npm run build`(→ `web/dist`)

## 빌드 · 테스트 흐름 (v2)
1. 수정 → commit → `git push origin v2`
2. GitHub Actions: `npm ci` → **`npm test`(실패하면 빌드 중단)** → `npm run build` → APK
3. 폰에서 https://github.com/etaeho/Violin-Tuner/releases/download/dev-v2/violin-tuner-v2.apk
   - 앱 ID `com.etaeho.violintuner.v2`, 이름 "Violin v2" → v1과 **따로** 설치됨
4. 푸시 전 로컬 확인: `cd web && npm test && npm run build`

---

# (참고) v1 작업 가이드

바이올린 튜너 · 메트로놈 · 지판 앱. 사용자는 **모바일에서 바이브 코딩**으로 개발하고, 폰에서 바로 APK를 받아 테스트한다.

## 구조
- `index.html` — 껍데기(head, 로딩화면, 스크립트 로드 순서). 앱 코드는 없음.
- `src/` — 앱 코드 (React 18 + Babel standalone, 빌드 없이 브라우저에서 JSX 변환). **로드 순서 중요** (core → commands → theme → tuner → metronome → fingerboard → drone → practice → app):
  1. `core.jsx` — 공통 상수(음이름·현·조표), 설정(DEFAULT_SETTINGS, localStorage), 피치 검출(detectPitch)
  1-1. `commands.jsx` — 연주 명령: 음 패턴(기본 G3→E5→G3) 감지 → 메트로놈 켜기/끄기 (app.jsx에서 onCommand 연결)
  2. `theme.jsx` — 화면 모드(UI_MODES), ThemeContext/useVintage, 공용 UI(DrumDigits, Screw, BrassPlate)
  3. `tuner.jsx` — 튜너 탭: useTunerLogic, StringBars(막대), StringVTapes/VTape(현별 세로 테이프, 기본 구성), NoteTape(가로 테이프), TunerReadout, SettingsSheet, Tuner. 구성은 `TUNER_LAYOUTS`
  4. `metronome.jsx` — 메트로놈 탭 + `MiniMetronome`(튜너 탭 '테이프 + 템포' 구성에서 같은 metro 상태 공유). 클릭 시각을 `METRO_CLICKS`(core.jsx)에 기록 → 튜너가 그 순간 분석을 건너뜀
  5. `fingerboard.jsx` — 지판 탭
  5-1. `drone.jsx` — 드론 탭: useDroneLogic(오디오), 근음 휠, 화음·음색. 재생 중엔 연주 명령 차단(droneActive). 계획: docs/drone-mode-plan.md
  5-2. `practice.jsx` — 기록 탭: 연습 시간 자동 측정(튜너 확정 음 → practiceSinkRef), 목표 링, 12주 달력, 7일 그래프. 하루 요약을 `vt.log.days`에 저장. 계획: docs/practice-log-plan.md
  6. `app.jsx` — 탭 전환, 테마 적용, 마운트
  - 파일 간 공유는 전역 top-level `const`로 한다 (import/export 없음). 새 파일을 만들면 index.html, sw.js PRECACHE에 추가.
- `src/theme.css` — 테마 색 변수. `<html data-theme="tape|vintage">`.
  **컴포넌트에서 배경/테두리 색을 직접 쓰지 말고 `t-panel`, `t-chip`, `t-inset`, `t-board`, `t-card`, `t-sheet`, `t-nav`, `t-app` 클래스 사용.**
  모양 자체가 다른 부분만 `useVintage()`로 분기. 새 테마 = theme.css 변수 블록 + UI_MODES 항목 + core.jsx loadSettings 허용 목록.
- `vendor/` — React/ReactDOM/Lucide/Babel 고정 버전. Tailwind만 CDN.
- `manifest.json`, `sw.js`, `icons/` — PWA 리소스
- `app/` — 안드로이드 네이티브 껍데기 (Kotlin, WebView). 빌드 시 위 웹 파일들을 assets로 복사해서
  `https://appassets.androidplatform.net/index.html` 로 띄움. 마이크 권한(RECORD_AUDIO)을 WebView에 연결.
- `docs/` — 기획·조사 문서. `research.md`(타 앱 장단점 조사), `drone-mode-plan.md`(드론 모드 구성안), `practice-log-plan.md`(연습 기록 구상안), `redesign-v2.md`(전면 재구성안)
- **사용자가 바꾸는 값은 다음 실행 때 유지돼야 함**: 설정 시트 값은 `DEFAULT_SETTINGS`(core.jsx), 그 외 상태(템포·A4·조표 등)는 `usePersistentState('키', 기본값, 검증함수)` 사용 (localStorage `vt.` 접두사)
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
