// ==========================================
// recorder — 연습 녹음: 4번째 탭(RecordTab, 녹음 버튼 · 설정 · 목록) + 기록 탭 맨 아래 날짜별 녹음(RecordDays)
// (드론 탭은 일단 숨김 — drone.jsx 코드·useDroneLogic은 그대로 둠)
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
//  - 튜너가 연 마이크를 그대로 씀 (권한 추가 없음). MediaRecorder → webm/opus
//  - 메트로놈 박 소리 넣기: 녹음용 마이크를 '에코 제거'로 따로 열어(스피커에서 나온 메트로놈 소리가 지워짐)
//    메트로놈 오디오에서 그 마이크 + 박에 맞춘 딸깍을 디지털로 섞음 (metro.getMetroCtx / setRecordTap).
//    튜너는 원래 마이크(처리 없음)를 그대로 씀
//  - 녹음과 메트로놈은 따로 동작 (메트로놈을 켜도 녹음은 시작되지 않음)
//  - 녹음하며 음정(튜너 확정 음, 30ms마다)·소리 시작·메트로놈 박을 같이 저장 → analyzeRec로 음정 %·박자 오차
//  - 재생기(RecPlayer): 음정 그래프 · 전체 막대 · 0.5/0.75/1배(음높이 유지) · A-B 구간 반복
//  - 녹음 지연(recDelay): 녹음 버튼 누르고 0·3·5·10초 뒤 시작, 어느 탭이든 화면 가운데 큰 숫자
//  - 저장: 폰 안 IndexedDB('vt-rec'). 내보내기 = 안드로이드 VTNative.saveAudio(이름, 형식, base64) → 저장 위치 고르기
// ==========================================

// ── 저장소 (IndexedDB: 녹음 파일은 localStorage에 못 넣을 만큼 커서) ──
const recDb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('vt-rec', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('recs', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('recs', mode), st = t.objectStore('recs');
      const out = fn(st);
      t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    all: () => tx('readonly', st => st.getAll()),
    put: (item) => tx('readwrite', st => st.put(item)),
    del: (id) => tx('readwrite', st => st.delete(id)),
  };
})();

const recDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtRecDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const blobToBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const recExt = (mime) => mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';

// 녹음 분석: 음정 점들(pts) 정확도 + 소리 시작(onsets)과 메트로놈 박(grid) 비교
//  박자 오차 = 소리 시작 − 가장 가까운 박. 마이크 지연(latMs)만큼 앞당겨 보정. 박 간격의 35% 넘게 떨어진 소리는 제외
const analyzeRec = (pts, onsets, grid, tolerance, latMs) => {
  const live = pts.filter(p => p[1] !== null);
  const pitchPct = live.length ? Math.round(100 * live.filter(p => Math.abs(p[1]) <= tolerance).length / live.length) : null;
  let rhythm = null; const marks = [];
  if (grid.length >= 4 && onsets.length) {
    const ds = [];
    onsets.forEach(o0 => {
      const o = o0 - latMs;
      let i = grid.findIndex(g => g[0] >= o); if (i < 0) i = grid.length - 1;
      const cand = [grid[i - 1], grid[i]].filter(Boolean);
      const g = cand.reduce((a, b) => Math.abs(b[0] - o) < Math.abs(a[0] - o) ? b : a);
      const gi = grid.indexOf(g), gap = Math.abs((grid[gi + 1] || grid[gi - 1])[0] - g[0]) || 500;
      const d = o - g[0];
      if (Math.abs(d) <= gap * 0.35) { ds.push(d); marks.push([Math.round(o0), Math.round(d)]); }
    });
    if (ds.length >= 3) {
      const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
      const sd = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / ds.length);
      rhythm = { mean: Math.round(mean), sd: Math.round(sd), hit: Math.round(100 * ds.filter(d => Math.abs(d) <= 50).length / ds.length), n: ds.length };
    }
  }
  return { pitchPct, rhythm, marks };
};

