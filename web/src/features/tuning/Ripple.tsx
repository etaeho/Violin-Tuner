// "울림": 음정이 벗어날수록 원 둘레의 물결이 커지고 빨라짐, 맞으면 잔잔한 원 + 빛
export function Ripple({ cents, active, perfect, color }: { cents: number; active: boolean; perfect: boolean; color: string }) {
  if (!active) return null;
  const amp = perfect ? 0 : Math.min(5, Math.abs(cents) / 6 + 0.8);
  const R = 31, N = 9, pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const r = R + amp * Math.sin(a * N);
    pts.push(`${(36 + r * Math.cos(a)).toFixed(2)},${(36 + r * Math.sin(a)).toFixed(2)}`);
  }
  // 많이 벗어날수록 빠르게 회전 (맥놀이가 빨라지는 느낌)
  const dur = perfect ? 0 : Math.max(0.6, 4 - Math.abs(cents) / 10);
  return (
    <svg viewBox="0 0 72 72" className="absolute -inset-[6px] w-[72px] h-[72px] pointer-events-none"
      style={{ animation: dur ? `spin ${dur}s linear infinite` : 'none', filter: perfect ? `drop-shadow(0 0 6px ${color})` : 'none' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={perfect ? 2.5 : 1.8} strokeOpacity={perfect ? 1 : 0.8} />
    </svg>
  );
}
