// ==========================================
// metronome — 메트로놈 탭
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → app)
// ==========================================

// ==========================================
// Metronome Hook
// ==========================================
const useMetronomeLogic = () => {
  const [bpm, setBpm] = useState(60);
  const [isPlayingMetro, setIsPlayingMetro] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [timeSig, setTimeSig] = useState({ num:4, den:4 });
  const [beatSounds, setBeatSounds] = useState([2,1,1,1]);
  const [beatSubdivisions, setBeatSubdivisions] = useState([1,1,1,1]);
  const [visualFlash, setVisualFlash] = useState(false);
  const isPlayingRef     = useRef(false);
  const bpmRef           = useRef(bpm);
  const metroAudioCtxRef = useRef(null);
  const nextNoteTimeRef  = useRef(0.0);
  const currentBeatRef   = useRef(0);
  const currentSubBeatRef = useRef(0);
  const timerIDRef       = useRef(null);
  const timeSigRef       = useRef(timeSig);
  const beatSoundsRef    = useRef(beatSounds);
  const beatSubdivisionsRef = useRef(beatSubdivisions);
  const pressTimeoutRef  = useRef(null);
  const pressIntervalRef = useRef(null);
  const lookahead = 25.0;
  const scheduleAheadTime = 0.1;

  useEffect(() => () => { stopMetronome(); handlePressEnd(); }, []);
  useEffect(() => {
    timeSigRef.current=timeSig; beatSoundsRef.current=beatSounds; beatSubdivisionsRef.current=beatSubdivisions;
    if (currentBeat>=timeSig.num) { setCurrentBeat(0); currentBeatRef.current=0; }
  }, [timeSig, beatSounds, beatSubdivisions, currentBeat]);
  useEffect(() => { bpmRef.current=bpm; }, [bpm]);

  const initMetroAudioContext = () => {
    if (!metroAudioCtxRef.current) metroAudioCtxRef.current = new (window.AudioContext||window.webkitAudioContext)();
    if (metroAudioCtxRef.current.state==='suspended') metroAudioCtxRef.current.resume();
  };

  const restartMetroIfNeeded = () => {
    if (isPlayingRef.current) { stopMetronome(); setTimeout(startMetronome, 50); }
  };

  const changeNumerator = (delta) => {
    setTimeSig(prev => {
      const nextNum=Math.max(1,Math.min(16,prev.num+delta));
      setBeatSounds(getDefaultBeatSounds(nextNum));
      setBeatSubdivisions(prevSub => {
        const nextSub=[...prevSub];
        if (nextNum>nextSub.length) for (let i=nextSub.length;i<nextNum;i++) nextSub.push(1);
        else nextSub.length=nextNum;
        return nextSub;
      });
      return { ...prev, num:nextNum };
    });
    restartMetroIfNeeded(); haptic(8);
  };

  const changeDenominator = (delta) => {
    setTimeSig(prev => {
      const opts=[2,4,8,16];
      let idx=(opts.indexOf(prev.den)+delta)%opts.length;
      if (idx<0) idx+=opts.length;
      return { ...prev, den:opts[idx] };
    });
    restartMetroIfNeeded(); haptic(8);
  };

  const toggleBeatSubdivision = (index) => {
    setBeatSubdivisions(prev => {
      const next=[...prev];
      next[index]=next[index]===4?1:next[index]+1;
      return next;
    });
    restartMetroIfNeeded(); haptic(8);
  };

  const toggleBeatSound = (index) => {
    setBeatSounds(prev => {
      const next=[...prev];
      const cur=next[index];
      if (cur===2) next[index]=3;
      else if (cur===3) next[index]=1;
      else if (cur===1) next[index]=0;
      else next[index]=2;
      return next;
    });
    haptic(8);
  };

  const nextNote = () => {
    const currentBeatSubdiv=beatSubdivisionsRef.current[currentBeatRef.current]||1;
    const secondsPerBeat=(60.0/bpmRef.current)*(4/timeSigRef.current.den);
    nextNoteTimeRef.current+=secondsPerBeat/currentBeatSubdiv;
    currentSubBeatRef.current++;
    if (currentSubBeatRef.current>=currentBeatSubdiv) {
      currentSubBeatRef.current=0;
      currentBeatRef.current=(currentBeatRef.current+1)%timeSigRef.current.num;
    }
  };

  const scheduleNote = (beatNumber, subBeatNumber, time) => {
    const delay=(time-metroAudioCtxRef.current.currentTime)*1000;
    if (subBeatNumber===0) {
      setTimeout(()=>{
        if (!isPlayingRef.current) return;
        setCurrentBeat(beatNumber); setVisualFlash('main');
        setTimeout(()=>{ if (isPlayingRef.current) setVisualFlash(false); },150);
      }, Math.max(0,delay));
    } else {
      setTimeout(()=>{
        if (!isPlayingRef.current) return;
        setVisualFlash('sub');
        setTimeout(()=>{ if (isPlayingRef.current) setVisualFlash(false); },100);
      }, Math.max(0,delay));
    }
    const soundType=subBeatNumber===0?beatSoundsRef.current[beatNumber]:-1;
    if (soundType>0||soundType===-1) {
      const osc=metroAudioCtxRef.current.createOscillator();
      const gain=metroAudioCtxRef.current.createGain();
      osc.type='square';
      let freq=1000, vol=1.0;
      if (soundType===2)  { freq=2000; vol=1.0; }
      else if (soundType===3) { freq=1500; vol=0.85; }
      else if (soundType===1) { freq=1000; vol=0.7; }
      else if (soundType===-1){ freq=1200; vol=0.5; }
      osc.frequency.value=freq;
      gain.gain.setValueAtTime(vol,time);
      const dur=soundType===-1?0.02:0.04;
      gain.gain.exponentialRampToValueAtTime(0.001,time+dur);
      osc.connect(gain); gain.connect(metroAudioCtxRef.current.destination);
      osc.start(time); osc.stop(time+dur+0.01);
    }
  };

  const scheduler = () => {
    if (!isPlayingRef.current) return;
    while (nextNoteTimeRef.current < metroAudioCtxRef.current.currentTime+scheduleAheadTime) {
      scheduleNote(currentBeatRef.current,currentSubBeatRef.current,nextNoteTimeRef.current);
      nextNote();
    }
    timerIDRef.current=window.setTimeout(scheduler,lookahead);
  };

  const startMetronome = () => {
    if (isPlayingRef.current) return;
    window.clearTimeout(timerIDRef.current);
    initMetroAudioContext();
    haptic(20);
    isPlayingRef.current=true; setIsPlayingMetro(true);
    currentBeatRef.current=0; currentSubBeatRef.current=0; setCurrentBeat(0);
    nextNoteTimeRef.current=metroAudioCtxRef.current.currentTime+0.05;
    scheduler();
  };

  const stopMetronome = () => {
    isPlayingRef.current=false; setIsPlayingMetro(false);
    window.clearTimeout(timerIDRef.current); setCurrentBeat(-1);
    haptic(10);
  };

  const toggleMetronome = () => { isPlayingRef.current?stopMetronome():startMetronome(); };
  const handleBpmChange = (e) => setBpm(Number(e.target.value));
  const changeBpmBy = (amount) => setBpm(prev=>Math.min(Math.max(30,prev+amount),250));
  const handlePressStart = (delta) => {
    changeBpmBy(delta); haptic(8);
    pressTimeoutRef.current=setTimeout(()=>{
      pressIntervalRef.current=setInterval(()=>{
        setBpm(prev=>Math.min(Math.max(30,prev+delta),250));
      },70);
    },300);
  };
  const handlePressEnd = () => { clearTimeout(pressTimeoutRef.current); clearInterval(pressIntervalRef.current); };

  // 탭 템포: 최근 탭 간격 평균으로 BPM 설정 (2초 이상 쉬면 새로 시작)
  const tapTimesRef = useRef([]);
  const tapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 6) taps.shift();
    haptic(10);
    if (taps.length >= 2) {
      const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      setBpm(Math.min(250, Math.max(30, Math.round(60000 / avg))));
    }
  };

  return {
    bpm, setBpm, isPlayingMetro, currentBeat, timeSig, beatSounds, beatSubdivisions, visualFlash,
    toggleMetronome, changeNumerator, changeDenominator, toggleBeatSubdivision, toggleBeatSound,
    handleBpmChange, handlePressStart, handlePressEnd, tapTempo
  };
};

