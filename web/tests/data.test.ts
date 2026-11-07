import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup, applyBackup } from '../src/data/backup';
import { migrateFromV1 } from '../src/data/migrateV1';

class Mem {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('백업', () => {
  it('vt2.* 만 담고, 되살리면 같은 값', () => {
    const a = new Mem(); a.setItem('vt2.metro', '{"state":{"bpm":92}}'); a.setItem('vt2.log', '{"x":1}'); a.setItem('other', 'no');
    const b = buildBackup(a);
    expect(Object.keys(b.data).sort()).toEqual(['vt2.log', 'vt2.metro']);
    const c = new Mem(); c.setItem('vt2.old', 'gone');
    applyBackup(c, parseBackup(JSON.stringify(b)));
    expect(c.getItem('vt2.metro')).toBe('{"state":{"bpm":92}}');
    expect(c.getItem('vt2.old')).toBeNull();
  });
  it('엉뚱한 파일은 거부', () => {
    expect(() => parseBackup('hello')).toThrow('JSON');
    expect(() => parseBackup('{"app":"x"}')).toThrow('백업 파일이 아닙니다');
    expect(() => parseBackup(JSON.stringify({ app: 'violin-tuner', version: 2, data: { evil: 'x' } }))).toThrow('잘못된 항목');
  });
});

describe('v1 → v2 이전', () => {
  const v1 = () => {
    const s = new Mem();
    s.setItem('vt.tunerSettings.v1', JSON.stringify({ uiMode: 'vintage', gateDb: -46, clarity: 0.93, cmdPattern: ['D4', 'A4'], cmdWindowMs: 2500 }));
    s.setItem('vt.a4Freq', '441'); s.setItem('vt.tolerance', '8');
    s.setItem('vt.metro.bpm', '92'); s.setItem('vt.metro.timeSig', '{"num":3,"den":4}'); s.setItem('vt.metro.beatSounds', '[2,1,1]');
    s.setItem('vt.drone', JSON.stringify({ root: 'G', octave: 3, intervals: { fifth: true, octave: true, maj3: false, min3: false }, timbre: 'organ', volume: 0.5, fadeSec: 2 }));
    s.setItem('vt.fingerboard.key', '"C# Major (7#)"');
    s.setItem('vt.log.days', JSON.stringify({ '2026-11-01': { playMs: 600000, tuneMs: 60000, metroMs: 0, droneMs: 0, bpmMax: 80 } }));
    s.setItem('vt.log.goalMin', '45');
    return s;
  };
  const st = (s: Mem, k: string) => JSON.parse(s.getItem(k)!).state;

  it('설정·템포·드론·조표·기록을 옮김', () => {
    const s = v1();
    expect(migrateFromV1(s).sort()).toEqual(['vt2.commands', 'vt2.drone', 'vt2.fingerboard', 'vt2.log', 'vt2.metro', 'vt2.settings', 'vt2.tuner']);
    expect(st(s, 'vt2.settings').theme).toBe('vintage');
    expect(st(s, 'vt2.tuner')).toMatchObject({ a4: 441, tolerance: 8, sens: { gateDb: -46, clarity: 0.93 } });
    expect(st(s, 'vt2.commands')).toMatchObject({ pattern: ['D4', 'A4'], windowMs: 2500 });
    expect(st(s, 'vt2.metro')).toMatchObject({ bpm: 92, num: 3, accents: [2, 1, 1] });
    expect(st(s, 'vt2.drone').cfg).toMatchObject({ root: 'G', octave: 3, timbre: 'organ', fade: 2 });
    expect(st(s, 'vt2.fingerboard').key).toBe('Db');       // C#장조 → 같은 음의 D♭장조
    expect(st(s, 'vt2.log')).toMatchObject({ goalMin: 45 });
    expect(st(s, 'vt2.log').days['2026-11-01']).toMatchObject({ playMs: 600000, notes: 0 });
  });
  it('한 번만 실행, v2 값은 덮어쓰지 않음', () => {
    const s = v1(); s.setItem('vt2.metro', JSON.stringify({ state: { bpm: 120 }, version: 1 }));
    migrateFromV1(s);
    expect(st(s, 'vt2.metro').bpm).toBe(120);
    expect(migrateFromV1(s)).toEqual([]);
  });
  it('v1 기록이 없으면 아무것도 안 함', () => {
    const s = new Mem();
    expect(migrateFromV1(s)).toEqual([]);
    expect(s.getItem('vt2.migratedFromV1')).toBeNull();
  });
});
