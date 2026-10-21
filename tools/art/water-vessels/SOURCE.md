# ASHVEIL 원본 물 용기 두 종류

실제 Def/Core/UI를 먼저 조사해 **물리 용기2종만** 선택했다. 현재 물주머니/수통 Def는 없으므로 새 아이템을 만들지 않는다.

- `Item.WaterBottle`/`Item.DirtyWaterBottle`: 같은 `water_bottle` sprite, 물리1×2, 용량1L. 깨끗함/흐림·현재 남은 양은 실제 상태이며 같은 용기를 다시 쓴다.
- `Item.WaterBucket`: `water_bucket` sprite, 물리2×2,2L, 실제 Material.Wood. Recipe.WaterBucket의 재료는 목재4/천1/밀랍1이므로 나무 널판·섬유 손잡이/결속으로 그리고 금속 테두리나 리벳을 추가하지 않았다.

`water_bottle`은 `Item.PineTeaBottle`/`Item.CharcoalFilter`도 공유한다. 프레임을 교체하면 네 실제 물품이 같은 새 병 외형을 쓰므로 조사 파일에 그 영향 범위를 명시했다. 여과통은 Core의 물 용기 대상이 아니고 물병과 분리할 기존 sprite 이름도 없으므로 새 아이템/키를 만들어 세 번째 물 용기인 것처럼 꾸미지 않는다.

`src/core/water-vessels.ts`, 실제 물품/제작 Def, design13의1×2 물병·나무 양동이 등록, 실제 ItemIcon/Inventory/Hud 표시 크기를 읽었다. 물병은 배낭/장비에서32px, 양동이는2×2 배낭에서64px, 핫바는32px이며 작은 표시의16px도 검토한다. `water-vessels-usage-survey.json`에 실제 Def·공유 소비자·제작법·표시 크기와 읽은 파일 SHA를 기록했다.

## 원본 미술과 비밀 상태

닫힌 병은 풍화된 불투명 회녹색 표면과 소박한 마개·목 감개로 그렸다. 재질의 명암만 있고 투명 유리 속 수면·내용물 색·잔량/정수 표식은 없다. 표면의 불투명 질감은 외형의 미술 해석이며 새 재질/능력/규칙을 정의하지 않는다. 나무 양동이는 널판 결·섬유 결속과 손잡이를 가진다. 입구의 어두운 그림자는 내부가 가려진 음영이며 비었음/가득 참이나 수질을 읽는 표식이 아니다. 어느 아이콘도 고정ml·깨끗한 물·오염 정답·차/여과 효과를 알려주지 않는다.

새 정수 좌표를 직접 작성했으며 외부팩 이미지 크롭·추출·재색칠·편집을 하지 않았다. PNG/SVG/캔버스/정수 타원·선/글자 출력은 앞서 직접 만든 자체 도구의 표준 라이브러리 패턴을 재사용한다. 프로젝트를 위해 제작했고 프로젝트와 같은 사용 조건으로 제공한다.

## 산출물과 재현

두32×32 투명 RGBA PNG/SVG와 각16px 최근접 검토본, 실제 배낭용 양동이64px 최근접 검토본, 접촉 시트·팔레트·기존 sprite 이름을 유지한 manifest 조각·실제 조사·integrity JSON을 제공한다. 제안 경로는 `public/sprites/original/items/water_bottle.png`와 `water_bucket.png`다. 접촉 시트는 원본 확대/실크기 검토 자료이며 실제 게임 화면이 아니다.

```sh
python3 draw-water-vessels.py
python3 draw-water-vessels.py --check
```

조사 스냅샷을 도구 소스에 고정해 재현 시 MAIN을 읽지 않는다. 외부 패키지/이미지 입력 없이 자기 격리 폴더에만 출력하고, `--check`는 생성 바이트를 읽기 전용으로 대조한다. Root/Core/Def/실제 manifest/Git/공용 시트·브라우저/GPU·프로젝트 전체/무거운 검사는 변경하거나 실행하지 않는다.
