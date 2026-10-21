# ASHVEIL 원본 알약 여섯 외형

실제 `items-consumables.json`의 `Item.PillWhite/Yellow/Blue/Black/Green/Magenta`와 `docs/design/06-knowledge.md` §4/§15를 읽고 직접 그린 정제·캡슐 원본이다. 실제 label은 흰/노란/푸른/검은/초록/자홍 알약이며 각 Def에는 별도 description이나 고정 효과·형태가 없다. physical size는1×1, 기존 sprite 키는 `pill_white/yellow/blue/black/green/magenta`다.

외형과 효과는 시드별 비밀이다. 효과 대응을 읽거나 그림에 쓰지 않았고 진통·해독·독·각성 등의 이름/십자/해골/번개/문자 표식도 없다. 설계 예시의 흰 둥근·노란/푸른 타원·분홍 캡슐을 참고해, 여섯 색을 무광 정제의 둥근/타원 외형과 자홍 캡슐로만 표현한다. 선은 효과 기호가 아닌 얕은 제조 분할선 또는 캡슐 이음새다. 검은·초록 형태도 효과를 정하는 새 규칙이 아닌 원본 외형의 미술 선택이다.

70년 묵은 재질은 채도를 낮춘 무광 표면과 차가운 모서리로 표현한다. 설계의 '누런 가장자리'는 지각에 따른 변질 단서이므로 기본 그림에 넣지 않았다. 병/포장/병뚜껑/지면/바탕/따로 떨어진 그림자가 없는 투명 원본이다. 각 정제는32×32 안에서 충분한 면적을 차지해1×1 배낭 칸과16px 축소에서 읽히게 한다.

외부 이미지 입력·외부팩 추출·재색칠을 하지 않았다. 정수 좌표와 타원/다각형을 새로 작성했으며 PNG/SVG/캔버스/글자 출력은 앞서 직접 만든 자체 도구의 표준 라이브러리 패턴을 재사용한다. 프로젝트를 위해 제작했고 프로젝트와 같은 사용 조건으로 제공한다.

## 파일과 재현

- `pill_{color}.png/svg`: 각32×32 RGBA 투명 원본. color는 white/yellow/blue/black/green/magenta다.
- `pill_{color}-16.png`: 실제16px 최근접 중심 샘플 검토본.
- `pills-contact.png`: 각 색의 원본 확대·밝고 어두운 배경, 실제32/16px 및16px 확대를 보여 주는 접촉 시트다. 실제 게임 화면은 아니다.
- `pills-palette.json`, `pills-frames.fragment.json`: 팔레트와 기존6 sprite 이름을 보존한32×32 프레임 조각. 제안 경로는 `public/sprites/original/items/`다.
- `pills-integrity.json`: 도구/출처/산출물 SHA256, 치수·알파·면적 기록.

```sh
python3 draw-pills.py
python3 draw-pills.py --check
```

외부 패키지나 입력 이미지를 읽지 않고 이 격리 폴더에만 출력한다. `--check`는 모든 생성 바이트를 읽기 전용으로 대조한다. 제품 Root/Core/Def/Git/공용 시트/manifest·브라우저/GPU·프로젝트 전체 검사는 수정하거나 실행하지 않는다. 미확인 알약/새 효과/변질/지각 규칙의 실제 동작 검증은 Root의 별도 구현 범위다.
