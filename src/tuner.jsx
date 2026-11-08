// ==========================================
// tuner — 튜너 탭 (로직 + 화면 + 설정 시트)
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → app)
// ==========================================

const useTunerLogic = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [cents, setCents] = useState(0);
  const [stringCents, setStringCents] = useState(0);
  const [a4Freq, setA4Freq] = usePersistentState('a4Freq', 442, v => v >= 430 && v <= 450);
  const [tolerance, setTolerance] = usePersistentState('tolerance', 10, v => v >= 2 && v <= 30);
  const [currentNote, setCurrentNote] = useState({ name:'A', octave:4, symbol:'' });
  const [closestString, setClosestString] = useState(VIOLIN_STRINGS[2]);
  const [error, setError] = useState(null);
  const [playingTone, setPlayingTone] = useState(null);

  const audioContextRef = useRef(null);
  const analyserRef    = useRef(null);
  const animationRef   = useRef(null);
  const bufferRef      = useRef(null);
  const oscillatorRef  = useRef(null);
  const gainNodeRef    = useRef(null);
  const freqHistoryRef = useRef([]);
  const a4FreqRef      = useRef(a4Freq);
  const streamRef      = useRef(null);
  const settingsRef    = useRef(loadSettings());
  const [settings, setSettingsState] = useState(settingsRef.current);
  const levelRef       = useRef({ db: -100, clarity: 0, freq: -1, gate: false, accepted: false });
  const gateOpenRef    = useRef(false);
  const candidateRef   = useRef({ freq: 0, count: 0 });
  const lastGoodRef    = useRef(0);
  const calibRef       = useRef(null);
  const startingRef    = useRef(null);
  const trackerRef     = useRef(null);
  const practiceSinkRef = useRef(null);
  const [noteListeners] = useState(() => new Set());   // 확정된 음을 받아볼 곳 (지판 스케일 연습)  // 연습 기록(practice.jsx) — app.jsx에서 연결
  const toneGuardRef   = useRef(0);      // 이 시각까지 연주 명령 무시 (기준음 재생 중)
  const toneSemiRef    = useRef(0);      // 재생 중인 기준음 높이 (A4 바꿀 때 따라가게)
  if (!trackerRef.current) trackerRef.current = createNoteTracker();

  const updateSettings = (patch) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    saveSettings(next);
    setSettingsState(next);
  };
  const resetSettings = () => { const c = settingsRef.current; updateSettings({ ...DEFAULT_SETTINGS, design: c.design, uiMode: c.uiMode, onboarded: c.onboarded, tunerLayout: c.tunerLayout, layoutRev: c.layoutRev, layout1: c.layout1, layout2: c.layout2, parts: c.parts }); };

  useEffect(() => {
    if (settingsRef.current.onboarded) ensureMic();    // 처음이면 안내 화면에서 허용받은 뒤 시작
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopTuner();
      else if (settingsRef.current.onboarded) ensureMic();
    };
    const resumeAudio = () => {
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerdown', resumeAudio);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', resumeAudio);
      stopTuner(); stopTone();
    };
  }, []);

  const initAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const toggleTone = async (id, semitonesFromA4) => {
    await initAudioContext();
    if (playingTone === id) { stopTone(); return; }
    stopTone();
    haptic(15);
    toneSemiRef.current = semitonesFromA4;
    const targetFreq = a4FreqRef.current * Math.pow(2, semitonesFromA4 / 12);
    const osc = audioContextRef.current.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(targetFreq, audioContextRef.current.currentTime);
    const filter = audioContextRef.current.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    osc.connect(filter);
    filter.connect(gainNodeRef.current);
    gainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNodeRef.current.gain.linearRampToValueAtTime(0.6, audioContextRef.current.currentTime + 0.1);
    osc.start();
    oscillatorRef.current = osc;
    toneGuardRef.current = Infinity;
    setPlayingTone(id);
  };

  const stopTone = () => {
    if (oscillatorRef.current) {
      const now = audioContextRef.current.currentTime;
      gainNodeRef.current?.gain.linearRampToValueAtTime(0, now + 0.1);
      oscillatorRef.current.stop(now + 0.2);
      oscillatorRef.current = null;
    }
    if (toneGuardRef.current === Infinity) toneGuardRef.current = performance.now() + 600;
    setPlayingTone(null);
  };

  const update = useCallback(() => {
    if (!analyserRef.current) return;
    const S = settingsRef.current;
    const now = performance.now();
    if (isNearMetroClick(now)) {          // 메트로놈 딸깍 소리 구간 → 이번 프레임은 분석 안 함 (상태 유지)
      animationRef.current = requestAnimationFrame(update);
      return;
    }
    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    const { freq: raw, clarity, rms } = detectPitch(bufferRef.current, audioContextRef.current.sampleRate, S.minFreq, S.maxFreq);
    const db = rmsToDb(rms);
    if (calibRef.current) calibRef.current.push(db);

    // 노이즈 게이트 (3dB 히스테리시스: 열릴 땐 임계값, 닫힐 땐 -3dB)
    gateOpenRef.current = gateOpenRef.current ? db > S.gateDb - 3 : db > S.gateDb;

    let accepted = false;
    if (gateOpenRef.current && raw > 0 && clarity >= S.clarity) {
      const c = candidateRef.current;
      if (c.freq && Math.abs(centsBetween(raw, c.freq)) < 50) c.count++;
      else c.count = 1;
      c.freq = raw;

      if (c.count >= S.stableFrames) {
        accepted = true;
        const hist = freqHistoryRef.current;
        const last = hist[hist.length - 1];
        if (last && Math.abs(centsBetween(raw, last)) > 50) hist.length = 0;
        hist.push(raw);
        while (hist.length > S.smoothing) hist.shift();
        const freq = hist.reduce((a, b) => a + b, 0) / hist.length;
        lastGoodRef.current = now;

        const currentA4 = a4FreqRef.current;
        const semitonesFromA4Exact = 12 * Math.log2(freq / currentA4);
        const noteNum = Math.round(semitonesFromA4Exact) + 69;
        const chromaticTargetFreq = currentA4 * Math.pow(2, Math.round(semitonesFromA4Exact) / 12);
        const chromaticCentsOff = Math.round(centsBetween(freq, chromaticTargetFreq));
        let minDiff = Infinity, closestStr = VIOLIN_STRINGS[2];
        VIOLIN_STRINGS.forEach(st => {
          const diff = Math.abs(semitonesFromA4Exact - st.semitone);
          if (diff < minDiff) { minDiff = diff; closestStr = st; }
        });
        const stringTargetFreq = currentA4 * Math.pow(2, closestStr.semitone / 12);
        const strCentsOff = Math.round(centsBetween(freq, stringTargetFreq));
        const noteIndex = (noteNum % 12 + 12) % 12;
        const octave = Math.floor(noteNum / 12) - 1;
        const fullNote = NOTE_NAMES[noteIndex];
        setPitch(freq.toFixed(1));
        setCents(chromaticCentsOff);
        setStringCents(strCentsOff);
        setClosestString(closestStr);
        setCurrentNote({
          name: fullNote.replace('#', ''),
          symbol: fullNote.includes('#') ? '#' : '',
          octave
        });
        if (now > toneGuardRef.current) {
          trackerRef.current.feed(fullNote + octave, now, S);              // 연주 명령 감지
          practiceSinkRef.current?.(fullNote + octave, chromaticCentsOff, now); // 연습 시간 기록
          noteListeners.forEach(f => f(fullNote + octave, chromaticCentsOff, now)); // 지판 스케일 연습 등
        }
      }
    } else {
      candidateRef.current.count = 0;
    }

    if (!accepted) {
      if (lastGoodRef.current && now - lastGoodRef.current > S.holdMs) {
        lastGoodRef.current = 0;
        freqHistoryRef.current = [];
        setPitch(0); setCents(0); setStringCents(0);
      }
    }
    trackerRef.current.tick(now);
    levelRef.current = { db, clarity, freq: raw, gate: gateOpenRef.current, accepted };
    animationRef.current = requestAnimationFrame(update);
  }, []);

  // 마이크 켜기 (이미 켜져 있으면 그대로)
  const ensureMic = async () => {
    if (streamRef.current) return true;
    if (startingRef.current) return startingRef.current;
    setError(null);
    startingRef.current = (async () => { try {
      await initAudioContext();
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("브라우저에서 마이크 기능을 지원하지 않습니다.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:false, autoGainControl:false, noiseSuppression:false }
      });
      streamRef.current = stream;
      if (audioContextRef.current.state==='suspended') await audioContextRef.current.resume();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      bufferRef.current = new Float32Array(analyserRef.current.fftSize);
      audioContextRef.current.createMediaStreamSource(stream).connect(analyserRef.current);
      setIsStarted(true);
      update();
      return true;
    } catch (err) {
      if (err.name==='NotAllowedError'||err.name==='NotFoundError'||err.message.includes('Permission dismissed')) {
        setError("마이크 권한이 거부되었습니다.\n설정 > 앱 > Violin Tuner > 권한에서\n마이크를 허용한 뒤 다시 시도해주세요.");
      } else {
        setError("마이크를 사용할 수 없습니다: "+err.message);
      }
      setIsStarted(false);
      return false;
    } finally { startingRef.current = null; } })();
    return startingRef.current;
  };

  const startTuner = async () => {
    if (streamRef.current) { stopTuner(); return; }
    haptic(20);
    await ensureMic();
  };

  // 주변 소음 측정 → 소음 상위 5% 레벨 + 8dB 를 게이트로 설정
  const calibrateNoise = async (ms = 3000) => {
    if (!(await ensureMic())) return null;
    calibRef.current = [];
    await new Promise(r => setTimeout(r, ms));
    const samples = (calibRef.current || []).sort((a, b) => a - b);
    calibRef.current = null;
    if (!samples.length) return null;
    const noise = samples[Math.floor(samples.length * 0.95)];
    const gate = Math.round(Math.min(-10, Math.max(-80, noise + 8)));
    updateSettings({ gateDb: gate });
    haptic(20);
    return { noise: Math.round(noise), gate };
  };

  const stopTuner = () => {
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current=null; }
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    analyserRef.current=null;
    freqHistoryRef.current=[];
    gateOpenRef.current=false; candidateRef.current={ freq:0, count:0 }; lastGoodRef.current=0;
    levelRef.current={ db:-100, clarity:0, freq:-1, gate:false, accepted:false };
    setIsStarted(false); setPitch(0); setCents(0); setStringCents(0);
  };

  const handleReset = () => {
    stopTone();
    setA4Freq(442); a4FreqRef.current=442;
    setTolerance(10); setClosestString(VIOLIN_STRINGS[2]); setError(null);
    haptic(10);
  };

  const cycleA4Freq = () => {
    setA4Freq(prev => {
      const next = prev >= 443 ? 440 : prev+1;
      a4FreqRef.current=next;
      if (playingTone && oscillatorRef.current && audioContextRef.current) {
        const semitonesFromA4 = toneSemiRef.current;   // 재생 중인 기준음의 A4 기준 반음 (toggleTone에서 기록)
        oscillatorRef.current.frequency.setValueAtTime(
          next*Math.pow(2,semitonesFromA4/12), audioContextRef.current.currentTime
        );
      }
      return next;
    });
    haptic(8);
  };

  const cycleTolerance = () => { setTolerance(prev=>prev>=24?4:prev+2); haptic(8); };

  return {
    isStarted, pitch, cents, stringCents, a4Freq, tolerance,
    currentNote, closestString, error, playingTone,
    startTuner, stopTuner, toggleTone, handleReset, cycleA4Freq, cycleTolerance,
    settings, updateSettings, resetSettings, levelRef, ensureMic, calibrateNoise,
    noteTracker: trackerRef.current, practiceSinkRef, noteListeners
  };
};

