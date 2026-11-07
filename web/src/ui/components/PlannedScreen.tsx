import type { ReactNode } from 'react';

// 아직 구현 전인 화면: 무엇이 언제 들어오는지 보여줌 (단계별 개발 중 임시)
export function PlannedScreen({ icon, title, lead, items }: {
  icon: ReactNode; title: string; lead: string; items: { name: string; desc: string; stage: number }[];
}) {
  return (
    <div className="h-full overflow-y-auto flex flex-col gap-3 pb-4 tab-in">
      <div className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent/15 text-accent flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h2 className="text-lg font-black font-display">{title}</h2>
          <p className="text-xs text-dim leading-relaxed">{lead}</p>
        </div>
      </div>
      {items.map((it) => (
        <div key={it.name} className="inset px-4 py-3 flex items-center gap-3">
          <span className="text-[10px] font-black px-2 py-1 rounded-pill bg-chip border border-line text-dim shrink-0">{it.stage}단계</span>
          <div className="min-w-0">
            <div className="text-sm font-bold">{it.name}</div>
            <div className="text-[11px] text-dim leading-snug">{it.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
