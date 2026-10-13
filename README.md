# ASHVEIL (애쉬베일)

> **규칙은 투명하게, 세계는 끝없이 낯설게.**
> Stoneshard처럼 한 번의 실수가 죽음으로 이어지는 하드코어 턴제 RPG를, RimWorld처럼 매번 다른 세계·사건·인물로 생성하고 모든 콘텐츠를 모드로 갈아끼울 수 있게 만드는 프로젝트. (두 게임의 *구조*만 참고한 독자 창작)

재의 장막에 덮인 변경 행성 **하스**. 테라포밍 기계망이 침묵한 지 70년, 문명은 칼과 활의 시대로 돌아갔다. 당신은 회색 고원 폐허를 떠도는 이름 없는 떠돌이다.

**현재 상태: 프로토타입 v0.1** — 폐허 외곽 맵 1장에서 생존·전투·부상·치료·스토리텔러가 돌아간다. 상세: [docs/prototype.md](docs/prototype.md)

## 무엇이 디테일한가 (일부)

- 상처는 하나하나가 개체다. 왼쪽 대퇴 동맥이 베이면 붕대로는 안 멎는다. 지혈대는 두 시간 넘기면 아래가 썩는다. 켜진 등불에 칼을 달궈 지지면 출혈은 멎지만 화상과 비명이 남는다.
- 손가락을 잃으면 조작 능력이 떨어지고, 손을 다치면 붕대 감는 데도 오래 걸린다.
- 젖은 옷은 단열의 70%를 잃는다. 방수포 망토 아래 옷은 젖지 않는다. 고철 사슬옷을 내피 없이 입으면 냉기가 스민다.
- 피 냄새는 바람을 타고 재늑대를 부른다. 배고픈 재늑대에게 생고기를 던지면 먹느라 멈춘다.
- 적도 같은 규칙으로 피 흘리고, 절뚝이고, 겁먹고 도망친다. 궁지에 몰린 약탈자는 무기를 버리고 항복한다.
- 알약의 색과 효과는 시드마다 섞인다. 먹어보거나, 의료 숙련으로 감별하거나.
- 죽으면 사망 보고서가 원인 사슬을 보여주고, 연대기에 남는다.

## 실행

```bash
pnpm install
pnpm dev            # 브라우저에서 플레이
pnpm test           # 단위·속성·결정론 테스트
pnpm sim 30 3       # 헤드리스 봇 밸런스 리포트
pnpm validate-defs  # 콘텐츠 Def 검증 (모드 id를 인자로)
```

조작: 방향키/hjklyubn/숫자패드 이동·공격, `.` 대기, `r` 휴식, `z` 수면, `g` 줍기, `s` 수색, `t` 등불, `f` 활, `L` 탈출, `?` 도움말.

## 구조

```
src/core/      순수 TypeScript 규칙 엔진 (DOM 의존 0, 결정론, 엔진 이전 가능)
src/content/   기본 게임 = core 모드 (JSON Def)
src/client/    Vue 3 + PixiJS + Tailwind v4 화면
mods/          샘플 모드 (sample.grim)
tools/         Def 검증 CLI, 헤드리스 시뮬, 타일 가공 스크립트
tests/         vitest + Playwright 스모크
docs/          기획: CANON → GDD → design/01~12 → lore/ → prototype
```

## 문서

- [docs/CANON.md](docs/CANON.md) — 확정 결정과 규칙 상수 (최우선)
- [docs/GDD.md](docs/GDD.md) — 마스터 기획서
- [docs/design/](docs/design/) — 시스템 상세 12종
- [docs/lore/](docs/lore/) — 세계관 바이블, 세력, 도감
- [docs/prototype.md](docs/prototype.md) — 구현 현황·검증·기획과의 차이

## 크레딧

타일: [Dungeon Crawl Stone Soup 32×32 tiles](https://opengameart.org/content/dungeon-crawl-32x32-tiles) (CC0). 자세한 내용은 [CREDITS.md](CREDITS.md).
