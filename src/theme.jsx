// ==========================================
// theme — 화면 모드(테마)와 공용 UI 조각
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
//
// 색/배경은 src/theme.css 의 t-* 클래스로 처리하고,
// 테마별로 모양 자체가 달라지는 부분만 useVintage()로 분기한다.
// ==========================================

// 사용자가 고르는 건 DESIGNS(7종, 아래). 각 디자인의 base = 바탕 테마(tape | light | vintage),
// 우드 계열(vintage)은 skin = SKINS 항목으로 숫자창·버튼·다이얼 모양이 달라진다.

const ThemeContext = React.createContext('tape');
const useTheme = () => React.useContext(ThemeContext);
const useVintage = () => useTheme() === 'vintage';

// <html data-theme="..."> 설정 → theme.css 변수가 바뀜
const applyTheme = (id) => { document.documentElement.dataset.theme = id; };

// 숫자 표시 (Hz · BPM)
//  - 테이프/라이트: 검은 숫자판
//  - 빈티지: 아르데코 라디오의 크림색 창 (RadioDigits)
const DrumDigits = ({ text, unit = 'Hz', size = 'md', onDark = false }) => {   // onDark: 어두운 바탕 위(황동판 밖)
  const vintage = useVintage();
  const big = size === 'lg';
  if (vintage) return <RadioDigits text={text} unit={unit} big={big}/>;
  return (
  <div className="flex items-end gap-[3px]">
    {text.split('').map((ch, i) => ch === '.' ? (
      <span key={i} className="text-lg font-black leading-none pb-1 text-gray-500">.</span>
    ) : (
      <span key={i} className={`${big ? 'w-[30px] h-11 text-[28px]' : 'w-[22px] h-8 text-lg'} rounded-[4px] flex items-center justify-center font-mono font-black`}
        style={{ background:'linear-gradient(180deg,#000,#1c1c1c 35%,#1c1c1c 65%,#000)', color:'#e5e5e5', border:'1px solid #262626' }}>
        {ch}
      </span>
    ))}
    <span className="ml-1 text-xs font-black pb-1 text-gray-500">{unit}</span>
  </div>
);
};

// ==========================================
// 디자인 3가지: 검정 · 흰색 · 클래식 (설정 · 첫 실행 안내에서 하나만 고름) — 피아노·가죽·바이올린·악보는 사용자 요청으로 폐기
//  base = 바탕 테마(theme.css의 data-theme), skin = 클래식(우드)의 계기판 모양(SKINS.radio)
// ==========================================
const DESIGNS = [
  { id: 'light', name: '기본',   desc: '흰 화면 · 밝은 곳', base: 'light' },
  { id: 'dark',  name: '절전형', desc: '검정 화면 · 배터리 절약', base: 'tape' },
  { id: 'radio', name: '클래식', desc: '나무색 · 크림 문자판', base: 'vintage', skin: 'radio' },
];
const designById = (id) => DESIGNS.find(d => d.id === id) || DESIGNS[0];

