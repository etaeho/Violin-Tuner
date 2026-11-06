# 바이올린 튜너 앱 시장 조사 — 장단점 · 아쉬운 점

> 조사일: 2026-11-06 · 자료: 앱스토어/구글플레이 리뷰, 리뷰 집계 사이트, 바이올린 포럼(violinist.com, r/violinist, Fiddlerman)
> ⚠️ 대부분 사용자 후기·스토어 설명이라 **통계가 아닌 경향**으로 볼 것. 한국어 후기는 거의 없어 영어권 위주.

## 조사 대상
LikeTones, ViolinTuner(KME), Simply Tuner, Violin Tuner Simple/Basic, Tuneo, TonalEnergy, GuitarTuna, Soundcorset, Cleartune, nTrack Tuner, Drone Tuner

## 👍 자주 칭찬받는 점
| 장점 | 예시 |
|---|---|
| 광고 없음 + 단순함 | 평점 1위 LikeTones(4.9★, 3.1K)의 핵심 평가가 "무료·광고 없음·쉬움" |
| 정확도 | KME, Simply Tuner "정확하다" 후기 다수 |
| 옥타브가 안 튐 | Tuneo "다른 앱은 옥타브가 왔다갔다 해서 못 썼는데 이건 안정적" |
| 반응 부드럽게 하는 모드 | TonalEnergy: 처음엔 "너무 튄다" → 보이스 모드(스무딩)로 해결 |
| 연습 도구 통합 | TonalEnergy·Soundcorset: 녹음, 음정 기록, 연습 시간 통계, 메트로놈 |
| 기준음 재생, A4 조절 | 대부분 기본 제공 |

## 👎 불만 · 아쉬운 점 (빈도순)
1. **광고·구독 강요** — 1위 불만. GuitarTuna "구독 화면 건너뛸 수 없음", "조율 방식이 유료 잠금". 튜닝 중 전면광고, 광고가 기준음을 끊거나 튜닝 버튼을 가림.
2. **주변 소음 반응** — nTrack "아주 작은 소음에도 반응", Cleartune "다른 악기 동시 조율 시 사용 불가", LikeTones "시끄러운 곳에선 헷갈림".
3. **바늘 튐 / 옥타브 오인식** — 표시가 계속 흔들리거나 한 음에 멈춰서 안 바뀌는 버그.
4. **G현(최저음) 인식 문제** — Simply Tuner "3줄은 되는데 G현에서 실패", LikeTones "G 개방현이 맞다고 나오는데 틀린 소리", KME "튜닝 중 멈춤".
5. **앱마다 측정값이 다름** — 초보자가 어느 앱을 믿어야 할지 혼란 (r/violinist).
6. **너무 복잡** — TonalEnergy "기능 최고지만 가장 다루기 어렵다".
7. **너무 단순** — Violin Tuner Simple "배우는 사람에겐 너무 기본적".
8. **배터리 소모** — 백그라운드에서 계속 동작.
9. **조율 방식 한계 (중급↑·선생님)** — 대부분 평균율만 지원. 바이올린은 **순정 5도**로 조율하는데 지원 앱이 거의 없음. 포럼에서는 음정 연습엔 튜너보다 **드론(지속음) 연습**을 권함.
10. **안드로이드 차별** — TonalEnergy는 iOS만 외부 블루투스 마이크 지원.

## 🎻 우리 앱과 비교

### 이미 해결된 것 (차별점)
| 타 앱 불만 | 우리 앱 |
|---|---|
| 광고·구독 | 없음 |
| 소음 반응 | 노이즈 게이트 + 신뢰도 필터 + **주변 소음 자동 측정** |
| 바늘 튐 / 멈춤 | 확정 프레임·평균·표시 유지 시간 설정 |
| 배터리 | 앱을 내리면 마이크 자동 정지 |
| 복잡함 | 메인은 단순, 세부는 설정 시트에 |

### 개선 후보 (임팩트 순)
1. **순정 5도 조율 모드** — A 기준 5도로: E +2¢, D −2¢, G −4¢. 현별 막대에 반영. 구현 가벼움, 지원 앱 드묾.
2. **드론 모드** — 근음(+5도) 지속음 위에서 연주 음정 판정. 선생님들이 가장 권하는 연습법. → [drone-mode-plan.md](drone-mode-plan.md) (1단계 구현됨)
3. **G현/옥타브 검증** — 실제 G현 테스트, 필요 시 "가장 가까운 현 옥타브 고정".
4. **연습 기록** — 연습 시간 타이머, 일별 연습량, 음정 정확도 추이. → [practice-log-plan.md](practice-log-plan.md)
5. **녹음 후 음정 리뷰** — 녹음 재생하며 음정 그래프 (이전 피치맵 재활용).
6. **오케스트라 모드** — 주변 악기 소리에 강한 감도 프리셋.

