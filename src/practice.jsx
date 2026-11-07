// ==========================================
// practice — 기록 탭: 연습 시간 자동 측정, 하루 연습량, 목표, 12주 달력, 요일별 그래프
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → app)
// 구상안: docs/practice-log-plan.md  (현재 1단계: 연습 시간)
//
// 측정 방식: 튜너가 음을 확정할 때마다 note() 호출 → 직전 음과의 간격이
// '쉬는 시간 판정'(기본 10초)보다 짧으면 그 간격을 연습 시간으로 더한다.
// 저장: 하루 요약만 localStorage 'vt.log.days' 에 (10초마다 + 앱을 내릴 때)
// ==========================================

const LOG_KEY = 'vt.log.days';
const LOG_KEEP_DAYS = 400;
const OPEN_STRING_LABELS = new Set(['G3', 'D4', 'A4', 'E5']);
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const emptyDay = () => ({ playMs: 0, tuneMs: 0, metroMs: 0, droneMs: 0, bpmMax: 0 });
// 최근 n일 음별 정확도 합산 (지판 히트맵용)
const mergePerNote = (days, n = 30) => {
  const out = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const day = days[dateKey(d)];
    if (!day || !day.per) continue;
    for (const [k, s] of Object.entries(day.per)) {
      const o = (out[k] = out[k] || { n: 0, ok: 0, sum: 0, abs: 0 });
      o.n += s.n; o.ok += s.ok; o.sum += s.sum; o.abs += s.abs;
    }
  }
  return out;
};
const practiceMs = (d) => (d ? d.playMs + d.tuneMs : 0);    // 연습 시간 = 연주 + 튜닝

const loadDays = () => {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
    if (!v || typeof v !== 'object') return {};
    const cutoff = Date.now() - LOG_KEEP_DAYS * 864e5;
    Object.keys(v).forEach(k => { if (new Date(k).getTime() < cutoff) delete v[k]; });
    return v;
  } catch (_) { return {}; }
};

const fmtDur = (ms) => {
  const m = Math.floor(ms / 60000);
  if (m >= 60) return `${Math.floor(m / 60)}시간 ${m % 60}분`;
  if (m >= 1) return `${m}분`;
  return `${Math.floor(ms / 1000)}초`;
};
const fmtClock = (ms) => {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};