const useRecorder = (tuner, metro, notify) => {
  const S = tuner.settings;
  const supported = typeof window.MediaRecorder !== 'undefined';
  const [rec, setRec] = useState(null);              // 녹음 중: { start, withClicks }
  const [count, setCount] = useState(null);          // 녹음 지연 중: { left(남은 초), total }
  const [, setTick] = useState(0);
  const [items, setItems] = useState([]);
  const [player, setPlayer] = useState(null);        // { id, pos, dur, paused, rate, A, B }
  const mrRef = useRef(null), chunksRef = useRef([]), mixRef = useRef(null), metaRef = useRef(null), trackRef = useRef(null);
  const countRef = useRef(null), audioRef = useRef(null), abRef = useRef({ A: null, B: null });
  const metroRef = useRef(metro); metroRef.current = metro;

  const refresh = () => recDb.all().then(l => setItems(l.sort((a, b) => b.at - a.at))).catch(() => {});
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (!rec) return; const iv = setInterval(() => setTick(t => t + 1), 250); return () => clearInterval(iv); }, [rec]);

  const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find(m => window.MediaRecorder?.isTypeSupported?.(m)) || '';

  const cleanupMix = () => {
    metroRef.current.setRecordTap(null);
    const m = mixRef.current;
    if (m) {
      cancelAnimationFrame(m.raf);
      try { m.src.disconnect(); } catch (_) {}
      m.own?.getTracks().forEach(t => t.stop());       // 녹음용으로 따로 연 에코 제거 마이크 닫기
    }
    if (trackRef.current?.listener) tuner.noteListeners.delete(trackRef.current.listener);
    mixRef.current = null;
  };

  const start = async () => {
    if (!supported || mrRef.current) return false;
    if (!(await tuner.ensureMic())) return false;
    const mic = tuner.getStream();
    if (!mic) return false;
    // 에코 제거 마이크: 폰 스피커로 나간 메트로놈 소리를 녹음에서 지움 (박 소리 넣기를 켰을 때, 못 열면 원래 마이크)
    let own = null;
    if (tuner.settings.recClicks) {
      try { own = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } }); } catch (_) { own = null; }
    }
    const t0 = performance.now();
    const tr = { t0, pts: [], onsets: [], lastPt: 0, lastNote: null, lastOn: 0 };
    trackRef.current = tr;
    const addOnset = (now) => { if (now - tr.lastOn > 110) { tr.onsets.push(now - t0); tr.lastOn = now; } };
    let stream = mic, withClicks = false;
    try {
      const ctx = metroRef.current.getMetroCtx();
      const src = ctx.createMediaStreamSource(own || mic);
      // 소리 시작 감지: 짧은 창(512)으로 음량이 갑자기 커지는 순간
      const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Float32Array(an.fftSize), hist = [];
      const mix = { src, own, raf: 0 };
      const poll = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const db = rmsToDb(Math.sqrt(sum / buf.length)), now = performance.now();
        const floor = hist.length ? Math.min(...hist) : db;
        if (db > tuner.settings.gateDb - 6 && db - floor > 9) addOnset(now);
        hist.push(db); if (hist.length > 6) hist.shift();
        mix.raf = requestAnimationFrame(poll);
      };
      mix.raf = requestAnimationFrame(poll);
      if (tuner.settings.recClicks) {
        const dest = ctx.createMediaStreamDestination();
        src.connect(dest);
        metroRef.current.setRecordTap(dest);   // 메트로놈이 울리면 박에 맞춰 딸깍이 여기로도 들어감
        stream = dest.stream; withClicks = true;
      }
      mixRef.current = mix;
    } catch (_) { own?.getTracks().forEach(t => t.stop()); cleanupMix(); stream = mic; }
    // 음정 기록: 튜너가 확정한 음 (30ms마다 한 점) + 음이 바뀌는 순간도 소리 시작으로
    tr.listener = (label, cents, now) => {
      // 음이 바뀌면 소리 시작 (이음줄 연주). 음 확정은 소리보다 늦게 오므로 직전 음량 상승과 겹치면 안 셈
      if (label !== tr.lastNote) { if (tr.lastNote && now - tr.lastOn > 300) addOnset(now - 60); tr.lastNote = label; }
      if (now - tr.lastPt >= 30) { tr.pts.push([Math.round(now - t0), cents, label]); tr.lastPt = now; }
    };
    tuner.noteListeners.add(tr.listener);

    const mime = pickMime();
    let mr;
    try {
      mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 128000   /* 음질: 항상 높음 */ });
    } catch (e) { cleanupMix(); notify?.('녹음을 시작할 수 없습니다'); return false; }
    chunksRef.current = [];
    const latMs = Math.round(((own || mic).getAudioTracks()[0]?.getSettings?.().latency || 0.02) * 1000) + 10;
    metaRef.current = { at: Date.now(), withClicks, latMs, mime: mr.mimeType || mime || 'audio/webm', bpm: metroRef.current.isPlayingMetro ? metroRef.current.bpm : null };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const m = metaRef.current, dur = Date.now() - m.at, tEnd = performance.now();
      const blob = new Blob(chunksRef.current, { type: m.mime });
      const t = trackRef.current;
      cleanupMix();
      mrRef.current = null; setRec(null);
      if (dur < 800 || !blob.size) return;
      const grid = METRO_CLICKS.grid.filter(g => g[0] >= t.t0 - 200 && g[0] <= tEnd).map(g => [g[0] - t.t0, g[1]]);
      const an = analyzeRec(t.pts, t.onsets, grid, tuner.tolerance, m.latMs);
      const item = { id: 'r' + m.at, at: m.at, dur, mime: m.mime, size: blob.size, bpm: m.bpm, withClicks: m.withClicks, blob,
        track: { pts: t.pts, grid: grid.map(g => [Math.round(g[0]), g[1] ? 1 : 0]), marks: an.marks, tol: tuner.tolerance },
        stats: { pitchPct: an.pitchPct, rhythm: an.rhythm } };
      try { await recDb.put(item); notify?.(`🎙 녹음 저장 ${recDur(dur)}${an.pitchPct !== null ? ` · 음정 ${an.pitchPct}%` : ''}`); } catch (_) { notify?.('녹음 저장 실패 (저장 공간 확인)'); }
      refresh();
    };
    mr.start(1000);
    mrRef.current = mr;
    setRec({ start: Date.now(), withClicks });
    haptic([20, 40, 20]);
    return true;
  };
  const stop = () => { if (mrRef.current && mrRef.current.state !== 'inactive') { mrRef.current.stop(); haptic(20); } };

  // ── 녹음 지연: 녹음 버튼을 누르고 N초 뒤 시작 (화면 가운데 큰 숫자, app.jsx RecDelayOverlay) ──
  const cancelCount = () => { const c = countRef.current; if (c) c.timers.forEach(clearTimeout); countRef.current = null; setCount(null); };
  const startWithDelay = () => {
    const sec = tuner.settings.recDelay || 0;
    if (!sec) return start();
    const timers = [];
    for (let i = 1; i < sec; i++) timers.push(setTimeout(() => { setCount({ left: sec - i, total: sec }); haptic(10); }, i * 1000));
    timers.push(setTimeout(() => { countRef.current = null; setCount(null); start(); }, sec * 1000));
    countRef.current = { timers };
    setCount({ left: sec, total: sec });
    haptic(10);
  };
  const toggle = () => (mrRef.current ? stop() : countRef.current ? cancelCount() : startWithDelay());

  // 녹음 중 메트로놈을 켰다면 BPM 기록
  useEffect(() => { if (rec && metro.isPlayingMetro && metaRef.current && !metaRef.current.bpm) metaRef.current.bpm = metro.bpm; }, [rec, metro.isPlayingMetro]);

  // 앱이 화면에서 사라지면 마이크가 꺼지므로 녹음도 마무리
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden') { cancelCount(); stop(); closePlayer(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── 재생기: 일시정지 · 건너뛰기 · 속도(음높이 유지) · A-B 구간 반복 ──
  // 녹음 재생 중엔 메트로놈을 잠시 멈추고, 재생이 끝나거나 재생기를 닫으면 다시 켬 (내가 멈춘 경우만)
  const metroHeldRef = useRef(false);
  const holdMetro = () => { const m = metroRef.current; if (m.isPlayingMetro) { m.toggleMetronome(); metroHeldRef.current = true; } };
  const releaseMetro = () => { const m = metroRef.current; if (metroHeldRef.current) { metroHeldRef.current = false; if (!m.isPlayingMetro) m.toggleMetronome(); } };
  const closePlayer = (keepHold = false) => {
    const r = audioRef.current;
    if (r) { clearInterval(r.iv); r.a.pause(); URL.revokeObjectURL(r.url); }
    audioRef.current = null; abRef.current = { A: null, B: null }; setPlayer(null);
    tuner.setListenGuard(false);
    if (keepHold !== true) releaseMetro();
  };
  const open = (item) => {
    if (player?.id === item.id) { togglePause(); return; }
    closePlayer(true);          // 다른 녹음으로 바로 넘어가면 메트로놈은 계속 멈춘 채로
    holdMetro();
    const url = URL.createObjectURL(item.blob), a = new Audio(url);
    a.preservesPitch = true; a.mozPreservesPitch = true; a.webkitPreservesPitch = true;
    a.onended = () => {
      const { A, B } = abRef.current;
      if (A !== null && B !== null) { a.currentTime = A / 1000; a.play().catch(() => {}); return; }
      tuner.setListenGuard(false);
      setPlayer(p => p && { ...p, paused: true, pos: 0 });
      releaseMetro();          // 끝까지 들었으면 메트로놈 다시 켬
    };
    const iv = setInterval(() => {
      const pos = a.currentTime * 1000, { A, B } = abRef.current;
      if (A !== null && B !== null && pos >= B) a.currentTime = A / 1000;
      setPlayer(p => p && { ...p, pos: a.currentTime * 1000 });
    }, 80);
    audioRef.current = { a, url, iv };
    setPlayer({ id: item.id, pos: 0, dur: item.dur, paused: false, rate: 1, A: null, B: null });
    a.play().catch(() => closePlayer());
    tuner.setListenGuard(true);
    haptic(10);
  };
  const togglePause = () => {
    const r = audioRef.current; if (!r) return;
    if (r.a.paused) { holdMetro(); r.a.play().catch(() => {}); tuner.setListenGuard(true); setPlayer(p => p && { ...p, paused: false }); }
    else { r.a.pause(); tuner.setListenGuard(false); setPlayer(p => p && { ...p, paused: true }); }
    haptic(8);
  };
  const seekMs = (ms) => { const r = audioRef.current; if (!r || !player) return; const v = Math.max(0, Math.min(player.dur - 50, ms)); r.a.currentTime = v / 1000; setPlayer(p => p && { ...p, pos: v }); };
  const setRate = (rate) => { const r = audioRef.current; if (r) r.a.playbackRate = rate; setPlayer(p => p && { ...p, rate }); haptic(6); };
  const setAB = (which) => {
    if (!player) return;
    const ab = { ...abRef.current, [which]: Math.round(player.pos) };
    if (ab.A !== null && ab.B !== null && ab.B <= ab.A + 300) ab.B = null;          // B는 A보다 뒤여야
    abRef.current = ab; setPlayer(p => p && { ...p, ...ab });
    if (which === 'B' && ab.A !== null && ab.B !== null) seekMs(ab.A);
    haptic(10);
  };
  const clearAB = () => { abRef.current = { A: null, B: null }; setPlayer(p => p && { ...p, A: null, B: null }); haptic(6); };

  // ── 내보내기 · 삭제 ──
  const exportItem = async (item) => {
    const d = new Date(item.at);
    const name = `violin-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.${recExt(item.mime)}`;
    if (window.VTNative?.saveAudio) {
      window.__vtSaved = (ok) => notify?.(ok ? '📁 녹음 파일을 저장했습니다' : '저장을 취소했습니다');
      window.VTNative.saveAudio(name, item.mime.split(';')[0], await blobToBase64(item.blob));
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(item.blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  };
  const remove = async (item) => { if (player?.id === item.id) closePlayer(); await recDb.del(item.id); refresh(); haptic(15); };

  const elapsed = rec ? Date.now() - rec.start : 0;
  return { supported, rec, count, elapsed, items, player, start, stop, toggle, open, togglePause, closePlayer, seekMs, setRate, setAB, clearAB, exportItem, remove };
};

// ── 녹음 설정 (설정 시트 ⑤ · 녹음 목록 시트 공용) ──
const RecToggle = ({ on, onClick, title, desc }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex flex-col min-w-0">
      <span className="text-xs font-bold text-gray-300">{title}</span>
      {desc && <span className="text-[10px] text-gray-600 leading-snug">{desc}</span>}
    </div>
    <button onClick={() => { onClick(); haptic(8); }}
      className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${on ? 'bg-[#4afc9d]' : 'bg-gray-700'}`}>
      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`}/>
    </button>
  </div>
);
const RecSettings = ({ S, updateSettings }) => (
  <div className="flex flex-col gap-3">
    <RecToggle on={S.recClicks} onClick={() => updateSettings({ recClicks: !S.recClicks })}
      title="메트로놈 녹음" desc="메트로놈을 켜고 녹음하면 박 소리를 박자에 딱 맞춰 깨끗하게 넣습니다"/>
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-gray-300">녹음 지연</span>
        <span className="text-[10px] text-gray-600 leading-snug">녹음을 누르고 이 시간 뒤에 시작 (악기 잡을 시간)</span>
      </div>
      <div className="flex gap-1 p-1 rounded-full t-chip shrink-0">
        {[[0, '없음'], [3, '3초'], [5, '5초'], [10, '10초']].map(([v, name]) => (
          <button key={v} onClick={() => { updateSettings({ recDelay: v }); haptic(6); }}
            className="px-2 py-1 rounded-full text-[11px] font-black"
            style={(S.recDelay || 0) === v ? { background: 'var(--accent)', color: '#000' } : { color: 'var(--ink2)' }}>{name}</button>
        ))}
      </div>
    </div>
  </div>
);

