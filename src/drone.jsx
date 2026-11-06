// ==========================================
// drone — 드론 탭: 근음(+5도·옥타브·3도)을 계속 울려 두고 그 위에서 음정 연습
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → app)
// 구성안: docs/drone-mode-plan.md  (현재 1단계: 기본 드론)
// ==========================================

// 순정 비율 (근음 대비) — 평균율이 아니라 울림이 맞는 비율
const DRONE_INTERVALS = [
  { id: 'fifth',  label: '5도',   ratio: 3 / 2 },
  { id: 'octave', label: '옥타브', ratio: 2 },
  { id: 'maj3',   label: '장3도', ratio: 5 / 4, excl: 'min3' },
  { id: 'min3',   label: '단3도', ratio: 6 / 5, excl: 'maj3' },
];
const DRONE_TIMBRES = [
  { id: 'cello', label: '첼로' },
  { id: 'organ', label: '오르간' },
  { id: 'soft',  label: '부드럽게' },
];
const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
const DRONE_QUICK = [
  { root: 'G', octave: 3 }, { root: 'D', octave: 4 }, { root: 'A', octave: 4 }, { root: 'E', octave: 5 },
];
const DEFAULT_DRONE = {
  root: 'D', octave: 4,
  intervals: { fifth: true, octave: false, maj3: false, min3: false },
  timbre: 'cello', volume: 0.6, fadeSec: 1.0,
};
const DRONE_CROSSFADE = 0.08;   // 음 바꿀 때 전환 시간(초)

const droneRootFreq = (cfg, a4) => a4 * Math.pow(2, ((cfg.octave * 12 + NOTE_NAMES.indexOf(cfg.root)) - 57) / 12);
const droneRatios = (cfg) => [1, ...DRONE_INTERVALS.filter(i => cfg.intervals[i.id]).map(i => i.ratio)];
// 드론이 내는 음 이름들 (예: ['D4','A4'])
const droneChordNotes = (cfg) => droneRatios(cfg).map(r => {
  const idx = NOTE_NAMES.indexOf(cfg.root) + Math.round(12 * Math.log2(r));
  return NOTE_NAMES[((idx % 12) + 12) % 12] + (cfg.octave + Math.floor(idx / 12));
});

