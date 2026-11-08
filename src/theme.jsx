// ==========================================
// theme — 화면 모드(테마)와 공용 UI 조각
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → app)
//
// 색/배경은 src/theme.css 의 t-* 클래스로 처리하고,
// 테마별로 모양 자체가 달라지는 부분만 useVintage()로 분기한다.
// ==========================================

const UI_MODES = [
  { id:'tape',    name:'테이프', desc:'다크 · 기본' },
  { id:'vintage', name:'빈티지', desc:'황동 · 원목' },
  { id:'light',   name:'라이트', desc:'밝은 화면 · 야외' },
];

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

// 설정 시트의 모드 선택 카드 미리보기
const ModePreview = ({ id }) => {
  if (id === 'light') return (
    <div className="w-full h-full flex items-end p-1.5" style={{ background: '#f4f3ee' }}>
      <div className="w-full rounded p-[3px] bg-white" style={{ border: '1px solid #e4e4e7' }}>
        <div className="relative h-6 rounded-sm overflow-hidden flex items-end justify-around pb-[2px]" style={{ background: '#111', borderTop: '6px solid #0b0b0b' }}>
          {['G','A','B'].map(n => <span key={n} className="text-[9px] font-black leading-none" style={{ color: n === 'A' ? '#4afc9d' : '#555' }}>{n}</span>)}
          <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-red-600"/>
        </div>
      </div>
    </div>
  );
  const v = id === 'vintage';
  return (
    <div className="w-full h-full flex items-end p-1.5"
      style={{ background: v ? 'linear-gradient(180deg,#6e4220,#3a200d)' : '#000' }}>
      <div className="w-full rounded p-[3px]" style={{ background: v ? 'linear-gradient(#f3dc93,#b88a35)' : 'transparent' }}>
        <div className="relative h-6 rounded-sm overflow-hidden flex items-end justify-around pb-[2px]"
          style={{ background: v ? '#f6f1e4' : '#111', borderTop: `6px solid ${v ? '#2a2a2a' : '#0b0b0b'}` }}>
          {['G','A','B'].map(n => (
            <span key={n} className="text-[9px] font-black leading-none"
              style={{ color: v ? '#3b2a1a' : (n === 'A' ? '#fff' : '#555'), fontFamily: v ? 'Georgia,serif' : undefined }}>{n}</span>
          ))}
          <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-red-600"/>
        </div>
      </div>
    </div>
  );
};
