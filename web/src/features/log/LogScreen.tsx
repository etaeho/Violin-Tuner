import { useState } from 'react';
import { Flame, Minus, Plus, Trash2 } from 'lucide-react';
import { useLog, todayStats } from '@/store/log';
import { useSettings } from '@/store/settings';
import { useFingerboard } from '@/store/fingerboard';
import { accuracy, dateKey, mergePer, practiceMs, streak, worstNotes, type DayStats } from '@/music/practiceLog';
import { pretty } from '@/music/keys';
import { haptic } from '@/ui/haptic';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const fmtDur = (ms: number) => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : m >= 1 ? `${m}분` : `${Math.floor(ms / 1000)}초`; };
const fmtClock = (ms: number) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };

export function LogScreen() {
  const { days, goalMin, idleSec, setGoal, setIdle, reset } = useLog();
  useLog((s) => s.tick);                 // 1초마다 다시 그림
  const today = todayStats();
  const [sel, setSel] = useState(dateKey());
  const [confirm, setConfirm] = useState(false);
  const total = practiceMs(today);
  const acc = accuracy(today);
  const worst = worstNotes(mergePer(days, 30));
  const selD = new Date(sel + 'T00:00:00');

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-3 pb-4 tab-in">
      {/* 오늘 */}
      <div className="card p-4 flex items-center gap-4">
        <GoalRing ms={total} goalMin={goalMin} />
        <div className="flex-1 flex flex-col gap-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest text-dim">오늘</span>
            <span className={`flex items-center gap-1 font-black ${streak(days) ? 'text-warn' : 'text-dim'}`}><Flame size={12} />{streak(days)}일 연속</span>
          </div>
          <Row label="연주" value={fmtDur(today.playMs)} dot="bg-accent" />
          <Row label="튜닝" value={fmtDur(today.tuneMs)} dot="bg-flat" />
          <Row label="박자" value={fmtDur(today.metroMs)} dot="bg-warn" />
          <Row label="드론" value={fmtDur(today.droneMs)} dot="bg-sharp" />
          <Row label="음정 정확도" value={acc === null ? '—' : `${Math.round(acc * 100)}% (${today.notes}음)`} dot="bg-good" />
        </div>
      </div>

      {/* 12주 */}
      <div className="card p-4 flex flex-col gap-2.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black tracking-widest text-dim">최근 12주</span>
          <span className="text-[11px] font-bold">{selD.getMonth() + 1}월 {selD.getDate()}일 ({WEEK[selD.getDay()]}) · {fmtDur(practiceMs(days[sel]))}
            {accuracy(days[sel]) !== null && <span className="text-dim"> · 정확도 {Math.round(accuracy(days[sel])! * 100)}%</span>}</span>
        </div>
        <Heatmap days={days} goalMin={goalMin} sel={sel} onSel={setSel} />
      </div>

      {/* 7일 */}
      <div className="card p-4 flex flex-col gap-2">
        <div className="flex justify-between text-[10px] font-black tracking-widest text-dim"><span>최근 7일 (분)</span><span>- - - 목표 {goalMin}분 · ● 정확도</span></div>
        <WeekBars days={days} goalMin={goalMin} />
      </div>

      {/* 30일 정확도 */}
      <div className="card p-4 flex flex-col gap-2">
        <span className="text-[10px] font-black tracking-widest text-dim">음정 정확도 · 최근 30일</span>
        <AccuracyLine days={days} />
      </div>

      {/* 자주 틀리는 음 */}
      <div className="card p-4 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black tracking-widest text-dim">자주 틀리는 음 · 최근 30일</span>
          <button onClick={() => { useFingerboard.getState().setHeat(true); useSettings.getState().setTab('fingerboard'); haptic(8); }}
            className="chip px-2.5 py-1 text-[10px] font-black text-accent">지판에서 보기</button>
        </div>
        {worst.length ? worst.map((w) => (
          <div key={w.label} className="flex items-center gap-3 text-sm">
            <span className="w-12 font-black font-display">{pretty(w.label)}</span>
            <span className={`font-black font-mono w-16 whitespace-nowrap ${w.mean > 0 ? 'text-sharp' : 'text-flat'}`}>{w.mean > 0 ? '▲ +' : '▼ '}{w.mean.toFixed(0)}¢</span>
            <div className="flex-1 h-1.5 bg-inset rounded-full overflow-hidden"><div className="h-full bg-good" style={{ width: `${w.acc * 100}%` }} /></div>
            <span className="text-[10px] text-dim w-[72px] text-right whitespace-nowrap">{Math.round(w.acc * 100)}% · {w.n}회</span>
          </div>
        )) : <p className="text-xs text-dim">같은 음을 5번 이상 연주하면 여기에 나옵니다.</p>}
      </div>

      {/* 설정 */}
      <div className="inset p-4 flex flex-col gap-3">
        <Stepper label="하루 목표" value={`${goalMin}분`} onDec={() => setGoal(goalMin - 5)} onInc={() => setGoal(goalMin + 5)} />
        <Stepper label="쉬는 시간 판정" hint="소리가 이보다 오래 없으면 연습 시간에서 뺌" value={`${idleSec}초`} onDec={() => setIdle(idleSec - 1)} onInc={() => setIdle(idleSec + 1)} />
        <button onClick={() => { if (confirm) { reset(); setConfirm(false); haptic(40); } else { setConfirm(true); setTimeout(() => setConfirm(false), 3000); } }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-pill text-xs font-bold border ${confirm ? 'text-sharp border-sharp' : 'text-dim border-line'}`}>
          <Trash2 size={12} />{confirm ? '한 번 더 누르면 전체 기록 삭제' : '기록 초기화'}
        </button>
        <p className="text-[10px] text-dim leading-snug">바이올린 소리가 들리는 동안 자동 기록 (앱 화면이 켜져 있을 때). 연습 시간 = 연주 + 튜닝. 튜닝 탭의 개방현은 튜닝으로 세고 정확도에서 뺍니다.</p>
      </div>
    </div>
  );
}

function Row({ label, value, dot }: { label: string; value: string; dot: string }) {
  return <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 font-bold text-dim"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}</span><span className="font-mono font-black">{value}</span></div>;
}

function Stepper({ label, hint, value, onDec, onInc }: { label: string; hint?: string; value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col"><span className="text-xs font-bold">{label}</span>{hint && <span className="text-[9px] text-dim">{hint}</span>}</div>
      <div className="chip flex items-center">
        <button onClick={onDec} className="px-2.5 py-1.5 text-dim"><Minus size={13} /></button>
        <span className="text-xs font-black font-mono min-w-[44px] text-center">{value}</span>
        <button onClick={onInc} className="px-2.5 py-1.5 text-dim"><Plus size={13} /></button>
      </div>
    </div>
  );
}

function GoalRing({ ms, goalMin }: { ms: number; goalMin: number }) {
  const pct = Math.min(1, ms / (goalMin * 60000)), r = 54, c = 2 * Math.PI * r, done = pct >= 1;
  return (
    <div className="relative w-[128px] h-[128px] shrink-0">
      <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgb(var(--inset))" strokeWidth="11" />
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgb(var(--accent))" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} style={{ transition: 'stroke-dasharray .6s', filter: done ? 'drop-shadow(0 0 6px rgb(var(--accent)))' : 'none' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black font-mono font-display">{fmtClock(ms)}</span>
        <span className="text-[10px] font-bold text-dim mt-1">{done ? '🎯 목표 달성' : `목표 ${goalMin}분`}</span>
      </div>
    </div>
  );
}

function Heatmap({ days, goalMin, sel, onSel }: { days: Record<string, DayStats>; goalMin: number; sel: string; onSel: (k: string) => void }) {
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - start.getDay() - 7 * 11);
  const level = (ms: number) => { const m = ms / 60000; return m < 1 ? 0 : m < goalMin / 3 ? 1 : m < (goalMin * 2) / 3 ? 2 : m < goalMin ? 3 : 4; };
  const shade = ['rgb(var(--inset))', 'rgb(var(--accent) / .22)', 'rgb(var(--accent) / .45)', 'rgb(var(--accent) / .7)', 'rgb(var(--accent))'];
  const todayK = dateKey();
  return (
    <div className="flex gap-[3px]">
      <div className="flex flex-col gap-[3px] mr-1">{WEEK.map((w, i) => <span key={w} className="h-[15px] text-[8px] font-bold leading-[15px]" style={{ color: i % 2 ? 'rgb(var(--dim))' : 'transparent' }}>{w}</span>)}</div>
      {Array.from({ length: 12 }, (_, w) => (
        <div key={w} className="flex-1 flex flex-col gap-[3px]">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start); d.setDate(start.getDate() + w * 7 + i);
            const k = dateKey(d), future = d > end;
            return <button key={k} disabled={future} onClick={() => onSel(k)} className="h-[15px] rounded-[3px] active:scale-90"
              style={{ background: future ? 'transparent' : shade[level(practiceMs(days[k]))], outline: k === sel ? '1.5px solid rgb(var(--ink))' : k === todayK ? '1px solid rgb(var(--accent))' : 'none', outlineOffset: 1 }} />;
          })}
        </div>
      ))}
    </div>
  );
}

function WeekBars({ days, goalMin }: { days: Record<string, DayStats>; goalMin: number }) {
  const list = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const mins = list.map((d) => practiceMs(days[dateKey(d)]) / 60000);
  const accs = list.map((d) => accuracy(days[dateKey(d)]));
  const H = 96, max = Math.max(goalMin * 1.2, ...mins, 1), gy = H - (goalMin / max) * H;
  return (
    <div className="relative" style={{ height: H + 18 }}>
      <div className="absolute inset-x-0 border-t border-dashed border-dim/60" style={{ top: gy }} />
      <div className="absolute inset-x-0 top-0 flex items-end justify-between gap-2" style={{ height: H }}>
        {mins.map((m, i) => (
          <div key={i} className="relative flex-1 flex flex-col items-center justify-end h-full">
            {accs[i] !== null && <span className="absolute w-2 h-2 rounded-full bg-good border border-panel" style={{ bottom: `${accs[i]! * 100}%`, transform: 'translateY(50%)' }} />}
            {m >= 1 && <span className={`text-[8px] font-mono font-bold mb-0.5 ${i === 6 ? 'text-accent' : 'text-dim'}`}>{Math.round(m)}</span>}
            <div className="w-full rounded-t-md transition-all duration-500" style={{ height: Math.max(2, (m / max) * H), background: m >= goalMin || i === 6 ? 'rgb(var(--accent))' : 'rgb(var(--accent) / .4)' }} />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-2">
        {list.map((d, i) => <span key={i} className={`flex-1 text-center text-[9px] font-black ${i === 6 ? 'text-accent' : 'text-dim'}`}>{i === 6 ? '오늘' : WEEK[d.getDay()]}</span>)}
      </div>
    </div>
  );
}

function AccuracyLine({ days }: { days: Record<string, DayStats> }) {
  const pts = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return accuracy(days[dateKey(d)]); });
  const W = 300, H = 80;
  const xy = pts.map((a, i) => (a === null ? null : [(i / 29) * W, H - a * H] as const));
  const path = xy.reduce((s, p, i) => (p ? s + `${s && xy[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} ` : s), '');
  if (!xy.some(Boolean)) return <p className="text-xs text-dim">연주하면 날마다 맞은 음 비율이 그려집니다.</p>;
  return (
    <svg viewBox={`0 -6 ${W} ${H + 12}`} className="w-full h-24">
      {[0.5, 0.8, 1].map((y) => <g key={y}><line x1="0" x2={W} y1={H - y * H} y2={H - y * H} stroke="rgb(var(--line))" strokeDasharray="3 3" /><text x={W} y={H - y * H - 2} textAnchor="end" fontSize="8" fill="rgb(var(--dim))">{y * 100}%</text></g>)}
      <path d={path} fill="none" stroke="rgb(var(--good))" strokeWidth="2" />
      {xy.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={i === 29 ? 3.5 : 2} fill="rgb(var(--good))" />)}
    </svg>
  );
}
