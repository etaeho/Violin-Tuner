// AudioWorklet 전역 (worklet 파일에서만 사용)
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;
declare const sampleRate: number;
declare const currentTime: number;
