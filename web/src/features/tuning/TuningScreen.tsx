import { Activity } from 'lucide-react';
import { PlannedScreen } from '@/ui/components/PlannedScreen';

export function TuningScreen() {
  return <PlannedScreen icon={<Activity size={28} />} title="튜닝"
    lead="켜면 바로 듣고, 현마다 흐르는 세로 테이프로 맞춥니다."
    items={[
      { stage: 2, name: '새 오디오 엔진', desc: '음정 분석을 오디오 전용 스레드(AudioWorklet)로 — 바늘 끊김 없음' },
      { stage: 2, name: '현별 세로 테이프', desc: 'G·D·A·E 테이프, 맞으면 원이 초록 + "울림" 물결이 잔잔해짐' },
      { stage: 2, name: '순정 5도 조율', desc: 'A 기준 5도로: E +2¢ · D −2¢ · G −4¢ (평균율과 전환)' },
      { stage: 2, name: '기준음 · A4 · 감도', desc: '원 탭 → 기준음, A4 430~450, 주변 소음 자동 측정' },
    ]} />;
}
