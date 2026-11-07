// 조표 · 음 이름 철자 · 스케일
export const CHROMATIC: string[][] = [
  ['C', 'B#'], ['C#', 'Db'], ['D'], ['D#', 'Eb'], ['E', 'Fb'], ['F', 'E#'],
  ['F#', 'Gb'], ['G'], ['G#', 'Ab'], ['A'], ['A#', 'Bb'], ['B', 'Cb'],
];

export const KEYS: { id: string; label: string; tonic: number; notes: string[] }[] = [
  { id: 'C', label: 'C장조 (0)', tonic: 0, notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
  { id: 'G', label: 'G장조 (1♯)', tonic: 7, notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'] },
  { id: 'D', label: 'D장조 (2♯)', tonic: 2, notes: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] },
  { id: 'A', label: 'A장조 (3♯)', tonic: 9, notes: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'] },
  { id: 'E', label: 'E장조 (4♯)', tonic: 4, notes: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'] },
  { id: 'B', label: 'B장조 (5♯)', tonic: 11, notes: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'] },
  { id: 'F#', label: 'F♯장조 (6♯)', tonic: 6, notes: ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'] },
  { id: 'F', label: 'F장조 (1♭)', tonic: 5, notes: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'] },
  { id: 'Bb', label: 'B♭장조 (2♭)', tonic: 10, notes: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'] },
  { id: 'Eb', label: 'E♭장조 (3♭)', tonic: 3, notes: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'] },
  { id: 'Ab', label: 'A♭장조 (4♭)', tonic: 8, notes: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'] },
  { id: 'Db', label: 'D♭장조 (5♭)', tonic: 1, notes: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'] },
];
export const keyById = (id: string) => KEYS.find((k) => k.id === id) ?? KEYS[0];

/** 반음 번호(0=C)를 이 조에 맞는 철자로. 조 밖의 음이면 null */
export function spellInKey(pc: number, keyId: string): string | null {
  const k = keyById(keyId);
  return CHROMATIC[((pc % 12) + 12) % 12].find((n) => k.notes.includes(n)) ?? null;
}

/** 표시용: ♯ ♭ 기호 */
export const pretty = (n: string) => n.replace('#', '♯').replace(/([A-G])b/, '$1♭');

/** 바이올린 1포지션 근처 장음계 1옥타브 (예: D장조 → D4 E4 F#4 G4 A4 B4 C#5 D5). 반환: A4 기준 반음 목록 */
export function scaleSemitones(keyId: string): number[] {
  const k = keyById(keyId);
  // 근음을 G3(−14) 이상에서 가장 낮게
  let root = k.tonic - 9;               // A4 기준: C4 = −9
  while (root < -14) root += 12;
  while (root - 12 >= -14) root -= 12;
  return [0, 2, 4, 5, 7, 9, 11, 12].map((s) => root + s);
}

/** A4 기준 반음 → 'F#4' 같은 라벨 (detector와 같은 표기) */
export function semitoneLabel(semi: number): string {
  const midi = semi + 69;
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}
