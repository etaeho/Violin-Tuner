import { BarChart3 } from 'lucide-react';
import { PlannedScreen } from '@/ui/components/PlannedScreen';

export function LogScreen() {
  return <PlannedScreen icon={<BarChart3 size={28} />} title="기록"
    lead="버튼 없이 자동으로 쌓이는 연습 시간과 음정 정확도."
    items={[
      { stage: 4, name: '오늘 · 목표 · 연속일', desc: '목표 링, 🔥 연속 연습일, 연주/튜닝/드론 시간' },
      { stage: 4, name: '12주 달력 · 7일 그래프', desc: '연습량 달력, 요일별 막대 + 정확도 선' },
      { stage: 4, name: '정확도 추이', desc: '30일 정확도, 자주 틀리는 음 Top 5' },
      { stage: 5, name: '백업', desc: '기록 내보내기 / 가져오기 (파일)' },
    ]} />;
}
