// ==========================================
// fingerboard — 지판 탭 (v2 디자인)
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
//  - 조표별 음 표시, 지금 연주하는 음, 누르면 기준음, 박마다 테두리 빛남
//  - 히트맵(아래 '초기화' 두 번 → log.resetPerNote, 음별 정확도만 지움): 최근 30일 음별 평균 센트 (자주 높으면 파랑 ▼ 내리기, 낮으면 빨강 ▲ 올리기 — 화살표 = 고칠 방향) — 연습 기록(practice.jsx)의 음별 정확도 사용
//  - 스케일 연습: 다음 음 안내 → 그 음을 0.15초 이상 연주하면 센트 기록하고 다음으로
// ==========================================

const FB_POSITIONS = 30;     // 개방현 + 29칸 = 최상단 포지션까지 (E현 A7, 약 3.5kHz). 위로 갈수록 칸이 좁아짐(실제 지판처럼)
// 색: 높음 = 파랑(▼ 내리기), 낮음 = 빨강(▲ 올리기)
const FB_HIGH = '#3b82f6', FB_LOW = '#ef4444';
const FB_CHROMATIC = [['C','B#'],['C#','Db'],['D'],['D#','Eb'],['E','Fb'],['F','E#'],['F#','Gb'],['G'],['G#','Ab'],['A'],['A#','Bb'],['B','Cb']];
const FB_KEYS = [
  { id: 'C',  label: 'C장조 (0)',   tonic: 0,  notes: ['C','D','E','F','G','A','B'] },
  { id: 'G',  label: 'G장조 (1♯)',  tonic: 7,  notes: ['G','A','B','C','D','E','F#'] },
  { id: 'D',  label: 'D장조 (2♯)',  tonic: 2,  notes: ['D','E','F#','G','A','B','C#'] },
  { id: 'A',  label: 'A장조 (3♯)',  tonic: 9,  notes: ['A','B','C#','D','E','F#','G#'] },
  { id: 'E',  label: 'E장조 (4♯)',  tonic: 4,  notes: ['E','F#','G#','A','B','C#','D#'] },
  { id: 'B',  label: 'B장조 (5♯)',  tonic: 11, notes: ['B','C#','D#','E','F#','G#','A#'] },
  { id: 'F#', label: 'F♯장조 (6♯)', tonic: 6,  notes: ['F#','G#','A#','B','C#','D#','E#'] },
  { id: 'F',  label: 'F장조 (1♭)',  tonic: 5,  notes: ['F','G','A','Bb','C','D','E'] },
  { id: 'Bb', label: 'B♭장조 (2♭)', tonic: 10, notes: ['Bb','C','D','Eb','F','G','A'] },
  { id: 'Eb', label: 'E♭장조 (3♭)', tonic: 3,  notes: ['Eb','F','G','Ab','Bb','C','D'] },
  { id: 'Ab', label: 'A♭장조 (4♭)', tonic: 8,  notes: ['Ab','Bb','C','Db','Eb','F','G'] },
  { id: 'Db', label: 'D♭장조 (5♭)', tonic: 1,  notes: ['Db','Eb','F','Gb','Ab','Bb','C'] },
];
const fbKey = (id) => FB_KEYS.find(k => k.id === id) || FB_KEYS[0];
const fbSpell = (pc, keyId) => FB_CHROMATIC[((pc % 12) + 12) % 12].find(n => fbKey(keyId).notes.includes(n)) || null;
const fbPretty = (n) => n.replace('#', '♯').replace(/([A-G])b/, '$1♭');
const fbLabel = (semi) => { const m = semi + 69; return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); };
const fbPc = (semi) => (((semi + 9) % 12) + 12) % 12;
// 장음계 1옥타브, 근음은 G3 이상에서 가장 낮게 (예: D장조 → D4…D5)
const fbScale = (keyId) => {
  let root = fbKey(keyId).tonic - 9;
  while (root < -14) root += 12;
  while (root - 12 >= -14) root -= 12;
  return [0, 2, 4, 5, 7, 9, 11, 12].map(s => root + s);
};
// 예전 저장값 'D Major (2#)' → 'D' (v2에 없는 조는 같은 음의 조로)
const fbInitialKey = () => {
  try {
    const old = JSON.parse(localStorage.getItem('vt.fingerboard.key') || 'null');
    if (typeof old === 'string') { const id = old.split(' ')[0]; return ({ 'C#': 'Db', Gb: 'F#', Cb: 'B' })[id] || id; }
  } catch (_) {}
  return 'C';
};

