// 실시간 상태 (저장 안 함): 마이크 상태, 지금 음정, 입력 레벨, 기준음
import { create } from 'zustand';
import { mic, type MicState } from '@/audio/engine';
import { PitchTracker, type Level } from '@/audio/tracker';
import { freqToNote } from '@/audio/detector';
import { isNearClick } from '@/audio/metronome';
import { toneSounding } from '@/audio/synth';
import { drone } from '@/audio/drone';
import { useTuner } from './tuner';
import { useCommands, cmdTracker } from './commands';

/** 확정된 음을 받아보는 곳 (연습 기록 등) — label: 'A4', cents: 평균율 기준 */
export const noteSinks = new Set<(label: string, cents: number, now: number) => void>();
/** 메트로놈 딸깍으로 분석을 건너뛴 순간 (음이 이어지는 것으로 봄) */
export const bridgeSinks = new Set<(now: number) => void>();

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
  const now = performance.now();
  if (isNearClick(now)) { cmdTracker.bridge(now); bridgeSinks.forEach((f) => f(now)); return; }   // 메트로놈 딸깍 순간은 분석 건너뜀 (표시·음 이어짐 유지)
  const out = tracker.push(r, useTuner.getState().sens, now);
  cmdTracker.tick(now);
  if (out.acceptedNow && out.freq) {
    const n = freqToNote(out.freq, useTuner.getState().a4);
    // 기준음·드론이 스피커로 나오는 동안은 연주 명령에 쓰지 않음 (스피커 소리 → 마이크 오작동 방지)
    if (!toneSounding() && !drone.playing) cmdTracker.feed(n.label, now, useCommands.getState());
    noteSinks.forEach((f) => f(n.label, n.cents, now));
  }
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