// 녹음 결과 한 줄 요약
const recStatsText = (it) => {
  const s = it.stats; if (!s) return null;
  const out = [];
  if (s.pitchPct !== null && s.pitchPct !== undefined) out.push(`음정 ${s.pitchPct}%`);
  if (s.rhythm) out.push(`박자 ${s.rhythm.mean > 0 ? '+' : ''}${s.rhythm.mean}ms ±${s.rhythm.sd}`);
  return out.join(' · ');
};
const HI_C = '#ef4444', LO_C = '#3b82f6', OK_C = '#4afc9d';

// 재생 패널: 음정 그래프(지금 위치 ±몇 초) + 전체 막대 + 속도 + A-B 반복
const RecPlayer = ({ it, recorder }) => {
  const p = recorder.player, tr = it.track, dur = it.dur;
  const tol = tr?.tol ?? 10;
  const W = Math.min(dur, 10000);
  const w0 = Math.max(0, Math.min(dur - W, p.pos - W * 0.3)), w1 = w0 + W;
  const xp = (t) => ((t - w0) / W) * 100;   // 시간 → 그래프 가로 위치(%) (X는 아이콘 이름이라 피함)
  const Y = (c) => 50 - Math.max(-50, Math.min(50, c)) * 0.9;      // −50~+50¢ → 아래~위
  const col = (c) => Math.abs(c) <= tol ? OK_C : c > 0 ? HI_C : LO_C;
  const pts = tr ? tr.pts.filter(q => q[0] >= w0 && q[0] <= w1) : [];
  // 음이름: 같은 음이 이어지는 구간의 시작에만
  const labels = []; let prev = null, prevT = -1e9, lastL = -1e9;
  pts.forEach(q => { if ((q[2] !== prev || q[0] - prevT > 400) && q[0] - lastL > W * 0.075) { labels.push(q); lastL = q[0]; } prev = q[2]; prevT = q[0]; });
  const grid = tr ? tr.grid.filter(g => g[0] >= w0 && g[0] <= w1) : [];
  const marks = tr ? (tr.marks || []).filter(m => m[0] >= w0 && m[0] <= w1) : [];
  // 전체 막대: 0.5초 칸마다 평균 센트
  const bins = [];
  if (tr) { const n = Math.max(1, Math.ceil(dur / 500)); for (let i = 0; i < n; i++) bins.push([]); tr.pts.forEach(q => { const i = Math.min(bins.length - 1, Math.floor(q[0] / 500)); bins[i].push(q[1]); }); }
  const seekFrom = (e, a, b) => { const r = e.currentTarget.getBoundingClientRect(); recorder.seekMs(a + ((e.clientX - r.left) / r.width) * (b - a)); };
  const s = it.stats;
  return (
    <div className="flex flex-col gap-2 pt-1">
      {/* 요약 */}
      {s && (s.pitchPct !== null || s.rhythm) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold" style={{ color: 'var(--ink2)' }}>
          {s.pitchPct !== null && <span>음정 맞음 <b style={{ color: OK_C }}>{s.pitchPct}%</b> (±{tol}¢)</span>}
          {s.rhythm && <span>박자 평균 <b style={{ color: Math.abs(s.rhythm.mean) <= 30 ? OK_C : '#ffcc00' }}>{s.rhythm.mean > 0 ? `${s.rhythm.mean}ms 늦음` : s.rhythm.mean < 0 ? `${-s.rhythm.mean}ms 빠름` : '정확'}</b> · 흔들림 ±{s.rhythm.sd}ms · 박 맞춤 {s.rhythm.hit}%</span>}
        </div>
      )}
      {/* 음정 그래프 */}
      {tr ? (
        <div className="relative h-32 rounded-xl overflow-hidden cursor-pointer" style={{ background: '#0a0a0a' }} onClick={e => seekFrom(e, w0, w1)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <rect x="0" y={Y(tol)} width="100" height={Y(-tol) - Y(tol)} fill="rgba(74,252,157,.12)"/>
            <line x1="0" x2="100" y1="50" y2="50" stroke="#3f3f46" strokeWidth="0.4" vectorEffect="non-scaling-stroke"/>
            {grid.map((g, i) => <line key={i} x1={xp(g[0])} x2={xp(g[0])} y1="0" y2="100" stroke={g[1] ? '#52525b' : '#27272a'} strokeWidth={g[1] ? 1 : 0.6} vectorEffect="non-scaling-stroke"/>)}
            {p.A !== null && <rect x={xp(p.A)} y="0" width={Math.max(0, xp(p.B ?? p.pos) - xp(p.A))} height="100" fill="rgba(255,204,0,.12)"/>}
          </svg>
          {/* 점: 맞음 초록 · 높음 빨강 · 낮음 파랑 */}
          {pts.map((q, i) => <i key={i} className="absolute rounded-full" style={{ left: `${xp(q[0])}%`, top: `${Y(q[1])}%`, width: 4, height: 4, margin: -2, background: col(q[1]) }}/>)}
          {labels.map((q, i) => <span key={'l' + i} className="absolute text-[9px] font-black" style={{ left: `${xp(q[0])}%`, top: 2, color: '#a1a1aa' }}>{q[2].replace('#', '♯')}</span>)}
          {/* 소리 시작: 박보다 늦음 ▶ / 빠름 ◀ (아래 줄) */}
          {marks.map((m, i) => <span key={'m' + i} className="absolute text-[8px] font-black" style={{ left: `${xp(m[0])}%`, bottom: 1, transform: 'translateX(-50%)', color: Math.abs(m[1]) <= 50 ? OK_C : '#ffcc00' }}>{Math.abs(m[1]) <= 50 ? '●' : m[1] > 0 ? '▶' : '◀'}</span>)}
          <i className="absolute top-0 bottom-0 w-[2px] bg-white/80" style={{ left: `${xp(p.pos)}%` }}/>
          <span className="absolute right-1 top-1 text-[8px] font-bold text-gray-500">+50¢</span>
          <span className="absolute right-1 bottom-3 text-[8px] font-bold text-gray-500">−50¢</span>
        </div>
      ) : <p className="text-[10px] text-gray-500">이 녹음은 음정 기록이 없습니다 (이전 버전 녹음).</p>}
      {/* 전체 막대 */}
      <div className="relative h-4 rounded-md overflow-hidden flex cursor-pointer t-chip" onClick={e => seekFrom(e, 0, dur)}>
        {bins.map((b, i) => {
          const c = b.length ? b.reduce((x, y) => x + y, 0) / b.length : null;
          return <span key={i} className="h-full" style={{ flex: 1, background: c === null ? 'transparent' : col(c), opacity: c === null ? 0 : 0.75 }}/>;
        })}
        {p.A !== null && <span className="absolute inset-y-0" style={{ left: `${p.A / dur * 100}%`, width: `${Math.max(0.5, ((p.B ?? p.pos) - p.A) / dur * 100)}%`, background: 'rgba(255,204,0,.35)', border: '1px solid #ffcc00' }}/>}
        <i className="absolute top-0 bottom-0 w-[2px] bg-white" style={{ left: `${p.pos / dur * 100}%` }}/>
      </div>
      {/* 속도 · A-B */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[0.5, 0.75, 1].map(r => (
          <button key={r} onClick={() => recorder.setRate(r)} className="px-2.5 py-1 rounded-full text-[11px] font-black"
            style={p.rate === r ? { background: 'var(--accent)', color: '#000' } : { color: 'var(--ink2)', border: '1px solid var(--chip-border)' }}>{r === 1 ? '1배' : `${r}배`}</button>
        ))}
        <span className="flex-1"/>
        <button onClick={() => recorder.setAB('A')} aria-label="구간 시작 A" className="px-2.5 py-1 rounded-full text-[11px] font-black" style={p.A !== null ? { background: '#ffcc00', color: '#000' } : { color: 'var(--ink2)', border: '1px solid var(--chip-border)' }}>A {p.A !== null ? recDur(p.A) : ''}</button>
        <button onClick={() => recorder.setAB('B')} aria-label="구간 끝 B" disabled={p.A === null} className="px-2.5 py-1 rounded-full text-[11px] font-black disabled:opacity-40" style={p.B !== null ? { background: '#ffcc00', color: '#000' } : { color: 'var(--ink2)', border: '1px solid var(--chip-border)' }}>B {p.B !== null ? recDur(p.B) : ''}</button>
        {(p.A !== null || p.B !== null) && <button onClick={recorder.clearAB} className="px-2 py-1 rounded-full text-[11px] font-black text-gray-400" aria-label="구간 해제"><X size={12}/></button>}
      </div>
      <p className="text-[9px] text-gray-500 leading-snug">그래프·막대를 누르면 그 위치로 이동 · A를 누르고 반복할 끝에서 B를 누르면 그 구간만 반복 · 느리게 들어도 음높이는 그대로</p>
    </div>
  );
};

