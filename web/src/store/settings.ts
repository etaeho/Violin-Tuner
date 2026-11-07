// 앱 설정 (테마 등) — localStorage 'vt2.settings' 에 자동 저장
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeId = 'tape' | 'vintage' | 'light';
export const THEMES: { id: ThemeId; name: string; desc: string }[] = [
  { id: 'tape', name: '테이프', desc: '다크 · 기본' },
  { id: 'vintage', name: '빈티지', desc: '황동 · 원목' },
  { id: 'light', name: '라이트', desc: '야외 · 밝은 곳' },
];

export type TabId = 'tuning' | 'practice' | 'fingerboard' | 'log';

export type ModuleId = 'gauge' | 'metro' | 'drone';

interface SettingsState {
  theme: ThemeId;
  tab: TabId;
  modules: Record<ModuleId, boolean>;     // 연습 탭에서 켜 둔 모듈
  setTheme: (t: ThemeId) => void;
  setTab: (t: TabId) => void;
  toggleModule: (m: ModuleId) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'tape',
      tab: 'tuning',
      modules: { gauge: true, metro: true, drone: true },
      setTheme: (theme) => set({ theme }),
      setTab: (tab) => set({ tab }),
      toggleModule: (m) => set({ modules: { ...get().modules, [m]: !get().modules[m] } }),
    }),
    { name: 'vt2.settings', version: 1 },
  ),
);
