// ==========================================================
// 마이크 엔진 (메인 스레드): 권한 · AudioContext · 분석 워크렛 연결
// 결과는 onResult 로 받음 (store/live.ts 가 연결)
// ==========================================================
import workletUrl from './pitch-worklet.ts?worker&url';
import type { PitchResult } from './detector';

export type MicState = 'idle' | 'starting' | 'live' | 'denied' | 'error';

class MicEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private starting: Promise<boolean> | null = null;
  private range = { min: 180, max: 3500 };
  onResult: ((r: PitchResult) => void) | null = null;
  onState: ((s: MicState, msg?: string) => void) | null = null;

  get running() { return !!this.stream; }

  start(): Promise<boolean> {
    if (this.stream) return Promise.resolve(true);
    if (this.starting) return this.starting;
    this.starting = (async () => {
      this.onState?.('starting');
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 기기에서는 마이크를 쓸 수 없습니다.');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false },
        });
        if (!this.ctx) {
          this.ctx = new AudioContext();
          await this.ctx.audioWorklet.addModule(workletUrl);
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        const src = this.ctx.createMediaStreamSource(stream);
        const node = new AudioWorkletNode(this.ctx, 'pitch-processor', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
        node.port.onmessage = (e) => this.onResult?.(e.data as PitchResult);
        node.port.postMessage({ type: 'range', ...this.range });
        // 워크렛이 계속 돌도록 소리 없는 출력에 연결
        const mute = this.ctx.createGain(); mute.gain.value = 0;
        src.connect(node); node.connect(mute); mute.connect(this.ctx.destination);
        this.stream = stream; this.node = node;
        this.onState?.('live');
        return true;
      } catch (err) {
        const e = err as DOMException;
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') this.onState?.('denied');
        else this.onState?.('error', e.message);
        return false;
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    this.stream = null; this.node = null;
    this.onState?.('idle');
  }

  setRange(min: number, max: number) {
    this.range = { min, max };
    this.node?.port.postMessage({ type: 'range', min, max });
  }

  /** 첫 터치 때 오디오 재개 (브라우저 자동재생 정책) */
  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }
}

export const mic = new MicEngine();
