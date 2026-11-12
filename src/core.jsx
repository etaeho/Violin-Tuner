// ==========================================
// core — 공통 상수, 설정, 피치 검출
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
// ==========================================

/* =====================================================
   모든 React hooks 및 Lucide 아이콘을 전역에서 가져옴
===================================================== */
const { useState, useEffect, useRef, useCallback } = React;
const {
  Play, Square, Settings, Volume2, VolumeX, AlertCircle,
  Music, Activity, Minus, Plus, ChevronUp, ChevronDown, RotateCcw,
  LayoutGrid, SlidersHorizontal, X, GripVertical, Eye, EyeOff, Pause, ListMusic, Mic, ZoomIn, ZoomOut, AudioWaveform, Waves, BarChart3, Flame, Trash2, Download, Upload, Target
} = LucideReact;

/* 햅틱 피드백 헬퍼 */
const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch(_) {} };

// ==========================================
// 공통 상수 및 헬퍼
// ==========================================
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const CHROMATIC_NOTES = [
  ['C','B#'],['C#','Db'],['D'],['D#','Eb'],['E','Fb'],['F','E#'],
  ['F#','Gb'],['G'],['G#','Ab'],['A'],['A#','Bb'],['B','Cb']
];

const VIOLIN_STRINGS = [
  { name:'G3', id:4, note:'G', octave:3, semitone:-14 },
  { name:'D4', id:3, note:'D', octave:4, semitone:-7  },
  { name:'A4', id:2, note:'A', octave:4, semitone:0   },
  { name:'E5', id:1, note:'E', octave:5, semitone:7   },
];

const KEY_SIGNATURES = {
  'C Major (0)': ['C','D','E','F','G','A','B'],
  'G Major (1#)': ['G','A','B','C','D','E','F#'],
  'D Major (2#)': ['D','E','F#','G','A','B','C#'],
  'A Major (3#)': ['A','B','C#','D','E','F#','G#'],
  'E Major (4#)': ['E','F#','G#','A','B','C#','D#'],
  'B Major (5#)': ['B','C#','D#','E','F#','G#','A#'],
  'F# Major (6#)': ['F#','G#','A#','B','C#','D#','E#'],
  'C# Major (7#)': ['C#','D#','E#','F#','G#','A#','B#'],
  'F Major (1b)': ['F','G','A','Bb','C','D','E'],
  'Bb Major (2b)': ['Bb','C','D','Eb','F','G','A'],
  'Eb Major (3b)': ['Eb','F','G','Ab','Bb','C','D'],
  'Ab Major (4b)': ['Ab','Bb','C','Db','Eb','F','G'],
  'Db Major (5b)': ['Db','Eb','F','Gb','Ab','Bb','C'],
  'Gb Major (6b)': ['Gb','Ab','Bb','Cb','Db','Eb','F'],
  'Cb Major (7b)': ['Cb','Db','Eb','Fb','Gb','Ab','Bb'],
};

const generateFingerboardStrings = (maxPos) => {
  const stringsInfo = [
    { string:'E', name:'1번줄', baseIdx:4,  baseOct:5 },
    { string:'A', name:'2번줄', baseIdx:9,  baseOct:4 },
    { string:'D', name:'3번줄', baseIdx:2,  baseOct:4 },
    { string:'G', name:'4번줄', baseIdx:7,  baseOct:3 },
  ];
  return stringsInfo.map(info => {
    const notes = [];
    for (let pos = 0; pos <= maxPos; pos++) {
      const noteIndex = (info.baseIdx + pos) % 12;
      const octaveShift = Math.floor((info.baseIdx + pos) / 12);
      notes.push({
        pos, names: CHROMATIC_NOTES[noteIndex], noteIndex,
        octave: info.baseOct + octaveShift, id: `${info.string}${pos}`
      });
    }
    return { string: info.string, name: info.name, notes };
  });
};

const FINGERBOARD_STRINGS_EXT = generateFingerboardStrings(25);

