// 연주 명령 설정 — 저장('vt2.commands')
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PATTERN, NoteCommandTracker } from '@/audio/commands';

interface CmdState {
  enabled: boolean; pattern: string[]; windowMs: number;
  set: (p: Partial<Pick<CmdState, 'enabled' | 'pattern' | 'windowMs'>>) => void;
}

export const useCommands = create<CmdState>()(
  persist(
    (set) => ({ enabled: true, pattern: DEFAULT_PATTERN, windowMs: 3000, set: (p) => set(p) }),
    { name: 'vt2.commands', version: 1, partialize: (s) => ({ enabled: s.enabled, pattern: s.pattern, windowMs: s.windowMs }) },
  ),
);

export const cmdTracker = new NoteCommandTracker();
