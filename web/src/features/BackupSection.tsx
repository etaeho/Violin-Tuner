// 설정 시트: 백업 내보내기 / 가져오기
import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { applyBackup, backupFileName, buildBackup, parseBackup } from '@/data/backup';
import { Section } from '@/ui/components/Sheet';
import { haptic } from '@/ui/haptic';
import { lockPersistence } from '@/store/storage';

declare global {
  interface Window { VTNative?: { saveFile: (name: string, text: string) => void }; __vtSaved?: (ok: boolean) => void }
}

export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(null);

  const exportNow = () => {
    haptic(10);
    const json = JSON.stringify(buildBackup(localStorage), null, 1);
    const name = backupFileName();
    if (window.VTNative) {
      // 안드로이드 앱: 저장 위치를 고르는 창 (MainActivity)
      window.__vtSaved = (ok) => setMsg(ok ? { ok: true, text: '백업 파일을 저장했습니다.' } : { ok: false, text: '저장을 취소했습니다.' });
      window.VTNative.saveFile(name, json);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = name; a.click(); URL.revokeObjectURL(a.href);
      setMsg({ ok: true, text: `${name} 다운로드` });
    }
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try { setPending(parseBackup(await f.text())); setMsg(null); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Section title="백업">
      <div className="flex gap-2">
        <button onClick={exportNow} className="flex-1 chip py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"><Download size={14} className="text-accent" />내보내기</button>
        <button onClick={() => fileRef.current?.click()} className="flex-1 chip py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"><Upload size={14} className="text-accent" />가져오기</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {pending && (
        <div className="inset p-3 flex flex-col gap-2 border-warn/50">
          <p className="text-xs"><b>{new Date(pending.exportedAt).toLocaleString('ko-KR')}</b> 백업으로 <b className="text-sharp">지금 설정과 기록을 모두 바꿉니다.</b></p>
          <div className="flex gap-2">
            <button onClick={() => setPending(null)} className="flex-1 chip py-2 text-xs font-bold">취소</button>
            <button onClick={() => { lockPersistence(); applyBackup(localStorage, pending); location.reload(); }} className="flex-1 py-2 rounded-pill bg-sharp text-white text-xs font-black">바꾸기</button>
          </div>
        </div>
      )}
      {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-good' : 'text-sharp'}`}>{msg.text}</p>}
      <p className="text-[10px] text-dim leading-snug">설정 · 템포 · 드론 · 연습 기록을 파일 하나로 저장합니다. 폰을 바꾸거나 앱을 다시 설치할 때 가져오세요.</p>
    </Section>
  );
}
