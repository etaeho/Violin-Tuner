# Violin Tuner — 작업 가이드

바이올린 튜너 · 메트로놈 · 지판 앱. 사용자는 **모바일에서 바이브 코딩**으로 개발하고, 폰에서 바로 APK를 받아 테스트한다.

## 구조
- `index.html` — 껍데기(head, 로딩화면, 스크립트 로드 순서). 앱 코드는 없음.
- `src/` — 앱 코드 (React 18 + Babel standalone, 빌드 없이 브라우저에서 JSX 변환). **로드 순서 중요** (core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app):
  1. `core.jsx` — 공통 상수(음이름·현·조표), 설정(DEFAULT_SETTINGS, localStorage), 피치 검출(detectPitch)
  1-1. `commands.jsx` — 연주 명령: 음 패턴(기본 G3→E5→G3) 감지 → 메트로놈 켜기/끄기 (app.jsx에서 onCommand 연결)
  2. `theme.jsx` — **디자인 7종** `DESIGNS`(다크·라이트 / 피아노·가죽·라디오·바이올린·악보). 설정값 `settings.design`, 각 디자인의 `base`(tape|light|vintage)가 `settings.uiMode`·`data-theme`이 됨. 우드 계열은 `SKINS[skin]` 토큰(숫자창·버튼·표시등·다이얼 모양)을 `SkinContext`/`useSkin()`으로 받음 → `SkinNumber`(1번 탭 Hz), `SkinBeatDial`·`SkinMiniMetronome`(metronome.jsx). 고르는 화면 = `DesignPicker`(설정 ①, 온보딩 3단계 공용). 라디오만 `hzDial`로 `RadioDial`(Hz 눈금 창 + 빨간 바늘)·`RadioBeatDial` 사용. 그 외 ThemeContext/useVintage, 공용 UI(DrumDigits · Screw · BrassPlate)
  3. `tuner.jsx` — 튜너 탭: useTunerLogic, StringBars(막대), StringVTapes/VTape(현별 세로 테이프), BigNote(큰 음이름), NoteTape(가로 테이프), TunerReadout, SettingsSheet(LayoutEditor·PartsEditor), Tuner. 블록 배치는 `settings.layout1`
  4. `metronome.jsx` — 메트로놈 탭(블록 배치 `settings.layout2`, `PitchStrip`: 음정 바늘 게이지) + `MiniMetronome`(튜너 탭 '테이프 + 템포' 구성에서 같은 metro 상태 공유). 클릭 시각을 `METRO_CLICKS`(core.jsx)에 기록 → 튜너가 그 순간 분석을 건너뜀
  5. `fingerboard.jsx` — 지판 탭 (v2 디자인): 조표(`fb.key`), 연주 음, 탭→기준음, 박마다 테두리, 히트맵(`fb.heat`, 연습 기록의 음별 정확도 최근 30일, 아래 '초기화' 두 번 → `log.resetPerNote`), 스케일 연습(`tuner.noteListeners`로 확정 음 받음)
  5-1. `drone.jsx` — 드론 탭: useDroneLogic(오디오), 근음 휠, 화음·음색. 재생 중엔 연주 명령 차단(droneActive). 계획: docs/drone-mode-plan.md
  5-2. `practice.jsx` — 기록 탭: 연습 시간 자동 측정(튜너 확정 음 → practiceSinkRef) + **음별 정확도**(하루 요약에 notes·ok·per), 목표 링, 12주 달력, 7일 그래프. `vt.log.days`. 계획: docs/practice-log-plan.md
  5-4. `recorder.jsx` — 연습 녹음 = **4번째 탭** `RecordTab`(위: 음정 표시기 `MainPitchMeter`(보통 크기) · `RecSettings`(메트로놈 녹음 · 녹음 지연, 음질은 항상 128kbps) · 오늘 녹음 / **맨 아래 고정: 녹음 버튼**). **녹음과 메트로놈은 따로 동작** (메트로놈 재생이 녹음을 시작하면 안 됨). 기록 탭 맨 아래 `RecordDays`(날짜별 녹음). `RecItem` = 재생/일시정지·폰에 저장·삭제, 재생 중엔 `RecPlayer`(음정 그래프 ±10초 창 · 전체 막대 · 0.5/0.75/1배(음높이 유지) · A-B 반복). 녹음마다 `item.track`(음정 점 `[ms, 센트, 음]` 30ms마다 · 메트로놈 박 `METRO_CLICKS.grid` · 소리 시작 marks)과 `item.stats`(`analyzeRec`: 음정 % · 박자 평균/흔들림/박 맞춤)를 같이 저장. 소리 시작 = 녹음 마이크 음량 급상승(512 창) + 음 바뀜. 녹음 지연 = `recDelay` 0·3·5·10초(기본 3), 대기 중엔 어느 탭이든 화면 가운데 `RecDelayOverlay`(app.jsx, 디자인별 반투명 유리). 녹음+메트로놈 동시면 녹음 정지 버튼이 박마다 뜀(transform·그림자만). **주의: 컴포넌트 안에서 아이콘 이름(X, Play 등)과 같은 지역 변수 쓰지 말 것** (아이콘이 가려짐). `useRecorder`(튜너 마이크 `tuner.getStream()` → MediaRecorder webm/opus, IndexedDB 'vt-rec'). 녹음 중엔 아래 탭 아이콘에 빨간 점. **드론 탭은 숨김**(drone.jsx·useDroneLogic은 남겨둠, app.jsx TAB_NAV에서 다시 켤 수 있음). 메트로놈 박 소리 넣기(`recClicks`) = 녹음용 마이크를 **에코 제거(echoCancellation)로 따로 열어** 스피커 메트로놈을 지우고, 메트로놈 AudioContext에서 그 마이크 + 박에 맞춘 딸깍을 섞음(`metro.getMetroCtx`/`setRecordTap`). 튜너 마이크는 처리 없음 그대로. 재생 중엔 `tuner.setListenGuard`로 연습 기록·연주 명령 막음. 재생 시작 때 메트로놈이 돌고 있으면 잠시 멈췄다가(`holdMetro`) 끝까지 듣거나 재생기를 닫으면 다시 켬(`releaseMetro`). 폰 저장 = `VTNative.saveAudio(이름, 형식, base64)`(MainActivity)
  5-3. `onboarding.jsx` — 첫 실행 안내(마이크 → 소음 측정 → 테마). `settings.onboarded`가 false면 마이크 자동 시작 안 함. 설정 → 정보에서 다시 보기
  6. `app.jsx` — 탭 전환, 테마 적용, 마운트
  - 파일 간 공유는 전역 top-level `const`로 한다 (import/export 없음). 새 파일을 만들면 index.html, sw.js PRECACHE에 추가.
