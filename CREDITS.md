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

- ASHVEIL 물 용기2종·비정제5종 원본: 직접 제작. [물용기](docs/art-water-vessels-original.md) · [비정제](docs/art-nonpill-icons-original.md).

- ASHVEIL 원본 침엽수·마른 나무: 직접 제작한80×96 PNG/SVG. [출처·재현](docs/art-forest-original.md).

- ASHVEIL 원본 목제 보관함: 직접 제작한 닫힘·열림16px와 별도 소지품32px. [출처·재현](docs/art-storage-chest-original.md).

- ASHVEIL 원본 종자 봉지·그늘뿌리·흰갓: 직접 제작한32px PNG/SVG. [출처·재현](docs/art-crop-icons-original.md).

- ASHVEIL 원본 녹슨 칼·기본 손도끼·철근 창: 직접 제작한32px PNG/SVG. [출처·재현](docs/art-basic-weapons-original.md).

- 모드 원본 텍스처 예제의 소금 봉지16×16 PNG/SVG: 프로젝트 신규좌표 제작, CC0-1.0. 상업/수정/재배포/2차패키지 허용. `mods/sample-original-textures/LICENSE.txt`, `tools/art/mod-texture/README.md`.

- 사냥 활·여분 활시위32PNG/SVG·16px폼: 프로젝트 신규좌표원본 CC0-1.0, 상업/수정/재배포/2차패키지 허용. tools/art/bow-LICENSE.txt 및 docs/art-bow-original.md.

- 플레이어 전용 잿빛 여행자28포즈: 직접 작성한 새 픽셀 좌표, CC0-1.0. [원본/재현](docs/art-player-wanderer-original.md) · tools/art/player-LICENSE.txt.

- 철판 마체테·열매 없는 잿딸기 가시관목: 새 픽셀 좌표 원본, CC0-1.0. [원본/재현](docs/art-brush-originals.md) · tools/art/brush-LICENSE.txt.

- 정착지 식량 꾸러미3상태 원본(CC0-1.0): 직접 제작32px PNG/SVG·16px·재현 코드. `tools/art/pantry-LICENSE.txt`, `docs/art-pantry-originals.md` 참조.

- 달걀/깨진달걀 원본(CC0-1.0): 직접제작32px PNG/SVG·16px·재현도구. `tools/art/egg-LICENSE.txt`, `docs/art-egg-originals.md` 참조.

### 직접 제작 귀리·씨앗 원본

귀리 알곡과 씨앗 주머니2종의 정수 좌표 원본을 직접 제작했다. CC0-1.0 [라이선스](tools/art/oat-LICENSE.txt) · [제작·재현·검토 자료](docs/art-oat-originals.md). 32px PNG/SVG와16px검토본을함께보관하며기존외부저작자표기는유지한다.

귀리밭 원본1종도 직접 새 정수 도형으로 제작했다. CC0-1.0 [별도라이선스](tools/art/oat-plot-LICENSE.txt) · [제작·재현 자료](docs/art-oat-plot-original.md). 기존 그늘 작물·버섯·외부 제작자 표기는 유지한다.

- 원본 도기 그릇·덜 익은 귀리죽·익은 귀리죽3종: ASHVEIL 자체 제작, CC0-1.0. 같은 새 그릇 도형/새 내용물 좌표, PNG/SVG·16px·제작기·출처·재현 기록은 `docs/art-oatmeal-originals.md`, 별도 라이선스는 `tools/art/oatmeal-LICENSE.txt`. 그림은 현재 열·오염·안전을 보증하지 않는다.

- 원본 목재·고철·실 꾸러미·무두질 가죽·숯5종: ASHVEIL 자체 새 정수좌표 제작, CC0-1.0. `docs/art-material-originals.md`, `tools/art/material-LICENSE.txt` 참조. 기존외부저작자·공유그림을보존하며수량/장착/열/살균을그림으로보증하지않는다.

- 원본 천조각·붕대·횃불·미점화모닥불꾸러미·돌조각5종: ASHVEIL 자체 새 정수좌표 제작, CC0-1.0. `docs/art-survival-originals.md`, `tools/art/survival-LICENSE.txt` 참조. 횃불 그림은 현재점화/연료를뜻하지않으며별도상태표시를사용한다.

