// ==========================================
// metronome — 메트로놈 탭
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
// ==========================================

// ==========================================
// Metronome Hook
// ==========================================
const useMetronomeLogic = () => {
  const [bpm, setBpm] = usePersistentState('metro.bpm', 60, v => v >= 30 && v <= 250);
  const [isPlayingMetro, setIsPlayingMetro] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [timeSig, setTimeSig] = usePersistentState('metro.timeSig', { num:4, den:4 }, v => v?.num >= 1 && v.num <= 16 && [2,4,8,16].includes(v.den));
  const [beatSounds, setBeatSounds] = usePersistentState('metro.beatSounds', [2,1,1,1], v => Array.isArray(v) && v.length >= 1);
  const [beatSubdivisions, setBeatSubdivisions] = usePersistentState('metro.beatSubdivisions', [1,1,1,1], v => Array.isArray(v) && v.length >= 1);
  const [visualFlash, setVisualFlash] = useState(false);
  const [currentSub, setCurrentSub] = useState(0);     // 지금 박 안의 몇 번째 쪼갠 박인지 (다이얼·네모 칸 표시용)
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
  const recordTapRef     = useRef(null);   // 녹음 중이면 딸깍 소리를 여기에도 연결 (recorder.jsx)
  const lookahead = 25.0;
  const scheduleAheadTime = 0.1;

  useEffect(() => () => { stopMetronome(); handlePressEnd(); }, []);
  useEffect(() => {
    timeSigRef.current=timeSig; beatSoundsRef.current=beatSounds; beatSubdivisionsRef.current=beatSubdivisions;
    if (currentBeat>=timeSig.num) { setCurrentBeat(0); currentBeatRef.current=0; }
  }, [timeSig, beatSounds, beatSubdivisions, currentBeat]);
  useEffect(() => { bpmRef.current=bpm; }, [bpm]);

  // 소리 최대: 딸깍(두 음 겹침) → 증폭(×4) → 리미터(찌그러짐 없이 최대 음량) → 스피커
  const masterRef = useRef(null);
  const initMetroAudioContext = () => {
    if (!metroAudioCtxRef.current) {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      metroAudioCtxRef.current = ctx;
      const boost = ctx.createGain(); boost.gain.value = 4;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.0005; lim.release.value = 0.06;
      boost.connect(lim); lim.connect(ctx.destination);
      masterRef.current = boost;
    }
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
    {
      // 튜너가 이 순간 분석을 건너뛸 수 있게 클릭 시각 공유 (출력 지연 포함)
      const ctx = metroAudioCtxRef.current;
      const soundOn = subBeatNumber !== 0 || beatSoundsRef.current[beatNumber] > 0;
      const heard = performance.now() + delay + ((ctx.outputLatency || ctx.baseLatency || 0) * 1000);   // 스피커에서 실제로 나는 시각
      if (soundOn) METRO_CLICKS.times.push(heard);
      METRO_CLICKS.grid.push([heard, subBeatNumber === 0]);
      if (METRO_CLICKS.grid.length > 4000) METRO_CLICKS.grid.splice(0, 2000);
    }
    if (subBeatNumber===0) {
      setTimeout(()=>{
        if (!isPlayingRef.current) return;
        setCurrentBeat(beatNumber); setCurrentSub(0); setVisualFlash('main');
        setTimeout(()=>{ if (isPlayingRef.current) setVisualFlash(false); },150);
      }, Math.max(0,delay));
    } else {
      setTimeout(()=>{
        if (!isPlayingRef.current) return;
        setCurrentSub(subBeatNumber); setVisualFlash('sub');
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
      else if (soundType===1) { freq=1000; vol=0.9; }
      else if (soundType===-1){ freq=1200; vol=0.7; }
      osc.frequency.value=freq;
      // 두 번째 음(5도 위)을 겹쳐 폰 스피커에서 더 크고 또렷하게
      const osc2=metroAudioCtxRef.current.createOscillator();
      osc2.type='square'; osc2.frequency.value=freq*1.5;
      gain.gain.setValueAtTime(vol,time);
      const dur=soundType===-1?0.04:0.07;
      gain.gain.exponentialRampToValueAtTime(0.001,time+dur);
      osc.connect(gain); osc2.connect(gain); gain.connect(masterRef.current || metroAudioCtxRef.current.destination);
      if (recordTapRef.current) gain.connect(recordTapRef.current);   // 녹음에 메트로놈 소리 넣기
      osc.start(time); osc.stop(time+dur+0.01); osc2.start(time); osc2.stop(time+dur+0.01);
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

  // 초기화: 60 BPM, 4/4, 기본 강세, 박 나누기 없음 (재생 중이면 계속 재생)
  const resetMetronome = () => {
    setBpm(60);
    setTimeSig({ num:4, den:4 });
    setBeatSounds([2,1,1,1]);
    setBeatSubdivisions([1,1,1,1]);
    restartMetroIfNeeded();
    haptic(20);
  };

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
    bpm, setBpm, isPlayingMetro, currentBeat, currentSub, timeSig, beatSounds, beatSubdivisions, visualFlash,
    toggleMetronome, changeNumerator, changeDenominator, toggleBeatSubdivision, toggleBeatSound,
    handleBpmChange, handlePressStart, handlePressEnd, tapTempo, resetMetronome,
    getMetroCtx: () => { initMetroAudioContext(); return metroAudioCtxRef.current; },   // 녹음 믹스용
    // 딸깍 한 번 (메트로놈 재생과 별개, 지금은 안 씀 — 예전 녹음 카운트인용). when = AudioContext 시각
    playClick: (when, strong) => {
      initMetroAudioContext();
      const ctx = metroAudioCtxRef.current, osc = ctx.createOscillator(), g = ctx.createGain(), t = when ?? ctx.currentTime + 0.02;
      osc.type = 'square'; osc.frequency.value = strong ? 2000 : 1000;
      g.gain.setValueAtTime(strong ? 1 : 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(g); g.connect(masterRef.current || ctx.destination); osc.start(t); osc.stop(t + 0.05);
    },
    setRecordTap: (node) => { recordTapRef.current = node; },
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

// 다이얼 조각: 박마다 한 구간, 박을 쪼개면 그 구간을 다시 나눔. cur = 지금 소리 나는 조각
const beatPieces = (metro, gapDeg) => {
  const { beatSounds, beatSubdivisions, currentBeat, currentSub, isPlayingMetro } = metro;
  const n = beatSounds.length, out = [];
  beatSounds.forEach((snd, i) => {
    const sub = beatSubdivisions[i] || 1, b0 = (360 / n) * i + gapDeg / 2, b1 = (360 / n) * (i + 1) - gapDeg / 2;
    const sg = sub > 1 ? Math.min(4, (b1 - b0) * 0.08) : 0, w = (b1 - b0 - sg * (sub - 1)) / sub;
    for (let j = 0; j < sub; j++) {
      const a0 = b0 + j * (w + sg);
      out.push({ i, j, snd, a0, a1: a0 + w, beatCur: isPlayingMetro && i === currentBeat, cur: isPlayingMetro && i === currentBeat && j === (currentSub || 0) });
    }
  });
  return out;
};

// 박이 울릴 때 다이얼 전체가 번쩍 (멀리서도 보이게): 문자판이 박 색으로 차오르고 바깥이 빛남. 첫 박은 더 강하게
const beatFlash = (metro) => {
  const { isPlayingMetro, visualFlash, currentBeat, beatSounds } = metro;
  const fire = isPlayingMetro && visualFlash === 'main' && beatSounds[currentBeat] > 0;
  return { fire, down: fire && currentBeat === 0, snd: fire ? beatSounds[currentBeat] : 0 };
};
const flashWrap = (f, col) => ({ borderRadius: '50%', transition: f.fire ? 'box-shadow 40ms' : 'box-shadow 260ms ease-out',
  boxShadow: f.fire ? `0 0 ${f.down ? 80 : 46}px ${f.down ? 18 : 8}px ${col}` : '0 0 0 0 transparent' });
const flashFace = (f, r, col, max = 0.55) => (
  <circle cx="100" cy="100" r={r} fill={col} opacity={f.fire ? (f.down ? max : max * 0.6) : 0}
    style={{ transition: f.fire ? 'opacity 40ms' : 'opacity 260ms ease-out' }}/>
);

// 빈티지: 아르데코 라디오 다이얼 — 크림색 문자판, 눈금 링, 박마다 빨간 바늘이 그 박 위치로 이동
const RadioBeatDial = ({ metro, size, center }) => {
  const { bpm, currentBeat, beatSounds, visualFlash, isPlayingMetro } = metro;
  const n = beatSounds.length, gap = n > 8 ? 3 : 6;
  const firing = visualFlash === 'main';
  const f = beatFlash(metro);
  const beatAngle = isPlayingMetro && currentBeat >= 0 ? (360 / n) * (currentBeat + 0.5) : 0;
  return (
    <div className="relative" style={{ width: size, height: size, ...flashWrap(f, 'rgba(244,215,138,.75)') }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id="radioFace" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#fbf4e2"/><stop offset="1" stopColor="#e2d3ad"/></radialGradient>
        </defs>
        <circle cx="100" cy="100" r="97" fill="#3a2410" stroke="#b88a35" strokeWidth="3"/>
        {/* 박 구간 (바깥 링) */}
        {beatPieces(metro, gap).map(({ i, j, snd, a0, a1, cur, beatCur }) => (
          <path key={i + '-' + j} d={arcPath(100, 100, 88, a0, a1)} fill="none" strokeLinecap="round" strokeWidth={cur ? (visualFlash ? 14 : 11) : j ? 5 : 8}
            stroke={cur ? RADIO.cream : j ? (beatCur ? 'rgba(244,215,138,.5)' : 'rgba(244,215,138,.25)') : snd === 0 ? 'rgba(244,215,138,.15)' : snd === 2 ? 'rgba(244,215,138,.55)' : 'rgba(184,138,53,.45)'}
            style={{ transition: 'stroke-width 80ms, stroke 80ms', filter: cur && visualFlash ? `drop-shadow(0 0 5px ${RADIO.cream})` : 'none' }}/>
        ))}
        {/* 눈금 */}
        {Array.from({ length: 40 }, (_, k) => {
          const a = (k * 9 - 90) * Math.PI / 180, r1 = 82, r2 = k % 5 === 0 ? 72 : 77;
          return <line key={k} x1={100 + r1 * Math.cos(a)} y1={100 + r1 * Math.sin(a)} x2={100 + r2 * Math.cos(a)} y2={100 + r2 * Math.sin(a)}
            stroke="#f4d78a" strokeWidth={k % 5 === 0 ? 1.6 : 0.8} opacity="0.6"/>;
        })}
        {/* 문자판 */}
        <circle cx="100" cy="100" r="64" fill="url(#radioFace)" stroke="#b88a35" strokeWidth="2"/>
        {flashFace(f, 63, f.down ? '#c0392b' : '#e0a94f', 0.5)}
        <circle cx="100" cy="100" r="60" fill="none" stroke="#b88a35" strokeWidth="0.8" opacity={visualFlash === 'sub' ? 0.9 : 0.25} style={{ transition: 'opacity 60ms' }}/>
        {/* 바늘: 지금 박 위치 */}
        <g style={{ transform: `rotate(${beatAngle}deg)`, transformOrigin: '100px 100px', transition: 'transform 120ms ease-out' }} opacity={isPlayingMetro ? 1 : 0.5}>
          <line x1="100" y1="12" x2="100" y2="40" stroke={RADIO.needle} strokeWidth="3" strokeLinecap="round"/>
        </g>
      </svg>
      {center ? <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div> : <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontFamily: 'Georgia,serif', fontSize: size * 0.24, lineHeight: 1, color: RADIO.ink }}>{bpm}</span>
        <span style={{ fontFamily: 'Georgia,serif', fontSize: 10, letterSpacing: '0.2em', color: RADIO.brown, marginTop: 2 }}>BPM · {getTempoMarking(bpm).toUpperCase()}</span>
      </div>}
    </div>
  );
};

// 우드 계열 다이얼 (피아노·가죽·바이올린·악보): 박 구간 링 + 문자판 + 가운데 BPM
const SkinBeatDial = ({ metro, size, k, center }) => {
  const { bpm, currentBeat, beatSounds, visualFlash, isPlayingMetro } = metro;
  const d = k.dial, n = beatSounds.length, gap = n > 8 ? 3 : 6, firing = visualFlash === 'main';
  const f = beatFlash(metro);
  return (
    <div className="relative" style={{ width: size, height: size, ...flashWrap(f, d.on) }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        <circle cx="100" cy="100" r="97" fill={d.outer} stroke={d.ring} strokeWidth="2.5" strokeDasharray={d.ringDash ? '5 4' : undefined}/>
        {beatPieces(metro, gap).map(({ i, j, snd, a0, a1, cur, beatCur }) => (
          <path key={i + '-' + j} d={arcPath(100, 100, 84, a0, a1)} fill="none" strokeLinecap="round" strokeWidth={cur ? (visualFlash ? 19 : 15) : j ? 7 : 12}
            stroke={cur ? d.on : j ? (beatCur ? d.strong : d.off) : snd === 0 ? d.off : snd === 2 ? d.strong : d.off}
            style={{ transition: 'stroke-width 80ms, stroke 80ms', filter: cur && visualFlash ? `drop-shadow(0 0 6px ${d.on})` : 'none' }}/>
        ))}
        <circle cx="100" cy="100" r="68" fill={d.face} stroke={d.ring} strokeWidth="1.5" strokeDasharray={d.ringDash ? '4 3' : undefined}/>
        {flashFace(f, 67, d.on, 0.45)}
        <circle cx="100" cy="100" r="63" fill="none" stroke={d.sub} strokeWidth="0.8" opacity={visualFlash === 'sub' ? 0.9 : 0.15} style={{ transition: 'opacity 60ms' }}/>
      </svg>
      {center ? <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div> : <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontFamily: 'Georgia,serif', fontSize: k.quarter ? size * 0.17 : size * 0.24, lineHeight: 1, color: d.text,
          textShadow: k.emboss ? '0 2px 0 #1e0f06' : 'none' }}>{k.quarter ? <>♩ = <b style={{ fontSize: size * 0.22 }}>{bpm}</b></> : bpm}</span>
        <span style={{ fontFamily: 'Georgia,serif', fontSize: k.quarter ? 12 : 10, letterSpacing: k.quarter ? 0 : '0.2em', color: d.sub, marginTop: 3, fontStyle: k.italic ? 'italic' : 'normal' }}>
          {k.quarter ? getTempoMarking(bpm) : `BPM · ${getTempoMarking(bpm).toUpperCase()}`}
        </span>
      </div>}
    </div>
  );
};

// 부품별 꾸미기가 켜지면 다이얼 가운데를 바꿈: (황동판 +) 고른 숫자 모양
const DialCenter = ({ bpm, size, parts, sub }) => {
  const ns = partNumStyle(parts);
  const text = ns === 'flip' || ns === 'drum' ? String(bpm).padStart(3, '0') : String(bpm);
  const num = <PartNumber style={ns} text={text} unit="BPM" size={Math.round(size * 0.13)} unitColor={parts.plate === 'brass' ? '#5a3a1e' : sub}/>;
  const mark = (c) => <span className="uppercase" style={{ fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.2em', color: c, marginTop: 4 }}>{getTempoMarking(bpm)}</span>;
  if (parts.plate === 'brass') return <BrassPlate className="flex flex-col items-center !px-5 !py-3">{num}{mark('#3b2a1a')}</BrassPlate>;
  return <>{num}{mark(sub)}</>;
};

// 네모 칸 원: 판 안에 박을 큰 원으로 나열 + 원 아래에 쪼갠 박 점 (화면 배치의 '박자 네모 칸 원' 블록)
const BeatBoxes = ({ metro, size, vintage, skin, pal, drag }) => {
  const { bpm, beatSounds, beatSubdivisions, currentBeat, currentSub, visualFlash, isPlayingMetro } = metro;
  const parts = useParts();
  // 다이얼 자리(정사각형)보다 넓게: 칸 너비를 직접 재서 원 크기 결정
  const ref = useRef(null); const [w, setW] = useState(size);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); return () => ro.disconnect(); }, []);
  const n = beatSounds.length, cols = n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : Math.ceil(n / 3), rows = Math.ceil(n / cols);
  const d = Math.max(30, Math.min(130, (w - 24 - (cols - 1) * 10) / cols, (size * 0.72 - (rows - 1) * 20) / rows - 12));
  const k = vintage ? skin.dial : null;
  const f = beatFlash(metro), fcol = vintage ? k.on : (pal[f.snd] || pal[1]);
  const ink = vintage ? k.text : 'var(--ink)', sub = vintage ? k.sub : '#9ca3af';
  const colOf = (snd, on) => vintage ? (on ? k.on : snd === 2 ? k.strong : snd === 0 ? 'transparent' : k.off) : (snd === 0 ? 'transparent' : pal[snd]);
  const ns = parts.num !== 'auto' ? parts.num : null;
  return (
    <div ref={ref} className={`relative flex-1 min-w-0 overflow-hidden mx-2 flex flex-col items-center justify-between rounded-[26px] py-3 px-3.5 ${vintage ? '' : 't-panel'}`}
      style={{ height: size, ...(vintage ? { background: k.outer, border: `2px solid ${k.ring}` } : {}),
        transition: f.fire ? 'box-shadow 40ms' : 'box-shadow 260ms ease-out',
        boxShadow: f.fire ? `0 0 ${f.down ? 70 : 40}px ${f.down ? 10 : 4}px ${fcol}, inset 0 0 0 ${f.down ? 5 : 3}px ${fcol}` : (vintage ? '0 8px 20px rgba(0,0,0,.45)' : 'none') }}>
      <div className="flex flex-col items-center leading-none" {...(drag || {})} aria-label="끌어서 빠르기 조절">
        {ns ? <PartNumber style={ns} text={ns === 'flip' || ns === 'drum' ? String(bpm).padStart(3, '0') : String(bpm)} unit="BPM" size={Math.round(size * 0.12)} unitColor={sub}/>
          : <span className="flex items-baseline gap-1"><span className="font-black" style={{ fontSize: size * 0.17, color: ink, fontFamily: vintage ? 'Georgia,serif' : undefined }}>{bpm}</span>
              <span className="text-[10px] font-black tracking-widest" style={{ color: sub }}>BPM</span></span>}
        <span className="text-[10px] font-bold tracking-widest uppercase mt-1" style={{ color: sub, fontFamily: vintage ? 'Georgia,serif' : undefined }}>{getTempoMarking(bpm)}</span>
        {drag && <DragHint color={sub}/>}
      </div>
      <div className="grid justify-center content-center gap-x-3 gap-y-2 flex-1 w-full" style={{ gridTemplateColumns: `repeat(${cols}, ${d}px)` }}>
        {beatSounds.map((snd, i) => {
          const isCur = isPlayingMetro && i === currentBeat, fire = isCur && visualFlash === 'main';
          const c = colOf(snd, isCur);
          const nsub = beatSubdivisions[i] || 1;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="rounded-full flex items-center justify-center font-black transition-all duration-75" style={{
                width: d, height: d, fontSize: d * 0.36, fontFamily: vintage ? 'Georgia,serif' : 'ui-monospace,monospace',
                background: snd === 0 ? 'transparent' : c, border: snd === 0 ? `2px dashed ${sub}` : `2px solid ${isCur ? c : 'transparent'}`,
                opacity: snd === 0 ? 0.6 : isCur ? 1 : 0.32, color: vintage ? (isCur ? k.face : ink) : '#000',
                transform: `scale(${fire ? 1.12 : 1})`, boxShadow: isCur && snd ? `0 0 ${fire ? 26 : 12}px ${c}` : 'none' }}>{i + 1}</div>
              <div className="flex gap-1 h-2">
                {nsub > 1 && Array.from({ length: nsub }, (_, j) => {
                  const on = isCur && (currentSub || 0) === j;
                  return <span key={j} className="rounded-full transition-all duration-75" style={{ width: 7, height: 7, transform: `scale(${on ? 1.3 : 1})`,
                    background: on ? (vintage ? k.on : pal.sub) : sub, opacity: on ? 1 : 0.35, boxShadow: on ? `0 0 6px ${vintage ? k.on : pal.sub}` : 'none' }}/>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BeatDial = ({ metro, size, pal, vintage, skin }) => {
  const parts = useParts();
  const center = partsCustom(parts) ? <DialCenter bpm={metro.bpm} size={size} parts={parts} sub={vintage ? (skin.dial.ticks ? '#f4d78a' : skin.dial.sub) : '#9ca3af'}/> : null;
  if (vintage) return skin && !skin.dial.ticks ? <SkinBeatDial metro={metro} size={size} k={skin} center={center}/> : <RadioBeatDial metro={metro} size={size} center={center}/>;
  const { bpm, currentBeat, beatSounds, visualFlash, isPlayingMetro } = metro;
  const n = beatSounds.length;
  const gap = n > 8 ? 4 : 7;
  const firing = visualFlash === 'main';
  const f = beatFlash(metro), fcol = pal[f.snd] || pal[1];
  return (
    <div className="relative" style={{ width: size, height: size, ...flashWrap(f, fcol) }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        {vintage && <circle cx="100" cy="100" r="96" fill="none" stroke="#6b4a12" strokeWidth="3"/>}
        {beatPieces(metro, gap).map(({ i, j, snd, a0, a1, cur, beatCur }) => {
          const col = j ? pal.sub : pal[snd];
          return (
            <path key={i + '-' + j} d={arcPath(100, 100, 84, a0, a1)} fill="none" strokeLinecap="round"
              stroke={col} strokeWidth={cur ? (visualFlash ? 22 : 17) : j ? 9 : 14}
              opacity={cur ? 1 : snd === 0 && !j ? 1 : beatCur ? 0.55 : 0.25}
              style={{ transition: 'stroke-width 80ms, opacity 80ms', filter: cur && visualFlash ? `drop-shadow(0 0 ${8 * pal.glow}px ${col})` : 'none' }}/>
          );
        })}
        {flashFace(f, 70, fcol, 0.4)}
        {/* 세분박 깜빡임 */}
        <circle cx="100" cy="100" r="72" fill="none" stroke={pal.sub} strokeWidth="1.5"
          opacity={visualFlash === 'sub' ? 0.9 : 0.08} style={{ transition: 'opacity 60ms' }}/>
      </svg>
      {center ? <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div> : <div className="absolute inset-0 flex flex-col items-center justify-center">
        {vintage ? (
          <BrassPlate className="flex flex-col items-center !px-4 !py-2.5">
            <DrumDigits text={String(bpm).padStart(3, '0')} unit="BPM" size="lg"/>
            <span className="text-[9px] font-black text-[#3b2a1a] tracking-widest uppercase mt-1" style={{ fontFamily:'Georgia,serif' }}>{getTempoMarking(bpm)}</span>
          </BrassPlate>
        ) : (
          <>
            <span className="font-black leading-none tracking-tighter text-white" style={{ fontSize: size * 0.3 }}>{bpm}</span>
            <span className="text-[10px] font-black text-gray-500 tracking-[0.3em] mt-1">BPM</span>
            <span className="text-[10px] font-bold text-[#ffcc00]/80 tracking-widest uppercase mt-1">{getTempoMarking(bpm)}</span>
          </>
        )}
      </div>}
    </div>
  );
};

const Stepper = ({ value, onUp, onDown, accent }) => {
  const vintage = useVintage();
  return (
    <div className="flex items-center t-chip rounded-full px-1">
      <button onClick={onDown} className="p-1.5 text-gray-500 active:text-white"><ChevronDown size={16}/></button>
      <span className="w-6 text-center text-lg font-black" style={{ color: accent ? (vintage ? '#f6dd94' : 'var(--accent)') : 'var(--ink)' }}>{value}</span>
      <button onClick={onUp} className="p-1.5 text-gray-500 active:text-white"><ChevronUp size={16}/></button>
    </div>
  );
};

// 메트로놈 탭 위쪽 한 줄 음정 표시 (튜너와 같은 값): LIVE · 음이름 · ±50센트 바늘 · 센트
const PitchStrip = ({ tuner, compact, swapColors, big }) => {
  // 바늘 게이지: 부채꼴 눈금(−50~+50센트) — 가운데(±10¢)를 넓게 펼친 눈금이라 작은 차이도 잘 보임
  // swapColors: 지판 탭 규칙 (높음 = 파랑, 낮음 = 빨강)
  const HI = swapColors ? '#3b82f6' : '#ef4444', LO = swapColors ? '#ef4444' : '#3b82f6';
  const { isStarted, pitch, cents, tolerance, currentNote, ensureMic } = tuner;
  const vintage = useVintage();
  const skin = useSkin();
  const live = isStarted && pitch > 0;
  const ok = live && Math.abs(cents) <= tolerance;
  const c = live ? Math.max(-50, Math.min(50, cents)) : 0;
  // 색: 우드 = 디자인 다이얼 색(라디오는 크림 문자판), 다크·라이트 = 검은 계기판
  const radio = vintage && skin.dial.ticks;
  const face = !vintage ? '#0a0a0a' : radio ? '#f3e8cc' : skin.dial.face;
  const tick = !vintage ? '#71717a' : radio ? '#5a3a1e' : skin.dial.sub;
  const ink = !vintage ? '#f4f4f5' : radio ? '#2a1a0e' : skin.dial.text;
  const needle = !vintage ? (!live ? '#3f3f46' : ok ? '#4afc9d' : Math.abs(cents) <= tolerance + 15 ? '#ffcc00' : cents > 0 ? HI : LO) : (skin.dial.needle || '#c0392b');
  const cc = !live ? tick : ok ? (vintage ? skin.good : '#4afc9d') : cents > 0 ? HI : LO;
  const W = 200, H = 100, cx = 100, cy = 112, R = 104;
  const ang = (v) => Math.sign(v) * 62 * Math.pow(Math.min(50, Math.abs(v)) / 50, 0.55);   // 가운데를 넓게
  const pt = (deg, r) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)];
  const arc = (d0, d1, r) => { const [x0, y0] = pt(d0, r), [x1, y1] = pt(d1, r); return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`; };
  const needleRef = useRef(null);
  const [c0] = useSpring([c], ([v]) => { const el = needleRef.current; if (!el) return; const [x, y] = pt(ang(v), R - 3); el.setAttribute('x2', x); el.setAttribute('y2', y); }, { k: 0.2 });
  const [nx, ny] = pt(ang(c0), R - 3);
  const ticks = [];
  for (let v = -50; v <= 50; v++) {
    const a = Math.abs(v);
    if (a > 10 && v % 5) continue;                    // ±10 안은 1센트마다, 밖은 5센트마다
    const big = v % 10 === 0 || a === 5 || a === 25, len = v === 0 ? 16 : big ? 11 : a <= 10 ? 5 : 7;
    const [x0, y0] = pt(ang(v), R), [x1, y1] = pt(ang(v), R - len);
    ticks.push(<line key={v} x1={x0} y1={y0} x2={x1} y2={y1} stroke={tick} strokeWidth={big ? 1.5 : 0.7} opacity={big ? 0.95 : 0.6}/>);
  }
  const fs = compact ? 0.62 : big ? 1.35 : 1;
  return (
    <div className={`w-full rounded-2xl p-1.5 shrink-0 ${vintage ? '' : 't-inset'}`} style={vintage ? skin.frame : undefined}>
      <div className={`relative w-full rounded-xl overflow-hidden ${compact ? 'h-[70px]' : big ? 'h-[210px]' : 'h-[136px]'}`} style={{ background: face, boxShadow: 'inset 0 2px 8px rgba(0,0,0,.5)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" className="absolute inset-0 w-full h-full">
          <path d={arc(ang(-tolerance), ang(tolerance), R - 7)} fill="none" stroke={ok ? 'rgba(74,252,157,.8)' : 'rgba(74,180,110,.38)'} strokeWidth="11"/>
          {ticks}
          {[-50, -20, -10, -5, 5, 10, 20, 50].map(v => { const [x, y] = pt(ang(v), R - 21); return <text key={v} x={x} y={y + 3} textAnchor="middle" fontSize={Math.abs(v) <= 10 ? 8 : 7} fontWeight="700" fill={tick} fontFamily="Georgia,serif">{v > 0 ? `+${v}` : v}</text>; })}
          <text x={pt(0, R - 23)[0]} y={pt(0, R - 23)[1] + 3} textAnchor="middle" fontSize="10" fontWeight="800" fill={tick} fontFamily="Georgia,serif">0</text>
          <line ref={needleRef} x1={cx} y1={cy} x2={nx} y2={ny} stroke={needle} strokeWidth="2.6" strokeLinecap="round" opacity={live ? 1 : 0.4}
            style={{ filter: live && !vintage ? `drop-shadow(0 0 3px ${needle})` : 'none' }}/>
          <circle cx={cx} cy={H} r="8" fill={tick}/>
        </svg>
        {/* 왼쪽: 마이크 · 음이름 / 오른쪽: 센트 — 계기판 아래 모서리 */}
        <button onClick={isStarted ? undefined : ensureMic} className="absolute left-2.5 top-2 flex items-center gap-1 text-[9px] font-black tracking-widest"
          style={{ color: isStarted ? (vintage ? skin.live : '#4afc9d') : '#ef4444' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'animate-pulse' : ''}`} style={{ background: 'currentColor' }}/>
          {isStarted ? 'LIVE' : 'OFF'}
        </button>
        <span className="absolute left-2.5 bottom-1.5 font-black leading-none" style={{ color: live ? ink : tick, fontSize: 40 * fs, fontFamily: vintage ? 'Georgia,serif' : undefined }}>
          {live ? currentNote.name : '—'}<span style={{ fontSize: 20 * fs }}>{live ? currentNote.symbol.replace('#', '♯') : ''}</span>
          <span style={{ fontSize: 14 * fs, opacity: 0.6 }}>{live ? currentNote.octave : ''}</span>
        </span>
        <span className="absolute right-2.5 bottom-1.5 font-black leading-none text-right" style={{ color: cc, fontSize: 32 * fs, fontFamily: vintage ? 'Georgia,serif' : 'ui-monospace,monospace' }}>
          {live ? (ok ? 'OK' : `${cents > 0 ? '+' : ''}${cents}`) : '0'}{live && !ok && <span style={{ fontSize: 12 * fs }}>¢</span>}
        </span>
        <span className="absolute right-3 top-2 text-[11px] font-black" style={{ color: HI }}>♯</span>
        <span className="absolute right-7 top-2 text-[11px] font-black" style={{ color: LO }}>♭</span>
      </div>
    </div>
  );
};

// 큰 숫자 음정 표시: 음이름 · 센트 · 방향 (메인 음정 표시기 '큰 숫자')
const PitchDigits = ({ tuner, compact, swapColors, big }) => {
  const HI = swapColors ? '#3b82f6' : '#ef4444', LO = swapColors ? '#ef4444' : '#3b82f6';
  const { isStarted, pitch, cents, tolerance, currentNote, ensureMic } = tuner;
  const vintage = useVintage();
  const skin = useSkin();
  const live = isStarted && pitch > 0, ok = live && Math.abs(cents) <= tolerance;
  const cc = !live ? (vintage ? skin.unit : 'var(--ink-off)') : ok ? (vintage ? skin.good : '#4afc9d') : cents > 0 ? HI : LO;
  const ink = vintage ? skin.label : 'var(--ink)';
  return (
    <div className={`w-full rounded-2xl px-4 ${compact ? 'py-1.5' : 'py-3'} flex items-center gap-3 shrink-0 ${vintage ? '' : 't-inset'}`} style={vintage ? skin.frame : undefined}>
      <button onClick={isStarted ? undefined : ensureMic} className="flex items-center gap-1 text-[9px] font-black tracking-widest shrink-0"
        style={{ color: isStarted ? (vintage ? skin.live : '#4afc9d') : '#ef4444' }}>
        <span className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'animate-pulse' : ''}`} style={{ background: 'currentColor' }}/>{isStarted ? 'LIVE' : 'OFF'}
      </button>
      <span className="font-black leading-none" style={{ color: live ? ink : cc, fontSize: compact ? 30 : big ? 72 : 52, fontFamily: vintage ? 'Georgia,serif' : undefined }}>
        {live ? currentNote.name : '—'}<span style={{ fontSize: compact ? 16 : 26 }}>{live ? currentNote.symbol.replace('#', '♯') : ''}</span>
        <span style={{ fontSize: compact ? 12 : 18, opacity: 0.6 }}>{live ? currentNote.octave : ''}</span>
      </span>
      <span className="ml-auto flex flex-col items-end leading-none">
        <span className="font-black" style={{ color: cc, fontSize: compact ? 28 : big ? 64 : 48, fontFamily: vintage ? 'Georgia,serif' : 'ui-monospace,monospace' }}>
          {live ? (ok ? '✓' : `${cents > 0 ? '+' : ''}${cents}`) : '0'}{live && !ok && <span style={{ fontSize: compact ? 12 : 18 }}>¢</span>}
        </span>
        {!compact && <span className="text-[11px] font-black mt-1" style={{ color: cc }}>{!live ? '' : ok ? '맞음' : cents > 0 ? '높음 → 내리기' : '낮음 → 올리기'}</span>}
      </span>
    </div>
  );
};

// 실시간 음정 그래프: 최근 10초 동안 연주한 음정을 점으로 (녹음 재생 그래프와 같은 모양, 화면 배치 'history' 블록)
//  맞음 초록 · 높음 빨강 · 낮음 파랑, 음이 바뀌면 음이름, 메트로놈이 돌면 박 세로줄
const LivePitchGraph = ({ tuner }) => {
  // 최근 10초 연주를 음역 그래프로: 세로 = 실제 음 높이(반음 줄 + 음이름, 개방현 줄 강조), 점 색 = 맞음 초록 · 높음 빨강 · 낮음 파랑
  const WIN = 10000;
  const ptsRef = useRef([]);
  const [, setTick] = useState(0);
  useEffect(() => {
    const f = (label, cents, now) => { const a = ptsRef.current; if (!a.length || now - a[a.length - 1][0] >= 30) a.push([now, cents, label]); };
    tuner.noteListeners.add(f);
    const iv = setInterval(() => { const a = ptsRef.current, cut = performance.now() - WIN; while (a.length && a[0][0] < cut) a.shift(); setTick(t => t + 1); }, 100);
    return () => { tuner.noteListeners.delete(f); clearInterval(iv); };
  }, []);
  const vintage = useVintage(), skin = useSkin(), light = useTheme() === 'light';
  const L = graphLook(vintage, skin, light);
  const now = performance.now(), w0 = now - WIN, tol = tuner.tolerance;
  const xp = (t) => ((t - w0) / WIN) * 100;
  const col = (c) => Math.abs(c) <= tol ? L.ok : c > 0 ? L.hi : L.lo;
  const pts = ptsRef.current.map(q => [q[0], q[1], q[2], noteSemi(q[2])]).filter(q => q[3] !== null);
  const [lo, hi] = pitchRange(pts.map(q => q[3] + q[1] / 100));
  const yp = (v) => ((hi - v) / (hi - lo)) * 100;
  const grid = METRO_CLICKS.grid.filter(g => g[0] >= w0 && g[0] <= now);
  const recent = pts.filter(q => q[0] > now - 5000);   // 맞음 % = 최근 5초
  const okPct = recent.length ? Math.round(100 * recent.filter(q => Math.abs(q[1]) <= tol).length / recent.length) : null;
  return (
    <div className={`w-full max-w-sm rounded-2xl p-1.5 shrink-0 ${vintage ? '' : 't-inset'}`} style={vintage ? skin.frame : undefined}>
      <div className="relative h-36 rounded-xl overflow-hidden" style={{ background: L.face, boxShadow: L.shadow }}>
        <PitchRows lo={lo} hi={hi} L={L} vintage={vintage}/>
        {grid.map((g, i) => <i key={'g' + i} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${xp(g[0])}%`, width: 1, background: g[1] ? L.beat : L.sub }}/>)}
        {pts.map((q, i) => <i key={i} className="absolute rounded-full" style={{ left: `${xp(q[0])}%`, top: `${yp(q[3] + q[1] / 100)}%`, width: 5, height: 5, margin: -2.5, background: col(q[1]) }}/>)}
        <span className="absolute right-1.5 bottom-1 text-[8px] font-bold" style={{ color: L.dim }}>지금 →</span>
        {okPct !== null && <span className="absolute left-1/2 -translate-x-1/2 bottom-1 text-[10px] font-black px-1.5 rounded" style={{ color: okPct >= 70 ? L.ok : '#d97706', background: L.face, border: `1px solid ${L.sub}` }}>맞음 {okPct}%</span>}
        {!pts.length && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: L.dim }}>연주하면 음 높이가 여기에 그려집니다</span>}
      </div>
    </div>
  );
};

// 메인 음정 표시기: 설정(세부 꾸미기 → 음정 표시기)에서 고른 모양으로 — 메트로놈·지판·드론 탭, 1번 탭 'meter' 블록 공용
const MainPitchMeter = ({ tuner, compact, swapColors, big }) => {
  const { meter } = useParts();
  if (meter === 'fine') return big ? <div className="w-full flex justify-center" style={{ zoom: 1.25 }}><FineGauge tuner={tuner} swapColors={swapColors}/></div> : <FineGauge tuner={tuner} swapColors={swapColors}/>;
  if (meter === 'digits') return <PitchDigits tuner={tuner} compact={compact} swapColors={swapColors} big={big}/>;
  return <PitchStrip tuner={tuner} compact={compact} swapColors={swapColors} big={big}/>;
};

// BPM 숫자 끌기: 오른쪽(+ 쪽)·위로 끌면 빨라지고, 왼쪽(− 쪽)·아래로 끌면 느려짐 (끄는 속도에 따라 미세~크게, 처음 방향으로 고정)
const useBpmDrag = (metro, onTap) => {
  // 끌기 속도에 따라: 천천히 = 미세(12px당 1), 보통 = 6px당 1, 휙 = 2.5px당 1. 처음 움직인 방향(가로/세로)으로 고정
  const st = useRef(null);
  const mref = useRef(metro); mref.current = metro;
  return {
    onPointerDown: (e) => { st.current = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), bpm: mref.current.bpm, last: mref.current.bpm, acc: 0, axis: null, moved: false }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} },
    onPointerMove: (e) => {
      const s0 = st.current; if (!s0) return;
      const tx = e.clientX - s0.x, ty = e.clientY - s0.y;
      if (!s0.axis) { if (Math.abs(tx) + Math.abs(ty) < 8) return; s0.axis = Math.abs(tx) >= Math.abs(ty) ? 'x' : 'y'; s0.moved = true; }
      const now = performance.now(), dt = Math.max(8, now - s0.lt);
      const step = s0.axis === 'x' ? e.clientX - s0.lx : -(e.clientY - s0.ly);   // 오른쪽 또는 위 = 빠르게
      const speed = Math.abs(step) / dt;                                         // px/ms
      s0.acc += step / (speed < 0.25 ? 12 : speed < 0.8 ? 6 : 2.5);
      s0.lx = e.clientX; s0.ly = e.clientY; s0.lt = now;
      const v = Math.max(30, Math.min(250, s0.bpm + Math.round(s0.acc)));
      if (v !== s0.last) { s0.last = v; mref.current.setBpm(v); haptic(4); }
    },
    onPointerUp: () => { const s0 = st.current; st.current = null; if (s0 && !s0.moved && onTap) onTap(); },   // 끌지 않고 톡 누르면 onTap (박 조명: 시작/정지)
    onPointerCancel: () => { st.current = null; },
    style: { touchAction: 'none', cursor: 'ew-resize' },
  };
};
// 끌기 안내: BPM 숫자 아래 작은 글씨
const DragHint = ({ color }) => <span className="block text-center text-[9px] font-bold pointer-events-none" style={{ color: color || 'rgba(156,163,175,.7)' }}>◀ 느리게 · 끌기 · 빠르게 ▶</span>;

