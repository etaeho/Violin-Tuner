// ==========================================================
// v1 → v2 저장값 이전 (v2가 v1과 같은 앱 ID로 v1을 대체할 때 자동 실행)
// v1 키: 'vt.*'  →  v2 키: 'vt2.*' (zustand persist 형식 {state, version})
// v2 값이 이미 있으면 덮어쓰지 않음. 한 번만 실행('vt2.migratedFromV1').
// ==========================================================
type KV = Pick<Storage, 'getItem' | 'setItem'>;

const read = (s: KV, k: string) => { try { const v = s.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return undefined; } };
const KEY_MAP: Record<string, string> = { 'C#': 'Db', Gb: 'F#', Cb: 'B' };   // v2에 없는 조는 같은 음의 조로

export function migrateFromV1(s: KV, now = new Date()): string[] {
  if (s.getItem('vt2.migratedFromV1')) return [];
  const v1Settings = read(s, 'vt.tunerSettings.v1');
  const hasV1 = v1Settings || s.getItem('vt.metro.bpm') || s.getItem('vt.log.days') || s.getItem('vt.a4Freq');
  if (!hasV1) return [];
  const done: string[] = [];
  const put = (key: string, state: object) => {
    if (s.getItem(key)) return;                              // v2 값이 있으면 그대로
    s.setItem(key, JSON.stringify({ state, version: 1 })); done.push(key);
  };
  const st = v1Settings || {};

  // 테마
  if (st.uiMode === 'vintage' || st.uiMode === 'tape') put('vt2.settings', { theme: st.uiMode, tab: 'tuning', modules: { gauge: true, metro: true, drone: true } });

  // 튜너: A4 · 범위 · 감도
  const sens: Record<string, number> = {};
  for (const k of ['gateDb', 'clarity', 'stableFrames', 'smoothing', 'holdMs', 'minFreq', 'maxFreq']) if (typeof st[k] === 'number') sens[k] = st[k];
  const a4 = read(s, 'vt.a4Freq'), tol = read(s, 'vt.tolerance');
  if (a4 || tol || Object.keys(sens).length) put('vt2.tuner', { ...(a4 ? { a4 } : {}), ...(tol ? { tolerance: tol } : {}), mode: 'equal', sens });

  // 연주 명령
  if (st.cmdPattern) put('vt2.commands', { enabled: st.cmdEnabled ?? true, pattern: st.cmdPattern, windowMs: st.cmdWindowMs ?? 3000 });

  // 메트로놈
  const bpm = read(s, 'vt.metro.bpm'), ts = read(s, 'vt.metro.timeSig'), acc = read(s, 'vt.metro.beatSounds'), sub = read(s, 'vt.metro.beatSubdivisions');
  if (bpm || ts) put('vt2.metro', {
    bpm: bpm ?? 60, num: ts?.num ?? 4, den: ts?.den ?? 4,
    accents: Array.isArray(acc) ? acc : [2, 1, 1, 1], subdivs: Array.isArray(sub) ? sub : [1, 1, 1, 1],
    prog: { on: false, step: 2, every: 4, max: 120 },
  });

  // 드론
  const d = read(s, 'vt.drone');
  if (d?.root) put('vt2.drone', { cfg: { root: d.root, octave: d.octave ?? 4, intervals: d.intervals ?? { fifth: true, octave: false, maj3: false, min3: false }, timbre: d.timbre ?? 'cello', volume: d.volume ?? 0.6, fade: d.fadeSec ?? 1 } });

  // 지판 조표 ('D Major (2#)' → 'D')
  const fk = read(s, 'vt.fingerboard.key');
  if (typeof fk === 'string') { const id = fk.split(' ')[0]; put('vt2.fingerboard', { key: KEY_MAP[id] ?? id, heat: false }); }

  // 연습 기록 (v1은 시간만 있음 → 정확도는 빈 값)
  const days = read(s, 'vt.log.days');
  if (days && typeof days === 'object') {
    const out: Record<string, object> = {};
    for (const [k, v] of Object.entries(days as Record<string, Record<string, number>>)) {
      out[k] = { playMs: v.playMs || 0, tuneMs: v.tuneMs || 0, metroMs: v.metroMs || 0, droneMs: v.droneMs || 0, bpmMax: v.bpmMax || 0, notes: 0, ok: 0, abs: 0, per: {} };
    }
    put('vt2.log', { days: out, goalMin: read(s, 'vt.log.goalMin') ?? 30, idleSec: read(s, 'vt.log.idleSec') ?? 10, goalHit: null });
  }

  s.setItem('vt2.migratedFromV1', now.toISOString());
  return done;
}
