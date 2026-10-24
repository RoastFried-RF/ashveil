# 검은 숲 자연 채집 군락 · v336 준비 원화

기존 자체 숲·그늘뿌리·잿딸기 아이콘/덤불·밭 단계 원화와 실제 Def/검은 숲 설정을 읽고 직접 보았다. 새 PNG와 모든 기록은 이 staging 폴더에만 작성했다. 메인 `src/public/docs/state`, 공유dist/preview·게임 상태는 수정하지 않았고 빌드·World·전체 검사·commit/push를 실행하지 않았다.

**그늘뿌리 군락과 잿딸기 덤불2종 × 성숙4변형/뜯긴·소진4변형 = 새2PNG/16고유영역**을 등록 제안한다. 각 열의 성숙/소진은 같은 기부의 짝이며 공유 배율과 각각의 원래 기부 anchor를 사용한다. `active:false`다. 이 원화 준비만으로 실제 자연 군락·수확·재성장/기억을 활성화하지 않는다.

## 읽은 설정과 기존 표시

`CANON.md`와 `lore/world-bible.md` T10은 검은 숲을 종자 금고 주변의 저조도 실험 수목 후손으로 설명한다. `blackwood.json`의 그늘뿌리는 **검은 잎 식물의 둥근 식용 뿌리**다. `plant-foods.json`의 잿딸기는 **여름에 실제 덤불에 열리는 비타민원**이고 실제 채집/원래 재생 시계가 있다. 동물의 섭식·수확량/생태 출처를 새 그림으로 바꾸지 않는다.

실제 ShadePlot의 Def visual은 mushrooms지만 MapRenderer는 `cropArt`의 `av_crop_shade_*`를 먼저 사용하고 다음에 `groundObjectArt`의 `complete_crop_shade`를 사용한다. 이 재배 단계/밭 표시와 자연 군락을 구분해야 한다. 기존 잿딸기는 `original_ashberry_bush`32px 한 장이며 소진 때도 별도 빈 가지 원본이 없었다. [읽기 전용 출처/해시 조사](source-survey.json)에 실제 경로를 남겼다.

## 채택/실패 원본

- **채택 제안 v2**: `shade-root-clumps-v2.png`, `ashberry-bushes-v2.png`, 각8영역. 낮은 검은잎 로제트/둥근 뿌리 기부와 가는 줄기·실제 붉은 열매가 붙은 낮은 덤불이다. 비대칭4변형이며 고정 바닥·농경지 줄무늬·토양 패드·물·화분·흩어진 수확물을 넣지 않았다.
- **실패 v1**: 굵은 목질의 작은 나무처럼 보이고 소진형에 둥근 식용 뿌리/큰 온전한 잎이 남아 제외했다. 새 v2에서는 수목 입력을 빼고, 소진형은 잎과 열매를 전부 없애고 짧게 뜯긴 줄기/기부만 남겼다. [원본과 실패 이유](rejected/candidates.json)는 보존했다.

전체 생성은4PNG/32영역이고 실행용 제안은2PNG/16영역이다. 별도 회전/반전·재색칠·기존 영역 재사용을 신규 변형으로 세지 않는다. 소진 잿딸기4영역의 불투명 강한 붉은색 픽셀은0이고, 그늘뿌리 소진형에는 온전한 식용 둥근 뿌리나 큰 잎이 없다. 색 집계가 식물 의미 검토를 대신한다고 주장하지 않는다.

정확한 프롬프트/자체 입력/도구 출력 경로/SHA-256은 `prompts/`, `records/`에 있다. 모든 PNG는 image_gen 출력과 같은 바이트로 보존했고 원래 `/workspace/generated_images` 출력도 남겨 두었다. Pillow는 알파/영역/기부/CRC 읽기만 수행했다. PNG 크롭 저장·픽셀 수정·재색칠·리샘플링을 하지 않았다.

## 파일과 표시 규격

- [sprites.forage.fragment.json](sprites.forage.fragment.json): 새2시트·16정확 crop·시트 크기. 바닥을 포함하지 않는 투명 식물만 참조한다.
- [forage-art.fragment.json](forage-art.fragment.json): 비활성 자연 군락2가족/8짝의 성숙·소진 키, 기부 anchor와 **짝 공유 배율**. 가용 식용량·동물 능력·충돌을 넣지 않았다.
- [install-plan.json](install-plan.json): 제안2PNG의 목적 경로와 원본 해시.
- [state-contract.json](state-contract.json): 실제 가용량/gatherAt·기억·재성장을 부모가 연결할 때 지킬 조건.

