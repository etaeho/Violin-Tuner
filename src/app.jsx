// ==========================================
// app — 탭 전환, 테마 적용, 마운트
// (index.html에서 순서대로 로드됨: core → theme → tuner → metronome → fingerboard → app)
// ==========================================

// ==========================================
// 4. App Component
// ==========================================
const App = () => {
  const tuner = useTunerLogic();
  const metro = useMetronomeLogic();
  const [activeTab, setActiveTab] = useState('tuner');
  const theme = tuner.settings.uiMode;

  // 테마(화면 모드)를 <html data-theme>에 반영 → 모든 탭의 t-* 색이 함께 바뀜
  useEffect(() => { applyTheme(theme); }, [theme]);

  // Wake Lock: 화면 꺼짐 방지
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
      catch(_) {}
    };
    requestWakeLock();
    const onVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLock?.release().catch(()=>{});
    };
  }, []);

  const switchTab = (tab) => {
    if (tab !== activeTab) { setActiveTab(tab); haptic(12); }
  };

  const TAB_NAV = [
    { id:'tuner',       label:'Tuner',  color:'#4afc9d', Icon:Activity },
    { id:'metronome',   label:'Metro',  color:'#ffcc00', Icon:Music    },
    { id:'fingerboard', label:'Finger', color:'#0ea5e9', Icon:LayoutGrid },
  ];

  return (
    <ThemeContext.Provider value={theme}>
    <div
      className="fixed inset-0 t-app text-white flex flex-col items-center font-sans select-none overflow-hidden"
      style={{
        /* Respect device safe areas so content never hides behind notch/home-indicator */
        paddingLeft:  'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Content area */}
      <div
        className="flex-1 w-full max-w-md flex flex-col px-4 overflow-hidden"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className={activeTab==='tuner'       ? 'flex flex-col w-full h-full' : 'hidden'}><Tuner       tuner={tuner}/></div>
        <div className={activeTab==='metronome'   ? 'flex flex-col w-full h-full' : 'hidden'}><Metronome   metro={metro}/></div>
        <div className={activeTab==='fingerboard' ? 'flex flex-col w-full h-full' : 'hidden'}><Fingerboard tuner={tuner} metro={metro}/></div>
      </div>

      {/* Bottom Navigation */}
      <nav
        className="absolute bottom-0 w-full max-w-md t-nav backdrop-blur-md pt-2 px-2 flex justify-around z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {TAB_NAV.map(({ id, label, color, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-2xl transition-all duration-200 active:scale-90"
              style={{ color: active ? color : '#4b5563' }}
            >
              {/* Active indicator dot */}
              <div
                className="w-1 h-1 rounded-full mb-0.5 transition-all duration-200"
                style={{ background: active ? color : 'transparent', boxShadow: active ? `0 0 6px ${color}` : 'none' }}
              />
              <Icon size={22} strokeWidth={active ? 2.5 : 2}/>
              <span
                className="text-[9px] font-black uppercase tracking-widest transition-all duration-200"
                style={{ color: active ? color : '#4b5563' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
    </ThemeContext.Provider>
  );
};

// ── Mount ──
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);

// Dismiss splash screen after first render
setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 450);
  }
}, 900);
