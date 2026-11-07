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
//  - 빈티지: 닉시관 — 어두운 유리관 안에서 주황빛으로 빛나는 숫자 (황동·원목과 어울리는 옛 계측기 느낌)
const DrumDigits = ({ text, unit = 'Hz', size = 'md' }) => {
  const vintage = useVintage();
  const big = size === 'lg';
  if (vintage) return <NixieDigits text={text} unit={unit} big={big}/>;
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

const NIXIE_GLOW = '0 0 3px #ffb46b, 0 0 8px #ff7a1a, 0 0 16px rgba(255,100,0,.55)';
const NixieDigits = ({ text, unit, big }) => {
  const w = big ? 30 : 21, h = big ? 46 : 34, fs = big ? 32 : 22;
  return (
    <div className="flex items-end gap-[3px] rounded-lg px-2 py-1.5"
      style={{ background: 'linear-gradient(180deg,#1b100a,#0b0604)', border: '1px solid #6b4a12',
               boxShadow: 'inset 0 3px 8px rgba(0,0,0,.85), 0 1px 0 rgba(255,236,190,.35)' }}>
      {text.split('').map((ch, i) => ch === '.' ? (
        <span key={i} className="rounded-full mb-1.5" style={{ width: 5, height: 5, background: '#ffb46b', boxShadow: NIXIE_GLOW }}/>
      ) : (
        <span key={i} className="relative flex items-center justify-center overflow-hidden"
          style={{ width: w, height: h, borderRadius: `${w / 2}px ${w / 2}px 4px 4px`,
                   background: 'radial-gradient(ellipse at 50% 40%, rgba(255,130,40,.16), rgba(14,7,3,.96) 72%)',
                   border: '1px solid rgba(255,210,160,.16)', boxShadow: 'inset 0 0 6px rgba(0,0,0,.9)' }}>
          {/* 꺼진 음극(8) 흔적 */}
          <span className="absolute" style={{ fontFamily: 'Georgia,serif', fontSize: fs, color: 'rgba(255,160,90,.07)', lineHeight: 1 }}>8</span>
          <span className="relative" style={{ fontFamily: 'Georgia,serif', fontSize: fs, lineHeight: 1, color: '#ffc27a', textShadow: NIXIE_GLOW }}>{ch}</span>
          {/* 유리 반사 */}
          <span className="absolute rounded-full" style={{ top: 3, left: 3, width: 3, height: h * 0.35, background: 'rgba(255,255,255,.10)' }}/>
        </span>
      ))}
      <span className="ml-1 pb-0.5 font-black tracking-wider" style={{ fontSize: big ? 11 : 9, color: '#c9a14a', fontFamily: 'Georgia,serif' }}>{unit}</span>
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