// ── 오디오 로직 ──
const useDroneLogic = (a4Freq, noteTracker) => {
  const [cfg, setCfg] = usePersistentState('drone', DEFAULT_DRONE,
    v => v && NOTE_NAMES.includes(v.root) && v.octave >= 2 && v.octave <= 6 && v.intervals && DRONE_TIMBRES.some(t => t.id === v.timbre));
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const voicesRef = useRef(null);       // { bus, oscs }
  const organWaveRef = useRef(null);
  const stopTimerRef = useRef(null);
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const a4Ref = useRef(a4Freq); a4Ref.current = a4Freq;

  const update = (patch) => setCfg(prev => ({ ...prev, ...patch }));
  const toggleInterval = (id) => setCfg(prev => {
    const def = DRONE_INTERVALS.find(i => i.id === id);
    const intervals = { ...prev.intervals, [id]: !prev.intervals[id] };
    if (intervals[id] && def.excl) intervals[def.excl] = false;   // 장3도/단3도 중 하나만
    return { ...prev, intervals };
  });

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();   // 여러 음이 겹쳐도 찢어지지 않게
      comp.threshold.value = -12; comp.ratio.value = 4;
      comp.connect(ctx.destination);
      const master = ctx.createGain(); master.gain.value = 0; master.connect(comp);
      const harm = [0, 1, 0.55, 0.32, 0.22, 0.14, 0.09, 0.05];
      organWaveRef.current = ctx.createPeriodicWave(new Float32Array(harm.length), new Float32Array(harm));
      ctxRef.current = ctx; masterRef.current = master;
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  };

  // 현재 설정으로 음들을 만들어 0 → 1 로 짧게 페이드인
  const buildVoices = () => {
    const ctx = ctxRef.current, c = cfgRef.current;
    const root = droneRootFreq(c, a4Ref.current);
    const ratios = droneRatios(c);
    const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(masterRef.current);
    const oscs = [];
    const per = 0.35 / Math.sqrt(ratios.length);
    ratios.forEach((r, i) => {
      const f = root * r;
      const g = ctx.createGain(); g.gain.value = per * (i === 0 ? 1 : 0.8); g.connect(bus);
      if (c.timbre === 'cello') {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(3000, f * 6); lp.Q.value = 0.5;
        lp.connect(g);
        [-4, 4].forEach(det => {                       // 살짝 어긋난 두 톱니파 → 현악기 같은 풍성함
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
          const half = ctx.createGain(); half.gain.value = 0.5; o.connect(half); half.connect(lp);
          o.start(); oscs.push(o);
        });
      } else {
        const o = ctx.createOscillator();
        if (c.timbre === 'organ') o.setPeriodicWave(organWaveRef.current); else o.type = 'sine';
        o.frequency.value = f; o.connect(g); o.start(); oscs.push(o);
      }
    });
    const now = ctx.currentTime;
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + DRONE_CROSSFADE);
    return { bus, oscs };
  };

  const releaseVoices = (v, sec) => {
    if (!v) return;
    const ctx = ctxRef.current, now = ctx.currentTime;
    v.bus.gain.cancelScheduledValues(now);
    v.bus.gain.setValueAtTime(v.bus.gain.value, now);
    v.bus.gain.linearRampToValueAtTime(0, now + sec);
    v.oscs.forEach(o => { try { o.stop(now + sec + 0.05); } catch (_) {} });
  };

  const rampMaster = (to, sec) => {
    const ctx = ctxRef.current, g = masterRef.current.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + Math.max(0.02, sec));
  };

  const start = () => {
    ensureCtx();
    clearTimeout(stopTimerRef.current);
    if (!voicesRef.current) voicesRef.current = buildVoices();
    rampMaster(cfgRef.current.volume, cfgRef.current.fadeSec);
    noteTracker.state.droneActive = true;          // 스피커 소리로 연주 명령 오작동 방지
    setPlaying(true); haptic(15);
  };

  const stop = () => {
    if (!ctxRef.current) return;
    const fade = cfgRef.current.fadeSec;
    rampMaster(0, fade);
    clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      releaseVoices(voicesRef.current, 0.02); voicesRef.current = null;
      noteTracker.state.droneActive = false;
    }, fade * 1000 + 600);
    setPlaying(false); haptic(10);
  };

  const toggle = () => (playing ? stop() : start());

  // 재생 중 음/화음/음색/A4 변경 → 짧게 크로스페이드
  const voiceKey = `${cfg.root}${cfg.octave}|${JSON.stringify(cfg.intervals)}|${cfg.timbre}|${a4Freq}`;
  useEffect(() => {
    if (!playing || !ctxRef.current) return;
    const old = voicesRef.current;
    voicesRef.current = buildVoices();
    releaseVoices(old, DRONE_CROSSFADE);
  }, [voiceKey]);

  // 재생 중 볼륨 변경
  useEffect(() => {
    if (playing && masterRef.current) rampMaster(cfg.volume, 0.05);
  }, [cfg.volume]);

  // 앱을 내리면 정지, 언마운트 시 정리
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden' && voicesRef.current) stop(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); ctxRef.current?.close(); };
  }, []);

  return { cfg, update, toggleInterval, playing, toggle, rootFreq: droneRootFreq(cfg, a4Freq) };
};