// ==========================================
// 1. Tuner Component
// ==========================================
// ==========================================
// 현별 막대: 위 막대 = 높음(#), 아래 막대 = 낮음(♭)
// 비선형(제곱근) 눈금 → 0 근처는 세밀하게, 멀리는 ±350센트까지 넓게
// ==========================================
const OPEN_STRING_COLORS = { G:'#f97316', D:'#eab308', A:'#4afc9d', E:'#38bdf8' };
const BAR_MAX_CENTS = 350;
const BAR_TICKS = [10, 50, 100, 200];
const BAR_H = 'clamp(52px, 13vh, 120px)';
// 막대 크기: 'normal'(고정) | 'fill'(남는 세로 공간 채움) | 'compact'(작게, 템포 패널과 함께)
const barBox = (size) => (
  size === 'fill' ? { flex: '1 1 0', minHeight: 56 }
  : size === 'compact' ? { flex: '1 1 0', minHeight: 44, maxHeight: 130 }   // 남는 공간만큼 늘어나되 최대 130px
  : { height: BAR_H });
const barTicks = (size) => (size === 'compact' ? [10, 50, 100] : BAR_TICKS);

const barPct = (c) => Math.min(100, Math.sqrt(Math.min(Math.abs(c), BAR_MAX_CENTS) / BAR_MAX_CENTS) * 100);

const BarScale = ({ dir, size }) => {
  const vintage = useVintage();
  return (
  <div className="relative w-7" style={barBox(size)}>
    {barTicks(size).map(t => (
      <span key={t} className={`absolute right-0 text-[7px] font-black font-mono leading-none ${vintage?'text-[#f4e3b5]/70':'text-gray-600'}`}
        style={dir === 'up' ? { bottom: `calc(${barPct(t)}% - 3px)` } : { top: `calc(${barPct(t)}% - 3px)` }}>
        {dir === 'up' ? '+' : '−'}{t}
      </span>
    ))}
  </div>
);
};

