// 지판 설정 — 저장('vt2.fingerboard')
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FbState {
  key: string; heat: boolean;
  setKey: (k: string) => void; toggleHeat: () => void; setHeat: (v: boolean) => void;
}
export const useFingerboard = create<FbState>()(
  persist(
    (set, get) => ({ key: 'C', heat: false, setKey: (key) => set({ key }), toggleHeat: () => set({ heat: !get().heat }), setHeat: (heat) => set({ heat }) }),
    { name: 'vt2.fingerboard', version: 1, partialize: (s) => ({ key: s.key, heat: s.heat }) },
  ),
);
