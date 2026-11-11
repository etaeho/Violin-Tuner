// ==========================================
// recorder — 연습 녹음 (모든 탭 위 녹음 줄 + 녹음 목록 시트 + 설정)
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
//  - 튜너가 연 마이크를 그대로 씀 (권한 추가 없음). MediaRecorder → webm/opus
//  - 메트로놈 소리 넣기: 메트로놈 오디오에서 마이크 + 딸깍 소리를 디지털로 섞음 (metro.getMetroCtx / setRecordTap)
//  - 메트로놈 연동: 메트로놈 켜면 녹음 시작, 끄면 정지 (settings.recAutoMetro)
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

const fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtRecDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const blobToBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const recExt = (mime) => mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';

const useRecorder = (tuner, metro, notify) => {
  const S = tuner.settings;
  const supported = typeof window.MediaRecorder !== 'undefined';
  const [rec, setRec] = useState(null);              // 녹음 중: { start, auto, withClicks }
  const [, setTick] = useState(0);
  const [items, setItems] = useState([]);
  const [playing, setPlaying] = useState(null);      // { id, pos, dur }
  const mrRef = useRef(null), chunksRef = useRef([]), mixRef = useRef(null), metaRef = useRef(null), autoRef = useRef(false);
  const audioRef = useRef(null);
  const metroRef = useRef(metro); metroRef.current = metro;

  const refresh = () => recDb.all().then(l => setItems(l.sort((a, b) => b.at - a.at))).catch(() => {});
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (!rec) return; const iv = setInterval(() => setTick(t => t + 1), 250); return () => clearInterval(iv); }, [rec]);

  const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find(m => window.MediaRecorder?.isTypeSupported?.(m)) || '';

  const cleanupMix = () => {
    metroRef.current.setRecordTap(null);
    try { mixRef.current?.src.disconnect(); } catch (_) {}
    mixRef.current = null;
  };

  const start = async ({ auto = false } = {}) => {
    if (!supported || mrRef.current) return false;
    if (!(await tuner.ensureMic())) return false;
    const mic = tuner.getStream();
    if (!mic) return false;
    let stream = mic, withClicks = false;
    if (tuner.settings.recClicks) {
      try {
        const ctx = metroRef.current.getMetroCtx();
        const dest = ctx.createMediaStreamDestination();
        const src = ctx.createMediaStreamSource(mic);
        src.connect(dest);
        metroRef.current.setRecordTap(dest);
        mixRef.current = { src, dest };
        stream = dest.stream; withClicks = true;
      } catch (_) { cleanupMix(); stream = mic; }
    }
    const mime = pickMime();
    let mr;
    try {
      mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: tuner.settings.recQuality === 'high' ? 128000 : 64000 });
    } catch (e) { cleanupMix(); notify?.('녹음을 시작할 수 없습니다'); return false; }
    chunksRef.current = [];
    metaRef.current = { at: Date.now(), withClicks, mime: mr.mimeType || mime || 'audio/webm', bpm: metroRef.current.isPlayingMetro ? metroRef.current.bpm : null };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const m = metaRef.current, dur = Date.now() - m.at;
      const blob = new Blob(chunksRef.current, { type: m.mime });
      cleanupMix();
      mrRef.current = null; autoRef.current = false; setRec(null);
      if (dur < 800 || !blob.size) return;
      const item = { id: 'r' + m.at, at: m.at, dur, mime: m.mime, size: blob.size, bpm: m.bpm, withClicks: m.withClicks, blob };
      try { await recDb.put(item); notify?.(`🎙 녹음 저장 ${fmtDur(dur)}`); } catch (_) { notify?.('녹음 저장 실패 (저장 공간 확인)'); }
      refresh();
    };
    mr.start(1000);
    mrRef.current = mr; autoRef.current = auto;
    setRec({ start: Date.now(), auto, withClicks });
    haptic([20, 40, 20]);
    return true;
  };
  const stop = () => { if (mrRef.current && mrRef.current.state !== 'inactive') { mrRef.current.stop(); haptic(20); } };
  const toggle = () => (mrRef.current ? stop() : start());

  // 녹음 중 메트로놈을 켰다면 BPM 기록
  useEffect(() => { if (rec && metro.isPlayingMetro && metaRef.current && !metaRef.current.bpm) metaRef.current.bpm = metro.bpm; }, [rec, metro.isPlayingMetro]);

  // 메트로놈 연동: 켜면 녹음 시작, 끄면 (연동으로 시작한 녹음만) 정지
  const prevPlay = useRef(false);
  useEffect(() => {
    const p = metro.isPlayingMetro;
    if (p && !prevPlay.current && S.recAutoMetro && !mrRef.current) start({ auto: true });
    if (!p && prevPlay.current && autoRef.current) stop();
    prevPlay.current = p;
  }, [metro.isPlayingMetro]);

  // 앱이 화면에서 사라지면 마이크가 꺼지므로 녹음도 마무리
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden') { stop(); stopPlay(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── 재생 ──
  const stopPlay = () => {
    const r = audioRef.current;
    if (r) { clearInterval(r.iv); r.a.pause(); URL.revokeObjectURL(r.url); }
    audioRef.current = null; setPlaying(null);
    tuner.setListenGuard(false);
  };
  const play = (item) => {
    if (playing?.id === item.id) { stopPlay(); return; }
    stopPlay();
    const url = URL.createObjectURL(item.blob), a = new Audio(url);
    a.onended = stopPlay;
    a.play().catch(() => stopPlay());
    const iv = setInterval(() => setPlaying(p => p && { ...p, pos: a.currentTime * 1000 }), 200);
    audioRef.current = { a, url, iv };
    setPlaying({ id: item.id, pos: 0, dur: item.dur });
    tuner.setListenGuard(true);
    haptic(10);
  };
  const seek = (frac) => { const r = audioRef.current; if (r && isFinite(r.a.duration)) r.a.currentTime = frac * r.a.duration; else if (r) r.a.currentTime = frac * (playing?.dur || 0) / 1000; };

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
  const remove = async (item) => { if (playing?.id === item.id) stopPlay(); await recDb.del(item.id); refresh(); haptic(15); };

  const elapsed = rec ? Date.now() - rec.start : 0;
  return { supported, rec, elapsed, items, playing, start, stop, toggle, play, stopPlay, seek, exportItem, remove };
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
    <RecToggle on={S.recAutoMetro} onClick={() => updateSettings({ recAutoMetro: !S.recAutoMetro })}
      title="메트로놈과 같이 녹음" desc="메트로놈을 켜면 녹음 시작, 끄면 녹음 정지"/>
    <RecToggle on={S.recClicks} onClick={() => updateSettings({ recClicks: !S.recClicks })}
      title="메트로놈 소리도 녹음" desc="딸깍 소리를 깨끗하게 섞어 넣음 (스피커로 들리는 소리도 마이크에 같이 들어갈 수 있어 이어폰 추천)"/>
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-gray-300">음질</span>
      <div className="flex gap-1 p-1 rounded-full t-chip">
        {[['std', '보통 (작은 파일)'], ['high', '높음']].map(([id, name]) => (
          <button key={id} onClick={() => { updateSettings({ recQuality: id }); haptic(6); }}
            className="px-2.5 py-1 rounded-full text-[11px] font-black"
            style={S.recQuality === id ? { background: 'var(--accent)', color: '#000' } : { color: 'var(--ink2)' }}>{name}</button>
        ))}
      </div>
    </div>
  </div>
);

