// 소리 출력용 AudioContext 하나를 기준음·메트로놈·드론이 함께 사용
let ctx: AudioContext | null = null;
export function outCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
/** 출력 지연(ms) — 스피커에서 실제로 소리 나는 시각 계산용 */
export const outLatencyMs = () => ((ctx?.outputLatency || ctx?.baseLatency || 0) * 1000);
