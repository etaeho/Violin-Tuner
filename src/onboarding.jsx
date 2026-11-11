// ==========================================
// onboarding — 첫 실행 안내 (30초): 마이크 허용 → 주변 소음 맞추기 → 테마
// (index.html에서 순서대로 로드됨: core → commands → theme → tuner → metronome → fingerboard → drone → practice → onboarding → recorder → app)
// 설정 → 정보 → "처음 안내 다시 보기"로 다시 볼 수 있음
// ==========================================

// 큰 실행 버튼 (컴포넌트 밖에 둬야 레벨 갱신 때 다시 만들어지지 않아 터치가 안 끊김)
const OnbBtn = ({ onClick, disabled, children }) => (
  <button onClick={onClick} disabled={disabled}
    className="w-full h-14 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
    style={{ background: 'var(--accent)', color: 'var(--app-bg, #000)' }}>
    <span style={{ color: document.documentElement.dataset.theme === 'vintage' ? '#3b2a1a' : document.documentElement.dataset.theme === 'light' ? '#fff' : '#000' }}
      className="flex items-center gap-2">{children}</span>
  </button>
);

const Onboarding = ({ tuner }) => {
  const { ensureMic, calibrateNoise, levelRef, isStarted, error, settings, updateSettings } = tuner;
  const [step, setStep] = useState(0);
  const [asking, setAsking] = useState(false);
  const [calib, setCalib] = useState(null);       // null | 'running' | {noise, gate}
  const [lv, setLv] = useState(levelRef.current);

  // 입력 레벨 막대
  useEffect(() => {
    const iv = setInterval(() => setLv({ ...levelRef.current }), 60);
    return () => clearInterval(iv);
  }, []);

  const askMic = async () => { haptic(10); setAsking(true); const ok = await ensureMic(); setAsking(false); if (ok) setStep(1); };
  const runCalib = async () => { setCalib('running'); const r = await calibrateNoise(3000); setCalib(r); haptic(30); };
  const finish = () => { updateSettings({ onboarded: true }); ensureMic(); haptic(20); };
  const pct = Math.max(0, Math.min(100, (Math.max(-80, lv.db) + 80) / 0.8));

  return (
    <div className="absolute inset-0 z-[80] t-app flex flex-col px-6 tab-enter"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex gap-1.5 justify-center mb-6">
        {[0, 1, 2].map(i => <span key={i} className="h-1.5 rounded-full transition-all"
          style={{ width: i === step ? 32 : 16, background: i <= step ? 'var(--accent)' : 'var(--chip-border)', opacity: i < step ? 0.5 : 1 }}/>)}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        {step === 0 && <>
          <span className="text-5xl">🎻</span>
          <h2 className="text-2xl font-black" style={{ color: 'var(--ink)' }}>바이올린 연습 파트너</h2>
          <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{'켜면 바로 듣고 음정을 보여줍니다.\n튜닝 · 박자 · 드론 · 기록을 한 앱에서.\n\n먼저 마이크를 허용해주세요.\n소리는 폰 안에서만 분석되고 저장되지 않습니다.'}</p>
        </>}
        {step === 1 && <>
          <AudioWaveform size={48} style={{ color: 'var(--accent)' }}/>
          <h2 className="text-2xl font-black" style={{ color: 'var(--ink)' }}>주변 소음 맞추기</h2>
          <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{'3초 동안 조용히 있어주세요.\n주변 소음보다 큰 소리만 분석하도록 맞춰서\n잡음에 바늘이 튀지 않게 합니다.'}</p>
        </>}
        {step === 2 && <>
          <span className="text-5xl">🎨</span>
          <h2 className="text-2xl font-black" style={{ color: 'var(--ink)' }}>디자인 고르기</h2>
          <p className="text-sm text-gray-500">나중에 설정에서 바꿀 수 있습니다.</p>
          <div className="w-full mt-2 text-left">
            <DesignPicker compact value={settings.design} onChange={d => updateSettings({ design: d.id, uiMode: d.base })}/>
          </div>
        </>}
      </div>

      <div className="w-full flex flex-col gap-3">
        {step === 0 && <>
          <OnbBtn onClick={askMic} disabled={asking}><Mic size={18}/>{asking ? '허용 기다리는 중…' : '마이크 허용'}</OnbBtn>
          {error && <p className="text-xs text-center" style={{ color: '#ef4444' }}>설정 &gt; 앱 &gt; Violin Tuner &gt; 권한에서 마이크를 허용한 뒤 다시 눌러주세요.</p>}
          <button onClick={() => setStep(1)} className="text-xs text-gray-500">나중에</button>
        </>}
        {step === 1 && <>
          <div className="w-full h-3 t-inset rounded-full overflow-hidden">
            <div className="h-full transition-[width] duration-75 rounded-full" style={{ width: `${pct}%`, background: lv.gate ? '#4afc9d' : '#6b7280' }}/>
          </div>
          {calib && calib !== 'running' && <p className="text-sm font-bold text-center" style={{ color: 'var(--accent)' }}>✓ 소음 {calib.noise} dB → 기준 {calib.gate} dB</p>}
          {calib && calib !== 'running'
            ? <OnbBtn onClick={() => setStep(2)}>다음</OnbBtn>
            : <OnbBtn onClick={runCalib} disabled={calib === 'running' || !isStarted}>{calib === 'running' ? '조용히… 측정 중' : !isStarted ? '마이크가 꺼져 있습니다' : '측정 시작 (3초)'}</OnbBtn>}
          <button onClick={() => setStep(2)} className="text-xs text-gray-500">건너뛰기 (나중에 설정에서 가능)</button>
        </>}
        {step === 2 && <OnbBtn onClick={finish}>시작하기</OnbBtn>}
      </div>
    </div>
  );
};