// ── 모든 탭 위: 녹음 줄 ──
const RecordBar = ({ recorder, tuner, onOpenList }) => {
  const { rec, elapsed, items, supported } = recorder;
  const S = tuner.settings;
  if (!supported) return null;
  return (
    <div className="w-full flex items-center gap-2 shrink-0 h-8 mb-1.5">
      <button onClick={recorder.toggle} aria-label={rec ? '녹음 정지' : '녹음 시작'}
        className={`flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-black transition-all active:scale-95 ${rec ? '' : 't-chip'}`}
        style={rec ? { background: 'rgba(239,68,68,.15)', border: '1.5px solid #ef4444', color: '#ef4444', boxShadow: '0 0 12px rgba(239,68,68,.35)' } : { color: 'var(--ink)' }}>
        {rec ? <Square size={11} fill="currentColor"/> : <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"/>}
        {rec ? <span className="font-mono">{fmtDur(elapsed)}</span> : '녹음'}
        {rec && <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse"/>}
      </button>
      {rec && <span className="text-[10px] font-bold text-gray-500 truncate">{rec.auto ? '메트로놈과 함께' : ''}{rec.withClicks ? (rec.auto ? ' · 딸깍 포함' : '딸깍 포함') : ''}</span>}
      <button onClick={() => { tuner.updateSettings({ recAutoMetro: !S.recAutoMetro }); haptic(8); }}
        className="ml-auto flex items-center gap-1 rounded-full px-2.5 h-8 t-chip text-[10px] font-black whitespace-nowrap"
        style={S.recAutoMetro ? { color: '#ef4444', borderColor: 'rgba(239,68,68,.5)' } : { color: '#9ca3af' }}
        aria-label="메트로놈과 같이 녹음">
        <Music size={12}/>+<span className="w-2 h-2 rounded-full" style={{ background: S.recAutoMetro ? '#ef4444' : '#6b7280' }}/>{S.recAutoMetro ? '연동' : '연동 끔'}
      </button>
      <button onClick={onOpenList} className="flex items-center gap-1 rounded-full px-2.5 h-8 t-chip text-[11px] font-black" style={{ color: 'var(--ink2)' }} aria-label="녹음 목록">
        <ListMusic size={14}/>{items.length}
      </button>
    </div>
  );
};

// ── 녹음 목록 시트 ──
const RecordingsSheet = ({ recorder, tuner, onClose }) => {
  const { items, playing } = recorder;
  const [confirm, setConfirm] = useState(null);
  const total = items.reduce((a, b) => a + (b.size || 0), 0);
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-h-[88%] overflow-y-auto t-sheet rounded-t-[2rem] px-4 pt-3 pb-6 flex flex-col gap-3 shadow-[0_-20px_60px_rgba(0,0,0,0.9)]" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-700 rounded-full self-center mb-1"/>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ListMusic size={16} className="text-[#ef4444]"/>
            <span className="text-base font-black" style={{ color: 'var(--ink)' }}>녹음</span>
            <span className="text-[10px] text-gray-500">{items.length}개 · {(total / 1048576).toFixed(1)}MB</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full t-chip text-gray-400"><X size={14}/></button>
        </div>

        <button onClick={recorder.toggle}
          className="flex items-center justify-center gap-2 py-3 rounded-full text-sm font-black active:scale-[0.98]"
          style={recorder.rec ? { background: 'rgba(239,68,68,.15)', border: '2px solid #ef4444', color: '#ef4444' } : { background: '#ef4444', color: '#fff' }}>
          {recorder.rec ? <><Square size={14} fill="currentColor"/>정지 · {fmtDur(recorder.elapsed)}</> : <><span className="w-3 h-3 rounded-full bg-white"/>녹음 시작</>}
        </button>

        <div className="t-inset rounded-2xl p-4"><RecSettings S={tuner.settings} updateSettings={tuner.updateSettings}/></div>

        {!items.length && <p className="text-xs text-gray-500 text-center py-6">아직 녹음이 없습니다. 위 버튼이나 화면 위 ● 녹음을 누르세요.</p>}
        {items.map(it => {
          const on = playing?.id === it.id;
          const frac = on ? Math.min(1, playing.pos / it.dur) : 0;
          return (
            <div key={it.id} className="t-card rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <button onClick={() => recorder.play(it)} aria-label={on ? '정지' : '재생'}
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95"
                  style={{ background: on ? 'var(--accent)' : 'var(--chip-bg)', border: '1px solid var(--chip-border)', color: on ? '#000' : 'var(--ink)' }}>
                  {on ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}
                </button>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-sm font-black" style={{ color: 'var(--ink)' }}>{fmtRecDate(it.at)} <span className="font-mono text-gray-400 text-xs">{fmtDur(it.dur)}</span></span>
                  <span className="text-[10px] text-gray-500">
                    {it.bpm ? `메트로놈 ${it.bpm} BPM${it.withClicks ? ' · 딸깍 포함' : ''}` : '마이크만'} · {(it.size / 1024).toFixed(0)}KB
                  </span>
                </div>
                <button onClick={() => recorder.exportItem(it)} className="t-chip rounded-full p-2 text-gray-300 shrink-0" aria-label="폰에 저장"><Download size={15}/></button>
                <button onClick={() => { if (confirm === it.id) { recorder.remove(it); setConfirm(null); } else { setConfirm(it.id); haptic(8); setTimeout(() => setConfirm(c => c === it.id ? null : c), 2500); } }}
                  className="t-chip rounded-full p-2 shrink-0 flex items-center gap-1" aria-label="삭제"
                  style={confirm === it.id ? { color: '#ef4444', borderColor: '#ef4444' } : { color: '#9ca3af' }}>
                  <Trash2 size={15}/>{confirm === it.id && <span className="text-[10px] font-black">한 번 더</span>}
                </button>
              </div>
              {on && (
                <div className="h-2 rounded-full t-chip relative cursor-pointer" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); recorder.seek((e.clientX - r.left) / r.width); }}>
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${frac * 100}%`, background: 'var(--accent)' }}/>
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[10px] text-gray-600 leading-snug">녹음은 이 폰 안에만 보관됩니다. ⬇ 버튼으로 파일(webm)로 저장해 다른 앱에서 들을 수 있습니다. 앱이 화면에서 사라지면 녹음이 자동으로 끝납니다.</p>
      </div>
    </div>
  );
};
