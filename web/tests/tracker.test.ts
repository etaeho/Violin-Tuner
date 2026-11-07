// 트래커(게이트·신뢰도·확정·평균·유지) 테스트
import { describe, it, expect } from 'vitest';
import { PitchTracker, DEFAULT_SENSITIVITY as S } from '../src/audio/tracker';

const loud = (freq: number, clarity = 0.97) => ({ freq, clarity, rms: 0.1 });     // -20 dB
const quiet = (freq: number) => ({ freq, clarity: 0.97, rms: 0.001 });            // -60 dB

describe('PitchTracker', () => {
  it('같은 음이 stableFrames번 연속이어야 확정', () => {
    const t = new PitchTracker();
    expect(t.push(loud(440), S, 0).freq).toBeNull();
    expect(t.push(loud(440), S, 21).freq).toBeNull();
    expect(t.push(loud(440), S, 42).freq).toBeCloseTo(440, 1);
  });

  it('한 번 튀는 잡음은 무시 (확정 음 유지)', () => {
    const t = new PitchTracker();
    for (let i = 0; i < 5; i++) t.push(loud(440), S, i * 21);
    expect(t.push(loud(700), S, 120).freq).toBeCloseTo(440, 1);
  });

  it('게이트보다 작은 소리는 무시', () => {
    const t = new PitchTracker();
    for (let i = 0; i < 6; i++) expect(t.push(quiet(440), S, i * 21).freq).toBeNull();
  });

  it('신뢰도가 낮으면 무시', () => {
    const t = new PitchTracker();
    for (let i = 0; i < 6; i++) expect(t.push(loud(440, 0.6), S, i * 21).freq).toBeNull();
  });

  it('소리가 끊겨도 holdMs 동안 유지, 그 뒤 사라짐', () => {
    const t = new PitchTracker();
    for (let i = 0; i < 5; i++) t.push(loud(440), S, i * 21);
    expect(t.push(quiet(0), S, 100 + S.holdMs - 50).freq).not.toBeNull();
    expect(t.push(quiet(0), S, 100 + S.holdMs + 50).freq).toBeNull();
  });

  it('평균으로 부드럽게 (흔들림 감소)', () => {
    const t = new PitchTracker();
    let f = 0;
    for (let i = 0; i < 20; i++) f = t.push(loud(i % 2 ? 441 : 439), S, i * 21).freq!;
    expect(Math.abs(f - 440)).toBeLessThan(0.5);
  });

  it('게이트 히스테리시스: 열린 뒤엔 3dB 아래까지 유지', () => {
    const t = new PitchTracker();
    const at = (db: number) => ({ freq: 440, clarity: 0.97, rms: 10 ** (db / 20) });
    expect(t.push(at(S.gateDb + 1), S, 0).level.gate).toBe(true);
    expect(t.push(at(S.gateDb - 2), S, 21).level.gate).toBe(true);
    expect(t.push(at(S.gateDb - 4), S, 42).level.gate).toBe(false);
  });
});
