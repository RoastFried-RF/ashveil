# v340 측량기·회수품·차광 고글 통합

세 설치 JSON은 선택된 원본10PNG의 공개 경로/역사적 staging 경로/SHA-256을 기록한다. `verify-installed.py`는 설치본 바이트와96개 고유 몸 영역·5개 독립 아이콘·공유 섬광 자세를 읽기 전용으로 확인한다.

- `base/`: v335 측량기 대기/보행/작업3원본에 대한 요청과 선정 기록이다. 같은 제작 묶음의 파종기/구제기 원화는 활성화하지 않았다. 공통 분석/README는 당시 전체 묶음의 역사이며 실제 선택은 `surveyor-installation.json`과 활성 캐릭터 등록을 따른다.
- `actions/`: v339 피격/접힌 정지/재기동48영역·5원본의 정확한 요청/입력·출력·기부·오류/퇴역 기록이다. 첫 fall의 방향 오류 좌우8셀은 후보 원본 안에 보존하고 새 방향별 원본으로 교체했다.
- `materials/`: v340 렌즈/선재/다리 프레임/열감지 부품4영역이다. 해당 Def를 다시 등록하는 자료가 아니다.
- `goggles/`: v341의 별도 고글1원본·1영역이다.2×1칸 원래1774×887 source/crop과32×16·64×32 진단의 제작 기록을 보존한다.

PNG는 `public/sprites/original/direction-v335`, `direction-v339`, `direction-v340`, `direction-v341`에 원문 그대로 설치했다. 하위 `active:false`/`activationReady:false`·절대 diagnostic/staging 경로는 원화 제작 당시의 제한된 검토 기록이며 부모의 실제 통합 검토와 구분한다. 게임은 외부 staging 파일을 로드하지 않는다. 원문 요청 인수/출처를 현재 출시 승인처럼 고쳐 쓰지 않았다.

96개 몸 영역은6동작×4방향×4개다. 섬광 `use`는 보고 `work`를320ms로 공유하며 새 원본 영역을 만들지 않았다. 반전/역순 복제로 신규 수를 늘리지 않는다.4개 기본 보행 위상을12개로 기록하지 않는다. 발 기준은 화면에서 가장 아래인 픽셀과 같지 않으며, 기부는 실제3개 발 지지면의 투영점을 사용한다. 멀리 있는 발의 가림을 추가/제거된 다리로 해석하지 않는다.

```sh
python3 tools/art/direction-v340/verify-installed.py
node --import tsx tools/validate-sprites.ts
```

실제 기능·입력 범위와 미완료는 [구현 기록](../../../docs/surveyor-v340.md), [검사 근거](../../../docs/release-v340-proof.json)에 유지한다. 별도 원화 도감의 정지 캡처를 실제 걷기/손상/출시 승인으로 바꾸지 않는다.