// ── 로직 ──
// ctxRef.current = { tab, metroPlaying, bpm, droneActive, droneClasses:Set, onGoal(goalMin) }  ← app.jsx 가 채움
const usePracticeLog = (ctxRef) => {
  const [goalMin, setGoalMin] = usePersistentState('log.goalMin', 30, v => v >= 5 && v <= 300);
  const [idleSec, setIdleSec] = usePersistentState('log.idleSec', 10, v => v >= 3 && v <= 120);
  const [, setVer] = useState(0);
  const daysRef = useRef(null);
  if (!daysRef.current) daysRef.current = loadDays();
  const lastNoteRef = useRef(0);
  const runRef = useRef(null);       // 지금 이어지는 음 (정확도 판정용)
  const dirtyRef = useRef(false);
  const idleRef = useRef(idleSec * 1000); idleRef.current = idleSec * 1000;
  const goalRef = useRef(goalMin); goalRef.current = goalMin;

  const today = () => {
    const k = dateKey();
    return daysRef.current[k] || (daysRef.current[k] = emptyDay());
  };

  // 튜너가 음을 확정할 때마다 (tuner.jsx → practiceSinkRef)
  const note = (label, cents, now) => {
    const c = ctxRef.current || {};
    // 드론 재생 중에는 드론과 같은 음(스피커 소리일 수 있음)은 세지 않음
    if (c.droneActive && c.droneClasses?.has(label.replace(/\d+$/, ''))) return;
    const bucket = c.tab === 'tuner' && OPEN_STRING_LABELS.has(label) ? 'tuneMs' : 'playMs';
    const last = lastNoteRef.current;
    if (last && now - last < idleRef.current) { today()[bucket] += now - last; dirtyRef.current = true; }
    lastNoteRef.current = now;

    // 음정 정확도: 0.15초 이상 이어진 음 하나마다 한 번 기록 (튜닝 중 개방현 제외)
    // 간격 300ms까지는 같은 음으로 봄 (메트로놈 딸깍 순간 분석을 건너뛰어도 끊기지 않게)
    const r = runRef.current;
    const continuing = r && r.label === label && now - r.last < 300;
    if (!continuing) runRef.current = { label, start: now, last: now, counted: false };
    const run = runRef.current; run.last = now;
    if (!run.counted && now - run.start >= 150 && bucket === 'playMs') {
      run.counted = true;
      const d = today(), ok = Math.abs(cents) <= (c.tolerance ?? 10);
      d.notes = (d.notes || 0) + 1; d.ok = (d.ok || 0) + (ok ? 1 : 0); d.abs = (d.abs || 0) + Math.abs(cents);
      const per = (d.per = d.per || {});
      const st = (per[label] = per[label] || { n: 0, ok: 0, sum: 0, abs: 0 });
      st.n++; st.sum += cents; st.abs += Math.abs(cents); if (ok) st.ok++;
      dirtyRef.current = true;
    }
  };

  const save = () => {
    if (!dirtyRef.current) return;
    vtSave(LOG_KEY, JSON.stringify(daysRef.current));
    dirtyRef.current = false;
  };

  useEffect(() => {
    let prev = performance.now();
    // 1초마다: 메트로놈/드론 사용 시간, 최고 BPM, 목표 달성 확인, 화면 갱신
    const tick = setInterval(() => {
      const now = performance.now(), dt = now - prev; prev = now;
      const c = ctxRef.current || {}, d = today();
      if (dt < 5000) {
        if (c.metroPlaying) { d.metroMs += dt; d.bpmMax = Math.max(d.bpmMax, c.bpm || 0); dirtyRef.current = true; }
        if (c.droneActive) { d.droneMs += dt; dirtyRef.current = true; }
      }
      const hitKey = 'vt.log.goalHit';
      let hit = null; try { hit = localStorage.getItem(hitKey); } catch (_) {}
      if (practiceMs(d) >= goalRef.current * 60000 && hit !== dateKey()) {
        vtSave(hitKey, dateKey());
        c.onGoal?.(goalRef.current);
      }
      setVer(v => v + 1);
    }, 1000);
    const saver = setInterval(save, 10000);
    const onVis = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(tick); clearInterval(saver); document.removeEventListener('visibilitychange', onVis); save(); };
  }, []);

  const reset = () => {
    daysRef.current = {};
    try { localStorage.removeItem(LOG_KEY); localStorage.removeItem('vt.log.goalHit'); } catch (_) {}
    setVer(v => v + 1);
  };

  // 연속 연습일: 1분 이상 연습한 날이 오늘(또는 어제)부터 며칠 이어졌나
  const streak = () => {
    const days = daysRef.current;
    const d = new Date();
    if (practiceMs(days[dateKey(d)]) < 60000) d.setDate(d.getDate() - 1);
    let n = 0;
    while (practiceMs(days[dateKey(d)]) >= 60000) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };

  return { days: daysRef.current, today: today(), goalMin, setGoalMin, idleSec, setIdleSec, note, reset, streak };
};

// ── 화면 ──
const usePalette = () => {
  const vintage = useVintage();
  return vintage
    ? { vintage, accent: '#f6dd94', dim: 'rgba(244,227,181,.55)', text: '#f4e3b5', track: 'rgba(201,161,74,.18)',
        levels: ['rgba(201,161,74,.10)', '#6b4a12', '#9a7028', '#c9a14a', '#f6dd94'] }
    : { vintage, accent: 'var(--accent)', dim: '#6b7280', text: 'var(--ink)', track: 'var(--inset-bg)',
        levels: ['var(--inset-bg)', '#0f3d27', '#16794a', '#2fbf76', '#4afc9d'] };
};

const GoalRing = ({ ms, goalMin, size = 132 }) => {
  const P = usePalette();
  const pct = Math.min(1, ms / (goalMin * 60000));
  const r = 54, c = 2 * Math.PI * r;
  const done = pct >= 1;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke={P.track} strokeWidth="11"/>
        <circle cx="66" cy="66" r={r} fill="none" stroke={P.accent} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} style={{ transition: 'stroke-dasharray .6s', filter: done ? `drop-shadow(0 0 6px ${P.accent})` : 'none' }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black font-mono leading-none" style={{ color: P.text, fontSize: size * 0.2, fontFamily: P.vintage ? 'Georgia,serif' : undefined }}>
          {fmtClock(ms)}
        </span>
        <span className="text-[10px] font-bold mt-1" style={{ color: P.dim }}>{done ? '🎯 목표 달성' : `목표 ${goalMin}분`}</span>
      </div>
    </div>
  );
};

