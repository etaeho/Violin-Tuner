// ==========================================================
// 드론: 근음(+5도·옥타브·3도)을 순정 비율로 계속 울림
// ==========================================================
import { NOTE_NAMES } from './detector';
import { outCtx } from './out';

export const DRONE_INTERVALS = [
  { id: 'fifth', label: '5도', ratio: 3 / 2 },
  { id: 'octave', label: '옥타브', ratio: 2 },
  { id: 'maj3', label: '장3도', ratio: 5 / 4, excl: 'min3' },
  { id: 'min3', label: '단3도', ratio: 6 / 5, excl: 'maj3' },
] as const;
export type IntervalId = (typeof DRONE_INTERVALS)[number]['id'];
export type Timbre = 'cello' | 'organ' | 'soft';
export interface DroneCfg { root: string; octave: number; intervals: Record<IntervalId, boolean>; timbre: Timbre; volume: number; fade: number }

export const droneRootFreq = (c: Pick<DroneCfg, 'root' | 'octave'>, a4: number) =>
  a4 * 2 ** (((c.octave * 12 + NOTE_NAMES.indexOf(c.root as (typeof NOTE_NAMES)[number])) - 57) / 12);
export const droneRatios = (c: DroneCfg) => [1, ...DRONE_INTERVALS.filter((i) => c.intervals[i.id]).map((i) => i.ratio)];
/** 드론이 내는 음 이름들 (예: ['D4','A4']) */
export const droneNotes = (c: DroneCfg) => droneRatios(c).map((r) => {
  const idx = NOTE_NAMES.indexOf(c.root as (typeof NOTE_NAMES)[number]) + Math.round(12 * Math.log2(r));
  return NOTE_NAMES[((idx % 12) + 12) % 12] + (c.octave + Math.floor(idx / 12));
});

class DroneEngine {
  private master: GainNode | null = null;
  private voices: { bus: GainNode; oscs: OscillatorNode[] } | null = null;
  private organ: PeriodicWave | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  playing = false;

  private setup(ctx: AudioContext) {
    if (this.master) return;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4; comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(comp);
    const h = [0, 1, 0.55, 0.32, 0.22, 0.14, 0.09, 0.05];
    this.organ = ctx.createPeriodicWave(new Float32Array(h.length), new Float32Array(h));
  }

  private build(ctx: AudioContext, c: DroneCfg, a4: number) {
    const root = droneRootFreq(c, a4), ratios = droneRatios(c);
    const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(this.master!);
    const oscs: OscillatorNode[] = [];
    const per = 0.35 / Math.sqrt(ratios.length);
    ratios.forEach((r, i) => {
      const f = root * r;
      const g = ctx.createGain(); g.gain.value = per * (i === 0 ? 1 : 0.8); g.connect(bus);
      if (c.timbre === 'cello') {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(3000, f * 6); lp.connect(g);
        for (const det of [-4, 4]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
          const half = ctx.createGain(); half.gain.value = 0.5; o.connect(half); half.connect(lp); o.start(); oscs.push(o);
        }
      } else {
        const o = ctx.createOscillator();
        if (c.timbre === 'organ') o.setPeriodicWave(this.organ!); else o.type = 'sine';
        o.frequency.value = f; o.connect(g); o.start(); oscs.push(o);
      }
    });
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.08);
    return { bus, oscs };
  }

  private release(v: { bus: GainNode; oscs: OscillatorNode[] } | null, sec: number) {
    if (!v) return;
    const ctx = outCtx(), now = ctx.currentTime;
    v.bus.gain.cancelScheduledValues(now); v.bus.gain.setValueAtTime(v.bus.gain.value, now);
    v.bus.gain.linearRampToValueAtTime(0, now + sec);
    v.oscs.forEach((o) => { try { o.stop(now + sec + 0.05); } catch { /* 이미 정지 */ } });
  }

  private ramp(to: number, sec: number) {
    const ctx = outCtx(), g = this.master!.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(to, now + Math.max(0.02, sec));
  }

  start(c: DroneCfg, a4: number) {
    const ctx = outCtx(); this.setup(ctx);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    if (!this.voices) this.voices = this.build(ctx, c, a4);
    this.ramp(c.volume, c.fade); this.playing = true;
  }
  stop(fade: number) {
    if (!this.master) return;
    this.ramp(0, fade); this.playing = false;
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => { this.release(this.voices, 0.02); this.voices = null; }, fade * 1000 + 100);
  }
  /** 재생 중 음/화음/음색 변경 → 짧게 크로스페이드 */
  update(c: DroneCfg, a4: number) {
    if (!this.playing) return;
    const old = this.voices; this.voices = this.build(outCtx(), c, a4); this.release(old, 0.08);
  }
  setVolume(v: number) { if (this.playing) this.ramp(v, 0.05); }
}

export const drone = new DroneEngine();