// ── 화면 ──
const RootWheel = ({ drone, size }) => {
  const { cfg, update, playing, toggle } = drone;
  const vintage = useVintage();
  const r = size / 2 - 24;
  const center = size * 0.44;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* 바깥 링 */}
      <div className="absolute inset-[18px] rounded-full"
        style={{ border: `2px solid ${vintage ? 'rgba(201,161,74,.45)' : 'rgba(255,255,255,.06)'}` }}/>
      {CIRCLE_OF_FIFTHS.map((n, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        const on = cfg.root === n;
        return (
          <button key={n} onClick={() => { update({ root: n }); haptic(8); }}
            className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full flex items-center justify-center text-sm font-black transition-all active:scale-90"
            style={{
              left: size / 2 + r * Math.cos(a), top: size / 2 + r * Math.sin(a),
              ...(on
                ? (vintage
                  ? { background: 'radial-gradient(circle at 35% 30%,#fff8dc,#d4ad55 55%,#6b4a12)', color: '#3b2a1a', border: '1px solid #6b4a12', boxShadow: '0 0 12px rgba(246,221,148,.5)' }
                  : { background: '#a78bfa', color: '#000', boxShadow: '0 0 16px rgba(167,139,250,.6)' })
                : { background: 'var(--chip-bg)', border: '1px solid var(--chip-border)', color: vintage ? '#f4e3b5' : '#d1d5db' }),
            }}>
            {n.replace('#', '♯')}
          </button>
        );
      })}
      {/* 가운데: 재생 버튼 */}
      <button onClick={toggle}
        className="absolute rounded-full flex flex-col items-center justify-center transition-all active:scale-95"
        style={{
          width: center, height: center, left: (size - center) / 2, top: (size - center) / 2,
          ...(vintage
            ? { background: playing ? 'radial-gradient(circle at 40% 30%,#fff3c4,#d4ad55 60%,#8a6420)' : 'linear-gradient(180deg,#3a2410,#24150a)',
                border: '3px solid #6b4a12', color: playing ? '#3b2a1a' : '#f6dd94',
                boxShadow: playing ? '0 0 30px rgba(246,221,148,.45)' : 'inset 0 4px 12px rgba(0,0,0,.6)' }
            : { background: playing ? 'rgba(167,139,250,.15)' : '#0b0b0b',
                border: `3px solid ${playing ? '#a78bfa' : '#1f2937'}`, color: playing ? '#c4b5fd' : '#9ca3af',
                boxShadow: playing ? '0 0 40px rgba(167,139,250,.35)' : 'none' }),
        }}>
        {playing && <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ border: `2px solid ${vintage ? '#f6dd94' : '#a78bfa'}` }}/>}
        <span className="font-black leading-none" style={{ fontSize: center * 0.36, fontFamily: vintage ? 'Georgia,serif' : undefined }}>
          {cfg.root.replace('#', '♯')}<span style={{ fontSize: center * 0.16 }} className="opacity-60">{cfg.octave}</span>
        </span>
        <span className="flex items-center gap-1 mt-1 text-[10px] font-black tracking-widest">
          {playing ? <Square size={10} fill="currentColor"/> : <Play size={10} fill="currentColor"/>}
          {playing ? 'STOP' : 'PLAY'}
        </span>
      </button>
    </div>
  );
};

