export const haptic = (pattern: number | number[] = 10) => {
  try { navigator.vibrate?.(pattern); } catch { /* 지원 안 하는 기기 */ }
};