- `src/theme.css` — 테마 색 변수. `<html data-theme="tape|vintage|light">`. 라이트는 밝은 바디 + 튜너 테이프·숫자창은 어두운 표시창. 컴포넌트에 직접 쓴 어두운 색 클래스(text-white, bg-[#141414] 등)는 파일 아래쪽 라이트 덮어쓰기 규칙으로 바뀜 → 새 색 클래스를 쓰면 거기에도 추가. 인라인 글자색은 `var(--ink)`, `var(--ink2)` 사용.
  **컴포넌트에서 배경/테두리 색을 직접 쓰지 말고 `t-panel`, `t-chip`, `t-inset`, `t-board`, `t-card`, `t-sheet`, `t-nav`, `t-app` 클래스 사용.**
  모양 자체가 다른 부분만 `useVintage()`로 분기. 새 우드 디자인 = `SKINS` 항목 + `DESIGNS` 한 줄 + core.jsx `DESIGN_BASE` 한 줄. 새 바탕 테마 = theme.css 변수 블록 + loadSettings 허용 목록.
  설정 시트는 ① 디자인(+세부 꾸미기) ② 화면 배치 ③ 소리 감지 ④ 연주 명령 ⑤ 백업·정보 — 자주 안 쓰는 값은 `Fold`(펼치기) 안에 둔다.
  - **세부 꾸미기** `settings.parts {num, plate}` (core.jsx `PART_NUM_STYLES`/`PART_PLATE_STYLES`) → `PartsContext`/`useParts()`. 숫자 = `PartNumber`(flip·radio·drum·led), 판 = `BrassPlate`. 적용: TunerReadout, 미니 메트로놈 BPM, 2번 탭 다이얼 가운데(`DialCenter`)
  - **화면 배치** `settings.layout1`(1번 탭) / `layout2`(2번 탭) = `[{id, on, size:'s'|'m'|'l'}]` 순서대로. 블록 목록은 core.jsx `LAYOUT_BLOCKS` (grow = 남는 공간 채움, 크기 = 비율 / 나머지는 크기 = zoom 배율, lock = 숨기기 불가). 렌더: `visibleBlocks` + `LayoutBlock`(theme.jsx). 편집: `LayoutEditor`(tuner.jsx) = 실제 화면 축소 미리보기(`LayoutPreview`) + **화면 순서**(보이는 블록만, `BlockThumb` 그림 · 끌기 · 크기 · ✕) + **블록 추가**(숨긴 블록을 `group`별 그림 타일, 누르면 추가). 고른 블록은 `LayoutHighlightContext`로 테두리. 블록마다 `short`(짧은 이름)·`group`(기능 묶음). 새 블록 = LAYOUT_BLOCKS 한 줄(name·short·group) + `BlockThumb` 그림 한 줄 + Tuner/Metronome의 `b.id === ...` 한 줄
  - **메인 음정 표시기** `parts.meter` = 'needle'(`PitchStrip`, 가운데 ±10¢를 넓게 펼친 바늘) | 'fine'(`FineGauge`) | 'digits'(`PitchDigits`) → `MainPitchMeter`(metronome.jsx). 2번 탭 'pitch' 블록 · 1번 탭 'meter' 블록 · 지판(compact swapColors) · 드론(compact) 공용. **다른 탭에 음정 표시를 붙일 땐 항상 MainPitchMeter 사용**
  - **실시간 음정 그래프** `LivePitchGraph`(metronome.jsx) = 화면 배치 'history' 블록(1·2번 탭, 기본 꺼짐): `tuner.noteListeners`로 최근 10초 음정 점 + 음이름 + 메트로놈 박 줄 + '맞음 %'(최근 5초)
  - **정밀 튜닝**: `FineGauge`(1번 탭 'fine' 블록) = A4 기준 목표 Hz · 차이 0.1Hz · 1¢, ±12¢ 안이면 눈금 ±10¢로 확대. 세로/가로 테이프도 ±15¢ 안이면 확대(×4/×3)
  - **부드러운 움직임**: core.jsx `useSpring(목표값들, onFrame)` — 매 프레임 DOM을 직접 바꿈(리렌더 없음). 테이프·게이지 바늘에 사용
  - **흔들림 주의**: 박마다 바뀌는 표시는 크기(폰트·width)를 바꾸지 말고 transform·box-shadow만 (레이아웃이 밀려 화면 전체가 흔들림)
  - 저음 감지: `cleanBuffer`(직류·80Hz 이하 제거) 후 detectPitch. 330Hz 아래는 게이트 −6dB·신뢰도 −0.08 완화. 최저 주파수는 `MIN_FREQ_CAP`(170Hz) 넘게 못 올림
  - 2번 탭 박 표시 = 화면 배치 블록 두 개: 'dial'(원형 다이얼, 쪼갠 박은 `beatPieces`로 조각 나눔) · 'boxes'(`BeatBoxes` 네모 칸 원 + 쪼갠 박 점). 둘 다 켜거나 하나만 켤 수 있음. metro.`currentSub` = 지금 쪼갠 박 번호
  - **설정창은 app.jsx에 하나** (`settingsTab` 't1'|'t2'): 튜너·메트로놈 탭 위 '설정' 버튼 → `openSettings(탭)`. 화면 배치 편집은 연 탭이 먼저 보임
  - 지판: `FB_POSITIONS`=30(최상단, E현 A7까지, 위로 갈수록 칸이 좁아짐), 위에 `PitchStrip compact swapColors`, 연주 음 옆에 센트 + 화살표(고칠 방향: 높으면 ▼ 파랑, 낮으면 ▲ 빨강 — `FB_HIGH`/`FB_LOW`, 히트맵도 같은 규칙). 감지 최고 4200Hz
  - 앱 시작 때 3초 자동 소음 측정 `autoCalibrate`(설정 `autoCalib`), 결과는 하위 30% 레벨 + 10dB, −70~−35dB
- `vendor/` — React/ReactDOM/Lucide/Babel 고정 버전. Tailwind만 CDN.
- `manifest.json`, `sw.js`, `icons/` — PWA 리소스
- `app/` — 안드로이드 네이티브 껍데기 (Kotlin, WebView). 빌드 시 위 웹 파일들을 assets로 복사해서
  `https://appassets.androidplatform.net/index.html` 로 띄움. 마이크 권한(RECORD_AUDIO)을 WebView에 연결.
- `docs/` — 기획·조사 문서. `research.md`(타 앱 장단점 조사), `drone-mode-plan.md`(드론 모드 구성안), `practice-log-plan.md`(연습 기록 구상안), `redesign-v2.md`(전면 재구성안)
- **사용자가 바꾸는 값은 다음 실행 때 유지돼야 함**: 설정 시트 값은 `DEFAULT_SETTINGS`(core.jsx), 그 외 상태(템포·A4·조표 등)는 `usePersistentState('키', 기본값, 검증함수)` 사용 (localStorage `vt.` 접두사). 직접 저장할 땐 `vtSave(키, 값)` — 백업 가져오기 중엔 `VT_STORAGE.locked`로 막힘
- 백업: 설정 → 백업 (`vt.*` 전부 JSON). 안드로이드는 `VTNative.saveFile` + 파일 선택 창(MainActivity)
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