// ── 박 조명: 화면 절반 이상을 차지하는 큰 판. 박마다 판 전체가 박 색으로 번쩍(첫 박은 꽉 차게) ──
//  가운데 아주 큰 BPM, 위에 박 점, 끌면 빠르기 · 톡 누르면 시작/정지 (멀리서 보면서 연습용)
const lum = (hex) => { const m = /^#([0-9a-f]{6})/i.exec(hex || ''); if (!m) return 0; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const BeatLight = ({ metro }) => {
  // 큰 둥근 불빛 하나: 박마다 원 전체가 박 색으로 켜지고 가운데에 '지금 몇 번째 박'인지 큰 숫자.
  // 원 둘레엔 박 위치 점(시계처럼), 첫 박은 더 밝고 크게. 끌면 빠르기 · 톡 누르면 시작/정지
  const vintage = useVintage(), skin = useSkin(), isLightTheme = useTheme() === 'light';
  const pal = vintage ? METRO_PALETTE.vintage : METRO_PALETTE.tape;
  const { bpm, beatSounds, beatSubdivisions, currentBeat, currentSub, visualFlash, isPlayingMetro, timeSig } = metro;
  const drag = useBpmDrag(metro, () => { metro.toggleMetronome(); });
  const ref = useRef(null); const [box, setBox] = useState({ w: 300, h: 300 });
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); return () => ro.disconnect(); }, []);
  const [showBig, setShowBig] = useState(false);
  const firstRef = useRef(true);
  useEffect(() => { if (firstRef.current) { firstRef.current = false; return; } setShowBig(true); const t = setTimeout(() => setShowBig(false), 900); return () => clearTimeout(t); }, [bpm]);
  const f = beatFlash(metro), sub = isPlayingMetro && visualFlash === 'sub';
  const k = vintage ? skin.dial : null;
  const base = vintage ? (k.face === 'cream' ? '#f3e8cc' : k.face) : null;
  const restInk = vintage ? (k.text === '#2a1a0e' || lum(base) > 0.6 ? '#2a1a0e' : k.text) : 'var(--ink)';
  const lightFace = vintage && lum(base) > 0.6;
  // 박 색: 첫 박(강세)·중간 강세·약박
  const colOf = (snd) => vintage ? (lightFace ? (snd === 2 ? (k.needle || '#b3261e') : '#a0522d') : (snd === 2 ? k.on : (k.strong && k.strong.startsWith('#') ? k.strong : '#e0a94f'))) : (pal[snd] || pal[1]);
  const curSnd = isPlayingMetro && currentBeat >= 0 ? beatSounds[currentBeat] : 0;
  const col = colOf(curSnd || 1);
  const n = beatSounds.length;
  const D = Math.max(120, Math.min(box.w - 56, box.h - 104));         // 큰 불빛 지름 (둘레 점 · 위아래 글자 자리 남김)
  const R = D / 2 + 12;                                               // 박 점 둘레 반지름
  const lit = f.fire ? 1 : sub ? 0.35 : isPlayingMetro && curSnd ? 0.22 : 0;   // 박 순간 = 꽉, 그 사이 = 은은하게 남음
  const numInk = restInk;   // 숫자 색은 고정 (번쩍일 때마다 바뀌면 깜빡여 보임) + 그림자로 밝은 불빛 위에서도 읽히게
  return (
    <div ref={ref} {...drag} className={`relative w-full flex-1 min-h-0 rounded-[28px] overflow-hidden flex items-center justify-center select-none ${vintage ? '' : 't-panel'}`}
      style={{ ...drag.style, cursor: 'pointer', ...(vintage ? { background: base, border: `2px solid ${k.ring}` } : {}) }}
      aria-label="박 조명 (끌어서 빠르기, 누르면 시작/정지)">
      {/* 위: 작은 빠르기 */}
      <span className="absolute top-2.5 inset-x-0 text-center text-xs font-black tracking-widest pointer-events-none" style={{ color: restInk, opacity: 0.7, fontFamily: vintage ? 'Georgia,serif' : undefined }}>
        {bpm} BPM · {timeSig.num}/{timeSig.den} · {getTempoMarking(bpm)}
      </span>
      <div className="relative pointer-events-none" style={{ width: D, height: D }}>
        {/* 둘레 박 점 (12시 = 첫 박, 시계 방향) */}
        {beatSounds.map((snd, i) => {
          const ang = (i / n) * 2 * Math.PI - Math.PI / 2, on = isPlayingMetro && i === currentBeat;
          const sz = snd === 2 ? 16 : 11, c = colOf(snd || 1);
          return <i key={i} className="absolute rounded-full" style={{ width: sz, height: sz, left: D / 2 + R * Math.cos(ang) - sz / 2, top: D / 2 + R * Math.sin(ang) - sz / 2,
            background: snd === 0 ? 'transparent' : c, border: snd === 0 ? `2px solid ${restInk}` : 'none', opacity: on ? 1 : 0.3,
            transform: `scale(${on ? 1.6 : 1})`, boxShadow: on ? `0 0 12px ${c}` : 'none', transition: 'transform 80ms, opacity 80ms' }}/>;
        })}
        {/* 큰 불빛 */}
        <div className="absolute inset-0 rounded-full" style={{ background: vintage ? (lightFace ? 'rgba(42,26,14,.08)' : 'rgba(255,255,255,.04)') : 'rgba(128,128,128,.06)',
          border: `3px solid ${isPlayingMetro ? col : restInk}`, opacity: isPlayingMetro ? 1 : 0.35 }}/>
        <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 45% 40%, ${col}, ${col} 55%, ${col}cc 80%, ${col}66)`, opacity: lit,
          transform: `scale(${f.fire ? (f.down ? 1.04 : 1.02) : 1})`, boxShadow: f.fire ? `0 0 ${f.down ? 80 : 46}px ${f.down ? 20 : 8}px ${col}` : 'none',
          transition: f.fire ? 'opacity 25ms, transform 25ms, box-shadow 25ms' : 'opacity 320ms ease-out, transform 220ms ease-out, box-shadow 320ms ease-out' }}/>
        {/* 가운데: 지금 몇 번째 박 (멈춤이면 ▶) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isPlayingMetro
            ? <span className="font-black leading-none" style={{ fontSize: D * 0.46, color: numInk, fontFamily: vintage ? 'Georgia,serif' : 'ui-monospace,monospace', textShadow: lightFace || isLightTheme ? '0 1px 8px rgba(255,255,255,.6)' : '0 2px 12px rgba(0,0,0,.55)' }}>{currentBeat >= 0 ? currentBeat + 1 : ''}</span>
            : <Play size={D * 0.3} fill={restInk} color={restInk} style={{ opacity: 0.5 }}/>}
          {isPlayingMetro && (beatSubdivisions[currentBeat] || 1) > 1 && (
            <span className="flex gap-1.5 mt-1">{Array.from({ length: beatSubdivisions[currentBeat] }, (_, j) => <i key={j} className="rounded-full" style={{ width: 9, height: 9, background: numInk, opacity: (currentSub || 0) === j ? 1 : 0.3 }}/>)}</span>
          )}
        </div>
      </div>
      <span className="absolute bottom-2 inset-x-0 text-center text-[11px] font-bold pointer-events-none" style={{ color: restInk, opacity: 0.5 }}>
        ◀ 느리게 · 끌기 · 빠르게 ▶ · 누르면 {isPlayingMetro ? '정지' : '시작'}
      </span>
      {/* 템포를 바꾸는 동안만 큰 숫자 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: showBig ? 1 : 0, transition: showBig ? 'opacity 80ms' : 'opacity 400ms ease-out' }}>
        <span className="font-black leading-none px-6 py-3 rounded-3xl" style={{ fontSize: Math.min(box.w * 0.4, 150), color: restInk, background: vintage ? base : 'var(--panel-bg)', boxShadow: '0 10px 40px rgba(0,0,0,.35)', fontFamily: vintage ? 'Georgia,serif' : undefined }}>{bpm}</span>
      </div>
    </div>
  );
};

// ── 박자 · 템포 · 시작: 한 판에 세 칸 (간단하게) ──
const MetroControls = ({ metro }) => {
  const vintage = useVintage(), skin = useSkin();
  const { bpm, timeSig, isPlayingMetro, toggleMetronome, changeNumerator, changeDenominator, handlePressStart, handlePressEnd, tapTempo } = metro;
  const drag = useBpmDrag(metro);
  const press = (d) => ({ onPointerDown: () => handlePressStart(d), onPointerUp: handlePressEnd, onPointerLeave: handlePressEnd, style: { touchAction: 'none' } });
  const knob = vintage ? skin.knob : null;
  const btn = (extra) => ({ className: `w-9 h-9 rounded-full flex items-center justify-center active:scale-90 shrink-0 ${vintage ? '' : 't-chip'}`, ...extra });
  const ink = 'var(--ink)', lab = vintage ? skin.dial.sub : '#6b7280';
  const Label = ({ c, children }) => <span className="text-[10px] font-black tracking-widest flex items-center gap-1" style={{ color: c || lab }}>{children}</span>;
  return (
    <div className={`w-full rounded-3xl px-3 py-3 shrink-0 flex items-stretch gap-2 ${vintage ? '' : 't-panel'}`} style={vintage ? skin.frame : undefined}>
      {/* 박자 */}
      <div className="flex flex-col items-center justify-between gap-1.5 shrink-0">
        <Label>박자</Label>
        <div className="flex items-center gap-1">
          <button {...btn({ onClick: () => changeNumerator(-1), 'aria-label': '박 수 줄이기', style: knob || undefined })}><Minus size={14} style={{ color: knob ? knob.color : '#9ca3af' }}/></button>
          <button onClick={() => changeDenominator(1)} aria-label="박자표 바꾸기" className="flex items-baseline font-black leading-none px-1" style={{ color: vintage ? skin.label : ink, fontFamily: vintage ? 'Georgia,serif' : undefined }}>
            <span className="text-2xl">{timeSig.num}</span><span className="text-sm opacity-60">/{timeSig.den}</span>
          </button>
          <button {...btn({ onClick: () => changeNumerator(1), 'aria-label': '박 수 늘리기', style: knob || undefined })}><Plus size={14} style={{ color: knob ? knob.color : '#9ca3af' }}/></button>
        </div>
        <span className="text-[9px] font-bold" style={{ color: lab }}>/숫자 누르면 바뀜</span>
      </div>
      <span className="w-px self-stretch" style={{ background: 'var(--chip-border)' }}/>
      {/* 템포 */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-between gap-1.5">
        <Label>템포 · {getTempoMarking(bpm)}</Label>
        <div className="flex items-center gap-1.5">
          <button {...btn({ ...press(-1), 'aria-label': 'BPM 내리기', style: { ...press(-1).style, ...(knob || {}) } })}><Minus size={14} className="pointer-events-none" style={{ color: knob ? knob.color : '#9ca3af' }}/></button>
          <span {...drag} className="font-black leading-none font-mono px-1" style={{ ...drag.style, fontSize: 34, color: vintage ? skin.label : ink, fontFamily: vintage ? 'Georgia,serif' : undefined }} aria-label="끌어서 빠르기">{bpm}</span>
          <button {...btn({ ...press(1), 'aria-label': 'BPM 올리기', style: { ...press(1).style, ...(knob || {}) } })}><Plus size={14} className="pointer-events-none" style={{ color: knob ? knob.color : '#9ca3af' }}/></button>
        </div>
        <button onClick={tapTempo} className="text-[10px] font-black px-2.5 py-0.5 rounded-full t-chip" style={{ color: vintage ? skin.label : 'var(--ink2)' }}>TAP 두드려서</button>
      </div>
      <span className="w-px self-stretch" style={{ background: 'var(--chip-border)' }}/>
      {/* 시작 */}
      <div className="flex flex-col items-center justify-between gap-1.5 shrink-0">
        <Label>시작</Label>
        <button onClick={toggleMetronome} aria-label={isPlayingMetro ? '메트로놈 정지' : '메트로놈 시작'}
          className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all"
          style={vintage ? (isPlayingMetro ? skin.playOn : skin.play)
            : { background: isPlayingMetro ? 'rgba(255,204,0,.15)' : '#4afc9d', color: isPlayingMetro ? '#ffcc00' : '#000', border: `2px solid ${isPlayingMetro ? '#ffcc00' : '#4afc9d'}`, boxShadow: isPlayingMetro ? '0 0 16px rgba(255,204,0,.4)' : '0 6px 16px rgba(74,252,157,.3)' }}>
          {isPlayingMetro ? <Square size={24} fill="currentColor"/> : <Play size={26} fill="currentColor"/>}
        </button>
        <span className="text-[9px] font-bold" style={{ color: lab }}>{isPlayingMetro ? '정지' : '시작'}</span>
      </div>
    </div>
  );
};

// 다이얼 칸: 남는 공간에 맞춰 정사각형 크기 계산 (배치에서 숨기면 통째로 빠짐)
const DialBlock = ({ children }) => {
  const [ref, size] = useFitSquare(104, 480);     // 다이얼을 최대한 크게 (멀리서도 보이게)
  return <div ref={ref} className="w-full flex-1 min-h-0 flex items-center justify-between">{children(size)}</div>;
};

const Metronome = ({ metro, tuner, openSettings }) => {
  const bpmDrag = useBpmDrag(metro);
  const skin = useSkin();
  const {
    bpm, setBpm, isPlayingMetro, currentBeat, timeSig, beatSounds, beatSubdivisions, visualFlash,
    toggleMetronome, changeNumerator, changeDenominator, toggleBeatSubdivision, toggleBeatSound,
    handleBpmChange, handlePressStart, handlePressEnd, tapTempo, resetMetronome
  } = metro;
  const vintage = useVintage();
  const pal = vintage ? METRO_PALETTE.vintage : METRO_PALETTE.tape;
  const [confirmReset, setConfirmReset] = useState(false);
  const onReset = () => {
    if (confirmReset) { resetMetronome(); setConfirmReset(false); }
    else { setConfirmReset(true); haptic(8); setTimeout(() => setConfirmReset(false), 2500); }
  };
  const layout = tuner?.settings.layout2 || DEFAULT_SETTINGS.layout2;
  const isDense = beatSounds.length > 8;

  const pressProps = (d) => ({
    onPointerDown: () => handlePressStart(d), onPointerUp: handlePressEnd, onPointerLeave: handlePressEnd,
    style: { touchAction: 'none' },
  });

  return (
    <div className="w-full h-full flex flex-col items-center tab-enter gap-2.5">
      {/* 1. 박자표 */}
      <div className="w-full flex items-center justify-between gap-2 shrink-0 h-10">
        {layout.some(b => b.on && b.id === 'ctrl')
          ? <span className="text-sm font-black tracking-widest" style={{ color: 'var(--ink)', fontFamily: vintage ? 'Georgia,serif' : undefined }}>메트로놈</span>
          : <div className="flex items-center gap-1.5 shrink-0">
          <Stepper value={timeSig.num} onUp={() => changeNumerator(1)} onDown={() => changeNumerator(-1)}/>
          <span className="text-xl font-black text-gray-600 italic">/</span>
          <Stepper value={timeSig.den} onUp={() => changeDenominator(1)} onDown={() => changeDenominator(-1)} accent/>
        </div>}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* 설정 (1번 탭과 같은 설정창 — 화면 배치는 메트로놈 탭이 먼저 열림) */}
          {openSettings && (
            <button onClick={() => { openSettings('t2'); haptic(8); }}
              className="flex items-center gap-1.5 t-chip px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-transform shadow-md text-gray-300 whitespace-nowrap shrink-0">
              <SlidersHorizontal size={13} className="text-[#4afc9d]"/> 설정
            </button>
          )}
          {/* 초기화: 두 번 눌러야 실행 */}
          <button onClick={onReset} aria-label="메트로놈 초기화"
            className={`flex items-center gap-1 rounded-full t-chip transition-all active:scale-95 shrink-0 ${confirmReset ? 'px-2.5 py-1.5' : 'p-2'}`}
            style={confirmReset ? { color: '#ef4444', borderColor: '#ef4444' } : { color: '#9ca3af' }}>
            <RotateCcw size={14}/>
            {confirmReset && <span className="text-[10px] font-black whitespace-nowrap">한 번 더</span>}
          </button>
        </div>
      </div>

      {!layout.some(b => b.on && LAYOUT_BLOCKS.t2.find(k => k.id === b.id)?.grow) && <div className="flex-1"/>}
      {visibleBlocks('t2', layout).map(b => (
        <LayoutBlock key={b.id} id={b.id} grow={b.grow} noZoom={b.noZoom} size={b.size}>
          {b.id === 'pitch' && tuner && <MainPitchMeter tuner={tuner}/>}
          {b.id === 'history' && tuner && <LivePitchGraph tuner={tuner}/>}
          {b.id === 'rec' && <RecModule size={b.size}/>}
          {b.id === 'light' && <BeatLight metro={metro}/>}
          {b.id === 'ctrl' && <MetroControls metro={metro}/>}
          {b.id === 'beats' && (
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

          )}
          {b.id === 'dial' && (
      <DialBlock>{(dialSize) => (<>
        <button {...pressProps(-1)} style={{ ...pressProps(-1).style, ...(vintage ? skin.knob : {}) }}
          className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0 ${vintage ? '' : 't-chip'}`}>
          <Minus size={20} className="pointer-events-none" style={{ color: vintage ? skin.knob.color : '#9ca3af' }}/>
        </button>
        <div {...bpmDrag} className="relative" aria-label="끌어서 빠르기 조절">
          <BeatDial metro={metro} size={dialSize} pal={pal} vintage={vintage} skin={skin}/>
          <span className="absolute left-0 right-0 pointer-events-none" style={{ bottom: dialSize * 0.2 }}><DragHint color={vintage ? (skin.dial.ticks ? '#5a3a1e' : skin.dial.sub) : undefined}/></span>
        </div>
        <button {...pressProps(1)} style={{ ...pressProps(1).style, ...(vintage ? skin.knob : {}) }}
          className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0 ${vintage ? '' : 't-chip'}`}>
          <Plus size={20} className="pointer-events-none" style={{ color: vintage ? skin.knob.color : '#9ca3af' }}/>
        </button>
      </>)}</DialBlock>

          )}
          {b.id === 'boxes' && (
            <DialBlock>{(boxSize) => (<>
              <button {...pressProps(-1)} style={{ ...pressProps(-1).style, ...(vintage ? skin.knob : {}) }} aria-label="BPM 내리기"
                className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0 ${vintage ? '' : 't-chip'}`}>
                <Minus size={20} className="pointer-events-none" style={{ color: vintage ? skin.knob.color : '#9ca3af' }}/>
              </button>
              <BeatBoxes metro={metro} size={boxSize} vintage={vintage} skin={skin} pal={pal} drag={bpmDrag}/>
              <button {...pressProps(1)} style={{ ...pressProps(1).style, ...(vintage ? skin.knob : {}) }} aria-label="BPM 올리기"
                className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0 ${vintage ? '' : 't-chip'}`}>
                <Plus size={20} className="pointer-events-none" style={{ color: vintage ? skin.knob.color : '#9ca3af' }}/>
              </button>
            </>)}</DialBlock>
          )}
          {b.id === 'tempo' && (
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

          )}
          {b.id === 'controls' && (
      <div className="w-full flex gap-2.5 shrink-0">
        <button onClick={tapTempo}
          className="w-24 h-14 rounded-2xl t-chip flex flex-col items-center justify-center active:scale-95 transition-transform">
          <span className="text-sm font-black" style={{ color: vintage ? '#f6dd94' : 'var(--ink)' }}>TAP</span>
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
          )}
        </LayoutBlock>
      ))}
      {!layout.some(b => b.on && LAYOUT_BLOCKS.t2.find(k => k.id === b.id)?.grow) && <div className="flex-1"/>}
    </div>
  );
};

// ==========================================
// 미니 메트로놈 — 튜너 탭에 들어가는 템포 패널 (같은 metro 상태 공유)
// ==========================================
// 우드 계열 템포 패널: 디자인 토큰(SKINS)으로 판·표시등·버튼·숫자·프리셋 모양이 바뀜
const SkinLamp = ({ k, snd, fired, dense }) => {
  // 칸 크기는 고정(박마다 화면이 흔들리지 않게) — 켜질 때는 transform(확대)·빛만 바뀜
  const L = k.lamp, sz = dense ? 16 : 26, box = sz + 8;
  const col = snd === 0 ? 'transparent' : fired ? L.on : snd === 2 ? L.strong : L.off;
  const glow = fired && snd ? `0 0 10px ${L.on}, 0 0 3px ${L.on}` : 'none';
  let inner;
  if (L.shape === 'note') inner = <span style={{ fontFamily: 'Georgia,serif', fontSize: sz + 6, lineHeight: 1, display: 'inline-block',
    transform: `scale(${fired ? 1.45 : 1})`, color: snd === 0 ? L.off : fired ? '#b3261e' : snd === 2 ? L.strong : L.off, transition: 'transform 70ms, color 70ms' }}>♩</span>;
  else if (L.shape === 'diamond') inner = <span style={{ width: sz - 3, height: sz - 3, transform: `rotate(45deg) scale(${fired ? 1.3 : 1})`, background: col, border: `1px solid ${L.border}`, boxShadow: glow, transition: 'all 70ms' }}/>;
  else if (L.shape === 'stud') inner = <span className="rounded-full" style={{ width: sz, height: sz, transform: `scale(${fired ? 1.3 : 1})`, boxShadow: glow, transition: 'all 70ms',
    background: fired || snd === 2 ? `radial-gradient(circle at 35% 30%,#fff3c4,${fired ? '#e8c46a' : '#b88a35'} 60%,#6b4a12)` : L.off, border: `1px solid ${L.border}` }}/>;
  else inner = <span className="rounded-full" style={{ width: sz, height: sz, transform: `scale(${fired ? 1.3 : 1})`, background: col, boxShadow: glow, transition: 'all 70ms', border: snd === 0 ? `1.5px solid ${L.off}` : `1px solid ${L.border}` }}/>;
  return <span className="inline-flex items-center justify-center shrink-0" style={{ width: box, height: box }}>{inner}</span>;
};