// 클래식(우드) 계기판 토큰
const SKINS = {
  radio: {
    frame: { background: 'linear-gradient(180deg,#5a3a1e,#3a2410)', border: '2px solid #b88a35', boxShadow: '0 6px 16px rgba(0,0,0,.5)' },
    win: { background: 'linear-gradient(180deg,#e9dcbc,#f8f0dc 40%,#e2d3ad)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,.35)', borderRadius: 8 },
    ink: '#2a1a0e', unit: '#5a3a1e', label: '#f4d78a', italic: false, emboss: false, hzDial: true,
    knob: { background: 'radial-gradient(circle at 40% 35%,#7a4a26,#3a2010)', border: '1px solid #b88a35', color: '#f4d78a' },
    tap: { background: 'radial-gradient(circle at 40% 35%,#7a4a26,#3a2010)', border: '2px solid #b88a35', color: '#f4d78a', borderRadius: 999 },
    play: { background: 'radial-gradient(circle at 40% 35%,#f4d78a,#b88a35)', border: '2px solid #6b4a12', color: '#3a2010', borderRadius: 999 },
    playOn: { background: 'radial-gradient(circle at 40% 35%,#7a4a26,#3a2010)', border: '2px solid #b88a35', color: '#f4d78a', borderRadius: 999 },
    presets: 'radio', lamp: { shape: 'diamond', on: '#f4d78a', strong: 'rgba(244,215,138,.45)', off: '#2a1a0e', border: '#b88a35' },
    dial: { outer: '#3a2410', ring: '#b88a35', face: 'cream', on: '#f4d78a', strong: 'rgba(244,215,138,.55)', off: 'rgba(184,138,53,.45)', text: '#2a1a0e', sub: '#5a3a1e', ticks: true, needle: '#c0392b' },
    good: '#7fd89c', live: '#7fd89c',
  },
};
const SkinContext = React.createContext('radio');
const useSkin = () => SKINS[React.useContext(SkinContext)] || SKINS.radio;

// 계기판 숫자 (디자인별 창·글자)
const SkinNumber = ({ skin, text, unit, size = 22 }) => (
  <span className="inline-flex items-baseline" style={{ ...skin.win, padding: skin.win.background ? `1px ${Math.round(size / 2.4)}px` : 0 }}>
    <span style={{ fontFamily: 'Georgia,serif', fontSize: size, lineHeight: 1.08, color: skin.ink, fontStyle: skin.italic ? 'italic' : 'normal',
      textShadow: skin.emboss ? '0 1px 0 #1e0f06, 0 -1px 0 rgba(255,230,160,.35)' : 'none' }}>{text}</span>
    {unit && <span style={{ fontFamily: 'Georgia,serif', fontSize: Math.max(9, size * 0.26), color: skin.unit, marginLeft: 4 }}>{unit}</span>}
  </span>
);

// ── 부품별 꾸미기: 디자인 위에 숫자 모양 · 판 모양을 덮어씀 (settings.parts, app.jsx에서 제공) ──
const PartsContext = React.createContext({ num: 'auto', plate: 'auto' });
const useParts = () => React.useContext(PartsContext);
const partsCustom = (p) => p.num !== 'auto' || p.plate !== 'auto';
// 판이 황동이면 숫자는 기본 플립 카드 (원래 시안)
const partNumStyle = (p) => p.num !== 'auto' ? p.num : p.plate === 'brass' ? 'flip' : null;

