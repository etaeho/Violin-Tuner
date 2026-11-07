// 실시간 상태 (저장 안 함): 마이크 상태, 지금 음정, 입력 레벨, 기준음
import { create } from 'zustand';
import { mic, type MicState } from '@/audio/engine';
import { PitchTracker, type Level } from '@/audio/tracker';
import { useTuner } from './tuner';

interface Live {
  micState: MicState; micMsg?: string;
  freq: number | null;          // 확정된 음정 (없으면 null)
  level: Level;
  playing: string | null;       // 기준음 재생 중인 현 이름
  setPlaying: (n: string | null) => void;
}

export const useLive = create<Live>()((set) => ({
  micState: 'idle', freq: null,
  level: { db: -100, clarity: 0, gate: false, accepted: false, raw: -1 },
  playing: null,
  setPlaying: (playing) => set({ playing }),
}));

// ── 엔진 → 트래커 → 상태 ──
const tracker = new PitchTracker();
const dbTaps = new Set<(db: number) => void>();   // 소음 측정 등에서 레벨을 받아보는 곳

mic.onState = (micState, micMsg) => {
  if (micState !== 'live') { tracker.reset(); useLive.setState({ freq: null }); }
  useLive.setState({ micState, micMsg });
};
mic.onResult = (r) => {
  const out = tracker.push(r, useTuner.getState().sens, performance.now());
  dbTaps.forEach((f) => f(out.level.db));
  const prev = useLive.getState();
  if (prev.freq !== out.freq || prev.level.accepted !== out.level.accepted || Math.abs(prev.level.db - out.level.db) > 0.5) {
    useLive.setState({ freq: out.freq, level: out.level });
  }
};

/** 주변 소음 측정: ms 동안 레벨을 모아 상위 5% + 8dB 를 게이트로 */
export async function calibrateNoise(ms = 3000): Promise<{ noise: number; gate: number } | null> {
  if (!(await mic.start())) return null;
  const samples: number[] = [];
  const tap = (db: number) => samples.push(db);
  dbTaps.add(tap);
  await new Promise((r) => setTimeout(r, ms));
  dbTaps.delete(tap);
  if (!samples.length) return null;
  samples.sort((a, b) => a - b);
  const noise = samples[Math.floor(samples.length * 0.95)];
  const gate = Math.round(Math.min(-10, Math.max(-80, noise + 8)));
  useTuner.getState().setSens({ gateDb: gate });
  return { noise: Math.round(noise), gate };
}