// 스케일 연습
const useScalePractice = (keyId, tuner) => {
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState([]);
  const seq = fbScale(keyId);
  const st = useRef({ idx: 0, run: '', since: 0, last: 0 });

  useEffect(() => {
    if (!active) return;
    const listener = (label, cents, now) => {
      const s = st.current;
      if (s.idx >= seq.length) return;
      if (label !== fbLabel(seq[s.idx])) { s.run = ''; return; }
      if (s.run !== label || now - s.last > 300) { s.run = label; s.since = now; }
      s.last = now;
      if (now - s.since >= 150) {
        s.run = ''; s.idx++;
        setResults(r => [...r, cents]); setIdx(s.idx);
        haptic(Math.abs(cents) <= tuner.tolerance ? 15 : [10, 30, 10]);
      }
    };
    tuner.noteListeners.add(listener);
    return () => { tuner.noteListeners.delete(listener); };
  }, [active, keyId]);

  const start = () => { st.current = { idx: 0, run: '', since: 0, last: 0 }; setIdx(0); setResults([]); setActive(true); haptic(10); };
  const stop = () => setActive(false);
  const done = active && idx >= seq.length;
  const okCount = results.filter(c => Math.abs(c) <= tuner.tolerance).length;
  const avgAbs = results.length ? results.reduce((a, c) => a + Math.abs(c), 0) / results.length : 0;
  return { active, idx, results, seq, start, stop, done, okCount, avgAbs };
};

