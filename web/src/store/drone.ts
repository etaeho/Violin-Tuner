// 드론 설정 — 저장('vt2.drone'), 재생 상태는 저장 안 함
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { drone, DRONE_INTERVALS, type DroneCfg, type IntervalId, type Timbre } from '@/audio/drone';
import { useTuner } from './tuner';
import { haptic } from '@/ui/haptic';

interface DroneState {
  cfg: DroneCfg; playing: boolean;
  update: (p: Partial<DroneCfg>) => void;
  toggleInterval: (id: IntervalId) => void;
  setTimbre: (t: Timbre) => void;
  toggle: () => void; stop: () => void;
}

export const DEFAULT_DRONE: DroneCfg = {
  root: 'D', octave: 4, intervals: { fifth: true, octave: false, maj3: false, min3: false }, timbre: 'cello', volume: 0.6, fade: 1,
};

export const useDrone = create<DroneState>()(
  persist(
    (set, get) => {
      const apply = (cfg: DroneCfg, sound = true) => {
        set({ cfg });
        if (sound) drone.update(cfg, useTuner.getState().a4);
      };
      return {
        cfg: DEFAULT_DRONE, playing: false,
        update: (p) => { const cfg = { ...get().cfg, ...p }; if ('volume' in p) { set({ cfg }); drone.setVolume(cfg.volume); } else apply(cfg, !('fade' in p)); },
        toggleInterval: (id) => {
          const def = DRONE_INTERVALS.find((i) => i.id === id)!;
          const intervals = { ...get().cfg.intervals, [id]: !get().cfg.intervals[id] };
          if (intervals[id] && 'excl' in def) intervals[def.excl as IntervalId] = false;
          apply({ ...get().cfg, intervals }); haptic(8);
        },
        setTimbre: (timbre) => { apply({ ...get().cfg, timbre }); haptic(8); },
        toggle: () => {
          if (get().playing) { drone.stop(get().cfg.fade); set({ playing: false }); haptic(10); }
          else { drone.start(get().cfg, useTuner.getState().a4); set({ playing: true }); haptic(15); }
        },
        stop: () => { if (get().playing) { drone.stop(0.3); set({ playing: false }); } },
      };
    },
    { name: 'vt2.drone', version: 1, partialize: (s) => ({ cfg: s.cfg }) },
  ),
);

// A4가 바뀌면 드론 음높이도 따라감
useTuner.subscribe((s, prev) => { if (s.a4 !== prev.a4) drone.update(useDrone.getState().cfg, s.a4); });
