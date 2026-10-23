# v323 동작 등록 자료

새 raster 원본은 없다. v321/v322 자체 원화와 v319/v320 물품을 유지한다. 원본의 라이선스/생성 입력/시도/해시는 각 원래 디렉터리에 보존한다.

- `apply-rigs.py`:13모델/28캐릭터의 걷기·웅크린 이동 주기를 재등록한다. PNG·Core·TU를 바꾸지 않는다.
- `motion-baseline.json`: 게시된 v322의 motion catalog `after`와 당시 durations를 보존한 비교 기준이다. 현재 원화/주기를 과거 자료인 것처럼 덮어쓰지 않는다.
- `held-item-audit.json`: 실제 해석된 장비/투척 정의를 조사한 원자료. 최신 규격·공격 모드는 `pnpm art:motion:audit` 결과로 확인한다.
- 실제 코드: `src/client/render/equipment-motion.ts`. 공개 미리보기 모듈은 `pnpm art:motion:export`로 이 파일에서 내보낸다.
- 절차: [제작 스킬](../../../.agents/skills/ashveil-character-motion/SKILL.md), [구현·정확한 한계](../../../docs/motion-v323.md).