// ==========================================
// 2. Metronome Component
// ==========================================
const TEMPO_PRESETS = [60, 72, 80, 92, 108, 120];

// 박 소리 종류별 색 (테마별 팔레트)  2=강박 3=중강박 1=약박 0=무음, sub=세분박
const METRO_PALETTE = {
  tape:    { 2:'#ffcc00', 3:'#f97316', 1:'#4afc9d', 0:'#374151', sub:'#0ea5e9', glow:1 },
  vintage: { 2:'#f6dd94', 3:'#e0a94f', 1:'#b9853f', 0:'rgba(201,161,74,.22)', sub:'#efe3c2', glow:0.45 },
};

// 원형 다이얼의 박 구간 하나 (SVG arc)
const arcPath = (cx, cy, r, a0, a1) => {
  const p = (a) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

// 부모 크기에 맞춰 정사각형 크기 계산
const useFitSquare = (pad = 0, max = 320) => {
  const ref = useRef(null);
  const [size, setSize] = useState(200);
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => setSize(Math.max(120, Math.min(el.clientWidth - pad, el.clientHeight, max))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
};

const BeatDial = ({ metro, size, pal, vintage }) => {
  const { bpm, currentBeat, beatSounds, visualFlash, isPlayingMetro } = metro;
  const n = beatSounds.length;
  const gap = n > 8 ? 4 : 7;
  const firing = visualFlash === 'main';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        {vintage && <circle cx="100" cy="100" r="96" fill="none" stroke="#6b4a12" strokeWidth="3"/>}
        {beatSounds.map((snd, i) => {
          const a0 = (360 / n) * i + gap / 2, a1 = (360 / n) * (i + 1) - gap / 2;
          const isCur = isPlayingMetro && i === currentBeat;
          const col = pal[snd];
          return (
            <path key={i} d={arcPath(100, 100, 86, a0, a1)} fill="none" strokeLinecap="round"
              stroke={col} strokeWidth={isCur && firing ? 13 : 9}
              opacity={snd === 0 ? 1 : isCur ? 1 : 0.28}
              style={{ transition: 'stroke-width 80ms, opacity 80ms', filter: isCur && firing && snd ? `drop-shadow(0 0 ${8 * pal.glow}px ${col})` : 'none' }}/>
          );
        })}
        {/* 세분박 깜빡임 */}
        <circle cx="100" cy="100" r="72" fill="none" stroke={pal.sub} strokeWidth="1.5"
          opacity={visualFlash === 'sub' ? 0.9 : 0.08} style={{ transition: 'opacity 60ms' }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {vintage ? (
          <BrassPlate className="flex flex-col items-center !px-4 !py-2.5">
            <DrumDigits text={String(bpm).padStart(3, '0')} unit="BPM"/>
            <span className="text-[9px] font-black text-[#3b2a1a] tracking-widest uppercase mt-1" style={{ fontFamily:'Georgia,serif' }}>{getTempoMarking(bpm)}</span>
          </BrassPlate>
        ) : (
          <>
            <span className="font-black leading-none tracking-tighter text-white" style={{ fontSize: size * 0.3 }}>{bpm}</span>
            <span className="text-[10px] font-black text-gray-500 tracking-[0.3em] mt-1">BPM</span>
            <span className="text-[10px] font-bold text-[#ffcc00]/80 tracking-widest uppercase mt-1">{getTempoMarking(bpm)}</span>
          </>
        )}
      </div>
    </div>
  );
};

const Stepper = ({ value, onUp, onDown, accent }) => {
  const vintage = useVintage();
  return (
    <div className="flex items-center t-chip rounded-full px-1">
      <button onClick={onDown} className="p-1.5 text-gray-500 active:text-white"><ChevronDown size={16}/></button>
      <span className="w-6 text-center text-lg font-black" style={{ color: accent ? (vintage ? '#f6dd94' : '#4afc9d') : '#fff' }}>{value}</span>
      <button onClick={onUp} className="p-1.5 text-gray-500 active:text-white"><ChevronUp size={16}/></button>
    </div>
  );
};

const Metronome = ({ metro }) => {
  const {
    bpm, setBpm, isPlayingMetro, currentBeat, timeSig, beatSounds, beatSubdivisions, visualFlash,
    toggleMetronome, changeNumerator, changeDenominator, toggleBeatSubdivision, toggleBeatSound,
    handleBpmChange, handlePressStart, handlePressEnd, tapTempo
  } = metro;
  const vintage = useVintage();
  const pal = vintage ? METRO_PALETTE.vintage : METRO_PALETTE.tape;
  const [dialRef, dialSize] = useFitSquare(120, 300);
  const isDense = beatSounds.length > 8;

  const pressProps = (d) => ({
    onPointerDown: () => handlePressStart(d), onPointerUp: handlePressEnd, onPointerLeave: handlePressEnd,
    style: { touchAction: 'none' },
  });

  return (
    <div className="w-full h-full flex flex-col items-center tab-enter gap-2.5">
      {/* 1. 박자표 */}
      <div className="w-full flex items-center justify-between shrink-0 h-10">
        <div className="flex items-center gap-2">
          <Stepper value={timeSig.num} onUp={() => changeNumerator(1)} onDown={() => changeNumerator(-1)}/>
          <span className="text-xl font-black text-gray-600 italic">/</span>
          <Stepper value={timeSig.den} onUp={() => changeDenominator(1)} onDown={() => changeDenominator(-1)} accent/>
        </div>
        <span className="text-[11px] font-black tracking-widest uppercase"
          style={{ color: vintage ? '#f6dd94' : '#ffcc00', fontFamily: vintage ? 'Georgia,serif' : undefined }}>
          {getTempoMarking(bpm)}
        </span>
      </div>

      {/* 2. 박 설정 */}
      <div className="w-full t-panel rounded-3xl px-3 py-3 shrink-0">
        <div className={`grid justify-center justify-items-center w-full ${isDense ? 'gap-x-1.5 gap-y-2' : 'gap-x-3'}`}
          style={{ gridTemplateColumns: `repeat(${Math.min(beatSounds.length, 8)},minmax(0,auto))` }}>
          {beatSounds.map((snd, i) => {
            const fired = i === currentBeat && visualFlash === 'main' && isPlayingMetro;
            const col = pal[snd];
            return (
              <div key={i} className={`flex flex-col items-center ${isDense ? 'gap-1' : 'gap-1.5'}`}>
                <button onClick={() => toggleBeatSound(i)}
                  className={`${isDense ? 'w-7 h-7' : 'w-9 h-9'} rounded-full transition-all duration-100 ${fired ? 'scale-110' : ''}`}
                  style={snd === 0
                    ? { border: `2px solid ${vintage ? 'rgba(201,161,74,.4)' : '#374151'}`, background: 'transparent' }
                    : { background: vintage ? `radial-gradient(circle at 35% 30%, #fff8dc, ${col} 55%, #6b4a12)` : col,
                        boxShadow: `0 0 ${(fired ? 18 : 8) * pal.glow}px ${col}`, border: vintage ? '1px solid #6b4a12' : 'none' }}/>
                <button onClick={() => toggleBeatSubdivision(i)} className="transition-colors"
                  style={{ color: vintage ? '#c9a14a' : '#6b7280' }}>
                  {renderSubdivisionIcon(beatSubdivisions[i], isDense ? 'h-5 w-auto' : 'h-6 w-auto')}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-center mt-2" style={{ color: vintage ? 'rgba(244,227,181,.45)' : '#4b5563' }}>
          원: 강세 바꾸기 · 음표: 박 나누기
        </p>
      </div>

      {/* 3. 비트 다이얼 (남는 공간 채움) */}
      <div ref={dialRef} className="w-full flex-1 min-h-0 flex items-center justify-between">
        <button {...pressProps(-1)}
          className="w-12 h-12 rounded-full t-chip flex items-center justify-center active:scale-90 transition-transform shrink-0">
          <Minus size={20} className="text-gray-400 pointer-events-none"/>
        </button>
        <BeatDial metro={metro} size={dialSize} pal={pal} vintage={vintage}/>
        <button {...pressProps(1)}
          className="w-12 h-12 rounded-full t-chip flex items-center justify-center active:scale-90 transition-transform shrink-0">
          <Plus size={20} className="text-gray-400 pointer-events-none"/>
        </button>
      </div>

      {/* 4. 슬라이더 + 프리셋 */}
      <div className="w-full t-inset rounded-[1.5rem] px-4 pt-3 pb-2.5 shrink-0 flex flex-col gap-2.5">
        <input type="range" min="30" max="250" value={bpm} onChange={handleBpmChange} className="w-full cursor-pointer"/>
        <div className="flex justify-between gap-1.5">
          {TEMPO_PRESETS.map(v => {
            const on = bpm === v;
            return (
              <button key={v} onClick={() => { setBpm(v); haptic(8); }}
                className="flex-1 py-1 rounded-full text-[11px] font-black font-mono transition-all active:scale-95"
                style={on
                  ? { background: vintage ? 'linear-gradient(#f3dc93,#b88a35)' : '#4afc9d', color: vintage ? '#3b2a1a' : '#000' }
                  : { background: 'transparent', color: vintage ? 'rgba(244,227,181,.6)' : '#6b7280', border: `1px solid ${vintage ? 'rgba(201,161,74,.3)' : '#1f2937'}` }}>
                {v}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. 탭 템포 + 시작 */}
      <div className="w-full flex gap-2.5 shrink-0">
        <button onClick={tapTempo}
          className="w-24 h-14 rounded-2xl t-chip flex flex-col items-center justify-center active:scale-95 transition-transform">
          <span className="text-sm font-black" style={{ color: vintage ? '#f6dd94' : '#fff' }}>TAP</span>
          <span className="text-[8px] font-bold text-gray-500">박자 두드리기</span>
        </button>
        <button onClick={toggleMetronome}
          className="flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] text-base font-black"
          style={vintage
            ? { background: isPlayingMetro ? 'linear-gradient(#5a3a16,#3a230c)' : 'linear-gradient(180deg,#f3dc93,#d4ad55 40%,#b88a35)',
                color: isPlayingMetro ? '#f6dd94' : '#3b2a1a', border: '2px solid #6b4a12', boxShadow: '0 6px 18px rgba(0,0,0,.5)' }
            : { background: isPlayingMetro ? 'rgba(255,204,0,.1)' : 'rgba(74,252,157,.1)',
                color: isPlayingMetro ? '#ffcc00' : '#4afc9d', border: `2px solid ${isPlayingMetro ? 'rgba(255,204,0,.3)' : 'rgba(74,252,157,.3)'}` }}>
          {isPlayingMetro ? <Square size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}
          {isPlayingMetro ? '정지' : '시작'}
        </button>
      </div>
    </div>
  );
};
