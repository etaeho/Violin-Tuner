import { Gauge as GaugeIcon, Music, Waves } from 'lucide-react';
import { useSettings, type ModuleId } from '@/store/settings';
import { useMetro } from '@/store/metro';
import { useDrone } from '@/store/drone';
import { haptic } from '@/ui/haptic';
import { Gauge } from './Gauge';
import { MetroCard } from './MetroCard';
import { DroneCard } from './DroneCard';

const MODULES: { id: ModuleId; label: string; Icon: typeof Music }[] = [
  { id: 'gauge', label: '음정 게이지', Icon: GaugeIcon },
  { id: 'metro', label: '박자', Icon: Music },
  { id: 'drone', label: '드론', Icon: Waves },
];

// 연습: 필요한 모듈만 켜서 한 화면에 (예: 드론+게이지 = 음정 연습, 박자+게이지 = 스케일)
export function PracticeScreen() {
  const { modules, toggleModule } = useSettings();
  const metroPlaying = useMetro((s) => s.playing);
  const dronePlaying = useDrone((s) => s.playing);
  const sounding: Record<ModuleId, boolean> = { gauge: false, metro: metroPlaying, drone: dronePlaying };
  return (
    <div className="h-full overflow-y-auto flex flex-col gap-3 pb-4 tab-in">
      <div className="flex gap-2 shrink-0">
        {MODULES.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => { toggleModule(id); haptic(8); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-pill text-xs font-black border transition-colors ${modules[id] ? 'bg-accent/15 text-accent border-accent/50' : 'border-line text-dim'}`}>
            <Icon size={14} />{label}
            {sounding[id] && <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />}
          </button>
        ))}
      </div>
      {modules.gauge && <Gauge />}
      {modules.metro && <MetroCard />}
      {modules.drone && <DroneCard />}
      {!modules.gauge && !modules.metro && !modules.drone && (
        <p className="text-center text-xs text-dim mt-8">위에서 쓸 모듈을 켜세요</p>
      )}
    </div>
  );
}
