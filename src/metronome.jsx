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

  return {
    bpm, setBpm, isPlayingMetro, currentBeat, timeSig, beatSounds, beatSubdivisions, visualFlash,
    toggleMetronome, changeNumerator, changeDenominator, toggleBeatSubdivision, toggleBeatSound,
    handleBpmChange, handlePressStart, handlePressEnd
  };
};

// ==========================================
// 2. Metronome Component
// ==========================================
const Metronome = ({ metro }) => {
  const {
    bpm, isPlayingMetro, currentBeat, timeSig, beatSounds, beatSubdivisions, visualFlash,
    toggleMetronome, changeNumerator, changeDenominator, toggleBeatSubdivision, toggleBeatSound,
    handleBpmChange, handlePressStart, handlePressEnd
  } = metro;
  const vintage = useVintage();

  return (
    <div className="w-full h-full flex flex-col items-center tab-enter gap-3">
      <div className="w-full flex-1 rounded-[2.5rem] t-panel shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center py-4 px-3 relative min-h-0">
        {/* Time signature */}
        <div className="w-full flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between w-full px-2">
            <div className="flex flex-col items-center t-chip p-1 rounded-2xl w-14">
              <button onClick={()=>changeNumerator(1)} className="text-gray-500 active:text-white transition-colors p-1"><ChevronUp size={20}/></button>
              <span className="text-xl font-black text-white leading-none my-0.5">{timeSig.num}</span>
              <button onClick={()=>changeNumerator(-1)} className="text-gray-500 active:text-white transition-colors p-1"><ChevronDown size={20}/></button>
            </div>
            <span className="text-2xl font-black text-gray-700 italic">/</span>
            <div className="flex flex-col items-center t-chip p-1 rounded-2xl w-14">
              <button onClick={()=>changeDenominator(1)} className="text-gray-500 active:text-white transition-colors p-1"><ChevronUp size={20}/></button>
              <span className="text-xl font-black text-[#4afc9d] leading-none my-0.5">{timeSig.den}</span>
              <button onClick={()=>changeDenominator(-1)} className="text-gray-500 active:text-white transition-colors p-1"><ChevronDown size={20}/></button>
            </div>
          </div>
        </div>

        {/* Beat grid */}
        <div
          className={`grid justify-center justify-items-center w-full px-1 shrink-0 transition-all duration-300 ${beatSounds.length>8?'gap-x-1.5 gap-y-2 mt-3':'gap-x-2 mt-4'}`}
          style={{gridTemplateColumns:`repeat(${Math.min(beatSounds.length,8)},minmax(0,auto))`}}>
          {beatSounds.map((s,i) => {
            const isThisBeatFired=(i===currentBeat)&&(visualFlash==='main');
            const currentSubVal=beatSubdivisions[i];
            const isDense=beatSounds.length>8;
            return (
              <div key={i} className={`flex flex-col items-center ${isDense?'gap-1':'gap-2'}`}>
                <button onClick={()=>toggleBeatSound(i)}
                  className={`${isDense?'w-7 h-7 border-[1.5px]':'w-9 h-9 border-2'} rounded-full transition-all duration-100 ${isThisBeatFired?'scale-110 ring-2 ring-white/30 ring-offset-2 ring-offset-[#080808]':''} ${
                    s===2?'bg-[#ffcc00] border-[#ffcc00] shadow-[0_0_15px_#ffcc00]':
                    s===3?'bg-[#f97316] border-[#f97316] shadow-[0_0_12px_#f97316]':
                    s===1?'bg-[#4afc9d] border-[#4afc9d] shadow-[0_0_10px_#4afc9d]':
                    'bg-transparent border-gray-700'
                  }`}/>
                <button onClick={()=>toggleBeatSubdivision(i)} className="text-gray-500 active:text-[#4afc9d] transition-colors">
                  {renderSubdivisionIcon(currentSubVal, isDense?"h-5 w-auto":"h-7 w-auto")}
                </button>
              </div>
            );
          })}
        </div>

        {/* Flash ball */}
        <div className="flex-1 w-full flex items-center justify-center my-2 min-h-0">
          {(() => {
            const isActiveBeatSound=currentBeat>=0&&beatSounds[currentBeat]>0;
            const beatSoundType=currentBeat>=0?beatSounds[currentBeat]:0;
            let pulseClass='bg-[#151515] border-4 border-[#080808] shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] scale-90';
            if (visualFlash==='main'&&isActiveBeatSound) {
              if (beatSoundType===2) pulseClass='bg-[#ffcc00] shadow-[0_0_40px_#ffcc00] scale-125 border-transparent';
              else if (beatSoundType===3) pulseClass='bg-[#f97316] shadow-[0_0_35px_#f97316] scale-[1.15] border-transparent';
              else pulseClass='bg-[#4afc9d] shadow-[0_0_30px_#4afc9d] scale-110 border-transparent';
            } else if (visualFlash==='sub') {
              pulseClass='bg-[#0ea5e9] shadow-[0_0_25px_#0ea5e9] scale-105 border-transparent';
            }
            return (
              <div className={`w-16 h-16 rounded-full transition-all duration-100 ease-out flex items-center justify-center ${pulseClass}`}>
                <div className="w-6 h-6 rounded-full bg-white/20 mix-blend-overlay"/>
              </div>
            );
          })()}
        </div>

        {/* BPM display */}
        {vintage ? (
          <BrassPlate className="shrink-0 mb-1 flex flex-col items-center">
            <DrumDigits text={String(bpm).padStart(3, '0')} unit="BPM"/>
            <span className="text-[9px] font-black text-[#3b2a1a] tracking-widest uppercase mt-1" style={{ fontFamily:'Georgia,serif' }}>{getTempoMarking(bpm)}</span>
          </BrassPlate>
        ) : (
          <div className="flex flex-col items-center shrink-0 mb-1">
            <span className="text-[40px] font-black leading-none tracking-tighter text-white">{bpm}</span>
            <span className="text-[8px] font-bold text-[#ffcc00]/80 tracking-widest uppercase mt-1">{getTempoMarking(bpm)}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full flex flex-col gap-2.5 shrink-0">
        <div className="flex justify-between items-center gap-2">
          <button onPointerDown={()=>handlePressStart(-1)} onPointerUp={handlePressEnd} onPointerLeave={handlePressEnd}
            style={{touchAction:'none'}}
            className="w-12 h-12 rounded-xl t-chip flex items-center justify-center active:bg-gray-800 transition-colors shrink-0">
            <Minus size={20} className="text-gray-400 pointer-events-none"/>
          </button>
          <button onClick={toggleMetronome}
            className={`flex-1 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl border-[2px] ${isPlayingMetro?'bg-[#ffcc00]/10 border-[#ffcc00]/30 text-[#ffcc00]':'bg-[#4afc9d]/10 border-[#4afc9d]/30 text-[#4afc9d]'}`}>
            {isPlayingMetro ? <Square size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="translate-x-1"/>}
          </button>
          <button onPointerDown={()=>handlePressStart(1)} onPointerUp={handlePressEnd} onPointerLeave={handlePressEnd}
            style={{touchAction:'none'}}
            className="w-12 h-12 rounded-xl t-chip flex items-center justify-center active:bg-gray-800 transition-colors shrink-0">
            <Plus size={20} className="text-gray-400 pointer-events-none"/>
          </button>
        </div>
        <div className="flex items-center t-inset py-3 px-4 rounded-[1.5rem] shadow-inner">
          <input type="range" min="30" max="250" value={bpm} onChange={handleBpmChange} className="w-full cursor-pointer"/>
        </div>
      </div>
    </div>
  );
};