const Fingerboard = ({ tuner, metro, log }) => {
  const [keyId, setKeyId] = usePersistentState('fb.key', fbInitialKey(), v => !!FB_KEYS.find(k => k.id === v));
  const [heat, setHeat] = usePersistentState('fb.heat', false, v => typeof v === 'boolean');
  const [heatReset, setHeatReset] = useState(false);   // 히트맵 초기화: 두 번 눌러야 실행
  const vintage = useVintage();
  const pal = vintage ? METRO_PALETTE.vintage : METRO_PALETTE.tape;
  const scale = useScalePractice(keyId, tuner);
  const per = heat ? mergePerNote(log.days, 30) : {};

  const live = tuner.isStarted && tuner.pitch > 0;
  const detSemi = live ? Math.round(12 * Math.log2(tuner.pitch / tuner.a4Freq)) : null;
  const detOk = live && Math.abs(tuner.cents) <= tuner.tolerance;

  const playing = metro.isPlayingMetro;
  const beatSnd = playing && metro.currentBeat >= 0 ? metro.beatSounds[metro.currentBeat] : 0;
  const flashCol = playing && metro.visualFlash === 'main' && beatSnd ? pal[beatSnd] : null;
  const downbeat = flashCol && metro.currentBeat === 0;

  const strings = [...VIOLIN_STRINGS];      // G D A E (왼쪽 → 오른쪽)
  const target = scale.active && !scale.done ? scale.seq[scale.idx] : null;

  return (
    <div className="w-full h-full flex flex-col tab-enter gap-2.5">
      {/* 조표 · 히트맵 · 스케일 · 박자 */}
      <div className="w-full flex items-center gap-1.5 shrink-0 h-10">
        <select value={keyId} onChange={e => setKeyId(e.target.value)}
          className="t-chip rounded-full px-2 py-1.5 text-xs font-black outline-none max-w-[108px] min-w-0" style={{ color: 'var(--ink)' }}>
          {FB_KEYS.map(k => <option key={k.id} value={k.id} style={{ background: 'var(--sheet-bg)' }}>{k.label}</option>)}
        </select>
        <button onClick={() => { setHeat(!heat); haptic(8); }}
          className="t-chip rounded-full flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-black whitespace-nowrap shrink-0"
          style={heat ? { color: '#ef4444', borderColor: 'rgba(239,68,68,.5)' } : { color: '#9ca3af' }}>
          <Flame size={12}/>히트맵
        </button>
        <button onClick={scale.active ? scale.stop : scale.start}
          className="t-chip rounded-full flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-black whitespace-nowrap shrink-0"
          style={scale.active ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : { color: '#9ca3af' }}>
          <Target size={12}/>스케일
        </button>
        <button onClick={metro.toggleMetronome} aria-label="박자"
          className="ml-auto t-chip rounded-full flex items-center gap-1 pl-2 pr-1.5 py-1.5 shrink-0 transition-shadow"
          style={flashCol ? { borderColor: flashCol, boxShadow: `0 0 ${12 * pal.glow + 4}px ${flashCol}` } : {}}>
          {metro.beatSounds.slice(0, 4).map((snd, i) => {
            const on = playing && i === metro.currentBeat && metro.visualFlash === 'main';
            return <span key={i} className="rounded-full transition-all duration-75" style={{
              width: on ? 9 : 6, height: on ? 9 : 6, background: snd ? pal[snd] : 'transparent', border: snd ? 'none' : `1px solid ${pal[0]}`,
              opacity: !playing ? 0.35 : i === metro.currentBeat ? 1 : 0.3 }}/>;
          })}
          <span className="text-[11px] font-black font-mono" style={{ color: playing ? (vintage ? '#f6dd94' : '#ffcc00') : '#9ca3af' }}>{metro.bpm}</span>
          {playing ? <Square size={9} fill="currentColor" className="text-gray-400"/> : <Play size={9} fill="currentColor" className="text-gray-400"/>}
        </button>
      </div>

      {/* 지금 음정: 높은지 낮은지 실시간 */}
      <MainPitchMeter tuner={tuner} compact swapColors/>

      {/* 스케일 연습 안내 */}
      {scale.active && (
        <div className="t-panel rounded-3xl px-4 py-2.5 flex items-center gap-3 shrink-0">
          {scale.done ? (
            <>
              <span className="text-sm font-black" style={{ color: 'var(--ink)' }}>완료! 평균 오차 <span style={{ color: 'var(--accent)' }}>{scale.avgAbs.toFixed(0)}¢</span> · 맞음 {scale.okCount}/{scale.seq.length}</span>
              <button onClick={scale.start} className="ml-auto t-chip rounded-full px-3 py-1 text-xs font-black" style={{ color: 'var(--accent)' }}>다시</button>
            </>
          ) : (
            <>
              <span className="text-[10px] font-black text-gray-500">다음 음</span>
              <span className="text-2xl font-black" style={{ color: 'var(--accent)', fontFamily: vintage ? 'Georgia,serif' : undefined }}>
                {fbPretty(fbSpell(fbPc(target), keyId) || FB_CHROMATIC[fbPc(target)][0])}
                <span className="text-sm text-gray-500">{fbLabel(target).replace(/\D+/, '')}</span>
              </span>
              <div className="flex gap-1 ml-auto">
                {scale.seq.map((_, i) => {
                  const r = scale.results[i];
                  return <span key={i} className={`w-2.5 h-2.5 rounded-full ${r === undefined && i === scale.idx ? 'animate-pulse' : ''}`}
                    style={{ background: r === undefined ? (i === scale.idx ? 'var(--accent)' : 'var(--chip-border)') : Math.abs(r) <= tuner.tolerance ? '#4afc9d' : '#ef4444' }}/>;
                })}
              </div>
            </>
          )}
          <button onClick={scale.stop} aria-label="스케일 연습 끝" className="text-gray-500"><X size={16}/></button>
        </div>
      )}

      {/* 지판 */}
      <div className="w-full flex-1 min-h-0 rounded-2xl t-board relative px-1.5 py-1.5 flex flex-col transition-shadow duration-75"
        style={{ boxShadow: flashCol ? `inset 0 0 0 ${downbeat ? 3 : 2}px ${flashCol}, 0 0 ${(downbeat ? 24 : 14) * pal.glow + 4}px ${flashCol}` : 'none' }}>
        <div className="flex mb-1 shrink-0">
          {strings.map(s => <div key={s.name} className="flex-1 flex justify-center">
            <span className="t-chip rounded px-2 py-0.5 text-[10px] font-black" style={{ color: vintage ? '#f6dd94' : document.documentElement.dataset.theme === 'light' ? '#b45309' : '#ffcc00' }}>{s.note}</span>
          </div>)}
        </div>
        <div className="flex-1 min-h-0 flex relative">
          {/* 줄 (G가 가장 굵게) */}
          {strings.map((s, i) => <div key={s.name} className="absolute top-0 bottom-0 rounded-full"
            style={{ left: `${12.5 + i * 25}%`, width: 4 - i * 0.8, marginLeft: -(4 - i * 0.8) / 2, background: vintage ? 'rgba(201,161,74,.55)' : 'rgba(128,128,140,.45)' }}/>)}
          {strings.map(s => (
            <div key={s.name} className="flex-1 flex flex-col relative z-10">
              {Array.from({ length: FB_POSITIONS }, (_, pos) => {
                const semi = s.semitone + pos, label = fbLabel(semi), pc = fbPc(semi);
                const spelled = fbSpell(pc, keyId);
                const isDet = detSemi === semi;
                const isPlay = tuner.playingTone === label;
                const isTarget = target === semi;
                const stt = per[label];
                const mean = stt && stt.n >= 3 ? stt.sum / stt.n : null;
                const name = fbPretty(spelled || FB_CHROMATIC[pc][0]);
                let style = { background: 'var(--chip-bg)', borderColor: 'var(--chip-border)', color: 'var(--ink)' };
                let extra = '';
                if (isPlay) { style = { background: '#8b5a2b', borderColor: '#e9c46a', color: '#fff', boxShadow: '0 0 16px rgba(233,196,106,.5)' }; extra = 'scale-125 z-30'; }
                else if (isDet) { const c = detOk ? '#4afc9d' : tuner.cents > 0 ? FB_HIGH : FB_LOW; style = { background: c, borderColor: c, color: detOk ? '#000' : '#fff', boxShadow: `0 0 16px ${c}` }; extra = 'scale-125 z-20'; }
                else if (isTarget) { style = { background: 'transparent', borderColor: 'var(--accent)', color: 'var(--accent)' }; extra = 'scale-110 animate-pulse'; }
                else if (mean !== null) {
                  const k = Math.min(1, Math.abs(mean) / 25), rgb = mean > 0 ? '59,130,246' : '239,68,68';
                  style = { background: `rgba(${rgb},${0.18 + k * 0.6})`, borderColor: `rgb(${rgb})`, color: 'var(--ink)' };
                }
                const line = pos === 12 || pos === 24 ? 'border-t-2 border-[#4afc9d]/40' : pos === 5 || pos === 7 || pos === 17 || pos === 19 ? 'border-t border-gray-700/60' : '';
                return (
                  <div key={pos} className={`flex items-center justify-center relative min-h-0 ${line}`} style={{ flex: `${1.3 - pos * 0.025} 1 0` }}>
                    {spelled || isDet || isPlay || isTarget ? (
                      <button onClick={() => tuner.toggleTone(label, semi)}
                        className={`min-w-[24px] px-1 border font-black leading-none transition-all duration-100 ${pos === 0 ? 'rounded-md text-[10px] py-[2px]' : 'rounded-full text-[9px] py-[1px]'} ${extra}`}
                        style={{ ...style, fontFamily: vintage ? 'Georgia,serif' : undefined }}>
                        {name}{mean !== null && !isDet && !isPlay && <span className="text-[8px] ml-0.5">{mean > 0 ? '▼' : '▲'}</span>}
                      </button>
                    ) : null}
                    {/* 지금 연주 중인 음: 화살표 = 고칠 방향 (높으면 ▼ 내리기, 낮으면 ▲ 올리기) + 센트 */}
                    {isDet && (
                      <span className="absolute z-30 left-1/2 ml-5 px-1 rounded text-[10px] font-black font-mono whitespace-nowrap pointer-events-none"
                        style={{ background: 'rgba(0,0,0,.8)', color: detOk ? '#4afc9d' : tuner.cents > 0 ? '#60a5fa' : '#ff6b6b' }}>
                        {detOk ? '✓' : tuner.cents > 0 ? '▼' : '▲'}{tuner.cents > 0 ? '+' : ''}{tuner.cents}
                      </span>
                    )}
                    {spelled || isDet || isPlay || isTarget ? null : (
                      <button onClick={() => tuner.toggleTone(label, semi)} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--chip-border)' }} aria-label={label}/>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {heat && (
        <div className="flex items-center justify-center gap-2 shrink-0 text-[10px] font-bold text-gray-500">
          <span><b style={{ color: FB_HIGH }}>▼파랑</b> 높음 · <b style={{ color: FB_LOW }}>▲빨강</b> 낮음 · 최근 30일</span>
          <button onClick={() => { if (heatReset) { log.resetPerNote(); setHeatReset(false); haptic(30); } else { setHeatReset(true); haptic(8); setTimeout(() => setHeatReset(false), 2500); } }}
            className="t-chip rounded-full px-2 py-0.5 flex items-center gap-1"
            style={heatReset ? { color: '#ef4444', borderColor: '#ef4444' } : { color: '#9ca3af' }}>
            <RotateCcw size={10}/>{heatReset ? '한 번 더' : '초기화'}
          </button>
        </div>
      )}

      {tuner.error && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm rounded-2xl">
          <div className="w-[85%] bg-gray-900/95 p-6 rounded-3xl flex flex-col items-center gap-4 border border-gray-700 shadow-2xl">
            <AlertCircle size={36} className="text-red-400"/>
            <p className="text-sm text-center text-white font-bold leading-relaxed">{tuner.error}</p>
            <div className="flex gap-3 mt-2 w-full">
              <button onClick={tuner.handleReset} className="flex-1 py-3 bg-gray-800 text-white text-sm font-bold rounded-full border border-gray-600">닫기</button>
              <button onClick={tuner.ensureMic} className="flex-1 py-3 bg-[#4afc9d] text-black text-sm font-bold rounded-full">다시 시도</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
