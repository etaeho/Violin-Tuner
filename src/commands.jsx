// ==========================================
// commands — 연주 명령: 바이올린으로 정해진 음 패턴을 연주하면 명령 실행
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
//
// 튜너가 확정한 음(예: 'G3')을 프레임마다 feed() 로 넣으면
//   1) 150ms 이상 유지된 음만 '음 하나'로 인정 (스치는 음 무시)
//   2) 최근 음들이 설정된 패턴과 같고, 제한 시간 안이면 onCommand 호출
// 패턴 녹음: 첫 음을 연주한 순간부터 제한 시간(cmdWindowMs) 동안 연주한 음 전부가 패턴이 됨
// 마이크/음성인식 추가 없이 기존 음정 감지만 사용한다.
// ==========================================

const NOTE_HOLD_MS = 150;      // 이만큼 유지돼야 음 하나로 인정
const NOTE_GAP_MS = 150;       // 이보다 짧게 끊기면 같은 음이 이어진 것으로 봄
const CMD_COOLDOWN_MS = 1500;  // 명령 실행 후 재실행 방지 시간
const CMD_PATTERN_MIN = 2;      // 패턴 최소 음 개수
const CMD_PATTERN_MAX = 8;      // 패턴 최대 음 개수
const DEFAULT_CMD_PATTERN = ['G3', 'E5', 'G3'];

const createNoteTracker = () => {
  const st = {
    run: null,          // 현재 이어지는 음 { note, start, fired }
    lastSeen: 0,
    events: [],         // 인정된 음 기록 [{ note, t }]
    recording: null,    // 패턴 녹음 중: { notes: [], start: null|ms, windowMs }
    cooldownUntil: 0,
    onCommand: null,    // (name) => void  — app.jsx 에서 연결
    droneActive: false, // 드론 재생 중이면 명령 감지 안 함 (drone.jsx)
    onRecorded: null,   // (pattern | null) => void — 설정 시트에서 연결 (null = 음 부족)
  };

  const pushEvent = (note, now, S) => {
    if (st.recording) {
      const rec = st.recording;
      if (rec.start === null) rec.start = now;          // 첫 음부터 시간 측정
      rec.notes.push(note);
      if (rec.notes.length >= CMD_PATTERN_MAX) finishRecording();
      return;
    }
    st.events.push({ note, t: now });
    if (st.events.length > 16) st.events.shift();
    if (!S.cmdEnabled || now < st.cooldownUntil) return;
    const P = S.cmdPattern;
    if (!P?.length || st.events.length < P.length) return;
    const tail = st.events.slice(-P.length);
    if (tail.every((e, i) => e.note === P[i]) && now - tail[0].t <= S.cmdWindowMs) {
      st.events = [];
      st.cooldownUntil = now + CMD_COOLDOWN_MS;
      st.onCommand?.('metronome');
    }
  };

  const finishRecording = () => {
    const rec = st.recording;
    if (!rec) return;
    st.recording = null; st.events = [];
    st.onRecorded?.(rec.notes.length >= CMD_PATTERN_MIN ? rec.notes : null);
  };

  // 매 프레임 호출 (소리가 없어도) → 녹음 시간 종료 처리
  const tick = (now) => {
    const rec = st.recording;
    if (rec && rec.start !== null && now - rec.start >= rec.windowMs) finishRecording();
  };

  const feed = (note, now, S) => {
    if (st.droneActive) return;
    const continuing = st.run && st.run.note === note && now - st.lastSeen < NOTE_GAP_MS;
    if (!continuing) st.run = { note, start: now, fired: false };
    st.lastSeen = now;
    if (!st.run.fired && now - st.run.start >= NOTE_HOLD_MS) {
      st.run.fired = true;
      pushEvent(note, now, S);
    }
  };

  return {
    state: st,
    feed,
    tick,
    startRecording: (windowMs) => { st.recording = { notes: [], start: null, windowMs }; st.events = []; },
    cancelRecording: () => { st.recording = null; },
  };
};