// 녹음 한 줄: 재생/일시정지 · 날짜/길이 · 폰에 저장 · 삭제(두 번). 재생 중이면 아래에 재생 패널
const RecItem = ({ it, recorder, dateLabel = 'full' }) => {
  const p = recorder.player;
  const [confirm, setConfirm] = useState(false);
  const on = p?.id === it.id;
  const d = new Date(it.at), hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const stats = recStatsText(it);
  return (
    <div className="t-card rounded-2xl p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <button onClick={() => recorder.open(it)} aria-label={on && !p.paused ? '일시정지' : '재생'}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95"
          style={{ background: on ? 'var(--accent)' : 'var(--chip-bg)', border: '1px solid var(--chip-border)', color: on ? '#000' : 'var(--ink)' }}>
          {on && !p.paused ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}
        </button>
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-sm font-black" style={{ color: 'var(--ink)' }}>{dateLabel === 'time' ? hm : fmtRecDate(it.at)} <span className="font-mono text-gray-400 text-xs">{on ? `${recDur(p.pos)} / ` : ''}{recDur(it.dur)}</span></span>
          <span className="text-[10px] text-gray-500 truncate">
            {stats || (it.bpm ? `메트로놈 ${it.bpm} BPM` : '마이크만')}{stats && it.bpm ? ` · ${it.bpm} BPM` : ''}
          </span>
        </div>
        {on && <button onClick={recorder.closePlayer} className="t-chip rounded-full p-2 text-gray-400 shrink-0" aria-label="닫기"><X size={15}/></button>}
        <button onClick={() => recorder.exportItem(it)} className="t-chip rounded-full p-2 text-gray-300 shrink-0" aria-label="폰에 저장"><Download size={15}/></button>
        <button onClick={() => { if (confirm) { recorder.remove(it); setConfirm(false); } else { setConfirm(true); haptic(8); setTimeout(() => setConfirm(false), 2500); } }}
          className="t-chip rounded-full p-2 shrink-0 flex items-center gap-1" aria-label="삭제"
          style={confirm ? { color: '#ef4444', borderColor: '#ef4444' } : { color: '#9ca3af' }}>
          <Trash2 size={15}/>{confirm && <span className="text-[10px] font-black">한 번 더</span>}
        </button>
      </div>
      {on && <RecPlayer it={it} recorder={recorder}/>}
    </div>
  );
};

const recDayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const REC_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const recDayLabel = (key) => { const d = new Date(key + 'T00:00:00'); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${REC_WEEKDAYS[d.getDay()]})`; };

// 날짜별 녹음 묶음 — 기록 탭 맨 아래
const RecordDays = ({ recorder, max = 30 }) => {
  const groups = {};
  recorder.items.forEach(it => { (groups[recDayKey(it.at)] = groups[recDayKey(it.at)] || []).push(it); });
  const keys = Object.keys(groups).sort().reverse().slice(0, max);
  const [toggled, setToggled] = useState({});     // 사용자가 연/접은 날짜 (기본: 가장 최근 날짜만 펼침)
  return (
    <div className="w-full t-panel rounded-3xl p-4 shrink-0 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black tracking-widest text-gray-500">날짜별 녹음</span>
        <span className="text-[10px] font-bold text-gray-500">{recorder.items.length}개</span>
      </div>
      {!keys.length && <p className="text-xs text-gray-500 py-2">아직 녹음이 없습니다. 녹음 탭에서 녹음하면 여기에 날짜별로 모입니다.</p>}
      {keys.map(k => {
        const list = groups[k], tot = list.reduce((a, b) => a + b.dur, 0), isOpen = toggled[k] ?? k === keys[0];
        return (
          <div key={k} className="flex flex-col gap-1.5">
            <button onClick={() => { setToggled(t => ({ ...t, [k]: !isOpen })); haptic(6); }}
              className="flex items-center justify-between py-1">
              <span className="text-xs font-black" style={{ color: 'var(--ink)' }}>{recDayLabel(k)}</span>
              <span className="text-[11px] font-bold text-gray-500">{list.length}개 · {recDur(tot)} {isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && list.map(it => <RecItem key={it.id} it={it} recorder={recorder} dateLabel="time"/>)}
          </div>
        );
      })}
    </div>
  );
};

// ── 4번째 탭: 녹음 ──
const RecordTab = ({ recorder, tuner, metro }) => {
  const { rec, elapsed, items, supported } = recorder;
  const S = tuner.settings;
  const vintage = useVintage();
  const total = items.reduce((a, b) => a + (b.size || 0), 0);
  const today = items.filter(it => recDayKey(it.at) === recDayKey(Date.now()));
  return (
    <div className="w-full h-full flex flex-col gap-2.5 tab-enter">
      <div className="w-full flex items-center justify-between shrink-0 h-10">
        <span className="text-sm font-black tracking-widest" style={{ color: 'var(--ink)', fontFamily: vintage ? 'Georgia,serif' : undefined }}>연습 녹음</span>
        <span className="t-chip px-3 py-1.5 rounded-full text-[11px] font-black text-gray-400">{items.length}개 · {(total / 1048576).toFixed(1)}MB</span>
      </div>

      {/* 위: 음정(크게) · 설정 · 오늘 녹음 — 스크롤 */}
      <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pb-1">
        {!supported && <p className="text-sm text-[#ef4444] font-bold">이 기기에서는 녹음을 지원하지 않습니다.</p>}

        <MainPitchMeter tuner={tuner}/>

        <div className="w-full t-inset rounded-3xl p-4 shrink-0">
          <div className="text-[10px] font-black tracking-widest text-gray-500 mb-3">녹음 설정</div>
          <RecSettings S={S} updateSettings={tuner.updateSettings}/>
        </div>

        <div className="w-full flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black tracking-widest text-gray-500">오늘 녹음</span>
            <span className="text-[10px] text-gray-500">지난 녹음은 기록 탭 맨 아래</span>
          </div>
          {!today.length && <p className="text-xs text-gray-500 text-center py-4">오늘 녹음이 아직 없습니다.</p>}
          {today.map(it => <RecItem key={it.id} it={it} recorder={recorder} dateLabel="time"/>)}
        </div>
        <p className="text-[10px] text-gray-600 leading-snug px-1">녹음은 이 폰 안에만 보관됩니다. ⬇ 버튼으로 파일(webm)로 저장해 다른 앱에서 들을 수 있습니다. 앱이 화면에서 사라지면 녹음이 자동으로 끝납니다.</p>
      </div>

      {/* 맨 아래: 녹음 버튼 (항상 보임) */}
      <div className="w-full t-panel rounded-3xl px-5 py-3 shrink-0 flex items-center gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="font-mono font-black text-4xl leading-none" style={{ color: rec ? '#ef4444' : 'var(--ink-off)' }}>{recDur(elapsed)}</span>
          <span className="text-[11px] font-bold text-gray-500 leading-snug">
            {rec ? (metro.isPlayingMetro ? `녹음 중 · 메트로놈 ${metro.bpm} BPM에 맞춰 깜빡임` : '녹음 중 · 다른 탭으로 가도 계속 녹음') : recorder.count ? `${recorder.count.left}초 뒤 녹음 시작 (누르면 취소)` : `누르면 녹음 시작${S.recDelay ? ` · ${S.recDelay}초 뒤` : ''}`}
          </span>
        </div>
        {(() => {
          // 녹음 + 메트로놈이 같이 돌면 정지 버튼이 박에 맞춰 뛰고 빛남 (첫 박은 더 크게) — 크기는 transform만
          const beat = rec && metro.isPlayingMetro && metro.visualFlash === 'main' && metro.beatSounds[metro.currentBeat] !== 0;
          const down = beat && metro.currentBeat === 0;
          return (
        <button onClick={recorder.toggle} disabled={!supported} aria-label={rec ? '녹음 정지' : recorder.count ? '녹음 대기 취소' : '녹음 시작'}
          className="w-20 h-20 rounded-full flex items-center justify-center active:scale-95 shrink-0"
          style={{ background: rec ? (beat ? 'rgba(239,68,68,.32)' : 'rgba(239,68,68,.12)') : 'radial-gradient(circle at 40% 35%,#f87171,#dc2626)',
            border: `4px solid ${rec ? (down ? '#fff' : '#ef4444') : 'rgba(255,255,255,.15)'}`,
            transform: `scale(${down ? 1.1 : beat ? 1.05 : 1})`, transition: beat ? 'transform 40ms, box-shadow 40ms' : 'transform 160ms ease-out, box-shadow 160ms, background 160ms',
            boxShadow: rec ? `0 0 ${down ? 44 : beat ? 34 : 22}px rgba(239,68,68,${beat ? 0.85 : 0.45})` : '0 8px 24px rgba(0,0,0,.4)' }}>
          {rec ? <Square size={30} fill="#ef4444" color="#ef4444"/>
            : recorder.count ? <span className="text-4xl font-black text-white font-mono">{recorder.count.left}</span>
            : <span className="w-8 h-8 rounded-full bg-white"/>}
        </button>
          );
        })()}
      </div>
    </div>
  );
};

// 녹음 지연 숫자: 어느 탭에 있든 화면 가운데 크게 — 디자인 바탕에 맞춘 반투명 유리
const RecDelayOverlay = ({ recorder }) => {
  const theme = useTheme(), skin = useSkin();
  const c = recorder.count;
  if (!c) return null;
  const frac = c.left / c.total;
  // 바탕: 다크 = 어두운 유리, 라이트 = 밝은 유리, 우드 = 디자인 다이얼 바탕색을 반투명으로
  const look = theme === 'light'
    ? { bg: 'rgba(255,255,255,.55)', border: 'rgba(0,0,0,.08)', ink: '#18181b', sub: '#b91c1c', track: 'rgba(0,0,0,.08)', ring: '#dc2626', font: undefined }
    : theme === 'vintage'
    ? { bg: (skin.dial.outer.length === 7 ? skin.dial.outer + '99' : 'rgba(40,24,10,.6)'), border: skin.dial.ring, ink: skin.dial.text === '#2a1a0e' ? '#f4e3b5' : skin.dial.text, sub: skin.dial.on, track: 'rgba(255,255,255,.12)', ring: skin.dial.needle || skin.dial.on, font: 'Georgia,serif' }
    : { bg: 'rgba(20,20,20,.3)', border: 'rgba(255,255,255,.16)', ink: '#ffffff', sub: '#f87171', track: 'rgba(255,255,255,.1)', ring: '#ef4444', font: undefined };
  return (
    <div className="absolute inset-0 z-[65] flex items-center justify-center pointer-events-none">
      <div className="relative w-48 h-48 rounded-full flex flex-col items-center justify-center tab-enter"
        style={{ background: look.bg, border: `1px solid ${look.border}`, backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          boxShadow: '0 20px 50px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.18)' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="47" fill="none" stroke={look.track} strokeWidth="2"/>
          <circle cx="50" cy="50" r="47" fill="none" stroke={look.ring} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={`${295 * frac} 295`} style={{ transition: 'stroke-dasharray 1s linear' }}/>
        </svg>
        <span key={c.left} className="font-black leading-none tab-enter" style={{ fontSize: 88, color: look.ink, fontFamily: look.font, letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,.25)' }}>{c.left}</span>
        <span className="text-[10px] font-black tracking-[0.25em] mt-1.5 flex items-center gap-1" style={{ color: look.sub }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: look.ring }}/>녹음 대기
        </span>
      </div>
    </div>
  );
};
