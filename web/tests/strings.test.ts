import { describe, it, expect } from 'vitest';
import { VIOLIN_STRINGS, nearestString, stringFreq } from '../src/audio/strings';

const byName = (n: string) => VIOLIN_STRINGS.find((s) => s.name === n)!;

describe('순정 5도 조율', () => {
  it('인접 현이 정확히 3:2', () => {
    const f = (n: string) => stringFreq(byName(n), 'pure', 442);
    expect(f('E5') / f('A4')).toBeCloseTo(1.5, 6);
    expect(f('A4') / f('D4')).toBeCloseTo(1.5, 6);
    expect(f('D4') / f('G3')).toBeCloseTo(1.5, 6);
  });
  it('평균율 대비 E +2¢, D −2¢, G −4¢', () => {
    expect(byName('E5').pureCents).toBeCloseTo(1.955, 2);
    expect(byName('D4').pureCents).toBeCloseTo(-1.955, 2);
    expect(byName('G3').pureCents).toBeCloseTo(-3.91, 2);
  });
  it('순정 D에 맞춘 소리는 순정 모드에서 0¢, 평균율 모드에서 −2¢', () => {
    const semi = 12 * Math.log2(stringFreq(byName('D4'), 'pure', 442) / 442);
    expect(nearestString(semi, 'pure')).toMatchObject({ cents: 0 });
    expect(nearestString(semi, 'equal')).toMatchObject({ cents: -2 });
  });
  it('가장 가까운 현 찾기', () => {
    expect(nearestString(-12, 'equal').string.name).toBe('G3');   // A3
    expect(nearestString(-4, 'equal').string.name).toBe('D4');    // F4 (F#4는 A4가 더 가까움)
    expect(nearestString(5, 'equal').string.name).toBe('E5');     // D5
  });
});