- v0.302 전체 리소스 조사 후 지형·벽·소품·생활 물체·아이콘·동물·적·UI를 새 정수 픽셀 좌표로 직접 제작했다. 편집 가능한 SVG/팔레트/생성기와 재현 검증을 함께 제공한다. [통합 내역](docs/art-complete-v302.md) · [CC0-1.0](tools/art/complete-LICENSE.txt). 기존 자체 캐릭터와 아이콘 원본은 유지하며, 사용 경로에서 빠진 외부 PNG도 역사적 파일과 원저작자 표기를 보존한다.

- v0.303 미술 재설계: 공식 참고작의 구도·가독성·재질 원리를 분석한 뒤 전체 1,266 프레임과 UI 26개를 새로운 정수 좌표로 제작. [방향과 출처](docs/art-direction-v303.md) · [원본 도구](tools/art/direction-v303/) · [CC0](tools/art/direction-v303/LICENSE.txt). 별도 타이틀과 초상은 OpenAI 이미지 생성 도구로 제작했으며 픽셀 원본과 구분해 [출처](tools/art/direction-v303/illustrations.json)를 기록한다. 참고작 이미지는 게임에 포함하지 않는다.

## v0.307 수목 변주 원본

고사목4종은 OpenAI image generation으로 만든 새 원본이며 생성한 첫 배치를 같은 도구로 재배치했다. 다른 게임의 픽셀은 입력/추적/복사하지 않았다. 생산 PNG는 픽셀 수정 없이 그대로 사용하고 atlas 영역/지면 앵커만 연결했다. [출처·해시](tools/art/direction-v307/provenance.json) · [CC0 고지](tools/art/direction-v307/LICENSE.txt). 다른 나무·인물·지형과 기존 호환 프레임은 유지한다.

## v0.308 생목 원본

소나무/검은잎나무 네 원본은 새 SVG 경로·가지 좌표·솔잎/잎 무리를 구성하고 Inkscape로 생성했다. 다른 이미지의 입력이나 기존 PNG 픽셀 편집은 없다. [원본·재현](tools/art/direction-v308/README.md) · [출처](tools/art/direction-v308/provenance.json) · [CC0](tools/art/direction-v308/LICENSE.txt). 이미지 생성 도구의 두 실패 호출은 이 SVG 제작과 구분해 기록한다.

## v0.311 풀·풀흙·맨흙 원화

새로 그린9개64px 바닥 프레임과 편집 가능한 SVG/그리기 소스는 `tools/art/direction-v311/`에 있다. PNG는 `public/sprites/original/direction-v311/ground.png`. 기여 권리 범위에서 CC0-1.0으로 제공한다. [라이선스](tools/art/direction-v311/LICENSE.txt) · [출처와 해시](tools/art/direction-v311/provenance.json). 공식 Stoneshard 야영지와 Eslabong 전투 화면의 바닥/인물 대비를 참고했고 해당 게임의 그림·색상 샘플·픽셀은 포함하지 않았다. 기존 원화의 출처 기록은 보존한다.

### v0.313 작물 성장 단계 원화 (구현 중)

귀리·그늘뿌리·흰갓버섯·양배추·감자·순무의31프레임은 이 프로젝트에서 직접 작성한 SVG 경로다. [제작 원본](tools/art/direction-v313/draw-crops.mjs)·[CC0](tools/art/direction-v313/LICENSE.txt)·[출처/검토 상태](tools/art/direction-v313/provenance.json). 참고작의 이미지·팔레트·문양을 복제하지 않았다. 게임 장면 검토는 구현 묶음 뒤 진행한다.

### v0.315 밭 잔재 원화 (구현 중)

직접 작성한64px SVG1프레임을 정리한 밭의 잔재에 연결했다. [제작 원본](tools/art/direction-v315/soil-residue.svg) · [CC0](tools/art/direction-v315/LICENSE.txt) · [검토 상태](tools/art/direction-v315/provenance.json). 외부 이미지·추적·팔레트 샘플을 쓰지 않았다.

### v0.316 상세 인물 원화

직접 작성한19종/38SVG·PNG/912프레임을 인간형 캐릭터에 연결했다. [제작 코드](tools/art/direction-v316/draw-people.mjs) · [출처와 디자인](tools/art/direction-v316/provenance.json) · [CC0](tools/art/direction-v316/LICENSE.txt). 외부 이미지 픽셀·트레이싱 없이 SVG를 작성하고 Inkscape로 렌더링했다. 이전 원본과 별도 회화 초상화의 출처는 보존한다.