// 숫자 한 덩어리 — style: flip | radio | drum | led, size = 숫자 글자 크기(px)
const PartNumber = ({ style, text, unit, size = 26, unitColor }) => {
  const u = unit && <span style={{ fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: Math.max(9, size * 0.32), color: unitColor || '#8a6a3a', marginLeft: size * 0.18, alignSelf: 'center' }}>{unit}</span>;
  if (style === 'flip' || style === 'drum') {
    const flip = style === 'flip';
    return (
      <span className="inline-flex items-center" style={{ gap: Math.max(2, size * 0.1) }}>
        {text.split('').map((ch, i) => ch === '.' ? (
          <span key={i} style={{ width: size * 0.2, height: size * 0.2, borderRadius: 99, background: flip ? '#3e2614' : '#6b7280', alignSelf: 'flex-end', marginBottom: size * 0.2 }}/>
        ) : (
          <span key={i} className="relative inline-flex items-center justify-center" style={{
            width: size * 0.78, height: size * 1.3, borderRadius: Math.max(3, size * 0.12),
            background: flip ? 'linear-gradient(180deg,#5c3a20,#3e2614 49%,#2c180a 51%,#45291a)' : 'linear-gradient(180deg,#000,#1c1c1c 35%,#1c1c1c 65%,#000)',
            border: flip ? '1px solid #1e0f06' : '1px solid #262626',
            boxShadow: flip ? '0 2px 3px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,220,170,.15)' : 'none',
            color: flip ? '#f4e6c4' : '#e5e5e5', fontFamily: flip ? 'Georgia,serif' : 'ui-monospace,monospace', fontWeight: 700, fontSize: size, lineHeight: 1 }}>
            {ch}
            <i className="absolute inset-x-0 top-1/2" style={{ height: 1, background: flip ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.05)' }}/>
          </span>
        ))}
        {u}
      </span>
    );
  }
  const shown = text.replace(/^0+(?=\d)/, '');
  if (style === 'led') return (
    <span className="inline-flex items-baseline rounded-md" style={{ background: '#0b0b0b', border: '1px solid #222', boxShadow: 'inset 0 2px 6px rgba(0,0,0,.9)', padding: `1px ${size * 0.35}px` }}>
      <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 800, fontSize: size, lineHeight: 1.1, color: '#ff5a36', textShadow: '0 0 6px rgba(255,90,54,.85)', letterSpacing: '0.04em' }}>{shown}</span>
      {unit && <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 800, fontSize: Math.max(9, size * 0.3), color: 'rgba(255,90,54,.7)', marginLeft: 4 }}>{unit}</span>}
    </span>
  );
  // radio: 크림색 창
  return (
    <span className="inline-flex items-baseline rounded-lg" style={{ background: 'linear-gradient(180deg,#e9dcbc,#f8f0dc 40%,#e2d3ad)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,.35)', padding: `1px ${size * 0.4}px` }}>
      <span style={{ fontFamily: 'Georgia,serif', fontSize: size, lineHeight: 1.08, color: '#2a1a0e' }}>{shown}</span>
      {unit && <span style={{ fontFamily: 'Georgia,serif', fontSize: Math.max(9, size * 0.28), color: '#5a3a1e', marginLeft: 4 }}>{unit}</span>}
    </span>
  );
};

// ── 음정 그래프 색 (실시간 그래프 · 녹음 재생 그래프 공용) — 디자인 바탕에 맞춤 ──
//  다크·라이트 = 검은 표시창, 우드 = 그 디자인의 다이얼 문자판 색 (라디오·악보는 밝은 문자판 → 진한 점 색)
const graphLook = (vintage, skin, light) => {
  if (!vintage && light) return { face: '#f7f7f4', zero: '#d4d4d8', beat: '#a1a1aa', sub: '#e4e4e7', text: '#52525b', dim: '#71717a', ok: '#059669', hi: '#dc2626', lo: '#2563eb', band: 'rgba(5,150,105,.12)', head: '#18181b', shadow: 'inset 0 1px 4px rgba(0,0,0,.08)' };
  if (!vintage) return { face: '#0a0a0a', zero: '#3f3f46', beat: '#52525b', sub: '#27272a', text: '#a1a1aa', dim: '#6b7280', ok: '#4afc9d', hi: '#ef4444', lo: '#3b82f6', band: 'rgba(74,252,157,.12)', head: 'rgba(255,255,255,.85)', shadow: 'inset 0 2px 8px rgba(0,0,0,.5)' };
  const lightFace = skin.dial.ticks || skin.quarter;          // 라디오(크림) · 악보(양피지)
  const face = skin.dial.ticks ? '#f3e8cc' : skin.dial.face;
  if (lightFace) return { face, zero: 'rgba(90,58,30,.45)', beat: 'rgba(90,58,30,.45)', sub: 'rgba(90,58,30,.18)', text: '#5a3a1e', dim: 'rgba(90,58,30,.7)', ok: '#15803d', hi: '#b91c1c', lo: '#1d4ed8', band: 'rgba(21,128,61,.14)', head: '#3a2410', shadow: 'inset 0 2px 6px rgba(0,0,0,.25)' };
  return { face, zero: 'rgba(255,255,255,.18)', beat: 'rgba(255,255,255,.28)', sub: 'rgba(255,255,255,.1)', text: skin.dial.sub, dim: skin.dial.sub, ok: '#4afc9d', hi: '#f87171', lo: '#60a5fa', band: 'rgba(74,252,157,.12)', head: skin.dial.on, shadow: 'inset 0 2px 8px rgba(0,0,0,.5)' };
};

