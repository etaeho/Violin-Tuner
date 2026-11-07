// 메트로놈 상태 — 박자 설정은 저장('vt2.metro'), 재생/현재 박은 저장 안 함
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeStorage } from './storage';
import { metronome, defaultAccents, progressiveBpm, DEN_OPTIONS, type Accent } from '@/audio/metronome';
import { haptic } from '@/ui/haptic';

export interface Progressive { on: boolean; step: number; every: number; max: number }

interface MetroState {
  bpm: number; num: number; den: number; accents: Accent[]; subdivs: number[]; prog: Progressive;
  playing: boolean; beat: number; flash: 'main' | 'sub' | null; startBpm: number; bars: number;
  setBpm: (v: number) => void; nudge: (d: number) => void;
  changeNum: (d: number) => void; changeDen: (d: number) => void;
  cycleAccent: (i: number) => void; cycleSubdiv: (i: number) => void;
  setProg: (p: Partial<Progressive>) => void;
  toggle: () => void; start: () => void; stop: () => void; reset: () => void; tap: () => void;
}

const clampBpm = (v: number) => Math.min(250, Math.max(30, Math.round(v)));
const taps: number[] = [];

export const useMetro = create<MetroState>()(
  persist(
    (set, get) => ({
      bpm: 60, num: 4, den: 4, accents: [2, 1, 1, 1], subdivs: [1, 1, 1, 1],
      prog: { on: false, step: 2, every: 4, max: 120 },
      playing: false, beat: -1, flash: null, startBpm: 60, bars: 0,
      setBpm: (v) => set({ bpm: clampBpm(v), startBpm: clampBpm(v), bars: 0 }),
      nudge: (d) => get().setBpm(get().bpm + d),
      changeNum: (d) => {
        const num = Math.min(16, Math.max(1, get().num + d));
        const subdivs = Array.from({ length: num }, (_, i) => get().subdivs[i] ?? 1);
        set({ num, accents: defaultAccents(num), subdivs }); metronome.restart(); haptic(8);
      },
      changeDen: (d) => {
        const i = (DEN_OPTIONS.indexOf(get().den) + d + DEN_OPTIONS.length) % DEN_OPTIONS.length;
        set({ den: DEN_OPTIONS[i] }); metronome.restart(); haptic(8);
      },
      cycleAccent: (i) => {
        const order: Accent[] = [2, 3, 1, 0];
        const accents = [...get().accents];
        accents[i] = order[(order.indexOf(accents[i]) + 1) % order.length];
        set({ accents }); haptic(8);
      },
      cycleSubdiv: (i) => { const subdivs = [...get().subdivs]; subdivs[i] = subdivs[i] >= 4 ? 1 : subdivs[i] + 1; set({ subdivs }); haptic(8); },
      setProg: (p) => set({ prog: { ...get().prog, ...p } }),
      start: () => { set({ startBpm: get().bpm, bars: 0, playing: true }); metronome.start(); haptic(20); },
      stop: () => { metronome.stop(); set({ playing: false, beat: -1, flash: null }); haptic(10); },
      toggle: () => (get().playing ? get().stop() : get().start()),
      reset: () => { set({ bpm: 60, startBpm: 60, num: 4, den: 4, accents: [2, 1, 1, 1], subdivs: [1, 1, 1, 1] }); metronome.restart(); haptic(20); },
      tap: () => {
        const now = performance.now();
        if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
        taps.push(now); if (taps.length > 6) taps.shift(); haptic(10);
        if (taps.length >= 2) get().setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
      },
    }),
    {
      name: 'vt2.metro', version: 1, storage: safeStorage,
      partialize: (s) => ({ bpm: s.bpm, num: s.num, den: s.den, accents: s.accents, subdivs: s.subdivs, prog: s.prog }),
    },
  ),
);

// 엔진 ↔ 상태
metronome.getPattern = () => { const s = useMetro.getState(); return { bpm: s.bpm, num: s.num, den: s.den, accents: s.accents, subdivs: s.subdivs }; };
metronome.onTick = (beat, sub, delayMs) => {
  setTimeout(() => {
    if (!metronome.playing) return;
    useMetro.setState(sub === 0 ? { beat, flash: 'main' } : { flash: 'sub' });
    setTimeout(() => { if (metronome.playing) useMetro.setState({ flash: null }); }, sub === 0 ? 140 : 90);
  }, Math.max(0, delayMs));
};
metronome.onBar = () => {
  const s = useMetro.getState();
  const bars = s.bars + 1;
  if (s.prog.on) useMetro.setState({ bars, bpm: progressiveBpm(s.startBpm, bars, s.prog.step, s.prog.every, Math.max(s.startBpm, s.prog.max)) });
  else useMetro.setState({ bars });
};
