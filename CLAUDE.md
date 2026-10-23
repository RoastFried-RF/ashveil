# ASHVEIL 작업 규칙

- 기획 우선순위: `docs/CANON.md` > `docs/design/*` > `docs/GDD.md` > `docs/lore/*`. 구현 현황과 차이는 `docs/prototype.md`.
- `src/core`는 엔진 독립 규칙 엔진이다. DOM·Vue·Pixi import 금지. `Math.random`, `Math.sin/cos/exp/log/pow/atan2`, `Date.now` 금지(ESLint로 강제). 난수는 `rng(w, stream)`만.
- 콘텐츠는 하드코딩하지 말고 `src/content/core/defs/*.json`에 Def로 추가한다. 다른 Def를 바꿀 땐 패치(`patches/`)를 쓴다.
- RimWorld·Stoneshard의 고유명사·용어를 코드·문서·콘텐츠에 쓰지 않는다.
- 변경 후 확인: `pnpm lint && pnpm test && npx vue-tsc --noEmit`. 밸런스를 바꿨으면 `pnpm sim 30 3` 결과를 `docs/sim-latest.txt`에 갱신.
- UI 텍스트·로그는 한국어. 조사는 `이(가)/을(를)/은(는)/과(와)` 병기로 쓰면 `log()`가 자동 교정한다.

- 게임 기능·UI·아트 수정은 프로젝트 [게임 개발 스킬](.agents/skills/ashveil-game-development/SKILL.md)의 실제 입력→화면/상태 관찰 절차를 적용한다. 빠른 검사는 `pnpm game:check`를 쓰고, 기존 코어·저장·전체 회귀 검증을 함께 유지한다.
- 캐릭터·보행·무기·자세 동작 제작은 [캐릭터 동작 스킬](.agents/skills/ashveil-character-motion/SKILL.md)의 거리/시간·발 접지·손잡이·공격 계열·원화 의미 검토 절차를 함께 적용한다.