논리 타일은16월드px이고 한 짝은 최대14px폭/12px높이에 맞춘다. 식물 기부/붙은 뿌리의 실제 하단 anchor를 사용한다. 소진 crop을 따로16px에 채워 키우거나 기존0.6소진 배율을 추가로 적용하지 않는다. 수확 뒤에도 같은 안정된 변형0..3을 유지하고, 렌더러에서 난수를 뽑거나 새로운 식용 산물을 만들지 않는다. 자연 군락 연결이 농경지의 실제 성장 단계와 토양/관수를 덮어쓰면 안 된다.

## 진단과 확인 범위

`index.html`은 중립 배경의 동일 배율 기부 비교, 실제16×16 샘플/5배 확대, 같은 군락의 두 상태와 기존 표시를 함께 보여 준다. 배경은 기존 자체 흙624px 텍스처 전체를16px로 억지 축소하지 않고 게임과 같은8×8분할 중 한 칸/기본 명암을 쓴 진단 샘플이다. 배경을 새 식물 PNG에 굽지 않았다. `references/`는 기존 자체 PNG를 바이트 그대로 복사한 진단 참고이고 신규 원화 수에 넣지 않았다.

[성숙](screenshots/mature.png)과 [소진](screenshots/spent.png) 실제 알파 합성과 새4원본을 직접 보아 잎·붉은 열매·뿌리 제거, 기부 대응, 작은 타일 가독성, 완성된 덩어리/잘림·이웃 잎 혼입을 검토했다. 그늘뿌리의 어두운 성숙 잎은 얼룩진 숲 바닥과 대비가 낮으므로 실제 맵 조명/인접물/줌에서 추가 확인해야 한다. 미세 묘사 전체가16px에서 유지된다고 주장하지 않는다. 최종 해시와 이 한계는 `native-review.json`에 남겼다. 진단 교대는 실제 재성장이 아니며 게임 상태·각인·현재 숨은 식물을 로드하지 않는다.

```sh
python3 /workspace/.ashveil-planned/v336-wild-forage-art/register-forage.py
python3 /workspace/.ashveil-planned/v336-wild-forage-art/validate-forage.py
python3 -m http.server 6350 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v336-wild-forage-art
node --import /workspace/ashveil/node_modules/tsx/dist/loader.mjs /workspace/.ashveil-planned/v336-wild-forage-art/capture-review.mts
```

원본 SHA/PNG CRC·crop/참조·8짝 동일 배율/범위 검사는 `validation-proof.json`에 있다. 제안 crop 경계의 불투명 연속 잘림0, crop 사이 최소38px다. 실제 게임의 동물 뜯기·원래 자원 재생·계절·기억/숨은 정보·가림 검증은 부모가 연결한 뒤 남는다. `active:false`를 유지한다.

## 부모 구현의 적용 기록 · v336

위 본문과 inactive 메타데이터는 staging 제작 시점의 원문이다. 부모는 원본4PNG를 `public/sprites/original/direction-v336/forage/`에 바이트 그대로 보존하고 채택2PNG/16영역을 활성 atlas에 병합했다. `src/client/render/forage-art.json`이 실제 실행용 가족/짝/기부 등록이다. 자연 그늘뿌리5군락은 새 지도에서 `Terrain.WildShadeRoots`로 분리하고 재배 밭/종자/성장 단계는 원래 경로를 사용한다. 잿딸기의 원래 계절/채집량/재생 시계도 보존한다. 실제 시야 갱신에서 `observed.gatherAvailable`만 기록하며 숨은 칸의 재생 시계는 표시에서 읽지 않는다. 옛 각인에서 기록이 없는 군락은 열매/큰 잎이 없는 중립 기부로 표시하고 다시 관찰해야 현재 모습이 나타난다. 실제 게임 화면/공개 입력의 검토와 한계는 `docs/natural-forage-v336.md` 및 해당 검사 기록을 따른다.

저장소의 원본/실제 등록 확인은 `python3 tools/art/direction-v336/forage/verify-installed.py`다. 과거 staging 도구/절대 생성 경로는 제작 이력이며 실행형 게임 설정으로 가져오지 않는다.