// 박이 울릴 때 템포 판 테두리가 빛남 (크기는 그대로 → 화면 안 흔들림). 첫 박은 더 강하게
const beatGlow = (metro, color) => {
  const { isPlayingMetro, visualFlash, currentBeat, beatSounds } = metro;
  if (!isPlayingMetro || visualFlash !== 'main' || beatSounds[currentBeat] === 0) return null;
  const strong = beatSounds[currentBeat] === 2;
  return `0 0 0 ${strong ? 3 : 2}px ${color}, 0 0 ${strong ? 22 : 12}px ${color}`;
};

const SkinPresets = ({ k, bpm, setBpm }) => {
  if (k.presets === 'keys') return (
    <div className="flex h-9 rounded overflow-hidden" style={{ border: '1px solid #333' }}>
      {TEMPO_PRESETS.map(v => (
        <button key={v} onClick={() => { setBpm(v); haptic(8); }} className="flex-1 flex items-end justify-center pb-1 text-[10px] font-black font-mono active:brightness-90"
          style={{ background: bpm === v ? 'linear-gradient(#d9cdb0,#bfb093)' : 'linear-gradient(#fbf7ee,#e9e2d0)', color: '#222', borderRight: '1px solid #999',
            boxShadow: bpm === v ? 'inset 0 3px 6px rgba(0,0,0,.35)' : 'none' }}>{v}</button>
      ))}
    </div>
  );
  const st = {
    stitch: (on) => on ? { background: '#c9a14a', color: '#2a170c', borderRadius: 999 } : { color: '#d9b878', border: '1px dashed rgba(217,184,120,.5)', borderRadius: 999 },
    radio:  (on) => on ? { background: '#f4d78a', color: '#3a2010', borderRadius: 4, fontFamily: 'Georgia,serif' } : { color: '#f4d78a', border: '1px solid rgba(184,138,53,.6)', borderRadius: 4, fontFamily: 'Georgia,serif' },
    ebony:  (on) => on ? { background: '#111', color: '#efe6d0', borderRadius: 999 } : { color: '#2a1205', border: '1px solid rgba(42,18,5,.45)', borderRadius: 999 },
    ink:    (on) => on ? { background: '#1f140a', color: '#efe2c0', borderRadius: 999, fontFamily: 'Georgia,serif' } : { color: '#3a2814', border: '1px solid rgba(58,40,20,.4)', borderRadius: 999, fontFamily: 'Georgia,serif' },
  }[k.presets];
  return (
    <div className="flex items-center gap-1.5">
      {TEMPO_PRESETS.map(v => (
        <button key={v} onClick={() => { setBpm(v); haptic(8); }} className="flex-1 py-1.5 text-[11px] font-black active:scale-95" style={st(bpm === v)}>{v}</button>
      ))}
    </div>
  );
};

