import { LayoutGrid } from 'lucide-react';
import { PlannedScreen } from '@/ui/components/PlannedScreen';

export function FingerboardScreen() {
  return <PlannedScreen icon={<LayoutGrid size={28} />} title="지판"
    lead="조표와 스케일, 그리고 내가 자주 틀리는 음을 지판 위에."
    items={[
      { stage: 4, name: '지판 · 조표', desc: '조표별 음 표시, 연주 중인 음 위치, 박자에 맞춰 테두리 빛남' },
      { stage: 4, name: '음정 히트맵', desc: '자주 높게 내는 음은 빨강, 낮게 내는 음은 파랑' },
      { stage: 4, name: '스케일 연습', desc: '다음 음 안내 + 음별 정확도 기록' },
    ]} />;
}
