# v338 까마귀 원화 통합

`crow-installation.json`은 실제 선택된11개 원본 PNG의 공개 경로와 SHA-256을 기록한다. 생성 반환 바이트를 그대로 복사했다. 원본을 crop PNG로 재저장하거나 픽셀을 수정하지 않았다. `verify-installed.py`는 저장소의 설치본/해시와144몸 영역·아이콘1개·정확한4방향/변환 등록을 읽기 전용으로 확인한다.

- `crow-base/`: v334의 까마귀 선택8원본에 대응하는 정확한 요청과 까마귀 후보 provenance 사본이다. 함께 제작했던 곰의 후보/미제출 요청은 이 선택 사본에서 제외했다. 요청 인수/출력 SHA는 원문을 보존한다. 원본 PNG는 `public/sprites/original/direction-v334/`에 있다.
- `work/`: v337 작업16영역·깃털1영역의 요청/기부/등록/실패 기록이다. 원본2PNG는 `public/sprites/original/direction-v337/`에 있다.
- `flight/`: v338 날갯짓16영역의 요청/가슴 기준점/알파·기부·좁은 여백 조사다. 원본1PNG는 `public/sprites/original/direction-v338/`에 있다.

하위 README·runtime-contract·native-review의 `active:false`와 절대 staging/diagnostics 경로는 원화 제작 당시의 제한된 검토 기록이다. 당시 진단 페이지/그림은 게임 파일이 아니며 출시 승인으로 바꾸지 않는다. 부모의 실제 통합 범위와 후속 Native 근거는 [구현 기록](../../../docs/crow-v338.md)과 [검사 근거](../../../docs/release-v338-proof.json)에 따로 남긴다. 원문 도구 출력/참고 파일의 절대경로도 역사적 식별자이며 게임이 외부 staging을 읽는 의존성이 아니다.

```sh
python3 tools/art/direction-v338/verify-installed.py
node --import tsx tools/validate-sprites.ts
```

실제 선택은9동작×4방향×4개=144고유 몸 영역과1아이콘이다. 기본 걷기는4개 원화이며12개 프레임이 완성됐다고 세지 않는다. 비행은.055배율과 가슴 기부, 지상은.045배율과 실제 발 투영 기부를 쓴다. 몸 크기/방향 오류를 프레임별 임의 축소로 숨기지 않는다. 원본의 약한 알파 경계와 좁은 비행 여백은 보존하고 Nearest 표본을 유지한다. 이륙/착지는 원래 날갯짓/지상 자세와 높이 보간이며 새 전용 원화가 아니다.