### v0.319 위키 분류 조사와 자체 원화

사람19종·비인간형7종·무기/탄약30종·픽셀 초상19종을 직접 작성한 SVG/PNG로 연결했다. [제작 원본과 CC0](tools/art/direction-v319/) · [조사·전체 매핑/정확한 검토 범위](docs/wiki-resource-study-v319.md) · [공개 도감](https://roastfried-rf.github.io/ashveil/artbook/). Stoneshard Wiki는 실루엣·재질·역할·아이콘 비율의 참고 자료다. 해당 게임의 픽셀·트레이싱은 포함하지 않는다. 위키 메타데이터는 [별도 권리 고지](tools/research/stoneshard-v319/NOTICE.md)를 따르며 ASHVEIL 원화 CC0로 재허가하지 않는다.

### v0.320 옷·장신구·생활 도구

직접 작성한50종 SVG/PNG는 [제작 원본과 CC0](tools/art/direction-v320/)로 제공한다. [조사·실제 매핑·검토와 제한](docs/equipment-art-v320.md).319의 분류/실루엣/재질 참고를 이어서 ASHVEIL 자체 좌표로 그렸으며 외부 이미지 입력이나 트레이싱이 없다.

### v0.321 인물·타일 생성 원본

몸체13모델/624포즈·초상8종·재질4시트의31PNG는 OpenAI 이미지 생성 도구로 제작했다. 손으로 작성한 이전 SVG 원본과 구분한다. 생성된 PNG를 바꾸지 않고 알파/영역·발 기준·배율 메타데이터를 연결했다. 참고 게임의 픽셀은 생성 입력·트레이싱·설치에 쓰지 않았다. 자체 생성 모델만 후속 이미지 입력으로 사용했다. [출처·해시·등록 절차](tools/art/direction-v321/README.md) · [CC0 고지](tools/art/direction-v321/LICENSE.txt) · [조사·검토·정확한 범위](docs/art-quality-v321.md). 이전 원본과 저작자 표기는 보존한다.


### v0.322 동작 원본과 연결

자체 v321모델을 입력으로 OpenAI 이미지 생성 도구에서 만든99PNG의 원본 바이트를 보존했다. 알파/영역/몸의 기준점과 배율·방향 반전 메타데이터를 등록한다. 일부 옆모습은 검토한 반대쪽 포즈를 공유하며 손으로 모든 픽셀을 그렸다는 주장은 하지 않는다. 다른 게임의 그림은 생성 입력·트레이싱·설치에 쓰지 않았다. [제작·시도별 프롬프트·해시·재등록](tools/art/direction-v322/README.md) · [CC0 고지](tools/art/direction-v322/LICENSE.txt) · [구현·실제 검토 범위](docs/animation-v322.md).


### v0.323 동작 연출과 제작 도구

기존 자체 원화의 PNG 바이트를 유지하고 보행 시간·무기 손잡이/방향·공격 계열의 연출 메타데이터와 코드를 추가했다. 새로운 그림이나 생성 프레임 수의 증가로 계산하지 않는다. [구현·검토](docs/motion-v323.md) · [제작 스킬](.agents/skills/ashveil-character-motion/SKILL.md). 이전 원본·도구·저작자 표기는 유지한다.


### v338 재까마귀

까마귀 지상/작업/비행11PNG·144몸 영역과 깃털 아이콘은 image_gen으로 제작한 자체 원본이다. 타 게임 픽셀을 사용하지 않았다. 생성 원본 바이트·정확한 요청/자체 입력·SHA와 선택 범위는 [통합 기록](tools/art/direction-v338/README.md)에 보존한다. 작은 고기는 기존 자체 음식 그림을 공유한다.


### v340 측량기와 고글

측량기의 독립96몸 영역과 회수품4아이콘·별도 고글1아이콘은 image_gen 자체 원본10PNG에서 선택했다. 짧은 섬광은 기존 보고 자세를 공유하며 새16원화로 세지 않는다. [원본·정확한 요청/입력/해시와 검토 범위](tools/art/direction-v340/README.md).


### v348 잿곰과 가공 기록

image_gen 자체 원문15PNG에서 잿곰의9동작 가족/144고유 몸 영역과 회수품·가공 기록5아이콘을 선택했다. 앞발 기본 공격 별칭과 생가죽/무두질 가죽의 공유 아이콘을 새 원화로 더하지 않는다. 고밀도 보행 실패·이웃 그림이 섞인 후보와 별도 보완 원문도 보존하며, 반전/복제/리샘플링으로 채우지 않았다. [설치된 원문 SHA/영역](tools/art/direction-v348/installation.json) · [실제 파일 검증기](tools/art/direction-v348/verify-installed.py) · [구현·제약](docs/bear-v348.md).

## v356 파종기 정면 관절 시제품

자체 v335 원화만 일관성 입력으로 사용해 image_gen으로 새로 그린 v354 PNG1장을 원본 바이트로 보존했다. 차체·upper·lower·foot의4고유 영역을 런타임에서 조합하며 authored 보행 프레임은0개다. 원문 SHA `01c034f0dc67699cabc91b55798013446ddbb4fb281fbbdbcb452faa4153dff2`, 정확 요청/참고/실패와 핀 관측은 `tools/art/direction-v356/front-original/`에 보존한다. `layout-analysis/`는 관측과 부모의 물리 가정을 구분한다. 파츠의 상대 배율/고정17.5+17.5 링크/지지 제어는 후속 시제품 결정이며 원화가 증명한 실제3D 해부가 아니다. 원문 편집·새 raster 추출은 하지 않았다. 공개 시제품은 정면만이며 기본 게임의 완성된 파종기나 출시 승인이 아니다.


## v364 파종기 게임 적용

자체 image_gen 원문16PNG의115고유 영역을 선택했다. 관절/작업8PNG·30영역을 런타임 조합하며 authored 보행 프레임0이다. 좌/우 회복 준비 공유·잘린 후보·잘못된 왼쪽 쓰러짐·v363 실패0PNG와 v365 수동 재요청1PNG를 구분해 보존한다. [원문 SHA/선택](tools/art/direction-v364/installation.json) · [전체 몸 상태](tools/art/direction-v364/state-installation.json) · [적용·제약](docs/sower-v364.md). 원문 픽셀 수정/리샘플링이나 타 게임 픽셀 복제를 하지 않았다.


## v370 재나방과 가루/음식

image_gen 자체 원본2PNG/6영역(개별 나방4비행 포즈·수확물2아이콘)을 등록했다. 원문 픽셀 편집/리샘플/알파 제거를 하지 않았다. 한 등 시점의 runtime 회전·대표 나방 수와실제마릿수를구분한다. 이전v369군체원화는보류로보존한다. [비행 원문/한계](tools/art/direction-v370/installation.json) · [수확물](tools/art/direction-v371/installation.json) · [실제 적용](docs/swarm-v370.md). 쪽지는기존일반수첩그림,날것표본은접힌비행원문을명시공유한다.

### v374 후속 원문 보존 · 미등록 후보

`tools/art/direction-v374/history`는 자체 image_gen으로 제작한 관로 지네 v372·구제기 v373 각1PNG/6분리 부품과 원래 입력/알파·관절 한계를 보존한다. 총2PNG/12후보 영역이며 각1회 생성·재생성0이다. 기존 자체 원화만 일관성 참고로 사용했다. 함께 보존한 v374 Canvas 시제품은 지네 원문1PNG/6영역을41표시 인스턴스에 공유한다. 런타임 회전/반전·2D 경로/관절 계산이며 신규 픽셀·고유 보행 프레임이 아니다. 현 시점 메인 등록·게임 활성·출시 승인은 없다. 이전 실패 후보·저알파 잔점·보이지 않는 관절축/면의 한계를 보존했다.

### v375–376 실제 지네 원문과 수확물

자체 v372 지네1PNG(원본 d79e5840…/6부품)를 원형 재사용 등록하고, image_gen으로 새 수확물1PNG(32be48c2…/6영역)를 제작·등록했다. 새 생성1회/재생성0이며 두 활성 원문/12고유 영역이다. 같은6부품의41표시 인스턴스와 한 등 시점의 회전/반전은 새 보행 원화가 아니다. 원문 바이트/정확 입력·이력·알파 잔점/크롭·추정 소켓·독샘 형태의 모호함은 tools/art/direction-v375 및 direction-v376에 보존한다. 흉갑은 아이콘이며 사람 착용 원화를 추가했다고 세지 않는다. 정비 일지는 기존 수첩 원문 공유다.


### v379–380 구제기와 회수 장비

자체 image_gen 정면 v3731PNG/6부품과 독립 좌/우/뒤 v3783PNG/18부품을 byte 그대로 재사용 등록한다.4원문/24고유 영역이23표시 인스턴스에 공유되고 authored 전체 보행 프레임은0이다. v377의2D 접지/도구 시제품·실패·방향별 관측 핀/숨은 축 null·BACK 역면/발 앞뒤 미확정은 tools/art/direction-v379/history에 보존했다. 별도 신규 v380 수확물1PNG/6아이콘(1호출/재생성0)을 등록했으며 alpha16 본체 손실0과 크롭 밖 저알파 fringe586픽셀을 원문에 그대로 보존한다. 정비종은 기존 금속 그릇, 사양서는 기존 일반 수첩 그림을 명시적으로 공유한다. 낫창의 하나의 보이는 wrap과 두 손 지원 추정은 독립적으로 그린 양손 소켓 두 개가 아니다. 원화 픽셀 편집·리샘플/알파 제거·타 게임 픽셀 복제를 하지 않았다.


### v384 의수족 원화 아이콘

자체 image_gen 원문2PNG에서 선택한6물체(목제/관절 의족, 갈고리 손, 장식 유리 의안, 옛 기계/흰 가지 의수)를 실제 인벤토리에 연결한다. 첫6물체 가운데2개 크롭 이웃 오염 실패를 보존하고 검토 뒤 가로2물체 보정1회를 사용했다. 총2호출/2PNG·자동재생성0·각1시점·본체 장착 수락false. 픽셀/알파 편집·타게임 원화 복제0. 정확 입력/원문 SHA/실패/적용은 `tools/art/direction-v384`에 보존한다.


### v386–387 침구·의료 가방 원화

자체 image_gen1호출/1PNG에서 풀·가지 깔개/침낭/짚침상/침대/좋은침대/닫힌의료가방6고유 물체를 선택해6실제Item과5지도침구에 공유했다. 자동재생성/픽셀편집/알파제거/재인코딩0. 원문SHA 2bca0f1dcef8b529d5987b9cf4c92334e548425bcf03858aa058570f3573d325, 실제1536×1024. 정확입력/원문/실패조건/크롭/α1fringe/작은화면·정규화손잡이접점은 tools/art/direction-v386에 보존한다. 새 누운몸/점유격자/품질/재고·3D관절 원화로 세지 않는다.

### v389 몸·착용·역할 머리 원본

OpenAI image_gen 새4PNG(의복80영역+역할머리20영역), 기존 자체 인체/봉제패널2PNG와 의수족 단일 원문을 재사용한다. 참고 입력은 자체 원문만 사용했다. 부위별 mask/affine 조립이며 원본 픽셀 재작성·100개 전신/동작 원화 제작이 아니다. [제작·요청·거절·SHA·한계](docs/human-paperdoll-v389.md), `tools/art/direction-v389/history/`에 원문 기록을 보존했다.

## v392 인체·변형 인간

OpenAI image_gen으로 자체 원문을 제작했으며 PNG 바이트를 보존했다. 활성7PNG·등록 고유114영역(캐릭터 선택110영역)이며 기존25의복·6의수족/방향별 공유와 별개다. 생성8원문의 실패/대체·프로필 정규화·프롬프트·SHA는 [세부 원화](tools/art/direction-v392/source-audit.json)와 [전용 몸](tools/art/direction-v392/mutants/source-audit.json)에 기록한다. 다른 게임의 픽셀을 복사하거나 트레이싱하지 않았다.

### v394 방향별 의수족

자체 개념 원화를 참고하여 OpenAI 이미지 생성으로 제작한 원본5PNG를 바이트 그대로 사용한다.6종의 네 방향/관절52고유 원문 영역 중 현재 몸의 조건부 선택은51영역이며, 뒤통수에서 가려지는 유리 눈 뒤쪽은 등록만 유지한다. 생성5회/원본5장을 보존한다. 혼합 시트의 불일치 갈고리4칸은 등록하지 않고 별도4방향 원문으로 교체했다. 새 완전 동작 프레임은0개다. [정확한 프롬프트·원본 SHA·부분 수락/대체 기록](tools/art/direction-v394/source-audit.json) · [실제 소유/검증](docs/prosthetic-views-v394.md).