const Heatmap = ({ days, goalMin, selected, onSelect }) => {
  const P = usePalette();
  // 12주: 이번 주 일요일 끝 기준, 일요일 시작 열
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - start.getDay() - 7 * 11);
  const cols = [];
  for (let w = 0; w < 12; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + w * 7 + i);
      col.push(d);
    }
    cols.push(col);
  }
  const level = (ms) => {
    const m = ms / 60000;
    if (m < 1) return 0;
    if (m < goalMin * 0.34) return 1;
    if (m < goalMin * 0.67) return 2;
    if (m < goalMin) return 3;
    return 4;
  };
  const todayK = dateKey();
  return (
    <div className="flex gap-[3px]">
      <div className="flex flex-col gap-[3px] mr-1">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className="h-[15px] text-[8px] font-bold leading-[15px]" style={{ color: i % 2 ? P.dim : 'transparent' }}>{w}</span>
        ))}
      </div>
      {cols.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-[3px] flex-1">
          {col.map(d => {
            const k = dateKey(d);
            const future = d > end;
            const ms = practiceMs(days[k]);
            return (
              <button key={k} disabled={future} onClick={() => onSelect(k)}
                className="h-[15px] rounded-[3px] transition-transform active:scale-90"
                style={{
                  background: future ? 'transparent' : P.levels[level(ms)],
                  outline: k === selected ? `1.5px solid ${P.text}` : k === todayK ? `1px solid ${P.accent}` : 'none',
                  outlineOffset: 1,
                }}/>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const WeekBars = ({ days, goalMin }) => {
  const P = usePalette();
  const list = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); list.push(d); }
  const mins = list.map(d => practiceMs(days[dateKey(d)]) / 60000);
  const max = Math.max(goalMin * 1.2, ...mins, 1);
  const H = 96;
  const goalY = H - (goalMin / max) * H;
  return (
    <div className="relative" style={{ height: H + 18 }}>
      {/* 목표선 */}
      <div className="absolute inset-x-0 border-t border-dashed" style={{ top: goalY, borderColor: P.dim, opacity: 0.6 }}/>
      <div className="absolute inset-x-0 top-0 flex items-end justify-between gap-2" style={{ height: H }}>
        {mins.map((m, i) => {
          const isToday = i === 6;
          const hit = m >= goalMin;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              {m >= 1 && <span className="text-[8px] font-mono font-bold mb-0.5" style={{ color: isToday ? P.accent : P.dim }}>{Math.round(m)}</span>}
              <div className="w-full rounded-t-md transition-all duration-500"
                style={{ height: Math.max(2, (m / max) * H), background: hit || isToday ? P.accent : P.levels[2], opacity: isToday || hit ? 1 : 0.8 }}/>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-2">
        {list.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[9px] font-black" style={{ color: i === 6 ? P.accent : P.dim }}>
            {i === 6 ? '오늘' : WEEKDAYS[d.getDay()]}
          </span>
        ))}
      </div>
    </div>
  );
};

const StatRow = ({ label, ms, color }) => {
  const P = usePalette();
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="flex items-center gap-1.5 font-bold" style={{ color: P.dim }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }}/>{label}
      </span>
      <span className="font-mono font-black" style={{ color: P.text }}>{fmtDur(ms)}</span>
    </div>
  );
};

const Step = ({ value, unit, onDec, onInc }) => {
  const P = usePalette();
  return (
    <div className="flex items-center t-chip rounded-full">
      <button onClick={onDec} className="px-2.5 py-1.5" style={{ color: P.dim }}><Minus size={13}/></button>
      <span className="text-xs font-black font-mono min-w-[44px] text-center" style={{ color: P.text }}>{value}{unit}</span>
      <button onClick={onInc} className="px-2.5 py-1.5" style={{ color: P.dim }}><Plus size={13}/></button>
    </div>
  );
};

const PracticeLog = ({ log }) => {
  const P = usePalette();
  const { days, today, goalMin, setGoalMin, idleSec, setIdleSec, reset, streak } = log;
  const [sel, setSel] = useState(dateKey());
  const [confirmReset, setConfirmReset] = useState(false);
  const total = practiceMs(today);
  const selDay = days[sel];
  const selDate = new Date(sel + 'T00:00:00');
  const n = streak();

  return (
    <div className="w-full h-full flex flex-col gap-2.5 tab-enter overflow-y-auto pb-2">
      {/* 상단 */}
      <div className="w-full flex items-center justify-between shrink-0 h-10">
        <span className="text-sm font-black tracking-widest" style={{ color: P.text, fontFamily: P.vintage ? 'Georgia,serif' : undefined }}>
          연습 기록
        </span>
        <span className="flex items-center gap-1 t-chip px-3 py-1.5 rounded-full text-xs font-black" style={{ color: n ? '#fb923c' : P.dim }}>
          <Flame size={13}/> {n}일 연속
        </span>
      </div>

      {/* 오늘 카드 */}
      <div className="w-full t-panel rounded-3xl p-4 flex items-center gap-4 shrink-0">
        <GoalRing ms={total} goalMin={goalMin}/>
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[10px] font-black tracking-widest mb-0.5" style={{ color: P.dim }}>오늘</span>
          <StatRow label="연주" ms={today.playMs} color={P.accent}/>
          <StatRow label="튜닝" ms={today.tuneMs} color="#38bdf8"/>
          <StatRow label="메트로놈" ms={today.metroMs} color="#ffcc00"/>
          <StatRow label="드론" ms={today.droneMs} color="#a78bfa"/>
          {today.bpmMax > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold" style={{ color: P.dim }}>최고 BPM</span>
              <span className="font-mono font-black" style={{ color: P.text }}>{today.bpmMax}</span>
            </div>
          )}
        </div>
      </div>

      {/* 12주 달력 */}
      <div className="w-full t-panel rounded-3xl p-4 shrink-0 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black tracking-widest" style={{ color: P.dim }}>최근 12주</span>
          <span className="text-[11px] font-bold" style={{ color: P.text }}>
            {selDate.getMonth() + 1}월 {selDate.getDate()}일 ({WEEKDAYS[selDate.getDay()]}) · {fmtDur(practiceMs(selDay))}
          </span>
        </div>
        <Heatmap days={days} goalMin={goalMin} selected={sel} onSelect={setSel}/>
        <div className="flex items-center justify-end gap-1 text-[8px] font-bold" style={{ color: P.dim }}>
          적게 {P.levels.map((c, i) => <span key={i} className="w-2.5 h-2.5 rounded-[2px]" style={{ background: c }}/>)} 목표
        </div>
      </div>

      {/* 요일별 */}
      <div className="w-full t-panel rounded-3xl p-4 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black tracking-widest" style={{ color: P.dim }}>최근 7일 (분)</span>
          <span className="text-[9px] font-bold" style={{ color: P.dim }}>- - - 목표 {goalMin}분</span>
        </div>
        <WeekBars days={days} goalMin={goalMin}/>
      </div>

      {/* 설정 */}
      <div className="w-full t-inset rounded-3xl p-4 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold" style={{ color: P.text }}>하루 목표</span>
          <Step value={goalMin} unit="분" onDec={() => setGoalMin(v => Math.max(5, v - 5))} onInc={() => setGoalMin(v => Math.min(300, v + 5))}/>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold" style={{ color: P.text }}>쉬는 시간 판정</span>
            <span className="text-[9px]" style={{ color: P.dim }}>소리가 이보다 오래 없으면 연습 시간에서 뺌</span>
          </div>
          <Step value={idleSec} unit="초" onDec={() => setIdleSec(v => Math.max(3, v - 1))} onInc={() => setIdleSec(v => Math.min(120, v + 1))}/>
        </div>
        <button onClick={() => { if (confirmReset) { reset(); setConfirmReset(false); haptic(40); } else { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); } }}
          className="flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold border"
          style={{ color: confirmReset ? '#ef4444' : P.dim, borderColor: confirmReset ? '#ef4444' : 'var(--chip-border)' }}>
          <Trash2 size={12}/> {confirmReset ? '한 번 더 누르면 전체 기록 삭제' : '기록 초기화'}
        </button>
        <p className="text-[9px] leading-snug" style={{ color: P.dim }}>
          바이올린 소리가 들리는 동안 자동으로 기록됩니다 (앱 화면이 켜져 있을 때만). 연습 시간 = 연주 + 튜닝.
          튜너 탭에서 개방현(G3·D4·A4·E5)은 튜닝으로 셉니다.
        </p>
      </div>
    </div>
  );
};