// ── 음역 그래프: 세로축 = 실제 음 높이 (반음마다 줄 + 음이름), 연주한 음역에 맞춰 범위 자동 ──
const noteSemi = (label) => { const m = /^([A-G]#?)(-?\d+)$/.exec(label || ''); return m ? NOTE_NAMES.indexOf(m[1]) + (Number(m[2]) + 1) * 12 - 69 : null; };
const pitchRange = (vals) => {
  if (!vals.length) return [-15, 8];                       // 아무 음도 없으면 G3~E5 근처
  let lo = Math.floor(Math.min(...vals)) - 1, hi = Math.ceil(Math.max(...vals)) + 1;
  if (hi - lo < 6) { const c = (hi + lo) / 2; lo = Math.floor(c - 3); hi = Math.ceil(c + 3); }
  return [lo, hi];
};
const OPEN_STRING_SEMIS = [-14, -7, 0, 7];   // G3 D4 A4 E5
const PitchRows = ({ lo, hi, L, vintage }) => {
  const span = hi - lo, rows = [];
  for (let k = lo; k <= hi; k++) {
    const nm = NOTE_NAMES[((k + 9) % 12 + 12) % 12], oct = Math.floor((k + 57) / 12), open = OPEN_STRING_SEMIS.includes(k);
    const top = ((hi - k) / span) * 100, natural = !nm.includes('#');
    rows.push(<i key={'r' + k} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${top}%`, height: open ? 2 : 1, marginTop: open ? -1 : -0.5,
      background: open ? L.ok : natural ? L.zero : L.sub, opacity: open ? 0.45 : 1 }}/>);
    if (natural || span <= 10) rows.push(<span key={'n' + k} className="absolute left-1 pointer-events-none font-black leading-none" style={{ top: `${top}%`, transform: 'translateY(-50%)', fontSize: 8,
      color: open ? L.ok : L.dim, fontFamily: vintage ? 'Georgia,serif' : undefined }}>{nm.replace('#', '♯')}{oct}</span>);
  }
  return rows;
};

// ── 화면 배치 블록 감싸기 (LAYOUT_BLOCKS) ──
//  grow 블록: 크기 = 남는 공간 차지 비율 (작게는 최대 45%)
//  고정 블록: 크기 = 확대 배율 (zoom — 폭은 화면 안에 맞춰지고 높이만 커짐)
const BLOCK_ZOOM = { s: 0.85, m: 1, l: 1.2 };
const BLOCK_GROW = { s: 1, m: 2, l: 3 };
// 설정 미리보기에서 고른 블록을 테두리로 표시
const LayoutHighlightContext = React.createContext(null);
const LayoutBlock = ({ id, grow, noZoom, size = 'm', weight = 1, children }) => {   // weight: 남는 공간 나눌 때 비율 배수
  const hl = React.useContext(LayoutHighlightContext) === id;
  const mark = hl ? { outline: '3px solid var(--accent)', outlineOffset: 2, borderRadius: 14 } : {};
  return grow
    ? <div className="w-full min-h-0 flex flex-col items-center" style={{ flex: `${BLOCK_GROW[size] * weight} 1 0`, maxHeight: size === 's' ? '45%' : undefined, ...mark }}>{children}</div>
    : <div className="w-full shrink-0 flex flex-col items-center" style={{ zoom: noZoom ? 1 : BLOCK_ZOOM[size], ...mark }}>{children}</div>;
};
// 켜진 블록만 순서대로 [{id, size, grow}]
const visibleBlocks = (tab, list) => list.filter(b => b.on).map(b => { const k = LAYOUT_BLOCKS[tab].find(x => x.id === b.id) || {}; return { ...b, grow: !!k.grow, noZoom: !!k.noZoom }; });
// 녹음 모듈이 어느 탭에서든 같은 녹음기를 쓰도록 (app.jsx에서 제공)
const RecorderContext = React.createContext(null);

// 디자인 고르기 카드 (설정 · 첫 실행 안내 공용) — 실제 Hz·BPM 모양을 작게 미리 보여줌
const WOOD_BG = 'repeating-linear-gradient(92deg,rgba(0,0,0,.12) 0 2px,transparent 2px 6px),linear-gradient(180deg,#6e4220,#3a200d)';
const DesignPreview = ({ d }) => {
  if (!d.skin) {
    const light = d.id === 'light';
    return (
      <div className="w-full h-full p-1.5 flex flex-col justify-center gap-1" style={{ background: light ? '#f4f3ee' : '#000' }}>
        <div className="h-4 rounded flex items-center justify-center text-[10px] font-bold" style={{ background: '#111', color: '#e5e5e5' }}>443.5</div>
        <div className="h-[22px] rounded-md flex items-center justify-center text-[15px] font-black" style={light ? { background: '#fff', color: '#111', border: '1px solid #ddd' } : { background: '#111', color: '#fff' }}>92</div>
      </div>
    );
  }
  const k = SKINS[d.skin];
  return (
    <div className="w-full h-full p-1.5 flex flex-col justify-center gap-1" style={{ background: WOOD_BG }}>
      <div className="h-4 rounded flex items-center justify-center overflow-hidden" style={{ ...k.frame, outlineOffset: '-3px', padding: 0, borderRadius: 5 }}>
        <SkinNumber skin={k} text="443.5" size={10}/>
      </div>
      <div className="h-[22px] rounded-md flex items-center justify-center overflow-hidden" style={{ ...k.frame, outlineOffset: '-3px', padding: 0 }}>
        <SkinNumber skin={k} text={k.quarter ? '♩ = 92' : '92'} size={k.quarter ? 11 : 14}/>
      </div>
    </div>
  );
};

const DesignPicker = ({ value, onChange, compact }) => (
  <div className="flex flex-col gap-2">
    {[0].map(g => (
      <div key={g}>
        <div className="grid grid-cols-3 gap-2">
          {DESIGNS.map(d => {
            const on = value === d.id;
            return (
              <button key={d.id} onClick={() => { onChange(d); haptic(10); }}
                className="rounded-xl overflow-hidden border-2 transition-all active:scale-95 text-center"
                style={{ borderColor: on ? 'var(--accent)' : 'var(--chip-border)', boxShadow: on ? '0 0 10px rgba(74,252,157,.3)' : 'none' }}>
                <div className="h-[60px] w-full"><DesignPreview d={d}/></div>
                <div className="py-1 t-chip" style={{ border: 'none', borderRadius: 0 }}>
                  <div className="text-xs font-black" style={{ color: on ? 'var(--accent)' : 'var(--ink)' }}>{d.name}</div>
                  {!compact && <div className="text-[8.5px] text-gray-500">{d.desc}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

// ── 빈티지 = 아르데코 라디오 (시안 ③) ──
// 갈색 판 + 황동 테두리 · 크림색 눈금 창 · 베이클라이트 손잡이 버튼
const RADIO = {
  frame: { background: 'linear-gradient(180deg,#5a3a1e,#3a2410)', border: '2px solid #b88a35', boxShadow: '0 6px 16px rgba(0,0,0,.5)' },
  window: { background: 'linear-gradient(180deg,#e9dcbc,#f8f0dc 40%,#e2d3ad)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,.35)' },
  knob: { background: 'radial-gradient(circle at 40% 35%,#7a4a26,#3a2010)', border: '1px solid #b88a35', color: '#f4d78a' },
  brassKnob: { background: 'radial-gradient(circle at 40% 35%,#f4d78a,#b88a35)', border: '2px solid #6b4a12', color: '#3a2010' },
  ink: '#2a1a0e', brown: '#5a3a1e', cream: '#f4d78a', needle: '#c0392b',
};

// 크림색 창 안의 숫자 (앞자리 0은 지움: '092' → '92')
const RadioDigits = ({ text, unit, big }) => {
  const shown = text.replace(/^0+(?=\d)/, '');
  return (
    <span className="inline-flex items-baseline rounded-lg" style={{ ...RADIO.window, padding: big ? '2px 14px' : '1px 10px' }}>
      <span style={{ fontFamily: 'Georgia,serif', fontSize: big ? 40 : 22, lineHeight: 1.05, color: RADIO.ink }}>{shown}</span>
      {unit && <span style={{ fontFamily: 'Georgia,serif', fontSize: big ? 10 : 9, color: RADIO.brown, marginLeft: 4 }}>{unit}</span>}
    </span>
  );
};

// Hz 눈금 창: 가장 가까운 음 기준 −50~+50센트를 Hz 눈금으로, 빨간 바늘이 지금 음정을 가리킴
const RadioDial = ({ hz, cents, live, tolerance, label }) => {
  const c = live ? Math.max(-50, Math.min(50, cents)) : 0;
  const f0 = live ? hz / Math.pow(2, cents / 1200) : 442;      // 가장 가까운 음의 정확한 주파수
  const x = (v) => 4 + ((v + 50) / 100) * 92;                  // 센트 → 창 안 위치(%)
  const ok = live && Math.abs(cents) <= tolerance;
  return (
    <div className="relative h-[46px] rounded-lg overflow-hidden flex-1" style={RADIO.window}>
      {/* 허용 범위 */}
      <div className="absolute top-0 h-[16px]" style={{ left: `${x(-tolerance)}%`, width: `${(tolerance / 100) * 92 * 2}%`, background: ok ? 'rgba(31,122,46,.35)' : 'rgba(31,122,46,.15)' }}/>
      {/* 눈금: 5센트마다, 25센트마다 길게 */}
      {Array.from({ length: 21 }, (_, k) => {
        const v = -50 + k * 5;
        return <i key={k} className="absolute top-0" style={{ left: `${x(v)}%`, width: 1, height: v % 25 === 0 ? 14 : 7, background: RADIO.brown }}/>;
      })}
      {[-50, -25, 0, 25, 50].map(v => (
        <span key={v} className="absolute" style={{ left: `${x(v)}%`, top: 15, transform: 'translateX(-50%)', font: '700 9px Georgia,serif', color: RADIO.brown }}>
          {(f0 * Math.pow(2, v / 1200)).toFixed(v === 0 ? 1 : 0)}
        </span>
      ))}
      {/* 음이름 · 숫자 */}
      <span className="absolute left-2 bottom-[3px]" style={{ font: '700 13px Georgia,serif', color: RADIO.ink }}>{live ? label : '—'}</span>
      <span className="absolute right-2 bottom-[3px]" style={{ font: '700 13px Georgia,serif', color: RADIO.ink }}>
        {live ? `${hz.toFixed(1)} Hz` : '— Hz'} <span style={{ color: !live ? RADIO.brown : ok ? '#1f7a2e' : cents > 0 ? '#b3261e' : '#1d4ed8' }}>{live ? `${cents > 0 ? '+' : ''}${cents}¢` : ''}</span>
      </span>
      {/* 바늘 */}
      <i className="absolute top-0 bottom-0 transition-[left] duration-100" style={{ left: `${x(c)}%`, width: 2, marginLeft: -1, background: RADIO.needle, boxShadow: '0 0 4px rgba(192,57,43,.6)', opacity: live ? 1 : 0.35 }}/>
    </div>
  );
};

const Screw = ({ className }) => (
  <span className={`absolute w-3 h-3 rounded-full ${className}`}
    style={{ background:'radial-gradient(circle at 35% 35%,#fff6d0,#b8902f 55%,#6b4a12)', boxShadow:'0 1px 2px rgba(0,0,0,.6)' }}>
    <span className="absolute inset-x-[2px] top-1/2 h-[1.5px] -translate-y-1/2 rotate-45 bg-[#5a3d0c]/80"/>
  </span>
);

// 황동 명판 (빈티지 테마용 액자)
const BrassPlate = ({ children, className = '' }) => (
  <div className={`relative px-5 py-3 rounded-[22px] ${className}`}
    style={{ background:'linear-gradient(180deg,#f3dc93,#d4ad55 30%,#b88a35 55%,#e6c879 85%,#c79b45)',
             border:'2px solid #6b4a12', boxShadow:'0 10px 30px rgba(0,0,0,.6), inset 0 2px 0 rgba(255,255,255,.5), inset 0 -2px 0 rgba(0,0,0,.25)' }}>
    <Screw className="top-1.5 left-1.5"/><Screw className="top-1.5 right-1.5"/>
    <Screw className="bottom-1.5 left-1.5"/><Screw className="bottom-1.5 right-1.5"/>
    {children}
  </div>
);

// 위 줄 칩 드롭다운 (A4 · 허용 범위): 누르면 칩 바로 아래에 목록, 고르면 닫힘, 바깥 누르면 닫힘
const ChipDropdown = ({ value, options, onPick, render, renderItem, ariaLabel, className = '', side }) => {   // side: 목록을 버튼 오른쪽에 (가로 화면 왼쪽 막대)
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null), listRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0 });
  const vintage = useVintage(), skin = useSkin(), light = useTheme() === 'light';
  const openList = () => { const r = btnRef.current.getBoundingClientRect();
    const top = side ? Math.max(8, Math.min(r.top, window.innerHeight - 308)) : r.bottom + 6;
    setPos({ left: side ? r.right + 8 : r.left, top, width: r.width }); setOpen(true); haptic(8); };
  useEffect(() => { if (open && listRef.current) { const el = listRef.current.querySelector('[data-cur="1"]'); if (el) el.scrollIntoView({ block: 'center' }); } }, [open]);
  const hi = vintage ? '#ff1744' : light ? '#00c853' : '#00b0ff';
  return (
    <>
      <button ref={btnRef} onClick={openList} aria-label={ariaLabel} aria-expanded={open}
        className={side ? `flex flex-col items-center t-chip px-1 py-1 rounded-xl text-[10px] font-bold w-[52px] shrink-0 active:scale-95 ${className}`
          : `flex items-center gap-1.5 t-chip px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 active:scale-95 transition-transform shadow-md ${className}`}>
        {render(value)}{!side && <ChevronDown size={12} className="opacity-50 -mr-1"/>}
      </button>
      {open && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)}>
          <div ref={listRef} className={`fixed rounded-2xl py-1.5 overflow-y-auto shadow-[0_12px_32px_rgba(0,0,0,.45)] ${vintage ? '' : 't-sheet'}`}
            style={{ left: pos.left, top: pos.top, minWidth: Math.max(pos.width, 104), maxHeight: 300, ...(vintage ? skin.frame : {}) }} onClick={e => e.stopPropagation()}>
            {options.map(o => { const on = o === value;
              return <button key={o} data-cur={on ? '1' : '0'} onClick={() => { onPick(o); setOpen(false); haptic(8); }}
                className="w-full px-4 py-2.5 text-left font-mono font-black text-[15px] flex items-center justify-between gap-3"
                style={{ color: on ? hi : vintage ? skin.label : 'var(--ink)', background: on ? (vintage ? 'rgba(0,0,0,.25)' : 'rgba(128,128,128,.12)') : 'transparent' }}>
                {renderItem ? renderItem(o) : o}{on && <span>✓</span>}
              </button>; })}
          </div>
        </div>, document.body)}
    </>
  );
};
