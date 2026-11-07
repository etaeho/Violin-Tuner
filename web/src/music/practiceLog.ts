// ==========================================================
// 연습 기록 계산 (순수 로직 — 테스트 대상)
//  시간: 확정된 음 사이 간격이 idleMs보다 짧으면 연습 시간으로 더함 (연주/튜닝 구분)
//  정확도: 0.15초 이상 유지된 음 하나마다 그때의 센트를 기록 (튜닝 중 개방현·드론 음은 제외)
// ==========================================================
export interface NoteStat { n: number; ok: number; sum: number; abs: number }   // 횟수, 맞은 수, 센트 합, |센트| 합
export interface DayStats {
  playMs: number; tuneMs: number; metroMs: number; droneMs: number; bpmMax: number;
  notes: number; ok: number; abs: number; per: Record<string, NoteStat>;
}
export const emptyDay = (): DayStats => ({ playMs: 0, tuneMs: 0, metroMs: 0, droneMs: 0, bpmMax: 0, notes: 0, ok: 0, abs: 0, per: {} });
export const practiceMs = (d?: DayStats) => (d ? d.playMs + d.tuneMs : 0);

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const OPEN = new Set(['G3', 'D4', 'A4', 'E5']);
const NOTE_HOLD = 150, NOTE_GAP = 150;

export interface NoteCtx { tuningTab: boolean; ignore: Set<string>; tolerance: number; idleMs: number }

export class PracticeAccumulator {
  private lastNote = 0;
  private run: { label: string; start: number; counted: boolean } | null = null;
  private runLast = 0;

  /** 확정된 음이 들어올 때마다 (label 'A4', cents 평균율 기준) */
  note(day: DayStats, label: string, cents: number, now: number, c: NoteCtx) {
    const pc = label.replace(/\d+$/, '');
    if (c.ignore.has(pc)) return;                    // 드론이 내는 음 (스피커 소리일 수 있음)
    const tuning = c.tuningTab && OPEN.has(label);
    // 시간
    if (this.lastNote && now - this.lastNote < c.idleMs) day[tuning ? 'tuneMs' : 'playMs'] += now - this.lastNote;
    this.lastNote = now;
    // 음 하나 판정 (같은 음이 이어지는 동안은 한 번만)
    const continuing = this.run && this.run.label === label && now - this.runLast < NOTE_GAP;
    if (!continuing) this.run = { label, start: now, counted: false };
    this.runLast = now;
    if (!this.run!.counted && now - this.run!.start >= NOTE_HOLD && !tuning) {
      this.run!.counted = true;
      const ok = Math.abs(cents) <= c.tolerance;
      day.notes++; day.abs += Math.abs(cents); if (ok) day.ok++;
      const s = (day.per[label] ??= { n: 0, ok: 0, sum: 0, abs: 0 });
      s.n++; s.sum += cents; s.abs += Math.abs(cents); if (ok) s.ok++;
    }
  }
  /** 메트로놈 딸깍으로 분석이 잠깐 끊겨도 음·시간이 이어지게 */
  bridge(now: number) { if (this.run) this.runLast = now; if (this.lastNote) this.lastNote = now - 1; }
}

/** 연속 연습일 (1분 이상 한 날이 오늘/어제부터 며칠) */
export function streak(days: Record<string, DayStats>, today = new Date()): number {
  const d = new Date(today);
  if (practiceMs(days[dateKey(d)]) < 60000) d.setDate(d.getDate() - 1);
  let n = 0;
  while (practiceMs(days[dateKey(d)]) >= 60000) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** 최근 N일 합산 음별 통계 */
export function mergePer(days: Record<string, DayStats>, lastDays: number, today = new Date()) {
  const out: Record<string, NoteStat> = {};
  for (let i = 0; i < lastDays; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const day = days[dateKey(d)];
    if (!day) continue;
    for (const [k, s] of Object.entries(day.per)) {
      const o = (out[k] ??= { n: 0, ok: 0, sum: 0, abs: 0 });
      o.n += s.n; o.ok += s.ok; o.sum += s.sum; o.abs += s.abs;
    }
  }
  return out;
}

/** 자주 틀리는 음: 최소 minCount번 이상 연주한 음 중 평균 센트가 큰 순 */
export function worstNotes(per: Record<string, NoteStat>, minCount = 5, top = 5) {
  return Object.entries(per)
    .filter(([, s]) => s.n >= minCount)
    .map(([label, s]) => ({ label, mean: s.sum / s.n, acc: s.ok / s.n, n: s.n }))
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
    .slice(0, top);
}

export const accuracy = (d?: DayStats) => (d && d.notes ? d.ok / d.notes : null);

/** 오래된 날 정리 */
export function prune(days: Record<string, DayStats>, keepDays = 400, today = new Date()) {
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - keepDays);
  const ck = dateKey(cutoff);
  for (const k of Object.keys(days)) if (k < ck) delete days[k];
  return days;
}
