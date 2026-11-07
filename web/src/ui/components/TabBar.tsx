import { Activity, LayoutGrid, Music, BarChart3 } from 'lucide-react';
import type { TabId } from '@/store/settings';
import { useSettings } from '@/store/settings';
import { haptic } from '@/ui/haptic';

export const TABS: { id: TabId; label: string; Icon: typeof Activity }[] = [
  { id: 'tuning', label: '튜닝', Icon: Activity },
  { id: 'practice', label: '연습', Icon: Music },
  { id: 'fingerboard', label: '지판', Icon: LayoutGrid },
  { id: 'log', label: '기록', Icon: BarChart3 },
];

export function TabBar() {
  const tab = useSettings((s) => s.tab);
  const setTab = useSettings((s) => s.setTab);
  return (
    <nav className="shrink-0 flex justify-around bg-panel/95 backdrop-blur border-t border-line pt-1.5"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      {TABS.map(({ id, label, Icon }) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => { if (!on) { setTab(id); haptic(12); } }}
            className={`flex flex-col items-center gap-0.5 min-w-[64px] py-1 rounded-2xl transition-colors active:scale-90 ${on ? 'text-accent' : 'text-dim'}`}>
            <span className={`w-1 h-1 rounded-full mb-0.5 ${on ? 'bg-accent' : 'bg-transparent'}`} />
            <Icon size={22} strokeWidth={on ? 2.5 : 2} />
            <span className="text-[10px] font-black tracking-wider">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
