# v370 재나방 원문 등록

원문 PNG 1개에서 서로 다른 포즈 4영역을 등록했다. 등쪽에서 머리가 위를 향한 **1방향**이며, 런타임 회전·인스턴스 수는 제작 방향이나 원화 수를 늘리지 않는다. 새로운 char는 없다.

- frame: `av370_ashmoth_raised`, `av370_ashmoth_spread`, `av370_ashmoth_downstroke`, `av370_ashmoth_folded`
- anim: `av370_ashmoth_flight`, 위 순서, `fps:20`, `renderScale:0.012`
- `anchors`는 각 frame 키에 대응하는 정규화된 가시 흉부 중심이다. 실제 날개 힌지는 관찰/측정하지 않았다.
- body와 icon은 `av370_ashmoth_folded` 자체를 공유한다. 추가 원화·alias frame는 0개다.
- public 원문 SHA256: `63ff12331193b3cff2410d6bdf006db64d59ce925c848209fbbeea1f69299215`

등록은 부모 Native 검토용 후보이며 출시 승인은 false다. 원문을 직접 열어 네 포즈의 차이와 같은 머리 방향을 보았다. 작은 게임 배율의 가독성·연속 날갯짓·실제 군체/조명/밀도 동작은 부모 검증 범위다. 원화의 네 곤충 그림을 개체 수·체력·밀도로 환산하지 않는다.

원문 바이트를 그대로 복사했다. PNG 재인코딩·Pillow 픽셀 생성·리샘플·알파 제거는 하지 않았다. 제작자 기록상 crop 밖 alpha≥8 누락은 0이며 의미 있는 alpha≥16 곤충 영역은 분리돼 있다. **alpha1 잔상은 남고 엄격한 alpha0 조건은 실패**했다. spread와 downstroke의 폭은 요청한 셀 60%를 넘으며 몸 픽셀과 셀 내 위치도 완전히 같지 않다. 흉부 앵커가 이를 정렬할 뿐 원문을 변형하지 않는다. 등록 도구는 제작자의 알파/RGBA 분석을 재실행하지 않는다.

정확한 prompt·호출 1회·원문·진단/검토·false 상태를 `history/v370-ashmoth-flight/`에 바이트 그대로 보존했다. 이전 v369 보류 원문과 기록은 `history/v369-ashmoth-art/`에 보존했고 게임 frame로 등록하지 않았다. v369는 정적 군체 상태 원문이며 새 비행 포즈로 세지 않는다. 진단 PNG와 보관용 복사본도 추가 제작 원화가 아니다.

재현은 저장소 루트에서 수행한다. 보관된 원문이 있으면 외부 staging 없이 재현한다.

```sh
python3 tools/art/install-ashmoth-v370.py --write
python3 tools/art/install-ashmoth-v370.py --check
```

`--write`는 다른 바이트나 기존 값을 덮어쓰지 않고 필요한 항목만 추가한다. 최초 설치 시 이전 manifest 값의 원래 JSON 바이트가 유지되는지 확인한다. `--check`는 쓰기 없이 등록·보관 원문·fragment·receipt를 확인한다. 설치 기록은 `installation.json`, 매핑은 `sprites.fragment.json`이다. 등록 담당자는 `--write`만 실행했으며 별도 검사·테스트·빌드·게임·도감·Git·publisher 작업은 하지 않았다.