const Segmented = ({ items, value, onChange }) => {
  const vintage = useVintage();
  return (
    <div className="flex t-inset rounded-full p-1 gap-1">
      {items.map(it => {
        const on = value === it.id;
        return (
          <button key={it.id} onClick={() => { onChange(it.id); haptic(8); }}
            className="flex-1 py-1.5 rounded-full text-xs font-black transition-all"
            style={on
              ? (vintage ? { background: 'linear-gradient(#f3dc93,#b88a35)', color: '#3b2a1a' } : { background: '#a78bfa', color: '#000' })
              : { color: vintage ? 'rgba(244,227,181,.6)' : '#6b7280' }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
};

const Drone = ({ drone, metro }) => {
  const { cfg, update, toggleInterval, playing, rootFreq } = drone;
  const vintage = useVintage();
  const [wheelRef, wheelSize] = useFitSquare(0, 300);
  const accent = vintage ? '#f6dd94' : '#a78bfa';
  const chord = droneChordNotes(cfg).map(n => n.replace('#', '♯'));

  return (
    <div className="w-full h-full flex flex-col items-center tab-enter gap-2.5">
      {/* 상단: 현재 화음 */}
      <div className="w-full flex items-center justify-between shrink-0 h-10">
        <div className="flex items-center gap-1.5 flex-wrap">
          {chord.map((n, i) => (
            <span key={i} className="px-2 py-1 rounded-lg text-xs font-black font-mono t-chip"
              style={{ color: i === 0 ? accent : (vintage ? '#f4e3b5' : '#d1d5db') }}>{n}</span>
          ))}
        </div>
        <span className="text-[11px] font-mono font-bold" style={{ color: vintage ? 'rgba(244,227,181,.6)' : '#6b7280' }}>
          {rootFreq.toFixed(1)} Hz
        </span>
      </div>

      {/* 근음 휠 (남는 공간 채움) */}
      <div ref={wheelRef} className="w-full flex-1 min-h-0 flex items-center justify-center">
        <RootWheel drone={drone} size={wheelSize}/>
      </div>

      {/* 빠른 선택 + 옥타브 */}
      <div className="w-full flex items-center gap-2 shrink-0">
        {DRONE_QUICK.map(q => {
          const on = cfg.root === q.root && cfg.octave === q.octave;
          return (
            <button key={q.root} onClick={() => { update(q); haptic(8); }}
              className="flex-1 py-2 rounded-xl text-sm font-black t-chip active:scale-95 transition-transform"
              style={on ? { color: accent, borderColor: accent } : { color: vintage ? '#f4e3b5' : '#d1d5db' }}>
              {q.root}<span className="text-[9px] opacity-60">{q.octave}</span>
            </button>
          );
        })}
        <div className="flex items-center t-chip rounded-xl">
          <button onClick={() => update({ octave: Math.max(2, cfg.octave - 1) })} className="px-2 py-2 text-gray-500"><Minus size={14}/></button>
          <span className="text-[10px] font-black text-gray-400 w-8 text-center leading-tight">옥타브<br/><span className="text-sm text-white">{cfg.octave}</span></span>
          <button onClick={() => update({ octave: Math.min(6, cfg.octave + 1) })} className="px-2 py-2 text-gray-500"><Plus size={14}/></button>
        </div>
      </div>

      {/* 화음 구성 */}
      <div className="w-full grid grid-cols-4 gap-2 shrink-0">
        {DRONE_INTERVALS.map(it => {
          const on = !!cfg.intervals[it.id];
          return (
            <button key={it.id} onClick={() => { toggleInterval(it.id); haptic(8); }}
              className="py-2 rounded-xl text-xs font-black transition-all active:scale-95 border"
              style={on
                ? (vintage ? { background: 'linear-gradient(#f3dc93,#b88a35)', color: '#3b2a1a', borderColor: '#6b4a12' }
                           : { background: 'rgba(167,139,250,.15)', color: '#c4b5fd', borderColor: 'rgba(167,139,250,.5)' })
                : { background: 'var(--chip-bg)', borderColor: 'var(--chip-border)', color: vintage ? 'rgba(244,227,181,.55)' : '#6b7280' }}>
              + {it.label}
            </button>
          );
        })}
      </div>

      {/* 음색 · 볼륨 · 페이드 */}
      <div className="w-full t-panel rounded-3xl px-4 py-3 shrink-0 flex flex-col gap-2.5">
        <Segmented items={DRONE_TIMBRES} value={cfg.timbre} onChange={v => update({ timbre: v })}/>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-gray-500 w-10">볼륨</span>
          <input type="range" min="0" max="1" step="0.05" value={cfg.volume} onChange={e => update({ volume: Number(e.target.value) })} className="flex-1"/>
          <span className="text-[11px] font-mono font-black text-gray-300 w-9 text-right">{Math.round(cfg.volume * 100)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-gray-500 w-10">페이드</span>
          <input type="range" min="0" max="3" step="0.1" value={cfg.fadeSec} onChange={e => update({ fadeSec: Number(e.target.value) })} className="flex-1"/>
          <span className="text-[11px] font-mono font-black text-gray-300 w-9 text-right">{cfg.fadeSec.toFixed(1)}s</span>
        </div>
      </div>

      {/* 메트로놈 같이 */}
      <button onClick={metro.toggleMetronome}
        className="w-full h-11 shrink-0 rounded-2xl t-chip flex items-center justify-center gap-2 text-xs font-black active:scale-[0.98] transition-transform"
        style={{ color: metro.isPlayingMetro ? (vintage ? '#f6dd94' : '#ffcc00') : (vintage ? 'rgba(244,227,181,.7)' : '#9ca3af') }}>
        <Music size={14}/>
        메트로놈 같이 {metro.isPlayingMetro ? '끄기' : '켜기'} · {metro.bpm} BPM
        {metro.isPlayingMetro && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: vintage ? '#f6dd94' : '#ffcc00' }}/>}
      </button>
    </div>
  );
};
