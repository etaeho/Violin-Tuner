// 화면 알림(토스트)
import { create } from 'zustand';

interface UiState { toast: string | null; show: (msg: string) => void }
let timer: ReturnType<typeof setTimeout> | null = null;

export const useUi = create<UiState>()((set) => ({
  toast: null,
  show: (toast) => { set({ toast }); if (timer) clearTimeout(timer); timer = setTimeout(() => set({ toast: null }), 1900); },
}));
