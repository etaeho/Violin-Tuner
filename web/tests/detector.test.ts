// 합성 음원으로 음정 검출 검증 — CI에서 매번 실행 (npm test)
import { describe, it, expect } from 'vitest';
import { detectPitch, freqToNote } from '../src/audio/detector';

const SR = 48000, N = 2048, A4 = 442;
const hz = (semi: number, cents = 0) => A4 * 2 ** ((semi + cents / 100) / 12);

// 바이올린 비슷한 소리: 배음이 많은 톱니파 + 약간의 잡음
function violin(freq: number, amp = 0.3, noise = 0.01, seed = 1) {
  const b = new Float32Array(N);
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) * 2 - 1;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * freq * h * t) / h;   // 톱니파 근사
    b[i] = amp * 0.5 * v + noise * rnd();
  }
  return b;
}
const centsOff = (f: number, ref: number) => 1200 * Math.log2(f / ref);

describe('개방현 (G3 D4 A4 E5) 검출', () => {
  for (const [label, semi] of [['G3', -14], ['D4', -7], ['A4', 0], ['E5', 7]] as const) {
    it(`${label} ±2센트 이내, 옥타브 오류 없음`, () => {
      const r = detectPitch(violin(hz(semi)), SR);
      expect(r.freq).toBeGreaterThan(0);
      expect(Math.abs(centsOff(r.freq, hz(semi)))).toBeLessThan(2);
      expect(freqToNote(r.freq, A4).label).toBe(label);
      expect(r.clarity).toBeGreaterThan(0.9);
    });
  }
});

describe('센트 정밀도', () => {
  for (const c of [-30, -10, 5, 20]) {
    it(`A4 ${c > 0 ? '+' : ''}${c}¢ → 오차 1센트 이내`, () => {
      const r = detectPitch(violin(hz(0, c)), SR);
      expect(Math.abs(freqToNote(r.freq, A4).cents - c)).toBeLessThanOrEqual(1);
    });
  }
});

describe('잡음 · 무음', () => {
  it('흰 잡음은 신뢰도가 낮음 (< 0.6)', () => {
    let s = 7; const b = new Float32Array(N);
    for (let i = 0; i < N; i++) b[i] = (((s = (s * 9301 + 49297) % 233280) / 233280) * 2 - 1) * 0.2;
    expect(detectPitch(b, SR).clarity).toBeLessThan(0.6);
  });
  it('무음은 음정 없음', () => {
    expect(detectPitch(new Float32Array(N), SR).freq).toBe(-1);
  });
  it('작은 소리(-40dB)도 정확히', () => {
    const r = detectPitch(violin(hz(-7), 0.01, 0.0003), SR);
    expect(freqToNote(r.freq, A4).label).toBe('D4');
  });
});

describe('freqToNote', () => {
  it('A4=442 기준 이름·옥타브·센트', () => {
    expect(freqToNote(442, 442)).toMatchObject({ label: 'A4', cents: 0 });
    expect(freqToNote(hz(3, 12), 442)).toMatchObject({ label: 'C5', cents: 12 });
    expect(freqToNote(hz(-14, -8), 442)).toMatchObject({ label: 'G3', cents: -8 });
  });
});
