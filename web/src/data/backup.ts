// 백업: 'vt2.' 으로 시작하는 저장값 전부를 JSON 파일 하나로
type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export interface Backup { app: 'violin-tuner'; version: 2; exportedAt: string; data: Record<string, string> }

export function buildBackup(store: KV, now = new Date()): Backup {
  const data: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith('vt2.')) data[k] = store.getItem(k)!;
  }
  return { app: 'violin-tuner', version: 2, exportedAt: now.toISOString(), data };
}

/** 파일 내용 검사 → 문제 있으면 이유를 담아 throw */
export function parseBackup(text: string): Backup {
  let b: Backup;
  try { b = JSON.parse(text); } catch { throw new Error('JSON 파일이 아닙니다.'); }
  if (!b || b.app !== 'violin-tuner' || b.version !== 2 || typeof b.data !== 'object') throw new Error('Violin Tuner v2 백업 파일이 아닙니다.');
  for (const [k, v] of Object.entries(b.data)) {
    if (!k.startsWith('vt2.') || typeof v !== 'string') throw new Error(`잘못된 항목: ${k}`);
  }
  return b;
}

/** 현재 vt2.* 값을 지우고 백업 내용으로 교체 */
export function applyBackup(store: KV, b: Backup) {
  const old: string[] = [];
  for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k?.startsWith('vt2.')) old.push(k); }
  old.forEach((k) => store.removeItem(k));
  for (const [k, v] of Object.entries(b.data)) store.setItem(k, v);
}

export const backupFileName = (d = new Date()) =>
  `violin-tuner-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