// 미니 메트로놈 (튜너 탭 'mini' 블록): 박 원을 가로 가득 크게, 나머지(TAP·−·BPM·+·시작)는 아래 한 줄로 작게. 빠르기 숫자 버튼은 없음
//  우드 계열은 디자인 판·표시등 색, 다크·라이트는 박 색 팔레트
const MiniMetronome = ({ metro }) => {
  const vintage = useVintage(), k = useSkin(), parts = useParts();
  const { bpm, isPlayingMetro, currentBeat, beatSounds, beatSubdivisions, visualFlash, currentSub, timeSig,
          toggleMetronome, handlePressStart, handlePressEnd, tapTempo } = metro;
  const bpmDrag = useBpmDrag(metro);
  const pal = vintage ? METRO_PALETTE.vintage : METRO_PALETTE.tape;
  const press = (d) => ({ onPointerDown: () => handlePressStart(d), onPointerUp: handlePressEnd, onPointerLeave: handlePressEnd });
  const L = vintage ? k.lamp : null;
  const ink = vintage ? k.label : 'var(--ink)', dim = vintage ? k.unit : '#6b7280';
  const knob = vintage ? k.knob : null;
  const glowCol = vintage ? (L.shape === 'note' ? '#b3261e' : L.on) : (beatSounds[currentBeat] === 2 ? '#ffcc00' : '#4afc9d');
  const beatColor = (snd, on) => vintage
    ? (snd === 0 ? 'transparent' : on ? (L.shape === 'note' ? '#b3261e' : L.on) : snd === 2 ? L.strong : L.off)
    : (snd === 0 ? 'transparent' : pal[snd]);
  const small = 'w-8 h-8 rounded-full flex items-center justify-center active:scale-90 shrink-0';
  return (
    <div className={`w-full max-w-sm px-3 pt-3 pb-2 shrink-0 flex flex-col gap-2 rounded-3xl ${vintage ? '' : 't-panel'}`}
      style={{ ...(vintage ? k.frame : {}), transition: 'box-shadow 90ms', boxShadow: beatGlow(metro, glowCol) || (vintage ? k.frame.boxShadow : undefined) }}>
      {/* 박 원: 가로 가득 */}
      <div className="flex justify-center gap-2">
        {beatSounds.map((snd, i) => {
          const on = isPlayingMetro && i === currentBeat, fire = on && visualFlash === 'main', c = beatColor(snd, on), nsub = beatSubdivisions[i] || 1;
          return (
            <div key={i} className="flex flex-col items-center gap-1" style={{ flex: '1 1 0', maxWidth: 64, minWidth: 0 }}>
              <div className="w-full rounded-full flex items-center justify-center font-black" style={{ aspectRatio: '1', background: c,
                border: snd === 0 ? `2px dashed ${dim}` : `3px solid ${on ? ink : 'transparent'}`, opacity: snd === 0 ? 0.4 : on ? 1 : vintage ? 0.75 : 0.3,
                transform: `scale(${fire ? 1.1 : 1})`, boxShadow: fire && snd ? `0 0 ${snd === 2 ? 26 : 16}px ${c}` : 'none', color: '#000', fontSize: 13,
                transition: fire ? 'transform 30ms, box-shadow 30ms' : 'transform 200ms ease-out, box-shadow 250ms, opacity 150ms' }}>{beatSounds.length <= 8 ? i + 1 : ''}</div>
              {nsub > 1 && <div className="flex gap-0.5">{Array.from({ length: nsub }, (_, j) => <i key={j} className="rounded-full" style={{ width: 5, height: 5, background: ink, opacity: on && (currentSub || 0) === j ? 1 : 0.25 }}/>)}</div>}
            </div>
          );
        })}
      </div>
      {/* 작은 조작 줄 */}
      <div className="flex items-center gap-1.5">
        <button onClick={tapTempo} className={`${small} text-[9px] font-black ${vintage ? '' : 't-chip'}`} style={vintage ? { ...k.tap, borderRadius: 999 } : { color: 'var(--ink2)' }}>TAP</button>
        <button {...press(-1)} className={`${small} ${vintage ? '' : 't-chip'}`} aria-label="BPM 내리기" style={{ touchAction: 'none', ...(knob || {}) }}>
          <Minus size={14} className="pointer-events-none" style={{ color: knob ? knob.color : dim }}/>
        </button>
        <div className="flex-1 min-w-0 flex items-baseline justify-center gap-1" {...bpmDrag} aria-label="끌어서 빠르기 조절" style={{ ...bpmDrag.style }}>
          {parts.num !== 'auto'
            ? <PartNumber style={parts.num} text={parts.num === 'flip' || parts.num === 'drum' ? String(bpm).padStart(3, '0') : String(bpm)} size={16} unitColor={dim}/>
            : <span className="font-black leading-none" style={{ fontSize: 20, color: ink, fontFamily: vintage ? 'Georgia,serif' : 'ui-monospace,monospace' }}>{bpm}</span>}
          <span className="text-[9px] font-bold truncate" style={{ color: ink, opacity: 0.6 }}>BPM · {timeSig.num}/{timeSig.den}</span>
        </div>
        <button {...press(1)} className={`${small} ${vintage ? '' : 't-chip'}`} aria-label="BPM 올리기" style={{ touchAction: 'none', ...(knob || {}) }}>
          <Plus size={14} className="pointer-events-none" style={{ color: knob ? knob.color : dim }}/>
        </button>
        <button onClick={toggleMetronome} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95" aria-label={isPlayingMetro ? '메트로놈 정지' : '메트로놈 시작'}
          style={vintage ? { ...(isPlayingMetro ? k.playOn : k.play), borderRadius: 999 }
            : { background: isPlayingMetro ? 'rgba(255,204,0,.15)' : 'rgba(74,252,157,.15)', color: isPlayingMetro ? '#ffcc00' : '#4afc9d', border: `2px solid ${isPlayingMetro ? 'rgba(255,204,0,.4)' : 'rgba(74,252,157,.4)'}` }}>
          {isPlayingMetro ? <Square size={13} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}
        </button>
      </div>
    </div>
  );
};
