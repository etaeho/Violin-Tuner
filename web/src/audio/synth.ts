// 기준음 재생 (톱니파 + 저역필터 → 현악기 비슷한 소리)
import { outCtx } from './out';

let ctx: AudioContext | null = null;
let cur: { osc: OscillatorNode; gain: GainNode } | null = null;
let guardUntil = 0;

const audio = () => (ctx = outCtx());

/** 기준음이 나오는 중(+끈 뒤 0.6초)인지 — 스피커 소리를 연주로 착각하지 않게 */
export const toneSounding = () => !!cur || performance.now() < guardUntil;

export function playTone(freq: number) {
  stopTone();
  const c = audio(), now = c.currentTime;
  const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
  const gain = c.createGain(); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.5, now + 0.08);
  osc.connect(lp); lp.connect(gain); gain.connect(c.destination); osc.start();
  cur = { osc, gain };
}

export function retuneTone(freq: number) {
  if (cur && ctx) cur.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.02);
}

export function stopTone() {
  if (!cur || !ctx) return;
  const now = ctx.currentTime;
  cur.gain.gain.cancelScheduledValues(now);
  cur.gain.gain.setValueAtTime(cur.gain.gain.value, now);
  cur.gain.gain.linearRampToValueAtTime(0, now + 0.08);
  cur.osc.stop(now + 0.12);
  cur = null;
  guardUntil = performance.now() + 600;
}
