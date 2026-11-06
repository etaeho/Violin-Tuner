// ==========================================
// fingerboard — 지판 탭
// (index.html에서 순서대로 로드됨: core → theme → tuner → metronome → fingerboard → app)
// ==========================================

// ==========================================
// 3. Fingerboard Component
// ==========================================
const Fingerboard = ({ tuner, metro }) => {
  const [selectedKey, setSelectedKey] = useState('C Major (0)');
  const currentScale = KEY_SIGNATURES[selectedKey];
  const detectedStr = (tuner.isStarted&&tuner.pitch>0) ? tuner.currentNote.name+tuner.currentNote.symbol : null;
  const detectedOctave = tuner.isStarted ? tuner.currentNote.octave : null;
  const displayStrings = [...FINGERBOARD_STRINGS_EXT].reverse();

  return (
    <div className="w-full h-full flex flex-col tab-enter gap-2">
      {/* Header bar */}
      <div className="w-full flex justify-between items-center h-10 shrink-0 px-1">
        <div className="flex items-center gap-1.5 t-chip px-3 py-1.5 rounded-full text-[10px] font-bold shadow-md">
          <span className="text-gray-400">조표=</span>
          <select value={selectedKey} onChange={e=>setSelectedKey(e.target.value)}
            className="bg-transparent text-white font-mono text-[10px] outline-none cursor-pointer">
            {Object.keys(KEY_SIGNATURES).map(k=>(
              <option key={k} value={k} className="bg-[#1a1a1a] text-white">{k}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 pr-1">
          {tuner.isStarted && (
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full animate-pulse ${detectedStr?(Math.abs(tuner.cents)<=tuner.tolerance?'bg-[#4afc9d]':'bg-[#ff4d4d]'):'bg-[#4afc9d]'}`}/>
              <span className={`text-[11px] font-black tracking-widest ${Math.abs(tuner.cents)<=tuner.tolerance?'text-[#4afc9d]':'text-[#ff4d4d]'}`}>
                {detectedStr?`${detectedStr}${detectedOctave}`:'ON'}
              </span>
            </div>
          )}
          {tuner.isStarted && <div className="w-[1px] h-3 bg-gray-700"/>}
          {(() => {
            let cls='bg-gray-800 text-gray-400 border border-gray-700';
            if (metro.isPlayingMetro) {
              const bt=metro.currentBeat>=0?metro.beatSounds[metro.currentBeat]:0;
              if (metro.visualFlash==='main') {
                if (bt===2) cls='bg-[#ffcc00] text-black shadow-[0_0_15px_#ffcc00] scale-110 border-transparent';
                else if (bt===3) cls='bg-[#f97316] text-black shadow-[0_0_12px_#f97316] scale-110 border-transparent';
                else cls='bg-[#4afc9d] text-black shadow-[0_0_10px_#4afc9d] scale-105 border-transparent';
              } else if (metro.visualFlash==='sub') cls='bg-[#0ea5e9] text-white shadow-[0_0_10px_#0ea5e9] scale-105 border-transparent';
            }
            return (
              <button onClick={metro.toggleMetronome}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-75 ${cls}`}>
                <span className="text-[10px] font-black">{metro.bpm}</span>
                {metro.isPlayingMetro ? <Square size={10} fill="currentColor"/> : <Play size={10} fill="currentColor" className="translate-x-[0.5px]"/>}
              </button>
            );
          })()}
        </div>
      </div>

      {/* Fingerboard */}
      <div className="w-full flex-1 rounded-2xl t-board flex flex-col relative px-2 py-2 min-h-0 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
        <div className="flex w-full items-center mb-1 z-20 shrink-0">
          {displayStrings.map(s=>(
            <div key={s.string} className="flex-1 flex justify-center">
              <span className="t-chip text-[#ffcc00] text-[9px] font-black px-2 py-0.5 rounded shadow-md">{s.string}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 flex w-full relative z-10 min-h-0">
          {/* Guide lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 px-2">
            {Array.from({length:26}).map((_,i)=>(
              <div key={`line-${i}`} className="flex-1 flex items-center w-full">
                <div className={`w-full rounded-full ${(i===0||i%5===0)?'border-t-[3px] border-solid border-[#0ea5e9]/60 shadow-[0_0_8px_rgba(14,165,233,0.4)]':'border-t-[1.5px] border-dashed border-gray-600/50'}`}/>
              </div>
            ))}
          </div>
          {/* String columns */}
          {displayStrings.map((s,idx)=>(
            <div key={s.string} className="flex-1 flex flex-col items-center relative h-full">
              <div className={`absolute top-0 bottom-0 bg-gray-600 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,1)] z-0 ${idx===0?'w-[5px]':idx===1?'w-[4px]':idx===2?'w-[2.5px]':'w-[1.5px]'}`}/>
              <div className="flex-1 w-full flex flex-col justify-between z-10">
                {Array.from({length:26}).map((_,pos)=>{
                  const note=s.notes[pos];
                  const matchedScaleNote=note.names.find(n=>currentScale.includes(n));
                  const inScale=!!matchedScaleNote;
                  const isOpenString=note.pos===0;
                  const isDetected=detectedStr&&note.names.includes(detectedStr)&&note.octave===detectedOctave;
                  const isPlaying=tuner.playingTone===note.id;
                  const semitonesFromA4=(note.octave*12+note.noteIndex)-57;
                  if (!inScale&&!isDetected&&!isPlaying) {
                    return (
                      <div key={pos} className="flex-1 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-gray-700/80 cursor-pointer active:bg-[#8b5a2b]" onClick={()=>tuner.toggleTone(note.id,semitonesFromA4)}/>
                      </div>
                    );
                  }
                  const isPitchPerfect=Math.abs(tuner.cents)<=tuner.tolerance;
                  let activeStyle='';
                  if (isPlaying) activeStyle='bg-[#8b5a2b] text-white shadow-[0_0_20px_rgba(233,196,106,0.6)] z-40 scale-[1.3] border-[#e9c46a] border-[1.5px]';
                  else if (isDetected) activeStyle=isPitchPerfect?'bg-[#4afc9d] text-black shadow-[0_0_20px_#4afc9d] z-30 scale-[1.3] border-transparent':'bg-[#ff4d4d] text-white shadow-[0_0_20px_#ff4d4d] z-30 scale-[1.3] border-transparent';
                  else activeStyle=isOpenString?'bg-gray-800 text-gray-200 border border-gray-500':'bg-[#151515] text-gray-300 border border-gray-700';
                  const displayName=(isDetected&&!inScale)||isPlaying?note.names[0]:matchedScaleNote;
                  const yOffsetPx=isPitchPerfect?0:Math.max(-18,Math.min(18,tuner.cents/2));
                  return (
                    <div key={pos} className="flex-1 flex items-center justify-center relative w-full">
                      <div className="relative flex items-center justify-center">
                        {isDetected&&!isPlaying&&(
                          <div className={`absolute right-full mr-1 flex flex-col items-center justify-center animate-pulse ${isPitchPerfect?'text-[#4afc9d]':'text-[#ff4d4d]'}`}
                            style={{top:'50%',transform:`translateY(calc(-50% + ${yOffsetPx}px))`}}>
                            {!isPitchPerfect&&tuner.cents<0&&<span className="text-[10px] font-black leading-none mb-[2px]">▴</span>}
                            <span className="text-[16px] leading-none">▸</span>
                            {!isPitchPerfect&&tuner.cents>0&&<span className="text-[10px] font-black leading-none mt-[2px]">▾</span>}
                          </div>
                        )}
                        <button onClick={()=>tuner.toggleTone(note.id,semitonesFromA4)}
                          className={`flex items-center justify-center font-black text-[12px] transition-all duration-100 px-1.5 py-[2px] leading-none whitespace-nowrap min-w-[28px] cursor-pointer ${isOpenString?'rounded-[4px]':'rounded-full'} ${activeStyle}`}>
                          {displayName}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {tuner.error && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm rounded-2xl">
          <div className="w-[85%] bg-gray-900/95 p-6 rounded-3xl flex flex-col items-center gap-4 border border-gray-700 shadow-2xl">
            <AlertCircle size={36} className="text-red-400"/>
            <p className="text-sm text-center text-white font-bold leading-relaxed">{tuner.error}</p>
            <div className="flex gap-3 mt-2 w-full">
              <button onClick={tuner.handleReset} className="flex-1 py-3 bg-gray-800 text-white text-sm font-bold rounded-full border border-gray-600">닫기</button>
              <button onClick={tuner.ensureMic} className="flex-1 py-3 bg-[#4afc9d] text-black text-sm font-bold rounded-full">다시 시도</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
