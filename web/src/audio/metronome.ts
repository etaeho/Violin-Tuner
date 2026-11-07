// ==========================================================
// 메트로놈 엔진: 오디오 시계 기준 예약(lookahead) 방식 → 화면이 바빠도 박이 흔들리지 않음
// 딸깍 시각을 기록해 튜너가 그 순간 분석을 건너뛰게 함 (isNearClick)
// ==========================================================
import { outCtx, outLatencyMs } from './out';

/** 박 소리: 0 무음 · 1 약박 · 3 중강박 · 2 강박 */
export type Accent = 0 | 1 | 2 | 3;
export interface MetroPattern { bpm: number; num: number; den: number; accents: Accent[]; subdivs: number[] }

export const DEN_OPTIONS = [2, 4, 8, 16];

export function defaultAccents(num: number): Accent[] {
  const m: Record<number, Accent[]> = {
    2: [2, 1], 3: [2, 1, 1], 4: [2, 1, 1, 1], 5: [2, 1, 2, 1, 1], 6: [2, 1, 1, 3, 1, 1],
    7: [2, 1, 1, 2, 1, 2, 1], 8: [2, 1, 1, 3, 1, 1, 3, 1], 9: [2, 1, 1, 3, 1, 1, 3, 1, 1], 12: [2, 1, 1, 3, 1, 1, 2, 1, 1, 3, 1, 1],
  };
  if (m[num]) return m[num];
  const a = Array(num).fill(1) as Accent[]; a[0] = 2; return a;
}

/** 한 칸(세분박 포함) 길이(초) */
export const tickSeconds = (p: MetroPattern, beat: number) =>
  (60 / p.bpm) * (4 / p.den) / Math.max(1, p.subdivs[beat] || 1);

/** 다음 칸 위치 */
export function nextStep(beat: number, sub: number, p: MetroPattern) {
  const subs = Math.max(1, p.subdivs[beat] || 1);
  if (sub + 1 < subs) return { beat, sub: sub + 1, newBar: false };
  const nb = (beat + 1) % p.num;
  return { beat: nb, sub: 0, newBar: nb === 0 };
}

/** 점진 템포: 시작 BPM에서 every마디마다 +step, 최대 max */
export const progressiveBpm = (start: number, bars: number, step: number, every: number, max: number) =>
  Math.min(max, start + Math.floor(bars / Math.max(1, every)) * step);

// ── 딸깍 시각 공유 (튜너 분석 건너뛰기) ──
const clicks: number[] = [];
export const CLICK_GATE = { before: 20, after: 120 };
export function isNearClick(now: number, times: number[] = clicks): boolean {
  while (times.length && times[0] < now - 1000) times.shift();
  // 딸깍 간격이 250ms보다 촘촘하면(빠른 세분박) 건너뛰지 않음 → 신뢰도 필터에 맡김
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] < 250) return false;
  return times.some((c) => now >= c - CLICK_GATE.before && now <= c + CLICK_GATE.after);
}

// ── 엔진 ──
type TickCb = (beat: number, sub: number, delayMs: number) => void;

class MetronomeEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextTime = 0;
  private beat = 0;
  private sub = 0;
  playing = false;
  getPattern: () => MetroPattern = () => ({ bpm: 60, num: 4, den: 4, accents: [2, 1, 1, 1], subdivs: [1, 1, 1, 1] });
  onTick: TickCb | null = null;
  onBar: (() => void) | null = null;

  start() {
    if (this.playing) return;
    const ctx = outCtx();
    this.playing = true; this.beat = 0; this.sub = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.loop();
  }
  stop() { this.playing = false; if (this.timer) clearTimeout(this.timer); this.timer = null; }
  /** 박자표 등이 바뀌면 처음 박부터 */
  restart() { if (this.playing) { this.stop(); this.start(); } }

  private loop = () => {
    if (!this.playing) return;
    const ctx = outCtx();
    while (this.nextTime < ctx.currentTime + 0.1) {
      const p = this.getPattern();
      if (this.beat >= p.num) { this.beat = 0; this.sub = 0; }
      this.schedule(ctx, p, this.beat, this.sub, this.nextTime);
      this.nextTime += tickSeconds(p, this.beat);
      const n = nextStep(this.beat, this.sub, p);
      this.beat = n.beat; this.sub = n.sub;
      if (n.newBar) this.onBar?.();
    }
    this.timer = setTimeout(this.loop, 25);
  };

  private schedule(ctx: AudioContext, p: MetroPattern, beat: number, sub: number, time: number) {
    const delayMs = (time - ctx.currentTime) * 1000;
    this.onTick?.(beat, sub, delayMs);
    const kind = sub === 0 ? p.accents[beat] : -1;     // -1 = 세분박
    if (kind === 0) return;
    clicks.push(performance.now() + delayMs + outLatencyMs());
    const freq = kind === 2 ? 2000 : kind === 3 ? 1500 : kind === 1 ? 1000 : 1200;
    const vol = kind === 2 ? 1 : kind === 3 ? 0.85 : kind === 1 ? 0.7 : 0.45;
    const dur = kind === -1 ? 0.02 : 0.04;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'square'; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol * 0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(time); osc.stop(time + dur + 0.01);
  }
}

export const metronome = new MetronomeEngine();
