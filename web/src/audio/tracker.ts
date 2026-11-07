// ==========================================================
// 분석 결과 → 화면에 보여줄 음정 (v1 튜너 로직 이식, 순수 함수형이라 테스트 가능)
//  1) 노이즈 게이트 (3dB 히스테리시스)  2) 신뢰도(clarity) 필터
//  3) 같은 음이 N번 연속이어야 확정      4) 평균으로 부드럽게   5) 소리가 끊겨도 holdMs 동안 유지
// ==========================================================
import { rmsToDb, type PitchResult } from './detector';

export interface Sensitivity {
  gateDb: number; clarity: number; stableFrames: number; smoothing: number; holdMs: number;
  minFreq: number; maxFreq: number;
}
export const DEFAULT_SENSITIVITY: Sensitivity = {
  gateDb: -40, clarity: 0.9, stableFrames: 3, smoothing: 5, holdMs: 400, minFreq: 180, maxFreq: 3500,
};

export interface Level { db: number; clarity: number; gate: boolean; accepted: boolean; raw: number }
export interface TrackOut { freq: number | null; level: Level; acceptedNow: boolean }

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

export class PitchTracker {
  private gateOpen = false;
  private cand = { freq: 0, count: 0 };
  private hist: number[] = [];
  private lastGood = -Infinity;
  private current: number | null = null;

  reset() {
    this.gateOpen = false; this.cand = { freq: 0, count: 0 }; this.hist = []; this.lastGood = -Infinity; this.current = null;
  }

  /** r: 분석 1회 결과, nowMs: 시각(ms) */
  push(r: PitchResult, S: Sensitivity, nowMs: number): TrackOut {
    const db = rmsToDb(r.rms);
    this.gateOpen = this.gateOpen ? db > S.gateDb - 3 : db > S.gateDb;
    let accepted = false;
    if (this.gateOpen && r.freq > 0 && r.clarity >= S.clarity) {
      if (this.cand.freq && Math.abs(cents(r.freq, this.cand.freq)) < 50) this.cand.count++;
      else this.cand.count = 1;
      this.cand.freq = r.freq;
      if (this.cand.count >= S.stableFrames) {
        accepted = true;
        const last = this.hist[this.hist.length - 1];
        if (last && Math.abs(cents(r.freq, last)) > 50) this.hist = [];   // 음이 바뀌면 평균 초기화
        this.hist.push(r.freq);
        while (this.hist.length > S.smoothing) this.hist.shift();
        this.current = this.hist.reduce((a, b) => a + b, 0) / this.hist.length;
        this.lastGood = nowMs;
      }
    } else {
      this.cand.count = 0;
    }
    if (!accepted && this.current !== null && nowMs - this.lastGood > S.holdMs) {
      this.current = null; this.hist = [];
    }
    return {
      freq: this.current,
      acceptedNow: accepted,
      level: { db, clarity: r.clarity, gate: this.gateOpen, accepted, raw: r.freq },
    };
  }
}
