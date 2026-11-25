// ==========================================
// app — 탭 전환, 테마 적용, 마운트
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
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
  const land = useLandscape();   // 가로 화면: 탭 줄을 왼쪽 세로로, 내용은 화면 폭 전체
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

  // 연습 녹음 (recorder.jsx) — 모든 탭 위 녹음 줄
  const recorder = useRecorder(tuner, metro, showToast);
  // 설정창: 튜너·메트로놈 탭 어디서든 같은 설정 (화면 배치는 연 탭이 먼저 보임)
  const [settingsTab, setSettingsTab] = useState(null);   // null | 't1' | 't2'

  // 연주 명령(commands.jsx) → 메트로놈 켜기/끄기. 켤 때는 메트로놈 탭으로 이동
  useEffect(() => {
    tuner.noteTracker.state.onCommand = () => {
      const starting = !metro.isPlayingMetro;
      metro.toggleMetronome();
      // if (starting) setActiveTab('metronome');   // 메트로놈 탭 숨김 → 지금 탭 그대로 (다시 켜면 이 줄도 살리기)
      haptic([30, 40, 30]);
      showToast(`🎻 ${tuner.settings.cmdPattern.join(' → ')}  ·  메트로놈 ${starting ? '시작' : '정지'}`);
    };
  });

  // 화면 회전 설정 → 안드로이드 앱에 알림 (웹에서는 무시)
  useEffect(() => { try { window.VTNative?.setOrientation?.(tuner.settings.rotate || 'portrait'); } catch (_) {} }, [tuner.settings.rotate]);

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
    // { id:'metronome',   label:'Metro',  color:'#ffcc00', Icon:Music    },   // 메트로놈(2번) 탭 숨김 — 다시 켤 땐 이 줄과 아래 <Metronome> 줄 주석 풀기 (metronome.jsx 그대로)
    { id:'fingerboard', label:'Finger', color:'#0ea5e9', Icon:LayoutGrid },
    { id:'record',      label:'녹음',    color:'#ef4444', Icon:Mic },
    { id:'log',         label:'기록',    color:'#fb923c', Icon:BarChart3 },
  ];

  return (
    <ThemeContext.Provider value={theme}>
    <SkinContext.Provider value={designById(tuner.settings.design).skin || 'radio'}>
    <PartsContext.Provider value={tuner.settings.parts}>
    <RecorderContext.Provider value={recorder}>
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
        className={`flex-1 w-full ${land ? '' : 'max-w-md'} flex flex-col px-4 overflow-hidden`}
        style={land ? {
          paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'calc(4.75rem + env(safe-area-inset-left, 0px))',
        } : {
          paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className={activeTab==='tuner'       ? 'flex flex-col w-full flex-1 min-h-0' : 'hidden'}><Tuner       tuner={tuner} metro={metro} openSettings={setSettingsTab} active={activeTab==='tuner'}/></div>
        {/* 메트로놈(2번) 탭 숨김 — 그리지도 않음(배터리). 다시 켤 땐 주석 풀기
        <div className={activeTab==='metronome'   ? 'flex flex-col w-full flex-1 min-h-0' : 'hidden'}><Metronome   metro={metro} tuner={tuner} openSettings={setSettingsTab}/></div> */}
        <div className={activeTab==='fingerboard' ? 'flex flex-col w-full flex-1 min-h-0' : 'hidden'}><Fingerboard tuner={tuner} metro={metro} log={log}/></div>
        {/* 드론 탭은 일단 숨김 (drone.jsx 그대로) → 4번째 탭 = 녹음 */}
        <div className={activeTab==='record'      ? 'flex flex-col w-full flex-1 min-h-0' : 'hidden'}><RecordTab   recorder={recorder} tuner={tuner} metro={metro}/></div>
        <div className={activeTab==='log'         ? 'flex flex-col w-full flex-1 min-h-0' : 'hidden'}><PracticeLog log={log} recorder={recorder}/></div>
      </div>

      {/* 연주 명령 알림 */}
      {/* 첫 실행 안내 */}
      {!tuner.settings.onboarded && <Onboarding tuner={tuner}/>}

      {settingsTab && <div className="absolute inset-0 z-[60]"><SettingsSheet tuner={tuner} metro={metro} layoutTab={settingsTab} onClose={() => setSettingsTab(null)}/></div>}

      <RecDelayOverlay recorder={recorder}/>

      {/* 앱 시작 때 자동 소음 측정 */}
      {tuner.autoCal && !toast && (
        <div className="absolute inset-x-0 z-[70] flex justify-center pointer-events-none"
          style={{ top: 'max(4rem, calc(env(safe-area-inset-top, 0px) + 3rem))' }}>
          <div className="px-4 py-2 rounded-full t-panel text-xs font-bold shadow-[0_10px_30px_rgba(0,0,0,0.7)] whitespace-nowrap tab-enter flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            {tuner.autoCal.done
              ? <>✓ 주변 소음 {tuner.autoCal.noise}dB → 감도 {tuner.autoCal.gate}dB 자동 조정</>
              : <><span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse"/>주변 소음 맞추는 중… {tuner.autoCal.left}</>}
          </div>
        </div>
      )}

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
        className={land
          ? 'absolute left-0 top-0 bottom-0 w-16 t-nav backdrop-blur-md py-2 flex flex-col justify-start items-center gap-0 z-50 shadow-[10px_0_40px_rgba(0,0,0,0.6)]'
          : 'absolute bottom-0 w-full max-w-md t-nav backdrop-blur-md pt-2 px-2 flex justify-around z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]'}
        style={land ? { paddingLeft: 'env(safe-area-inset-left, 0px)', boxSizing: 'content-box' } : { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {TAB_NAV.map(({ id, label, color: tabColor, Icon }) => {
          const active = activeTab === id;
          // 빈티지: 모든 탭 황동색 / 라이트: 밝은 바탕에서 잘 보이게 진한 색
          const LIGHT_TAB = { tuner:'#059669', metronome:'#b45309', fingerboard:'#0284c7', record:'#dc2626', log:'#ea580c' };
          const color = theme === 'vintage' ? '#f6dd94' : theme === 'light' ? LIGHT_TAB[id] : tabColor;
          return (
            <button
              key={id}
              onClick={() => switchTab(id)}
              aria-label={label}
              className={`flex flex-col items-center gap-0.5 ${land ? 'py-1 px-2' : 'py-2 px-3'} rounded-2xl transition-all duration-200 active:scale-90`}
              style={{ color: active ? color : '#4b5563' }}
            >
              {/* Active indicator dot (녹음 탭은 녹음 중이면 빨간 점이 깜빡임 — 다른 탭에서도 보이게) */}
              {id === 'record' && recorder.rec
                ? <div className="w-1.5 h-1.5 rounded-full mb-0.5 bg-[#ef4444] animate-pulse" style={{ boxShadow: '0 0 6px #ef4444' }}/>
                : <div
                    className="w-1 h-1 rounded-full mb-0.5 transition-all duration-200"
                    style={{ background: active ? color : 'transparent', boxShadow: active ? `0 0 6px ${color}` : 'none' }}
                  />}
              {id === 'log' ? (() => {
                // 기록 탭: 오늘 목표 진행 링 (글자 없음 — 아이콘만)
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
                  </>
                );
              })() : (
                <>
                  <Icon size={22} strokeWidth={active ? 2.5 : 2}/>
                </>
              )}
            </button>
          );
        })}
      </nav>
    </div>
    </RecorderContext.Provider>
    </PartsContext.Provider>
    </SkinContext.Provider>
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
