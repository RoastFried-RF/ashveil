# ASHVEIL 생활·생존 물품 원본 5종

2026-10-21. 격리 폴더 `/workspace/ashveil-survival-art`에서 새 픽셀 좌표로 만든 **26파일** 원본 인계 묶음이다. 제품·Def·공용 아틀라스·기존 타일·Git은 수정하지 않았다. 아래 키는 제안이며 실제 게임 등록·화면/행동 검증을 완료했다는 기록이 아니다.

## 실제 대상과 새 키

| 실제 ID | 이전 공유 키 | 제안 sheet/frame | 실제 가방 크기/최대 더미 |
| --- | --- | --- | --- |
| Item.Cloth | cloth | original_hearth_cloth | 1×1 /5 |
| Item.Bandage | bandage | original_hearth_bandage | 1×1 /5 |
| Item.Torch | lantern | original_hearth_torch | 1×3 /1 |
| Item.CampfireKit | stump | original_hearth_campfire_kit | 2×2 /1 |
| Item.Stone | rubble0 | original_hearth_stone | 1×1 /5 |

기준은 immutable v299-final의 실제 Def·관련 패치·렌더러다. Cloth는 헤진 임시 처치용 천, Bandage는 끓여 말린 붕대다. 그림의 명도/접힘은 물품 정체를 구분하며 실제 인스턴스의 청결·오염·치료 성공을 보장하지 않는다. Stone은 `Material.Flint`를 쓰는 휴대용 돌 조각이다. 새 재질·성능·수량·레시피는 만들지 않았다.

귀리 그릇3종 및 목재/고철/실/가죽/숯5종은 다른 담당 범위라 제작하지 않았다. 이 Kit 안의 나무/돌은 물품 구성 묘사이며 별도의 Item.Wood 원본이나 실제 스택 수량의 표현이 아니다.

## 직접 만든 도형과 재사용 범위

천은 비대칭으로 펼친 회록색 천과 실제로 잘려 나간 찢김, 붕대는 정돈된 둥근 말이 단면과 짧게 풀린 띠, 횃불은 나무 자루와 천을 감은 넓은 머리, 모닥불 꾸러미는 차가운 돌 둘레와 묶은 나무, 돌은 불규칙한 부싯돌 파단면을 새 정수 polygon/line/point 좌표와 정수 타원 치수로 작성했다. 모든 출력 픽셀은 정수 격자이며 알파는0/255뿐이다.

자체 이전 CC0 귀리 도구의 일반 `Canvas`·RGBA·PNG·SVG·16px 최근접 입출력 함수와 공통 낡은 재질 색 계열만 재사용했다. 이전 아이콘 도형/이미지 픽셀을 복사·잘라내기·재색칠·트레이싱하지 않았고 외부 그림이나 생성 모델 이미지를 입력하지 않았다. 5개 도형 함수는 이번에 새로 작성했다. 재사용 도구의 해시와 공개 범위는 source JSON/계약에 있다. 제작기와 검사기는 표준 Python만 쓰고 게임/외부 이미지를 import하지 않는다.

## 횃불의 실제 점화 계약

- `src/core/items.ts`의 makeItem은 광원 물품에 원래 연료량과 `lit=false`를 넣는다.
- `src/core/actions.ts`의 toggleLight는 연료를 확인하고 `it.lit`를 바꾸며 sprite를 바꾸지 않는다.
- 소지품·빠른 슬롯·발밑은 점화 상태와 관계없이 ItemDef.sprite를 읽는다. 점화/소화별 새 sprite 별칭 계약은 없다.
- InventoryWindow는 실제 `lit`일 때 별도의 황색점을 표시한다. itemLabel/툴팁도 켜짐과 실제 연료를 표시한다.
- 따라서 이번 원본은 **불꽃·불씨·연기·후광이 없는 물품 정체 그림 하나**다. 켜진 인스턴스에도 같은 그림을 쓰되 실제 상태 표시는 원래 UI에 맡긴다. 이 그림만 보고 꺼짐/켜짐이나 연료량을 판정할 수 없다.

모닥불 꾸러미도 불 안 붙은 부품의 정체를 그렸다. 기존 Recipe.CampfireKit의 돌3/목재1을 읽었지만 그려진 부품 개수는 정확한 레시피·소유량이 아니다. 설치 후 Terrain.Campfire의 Graphics/실제 연료·불 애니메이션을 교체하지 않는다.

## 크기와 읽힘

