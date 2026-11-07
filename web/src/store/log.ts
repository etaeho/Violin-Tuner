// 연습 기록 — 하루 요약을 저장('vt2.log'). 계산은 music/practiceLog.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeStorage } from './storage';
import { PracticeAccumulator, dateKey, emptyDay, practiceMs, prune, type DayStats } from '@/music/practiceLog';
import { noteSinks, bridgeSinks } from './live';
import { useSettings } from './settings';
import { useTuner } from './tuner';
import { useMetro } from './metro';
import { useDrone } from './drone';
import { useUi } from './ui';
import { droneNotes } from '@/audio/drone';
import { haptic } from '@/ui/haptic';

interface LogState {
  days: Record<string, DayStats>;
  goalMin: number; idleSec: number; goalHit: string | null;
  tick: number;                                   // 화면 갱신용 (1초마다 +1)
  setGoal: (m: number) => void; setIdle: (s: number) => void; reset: () => void;
}

export const useLog = create<LogState>()(
  persist(
    (set) => ({
      days: {}, goalMin: 30, idleSec: 10, goalHit: null, tick: 0,
      setGoal: (goalMin) => set({ goalMin: Math.min(300, Math.max(5, goalMin)) }),
      setIdle: (idleSec) => set({ idleSec: Math.min(120, Math.max(3, idleSec)) }),
      reset: () => set({ days: {}, goalHit: null }),
    }),
    { name: 'vt2.log', version: 1, storage: safeStorage, partialize: (s) => ({ days: s.days, goalMin: s.goalMin, idleSec: s.idleSec, goalHit: s.goalHit }) },
  ),
);

/** 오늘 기록 (화면에서 읽기용, 저장 전 최신값 포함) */
export const todayStats = (): DayStats => useLog.getState().days[dateKey()] ?? emptyDay();

// ── 수집: 확정된 음 → 누적기 (메모리에서 바로 갱신, 5초마다 저장) ──
const acc = new PracticeAccumulator();
const today = () => {
  const days = useLog.getState().days, k = dateKey();
  if (!days[k]) useLog.setState({ days: { ...days, [k]: emptyDay() } });
  return useLog.getState().days[k];
};
let dirty = false;

noteSinks.add((label, cents, now) => {
  const d = useDrone.getState();
  acc.note(today(), label, cents, now, {
    tuningTab: useSettings.getState().tab === 'tuning',
    ignore: d.playing ? new Set(droneNotes(d.cfg).map((n) => n.replace(/\d+$/, ''))) : new Set(),
    tolerance: useTuner.getState().tolerance,
    idleMs: useLog.getState().idleSec * 1000,
  });
  dirty = true;
});
bridgeSinks.add((now) => acc.bridge(now));

let prev = performance.now();
setInterval(() => {
  const now = performance.now(), dt = now - prev; prev = now;
  const d = today(), m = useMetro.getState();
  if (dt < 5000) {
    if (m.playing) { d.metroMs += dt; d.bpmMax = Math.max(d.bpmMax, m.bpm); dirty = true; }
    if (useDrone.getState().playing) { d.droneMs += dt; dirty = true; }
  }
  const s = useLog.getState();
  if (practiceMs(d) >= s.goalMin * 60000 && s.goalHit !== dateKey()) {
    useLog.setState({ goalHit: dateKey() });
    haptic([60, 60, 60]); useUi.getState().show(`🎯 오늘 목표 ${s.goalMin}분 달성!`);
  }
  useLog.setState({ tick: s.tick + 1 });
}, 1000);

const flush = () => {
  if (!dirty) return;
  dirty = false;
  useLog.setState({ days: prune({ ...useLog.getState().days, [dateKey()]: { ...today() } }) });
};
setInterval(flush, 5000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
