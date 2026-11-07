// ==========================================
// app — 탭 전환, 테마 적용, 마운트
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → app)
// ==========================================

// ==========================================
// 4. App Component
// ==========================================
const App = () => {
  const tuner = useTunerLogic();
  const metro = useMetronomeLogic();
  const drone = useDroneLogic(tuner.a4Freq, tuner.noteTracker);

  // 연습 기록: 지금 상태를 ref로 넘겨주고(practice.jsx가 1초마다 읽음), 튜너가 확정한 음을 전달
  const practiceCtxRef = useRef({});
  const log = usePracticeLog(practiceCtxRef);
  tuner.practiceSinkRef.current = log.note;
  const [activeTab, setActiveTab] = useState('tuner');
  const theme = tuner.settings.uiMode;
  practiceCtxRef.current = {
    tab: activeTab, metroPlaying: metro.isPlayingMetro, bpm: metro.bpm, tolerance: tuner.tolerance,
    droneActive: drone.playing, droneClasses: new Set(droneChordNotes(drone.cfg).map(n => n.replace(/\d+$/, ''))),
    onGoal: (m) => { haptic([60, 60, 60]); showToast(`🎯 오늘 목표 ${m}분 달성!`); },
  };
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  };

  // 연주 명령(commands.jsx) → 메트로놈 켜기/끄기. 켤 때는 메트로놈 탭으로 이동
  useEffect(() => {
    tuner.noteTracker.state.onCommand = () => {
      const starting = !metro.isPlayingMetro;
      metro.toggleMetronome();
      if (starting) setActiveTab('metronome');
      haptic([30, 40, 30]);
      showToast(`🎻 ${tuner.settings.cmdPattern.join(' → ')}  ·  메트로놈 ${starting ? '시작' : '정지'}`);
    };
  });

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
    { id:'drone',       label:'Drone',  color:'#a78bfa', Icon:Waves },
    { id:'log',         label:'기록',    color:'#fb923c', Icon:BarChart3 },
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
        <div className={activeTab==='tuner'       ? 'flex flex-col w-full h-full' : 'hidden'}><Tuner       tuner={tuner} metro={metro}/></div>
        <div className={activeTab==='metronome'   ? 'flex flex-col w-full h-full' : 'hidden'}><Metronome   metro={metro}/></div>
        <div className={activeTab==='fingerboard' ? 'flex flex-col w-full h-full' : 'hidden'}><Fingerboard tuner={tuner} metro={metro} log={log}/></div>
        <div className={activeTab==='drone'       ? 'flex flex-col w-full h-full' : 'hidden'}><Drone       drone={drone} metro={metro}/></div>
        <div className={activeTab==='log'         ? 'flex flex-col w-full h-full' : 'hidden'}><PracticeLog log={log}/></div>
      </div>

      {/* 연주 명령 알림 */}
      {/* 첫 실행 안내 */}
      {!tuner.settings.onboarded && <Onboarding tuner={tuner}/>}

      {toast && (
        <div className="absolute inset-x-0 z-[70] flex justify-center pointer-events-none"
          style={{ top: 'max(4rem, calc(env(safe-area-inset-top, 0px) + 3rem))' }}>
          <div className="px-4 py-2.5 rounded-full t-panel text-sm font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.7)] whitespace-nowrap tab-enter">
            {toast}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav
        className="absolute bottom-0 w-full max-w-md t-nav backdrop-blur-md pt-2 px-2 flex justify-around z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {TAB_NAV.map(({ id, label, color: tabColor, Icon }) => {
          const active = activeTab === id;
          // 빈티지: 모든 탭 황동색 / 라이트: 밝은 바탕에서 잘 보이게 진한 색
          const LIGHT_TAB = { tuner:'#059669', metronome:'#b45309', fingerboard:'#0284c7', drone:'#7c3aed', log:'#ea580c' };
          const color = theme === 'vintage' ? '#f6dd94' : theme === 'light' ? LIGHT_TAB[id] : tabColor;
          return (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-2xl transition-all duration-200 active:scale-90"
              style={{ color: active ? color : '#4b5563' }}
            >
              {/* Active indicator dot */}
              <div
                className="w-1 h-1 rounded-full mb-0.5 transition-all duration-200"
                style={{ background: active ? color : 'transparent', boxShadow: active ? `0 0 6px ${color}` : 'none' }}
              />
              {id === 'log' ? (() => {
                // 기록 탭: 오늘 목표 진행 링 + 오늘 연습 분
                const ms = practiceMs(log.today), pct = Math.min(1, ms / (log.goalMin * 60000)), c = 2 * Math.PI * 11;
                const ring = theme === 'vintage' ? '#f6dd94' : '#4afc9d';
                return (
                  <>
                    <span className="relative w-[22px] h-[22px] flex items-center justify-center">
                      <svg viewBox="0 0 26 26" className="absolute -inset-[2px] w-[26px] h-[26px] -rotate-90">
                        <circle cx="13" cy="13" r="11" fill="none" stroke="#1f2937" strokeWidth="2"/>
                        <circle cx="13" cy="13" r="11" fill="none" stroke={ring} strokeWidth="2" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`}/>
                      </svg>
                      <Icon size={13} strokeWidth={active ? 2.5 : 2}/>
                    </span>
                    <span className="text-[9px] font-black tracking-widest transition-all duration-200" style={{ color: active ? color : (ms >= 60000 ? ring : '#4b5563') }}>
                      {ms >= 60000 ? `${Math.floor(ms / 60000)}분` : label}
                    </span>
                  </>
                );
              })() : (
                <>
                  <Icon size={22} strokeWidth={active ? 2.5 : 2}/>
                  <span
                    className="text-[9px] font-black uppercase tracking-widest transition-all duration-200"
                    style={{ color: active ? color : '#4b5563' }}
                  >
                    {label}
                  </span>
                </>
              )}
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
