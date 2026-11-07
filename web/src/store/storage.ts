// 모든 저장소가 쓰는 localStorage 래퍼.
// 백업을 가져올 때는 잠가서, 새로고침 직전에 메모리의 옛 값이 가져온 값을 덮어쓰지 못하게 함.
import { createJSONStorage } from 'zustand/middleware';

let locked = false;
export const lockPersistence = () => { locked = true; };

export const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => localStorage.getItem(k),
  setItem: (k: string, v: string) => { if (!locked) localStorage.setItem(k, v); },
  removeItem: (k: string) => { if (!locked) localStorage.removeItem(k); },
}));
