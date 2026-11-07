import { describe, it, expect } from 'vitest';
import { PracticeAccumulator, emptyDay, streak, mergePer, worstNotes, dateKey, prune, type NoteCtx, type DayStats } from '../src/music/practiceLog';
import { spellInKey, scaleSemitones, semitoneLabel } from '../src/music/keys';

const C: NoteCtx = { tuningTab: false, ignore: new Set(), tolerance: 10, idleMs: 10000 };
const hold = (acc: PracticeAccumulator, d: DayStats, label: string, cents: number, from: number, ms: number, c = C) => {
  let t = from; for (; t < from + ms; t += 20) acc.note(d, label, cents, t, c); return t;
};

describe('연습 시간', () => {
  it('음 사이 간격이 쉬는 시간 판정보다 짧으면 더함, 길면 뺌', () => {
    const a = new PracticeAccumulator(), d = emptyDay();
    let t = hold(a, d, 'C5', 0, 0, 2000);
    t = hold(a, d, 'D5', 0, t + 3000, 1000);     // 3초 쉼 → 포함
    hold(a, d, 'E5', 0, t + 20000, 1000);         // 20초 쉼 → 빼기
    expect(d.playMs).toBeGreaterThan(5900); expect(d.playMs).toBeLessThan(7100);
  });
  it('튜너 탭의 개방현은 튜닝 시간, 정확도에는 안 들어감', () => {
    const a = new PracticeAccumulator(), d = emptyDay();
    hold(a, d, 'A4', 3, 0, 2000, { ...C, tuningTab: true });
    expect(d.tuneMs).toBeGreaterThan(1900); expect(d.playMs).toBe(0); expect(d.notes).toBe(0);
  });
  it('드론 음은 무시', () => {
    const a = new PracticeAccumulator(), d = emptyDay();
    hold(a, d, 'D4', 0, 0, 2000, { ...C, ignore: new Set(['D', 'A']) });
    expect(d.playMs).toBe(0); expect(d.notes).toBe(0);
  });
});

describe('음정 정확도', () => {
  it('음 하나는 한 번만, 맞은 수·음별 평균', () => {
    const a = new PracticeAccumulator(), d = emptyDay();
    let t = hold(a, d, 'C#5', 15, 0, 800);
    t = hold(a, d, 'D5', 3, t + 200, 800);
    hold(a, d, 'C#5', 13, t + 200, 800);
    expect(d.notes).toBe(3); expect(d.ok).toBe(1);
    expect(d.per['C#5']).toMatchObject({ n: 2, ok: 0, sum: 28 });
  });
  it('딸깍 구간(bridge)으로 끊겨도 한 음', () => {
    const a = new PracticeAccumulator(), d = emptyDay();
    let t = hold(a, d, 'E5', 2, 0, 200);
    for (let i = 0; i < 7; i++) { a.bridge(t); t += 20; }
    hold(a, d, 'E5', 2, t, 200);
    expect(d.notes).toBe(1);
  });
  it('자주 틀리는 음 Top: 평균 센트 큰 순, 최소 횟수', () => {
    const per = { 'C#5': { n: 8, ok: 1, sum: 96, abs: 96 }, 'F4': { n: 6, ok: 2, sum: -48, abs: 50 }, 'A4': { n: 2, ok: 0, sum: 60, abs: 60 } };
    expect(worstNotes(per).map((x) => x.label)).toEqual(['C#5', 'F4']);
  });
});

describe('달력', () => {
  const days: Record<string, DayStats> = {};
  const today = new Date(2026, 10, 7);
  for (const back of [0, 1, 2, 4]) { const d = new Date(today); d.setDate(d.getDate() - back); days[dateKey(d)] = { ...emptyDay(), playMs: 120000, per: { A4: { n: 1, ok: 1, sum: 0, abs: 0 } } }; }
  it('연속 연습일 (오늘부터 3일)', () => expect(streak(days, today)).toBe(3));
  it('최근 N일 합산', () => expect(mergePer(days, 3, today).A4.n).toBe(3));
  it('400일 지난 기록 정리', () => {
    const old = { '2020-01-01': emptyDay(), [dateKey(today)]: emptyDay() };
    expect(Object.keys(prune(old, 400, today))).toEqual([dateKey(today)]);
  });
});

describe('조표 · 스케일', () => {
  it('D장조에서 반음 6(F#)은 F#, 반음 5(F)는 조 밖', () => { expect(spellInKey(6, 'D')).toBe('F#'); expect(spellInKey(5, 'D')).toBeNull(); });
  it('B♭장조에서 반음 10은 Bb', () => expect(spellInKey(10, 'Bb')).toBe('Bb'));
  it('D장조 스케일 = D4…D5', () => expect(scaleSemitones('D').map(semitoneLabel)).toEqual(['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5']));
  it('G장조 스케일 = G3…G4 (바이올린 최저음부터)', () => expect(scaleSemitones('G').map(semitoneLabel)[0]).toBe('G3'));
});
