// ==========================================================
// 연주 명령: 정해진 음 패턴을 연주하면 명령 실행 (v1 commands.jsx 이식, 순수 로직)
//  - 150ms 이상 유지된 음만 '음 하나'로 인정
//  - 최근 음들이 패턴과 같고 제한 시간 안이면 onCommand
//  - 녹음: 첫 음부터 windowMs 동안 연주한 음(2~8개)이 패턴
// ==========================================================
export const NOTE_HOLD_MS = 150, NOTE_GAP_MS = 150, CMD_COOLDOWN_MS = 1500;
export const PATTERN_MIN = 2, PATTERN_MAX = 8;
export const DEFAULT_PATTERN = ['G3', 'E5', 'G3'];

export interface CmdSettings { enabled: boolean; pattern: string[]; windowMs: number }

export class NoteCommandTracker {
  private run: { note: string; start: number; fired: boolean } | null = null;
  private lastSeen = 0;
  private cooldownUntil = 0;
  events: { note: string; t: number }[] = [];
  recording: { notes: string[]; start: number | null; windowMs: number } | null = null;
  onCommand: (() => void) | null = null;
  onRecorded: ((p: string[] | null) => void) | null = null;

  feed(note: string, now: number, S: CmdSettings) {
    const continuing = this.run && this.run.note === note && now - this.lastSeen < NOTE_GAP_MS;
    if (!continuing) this.run = { note, start: now, fired: false };
    this.lastSeen = now;
    if (!this.run!.fired && now - this.run!.start >= NOTE_HOLD_MS) { this.run!.fired = true; this.push(note, now, S); }
  }

  /** 분석을 잠깐 건너뛴 순간(메트로놈 딸깍)에도 지금 음이 이어지는 것으로 봄 */
  bridge(now: number) { if (this.run) this.lastSeen = now; }

  tick(now: number) {
    const r = this.recording;
    if (r && r.start !== null && now - r.start >= r.windowMs) this.finish();
  }

  startRecording(windowMs: number) { this.recording = { notes: [], start: null, windowMs }; this.events = []; }
  cancelRecording() { this.recording = null; }

  private finish() {
    const r = this.recording; if (!r) return;
    this.recording = null; this.events = [];
    this.onRecorded?.(r.notes.length >= PATTERN_MIN ? r.notes : null);
  }

  private push(note: string, now: number, S: CmdSettings) {
    if (this.recording) {
      // 녹음 시간이 이미 지났으면 이 음은 넣지 않고 마무리
      if (this.recording.start !== null && now - this.recording.start >= this.recording.windowMs) { this.finish(); return; }
      if (this.recording.start === null) this.recording.start = now;
      this.recording.notes.push(note);
      if (this.recording.notes.length >= PATTERN_MAX) this.finish();
      return;
    }
    this.events.push({ note, t: now });
    if (this.events.length > 16) this.events.shift();
    if (!S.enabled || now < this.cooldownUntil || !S.pattern.length || this.events.length < S.pattern.length) return;
    const tail = this.events.slice(-S.pattern.length);
    if (tail.every((e, i) => e.note === S.pattern[i]) && now - tail[0].t <= S.windowMs) {
      this.events = []; this.cooldownUntil = now + CMD_COOLDOWN_MS; this.onCommand?.();
    }
  }
}
