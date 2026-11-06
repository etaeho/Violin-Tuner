// ==========================================
// commands — 연주 명령: 바이올린으로 정해진 음 패턴을 연주하면 명령 실행
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → app)
//
// 튜너가 확정한 음(예: 'G3')을 프레임마다 feed() 로 넣으면
//   1) 150ms 이상 유지된 음만 '음 하나'로 인정 (스치는 음 무시)
//   2) 최근 음들이 설정된 패턴과 같고, 제한 시간 안이면 onCommand 호출
// 마이크/음성인식 추가 없이 기존 음정 감지만 사용한다.
// ==========================================

const NOTE_HOLD_MS = 150;      // 이만큼 유지돼야 음 하나로 인정
const NOTE_GAP_MS = 150;       // 이보다 짧게 끊기면 같은 음이 이어진 것으로 봄
const CMD_COOLDOWN_MS = 1500;  // 명령 실행 후 재실행 방지 시간
const CMD_PATTERN_LEN = 3;
const DEFAULT_CMD_PATTERN = ['G3', 'E5', 'G3'];

const createNoteTracker = () => {
  const st = {
    run: null,          // 현재 이어지는 음 { note, start, fired }
    lastSeen: 0,
    events: [],         // 인정된 음 기록 [{ note, t }]
    recording: null,    // 패턴 녹음 중이면 배열
    cooldownUntil: 0,
    onCommand: null,    // (name) => void  — app.jsx 에서 연결
    onRecorded: null,   // (pattern) => void — 설정 시트에서 연결
  };

  const pushEvent = (note, now, S) => {
    if (st.recording) {
      st.recording.push(note);
      if (st.recording.length >= CMD_PATTERN_LEN) {
        const p = st.recording; st.recording = null; st.events = [];
        st.onRecorded?.(p);
      }
      return;
    }
    st.events.push({ note, t: now });
    if (st.events.length > 8) st.events.shift();
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

  const feed = (note, now, S) => {
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
    startRecording: () => { st.recording = []; st.events = []; },
    cancelRecording: () => { st.recording = null; },
  };
};
