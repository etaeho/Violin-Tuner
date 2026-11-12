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
// 디자인 7가지 (설정 · 첫 실행 안내에서 하나만 고름)
//  base = 바탕 테마(theme.css의 data-theme), skin = 우드 계열의 계기판 모양(SKINS)
//  우드 계열은 원목 배경을 같이 쓰고 Hz 표시줄 · 템포 패널 · 2번 탭 다이얼만 모양이 다름
// ==========================================
const DESIGNS = [
  { id: 'dark',    group: '기본',          name: '다크',     desc: '기본',          base: 'tape' },
  { id: 'light',   group: '기본',          name: '라이트',   desc: '야외 · 밝은 곳', base: 'light' },
  { id: 'piano',   group: '우드 · 아날로그', name: '피아노',   desc: '블랙 · 아이보리', base: 'vintage', skin: 'piano' },
  { id: 'leather', group: '우드 · 아날로그', name: '가죽',     desc: '케이스 · 스티치', base: 'vintage', skin: 'leather' },
  { id: 'radio',   group: '우드 · 아날로그', name: '라디오',   desc: '아르데코',       base: 'vintage', skin: 'radio' },
  { id: 'violin',  group: '우드 · 아날로그', name: '바이올린', desc: '단풍나무 · 흑단', base: 'vintage', skin: 'violin' },
  { id: 'sheet',   group: '우드 · 아날로그', name: '악보',     desc: '양피지 · 잉크',  base: 'vintage', skin: 'sheet' },
];
const designById = (id) => DESIGNS.find(d => d.id === id) || DESIGNS[0];

