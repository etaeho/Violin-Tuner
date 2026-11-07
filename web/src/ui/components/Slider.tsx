export function Slider({ label, value, display, min, max, step, onChange, hint }: {
  label: string; value: number; display?: string; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between items-baseline">
        <span className="text-xs font-bold">{label}</span>
        <span className="text-sm font-black font-mono">{display ?? value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="text-[10px] text-dim leading-snug">{hint}</span>}
    </label>
  );
}

// 가로 레벨 막대 + 흰 기준선 (입력 레벨 / 신뢰도)
export function Meter({ value, min, max, marker, active }: { value: number; min: number; max: number; marker: number; active: boolean }) {
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  return (
    <div className="relative h-3 w-full bg-inset rounded-full overflow-hidden border border-line">
      <div className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ${active ? 'bg-good' : 'bg-faint'}`} style={{ width: `${pct(value)}%` }} />
      <div className="absolute inset-y-0 w-[2px] bg-ink" style={{ left: `calc(${pct(marker)}% - 1px)` }} />
    </div>
  );
}
