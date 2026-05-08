import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, Settings, Volume2, VolumeX, AlertCircle,
  Music, Activity, Minus, Plus, ChevronUp, ChevronDown, RotateCcw,
  LayoutGrid
} from 'lucide-react';

// 햅틱 피드백 헬퍼
const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch (_) {} };

// ==========================================
// 공통 상수 및 헬퍼
// ==========================================
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const CHROMATIC_NOTES = [
  ['C','B#'],['C#','Db'],['D'],['D#','Eb'],['E','Fb'],['F','E#'],
  ['F#','Gb'],['G'],['G#','Ab'],['A'],['A#','Bb'],['B','Cb']
];

const VIOLIN_STRINGS = [
  { name:'G3', id:4, note:'G', octave:3, semitone:-14 },
  { name:'D4', id:3, note:'D', octave:4, semitone:-7  },
  { name:'A4', id:2, note:'A', octave:4, semitone:0   },
  { name:'E5', id:1, note:'E', octave:5, semitone:7   },
];

const CENT_STEPS = [-50,-40,-30,-20,-10,0,10,20,30,40,50];

const KEY_SIGNATURES = {
  'C Major (0)': ['C','D','E','F','G','A','B'],
  'G Major (1#)': ['G','A','B','C','D','E','F#'],
  'D Major (2#)': ['D','E','F#','G','A','B','C#'],
  'A Major (3#)': ['A','B','C#','D','E','F#','G#'],
  'E Major (4#)': ['E','F#','G#','A','B','C#','D#'],
  'B Major (5#)': ['B','C#','D#','E','F#','G#','A#'],
  'F# Major (6#)': ['F#','G#','A#','B','C#','D#','E#'],
  'C# Major (7#)': ['C#','D#','E#','F#','G#','A#','B#'],
  'F Major (1b)': ['F','G','A','Bb','C','D','E'],
  'Bb Major (2b)': ['Bb','C','D','Eb','F','G','A'],
  'Eb Major (3b)': ['Eb','F','G','Ab','Bb','C','D'],
  'Ab Major (4b)': ['Ab','Bb','C','Db','Eb','F','G'],
  'Db Major (5b)': ['Db','Eb','F','Gb','Ab','Bb','C'],
  'Gb Major (6b)': ['Gb','Ab','Bb','Cb','Db','Eb','F'],
  'Cb Major (7b)': ['Cb','Db','Eb','Fb','Gb','Ab','Bb'],
};

const generateFingerboardStrings = (maxPos) => {
  const stringsInfo = [
    { string:'E', baseIdx:4, baseOct:5 },
    { string:'A', baseIdx:9, baseOct:4 },
    { string:'D', baseIdx:2, baseOct:4 },
    { string:'G', baseIdx:7, baseOct:3 },
  ];
  return stringsInfo.map(info => {
    const notes = [];
    for (let pos = 0; pos <= maxPos; pos++) {
      const noteIndex = (info.baseIdx + pos) % 12;
      const octaveShift = Math.floor((info.baseIdx + pos) / 12);
      notes.push({ pos, names: CHROMATIC_NOTES[noteIndex], noteIndex, octave: info.baseOct + octaveShift, id: `${info.string}${pos}` });
    }
    return { string: info.string, notes };
  });
};
const FINGERBOARD_STRINGS_EXT = generateFingerboardStrings(25);