// 우드 계열 계기판 토큰 — 새 디자인 = 여기 항목 하나 + DESIGNS 한 줄
const SKINS = {
  piano: {
    frame: { background: 'linear-gradient(180deg,#2a2a2a,#0a0a0a 45%,#000)', border: '1px solid #c9a14a', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18),0 6px 16px rgba(0,0,0,.5)' },
    win: {}, ink: '#f4ecd8', unit: '#c9a14a', label: '#c9a14a', italic: false, emboss: false,
    knob: { background: '#111', border: '1px solid #444', color: '#f4ecd8' },
    tap: { background: '#111', border: '1px solid #c9a14a', color: '#f4ecd8', borderRadius: 12 },
    play: { background: 'linear-gradient(#f4ecd8,#d8ccb0)', color: '#111', border: '1px solid #c9a14a', borderRadius: 12 },
    playOn: { background: '#111', color: '#f4ecd8', border: '1px solid #c9a14a', borderRadius: 12 },
    presets: 'keys', lamp: { shape: 'circle', on: '#f4ecd8', strong: '#bfb39a', off: '#4a4a4a', border: 'transparent' },
    dial: { outer: '#0a0a0a', ring: '#c9a14a', face: '#111', on: '#f4ecd8', strong: '#8a826f', off: '#333', text: '#f4ecd8', sub: '#c9a14a', ticks: false },
    good: '#4afc9d', live: '#4afc9d',
  },
  leather: {
    frame: { background: 'radial-gradient(ellipse at 30% 15%,#6a3c22,#3a2012 72%)', outline: '1.5px dashed rgba(240,210,160,.45)', outlineOffset: '-6px', boxShadow: '0 6px 16px rgba(0,0,0,.5)' },
    win: {}, ink: '#e8c46a', unit: '#d9b878', label: '#e8c46a', italic: false, emboss: true,
    knob: { background: '#2a170c', border: '1px solid #8a6a3a', color: '#e8c46a' },
    tap: { background: 'radial-gradient(circle at 35% 30%,#fff3c4,#c9a14a 55%,#6b4a12)', color: '#3b2a1a', borderRadius: 999 },
    play: { background: 'radial-gradient(circle at 35% 30%,#fff3c4,#c9a14a 55%,#6b4a12)', color: '#3b2a1a', borderRadius: 999 },
    playOn: { background: '#2a170c', border: '1px solid #8a6a3a', color: '#e8c46a', borderRadius: 999 },
    presets: 'stitch', lamp: { shape: 'stud', on: '#fff3c4', strong: '#c9a14a', off: '#2a170c', border: '#8a6a3a' },
    dial: { outer: '#3a2012', ring: 'rgba(240,210,160,.45)', ringDash: true, face: '#4a2915', on: '#e8c46a', strong: 'rgba(232,196,106,.55)', off: 'rgba(232,196,106,.18)', text: '#e8c46a', sub: '#d9b878', ticks: false },
    good: '#9be3b0', live: '#7fd89c',
  },
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
  violin: {
    frame: { background: 'linear-gradient(100deg,#a9561a,#d98f3f 35%,#c87a30 60%,#9a4c16)', boxShadow: 'inset 0 1px 0 rgba(255,230,180,.45),0 6px 16px rgba(0,0,0,.5)' },
    win: { background: 'linear-gradient(180deg,#1a1a1a,#050505)', borderRadius: 8, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.1)' },
    ink: '#efe6d0', unit: '#c9a14a', label: '#2a1205', italic: false, emboss: false, fhole: true,
    knob: { background: 'radial-gradient(circle at 40% 35%,#2a2a2a,#050505)', border: '2px solid #f5f0e6', color: '#efe6d0' },   // 줄감개(페그): 흑단 + 자개 테두리
    tap: { background: 'linear-gradient(180deg,#2a2a2a,#050505)', color: '#efe6d0', borderRadius: 999, boxShadow: '0 2px 4px rgba(0,0,0,.5)' },
    play: { background: 'linear-gradient(180deg,#2a2a2a,#050505)', color: '#efe6d0', borderRadius: 999, boxShadow: '0 2px 4px rgba(0,0,0,.5)' },
    playOn: { background: '#efe6d0', color: '#111', borderRadius: 999 },
    presets: 'ebony', lamp: { shape: 'circle', on: '#fff4dc', strong: '#e8b06a', off: '#3a1a08', border: '#2a1205' },
    dial: { outer: '#c87a30', ring: '#9a4c16', face: '#0d0d0d', on: '#fff4dc', strong: 'rgba(255,244,220,.5)', off: 'rgba(255,244,220,.18)', text: '#efe6d0', sub: '#c9a14a', ticks: false },
    good: '#0f4d22', live: '#0f4d22', centsOnFrame: true,
  },
  sheet: {
    frame: { background: 'repeating-linear-gradient(180deg,transparent 0 9px,rgba(80,50,20,.14) 9px 10px),linear-gradient(180deg,#efe2c0,#e2cfa0)', border: '1px solid #b89a5e', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,.45)' },
    win: {}, ink: '#1f140a', unit: '#5a3d1e', label: '#5a3d1e', italic: true, emboss: false, quarter: true,
    knob: { background: '#f8f1de', border: '1.5px solid #5a3d1e', color: '#1f140a' },
    tap: { background: 'radial-gradient(circle at 40% 35%,#d84a3a,#8e1f16)', color: '#f6e2c8', borderRadius: 999, boxShadow: '0 2px 3px rgba(0,0,0,.4)' },
    play: { background: 'radial-gradient(circle at 40% 35%,#d84a3a,#8e1f16)', color: '#f6e2c8', borderRadius: 999, boxShadow: '0 2px 3px rgba(0,0,0,.4)' },
    playOn: { background: '#1f140a', color: '#efe2c0', borderRadius: 999 },
    presets: 'ink', lamp: { shape: 'note', on: '#1f140a', strong: 'rgba(31,20,10,.6)', off: 'rgba(31,20,10,.3)' },
    dial: { outer: '#e2cfa0', ring: '#b89a5e', face: '#efe2c0', on: '#1f140a', strong: 'rgba(31,20,10,.45)', off: 'rgba(31,20,10,.18)', text: '#1f140a', sub: '#5a3d1e', ticks: false },
    good: '#2e6b3a', live: '#2e6b3a', centsOnFrame: true,
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
const graphLook = (vintage, skin) => {
  if (!vintage) return { face: '#0a0a0a', zero: '#3f3f46', beat: '#52525b', sub: '#27272a', text: '#a1a1aa', dim: '#6b7280', ok: '#4afc9d', hi: '#ef4444', lo: '#3b82f6', band: 'rgba(74,252,157,.12)', head: 'rgba(255,255,255,.85)', shadow: 'inset 0 2px 8px rgba(0,0,0,.5)' };
  const lightFace = skin.dial.ticks || skin.quarter;          // 라디오(크림) · 악보(양피지)
  const face = skin.dial.ticks ? '#f3e8cc' : skin.dial.face;
  if (lightFace) return { face, zero: 'rgba(90,58,30,.45)', beat: 'rgba(90,58,30,.45)', sub: 'rgba(90,58,30,.18)', text: '#5a3a1e', dim: 'rgba(90,58,30,.7)', ok: '#15803d', hi: '#b91c1c', lo: '#1d4ed8', band: 'rgba(21,128,61,.14)', head: '#3a2410', shadow: 'inset 0 2px 6px rgba(0,0,0,.25)' };
  return { face, zero: 'rgba(255,255,255,.18)', beat: 'rgba(255,255,255,.28)', sub: 'rgba(255,255,255,.1)', text: skin.dial.sub, dim: skin.dial.sub, ok: '#4afc9d', hi: '#f87171', lo: '#60a5fa', band: 'rgba(74,252,157,.12)', head: skin.dial.on, shadow: 'inset 0 2px 8px rgba(0,0,0,.5)' };
};

// ── 화면 배치 블록 감싸기 (LAYOUT_BLOCKS) ──
//  grow 블록: 크기 = 남는 공간 차지 비율 (작게는 최대 45%)
//  고정 블록: 크기 = 확대 배율 (zoom — 폭은 화면 안에 맞춰지고 높이만 커짐)
const BLOCK_ZOOM = { s: 0.85, m: 1, l: 1.2 };
const BLOCK_GROW = { s: 1, m: 2, l: 3 };
// 설정 미리보기에서 고른 블록을 테두리로 표시
const LayoutHighlightContext = React.createContext(null);
const LayoutBlock = ({ id, grow, noZoom, size = 'm', children }) => {
  const hl = React.useContext(LayoutHighlightContext) === id;
  const mark = hl ? { outline: '3px solid var(--accent)', outlineOffset: 2, borderRadius: 14 } : {};
  return grow
    ? <div className="w-full min-h-0 flex flex-col items-center" style={{ flex: `${BLOCK_GROW[size]} 1 0`, maxHeight: size === 's' ? '45%' : undefined, ...mark }}>{children}</div>
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
    {['기본', '우드 · 아날로그'].map(g => (
      <div key={g}>
        <div className="text-[10px] font-bold text-gray-500 mb-1.5 ml-0.5">{g}</div>
        <div className="grid grid-cols-3 gap-2">
          {DESIGNS.filter(d => d.group === g).map(d => {
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