const StringBar = ({ dir, show, pos, color, tolerance, size }) => {
  const up = dir === 'up';
  const anchor = up ? 'bottom' : 'top';
  return (
    <div className="relative w-[6px] bg-[#141414] rounded-full" style={barBox(size)}>
      {/* 허용 범위(초록) */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[10px] rounded-full bg-[#4afc9d]/25"
        style={{ [anchor]: 0, height: `${barPct(tolerance)}%` }}/>
      {barTicks(size).map(t => (
        <div key={t} className={`absolute left-1/2 -translate-x-1/2 h-[1px] ${t === 100 ? 'w-4 bg-gray-600' : 'w-2.5 bg-gray-800'}`}
          style={{ [anchor]: `${barPct(t)}%` }}/>
      ))}
      {show && (
        <>
          <div className={`absolute left-1/2 -translate-x-1/2 w-full transition-all duration-75 z-10 ${up ? 'rounded-t-sm' : 'rounded-b-sm'}`}
            style={{ [anchor]: 0, height: `${pos}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}` }}/>
          <div className="absolute left-1/2 -translate-x-1/2 w-7 h-[4px] transition-all duration-75 rounded-full z-20"
            style={{ [anchor]: `calc(${pos}% - 1.5px)`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }}/>
        </>
      )}
    </div>
  );
};

const StringBars = ({ tuner, size = 'normal' }) => {
  const fill = size === 'fill' || size === 'compact';
  const vintage = useVintage();
  const { isStarted, pitch, stringCents, tolerance, closestString, playingTone, toggleTone } = tuner;
  return (
    <div className={`flex justify-between w-full max-w-sm pr-2 my-2 ${fill ? 'flex-1 min-h-0 items-stretch' : 'shrink-0 items-center'}`}>
      <div className="flex flex-col items-center justify-center">
        <span className="text-[9px] font-black mb-1 text-red-500/70">♯</span>
        <BarScale dir="up" size={size}/>
        <div className="h-12 my-0.5"/>
        <BarScale dir="down" size={size}/>
        <span className="text-[9px] font-black mt-1 text-blue-500/70">♭</span>
      </div>
      {VIOLIN_STRINGS.map(s => {
        const isClosest = isStarted && pitch>0 && closestString.name===s.name;
        const isPlaying = playingTone===s.name;
        const isPerfect = isClosest && Math.abs(stringCents)<=tolerance;
        const abs = Math.abs(stringCents);
        const activeColor = abs<=tolerance ? '#4afc9d' : abs<=tolerance+30 ? '#ffcc00' : '#ff4d4d';
        const showSharp = isClosest && !isPerfect && stringCents>0;
        const showFlat  = isClosest && !isPerfect && stringCents<0;
        const pos = barPct(stringCents);
        let circleClasses = vintage ? 'bg-[#2a1a0d] border-[#c9a14a]/50 text-[#f4e3b5]' : 'bg-[#1a1a1a] border-gray-600 text-gray-300';
        if (isPlaying)      circleClasses='bg-[#8b5a2b] border-[#e9c46a] text-white scale-110 shadow-[0_0_20px_rgba(233,196,106,0.4)] z-10';
        else if (isPerfect) circleClasses='bg-[#4afc9d] border-[#4afc9d] text-black scale-110 shadow-[0_0_20px_rgba(74,252,157,0.4)] z-10';
        else if (isClosest) circleClasses=(vintage?'bg-[#2a1a0d] text-white':'bg-[#1a1a1a] text-white')+' border-white scale-105 z-10';
        return (
          <div key={s.name} className={`flex flex-col items-center justify-center transition-all duration-300 w-12 ${isClosest||isPlaying?'opacity-100':'opacity-70'}`}>
            <span className={`text-[10px] font-black mb-1 h-3 leading-3 font-mono ${showSharp?'text-red-400':isPerfect?'text-[#4afc9d]':'text-gray-600'}`}>
              {showSharp ? `+${stringCents}` : s.id}
            </span>
            <StringBar dir="up" show={showSharp} pos={pos} color={activeColor} tolerance={tolerance} size={size}/>
            {/* 원 전체(+여백)가 터치 영역 → 기준음 재생/정지 */}
            <button onClick={()=>toggleTone(s.name,s.semitone)} aria-label={`${s.name} 기준음`}
              className="relative my-0.5 p-1.5 -m-1.5 rounded-full active:scale-95 transition-transform">
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base transition-all duration-200 font-black ${circleClasses}`}>
                {s.note}
                <span className="text-[8px] absolute top-3 right-4 opacity-70">{s.octave}</span>
              </div>
              <span className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all z-20 pointer-events-none ${isPlaying?'bg-yellow-500 border-yellow-400 text-black':'bg-[#151515] border-gray-700 text-gray-500'}`}>
                {isPlaying ? <VolumeX size={10}/> : <Volume2 size={10}/>}
              </span>
            </button>
            <StringBar dir="down" show={showFlat} pos={pos} color={activeColor} tolerance={tolerance} size={size}/>
            <span className={`text-[10px] font-black mt-1 h-3 leading-3 font-mono ${showFlat?'text-blue-400':'text-transparent'}`}>
              {showFlat ? stringCents : '0'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 현별 세로 테이프 (A안): 각 현 칸이 위아래로 흐르는 테이프. 위 = 높은 음
// 가장 가까운 현의 테이프만 지금 음정을 따라 움직이고, 나머지는 개방현 음에 멈춰 있음.
// 가운데 가로 바늘에 음 이름이 오면 맞음 → 아래 원이 초록
// ==========================================
const VTAPE_SP = 56;   // 반음 간격(px) → 10센트 ≈ 5.6px

const VTape = ({ center, active, perfect, tolerance, vintage }) => {
  const base = Math.round(center);
  const keys = [];
  for (let k = base - 4; k <= base + 4; k++) keys.push(k);
  const needle = !active ? (vintage ? 'rgba(201,161,74,.45)' : '#3f3f46') : perfect ? '#4afc9d' : '#ef4444';
  return (
    <div className="relative w-full flex-1 min-h-[120px] max-h-[420px] overflow-hidden rounded-xl"
      style={vintage
        ? { background: 'linear-gradient(90deg,#c9c0a8,#f6f1e4 30%,#f6f1e4 70%,#c9c0a8)', border: '3px solid #6b4a12', boxShadow: 'inset 0 3px 8px rgba(0,0,0,.5)' }
        : { background: '#070707', border: '1px solid rgba(255,255,255,.06)' }}>
      {/* 허용 범위 띠 (바늘 주위 고정) */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2"
        style={{ height: Math.max(2, (tolerance * 2 / 100) * VTAPE_SP), background: perfect ? 'rgba(74,252,157,.35)' : (vintage ? 'rgba(90,170,80,.35)' : 'rgba(74,252,157,.12)') }}/>
      {keys.map(k => {
        const idx = ((k + 9) % 12 + 12) % 12, name = NOTE_NAMES[idx], oct = Math.floor((k + 57) / 12);
        const isCur = active && k === base;
        return (
          <div key={k} className="absolute inset-x-0 top-1/2 transition-transform duration-100 ease-out"
            style={{ height: VTAPE_SP, marginTop: -VTAPE_SP / 2, transform: `translateY(${(center - k) * VTAPE_SP}px)` }}>
            {/* 10센트 눈금 (왼쪽) */}
            {Array.from({ length: 10 }, (_, j) => (
              <div key={j} className="absolute left-0" style={{ top: `${j * 10}%`, height: 1,
                width: j === 5 ? 14 : j === 0 ? 0 : 6, background: vintage ? '#3b2a1a' : '#3f3f46', opacity: j === 5 ? 0.9 : 0.6 }}/>
            ))}
            <div className="absolute inset-y-0 left-4 right-1 flex items-center justify-center">
              <span className="font-black leading-none" style={{
                fontSize: 15, fontFamily: vintage ? 'Georgia,serif' : undefined,
                color: vintage ? (isCur ? '#1f2a14' : 'rgba(59,42,26,.55)') : isCur ? (perfect ? '#4afc9d' : '#fff') : active ? '#52525b' : '#2f2f35' }}>
                {name[0]}<span className="text-[10px] align-top">{name[1] === '#' ? '♯' : ''}</span><span className="text-[9px] opacity-60">{oct}</span>
              </span>
            </div>
          </div>
        );
      })}
      {/* 위아래 흐림 */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: vintage
        ? 'linear-gradient(180deg,rgba(40,25,10,.55),transparent 22%,transparent 78%,rgba(40,25,10,.55))'
        : 'linear-gradient(180deg,#000,transparent 25%,transparent 75%,#000)' }}/>
      {/* 바늘 */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2.5px] z-10"
        style={{ background: needle, boxShadow: active ? `0 0 8px ${needle}` : 'none' }}/>
    </div>
  );
};

const StringVTapes = ({ tuner }) => {
  const vintage = useVintage();
  const { isStarted, pitch, a4Freq, stringCents, tolerance, closestString, playingTone, toggleTone } = tuner;
  const live = isStarted && pitch > 0;
  const semi = live ? 12 * Math.log2(pitch / a4Freq) : null;
  return (
    <div className="flex justify-between w-full max-w-sm flex-1 min-h-0 my-2 gap-2.5 px-1">
      {VIOLIN_STRINGS.map(s => {
        const isClosest = live && closestString.name === s.name;
        const isPlaying = playingTone === s.name;
        const perfect = isClosest && Math.abs(stringCents) <= tolerance;
        const centsColor = perfect ? '#4afc9d' : stringCents > 0 ? '#ef4444' : '#3b82f6';
        let circle = vintage ? 'bg-[#2a1a0d] border-[#c9a14a]/50 text-[#f4e3b5]' : 'bg-[#141414] border-gray-600 text-gray-300';
        if (isPlaying) circle = 'bg-[#8b5a2b] border-[#e9c46a] text-white scale-110 shadow-[0_0_20px_rgba(233,196,106,0.4)]';
        else if (perfect) circle = 'bg-[#4afc9d] border-[#4afc9d] text-black scale-110 shadow-[0_0_20px_rgba(74,252,157,0.5)]';
        else if (isClosest) circle = (vintage ? 'bg-[#2a1a0d]' : 'bg-[#141414]') + ' border-white text-white scale-105';
        return (
          <div key={s.name} className={`flex-1 flex flex-col items-center min-h-0 gap-1.5 transition-opacity ${isClosest || isPlaying || !live ? 'opacity-100' : 'opacity-60'}`}>
            <span className="h-4 text-[11px] font-black font-mono leading-4" style={{ color: isClosest ? centsColor : 'transparent' }}>
              {isClosest ? (perfect ? 'OK' : `${stringCents > 0 ? '+' : ''}${stringCents}¢`) : '·'}
            </span>
            <VTape center={isClosest ? semi : isPlaying ? s.semitone : s.semitone} active={isClosest} perfect={perfect} tolerance={tolerance} vintage={vintage}/>
            <button onClick={() => toggleTone(s.name, s.semitone)} aria-label={`${s.name} 기준음`}
              className="relative p-1 rounded-full active:scale-95 transition-transform shrink-0">
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-black transition-all duration-200 ${circle}`}>
                {s.note}<span className="text-[8px] absolute top-3 right-3.5 opacity-70">{s.octave}</span>
              </div>
              <span className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border flex items-center justify-center pointer-events-none ${isPlaying ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-[#151515] border-gray-700 text-gray-500'}`}>
                {isPlaying ? <VolumeX size={10}/> : <Volume2 size={10}/>}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

// 한 줄 표시: LIVE · Hz 숫자 카운터 · 센트 (세로 테이프 구성용)
const TunerReadout = ({ tuner }) => {
  const vintage = useVintage();
  const skin = useSkin();
  const { isStarted, pitch, cents, tolerance, ensureMic } = tuner;
  const live = isStarted && pitch > 0;
  const hz = (pitch > 0 ? Number(pitch) : 0).toFixed(1).padStart(6, '0');
  const col = !live ? (vintage ? 'rgba(244,227,181,.35)' : '#27272a') : Math.abs(cents) <= tolerance ? '#4afc9d' : cents > 0 ? '#ef4444' : '#3b82f6';
  const parts = useParts();
  if (partsCustom(parts)) {
    // 부품별 꾸미기: 판(디자인 기본 / 황동판) + 숫자 모양(플립 카드·크림 창·검은 숫자판·LED)
    const { currentNote } = tuner;
    const brass = parts.plate === 'brass';
    const ns = partNumStyle(parts);
    const ok = live && Math.abs(cents) <= tolerance;
    const ink = brass ? { label: '#3a2410', live: '#1f7a2e', good: '#1f7a2e', off: 'rgba(58,36,16,.45)', unit: '#5a3a1e' }
      : vintage ? { label: skin.label, live: skin.live, good: skin.good, off: skin.unit, unit: skin.unit }
      : { label: 'var(--ink2)', live: '#4afc9d', good: '#4afc9d', off: 'var(--ink-off)', unit: '#6b7280' };
    const cc = !live ? ink.off : ok ? ink.good : cents > 0 ? '#c0392b' : '#2563eb';
    const row = (
      <div className="flex items-center justify-between gap-2 w-full">
        <button onClick={isStarted ? undefined : ensureMic} className="flex items-center gap-1 text-[10px] font-black tracking-widest shrink-0"
          style={{ color: isStarted ? ink.live : '#ef4444' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'animate-pulse' : ''}`} style={{ background: 'currentColor' }}/>{isStarted ? 'LIVE' : 'OFF'}
        </button>
        <span className="flex items-center gap-1.5">
          <span style={{ fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: 12, color: ink.label, minWidth: 22, textAlign: 'right' }}>
            {live ? `${currentNote.name}${currentNote.symbol.replace('#', '♯')}${currentNote.octave}` : ''}
          </span>
          <PartNumber style={ns} text={ns === 'flip' || ns === 'drum' ? hz : (pitch > 0 ? Number(pitch) : 0).toFixed(1)} unit="Hz" size={22} unitColor={ink.unit}/>
        </span>
        <span className="text-xl font-black shrink-0 min-w-[48px] text-right" style={{ color: cc, fontFamily: 'Georgia,serif' }}>
          {live ? (ok ? 'OK' : `${cents > 0 ? '+' : ''}${cents}`) : '0'}<span className="text-[11px]">¢</span>
        </span>
      </div>
    );
    if (brass) return <BrassPlate className="w-full max-w-sm shrink-0 !px-6 !py-2">{row}</BrassPlate>;
    if (vintage) return <div className="w-full max-w-sm shrink-0 rounded-[14px] px-3 py-2" style={skin.frame}>{row}</div>;
    return <div className="w-full max-w-sm shrink-0 t-inset rounded-2xl px-3 py-2">{row}</div>;
  }
  const body = (
    <div className="flex items-center justify-center gap-4">
      <button onClick={isStarted ? undefined : ensureMic} className="flex items-center gap-1 text-[9px] font-black tracking-widest"
        style={{ color: isStarted ? (vintage ? '#1f7a2e' : '#4afc9d') : '#ef4444' }}>
        <span className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'animate-pulse' : ''}`} style={{ background: 'currentColor' }}/>
        {isStarted ? 'LIVE' : 'MIC OFF'}
      </button>
      <DrumDigits text={hz}/>
      <span className="text-xl font-black font-mono min-w-[56px]" style={{ color: vintage && live && Math.abs(cents) <= tolerance ? '#1f7a2e' : col }}>
        {live ? (cents > 0 ? `+${cents}` : cents) : '0'}<span className="text-[10px]">¢</span>
      </span>
    </div>
  );
  if (vintage && !skin.hzDial) {
    // 우드 계열 디자인(피아노·가죽·바이올린·악보): 디자인별 판 + 숫자
    const { currentNote } = tuner;
    const ok = live && Math.abs(cents) <= tolerance;
    const cc = !live ? skin.unit : ok ? skin.good : cents > 0 ? '#c0392b' : '#2563eb';
    return (
      <div className="w-full max-w-sm shrink-0 rounded-[14px] px-3 py-2 flex items-center justify-between gap-2" style={skin.frame}>
        <button onClick={isStarted ? undefined : ensureMic} className="flex items-center gap-1 text-[9px] font-black tracking-widest shrink-0"
          style={{ color: isStarted ? skin.live : '#ef4444' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'animate-pulse' : ''}`} style={{ background: 'currentColor' }}/>{isStarted ? 'LIVE' : 'OFF'}
        </button>
        <span className="flex items-baseline gap-2">
          <span style={{ fontFamily: 'Georgia,serif', fontSize: 13, color: skin.label, fontStyle: skin.italic ? 'italic' : 'normal' }}>
            {live ? `${currentNote.name}${currentNote.symbol.replace('#', '♯')}${currentNote.octave}` : '—'}
          </span>
          <SkinNumber skin={skin} text={live ? Number(pitch).toFixed(1) : '0.0'} unit="Hz" size={26}/>
        </span>
        <span className="text-lg font-black shrink-0 min-w-[46px] text-right" style={{ color: cc, fontFamily: 'Georgia,serif' }}>
          {live ? (ok ? 'OK' : `${cents > 0 ? '+' : ''}${cents}¢`) : '0¢'}
        </span>
      </div>
    );
  }
  if (vintage) {
    // 아르데코 라디오: 갈색 판 + 크림색 Hz 눈금 창 + 빨간 바늘
    const { currentNote } = tuner;
    return (
      <div className="w-full max-w-sm shrink-0 rounded-[14px] px-2.5 py-[7px] flex items-center gap-2" style={RADIO.frame}>
        <button onClick={isStarted ? undefined : ensureMic} className="flex flex-col items-center gap-0.5 shrink-0 w-7"
          style={{ color: isStarted ? '#7fd89c' : '#ef4444' }}>
          <span className={`w-2 h-2 rounded-full ${isStarted ? 'animate-pulse' : ''}`} style={{ background: 'currentColor', boxShadow: isStarted ? '0 0 6px currentColor' : 'none' }}/>
          <span className="text-[7px] font-black tracking-wider">{isStarted ? 'LIVE' : 'OFF'}</span>
        </button>
        <RadioDial hz={Number(pitch) || 0} cents={cents} live={live} tolerance={tolerance}
          label={`${currentNote.name}${currentNote.symbol.replace('#', '♯')}${currentNote.octave}`}/>
      </div>
    );
  }
  return <div className="w-full max-w-sm shrink-0 t-inset rounded-2xl py-2">{body}</div>;
};

// ==========================================
// 하단 음 테이프: 음이름이 적힌 테이프가 좌우로 흐르고 가운데 바늘이 고정
// 왼쪽 = 낮은 음, 오른쪽 = 높은 음. 바늘이 음 이름 오른쪽이면 높음(♯)
// ==========================================
const TAPE_SP = 112;   // 반음 간격(px) → 10센트 ≈ 11px

const NoteTape = ({ tuner, showMic }) => {
  const vintage = useVintage();
  const { isStarted, pitch, a4Freq, cents, tolerance } = tuner;
  const active = isStarted && pitch > 0;
  const semiRef = useRef(0);
  if (active) semiRef.current = 12 * Math.log2(pitch / a4Freq);
  const semi = semiRef.current;
  const base = Math.round(semi);
  const keys = [];
  for (let k = base - 3; k <= base + 3; k++) keys.push(k);
  const inTune = active && Math.abs(cents) <= tolerance;
  const hz = (pitch > 0 ? Number(pitch) : 0).toFixed(1).padStart(6, '0');
  const ink = vintage ? '#3b2a1a' : '#e5e5e5';

  const tape = (
    <div className="relative w-full h-[92px] overflow-hidden rounded-lg"
      style={vintage
        ? { background:'#1d1d1d', border:'3px solid #6b4a12', boxShadow:'inset 0 3px 8px rgba(0,0,0,.8)' }
        : { background:'#050505', border:'1px solid rgba(255,255,255,.06)', boxShadow:'inset 0 2px 15px rgba(0,0,0,1)' }}>
      {/* 눈금 줄 (위) */}
      <div className="absolute inset-x-0 top-0 h-7" style={{ background: vintage ? 'linear-gradient(#3a3a3a,#1f1f1f)' : '#0b0b0b' }}/>
      {/* 허용 범위 밴드 (바늘 주위 고정) */}
      <div className="absolute top-0 h-7 left-1/2 -translate-x-1/2 transition-all"
        style={{ width: `${(tolerance * 2 / 100) * TAPE_SP}px`, background: inTune ? 'rgba(74,252,157,.55)' : (vintage ? 'rgba(90,170,80,.55)' : 'rgba(74,252,157,.18)') }}/>
      {/* 음 이름 종이 띠 (아래) */}
      <div className="absolute inset-x-0 top-7 bottom-0"
        style={{ background: vintage ? 'linear-gradient(180deg,#d8d0bb,#f6f1e4 25%,#f6f1e4 70%,#c9c0a8)' : 'linear-gradient(180deg,#0e0e0e,#141414 50%,#0b0b0b)' }}/>
      {keys.map(k => {
        const idx = ((k + 9) % 12 + 12) % 12;
        const name = NOTE_NAMES[idx];
        const oct = Math.floor((k + 57) / 12);
        const x = (k - semi) * TAPE_SP;
        const isCur = active && k === base;
        return (
          <div key={k} className="absolute top-0 bottom-0 transition-transform duration-100 ease-out"
            style={{ left: '50%', width: TAPE_SP, marginLeft: -TAPE_SP / 2, transform: `translateX(${x}px)` }}>
            {/* 10센트 눈금 */}
            {Array.from({ length: 10 }, (_, j) => (
              <div key={j} className="absolute top-0"
                style={{ left: `${j * 10}%`, width: 1, height: j === 5 ? 18 : j % 5 === 0 ? 14 : 8,
                  background: vintage ? '#e8e8e8' : '#3f3f46', opacity: j === 0 ? 0 : 1 }}/>
            ))}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-6" style={{ background: vintage ? '#fff' : '#a1a1aa' }}/>
            {/* 음 이름 */}
            <div className="absolute left-0 right-0 top-7 bottom-0 flex items-center justify-center">
              <span className="font-black leading-none" style={{
                fontFamily: vintage ? 'Georgia, "Times New Roman", serif' : undefined,
                fontSize: 34, color: vintage ? ink : (isCur ? (inTune ? '#4afc9d' : '#fff') : '#52525b'),
                textShadow: vintage ? '0 1px 0 rgba(255,255,255,.6)' : 'none' }}>
                {name[0]}<sup className="text-lg align-top">{name[1] === '#' ? '♯' : ''}</sup>
                <sub className="text-[11px] opacity-50 align-baseline ml-0.5">{oct}</sub>
              </span>
            </div>
          </div>
        );
      })}
      {/* 양쪽 그림자(원통 느낌) */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: vintage
        ? 'linear-gradient(90deg,rgba(0,0,0,.75),transparent 22%,transparent 78%,rgba(0,0,0,.75))'
        : 'linear-gradient(90deg,#000,transparent 25%,transparent 75%,#000)' }}/>
      {/* 바늘 */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] z-10"
        style={{ background: inTune ? '#4afc9d' : '#e11d2a', boxShadow: `0 0 8px ${inTune ? '#4afc9d' : '#e11d2a'}`, opacity: active ? 1 : 0.35 }}/>
      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 z-10"
        style={{ background: vintage ? '#c9a14a' : '#52525b' }}/>
      <span className="absolute top-1 left-2 text-[9px] font-black z-10" style={{ color: vintage ? '#bbb' : '#52525b' }}>♭ LOW</span>
      <span className="absolute top-1 right-2 text-[9px] font-black z-10" style={{ color: vintage ? '#bbb' : '#52525b' }}>HIGH ♯</span>
    </div>
  );

  const centsText = active ? (cents > 0 ? `+${cents}` : `${cents}`) : '0';
  const centsColor = !active ? (vintage ? '#7a6340' : '#27272a') : inTune ? (vintage ? '#1f7a2e' : '#4afc9d') : cents > 0 ? '#ef4444' : '#3b82f6';
  const footer = (
    <div className="flex items-center justify-center gap-4 mt-2">
      {showMic && (
        <button onClick={isStarted ? undefined : tuner.ensureMic}
          className="flex items-center gap-1 text-[9px] font-black tracking-widest"
          style={{ color: isStarted ? (vintage ? '#1f7a2e' : '#4afc9d') : '#ef4444' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'animate-pulse' : ''}`} style={{ background: 'currentColor' }}/>
          {isStarted ? 'LIVE' : 'MIC OFF'}
        </button>
      )}
      <DrumDigits text={hz}/>
      <div className="flex items-baseline gap-0.5 min-w-[56px]">
        <span className="text-xl font-black font-mono" style={{ color: centsColor }}>{centsText}</span>
        <span className="text-[10px] font-black" style={{ color: vintage ? '#5a4322' : '#52525b' }}>¢</span>
      </div>
    </div>
  );

  if (!vintage) {
    return <div className="w-full max-w-sm shrink-0 mt-2 pb-1">{tape}{footer}</div>;
  }
  return <BrassPlate className="w-full max-w-sm shrink-0 mt-2 mb-1 !px-4 !pt-4">{tape}{footer}</BrassPlate>;
};

// ==========================================
// 감도 설정 시트
// ==========================================
const SliderRow = ({ label, value, display, min, max, step, onChange, hint }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-baseline">
      <span className="text-xs font-bold text-gray-300">{label}</span>
      <span className="text-sm font-mono font-black text-white">{display ?? value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))} className="w-full"/>
    {hint && <span className="text-[10px] text-gray-600 leading-snug">{hint}</span>}
  </div>
);

const LevelMeter = ({ value, min, max, marker, active, format }) => {
  const pct = (v) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  return (
    <div className="relative h-3 w-full bg-[#141414] rounded-full overflow-hidden border border-white/5">
      <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
        style={{ width: pct(value) + '%', background: active ? '#4afc9d' : '#4b5563', boxShadow: active ? '0 0 10px #4afc9d' : 'none' }}/>
      <div className="absolute inset-y-[-2px] w-[2px] bg-white" style={{ left: `calc(${pct(marker)}% - 1px)` }}/>
    </div>
  );
};

const Section = ({ title, children }) => (
  <section className="flex flex-col gap-3 t-inset rounded-2xl p-4">
    <h3 className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">{title}</h3>
    {children}
  </section>
);

// 접히는 묶음: 자주 안 쓰는 세부 설정은 눌러야 보이게
const Fold = ({ label, open, onToggle, children }) => (
  <>
    <button onClick={() => { onToggle(); haptic(6); }}
      className="flex items-center justify-between w-full py-1 text-xs font-bold text-gray-400 active:opacity-60">
      <span>{label}</span>
      <span className="text-[10px] text-gray-500">{open ? '접기 ▲' : '펼치기 ▼'}</span>
    </button>
    {open && <div className="flex flex-col gap-3">{children}</div>}
  </>
);

// 백업: 'vt.' 저장값 전부를 JSON 파일 하나로 (안드로이드: 저장 위치 선택 창)
const backupFileName = (d = new Date()) =>
  `violin-tuner-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
const buildBackup = () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('vt.')) data[k] = localStorage.getItem(k); }
  return { app: 'violin-tuner', version: 1, exportedAt: new Date().toISOString(), data };
};
const parseBackup = (text) => {
  let b; try { b = JSON.parse(text); } catch (_) { throw new Error('JSON 파일이 아닙니다.'); }
  if (!b || b.app !== 'violin-tuner' || b.version !== 1 || typeof b.data !== 'object') throw new Error('Violin Tuner 백업 파일이 아닙니다.');
  for (const [k, v] of Object.entries(b.data)) if (!k.startsWith('vt.') || typeof v !== 'string') throw new Error(`잘못된 항목: ${k}`);
  return b;
};

const BackupSection = () => {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null);
  const exportNow = () => {
    haptic(10);
    const json = JSON.stringify(buildBackup(), null, 1), name = backupFileName();
    if (window.VTNative) {
      window.__vtSaved = (ok) => setMsg(ok ? { ok: true, text: '백업 파일을 저장했습니다.' } : { ok: false, text: '저장을 취소했습니다.' });
      window.VTNative.saveFile(name, json);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
      setMsg({ ok: true, text: `${name} 다운로드` });
    }
  };
  const onFile = async (f) => {
    if (!f) return;
    try { setPending(parseBackup(await f.text())); setMsg(null); } catch (e) { setMsg({ ok: false, text: e.message }); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const apply = () => {
    VT_STORAGE.locked = true;     // 새로고침 직전 메모리의 옛 값이 덮어쓰지 않게
    const old = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('vt.')) old.push(k); }
    old.forEach(k => localStorage.removeItem(k));
    Object.entries(pending.data).forEach(([k, v]) => localStorage.setItem(k, v));
    location.reload();
  };
  return (
    <>
      <div className="flex gap-2">
        <button onClick={exportNow} className="flex-1 t-chip rounded-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 text-gray-300"><Download size={14} className="text-[#4afc9d]"/>내보내기</button>
        <button onClick={() => fileRef.current?.click()} className="flex-1 t-chip rounded-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 text-gray-300"><Upload size={14} className="text-[#4afc9d]"/>가져오기</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => onFile(e.target.files?.[0])}/>
      </div>
      {pending && (
        <div className="t-card rounded-xl p-3 flex flex-col gap-2">
          <p className="text-xs text-gray-300"><b>{new Date(pending.exportedAt).toLocaleString('ko-KR')}</b> 백업으로 <b className="text-[#ef4444]">지금 설정과 기록을 모두 바꿉니다.</b></p>
          <div className="flex gap-2">
            <button onClick={() => setPending(null)} className="flex-1 t-chip rounded-full py-2 text-xs font-bold text-gray-300">취소</button>
            <button onClick={apply} className="flex-1 py-2 rounded-full bg-[#ef4444] text-white text-xs font-black">바꾸기</button>
          </div>
        </div>
      )}
      {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-[#4afc9d]' : 'text-[#ef4444]'}`}>{msg.text}</p>}
      <p className="text-[10px] text-gray-500 leading-snug">설정 · 템포 · 드론 · 연습 기록을 파일 하나로 저장합니다. 폰을 바꾸거나 앱을 다시 설치할 때 가져오세요.</p>
    </>
  );
};

// ── 세부 꾸미기: 숫자 모양 · 판 모양 (디자인 위에 덮어씀) ──
const PartsEditor = ({ parts, onChange }) => {
  const Opt = ({ on, onClick, children }) => (
    <button onClick={() => { onClick(); haptic(8); }}
      className="rounded-xl p-1.5 flex flex-col items-center justify-center gap-1 border-2 transition-all active:scale-95 min-h-[58px]"
      style={{ borderColor: on ? 'var(--accent)' : 'var(--chip-border)', background: 'rgba(0,0,0,.25)' }}>
      {children}
    </button>
  );
  const label = (t, on) => <span className="text-[10px] font-black" style={{ color: on ? 'var(--accent)' : 'var(--ink2)' }}>{t}</span>;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[10px] font-bold text-gray-500 mb-1.5">숫자 모양 (Hz · BPM)</div>
        <div className="grid grid-cols-3 gap-2">
          {PART_NUM_STYLES.map(o => (
            <Opt key={o.id} on={parts.num === o.id} onClick={() => onChange({ num: o.id })}>
              {o.id === 'auto' ? <span className="text-lg leading-none" style={{ color: 'var(--ink2)' }}>A</span> : <PartNumber style={o.id} text={o.id === 'flip' || o.id === 'drum' ? '092' : '92'} size={15}/>}
              {label(o.name, parts.num === o.id)}
            </Opt>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-bold text-gray-500 mb-1.5">판 모양 (숫자창 · 다이얼 가운데)</div>
        <div className="grid grid-cols-2 gap-2">
          {PART_PLATE_STYLES.map(o => (
            <Opt key={o.id} on={parts.plate === o.id} onClick={() => onChange({ plate: o.id })}>
              {o.id === 'brass'
                ? <BrassPlate className="!px-4 !py-1 !rounded-xl"><PartNumber style={partNumStyle({ ...parts, plate: 'brass' })} text="092" size={12}/></BrassPlate>
                : <span className="text-[10px]" style={{ color: 'var(--ink2)' }}>디자인 그대로</span>}
              {label(o.name, parts.plate === o.id)}
            </Opt>
          ))}
        </div>
      </div>
      {partsCustom(parts) && <button onClick={() => { onChange({ num: 'auto', plate: 'auto' }); haptic(8); }} className="self-start text-[11px] font-bold text-gray-400">↺ 디자인 기본으로</button>}
    </div>
  );
};

// ── 화면 배치: 탭별 블록을 손잡이(⋮⋮)로 끌어 위아래 이동 · 크기 · 보이기 ──
const SIZE_NAMES = { s: '작게', m: '보통', l: '크게' };
const LayoutEditor = ({ S, updateSettings }) => {
  const [tab, setTab] = useState('t1');
  const key = tab === 't1' ? 'layout1' : 'layout2';
  const list = S[key];
  const listRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const listNow = useRef(list); listNow.current = list;
  const save = (l) => updateSettings({ [key]: l });
  const meta = (id) => LAYOUT_BLOCKS[tab].find(b => b.id === id);
  const patch = (id, p) => save(list.map(b => b.id === id ? { ...b, ...p } : b));
  const move = (from, to) => { const l = [...listNow.current]; const [it] = l.splice(from, 1); l.splice(to, 0, it); save(l); };

  // 끌기: 손가락이 다른 줄의 가운데를 넘으면 그 자리로 이동
  const onDown = (e, id) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} setDragId(id); haptic(12); };
  const onMove = (e) => {
    if (!dragId || !listRef.current) return;
    const rows = [...listRef.current.children];
    const from = listNow.current.findIndex(b => b.id === dragId);
    let to = from;
    rows.forEach((r, i) => { const rc = r.getBoundingClientRect(); if (e.clientY > rc.top && e.clientY < rc.bottom) to = i; });
    if (to !== from) { move(from, to); haptic(6); }
  };
  const onUp = () => setDragId(null);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1 p-1 rounded-full t-chip">
        {[['t1', '튜너 탭'], ['t2', '메트로놈 탭']].map(([id, name]) => (
          <button key={id} onClick={() => { setTab(id); haptic(6); }} className="flex-1 py-1.5 rounded-full text-xs font-black transition-all"
            style={tab === id ? { background: 'var(--accent)', color: '#000' } : { color: 'var(--ink2)' }}>{name}</button>
        ))}
      </div>
      {tab === 't1' && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {LAYOUT_PRESETS.map(p => (
            <button key={p.id} onClick={() => { save(makeLayout('t1', p.on)); haptic(8); }}
              className="shrink-0 px-2.5 py-1 rounded-full t-chip text-[10px] font-bold" style={{ color: 'var(--ink2)' }}>{p.name}</button>
          ))}
        </div>
      )}
      <div ref={listRef} className="flex flex-col gap-1.5" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {list.map(b => {
          const m = meta(b.id), drag = dragId === b.id;
          return (
            <div key={b.id} className="flex items-center gap-1.5 rounded-xl pr-1.5 transition-shadow"
              style={{ background: drag ? 'rgba(74,252,157,.12)' : 'rgba(0,0,0,.25)', border: `1px solid ${drag ? 'var(--accent)' : 'var(--chip-border)'}`,
                boxShadow: drag ? '0 6px 16px rgba(0,0,0,.5)' : 'none', opacity: b.on ? 1 : 0.5 }}>
              <span onPointerDown={e => onDown(e, b.id)} className="w-9 h-11 flex items-center justify-center shrink-0 cursor-grab" style={{ touchAction: 'none', color: 'var(--ink2)' }} aria-label="끌어서 옮기기">
                <GripVertical size={18}/>
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-xs font-black truncate" style={{ color: 'var(--ink)' }}>{m.name}</span>
                <span className="text-[9px] text-gray-500">{m.grow ? '남는 공간 채움' : '고정 높이'}</span>
              </span>
              <span className="flex rounded-full overflow-hidden shrink-0" style={{ border: '1px solid var(--chip-border)' }}>
                {LAYOUT_SIZES.map(z => (
                  <button key={z} disabled={!b.on} onClick={() => { patch(b.id, { size: z }); haptic(6); }}
                    className="px-1.5 py-1 text-[10px] font-black"
                    style={b.size === z ? { background: 'var(--accent)', color: '#000' } : { color: 'var(--ink2)' }}>{SIZE_NAMES[z]}</button>
                ))}
              </span>
              <button disabled={m.lock} onClick={() => { patch(b.id, { on: !b.on }); haptic(8); }}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" aria-label={b.on ? '숨기기' : '보이기'}
                style={{ color: m.lock ? 'var(--ink-off)' : b.on ? 'var(--accent)' : 'var(--ink2)' }}>
                {b.on ? <Eye size={17}/> : <EyeOff size={17}/>}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-500">⋮⋮ 를 누른 채 위아래로 끌어 순서를 바꿉니다</span>
        <button onClick={() => { save(tab === 't1' ? makeLayout('t1', LAYOUT_PRESETS[0].on) : makeLayout('t2', DEFAULT_LAYOUT2_ON)); haptic(8); }}
          className="text-[11px] font-bold text-gray-400 shrink-0">↺ 기본 배치</button>
      </div>
    </div>
  );
};

const SettingsSheet = ({ tuner, onClose }) => {
  const { settings: S, updateSettings, resetSettings, levelRef, isStarted, ensureMic, calibrateNoise, noteTracker } = tuner;
  const [lv, setLv] = useState(levelRef.current);
  const [calib, setCalib] = useState(null);   // null | {running, left} | {noise, gate}
  const [cmd, setCmd] = useState({ recording: null, events: [] });   // 연주 명령 상태 표시용
  const [recMsg, setRecMsg] = useState(null);
  const [open, setOpen] = useState({});   // 접힌 묶음 펼침 상태

  // 패턴 녹음 완료 → 저장
  useEffect(() => {
    noteTracker.state.onRecorded = (p) => {
      if (p) { updateSettings({ cmdPattern: p, cmdEnabled: true }); setRecMsg(`패턴 저장됨 (${p.length}음)`); haptic(30); }
      else { setRecMsg(`음이 ${CMD_PATTERN_MIN}개 이상 필요합니다. 다시 녹음해주세요.`); haptic(80); }
    };
    return () => { noteTracker.state.onRecorded = null; noteTracker.cancelRecording(); };
  }, []);

  useEffect(() => {
    let raf, last = 0;
    const tick = (t) => {
      if (t - last > 50) {
        setLv({ ...levelRef.current });
        const st = noteTracker.state;
        const rec = st.recording;
        setCmd({
          recording: rec ? { notes: [...rec.notes], left: rec.start === null ? null : Math.max(0, rec.windowMs - (performance.now() - rec.start)) } : null,
          events: st.events.slice(-6).map(e => e.note),
        });
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const runCalib = async () => {
    const total = 3000, started = Date.now();
    setCalib({ running: true, left: 3 });
    const iv = setInterval(() => setCalib({ running: true, left: Math.max(0, Math.ceil((total - (Date.now() - started)) / 1000)) }), 200);
    const res = await calibrateNoise(total);
    clearInterval(iv);
    setCalib(res || null);
  };

  const db = Math.max(-80, lv.db);
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-h-[92%] overflow-y-auto t-sheet rounded-t-[2rem] px-4 pt-3 pb-6 flex flex-col gap-3 shadow-[0_-20px_60px_rgba(0,0,0,0.9)]"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-700 rounded-full self-center mb-1"/>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-[#4afc9d]"/>
            <span className="text-base font-black">설정</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full t-chip text-gray-400"><X size={14}/></button>
        </div>

        <Section title="① 디자인">
          <DesignPicker value={S.design} onChange={d => updateSettings({ design: d.id, uiMode: d.base })}/>
          <Fold label={`세부 꾸미기${partsCustom(S.parts) ? ' · 사용 중' : ''} (숫자 · 판 모양)`} open={open.parts} onToggle={() => setOpen(o => ({ ...o, parts: !o.parts }))}>
            <PartsEditor parts={S.parts} onChange={p => updateSettings({ parts: { ...S.parts, ...p } })}/>
          </Fold>
        </Section>

        <Section title="② 화면 배치">
          <LayoutEditor S={S} updateSettings={updateSettings}/>
        </Section>

        <Section title="③ 소리 감지">
          {!isStarted ? (
            <button onClick={ensureMic}
              className="flex items-center justify-center gap-2 py-3 rounded-full bg-[#4afc9d]/10 border border-[#4afc9d]/30 text-[#4afc9d] text-sm font-bold">
              <Mic size={15}/> 마이크 켜고 테스트
            </button>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-gray-500">입력 레벨</span>
                  <span className="font-mono text-gray-300">{db.toFixed(0)} dB</span>
                </div>
                <LevelMeter value={db} min={-80} max={0} marker={S.gateDb} active={lv.gate}/>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${lv.gate ? 'bg-[#4afc9d]/15 text-[#4afc9d]' : 'bg-gray-800 text-gray-500'}`}>
                    게이트 {lv.gate ? '열림' : '닫힘'}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${lv.accepted ? 'bg-[#4afc9d]/15 text-[#4afc9d]' : 'bg-gray-800 text-gray-500'}`}>
                    {lv.accepted ? `감지 ✓ ${lv.freq.toFixed(1)}Hz` : '감지 안 함'}
                  </span>
                </div>
              </div>
              <button onClick={runCalib} disabled={calib?.running}
                className="flex items-center justify-center gap-2 py-3 rounded-full bg-[#1a1a1a] border border-gray-700 text-white text-sm font-bold active:scale-95 disabled:opacity-60">
                <AudioWaveform size={15} className="text-[#4afc9d]"/>
                {calib?.running ? `조용히 해주세요… ${calib.left}초` : '주변 소음 자동 측정 (3초)'}
              </button>
              {calib && !calib.running && (
                <span className="text-[11px] text-[#4afc9d] text-center font-bold">
                  소음 {calib.noise} dB → 임계값 {calib.gate} dB 로 설정됨
                </span>
              )}
            </>
          )}
          <Fold label="세부 조절 (소음 · 신뢰도 · 안정화)" open={open.sense} onToggle={() => setOpen(o => ({ ...o, sense: !o.sense }))}>
          <SliderRow label="소음 차단 임계값" value={S.gateDb} display={`${S.gateDb} dB`} min={-80} max={-10} step={1}
            onChange={v => updateSettings({ gateDb: v })}
            hint="흰 선보다 큰 소리만 분석합니다. 잡음에 반응하면 오른쪽으로, 약한 소리를 못 잡으면 왼쪽으로."/>

          {isStarted && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-500">현재 신뢰도</span>
                <span className="font-mono text-gray-300">{lv.clarity.toFixed(2)}</span>
              </div>
              <LevelMeter value={lv.clarity} min={0.5} max={1} marker={S.clarity} active={lv.clarity >= S.clarity && lv.gate}/>
            </div>
          )}
          <SliderRow label="최소 신뢰도" value={S.clarity} display={S.clarity.toFixed(2)} min={0.7} max={0.98} step={0.01}
            onChange={v => updateSettings({ clarity: v })}
            hint="소리가 얼마나 '음정다운지'. 잡음·말소리는 낮고 현 소리는 0.9 이상. 높일수록 잡음에 강해집니다."/>

          <SliderRow label="확정 프레임" value={S.stableFrames} display={`${S.stableFrames}프레임 · ${Math.round(S.stableFrames * 16.7)}ms`} min={1} max={10} step={1}
            onChange={v => updateSettings({ stableFrames: v })}
            hint="같은 음이 이만큼 연속돼야 표시. 순간 잡음으로 튀는 걸 막습니다."/>
          <SliderRow label="평균 프레임" value={S.smoothing} display={`${S.smoothing}`} min={1} max={15} step={1}
            onChange={v => updateSettings({ smoothing: v })}
            hint="클수록 바늘이 부드럽게, 작을수록 빠르게 움직입니다."/>
          <SliderRow label="표시 유지 시간" value={S.holdMs} display={`${S.holdMs}ms`} min={0} max={1500} step={50}
            onChange={v => updateSettings({ holdMs: v })}
            hint="소리가 끊긴 뒤 마지막 음을 보여주는 시간."/>
          <SliderRow label="최저 주파수" value={S.minFreq} display={`${S.minFreq} Hz`} min={60} max={300} step={5}
            onChange={v => updateSettings({ minFreq: v })}
            hint="바이올린 최저음 G3 = 196Hz. 180Hz면 저음 웅웅거림을 걸러냅니다."/>
          <SliderRow label="최고 주파수" value={S.maxFreq} display={`${S.maxFreq} Hz`} min={1000} max={5000} step={100}
            onChange={v => updateSettings({ maxFreq: v })}/>
          </Fold>
        </Section>

        <Section title="④ 연주 명령">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-300">음 패턴으로 메트로놈 켜기/끄기</span>
              <span className="text-[10px] text-gray-600">켜지면 메트로놈 탭으로 이동</span>
            </div>
            <button onClick={() => { updateSettings({ cmdEnabled: !S.cmdEnabled }); haptic(8); }}
              className={`w-12 h-7 rounded-full p-1 transition-colors ${S.cmdEnabled ? 'bg-[#4afc9d]' : 'bg-gray-700'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${S.cmdEnabled ? 'translate-x-5' : ''}`}/>
            </button>
          </div>

          <div className="flex flex-col items-center gap-2 py-1">
            <div className="flex items-center justify-center gap-1.5 flex-wrap min-h-[38px]">
              {(() => {
                const rec = cmd.recording;
                const notes = rec ? rec.notes : S.cmdPattern;
                if (rec && !notes.length) return <span className="text-xs font-bold text-[#ffcc00] animate-pulse">첫 음을 연주하면 녹음이 시작됩니다</span>;
                return notes.map((n, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-gray-600 text-xs">→</span>}
                    <span className={`min-w-[44px] text-center px-2 py-1.5 rounded-xl font-mono font-black text-sm border-2 ${
                      rec ? 'border-[#ffcc00] text-[#ffcc00] bg-[#ffcc00]/10'
                      : S.cmdEnabled ? 'border-[#4afc9d]/60 text-[#4afc9d] bg-[#4afc9d]/10' : 'border-gray-700 text-gray-500'}`}>
                      {n}
                    </span>
                  </React.Fragment>
                ));
              })()}
            </div>
            {cmd.recording && cmd.recording.left !== null && (
              <div className="w-full flex flex-col gap-1">
                <div className="h-1.5 w-full bg-[#141414] rounded-full overflow-hidden">
                  <div className="h-full bg-[#ffcc00]" style={{ width: `${(cmd.recording.left / S.cmdWindowMs) * 100}%` }}/>
                </div>
                <span className="text-[11px] font-bold text-[#ffcc00] text-center">녹음 중… {(cmd.recording.left / 1000).toFixed(1)}초 남음 · {cmd.recording.notes.length}/{CMD_PATTERN_MAX}음</span>
              </div>
            )}
            {!cmd.recording && recMsg && <span className="text-[11px] font-bold text-[#4afc9d]">{recMsg}</span>}
          </div>

          <Fold label="패턴 바꾸기 · 제한 시간" open={open.cmd || !!cmd.recording} onToggle={() => setOpen(o => ({ ...o, cmd: !o.cmd }))}>
          <div className="flex gap-2">
            {cmd.recording ? (
              <button onClick={() => { noteTracker.cancelRecording(); haptic(8); }}
                className="flex-1 py-2.5 rounded-full t-chip text-gray-300 text-xs font-bold">녹음 취소</button>
            ) : (
              <button onClick={async () => { if (await ensureMic()) { setRecMsg(null); noteTracker.startRecording(S.cmdWindowMs); haptic(15); } }}
                className="flex-1 py-2.5 rounded-full bg-[#ffcc00]/10 border border-[#ffcc00]/40 text-[#ffcc00] text-xs font-bold">● 패턴 녹음</button>
            )}
            <button onClick={() => { updateSettings({ cmdPattern: DEFAULT_CMD_PATTERN }); haptic(8); }}
              className="flex-1 py-2.5 rounded-full t-chip text-gray-300 text-xs font-bold">기본 (G3→E5→G3)</button>
          </div>

          <SliderRow label="제한 시간" value={S.cmdWindowMs} display={`${(S.cmdWindowMs / 1000).toFixed(1)}초`} min={1500} max={5000} step={500}
            onChange={v => updateSettings({ cmdWindowMs: v })}
            hint={`녹음: 첫 음부터 이 시간 동안 연주한 음(${CMD_PATTERN_MIN}~${CMD_PATTERN_MAX}개)이 패턴이 됩니다. 실행할 때도 이 시간 안에 연주해야 합니다. 각 음은 0.15초 이상 유지. 같은 패턴을 다시 연주하면 정지.`}/>

          {isStarted && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-500 font-bold">최근 인식:</span>
              {cmd.events.length ? cmd.events.map((n, i) => (
                <span key={i} className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{n}</span>
              )) : <span className="text-[10px] text-gray-700">—</span>}
            </div>
          )}
          <span className="text-[10px] text-gray-600 leading-snug">
            튜닝할 때 자주 켜는 인접 현(G→D, A→E)은 피하고, G→E→G처럼 현을 건너뛰는 패턴을 추천합니다.
          </span>
          </Fold>
        </Section>

        <Section title="⑤ 백업 · 정보">
          <Fold label="백업 내보내기 · 가져오기, 앱 정보" open={open.misc} onToggle={() => setOpen(o => ({ ...o, misc: !o.misc }))}>
            <BackupSection/>
            <p className="text-xs text-gray-500 leading-relaxed">Violin Tuner — 모든 기록은 이 폰 안에만 저장됩니다.</p>
            <button onClick={() => { updateSettings({ onboarded: false }); onClose(); }} className="self-start text-xs font-bold text-[#4afc9d]">처음 안내 다시 보기</button>
          </Fold>
        </Section>

        <div className="flex gap-3 mt-1">
          <button onClick={() => { resetSettings(); setCalib(null); haptic(10); }}
            className="flex-1 py-3 rounded-full bg-[#1a1a1a] border border-gray-700 text-gray-300 text-sm font-bold">기본값</button>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-full bg-[#4afc9d] text-black text-sm font-black">완료</button>
        </div>
      </div>
    </div>
  );
};

// 큰 음이름 판 (화면 배치 'note' 블록)
const BigNote = ({ tuner, showCents }) => {
  const { isStarted, pitch, cents, tolerance, currentNote, playingTone, ensureMic } = tuner;
  const getStatusColor = () => {
    if (!isStarted || pitch===0) return '#1a1a1a';
    if (Math.abs(cents)<=tolerance) return '#4afc9d';
    if (Math.abs(cents)<=tolerance+15) return '#ffcc00';
    return '#ff4d4d';
  };
  return (
      <div className="flex flex-col items-center justify-center w-full max-w-sm relative flex-1 min-h-0">
        <div className={`w-full h-full max-h-[360px] rounded-[2.5rem] t-panel shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center relative py-4`}>
          {/* Mic status */}
          <div className="absolute top-4 left-4 flex flex-col items-center gap-1 z-10">
            <button onClick={isStarted ? undefined : ensureMic} disabled={isStarted}
              className={`w-11 h-11 rounded-full flex items-center justify-center border-[3px] transition-all duration-300 ${isStarted?'bg-[#4afc9d]/5 border-[#4afc9d]/20 text-[#4afc9d]':'bg-red-900/20 border-red-700/50 text-red-500 active:scale-90'}`}>
              <Mic size={16}/>
            </button>
            <span className="text-[9px] font-black tracking-widest mt-0.5 uppercase flex items-center gap-1"
              style={{color:isStarted?'#4afc9d':'#ef4444'}}>
              {isStarted && <span className="w-1.5 h-1.5 rounded-full bg-[#4afc9d] animate-pulse"/>}
              {isStarted?'LIVE':'MIC OFF'}
            </span>
          </div>
          {/* Status indicator */}
          <div className="absolute top-4 right-4 flex flex-col items-center gap-1 z-10">
            <div className="w-11 h-11 rounded-full transition-all duration-300 border-[3px] border-black shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]"
              style={{backgroundColor:getStatusColor(),boxShadow:isStarted&&pitch>0?`0 0 30px ${getStatusColor()},inset 0 0 10px rgba(0,0,0,0.8)`:'none'}}/>
            <span className="text-[9px] font-black tracking-widest mt-0.5 uppercase transition-colors duration-300"
              style={{color:!isStarted?'#444':Math.abs(cents)<=tolerance?'#4afc9d':'#888'}}>
              {!isStarted?'OFF':Math.abs(cents)<=tolerance?'PERFECT':'TUNE'}
            </span>
          </div>
          {/* Note display */}
          <div className="flex flex-col items-center justify-center mt-6">
            <div className="flex items-start">
              <span className="text-[84px] font-black leading-none tracking-tighter"
                style={{color:(isStarted&&pitch>0)||playingTone?'var(--ink)':'var(--ink-off)'}}>
                {playingTone ? playingTone.replace(/[0-9]/,'') : (isStarted&&pitch>0?currentNote.name:'A')}
              </span>
              <div className="flex flex-col mt-2 ml-2">
                <span className="text-4xl font-bold text-[#4afc9d] leading-none mb-1">
                  {isStarted&&pitch>0?currentNote.symbol:(playingTone&&playingTone.includes('#')?'#':'')}
                </span>
                <span className="text-3xl font-bold text-gray-700 leading-none mt-1">
                  {isStarted&&pitch>0?currentNote.octave:(playingTone?playingTone.match(/[0-9]/)[0]:'4')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="text-sm font-mono tracking-[0.4em] text-gray-500 bg-black/60 px-4 py-1.5 rounded-xl border border-white/5">
                {pitch>0?`${pitch} Hz`:'000.0 Hz'}
              </div>
              {showCents && (
                <span className={`text-lg font-black font-mono ${isStarted&&pitch>0?(Math.abs(cents)<=tolerance?'text-[#4afc9d]':cents>0?'text-red-500':'text-blue-500'):'text-gray-800'}`}>
                  {isStarted&&pitch>0?(cents>0?`+${cents}`:cents):'0'}¢
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

const Tuner = ({ tuner, metro }) => {
  const {
    isStarted, pitch, cents, stringCents, a4Freq, tolerance,
    currentNote, closestString, error, playingTone,
    ensureMic, handleReset, cycleA4Freq, cycleTolerance, toggleTone
  } = tuner;
  const [showSettings, setShowSettings] = useState(false);
  const blocks = visibleBlocks('t1', tuner.settings.layout1);
  const has = (id) => blocks.some(b => b.id === id);

  return (
    <div className="w-full h-full flex flex-col items-center relative justify-between tab-enter">
      {/* Top controls */}
      <div className="w-full flex justify-between items-center h-10 shrink-0 max-w-sm">
        <div className="flex gap-2">
          <button onClick={cycleA4Freq}
            className="flex items-center gap-1.5 t-chip px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-transform shadow-md">
            <span className="text-gray-400">A4=</span>
            <span className="text-white font-mono text-sm w-7 text-left">{a4Freq}</span>
          </button>
          <button onClick={cycleTolerance}
            className="flex items-center gap-1.5 t-chip px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-transform shadow-md">
            <div className="w-2 h-2 rounded-full bg-[#4afc9d] shadow-[0_0_6px_#4afc9d]"/>
            <span className="text-gray-400">범위</span>
            <span className="text-white font-mono text-sm w-7 text-left">±{tolerance}</span>
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowSettings(true); haptic(8); }}
            className="flex items-center gap-1.5 t-chip px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-transform shadow-md text-gray-300">
            <SlidersHorizontal size={13} className="text-[#4afc9d]"/> 설정
          </button>
          <button onClick={handleReset}
            className="text-gray-400 active:rotate-180 transition-all duration-500 t-chip p-2 rounded-full shadow-md">
            <RotateCcw size={14}/>
          </button>
        </div>
      </div>

      {/* 화면 배치 (설정 → 화면 배치): 켜진 블록을 순서대로 */}
      <div className="w-full flex-1 min-h-0 flex flex-col items-center gap-2 pt-1">
        {blocks.map(b => (
          <LayoutBlock key={b.id} grow={b.grow} size={b.size}>
            {b.id === 'vtapes' && <StringVTapes tuner={tuner}/>}
            {b.id === 'bars' && <StringBars tuner={tuner} size="fill"/>}
            {b.id === 'note' && <BigNote tuner={tuner} showCents={!has('tape')}/>}
            {b.id === 'readout' && <TunerReadout tuner={tuner}/>}
            {b.id === 'tape' && <NoteTape tuner={tuner} showMic={!has('readout') && !has('note')}/>}
            {b.id === 'mini' && <MiniMetronome metro={metro}/>}
          </LayoutBlock>
        ))}
        {!blocks.some(b => b.grow) && <div className="flex-1"/>}
      </div>

      {showSettings && <SettingsSheet tuner={tuner} onClose={() => setShowSettings(false)}/>}

      {/* Error modal */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm rounded-[2.5rem]">
          <div className="w-[85%] bg-gray-900/95 p-6 rounded-3xl flex flex-col items-center gap-4 border border-gray-700 shadow-2xl">
            <AlertCircle size={36} className="text-red-400"/>
            <p className="text-sm text-center text-white font-bold leading-relaxed whitespace-pre-line">{error}</p>
            <div className="flex gap-3 mt-2 w-full">
              <button onClick={handleReset} className="flex-1 py-3 bg-gray-800 text-white text-sm font-bold rounded-full border border-gray-600">닫기</button>
              <button onClick={ensureMic} className="flex-1 py-3 bg-[#4afc9d] text-black text-sm font-bold rounded-full">다시 시도</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
