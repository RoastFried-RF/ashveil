# 크레딧

라이선스는 각 itch.io 페이지에서 2026-10-13 KST에 확인했다. 원본 팩(zip)은 저장소에 넣지 않는다. 게임에 쓰는 부분만 `tools/art/build-sprites.py`로 잘라 낸 시트(`public/sprites/`)만 포함한다.

> 주의: 이 저장소는 비공개(2026-10-13 기준)다. 공개로 돌리면 잘라 낸 시트도 "팩 재배포"로 읽힐 수 있으므로, 그때는 `public/sprites/`를 저장소에서 빼고 빌드 단계에서 원본 팩으로부터 생성한다.

## 그래픽

| 팩 | 제작자 | 라이선스 요지 | 쓰는 곳 |
|---|---|---|---|
| [Knowledge Temple](https://pingupollas.itch.io/knowledge-temple) | [pingupollas](https://pingupollas.itch.io/) | 상업 이용 가능, **이름 + itch.io 링크 표기 의무**(원본·수정본 모두), 리소스 팩 형태 재배포·판매 금지, 수정 허용 | 석판 바닥, 벽·서가, 이끼, 석상·석관·항아리·사슬, 화로 애니메이션 (분위기 기준) |
| [Crawling Depths](https://pingupollas.itch.io/crawling-depths) | [pingupollas](https://pingupollas.itch.io/) | 위와 같음 (**표기 의무**, 팩 재배포 금지) | 오염된 방 바닥, 맥동하는 혈관·눈 소품, 융합체(보스) |
| [Damp Dungeons](https://arex-v.itch.io/damp-dungeons) | arex-v | 상업 이용·수정 허용, 재판매 금지 (표기 의무 명시 없음 — 감사 표기) | 캐릭터(약탈자 팔레트 교체·그늘 사람·말라붙은 자·포자 인간; 주인공은 아래 새 원본으로 교체), 상자·궤짝·횃불·문 |
| [Dark World](https://kaishido.itch.io/dark-world) | kaishido | CC0 1.0 | 마른 나무, 바위, 버섯 무리 |
| [16×16 Dark Dungeon](https://kosinaz.itch.io/16x16-dark-dungeon-tileset) | kosinaz | CC0 1.0 | 현재 빌드에서는 미사용 (받아 두었으나 KT 톤과 겹쳐 보류, 후속 후보) |
| [Dungeon Tileset II](https://0x72.itch.io/dungeontileset-ii) | 0x72 | CC0 1.0 (코드 MIT) | 계단·사다리·해골 바닥 장식 |
| [Dark Ages UI](https://hypnobius.itch.io/dark-ages-ui) | hypnobius | 상업 이용 가능, 표기는 선택, 원본·수정본 팩 재배포·판매 금지, NFT·AI 학습 금지 | 창 테두리·슬롯·버튼·막대 (글자·수치는 Vue에서 한국어로 그림) |
| [Dungeon Crawl Stone Soup 32×32](https://opengameart.org/content/dungeon-crawl-32x32-tiles) | DCSS 기여자 | CC0 | 아이템·능력 아이콘, 지상 풀·흙·피 자국 |

- DCSS 지형 타일 가공: 채도·밝기 조정(`tools/art/ashen.py`), 재/도로 레벨 조정(`tools/art/ash_levels.py`).
- 약탈자 색 교체·말라붙은 자 탈색 등 팔레트 가공: `tools/art/build-sprites.py`.
- 표기 의무가 있는 Knowledge Temple·Crawling Depths는 타이틀 화면 하단에도 이름과 링크를 표시한다. 스팀 출시 때는 크레딧 화면과 스토어 설명에 같은 문구를 넣는다.

## 글꼴

- [Gowun Batang](https://fonts.google.com/specimen/Gowun+Batang) — SIL Open Font License 1.1 (Google Fonts)

## 영감

- 두 상업 게임(하드코어 턴제 던전 RPG, 콜로니 시뮬레이션)의 시스템 구조만 참고했다. 고유명사·설정·에셋은 쓰지 않는다.

- 수리 드론의 32×32 가동/정지 타일: [Crawl RLTiles clockwork_bee / clockwork_bee_inert](https://github.com/crawl/crawl/tree/master/crawl-ref/source/rltiles/mon/nonliving), 원본 그대로 사용. [원본 public domain 고지](https://github.com/crawl/crawl/blob/master/crawl-ref/source/rltiles/license.txt)는 `public/sprites/LICENSE-RLTiles.txt`에 보존했다. 가동 PNG SHA-256 `b3c9cc8321f1ec4e8ba31ee1bed869a8074565900c62051732b7523fb241b644`, 정지 PNG `0b5ea94ae971a31d835e60f100b98875119bb6bb816ece1812e6325c1022ccef`.

- 치즈와 잿딸기의32×32 아이콘은 위와 같은 Crawl RLTiles 원본을 수정 없이 사용한다. 고정 원본 커밋·파일별 URL/SHA-256과 재현 방법은 [food-sources.json](tools/art/food-sources.json)과 [fetch-food-icons.py](tools/art/fetch-food-icons.py)에 보관했다. 나머지 임시 음식 그림은 별도 제작 범위다.

나무 물 양동이 아이콘 public/tiles/water_bucket.png는2026-10-18에 OpenAI image_gen으로 생성한 새 원본이다. 원본 픽셀/투명도를 수정하지 않았다. 파일 해시/생성 명세는 tools/art/water-bucket-source.json을 따른다.

## 프로젝트 원본 아트 (2026-10-20)

- 타이틀: `public/art/ashveil-title.png`. ASHVEIL의 수도원·침묵한 기계 문명에 맞춰 OpenAI image_gen으로 새로 제작했다. 정확한 생성 명세와 파일 해시는 [제작 기록](docs/art-title-original.md)에 보관한다.
- 떠돌이 초상: `public/art/ashveil-wanderer-portrait.png`. 새 원본 초상을 타이틀 생성 미리보기와 플레이 HUD에 사용한다. 제작·해시 기록은 [캐릭터 아트 문서](docs/art-wanderer-original.md)에 보관한다.
- 주인공 동작: `public/sprites/original/`의 새 픽셀 시트. 초상과 같은 후드·스카프·구리 장식을 바탕으로 직접 그린4방향 걷기/공격 프레임이며 재생성 소스는 `tools/art/draw-wanderer.mjs`다. 기존 타사 캐릭터를 자르거나 색만 바꾼 시트가 아니다.

- 보관·탄약 아이콘4종: `public/sprites/original/items/ashveil-{sack,quiver,leather-belt,arrow-bundle}.png`. 직접 설계한32×32 픽셀 원본이며 편집SVG·결정적 재생성 도구·실제 크기 검토·SHA-256은 [원본 제작 기록](docs/art-storage-items-original.md)에 보관한다.

## 개발 하네스 참고 코드

OpenAI `develop-web-game`의 과거 공식 클라이언트/예제/문서를 고정 커밋으로 보관했다. 원본 Apache 2.0 라이선스와 SHA-256·프로젝트 호환 변경은 [출처 기록](tools/vendor/openai-web-game/PROVENANCE.md)에 있다. 현재 공식 카탈로그의 지원 스킬로 표시하지 않으며, 프로젝트 하네스는 기존 Playwright Core를 사용한다.

## ASHVEIL 원본 화기 아이콘

부싯돌 장총·납탄·흑색화약1회분·총기 기름은 이 프로젝트를 위해 직접 픽셀 도형으로 제작했다. 원본 SVG/PNG·팔레트·재현 도구·해시는 [제작 기록](docs/art-firearm-items-original.md)에 기록한다. 기존 외부 팩의 변형이 아니다.

## ASHVEIL 원본 산업 화기 아이콘

회전식 권총·볼트식 소총·공장/재생 실탄·빈 탄피·뇌관6종을 직접 픽셀 도형으로 제작했다. 원본 SVG/PNG·팔레트·재현 도구·SHA는 [제작 기록](docs/art-industrial-items-original.md)에 기록한다.

## ASHVEIL 원본 투창 아이콘

깃 없는 목재 자루·낡은 금속 끝·섬유 묶음을 새 픽셀 도형으로 직접 제작했다. 원본 PNG/SVG·재현 도구·해시는 [제작 기록](docs/art-javelin-original.md)에 있다.

### 원본 대도 아이콘

넓은 낡은 금속 날·긴 가죽 손잡이·작은 황동 가드를 새 픽셀 좌표로 직접 제작했다. PNG/SVG·재현 도구·해시는 [제작 기록](docs/art-greatsword-original.md)에 있다.

### 원본 기본 전투 행동 아이콘

넘어뜨리는 다리와 손에서 벗어나는 칼을 새 픽셀 좌표로 직접 그렸다. PNG/SVG·재현 도구·해시는 [제작 기록](docs/art-maneuvers-original.md)에 있다.

### 원본 잿빛 약탈자 캐릭터

짧은 철모·가죽 조끼·해진 밧줄 허리띠를 가진 약탈자의4방향28포즈를 새 픽셀 좌표로 직접 그렸다. PNG/SVG·재현 도구·프레임 계약·해시는 [제작 기록](docs/art-reaver-original.md)에 있다.

### 원본 웅크림 아이콘

낮춘 상체·굽힌 무릎·두 부츠를 새 픽셀 도형으로 직접 그렸다. PNG/SVG·재현 도구·해시는 [제작 기록](docs/art-crouch-original.md)에 있다.

- 두 번째 약탈자의 얼굴 천·비대칭 어깨천·28개 동작은 ASHVEIL 원본 픽셀 좌표로 직접 제작했다. [원본·재현·출처](docs/art-reaver1-original.md), `tools/art/draw-reaver1.mjs`. 외부 이미지 픽셀을 읽거나 재색칠하지 않는다.

- 그늘 사람 첫 외형은 직접 작성한 픽셀 좌표/누더기/작은 인간형 원본이다. 기존12보행과 새16공격을 구분해 연결했다. [출처/재현](docs/art-shade0-original.md), `tools/art/draw-shade0.mjs`.

- 그늘 사람 두 번째 외형도 직접 작성한 픽셀 원본이며 얼굴 천·비대칭 청록 수선으로 구분했다. [원본·재현·출처](docs/art-shade1-original.md), `tools/art/draw-shade1.py`.

- 낡은 문 닫힘16×32/열림16×16은 자체 정수 좌표와 팔레트로 그렸다. [원본·출처](docs/art-rusted-door-original.md), `tools/art/rusted-door/draw-rusted-door.py`.

- 그늘 사람 나머지 두 외형도 자체 픽셀 좌표로 작성했다. [shade2 원본/출처](docs/art-shade2-original.md) · [shade3 원본/출처](docs/art-shade3-original.md). 공용 외부 시트의 픽셀을 추출·재색칠하지 않는다.

- 정밀 잠금 도구의 갈고리/장력쇠는 자체 좌표로 그렸다. [원본/출처/재현](docs/art-lockpick-original.md), `tools/art/lockpick/draw-lockpick.py`.

- 말라붙은 자/사제/포자 인간 첫 외형은 자체 정수 픽셀 좌표로 직접 제작했다. 살아 있는 환자·순례자 설정에 맞춘 얼굴/옷과28포즈 원본이며 외부 시트 픽셀을 읽거나 재색칠하지 않는다. [환자](docs/art-withered-original.md) · [사제](docs/art-withered-priest-original.md) · [포자 인간](docs/art-spore0-original.md).

- 포자 인간 두 번째 외형도 자체좌표로 제작한28포즈 원본이다. 회백색 긴 옷·자주색 두건·층진 피막으로 구분했다. [출처/재현](docs/art-spore1-original.md).

- 융합체의 살아 있는 환자 실루엣/기존6+방향형28포즈와 수리 드론의6족/냉각판/공구·활성/정지32포즈는 자체 픽셀 좌표로 직접 그렸다. [융합체 원본·출처](docs/art-amalgam-original.md) · [드론 원본·출처](docs/art-drone-original.md).

- 그늘 우두머리의 작은 인간 외형·옷깃·꿰맨 앞자락과28포즈는 자체 픽셀 좌표로 직접 그렸다. [출처/재현](docs/art-shade-chief-original.md).

- 주민 전용28포즈와 실제 알약6종은 자체 픽셀 좌표로 직접 제작했다. 플레이어hero와 별도 자산이며 약물효과 문양을 넣지 않았다. [주민원본](docs/art-resident-original.md) · [알약원문](tools/art/pills/SOURCE.md).

- 의원/간병인의 묶은 머리·생활복·앞치마와28포즈는 새 정수 픽셀 좌표로 직접 그렸다. [원본/출처/재현](docs/art-healer-original.md).

- 주민 경비의 넓은 어깨·짧은 천 외투/묶은 소매와28포즈는 직접 작성한 픽셀 좌표다. [원본/출처](docs/art-guard-original.md).

- ASHVEIL 원본 상인 28자세: 프로젝트를 위해 직접 제작. [출처와 재현](docs/art-trader-original.md).

- ASHVEIL 수도원 석판 원본: 직접 작성한4매크로·256샘플. [출처와 재현](docs/art-monastery-floor-original.md).
