// 바이올린 현 · 조율 방식
// 순정 5도: A를 기준으로 5도(3:2 = 701.955¢)씩 쌓음 → 평균율 대비 E +1.96¢, D −1.96¢, G −3.91¢
export type TuningMode = 'equal' | 'pure';

export interface ViolinString { name: string; note: string; octave: number; semitone: number; pureCents: number }
const FIFTH = 1200 * Math.log2(3 / 2) - 700;   // ≈ 1.955¢

export const VIOLIN_STRINGS: ViolinString[] = [
  { name: 'G3', note: 'G', octave: 3, semitone: -14, pureCents: -2 * FIFTH },
  { name: 'D4', note: 'D', octave: 4, semitone: -7, pureCents: -FIFTH },
  { name: 'A4', note: 'A', octave: 4, semitone: 0, pureCents: 0 },
  { name: 'E5', note: 'E', octave: 5, semitone: 7, pureCents: FIFTH },
];

/** 현의 목표 음 (A4 기준 반음, 소수) */
export const stringTarget = (s: ViolinString, mode: TuningMode) => s.semitone + (mode === 'pure' ? s.pureCents / 100 : 0);

/** 목표 주파수 */
export const stringFreq = (s: ViolinString, mode: TuningMode, a4: number) => a4 * 2 ** (stringTarget(s, mode) / 12);

/** 지금 음(A4 기준 반음, 소수)에 가장 가까운 현과 그 현 목표 대비 센트 */
export function nearestString(semi: number, mode: TuningMode) {
  let best = VIOLIN_STRINGS[0], d = Infinity;
  for (const s of VIOLIN_STRINGS) {
    const dd = Math.abs(semi - stringTarget(s, mode));
    if (dd < d) { d = dd; best = s; }
  }
  return { string: best, cents: Math.round((semi - stringTarget(best, mode)) * 100) || 0 };   // -0 → 0
}