// ── 메트로놈 아이콘 SVG ──
const NoteQuarter  = ({ className="h-6 w-auto" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="10" cy="17" r="2.8"/>
    <rect x="11.8" y="5" width="1.2" height="12"/>
  </svg>
);
const NoteEighths  = ({ className="h-6 w-auto" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/>
    <rect x="8.5" y="6" width="1.2" height="11"/><rect x="18.5" y="6" width="1.2" height="11"/>
    <rect x="8.5" y="5" width="11.2" height="2"/>
  </svg>
);
const NoteTriplet  = ({ className="h-6 w-auto" }) => (
  <svg viewBox="0 0 32 24" fill="currentColor" className={className}>
    <circle cx="6" cy="17" r="2.2"/><circle cx="16" cy="17" r="2.2"/><circle cx="26" cy="17" r="2.2"/>
    <rect x="7" y="7" width="1.2" height="10"/><rect x="17" y="7" width="1.2" height="10"/><rect x="27" y="7" width="1.2" height="10"/>
    <rect x="7" y="6" width="21.2" height="1.8"/>
    <text x="17" y="4.5" fontSize="6.5" fontWeight="900" textAnchor="middle" style={{fontStyle:'italic'}}>3</text>
  </svg>
);
const NoteSixteenths = ({ className="h-6 w-auto" }) => (
  <svg viewBox="0 0 40 24" fill="currentColor" className={className}>
    <circle cx="6" cy="17" r="2"/><circle cx="15" cy="17" r="2"/><circle cx="24" cy="17" r="2"/><circle cx="33" cy="17" r="2"/>
    <rect x="7" y="6" width="1" height="11"/><rect x="16" y="6" width="1" height="11"/>
    <rect x="25" y="6" width="1" height="11"/><rect x="34" y="6" width="1" height="11"/>
    <rect x="7" y="5" width="28" height="1.5"/><rect x="7" y="8.5" width="28" height="1.5"/>
  </svg>
);
const renderSubdivisionIcon = (val, className) => {
  switch(val) {
    case 1: return <NoteQuarter className={className}/>;
    case 2: return <NoteEighths className={className}/>;
    case 3: return <NoteTriplet className={className}/>;
    case 4: return <NoteSixteenths className={className}/>;
    default: return null;
  }
};

const getDefaultBeatSounds = (num) => {
  if (num===2) return [2,1];
  if (num===3) return [2,1,1];
  if (num===4) return [2,1,1,1];
  if (num===5) return [2,1,2,1,1];
  if (num===6) return [2,1,1,3,1,1];
  if (num===7) return [2,1,1,2,1,2,1];
  if (num===8) return [2,1,1,3,1,1,3,1];
  if (num===9) return [2,1,1,3,1,1,3,1,1];
  if (num===12) return [2,1,1,3,1,1,2,1,1,3,1,1];
  const arr = Array(num).fill(1); arr[0]=2; return arr;
};

const getTempoMarking = (bpm) => {
  if (bpm<40)  return "Grave";
  if (bpm<60)  return "Largo";
  if (bpm<66)  return "Larghetto";
  if (bpm<76)  return "Adagio";
  if (bpm<108) return "Andante";
  if (bpm<120) return "Moderato";
  if (bpm<168) return "Allegro";
  if (bpm<200) return "Presto";
  return "Prestissimo";
};

// ==========================================
// Tuner Hook
// ==========================================
// ==========================================
// 튜너 감도 설정 (localStorage 저장)
// ==========================================
// ── 화면 배치 (설정 → 화면 배치): 탭마다 블록 순서 · 보이기 · 크기 ──
//  grow = 남는 세로 공간을 채우는 블록(크기 = 차지 비율), 나머지는 크기 = 확대 배율. lock = 숨길 수 없음
// group: '음정'(초록) · '템포'(노랑) · '녹음'(빨강) — 화면 배치에서 색·아이콘으로 구분 (LAYOUT_GROUPS)
// sizes: 이 블록이 고를 수 있는 크기 (녹음은 한 줄 / 두 줄만), noZoom: 크기를 확대 배율 대신 블록이 직접 처리
const LAYOUT_BLOCKS = {
  t1: [
    { id: 'vtapes',  name: '현별 세로 테이프', short: '세로 테이프', group: '음정', grow: true },
    { id: 'note',    name: '큰 음이름',       short: '큰 음이름',   group: '음정', grow: true },
    { id: 'fine',    name: '정밀 게이지 (±1¢ · Hz)', short: '정밀 게이지', group: '음정' },
    { id: 'meter',   name: '음정 표시기 (설정에서 고른 모양)', short: '음정 표시기', group: '음정' },
    { id: 'history', name: '실시간 음정 그래프 (최근 10초)', short: '음정 그래프', group: '음정' },
    { id: 'readout', name: '음정 숫자창',     short: '숫자창',      group: '음정' },
    { id: 'tape',    name: '가로 음 테이프',  short: '가로 테이프', group: '음정' },
    { id: 'mini',    name: '미니 메트로놈',   short: '미니 메트로놈', group: '템포' },
    { id: 'rec',     name: '녹음 버튼',       short: '녹음',        group: '녹음', sizes: ['s', 'l'], noZoom: true },
  ],
  t2: [
    { id: 'pitch',    name: '음정 표시기 (설정에서 고른 모양)', short: '음정 표시기', group: '음정' },
    { id: 'history',  name: '실시간 음정 그래프 (최근 10초)', short: '음정 그래프', group: '음정' },
    { id: 'light',    name: '박 조명 (화면 크게 번쩍)', short: '박 조명',   group: '템포', grow: true },
    { id: 'ctrl',     name: '박자 · 템포 · 시작',       short: '박자·템포·시작', group: '템포', lock: true },
    { id: 'beats',    name: '박 설정',          short: '박 설정',     group: '템포' },
    { id: 'dial',     name: '박자 원형 다이얼', short: '원형 다이얼', group: '템포', grow: true },
    { id: 'boxes',    name: '박자 네모 칸 원',  short: '네모 칸 원',  group: '템포', grow: true },
    { id: 'tempo',    name: '템포 슬라이더 · 프리셋', short: '템포 슬라이더', group: '템포' },
    { id: 'controls', name: 'TAP · 시작 (큰 버튼)', short: 'TAP · 시작',  group: '템포' },
    { id: 'rec',      name: '녹음 버튼',        short: '녹음',        group: '녹음', sizes: ['s', 'l'], noZoom: true },
  ],
};
const LAYOUT_GROUPS = { '음정': '#4afc9d', '템포': '#ffcc00', '녹음': '#ef4444' };
// 1번 탭 빠른 배치 (예전 '튜너 화면 구성' 5가지)
const LAYOUT_PRESETS = [
  { id: 'vtapeTempo', name: '세로 테이프 + 템포', on: ['vtapes', 'fine', 'readout', 'mini'] },
  { id: 'tapeTempo',  name: '가로 테이프 + 템포', on: ['history', 'fine', 'tape', 'mini'] },
  { id: 'tape',       name: '가로 테이프', on: ['history', 'fine', 'tape'] },
  { id: 'fineOnly',   name: '정밀 튜닝', on: ['vtapes', 'fine'] },
  { id: 'center',     name: '큰 음이름', on: ['note', 'fine'] },
  { id: 'both',       name: '큰 음이름 + 테이프', on: ['note', 'tape'] },
];
const LAYOUT_SIZES = ['s', 'm', 'l'];
const makeLayout = (tab, onIds) => [
  ...onIds.map(id => ({ id, on: true, size: 'm' })),
  ...LAYOUT_BLOCKS[tab].filter(b => !onIds.includes(b.id)).map(b => ({ id: b.id, on: !!b.lock, size: 'm' })),
];
const DEFAULT_LAYOUT2_ON = ['pitch', 'light', 'ctrl'];   // 메트로놈 탭 기본: 음정(작게) · 박 조명(크게) · 박자·템포·시작
// 저장값 정리: 모르는 블록 제거, 빠진 블록은 꺼진 채로 뒤에 추가
const normLayout = (tab, list) => {
  const known = LAYOUT_BLOCKS[tab], seen = new Set(), out = [];
  (Array.isArray(list) ? list : []).forEach(it => {
    const b = it && known.find(k => k.id === it.id);
    if (!b || seen.has(b.id)) return;
    seen.add(b.id);
    const sizes = b.sizes || LAYOUT_SIZES;
    out.push({ id: b.id, on: b.lock ? true : !!it.on, size: sizes.includes(it.size) ? it.size : sizes[0] === 's' && sizes.length === 2 ? 's' : 'm' });
  });
  known.forEach(b => { if (!seen.has(b.id)) out.push({ id: b.id, on: !!b.lock, size: b.sizes ? b.sizes[0] : 'm' }); });
  return out;
};

// ── 부품별 꾸미기 (디자인 위에 덮어쓰기) ──
const PART_NUM_STYLES = [
  { id: 'auto',  name: '디자인 기본' },
  { id: 'flip',  name: '플립 카드' },
  { id: 'radio', name: '크림 창' },
  { id: 'drum',  name: '검은 숫자판' },
  { id: 'led',   name: 'LED' },
];
const PART_PLATE_STYLES = [
  { id: 'auto',  name: '디자인 기본' },
  { id: 'brass', name: '황동판 (나사)' },
];
// 메인 음정 표시기: 1번 탭 외 탭(메트로놈·지판·드론)과 1번 탭 'meter' 블록에 붙는 음정 표시 모양
const PART_METER_STYLES = [
  { id: 'needle', name: '바늘 게이지' },
  { id: 'fine',   name: '정밀 게이지' },
  { id: 'digits', name: '큰 숫자' },
];
const normParts = (p) => ({
  num: PART_NUM_STYLES.some(x => x.id === p?.num) ? p.num : 'auto',
  plate: PART_PLATE_STYLES.some(x => x.id === p?.plate) ? p.plate : 'auto',
  meter: PART_METER_STYLES.some(x => x.id === p?.meter) ? p.meter : 'needle',
});
const MIN_FREQ_CAP = 170;   // 최저 주파수는 이보다 높게 못 올림 (G3 196Hz가 잘리면 G현이 안 잡힘)

const DEFAULT_SETTINGS = {
  gateDb: -40,       // 이 레벨(dB) 미만 소리는 무시 (노이즈 게이트)
  clarity: 0.90,     // 주기성 신뢰도 0~1. 잡음은 낮고 악기 소리는 높음
  stableFrames: 3,   // 같은 음이 N프레임 연속이어야 표시
  smoothing: 6,      // 평균낼 프레임 수 (클수록 부드럽고 느림)
  holdMs: 400,       // 소리가 끊긴 뒤 표시 유지 시간
  minFreq: 150,      // 감지 최저 Hz (바이올린 G3 = 196Hz, 낮게 풀린 G현도 잡히게 여유)
  maxFreq: 4200,     // 감지 최고 Hz (E현 최상단 A7 ≈ 3.5kHz 포함)
  uiMode: 'tape',    // 바탕 테마(theme.css data-theme) — design에서 자동으로 정해짐
  design: 'dark',    // 디자인 7가지 중 하나 → theme.jsx DESIGNS (dark·light·piano·leather·radio·violin·sheet)
  tunerLayout: 'vtapeTempo', // (예전) 튜너 화면 구성 — 이제 layout1로 옮겨짐. LAYOUT_PRESETS id
  layout1: makeLayout('t1', LAYOUT_PRESETS[0].on),   // 1번 탭 블록 배치 (LAYOUT_BLOCKS.t1)
  layout2: makeLayout('t2', DEFAULT_LAYOUT2_ON).map(b => b.id === 'pitch' ? { ...b, size: 's' } : b),   // 2번 탭 블록 배치 (LAYOUT_BLOCKS.t2)
  parts: { num: 'auto', plate: 'auto', meter: 'needle' },             // 부품별 꾸미기: 숫자 모양 · 판 모양
  recClicks: true,   // '메트로놈 녹음': 박 소리를 박에 맞춰 디지털로 넣고, 마이크로 들어온 스피커 메트로놈은 에코 제거로 지움 (recorder.jsx). 음질은 항상 128kbps
  recDelay: 3,       // 녹음 지연: 녹음 버튼 누르고 N초 뒤 시작 (0·3·5·10), 기본 3초
  autoCalib: true,   // 앱을 켤 때 3초 동안 주변 소음을 재서 감도 자동 조정
  layoutRev: 10,     // 레이아웃 기본값이 바뀐 버전 (이전 사용자도 1회 새 기본값으로)
  onboarded: false,  // 첫 실행 안내를 마쳤나 (onboarding.jsx) — 끝나기 전엔 마이크 자동 시작 안 함
  cmdEnabled: true,  // 연주 명령(음 패턴 → 메트로놈) 사용 → commands.jsx
  cmdPattern: ['G3', 'E5', 'G3'],
  cmdWindowMs: 3000, // 패턴을 이 시간 안에 연주해야 인정
};
const SETTINGS_KEY = 'vt.tunerSettings.v1';
const loadSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const v = { ...DEFAULT_SETTINGS, ...stored };
    if (!['tape', 'vintage', 'light'].includes(v.uiMode)) v.uiMode = 'tape';   // 예전 'modern' 등 → 기본값
    // 디자인: 예전 저장값은 테마에서 이어받음 (빈티지 → 라디오), 바탕 테마는 디자인에 맞춤
    const DESIGN_BASE = { dark: 'tape', light: 'light', piano: 'vintage', leather: 'vintage', radio: 'vintage', violin: 'vintage', sheet: 'vintage' };
    if (!stored.design || !DESIGN_BASE[v.design]) v.design = ({ tape: 'dark', light: 'light', vintage: 'radio' })[v.uiMode] || 'dark';
    v.uiMode = DESIGN_BASE[v.design];
    const rev = stored.layoutRev || 0;
    if (rev < 3) v.tunerLayout = 'vtapeTempo';   // 저장값 기준으로 판단
    if (!['vtapeTempo', 'tapeTempo', 'tape', 'center', 'both'].includes(v.tunerLayout)) v.tunerLayout = 'vtapeTempo';
    // 블록 배치: 저장값이 없으면 예전 '튜너 화면 구성'에서 만들어 줌
    // 11: '현별 막대' 블록 없앰 → 켜져 있었으면 그 자리에 세로 테이프 (이미 켜져 있으면 그냥 뺌)
    const l1src = Array.isArray(stored.layout1) ? stored.layout1.map(b => b && b.id === 'bars' ? (stored.layout1.some(x => x && x.id === 'vtapes' && x.on) ? null : { ...b, id: 'vtapes' }) : b).filter(Boolean) : null;
    v.layout1 = normLayout('t1', l1src || makeLayout('t1', LAYOUT_PRESETS.find(p => p.id === v.tunerLayout).on));
    v.layout2 = normLayout('t2', stored.layout2 || makeLayout('t2', DEFAULT_LAYOUT2_ON));
    v.parts = normParts(stored.parts);
    if (rev < 4) {
      // 4: 낮게 풀린 G현도 잡히게 최저 주파수 180 → 150, 1번 탭에 정밀 게이지 추가
      if (v.minFreq === 180) v.minFreq = 150;

      if (stored.layout1 && !stored.layout1.some(b => b.id === 'fine' && b.on)) {
        const l = v.layout1.filter(b => b.id !== 'fine');
        let at = l.findIndex(b => b.on && b.id === 'readout');
        if (at < 0) at = l.findIndex(b => b.on && LAYOUT_BLOCKS.t1.find(k => k.id === b.id).grow) + 1;
        l.splice(Math.max(0, at), 0, { id: 'fine', on: true, size: 'm' });
        v.layout1 = l;
      }
    }
    if (rev < 5 && v.maxFreq === 3500) v.maxFreq = 4200;   // 5: 지판 최상단 포지션(A7)까지 감지
    if (rev < 7) v.recClicks = true;    // 7: 박 소리 넣기 + 에코 제거 마이크로 다시 켬 (6에서 껐던 값 되돌림)
    if (rev < 8 && stored.parts?.beat === 'boxes') {
      // 8: 박 표시(원형/네모)를 화면 배치 블록으로 — 네모를 쓰던 사람은 다이얼 자리에 네모 칸 블록
      const l = v.layout2.filter(b => b.id !== 'boxes'), at = l.findIndex(b => b.id === 'dial');
      const dial = l[at];
      if (dial) { l.splice(at, 1, { ...dial, on: false }); l.splice(at, 0, { id: 'boxes', on: dial.on, size: dial.size }); }
      v.layout2 = l;
    }
    if (rev < 9 && !stored.recDelay) v.recDelay = 3;   // 9: 녹음 지연 기본 3초
    if (rev < 10) {
      // 10: 메트로놈 탭 새 구성 (박 조명 + 박자·템포·시작 묶음). 녹음 블록을 켜두었다면 유지
      const keepRec = v.layout2.find(b => b.id === 'rec' && b.on);
      const l = makeLayout('t2', DEFAULT_LAYOUT2_ON).map(b => b.id === 'pitch' ? { ...b, size: 's' } : b);
      if (keepRec) { const i = l.findIndex(b => b.id === 'rec'); l.splice(i, 1); l.splice(2, 0, keepRec); }
      v.layout2 = normLayout('t2', l);
    }
    v.layoutRev = 10;
    if (!(v.minFreq >= 40 && v.minFreq <= MIN_FREQ_CAP)) v.minFreq = Math.min(MIN_FREQ_CAP, Math.max(40, Number(v.minFreq) || 150));
    return v;
  }
  catch (_) { return { ...DEFAULT_SETTINGS }; }
};
// 부드러운 움직임: 목표값들을 매 프레임 조금씩 따라감 (지수 감쇠 스프링).
// onFrame(values)에서 DOM을 직접 바꿈 → React 리렌더 없이 60fps. snap 이상 차이 나면 바로 이동
const useSpring = (targets, onFrame, { k = 0.2, snap = Infinity } = {}) => {
  const st = useRef(null);
  if (!st.current) st.current = { v: [...targets], t: targets };
  st.current.t = targets;
  const cb = useRef(onFrame); cb.current = onFrame;
  useEffect(() => {
    const s = st.current; let raf;
    const tick = () => {
      s.v = s.v.map((v, i) => { const d = s.t[i] - v; return Math.abs(d) > snap || Math.abs(d) < 1e-4 ? s.t[i] : v + d * k; });
      cb.current(s.v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return st.current.v;     // 렌더 시점의 현재 값 (처음 그릴 때 위치용)
};

// 저장 잠금: 백업을 가져올 때 새로고침 직전에 메모리의 옛 값이 덮어쓰지 않게
const VT_STORAGE = { locked: false };
const vtSave = (k, v) => { if (VT_STORAGE.locked) return; try { localStorage.setItem(k, v); } catch (_) {} };
const saveSettings = (v) => vtSave(SETTINGS_KEY, JSON.stringify(v));
// 값이 바뀔 때마다 localStorage에 저장되고, 다음 실행 때 그대로 불러오는 useState
// validate(v) 가 false 면 기본값 사용 (예전 형식/깨진 값 방지)
const usePersistentState = (key, initial, validate = () => true) => {
  const [v, setV] = useState(() => {
    try {
      const raw = localStorage.getItem('vt.' + key);
      if (raw !== null) { const parsed = JSON.parse(raw); if (validate(parsed)) return parsed; }
    } catch (_) {}
    return initial;
  });
  useEffect(() => { vtSave('vt.' + key, JSON.stringify(v)); }, [key, v]);
  return [v, setV];
};

// 메트로놈 딸깍 소리 시각(performance.now 기준) — metronome.jsx가 기록, 튜너가 그 순간 분석을 건너뜀
const METRO_CLICKS = { times: [], grid: [] };   // times: 소리 나는 클릭(튜너 건너뛰기용) · grid: 모든 박/쪼갠 박 [시각, 첫박여부] (녹음 박자 분석용)
const CLICK_GATE_BEFORE = 20, CLICK_GATE_AFTER = 120;  // ms (마이크 지연 포함 여유)
const isNearMetroClick = (now) => {
  const t = METRO_CLICKS.times;
  while (t.length && t[0] < now - 1000) t.shift();
  // 클릭 간격이 250ms보다 촘촘하면(빠른 세분박) 건너뛰지 않음 → 분석이 계속 끊기지 않게 신뢰도 필터에 맡김
  for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] < 250) return false;
  return t.some(c => now >= c - CLICK_GATE_BEFORE && now <= c + CLICK_GATE_AFTER);
};

const rmsToDb = (r) => (r > 0 ? 20 * Math.log10(r) : -100);
const centsBetween = (a, b) => 1200 * Math.log2(a / b);

/* McLeod 피치 검출(NSDF). 바이올린 음역의 lag만 계산해서 가볍다.
   반환: { freq(-1=없음), clarity(0~1), rms } */
// 직류 성분(마이크 치우침)·웅웅거림 제거: 평균 빼고 고역통과(~80Hz, 2단)
const cleanBuffer = (buf, sr) => {
  const N = buf.length; let mean = 0;
  for (let i = 0; i < N; i++) mean += buf[i];
  mean /= N;
  const a = Math.exp(-2 * Math.PI * 80 / sr);
  for (let pass = 0; pass < 2; pass++) {          // 두 번 통과 → 더 가파르게 (G3 196Hz는 거의 그대로)
    let px = 0, py = 0;
    for (let i = 0; i < N; i++) { const x = pass ? buf[i] : buf[i] - mean; const y = a * (py + x - px); px = x; py = y; buf[i] = y; }
  }
  return buf;
};
const detectPitch = (buf, sr, minFreq, maxFreq) => {
  cleanBuffer(buf, sr);
  const N = buf.length;
  let sum = 0;
  for (let i = 0; i < N; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / N);
  if (rms < 1e-5) return { freq: -1, clarity: 0, rms };
  const minLag = Math.max(2, Math.floor(sr / maxFreq));
  const maxLag = Math.min(Math.floor(N / 2), Math.ceil(sr / minFreq));
  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = 0; tau <= maxLag + 1; tau++) {
    let acf = 0, m = 0;
    for (let j = 0; j < N - tau; j++) { const a = buf[j], b = buf[j + tau]; acf += a * b; m += a * a + b * b; }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }
  // 0 근처의 첫 양수 구간은 건너뛴다
  let tau = 1;
  while (tau < maxLag && nsdf[tau] > 0) tau++;
  if (tau < minLag) tau = minLag;
  const peaks = [];
  let best = -1, bestTau = -1;
  for (; tau <= maxLag; tau++) {
    if (nsdf[tau] > 0) {
      if (nsdf[tau] > best) { best = nsdf[tau]; bestTau = tau; }
    } else if (bestTau > 0) {
      peaks.push(bestTau); best = -1; bestTau = -1;
    }
  }
  if (bestTau > 0) peaks.push(bestTau);
  if (!peaks.length) return { freq: -1, clarity: 0, rms };
  let maxPeak = 0;
  peaks.forEach(t => { if (nsdf[t] > maxPeak) maxPeak = nsdf[t]; });
  const chosen = peaks.find(t => nsdf[t] >= 0.9 * maxPeak);
  // 포물선 보간
  const y1 = nsdf[chosen - 1], y2 = nsdf[chosen], y3 = nsdf[chosen + 1];
  const a = (y1 + y3 - 2 * y2) / 2, b = (y3 - y1) / 2;
  let T0 = chosen, clarity = y2;
  if (a < 0) { T0 = chosen - b / (2 * a); clarity = y2 - (b * b) / (4 * a); }
  return { freq: sr / T0, clarity: Math.min(1, clarity), rms };
};
