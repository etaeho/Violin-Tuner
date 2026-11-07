import { SlidersHorizontal } from 'lucide-react';
import { Sheet, Section } from '@/ui/components/Sheet';
import { THEMES, useSettings, type ThemeId } from '@/store/settings';
import { haptic } from '@/ui/haptic';

// 테마 미리보기: 각 테마 토큰으로 직접 칠함
const PREVIEW: Record<ThemeId, { bg: string; card: string; ink: string; accent: string }> = {
  tape: { bg: '#000', card: '#111', ink: '#e5e7eb', accent: '#4afc9d' },
  vintage: { bg: 'linear-gradient(180deg,#6e4220,#3a200d)', card: '#1a0f07', ink: '#f4e3b5', accent: '#f6dd94' },
  light: { bg: '#f4f3ee', card: '#fff', ink: '#18181b', accent: '#059669' },
};

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  return (
    <Sheet title="설정" icon={<SlidersHorizontal size={16} className="text-accent" />} onClose={onClose}>
      <Section title="테마">
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const p = PREVIEW[t.id], on = theme === t.id;
            return (
              <button key={t.id} onClick={() => { setTheme(t.id); haptic(10); }}
                className={`rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${on ? 'border-accent' : 'border-line'}`}>
                <div className="h-16 p-2 flex flex-col justify-end gap-1" style={{ background: p.bg }}>
                  <div className="h-6 rounded-md flex items-center justify-center gap-1" style={{ background: p.card }}>
                    {[0, 1, 2, 3].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === 2 ? p.accent : p.ink, opacity: i === 2 ? 1 : 0.3 }} />)}
                  </div>
                </div>
                <div className={`py-1.5 ${on ? 'bg-accent/10' : 'bg-chip'}`}>
                  <div className={`text-xs font-black ${on ? 'text-accent' : 'text-ink'}`}>{t.name}</div>
                  <div className="text-[9px] text-dim">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="정보">
        <p className="text-xs text-dim leading-relaxed">
          Violin Tuner <b className="text-ink">v2 개발 버전</b> — 기존 앱(v1)과 따로 설치됩니다.
          감도·연주 명령 설정은 2~3단계에서 이 시트에 추가됩니다.
        </p>
      </Section>
    </Sheet>
  );
}
