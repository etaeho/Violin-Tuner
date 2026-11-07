// ==========================================================
// 음정 검출 — McLeod NSDF (v1 core.jsx detectPitch 이식)
// 2단계에서 AudioWorklet 안에서 그대로 사용 (DOM 의존 없음)
// ==========================================================
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface PitchResult { freq: number; clarity: number; rms: number }

/** buf: 시간 영역 샘플, 반환 freq = -1 이면 음정 없음 */
export function detectPitch(buf: Float32Array, sampleRate: number, minFreq = 180, maxFreq = 3500): PitchResult {
  const N = buf.length;
  let sum = 0;
  for (let i = 0; i < N; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / N);
  if (rms < 1e-5) return { freq: -1, clarity: 0, rms };

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(Math.floor(N / 2), Math.ceil(sampleRate / minFreq));
  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = 0; tau <= maxLag + 1; tau++) {
    let acf = 0, m = 0;
    for (let j = 0; j < N - tau; j++) { const a = buf[j], b = buf[j + tau]; acf += a * b; m += a * a + b * b; }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }
  // 0 근처의 첫 양수 구간은 건너뜀
  let tau = 1;
  while (tau < maxLag && nsdf[tau] > 0) tau++;
  if (tau < minLag) tau = minLag;
  const peaks: number[] = [];
  let best = -1, bestTau = -1;
  for (; tau <= maxLag; tau++) {
    if (nsdf[tau] > 0) { if (nsdf[tau] > best) { best = nsdf[tau]; bestTau = tau; } }
    else if (bestTau > 0) { peaks.push(bestTau); best = -1; bestTau = -1; }
  }
  if (bestTau > 0) peaks.push(bestTau);
  if (!peaks.length) return { freq: -1, clarity: 0, rms };

  let maxPeak = 0;
  for (const t of peaks) if (nsdf[t] > maxPeak) maxPeak = nsdf[t];
  const chosen = peaks.find((t) => nsdf[t] >= 0.9 * maxPeak)!;
  // 포물선 보간
  const y1 = nsdf[chosen - 1], y2 = nsdf[chosen], y3 = nsdf[chosen + 1];
  const a = (y1 + y3 - 2 * y2) / 2, b = (y3 - y1) / 2;
  let T0 = chosen, clarity = y2;
  if (a < 0) { T0 = chosen - b / (2 * a); clarity = y2 - (b * b) / (4 * a); }
  return { freq: sampleRate / T0, clarity: Math.min(1, clarity), rms };
}

export interface NoteInfo { name: string; octave: number; cents: number; semitone: number; label: string }

/** 주파수 → 가장 가까운 평균율 음 + 센트 (A4 기준) */
export function freqToNote(freq: number, a4 = 442): NoteInfo {
  const exact = 12 * Math.log2(freq / a4);
  const semitone = Math.round(exact);
  const cents = Math.round((exact - semitone) * 100);
  const midi = semitone + 69;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { name, octave, cents, semitone, label: `${name}${octave}` };
}

export const rmsToDb = (r: number) => (r > 0 ? 20 * Math.log10(r) : -100);
