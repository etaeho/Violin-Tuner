import { Music } from 'lucide-react';
import { PlannedScreen } from '@/ui/components/PlannedScreen';

export function PracticeScreen() {
  return <PlannedScreen icon={<Music size={28} />} title="연습"
    lead="메트로놈과 드론을 한 화면에. 필요한 모듈만 켜서 씁니다."
    items={[
      { stage: 3, name: '박자 모듈', desc: 'BPM 다이얼, 강세·세분박, TAP, 프리셋, 점진 템포(N마디마다 +BPM)' },
      { stage: 3, name: '드론 모듈', desc: '근음 + 5도·옥타브·3도 (순정 비율), 음색, 페이드' },
      { stage: 3, name: '음정 게이지', desc: '연주한 음이 드론/조표 기준으로 몇 센트 벗어났는지' },
      { stage: 3, name: '연습 타이머 · 연주 명령', desc: '오늘 목표, G→E→G 같은 음 패턴으로 시작/정지' },
    ]} />;
}