## 출처
- [LikeTones Reviews (justuseapp)](https://justuseapp.com/en/app/6444514353/violin-tuner-liketones/reviews) · [App Store](https://apps.apple.com/app/id6444514353) · [App Store 리뷰](https://apps.apple.com/us/app/violin-tuner-liketones/id6444514353?see-all=reviews&platform=iphone) · [Google Play](https://play.google.com/store/apps/details?id=com.sonkins.tviolin&hl=en_US)
- [ViolinTuner (KME)](https://chrome-stats.com/d/com.kme.violintuner) · [ViolinTuner Reviews](https://justuseapp.com/en/app/1335576034/violintuner-tuner-for-violin/reviews)
- [Simply Tuner Reviews](https://justuseapp.com/en/app/1300058854/simply-tuner-violin-cello/reviews) · [App Store](https://apps.apple.com/us/app/simply-tuner-violin-cello/id1300058854)
- [Violin Tuner - Simple](https://apps.apple.com/us/app/violin-tuner-simple/id336430939) · [splitmetrics](https://splitmetrics.com/apps/violin-tuner-simple/id336430939) · [Violin Tuner Basic](https://apps.apple.com/us/app/violin-tuner-basic/id1420917155)
- [Tuneo (Google Play)](https://play.google.com/store/apps/details?id=com.a4tune&hl=en)
- [n-Track Tuner Reviews](https://justuseapp.com/en/app/409786458/n-track-tuner/reviews) · [Cleartune](https://apps.apple.com/gb/app/cleartune/id286799607) · [Ukulele Tuner reviews](https://android-stats.com/d/hai.lior.ukaleletunerfree/reviews)
- [GuitarTuna Reviews](https://justuseapp.com/en/app/527588389/guitartuna-tune-play-guitar/reviews) · [App Store](https://apps.apple.com/us/app/527588389) · [marlvel.ai 분석](https://marlvel.ai/apps/com-ovelin-guitartuna) · [Simply Tune](https://splitmetrics.com/apps/guitar-tuner-simply-tune/id1573260863)
- [TonalEnergy 리뷰 (Colin Dorman)](https://colindorman.com/horn/app-review-tonalenergy/) · [Android](https://colindorman.com/recommends/tonalenergy-android/) · [iPhone Tuners Reviewed](https://www.violinstringreview.com/spotlight-reviews/iphone-tuners-reviewed) · [Goodreads 블로그](https://www.goodreads.com/author_blog_posts/17643505-tonalenergy-tuner-review-just-go-get-it-already) · [공식](https://tonalenergy.com)
- [Soundcorset](https://apps.apple.com/US/app/id918055824) · [appgoblin](https://appgoblin.info/apps/918055824) · [unitq](https://www.unitq.com/unitq-scorecards/soundcorset/)
- [violinist.com](https://www.violinist.com/discussion/archive/26986) · [r/violinist](https://lr.in.psf.lt/r/violinist/comments/1e65lbw/which_is_the_best_violin_tuning_app) · [Fiddlerman](https://fiddlerman.com/forum/the-violin/tuner-app) · [Joshua Gordon](https://joshua-gordon.squarespace.com/blog/tag/apps)
- [Drone Tone (Violinspiration)](https://violinspiration.com/drone-tone/) · [Drone Tuner](https://apple.co/2pe4NBe) · [Chiff and Fipple](https://www.chiffandfipple.com/t/nice-drones-for-practice-and-tuning/104396) · [Orchestra Central](https://orchestracentral.com/?p=1565)
- [brunch 후기](https://brunch.co.kr/@flowappic/1008) · [Simply Tuner 한국 앱스토어](https://apps.apple.com/kr/app/simply-tuner-%EB%B0%94%EC%9D%B4%EC%98%AC%EB%A6%B0-%EC%B2%BC%EB%A1%9C-%EB%B9%84%EC%98%AC%EB%9D%BC/id1300058854)