// ── 메트로놈 음표 아이콘 ──
const NoteQuarter = ({ className = "h-6 w-auto" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="10" cy="17" r="2.8"/><rect x="11.8" y="5" width="1.2" height="12"/>
  </svg>
);
const NoteEighths = ({ className = "h-6 w-auto" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/>
    <rect x="8.5" y="6" width="1.2" height="11"/><rect x="18.5" y="6" width="1.2" height="11"/>
    <rect x="8.5" y="5" width="11.2" height="2"/>
  </svg>
);
const NoteTriplet = ({ className = "h-6 w-auto" }) => (
  <svg viewBox="0 0 32 24" fill="currentColor" className={className}>
    <circle cx="6" cy="17" r="2.2"/><circle cx="16" cy="17" r="2.2"/><circle cx="26" cy="17" r="2.2"/>
    <rect x="7" y="7" width="1.2" height="10"/><rect x="17" y="7" width="1.2" height="10"/><rect x="27" y="7" width="1.2" height="10"/>
    <rect x="7" y="6" width="21.2" height="1.8"/>
    <text x="17" y="4.5" fontSize="6.5" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic' }}>3</text>
  </svg>
);
const NoteSixteenths = ({ className = "h-6 w-auto" }) => (
  <svg viewBox="0 0 40 24" fill="currentColor" className={className}>
    <circle cx="6" cy="17" r="2"/><circle cx="15" cy="17" r="2"/><circle cx="24" cy="17" r="2"/><circle cx="33" cy="17" r="2"/>
    <rect x="7" y="6" width="1" height="11"/><rect x="16" y="6" width="1" height="11"/>
    <rect x="25" y="6" width="1" height="11"/><rect x="34" y="6" width="1" height="11"/>
    <rect x="7" y="5" width="28" height="1.5"/><rect x="7" y="8.5" width="28" height="1.5"/>
  </svg>
);
const renderSubdivisionIcon = (val, className) => {
  switch (val) {
    case 1: return <NoteQuarter className={className}/>;
    case 2: return <NoteEighths className={className}/>;
    case 3: return <NoteTriplet className={className}/>;
    case 4: return <NoteSixteenths className={className}/>;
    default: return null;
  }
};

const getDefaultBeatSounds = (num) => {
  if (num === 2) return [2,1];
  if (num === 3) return [2,1,1];
  if (num === 4) return [2,1,1,1];
  if (num === 5) return [2,1,2,1,1];
  if (num === 6) return [2,1,1,3,1,1];
  if (num === 7) return [2,1,1,2,1,2,1];
  if (num === 8) return [2,1,1,3,1,1,3,1];
  if (num === 9) return [2,1,1,3,1,1,3,1,1];
  if (num === 12) return [2,1,1,3,1,1,2,1,1,3,1,1];
  const arr = Array(num).fill(1); arr[0] = 2; return arr;
};

const getTempoMarking = (bpm) => {
  if (bpm < 40) return "Grave";
  if (bpm < 60) return "Largo";
  if (bpm < 66) return "Larghetto";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 168) return "Allegro";
  if (bpm < 200) return "Presto";
  return "Prestissimo";
};

// ==========================================
// Tuner Hook
// ==========================================
const useTunerLogic = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [cents, setCents] = useState(0);
  const [stringCents, setStringCents] = useState(0);
  const [a4Freq, setA4Freq] = useState(442);
  const [tolerance, setTolerance] = useState(10);
  const [currentNote, setCurrentNote] = useState({ name: 'A', octave: 4, symbol: '' });
  const [closestString, setClosestString] = useState(VIOLIN_STRINGS[2]);
  const [error, setError] = useState(null);
  const [playingTone, setPlayingTone] = useState(null);

  const audioContextRef = useRef(null);
  const analyserRef    = useRef(null);
  const animationRef   = useRef(null);
  const bufferRef      = useRef(null);
  const oscillatorRef  = useRef(null);
  const gainNodeRef    = useRef(null);
  const freqHistoryRef = useRef([]);
  const a4FreqRef      = useRef(442);
  const streamRef      = useRef(null);

  useEffect(() => () => { stopTuner(); stopTone(); }, []);

  const initAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const toggleTone = async (id, semitonesFromA4) => {
    await initAudioContext();
    if (playingTone === id) { stopTone(); return; }
    stopTone();
    haptic(15);
    const targetFreq = a4FreqRef.current * Math.pow(2, semitonesFromA4 / 12);
    const osc = audioContextRef.current.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(targetFreq, audioContextRef.current.currentTime);
    const filter = audioContextRef.current.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    osc.connect(filter);
    filter.connect(gainNodeRef.current);
    gainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNodeRef.current.gain.linearRampToValueAtTime(0.6, audioContextRef.current.currentTime + 0.1);
    osc.start();
    oscillatorRef.current = osc;
    setPlayingTone(id);
  };

  const stopTone = () => {
    if (oscillatorRef.current) {
      const now = audioContextRef.current.currentTime;
      gainNodeRef.current?.gain.linearRampToValueAtTime(0, now + 0.1);
      oscillatorRef.current.stop(now + 0.2);
      oscillatorRef.current = null;
    }
    setPlayingTone(null);
  };

  const autoCorrelate = (buffer, sampleRate) => {
    let SIZE = buffer.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.025) return -1;
    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    const buf = buffer.slice(r1, r2);
    SIZE = buf.length;
    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE - i; j++) c[i] += buf[j] * buf[j + i];
    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }
    let T0 = maxpos;
    if (maxpos > 0 && maxpos < SIZE - 1) {
      const y1 = c[maxpos - 1], y2 = c[maxpos], y3 = c[maxpos + 1];
      const a = (y1 + y3 - 2 * y2) / 2, b = (y3 - y1) / 2;
      if (a !== 0) T0 = maxpos - b / (2 * a);
    }
    return sampleRate / T0;
  };

  const update = useCallback(() => {
    if (!analyserRef.current) return;
    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    const rawFreq = autoCorrelate(bufferRef.current, audioContextRef.current.sampleRate);
    if (rawFreq !== -1 && rawFreq > 50 && rawFreq < 3000) {
      const lastFreq = freqHistoryRef.current[freqHistoryRef.current.length - 1];
      if (lastFreq && Math.abs(lastFreq - rawFreq) / lastFreq > 0.1) freqHistoryRef.current = [];
      freqHistoryRef.current.push(rawFreq);
      if (freqHistoryRef.current.length > 5) freqHistoryRef.current.shift();
      const freq = freqHistoryRef.current.reduce((a, b) => a + b, 0) / freqHistoryRef.current.length;
      const currentA4 = a4FreqRef.current;
      const semitonesFromA4Exact = 12 * Math.log2(freq / currentA4);
      const noteNum = Math.round(semitonesFromA4Exact) + 69;
      const chromaticTargetFreq = currentA4 * Math.pow(2, Math.round(semitonesFromA4Exact) / 12);
      const chromaticCentsOff = Math.floor(1200 * Math.log2(freq / chromaticTargetFreq));
      let minDiff = Infinity, closestStr = VIOLIN_STRINGS[2];
      VIOLIN_STRINGS.forEach(s => {
        const diff = Math.abs(semitonesFromA4Exact - s.semitone);
        if (diff < minDiff) { minDiff = diff; closestStr = s; }
      });
      const stringTargetFreq = currentA4 * Math.pow(2, closestStr.semitone / 12);
      const strCentsOff = Math.floor(1200 * Math.log2(freq / stringTargetFreq));
      const noteIndex = (noteNum % 12 + 12) % 12;
      const octave = Math.floor(noteNum / 12) - 1;
      const fullNote = NOTE_NAMES[noteIndex];
      setPitch(freq.toFixed(1));
      setCents(chromaticCentsOff);
      setStringCents(strCentsOff);
      setClosestString(closestStr);
      setCurrentNote({ name: fullNote.replace('#', ''), symbol: fullNote.includes('#') ? '#' : '', octave });
    } else {
      freqHistoryRef.current = [];
    }
    animationRef.current = requestAnimationFrame(update);
  }, []);

  const startTuner = async () => {
    setError(null);
    if (isStarted) { stopTuner(); return; }
    haptic(20);
    try {
      await initAudioContext();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("마이크를 지원하지 않는 환경입니다.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false }
      });
      streamRef.current = stream;
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      bufferRef.current = new Float32Array(analyserRef.current.fftSize);
      audioContextRef.current.createMediaStreamSource(stream).connect(analyserRef.current);
      setIsStarted(true);
      update();
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
        setError("마이크 권한이 거부되었습니다.\n앱 설정에서 마이크를 허용해주세요.");
      } else {
        setError("마이크를 사용할 수 없습니다: " + err.message);
      }
      setIsStarted(false);
    }
  };

  const stopTuner = () => {
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsStarted(false); setPitch(0); setCents(0); setStringCents(0);
  };

  const handleReset = () => {
    stopTuner(); stopTone();
    setA4Freq(442); a4FreqRef.current = 442;
    setTolerance(10); setClosestString(VIOLIN_STRINGS[2]); setError(null);
    haptic(10);
  };

  const cycleA4Freq = () => {
    setA4Freq(prev => {
      const next = prev >= 443 ? 440 : prev + 1;
      a4FreqRef.current = next;
      if (playingTone && oscillatorRef.current && audioContextRef.current) {
        let s = 0;
        const so = VIOLIN_STRINGS.find(v => v.name === playingTone);
        if (so) { s = so.semitone; } else {
          const pn = playingTone.replace(/[0-9]+$/, '');
          const pos = parseInt(playingTone.replace(/[^0-9]/g, ''), 10);
          const bi = [
            { string: 'E', baseIdx: 4, baseOct: 5 }, { string: 'A', baseIdx: 9, baseOct: 4 },
            { string: 'D', baseIdx: 2, baseOct: 4 }, { string: 'G', baseIdx: 7, baseOct: 3 }
          ].find(i => i.string === pn);
          if (bi) { const ni = (bi.baseIdx + pos) % 12; const os = Math.floor((bi.baseIdx + pos) / 12); s = (bi.baseOct + os) * 12 + ni - 57; }
        }
        oscillatorRef.current.frequency.setValueAtTime(next * Math.pow(2, s / 12), audioContextRef.current.currentTime);
      }
      return next;
    });
    haptic(8);
  };

  const cycleTolerance = () => { setTolerance(prev => prev >= 24 ? 4 : prev + 2); haptic(8); };

  return {
    isStarted, pitch, cents, stringCents, a4Freq, tolerance,
    currentNote, closestString, error, playingTone,
    startTuner, stopTuner, toggleTone, handleReset, cycleA4Freq, cycleTolerance
  };
};

