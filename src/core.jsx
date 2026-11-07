// ==========================================
// core — 공통 상수, 설정, 피치 검출
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → app)
// ==========================================

/* =====================================================
   모든 React hooks 및 Lucide 아이콘을 전역에서 가져옴
===================================================== */
const { useState, useEffect, useRef, useCallback } = React;
const {
  Play, Square, Settings, Volume2, VolumeX, AlertCircle,
  Music, Activity, Minus, Plus, ChevronUp, ChevronDown, RotateCcw,
  LayoutGrid, SlidersHorizontal, X, Mic, ZoomIn, ZoomOut, AudioWaveform, Waves, BarChart3, Flame, Trash2, Download, Upload, Target
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
const DEFAULT_SETTINGS = {
  gateDb: -40,       // 이 레벨(dB) 미만 소리는 무시 (노이즈 게이트)
  clarity: 0.90,     // 주기성 신뢰도 0~1. 잡음은 낮고 악기 소리는 높음
  stableFrames: 3,   // 같은 음이 N프레임 연속이어야 표시
  smoothing: 6,      // 평균낼 프레임 수 (클수록 부드럽고 느림)
  holdMs: 400,       // 소리가 끊긴 뒤 표시 유지 시간
  minFreq: 180,      // 감지 최저 Hz (바이올린 G3 = 196Hz)
  maxFreq: 3500,     // 감지 최고 Hz
  uiMode: 'tape',    // 화면 모드(테마): 'tape' | 'vintage'  → theme.jsx UI_MODES
  tunerLayout: 'vtapeTempo', // 튜너 화면 구성: 'vtapeTempo'(현별 세로 테이프+템포) | 'tapeTempo' | 'tape' | 'center' | 'both'  → tuner.jsx TUNER_LAYOUTS
  layoutRev: 3,      // 레이아웃 기본값이 바뀐 버전 (이전 사용자도 1회 새 기본값으로)
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
    if (stored.layoutRev !== 3) { v.tunerLayout = 'vtapeTempo'; v.layoutRev = 3; }   // 저장값 기준으로 판단
    if (!['vtapeTempo', 'tapeTempo', 'tape', 'center', 'both'].includes(v.tunerLayout)) v.tunerLayout = 'vtapeTempo';
    return v;
  }
  catch (_) { return { ...DEFAULT_SETTINGS }; }
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
const METRO_CLICKS = { times: [] };
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
const detectPitch = (buf, sr, minFreq, maxFreq) => {
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
