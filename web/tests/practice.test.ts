import { describe, it, expect } from 'vitest';
import { nextStep, tickSeconds, progressiveBpm, isNearClick, defaultAccents, type MetroPattern } from '../src/audio/metronome';
import { intervalVsRoot } from '../src/audio/intonation';
import { NoteCommandTracker, type CmdSettings } from '../src/audio/commands';
import { droneNotes, droneRootFreq, type DroneCfg } from '../src/audio/drone';

const P: MetroPattern = { bpm: 120, num: 3, den: 4, accents: [2, 1, 1], subdivs: [1, 2, 1] };

describe('메트로놈', () => {
  it('세분박 포함 다음 칸', () => {
    expect(nextStep(0, 0, P)).toEqual({ beat: 1, sub: 0, newBar: false });
    expect(nextStep(1, 0, P)).toEqual({ beat: 1, sub: 1, newBar: false });
    expect(nextStep(1, 1, P)).toEqual({ beat: 2, sub: 0, newBar: false });
    expect(nextStep(2, 0, P)).toEqual({ beat: 0, sub: 0, newBar: true });
  });
  it('칸 길이: 120BPM 4분음표 = 0.5초, 8분 세분 = 0.25초, x/8 박자 = 절반', () => {
    expect(tickSeconds(P, 0)).toBeCloseTo(0.5);
    expect(tickSeconds(P, 1)).toBeCloseTo(0.25);
    expect(tickSeconds({ ...P, den: 8 }, 0)).toBeCloseTo(0.25);
  });
  it('점진 템포: 4마디마다 +2, 최대값에서 멈춤', () => {
    expect(progressiveBpm(60, 0, 2, 4, 80)).toBe(60);
    expect(progressiveBpm(60, 7, 2, 4, 80)).toBe(62);
    expect(progressiveBpm(60, 400, 2, 4, 80)).toBe(80);
  });
  it('기본 강세', () => {
    expect(defaultAccents(4)).toEqual([2, 1, 1, 1]);
    expect(defaultAccents(6)).toEqual([2, 1, 1, 3, 1, 1]);
    expect(defaultAccents(11)[0]).toBe(2);
  });
  it('딸깍 근처 분석 건너뛰기, 촘촘하면 안 건너뜀', () => {
    const n = 10000;
    expect([isNearClick(n - 30, [n]), isNearClick(n - 10, [n]), isNearClick(n + 100, [n]), isNearClick(n + 130, [n])])
      .toEqual([false, true, true, false]);
    expect(isNearClick(n + 50, [n, n + 100, n + 200])).toBe(false);
  });
});

describe('순정 음정 판정', () => {
  const root = 293.33;  // D4 근처
  it('순정 장3도(5:4)는 0¢', () => expect(intervalVsRoot(root * 5 / 4, root)).toMatchObject({ name: '장3도', cents: 0 }));
  it('평균율 장3도는 순정보다 +14¢', () => expect(intervalVsRoot(root * 2 ** (4 / 12), root)).toMatchObject({ name: '장3도', cents: 14 }));
  it('옥타브 위 5도도 5도', () => expect(intervalVsRoot(root * 3, root)).toMatchObject({ name: '완전5도', cents: 0, octaves: 1 }));
  it('근음보다 조금 낮으면 1도 −5¢', () => expect(intervalVsRoot(root * 2 ** (-5 / 1200), root)).toMatchObject({ name: '완전1도', cents: -5 }));
});

describe('드론', () => {
  const c: DroneCfg = { root: 'D', octave: 4, intervals: { fifth: true, octave: false, maj3: true, min3: false }, timbre: 'cello', volume: 0.6, fade: 1 };
  it('음 이름', () => expect(droneNotes(c)).toEqual(['D4', 'A4', 'F#4']));
  it('근음 주파수 (A4=442 → D4 295.0Hz)', () => expect(droneRootFreq(c, 442)).toBeCloseTo(294.99, 1));
});

describe('연주 명령', () => {
  const S: CmdSettings = { enabled: true, pattern: ['G3', 'E5', 'G3'], windowMs: 3000 };
  const play = (t: NoteCommandTracker, notes: string[], start = 0, len = 400) => {
    let now = start;
    for (const n of notes) { for (let i = 0; i < len; i += 20) { t.feed(n, now, S); now += 20; } now += 200; }
    return now;
  };
  it('G3→E5→G3 이면 실행', () => {
    const t = new NoteCommandTracker(); let fired = 0; t.onCommand = () => fired++;
    play(t, ['G3', 'E5', 'G3']); expect(fired).toBe(1);
  });
  it('스치는 음(100ms)은 무시', () => {
    const t = new NoteCommandTracker(); let fired = 0; t.onCommand = () => fired++;
    play(t, ['G3', 'E5', 'G3'], 0, 100); expect(fired).toBe(0);
  });
  it('튜닝(A4↔E5)은 실행 안 됨', () => {
    const t = new NoteCommandTracker(); let fired = 0; t.onCommand = () => fired++;
    play(t, ['A4', 'E5', 'A4', 'E5']); expect(fired).toBe(0);
  });
  it('제한 시간 넘기면 실행 안 됨', () => {
    const t = new NoteCommandTracker(); let fired = 0; t.onCommand = () => fired++;
    play(t, ['G3', 'E5', 'G3'], 0, 1400); expect(fired).toBe(0);
  });
  it('메트로놈 딸깍으로 분석이 140ms 끊겨도 한 음으로 이어짐', () => {
    const t = new NoteCommandTracker(); let fired = 0; t.onCommand = () => fired++;
    let now = 0;
    for (const n of ['G3', 'E5', 'G3']) {
      // 400ms 음 중간에 140ms 동안 분석 없음 (bridge만 호출)
      for (let i = 0; i < 130; i += 20) { t.feed(n, now, S); now += 20; }
      for (let i = 0; i < 140; i += 20) { t.bridge(now); now += 20; }
      for (let i = 0; i < 130; i += 20) { t.feed(n, now, S); now += 20; }
      now += 200;
    }
    expect(fired).toBe(1);
  });
  it('녹음: 첫 음부터 windowMs 동안 연주한 음 전부', () => {
    const t = new NoteCommandTracker(); let rec: string[] | null = null; t.onRecorded = (p) => { rec = p; };
    t.startRecording(2000);
    const end = play(t, ['D4', 'A4', 'D4', 'E5', 'G3'], 0, 300);
    t.tick(end + 5000);
    expect(rec).toEqual(['D4', 'A4', 'D4', 'E5']);   // 5번째 음은 2초 밖
  });
});