// ==========================================
// 1. Tuner Component
// ==========================================
const Tuner = ({ tuner }) => {
  const {
    isStarted, pitch, cents, stringCents, a4Freq, tolerance,
    currentNote, closestString, error, playingTone,
    startTuner, handleReset, cycleA4Freq, cycleTolerance, toggleTone
  } = tuner;

  const getStatusColor = () => {
    if (!isStarted || pitch === 0) return '#1a1a1a';
    if (Math.abs(cents) <= tolerance) return '#4afc9d';
    if (Math.abs(cents) <= tolerance + 15) return '#ffcc00';
    return '#ff4d4d';
  };

  return (
    <div className="w-full h-full flex flex-col items-center relative justify-between tab-enter">
      <div className="w-full flex justify-between items-center h-10 shrink-0 max-w-sm">
        <div className="flex gap-2">
          <button onClick={cycleA4Freq}
            className="flex items-center gap-1.5 bg-[#1a1a1a] border border-gray-800 px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-transform shadow-md">
            <Settings size={13} className="text-gray-500"/>
            <span className="text-gray-400">A4=</span>
            <span className="text-white font-mono text-sm w-7 text-left">{a4Freq}</span>
          </button>
          <button onClick={cycleTolerance}
            className="flex items-center gap-1.5 bg-[#1a1a1a] border border-gray-800 px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-transform shadow-md">
            <div className="w-2 h-2 rounded-full bg-[#4afc9d] shadow-[0_0_6px_#4afc9d]"/>
            <span className="text-gray-400">범위</span>
            <span className="text-white font-mono text-sm w-7 text-left">±{tolerance}</span>
          </button>
        </div>
        <button onClick={handleReset}
          className="text-gray-400 active:rotate-180 transition-all duration-500 bg-[#1a1a1a] p-2 rounded-full border border-gray-800 shadow-md">
          <RotateCcw size={14}/>
        </button>
      </div>

      <div className="flex justify-between items-center w-full max-w-sm px-2 h-36 shrink-0 my-2">
        {VIOLIN_STRINGS.map(s => {
          const isClosest = isStarted && pitch > 0 && closestString.name === s.name;
          const isPlaying = playingTone === s.name;
          const isPerfect = isClosest && Math.abs(stringCents) <= tolerance;
          const abs = Math.abs(stringCents);
          let activeColor = '#ff4d4d';
          if (abs <= tolerance) activeColor = '#4afc9d';
          else if (abs <= tolerance + 30) activeColor = '#ffcc00';
          const showSharp = isClosest && !isPerfect && stringCents > 0;
          const showFlat  = isClosest && !isPerfect && stringCents < 0;
          const sharpPos = showSharp ? Math.min(100, (stringCents / 50) * 100) : 0;
          const flatPos  = showFlat  ? Math.min(100, (-stringCents / 50) * 100) : 0;
          let cc = 'bg-[#1a1a1a] border-gray-600 text-gray-300';
          if (isPlaying)      cc = 'bg-[#8b5a2b] border-[#e9c46a] text-white scale-110 shadow-[0_0_20px_rgba(233,196,106,0.4)] z-10';
          else if (isPerfect) cc = 'bg-[#4afc9d] border-[#4afc9d] text-black scale-110 shadow-[0_0_20px_rgba(74,252,157,0.4)] z-10';
          else if (isClosest) cc = 'bg-[#1a1a1a] border-gray-400 text-white scale-105 z-10';
          return (
            <div key={s.name} className={`flex flex-col items-center justify-center transition-all duration-300 w-12 ${isClosest || isPlaying ? 'opacity-100' : 'opacity-70'}`}>
              <span className={`text-[10px] font-black mb-1 ${isPerfect ? 'text-[#4afc9d]' : isClosest ? 'text-yellow-500' : 'text-gray-400'}`}>{s.id}</span>
              <div className="relative h-10 w-[3px] bg-gray-900 rounded-full mb-1">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-gray-700"/>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-gray-700"/>
                {showSharp && (<>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full transition-all duration-75 z-10 rounded-t-sm" style={{ height: `${sharpPos}%`, backgroundColor: activeColor, boxShadow: `0 0 10px ${activeColor}` }}/>
                  <div className="absolute left-1/2 -translate-x-1/2 w-5 h-[3px] transition-all duration-75 rounded-full z-20" style={{ bottom: `calc(${sharpPos}% - 1.5px)`, backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }}/>
                </>)}
              </div>
              <div className="relative my-0.5">
                <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-sm transition-all duration-200 font-black ${cc}`}>
                  {s.note}<span className="text-[8px] absolute bottom-1 right-2 opacity-80">{s.octave}</span>
                </div>
                <button onClick={() => toggleTone(s.name, s.semitone)}
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center transition-all z-20 ${isPlaying ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-[#151515] border-gray-700 text-gray-500'}`}>
                  {isPlaying ? <VolumeX size={10}/> : <Volume2 size={10}/>}
                </button>
              </div>
              <div className="relative h-10 w-[3px] bg-gray-900 rounded-full mt-1">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-gray-700"/>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-gray-700"/>
                {showFlat && (<>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full transition-all duration-75 z-10 rounded-b-sm" style={{ height: `${flatPos}%`, backgroundColor: activeColor, boxShadow: `0 0 10px ${activeColor}` }}/>
                  <div className="absolute left-1/2 -translate-x-1/2 w-5 h-[3px] transition-all duration-75 rounded-full z-20" style={{ top: `calc(${flatPos}% - 1.5px)`, backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }}/>
                </>)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 max-w-sm relative mt-1">
        <div className="w-full h-full max-h-[260px] rounded-[2.5rem] bg-[#080808] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center relative py-4">
          <div className="absolute top-4 left-4 flex flex-col items-center gap-1 z-10">
            <button onClick={startTuner}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 shadow-xl border-[3px] ${isStarted ? 'bg-red-900/20 border-red-700/50 text-red-500' : 'bg-[#4afc9d]/10 border-[#4afc9d]/30 text-[#4afc9d]'}`}>
              {isStarted ? <Square size={16} fill="currentColor"/> : <Play size={16} fill="currentColor" className="translate-x-0.5"/>}
            </button>
            <span className="text-[9px] font-black tracking-widest text-gray-600 mt-0.5 uppercase">{isStarted ? 'STOP' : 'START'}</span>
          </div>
          <div className="absolute top-4 right-4 flex flex-col items-center gap-1 z-10">
            <div className="w-11 h-11 rounded-full transition-all duration-300 border-[3px] border-black"
              style={{ backgroundColor: getStatusColor(), boxShadow: isStarted && pitch > 0 ? `0 0 30px ${getStatusColor()},inset 0 0 10px rgba(0,0,0,0.8)` : 'none' }}/>
            <span className="text-[9px] font-black tracking-widest mt-0.5 uppercase transition-colors duration-300"
              style={{ color: !isStarted ? '#444' : Math.abs(cents) <= tolerance ? '#4afc9d' : '#888' }}>
              {!isStarted ? 'IDLE' : Math.abs(cents) <= tolerance ? 'PERFECT' : 'TUNE'}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center mt-8">
            <div className="flex items-start">
              <span className="text-[100px] font-black leading-none tracking-tighter"
                style={{ color: (isStarted && pitch > 0) || playingTone ? '#fff' : '#111' }}>
                {playingTone ? playingTone.replace(/[0-9]/, '') : (isStarted && pitch > 0 ? currentNote.name : 'A')}
              </span>
              <div className="flex flex-col mt-2 ml-2">
                <span className="text-4xl font-bold text-[#4afc9d] leading-none mb-1">
                  {isStarted && pitch > 0 ? currentNote.symbol : (playingTone && playingTone.includes('#') ? '#' : '')}
                </span>
                <span className="text-3xl font-bold text-gray-700 leading-none mt-1">
                  {isStarted && pitch > 0 ? currentNote.octave : (playingTone ? playingTone.match(/[0-9]/)[0] : '4')}
                </span>
              </div>
            </div>
            <div className="text-sm font-mono tracking-[0.4em] text-gray-500 mt-2 bg-black/60 px-4 py-1.5 rounded-xl border border-white/5">
              {pitch > 0 ? `${pitch} Hz` : '000.0 Hz'}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm h-28 shrink-0 flex flex-col justify-end gap-3 pb-1 mt-2">
        <div className="flex justify-center items-center gap-4 bg-[#050505] py-2.5 rounded-3xl border border-white/5 shadow-[inset_0_2px_15px_rgba(0,0,0,1)]">
          <div className={`text-4xl font-black font-mono tracking-tighter transition-all duration-300 ${isStarted && pitch > 0 ? (Math.abs(cents) <= tolerance ? 'text-[#4afc9d]' : cents > 0 ? 'text-red-500' : 'text-blue-500') : 'text-[#111]'}`}>
            {isStarted && pitch > 0 ? (cents > 0 ? `+${cents}` : cents) : '0'}
          </div>
          <div className="flex flex-col border-l border-gray-800 pl-3">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest italic">Cents</span>
            <span className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Offset</span>
          </div>
        </div>
        <div className="flex justify-between items-end gap-1 px-1 h-6">
          {CENT_STEPS.map(step => {
            const isTarget = isStarted && pitch > 0 && Math.abs(cents - step) <= 5;
            return (
              <div key={step} className="flex flex-col items-center flex-1">
                <div className={`w-full transition-all duration-200 rounded-sm ${isTarget ? 'h-6 bg-white shadow-[0_0_15px_white]' : 'h-1.5 bg-gray-900'}`}
                  style={step === 0 && !isTarget ? { backgroundColor: '#333' } : {}}/>
                <span className={`text-[7px] mt-1.5 font-black ${isTarget ? 'text-white' : 'text-gray-800'}`}>{step === 0 ? '0' : step}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm rounded-[2.5rem]">
          <div className="w-[85%] bg-gray-900/95 p-6 rounded-3xl flex flex-col items-center gap-4 border border-gray-700 shadow-2xl">
            <AlertCircle size={36} className="text-red-400"/>
            <p className="text-sm text-center text-white font-bold leading-relaxed whitespace-pre-line">{error}</p>
            <div className="flex gap-3 mt-2 w-full">
              <button onClick={handleReset} className="flex-1 py-3 bg-gray-800 text-white text-sm font-bold rounded-full border border-gray-600">닫기</button>
              <button onClick={() => window.location.reload()} className="flex-1 py-3 bg-[#4afc9d] text-black text-sm font-bold rounded-full">새로고침</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Metronome Hook
// ==========================================
const useMetronomeLogic = () => {
  const [bpm, setBpm] = useState(60);
  const [isPlayingMetro, setIsPlayingMetro] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [timeSig, setTimeSig] = useState({ num: 4, den: 4 });
  const [beatSounds, setBeatSounds] = useState([2,1,1,1]);
  const [beatSubdivisions, setBeatSubdivisions] = useState([1,1,1,1]);
  const [visualFlash, setVisualFlash] = useState(false);

  const isPlayingRef       = useRef(false);
  const bpmRef             = useRef(bpm);
  const metroAudioCtxRef   = useRef(null);
  const nextNoteTimeRef    = useRef(0.0);
  const currentBeatRef     = useRef(0);
  const currentSubBeatRef  = useRef(0);
  const timerIDRef         = useRef(null);
  const timeSigRef         = useRef(timeSig);
  const beatSoundsRef      = useRef(beatSounds);
  const beatSubdivisionsRef = useRef(beatSubdivisions);
  const pressTimeoutRef    = useRef(null);
  const pressIntervalRef   = useRef(null);
  const lookahead = 25.0;
  const scheduleAheadTime = 0.1;

  useEffect(() => () => { stopMetronome(); handlePressEnd(); }, []);
  useEffect(() => {
    timeSigRef.current = timeSig; beatSoundsRef.current = beatSounds; beatSubdivisionsRef.current = beatSubdivisions;
    if (currentBeat >= timeSig.num) { setCurrentBeat(0); currentBeatRef.current = 0; }
  }, [timeSig, beatSounds, beatSubdivisions, currentBeat]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  const initMetroAudioContext = () => {
    if (!metroAudioCtxRef.current) metroAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (metroAudioCtxRef.current.state === 'suspended') metroAudioCtxRef.current.resume();
  };

  const restartMetroIfNeeded = () => {
    if (isPlayingRef.current) { stopMetronome(); setTimeout(startMetronome, 50); }
  };

  const changeNumerator = (delta) => {
    setTimeSig(prev => {
      const nextNum = Math.max(1, Math.min(16, prev.num + delta));
      setBeatSounds(getDefaultBeatSounds(nextNum));
      setBeatSubdivisions(prevSub => {
        const nextSub = [...prevSub];
        if (nextNum > nextSub.length) for (let i = nextSub.length; i < nextNum; i++) nextSub.push(1);
        else nextSub.length = nextNum;
        return nextSub;
      });
      return { ...prev, num: nextNum };
    });
    restartMetroIfNeeded(); haptic(8);
  };

  const changeDenominator = (delta) => {
    setTimeSig(prev => {
      const opts = [2, 4, 8, 16];
      let idx = (opts.indexOf(prev.den) + delta) % opts.length;
      if (idx < 0) idx += opts.length;
      return { ...prev, den: opts[idx] };
    });
    restartMetroIfNeeded(); haptic(8);
  };

  const toggleBeatSubdivision = (index) => {
    setBeatSubdivisions(prev => { const next = [...prev]; next[index] = next[index] === 4 ? 1 : next[index] + 1; return next; });
    restartMetroIfNeeded(); haptic(8);
  };

  const toggleBeatSound = (index) => {
    setBeatSounds(prev => {
      const next = [...prev]; const cur = next[index];
      if (cur === 2) next[index] = 3; else if (cur === 3) next[index] = 1;
      else if (cur === 1) next[index] = 0; else next[index] = 2;
      return next;
    });
    haptic(8);
  };

  const nextNote = () => {
    const csb = beatSubdivisionsRef.current[currentBeatRef.current] || 1;
    const spb = (60.0 / bpmRef.current) * (4 / timeSigRef.current.den);
    nextNoteTimeRef.current += spb / csb;
    currentSubBeatRef.current++;
    if (currentSubBeatRef.current >= csb) { currentSubBeatRef.current = 0; currentBeatRef.current = (currentBeatRef.current + 1) % timeSigRef.current.num; }
  };

  const scheduleNote = (beatNumber, subBeatNumber, time) => {
    const delay = (time - metroAudioCtxRef.current.currentTime) * 1000;
    if (subBeatNumber === 0) {
      setTimeout(() => { if (!isPlayingRef.current) return; setCurrentBeat(beatNumber); setVisualFlash('main'); setTimeout(() => { if (isPlayingRef.current) setVisualFlash(false); }, 150); }, Math.max(0, delay));
    } else {
      setTimeout(() => { if (!isPlayingRef.current) return; setVisualFlash('sub'); setTimeout(() => { if (isPlayingRef.current) setVisualFlash(false); }, 100); }, Math.max(0, delay));
    }
    const soundType = subBeatNumber === 0 ? beatSoundsRef.current[beatNumber] : -1;
    if (soundType > 0 || soundType === -1) {
      const osc = metroAudioCtxRef.current.createOscillator();
      const gain = metroAudioCtxRef.current.createGain();
      osc.type = 'square';
      let freq = 1000, vol = 1.0;
      if (soundType === 2) { freq = 2000; vol = 1.0; } else if (soundType === 3) { freq = 1500; vol = 0.85; }
      else if (soundType === 1) { freq = 1000; vol = 0.7; } else if (soundType === -1) { freq = 1200; vol = 0.5; }
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, time);
      const dur = soundType === -1 ? 0.02 : 0.04;
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain); gain.connect(metroAudioCtxRef.current.destination);
      osc.start(time); osc.stop(time + dur + 0.01);
    }
  };

  const scheduler = () => {
    if (!isPlayingRef.current) return;
    while (nextNoteTimeRef.current < metroAudioCtxRef.current.currentTime + scheduleAheadTime) {
      scheduleNote(currentBeatRef.current, currentSubBeatRef.current, nextNoteTimeRef.current);
      nextNote();
    }
    timerIDRef.current = window.setTimeout(scheduler, lookahead);
  };

  const startMetronome = () => {
    if (isPlayingRef.current) return;
    window.clearTimeout(timerIDRef.current);
    initMetroAudioContext(); haptic(20);
    isPlayingRef.current = true; setIsPlayingMetro(true);
    currentBeatRef.current = 0; currentSubBeatRef.current = 0; setCurrentBeat(0);
    nextNoteTimeRef.current = metroAudioCtxRef.current.currentTime + 0.05;
    scheduler();
  };

  const stopMetronome = () => {
    isPlayingRef.current = false; setIsPlayingMetro(false);
    window.clearTimeout(timerIDRef.current); setCurrentBeat(-1); haptic(10);
  };

  const toggleMetronome = () => { isPlayingRef.current ? stopMetronome() : startMetronome(); };
  const handleBpmChange = (e) => setBpm(Number(e.target.value));
  const handlePressStart = (delta) => {
    setBpm(prev => Math.min(Math.max(30, prev + delta), 250)); haptic(8);
    pressTimeoutRef.current = setTimeout(() => {
      pressIntervalRef.current = setInterval(() => { setBpm(prev => Math.min(Math.max(30, prev + delta), 250)); }, 70);
    }, 300);
  };
  const handlePressEnd = () => { clearTimeout(pressTimeoutRef.current); clearInterval(pressIntervalRef.current); };

  return {
    bpm, setBpm, isPlayingMetro, currentBeat, timeSig, beatSounds, beatSubdivisions, visualFlash,
    toggleMetronome, changeNumerator, changeDenominator, toggleBeatSubdivision, toggleBeatSound,
    handleBpmChange, handlePressStart, handlePressEnd
  };
};

// ==========================================
// 2. Metronome Component
// ==========================================
const Metronome = ({ metro }) => {
  const {
    bpm, isPlayingMetro, currentBeat, timeSig, beatSounds, beatSubdivisions, visualFlash,
    toggleMetronome, changeNumerator, changeDenominator, toggleBeatSubdivision, toggleBeatSound,
    handleBpmChange, handlePressStart, handlePressEnd
  } = metro;

  return (
    <div className="w-full h-full flex flex-col items-center tab-enter gap-3">
      <div className="w-full flex-1 rounded-[2.5rem] bg-[#080808] border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center py-4 px-3 relative min-h-0">
        <div className="w-full flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between w-full px-2">
            <div className="flex flex-col items-center bg-[#111] p-1 rounded-2xl border border-gray-800 w-14">
              <button onClick={() => changeNumerator(1)} className="text-gray-500 active:text-white p-1"><ChevronUp size={20}/></button>
              <span className="text-xl font-black text-white leading-none my-0.5">{timeSig.num}</span>
              <button onClick={() => changeNumerator(-1)} className="text-gray-500 active:text-white p-1"><ChevronDown size={20}/></button>
            </div>
            <span className="text-2xl font-black text-gray-700 italic">/</span>
            <div className="flex flex-col items-center bg-[#111] p-1 rounded-2xl border border-gray-800 w-14">
              <button onClick={() => changeDenominator(1)} className="text-gray-500 active:text-white p-1"><ChevronUp size={20}/></button>
              <span className="text-xl font-black text-[#4afc9d] leading-none my-0.5">{timeSig.den}</span>
              <button onClick={() => changeDenominator(-1)} className="text-gray-500 active:text-white p-1"><ChevronDown size={20}/></button>
            </div>
          </div>
        </div>
        <div className={`grid justify-center justify-items-center w-full px-1 shrink-0 ${beatSounds.length > 8 ? 'gap-x-1.5 gap-y-2 mt-3' : 'gap-x-2 mt-4'}`}
          style={{ gridTemplateColumns: `repeat(${Math.min(beatSounds.length, 8)},minmax(0,auto))` }}>
          {beatSounds.map((s, i) => {
            const fired = (i === currentBeat) && (visualFlash === 'main');
            const isDense = beatSounds.length > 8;
            return (
              <div key={i} className={`flex flex-col items-center ${isDense ? 'gap-1' : 'gap-2'}`}>
                <button onClick={() => toggleBeatSound(i)}
                  className={`${isDense ? 'w-7 h-7 border-[1.5px]' : 'w-9 h-9 border-2'} rounded-full transition-all duration-100 ${fired ? 'scale-110 ring-2 ring-white/30 ring-offset-2 ring-offset-[#080808]' : ''} ${s === 2 ? 'bg-[#ffcc00] border-[#ffcc00] shadow-[0_0_15px_#ffcc00]' : s === 3 ? 'bg-[#f97316] border-[#f97316] shadow-[0_0_12px_#f97316]' : s === 1 ? 'bg-[#4afc9d] border-[#4afc9d] shadow-[0_0_10px_#4afc9d]' : 'bg-transparent border-gray-700'}`}/>
                <button onClick={() => toggleBeatSubdivision(i)} className="text-gray-500 active:text-[#4afc9d] transition-colors">
                  {renderSubdivisionIcon(beatSubdivisions[i], isDense ? "h-5 w-auto" : "h-7 w-auto")}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex-1 w-full flex items-center justify-center my-2 min-h-0">
          {(() => {
            const isABS = currentBeat >= 0 && beatSounds[currentBeat] > 0;
            const bst = currentBeat >= 0 ? beatSounds[currentBeat] : 0;
            let pc = 'bg-[#151515] border-4 border-[#080808] shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] scale-90';
            if (visualFlash === 'main' && isABS) {
              if (bst === 2) pc = 'bg-[#ffcc00] shadow-[0_0_40px_#ffcc00] scale-125 border-transparent';
              else if (bst === 3) pc = 'bg-[#f97316] shadow-[0_0_35px_#f97316] scale-[1.15] border-transparent';
              else pc = 'bg-[#4afc9d] shadow-[0_0_30px_#4afc9d] scale-110 border-transparent';
            } else if (visualFlash === 'sub') { pc = 'bg-[#0ea5e9] shadow-[0_0_25px_#0ea5e9] scale-105 border-transparent'; }
            return <div className={`w-16 h-16 rounded-full transition-all duration-100 ease-out flex items-center justify-center ${pc}`}><div className="w-6 h-6 rounded-full bg-white/20 mix-blend-overlay"/></div>;
          })()}
        </div>
        <div className="flex flex-col items-center shrink-0 mb-1">
          <span className="text-[40px] font-black leading-none tracking-tighter text-white">{bpm}</span>
          <span className="text-[8px] font-bold text-[#ffcc00]/80 tracking-widest uppercase mt-1">{getTempoMarking(bpm)}</span>
        </div>
      </div>
      <div className="w-full flex flex-col gap-2.5 shrink-0">
        <div className="flex justify-between items-center gap-2">
          <button onPointerDown={() => handlePressStart(-1)} onPointerUp={handlePressEnd} onPointerLeave={handlePressEnd}
            style={{ touchAction: 'none' }}
            className="w-12 h-12 rounded-xl bg-[#111] border border-gray-800 flex items-center justify-center active:bg-gray-800 shrink-0">
            <Minus size={20} className="text-gray-400 pointer-events-none"/>
          </button>
          <button onClick={toggleMetronome}
            className={`flex-1 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl border-[2px] ${isPlayingMetro ? 'bg-[#ffcc00]/10 border-[#ffcc00]/30 text-[#ffcc00]' : 'bg-[#4afc9d]/10 border-[#4afc9d]/30 text-[#4afc9d]'}`}>
            {isPlayingMetro ? <Square size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="translate-x-1"/>}
          </button>
          <button onPointerDown={() => handlePressStart(1)} onPointerUp={handlePressEnd} onPointerLeave={handlePressEnd}
            style={{ touchAction: 'none' }}
            className="w-12 h-12 rounded-xl bg-[#111] border border-gray-800 flex items-center justify-center active:bg-gray-800 shrink-0">
            <Plus size={20} className="text-gray-400 pointer-events-none"/>
          </button>
        </div>
        <div className="flex items-center bg-[#0a0a0a] py-3 px-4 rounded-[1.5rem] border border-gray-800 shadow-inner">
          <input type="range" min="30" max="250" value={bpm} onChange={handleBpmChange} className="w-full cursor-pointer accent-[#4afc9d]"/>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. Fingerboard Component
// ==========================================
const Fingerboard = ({ tuner, metro }) => {
  const [selectedKey, setSelectedKey] = useState('C Major (0)');
  const currentScale = KEY_SIGNATURES[selectedKey];
  const detectedStr = (tuner.isStarted && tuner.pitch > 0) ? tuner.currentNote.name + tuner.currentNote.symbol : null;
  const detectedOctave = tuner.isStarted ? tuner.currentNote.octave : null;
  const displayStrings = [...FINGERBOARD_STRINGS_EXT].reverse();

  return (
    <div className="w-full h-full flex flex-col tab-enter gap-2">
      <div className="w-full flex justify-between items-center h-10 shrink-0 px-1">
        <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-gray-800 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-md">
          <span className="text-gray-400">조표=</span>
          <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
            className="bg-transparent text-white font-mono text-[10px] outline-none cursor-pointer">
            {Object.keys(KEY_SIGNATURES).map(k => <option key={k} value={k} className="bg-[#1a1a1a] text-white">{k}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pr-1">
          {tuner.isStarted && (
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full animate-pulse ${detectedStr ? (Math.abs(tuner.cents) <= tuner.tolerance ? 'bg-[#4afc9d]' : 'bg-[#ff4d4d]') : 'bg-[#4afc9d]'}`}/>
              <span className={`text-[11px] font-black tracking-widest ${Math.abs(tuner.cents) <= tuner.tolerance ? 'text-[#4afc9d]' : 'text-[#ff4d4d]'}`}>
                {detectedStr ? `${detectedStr}${detectedOctave}` : 'ON'}
              </span>
            </div>
          )}
          {tuner.isStarted && <div className="w-[1px] h-3 bg-gray-700"/>}
          {(() => {
            let cls = 'bg-gray-800 text-gray-400 border border-gray-700';
            if (metro.isPlayingMetro) {
              const bt = metro.currentBeat >= 0 ? metro.beatSounds[metro.currentBeat] : 0;
              if (metro.visualFlash === 'main') {
                if (bt === 2) cls = 'bg-[#ffcc00] text-black shadow-[0_0_15px_#ffcc00] scale-110 border-transparent';
                else if (bt === 3) cls = 'bg-[#f97316] text-black shadow-[0_0_12px_#f97316] scale-110 border-transparent';
                else cls = 'bg-[#4afc9d] text-black shadow-[0_0_10px_#4afc9d] scale-105 border-transparent';
              } else if (metro.visualFlash === 'sub') cls = 'bg-[#0ea5e9] text-white shadow-[0_0_10px_#0ea5e9] scale-105 border-transparent';
            }
            return (
              <button onClick={metro.toggleMetronome} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-75 ${cls}`}>
                <span className="text-[10px] font-black">{metro.bpm}</span>
                {metro.isPlayingMetro ? <Square size={10} fill="currentColor"/> : <Play size={10} fill="currentColor" className="translate-x-[0.5px]"/>}
              </button>
            );
          })()}
        </div>
      </div>

      <div className="w-full flex-1 rounded-2xl bg-[#050505] border border-gray-800 flex flex-col relative px-2 py-2 min-h-0 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
        <div className="flex w-full items-center mb-1 z-20 shrink-0">
          {displayStrings.map(s => (
            <div key={s.string} className="flex-1 flex justify-center">
              <span className="bg-[#1a1a1a] border border-gray-700 text-[#ffcc00] text-[9px] font-black px-2 py-0.5 rounded shadow-md">{s.string}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 flex w-full relative z-10 min-h-0">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 px-2">
            {Array.from({ length: 26 }).map((_, i) => (
              <div key={`line-${i}`} className="flex-1 flex items-center w-full">
                <div className={`w-full rounded-full ${(i === 0 || i % 5 === 0) ? 'border-t-[3px] border-solid border-[#0ea5e9]/60 shadow-[0_0_8px_rgba(14,165,233,0.4)]' : 'border-t-[1.5px] border-dashed border-gray-600/50'}`}/>
              </div>
            ))}
          </div>
          {displayStrings.map((s, idx) => (
            <div key={s.string} className="flex-1 flex flex-col items-center relative h-full">
              <div className={`absolute top-0 bottom-0 bg-gray-600 rounded-full z-0 ${idx === 0 ? 'w-[5px]' : idx === 1 ? 'w-[4px]' : idx === 2 ? 'w-[2.5px]' : 'w-[1.5px]'}`}/>
              <div className="flex-1 w-full flex flex-col justify-between z-10">
                {Array.from({ length: 26 }).map((_, pos) => {
                  const note = s.notes[pos];
                  const msn = note.names.find(n => currentScale.includes(n));
                  const inScale = !!msn;
                  const isOpenString = note.pos === 0;
                  const isDetected = detectedStr && note.names.includes(detectedStr) && note.octave === detectedOctave;
                  const isPlaying = tuner.playingTone === note.id;
                  const sfA4 = (note.octave * 12 + note.noteIndex) - 57;
                  if (!inScale && !isDetected && !isPlaying) {
                    return <div key={pos} className="flex-1 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-gray-700/80 active:bg-[#8b5a2b]" onClick={() => tuner.toggleTone(note.id, sfA4)}/></div>;
                  }
                  const ipp = Math.abs(tuner.cents) <= tuner.tolerance;
                  let as = '';
                  if (isPlaying) as = 'bg-[#8b5a2b] text-white shadow-[0_0_20px_rgba(233,196,106,0.6)] z-40 scale-[1.3] border-[#e9c46a] border-[1.5px]';
                  else if (isDetected) as = ipp ? 'bg-[#4afc9d] text-black shadow-[0_0_20px_#4afc9d] z-30 scale-[1.3] border-transparent' : 'bg-[#ff4d4d] text-white shadow-[0_0_20px_#ff4d4d] z-30 scale-[1.3] border-transparent';
                  else as = isOpenString ? 'bg-gray-800 text-gray-200 border border-gray-500' : 'bg-[#151515] text-gray-300 border border-gray-700';
                  const dn = (isDetected && !inScale) || isPlaying ? note.names[0] : msn;
                  const yo = ipp ? 0 : Math.max(-18, Math.min(18, tuner.cents / 2));
                  return (
                    <div key={pos} className="flex-1 flex items-center justify-center relative w-full">
                      <div className="relative flex items-center justify-center">
                        {isDetected && !isPlaying && (
                          <div className={`absolute right-full mr-1 flex flex-col items-center justify-center animate-pulse ${ipp ? 'text-[#4afc9d]' : 'text-[#ff4d4d]'}`}
                            style={{ top: '50%', transform: `translateY(calc(-50% + ${yo}px))` }}>
                            {!ipp && tuner.cents < 0 && <span className="text-[10px] font-black leading-none mb-[2px]">▴</span>}
                            <span className="text-[16px] leading-none">▸</span>
                            {!ipp && tuner.cents > 0 && <span className="text-[10px] font-black leading-none mt-[2px]">▾</span>}
                          </div>
                        )}
                        <button onClick={() => tuner.toggleTone(note.id, sfA4)}
                          className={`flex items-center justify-center font-black text-[12px] transition-all duration-100 px-1.5 py-[2px] leading-none whitespace-nowrap min-w-[28px] cursor-pointer ${isOpenString ? 'rounded-[4px]' : 'rounded-full'} ${as}`}>
                          {dn}
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
    </div>
  );
};

// ==========================================
// 4. App (Root Component)
// ==========================================
const App = () => {
  const tuner = useTunerLogic();
  const metro = useMetronomeLogic();
  const [activeTab, setActiveTab] = useState('tuner');

  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
    };
    requestWakeLock();
    const onVC = () => { if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', onVC);
    return () => { document.removeEventListener('visibilitychange', onVC); wakeLock?.release().catch(() => {}); };
  }, []);

  const switchTab = (tab) => { if (tab !== activeTab) { setActiveTab(tab); haptic(12); } };

  const TAB_NAV = [
    { id: 'tuner',       label: 'Tuner',  color: '#4afc9d', Icon: Activity  },
    { id: 'metronome',   label: 'Metro',  color: '#ffcc00', Icon: Music     },
    { id: 'fingerboard', label: 'Finger', color: '#0ea5e9', Icon: LayoutGrid },
  ];

  return (
    <div
      className="fixed inset-0 bg-black text-white flex flex-col items-center font-sans select-none overflow-hidden"
      style={{ paddingLeft: 'env(safe-area-inset-left,0px)', paddingRight: 'env(safe-area-inset-right,0px)' }}
    >
      <div
        className="flex-1 w-full max-w-md flex flex-col px-4 overflow-hidden"
        style={{ paddingTop: 'max(1rem,env(safe-area-inset-top,0px))', paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom,0px))' }}
      >
        <div className={activeTab === 'tuner'       ? 'flex flex-col w-full h-full' : 'hidden'}><Tuner       tuner={tuner}/></div>
        <div className={activeTab === 'metronome'   ? 'flex flex-col w-full h-full' : 'hidden'}><Metronome   metro={metro}/></div>
        <div className={activeTab === 'fingerboard' ? 'flex flex-col w-full h-full' : 'hidden'}><Fingerboard tuner={tuner} metro={metro}/></div>
      </div>

      <nav
        className="absolute bottom-0 w-full max-w-md bg-black/95 backdrop-blur-md border-t border-gray-900 pt-2 px-2 flex justify-around z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]"
        style={{ paddingBottom: 'max(0.5rem,env(safe-area-inset-bottom,0px))' }}
      >
        {TAB_NAV.map(({ id, label, color, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => switchTab(id)}
              className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-2xl transition-all duration-200 active:scale-90"
              style={{ color: active ? color : '#4b5563' }}>
              <div className="w-1 h-1 rounded-full mb-0.5 transition-all duration-200"
                style={{ background: active ? color : 'transparent', boxShadow: active ? `0 0 6px ${color}` : 'none' }}/>
              <Icon size={22} strokeWidth={active ? 2.5 : 2}/>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: active ? color : '#4b5563' }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default App;