32×32 PNG/SVG5쌍, 중심 최근접 `(2x+1,2y+1)` 16×16 PNG5개를 제공한다. 20색 저채도 회록/재색/낡은 목재/상아 천 팔레트다. 투명 바깥 테두리와0/255알파를 유지한다.

| 원본 | 포함 불투명 경계 | 불투명 픽셀 | 16px 불투명 픽셀 |
| --- | --- | --- | --- |
| cloth | [3,4,27,29] |453|114|
| bandage | [3,6,27,29] |390|97|
| torch | [5,2,28,29] |257|61|
| campfire_kit | [2,5,29,29] |450|117|
| stone | [3,4,27,29] |474|118|

미술 밑변은30이고 선택 참고 발점은[16,30]이다. 조각에는 새 anchor/배율이 없으며 기존 ItemIcon 정렬 규칙을 바꾸지 않는다. 실제 가방 칸 크기는32px 프레임의 종횡비를 뜻하지 않는다.

`ashveil-survival-contact.png`는 **800×352**다. 왼쪽부터 천/붕대/횃불/꾸러미/돌이며 문자·숫자·효과 표지를 넣지 않았다. 각 열에32px4배, 어둡고 밝은 바탕의 실제32/16/12px, 16px4배를 담았다. 12px은 원본을 중심 최근접 축소한 검토 근사이며 실제 게임 캡처가 아니다.

게임은 인벤토리에서32 또는64px, 거래/제작에서24px, 발밑에서12px로 표시한다. 16px에서는 큰 실루엣이 서로 구분되지만 얇은 올/작은 끈과 Kit 부품 세부는 줄어든다. 12px 실제 월드와 수량/내구/선택/툴팁 겹침 검토는 Root 통합 뒤 별도다. 고정 지면 그림자는 아트에 넣지 않았다.

## 재현과 독립 파일 검사

`python3 tools/art/draw-survival-items.py --check`

19개 생성 산출물을 쓰지 않고 바이트 그대로 재현해 비교했다.

`python3 tools/art/check-survival-items.py`

제작기를 import하지 않는 별도 검사기가 PNG 구조·모든 CRC·단일 종료 IEND·zlib EOF·RGBA8·알파·투명 외곽·20색·불투명 경계·source18개 해시를 확인했다. SVG는 경계 내 정수 rect를 따로 해석해5쌍 **5,120픽셀 전체**와 비교했다. 16px5쌍과 contact 배경/12px견본까지 **281,600픽셀 전체**를 별도로 조합해 대조했다. 새 sheet/frame은 정확히5개다. 모두 통과했다.

제작 담당은 최종 원본32/16PNG10개와 contact1개를 **실제로 모두 열어** 확인했다. 자세한 관찰과 한계는 `docs/art-survival-originals-verification.json`에 있다. 이 검사는 독립 구현 검사기이지 별도 사람의 제3자 검토/게임 검증을 뜻하지 않는다.

## 안전한 인계 범위

`tools/art/survival-manifest.fragment.json`에 새5sheet/frame만 있다. 권장 통합은 각 실제 Item의 own `/sprite`만 새키로 교체하는 것이다. `cloth/lantern/rubble0/stump/bandage`의 기존 파일·공유 이름·다른 소비자를 바꾸지 않는다. 특히 기록/침낭/여과포/등불/의족/배양목/숫돌/유리/모래와 의료가방/능력을 전역 변경하지 않는다.

원본 원문 계약/정확 복사 목적지는 `tools/art/survival-reference-contract.json`, `docs/art-survival-originals-integrity.json`에 있다. 인계 시 LICENSE는 `tools/art/survival-LICENSE.txt`로 복사해 기존 Root 라이선스를 덮어쓰지 않는다. 원본 source/팔레트/제작·검사 도구를 함께 보존한다.

## 권리

`LICENSE.txt`: CC0-1.0. 새 PNG/SVG·좌표·팔레트·도구·문서의 상업 사용·수정·재배포·게임/모드/2차 애셋 묶음 포함을 허용하며 허락/출처표시를 요구하지 않는다. 프로젝트 밖/기존 게임 자료의 권리를 바꾸지 않는다.

Root CREDITS에 추가할 수 있는 짧은 문구: “헤진 천·붕대·횃불·모닥불 꾸러미·돌5종은 새 픽셀 좌표 원본(CC0-1.0). tools/art/survival-LICENSE.txt 및 docs/art-survival-originals.md 참조.” 이 문구는 제안이며 Root를 편집하지 않았다.

전체 게임/성장/의료/화재/저장/경제 기능이나 최종 버전 성공은 이 아트 범위에서 주장하지 않는다.
