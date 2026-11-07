// 튜너 설정 — 저장됨 (localStorage 'vt2.tuner')
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SENSITIVITY, type Sensitivity } from '@/audio/tracker';
import type { TuningMode } from '@/audio/strings';
import { mic } from '@/audio/engine';

interface TunerSettings {
  a4: number;
  tolerance: number;          // ±센트 안이면 "맞음"
  mode: TuningMode;           // 평균율 / 순정 5도
  sens: Sensitivity;
  setA4: (v: number) => void;
  setTolerance: (v: number) => void;
  setMode: (m: TuningMode) => void;
  setSens: (p: Partial<Sensitivity>) => void;
  resetSens: () => void;
}

export const useTuner = create<TunerSettings>()(
  persist(
    (set, get) => ({
      a4: 442, tolerance: 10, mode: 'equal', sens: DEFAULT_SENSITIVITY,
      setA4: (a4) => set({ a4: Math.min(450, Math.max(430, a4)) }),
      setTolerance: (tolerance) => set({ tolerance }),
      setMode: (mode) => set({ mode }),
      setSens: (p) => {
        const sens = { ...get().sens, ...p };
        if (p.minFreq !== undefined || p.maxFreq !== undefined) mic.setRange(sens.minFreq, sens.maxFreq);
        set({ sens });
      },
      resetSens: () => { mic.setRange(DEFAULT_SENSITIVITY.minFreq, DEFAULT_SENSITIVITY.maxFreq); set({ sens: DEFAULT_SENSITIVITY }); },
    }),
    {
      name: 'vt2.tuner', version: 1,
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<TunerSettings>;
        return { ...current, ...p, sens: { ...DEFAULT_SENSITIVITY, ...(p.sens || {}) } };
      },
    },
  ),
);
