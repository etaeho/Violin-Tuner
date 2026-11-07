// 순정 음정 판정: 연주 음이 드론 근음과 어떤 음정이고, 순정 비율에서 몇 센트 벗어났나
export const JUST_INTERVALS = [
  { name: '완전1도', ratio: 1 / 1 }, { name: '단2도', ratio: 16 / 15 }, { name: '장2도', ratio: 9 / 8 },
  { name: '단3도', ratio: 6 / 5 }, { name: '장3도', ratio: 5 / 4 }, { name: '완전4도', ratio: 4 / 3 },
  { name: '증4도', ratio: 45 / 32 }, { name: '완전5도', ratio: 3 / 2 }, { name: '단6도', ratio: 8 / 5 },
  { name: '장6도', ratio: 5 / 3 }, { name: '단7도', ratio: 9 / 5 }, { name: '장7도', ratio: 15 / 8 },
];

export function intervalVsRoot(freq: number, root: number) {
  const total = 1200 * Math.log2(freq / root);
  const octaves = Math.floor((total + 50) / 1200);       // 옥타브는 접어서 비교
  const inOct = total - octaves * 1200;
  let best = JUST_INTERVALS[0], bestC = Infinity, bestCents = 0;
  for (const iv of JUST_INTERVALS) {
    for (const c of [1200 * Math.log2(iv.ratio), 1200 * Math.log2(iv.ratio) - 1200, 1200 * Math.log2(iv.ratio) + 1200]) {
      if (Math.abs(inOct - c) < bestC) { bestC = Math.abs(inOct - c); best = iv; bestCents = inOct - c; }
    }
  }
  return { name: best.name, cents: Math.round(bestCents) || 0, octaves };
}
