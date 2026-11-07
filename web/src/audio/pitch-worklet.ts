// ==========================================================
// 오디오 전용 스레드에서 도는 음정 분석기 (AudioWorklet)
// 마이크 샘플을 2048개씩 모아 1024개마다(48kHz 기준 약 47회/초) detectPitch 실행 → 메인 스레드로 전달
// 화면이 무거워도 분석이 밀리지 않음
// ==========================================================
import { detectPitch } from './detector';

const SIZE = 2048;
const HOP = 1024;

class PitchProcessor extends AudioWorkletProcessor {
  private ring = new Float32Array(SIZE);
  private frame = new Float32Array(SIZE);
  private w = 0;
  private filled = 0;
  private sinceHop = 0;
  private minFreq = 180;
  private maxFreq = 3500;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'range') { this.minFreq = e.data.min; this.maxFreq = e.data.max; }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.ring[this.w] = ch[i];
      this.w = (this.w + 1) % SIZE;
    }
    this.filled = Math.min(SIZE, this.filled + ch.length);
    this.sinceHop += ch.length;
    if (this.filled >= SIZE && this.sinceHop >= HOP) {
      this.sinceHop = 0;
      // 링버퍼 → 시간순 프레임
      const tail = SIZE - this.w;
      this.frame.set(this.ring.subarray(this.w), 0);
      this.frame.set(this.ring.subarray(0, this.w), tail);
      const r = detectPitch(this.frame, sampleRate, this.minFreq, this.maxFreq);
      this.port.postMessage({ freq: r.freq, clarity: r.clarity, rms: r.rms, t: currentTime });
    }
    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
