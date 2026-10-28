# ASHVEIL 원본 말라붙은 사제 withered_priest — 준비 패키지

2026-10-20에 실제 `Creature.WitheredPriest`의 캐릭터 키 `withered_priest`를 위한 새 보행·대기 원본과 새로운 향로 공격 포즈를 직접 그렸다. 현재 상태는 **아트와 병합 조각 준비 완료, 게임 미등록**이다. 모든 파일은 `/workspace/ashveil-withered-priest-art` 안에만 작성했다. 실제 게임 저장소·Core·Def·매니페스트·공용 시트·기존 문서·git은 변경하지 않았다.

## 설정: 아직 살아 있는 회색열 환자

CANON §7.3·§7.4 D26/D32, `docs/lore/world-bible.md` §5.4/T11, `docs/lore/bestiary.md` §19/§19.1과 실제 Def를 읽었다. 사제는 병동을 돌보다 감염된 살아 있는 회색열 말기 환자이며, 말과 기억을 잃었어도 향로를 들고 병동을 돌던 손동작이 남아 있다. 피부·볼·코·입술을 연속된 따뜻한 회갈색 면으로 남기고 눈은 작은 어두운 동공으로 그렸다.

해골·언데드·노출된 뼈·되살아남·발광 눈·녹색 기운·마법 연기를 사용하지 않았다. 해진 수도복·접힌 깃·비대칭 천 조각·낡은 끈과 꺼진 작은 금속 향로를 새 도형으로 제작했다. 성스러운 표식이나 새 교단 설정은 추가하지 않았다.

도감 §19.1과 실제 Def의 사제는 일반형보다 덜 말랐으며 hpMult=1.0, 체중 55kg이다. 일반형 제작 담당자와 공통 셀·지면·공격 오프셋을 맞추고, 일반형 25px보다 몸통이 남은 27px 성인으로 협의했다. Core 체격·수치는 바꾸지 않았다. 같은 담당자가 공유한 피부 8색과 환자복 4색을 그대로 사용하고 로브·끈·금속 향로의 저채도 재질색을 더한 총 22색 팔레트다.

## 실제 기존 계약과 새 공격

작업 시작 시 실제 `src/client/sprites.json`의 `chars.withered_priest`에는 방향별 보행 3개와 가운데 idle만 있었으며 **attack 항목은 없었다**. 기존 셀은 공용 `mon1_withered`의 x=144/168/192, 방향 행 y=128/160/192/224에 있었다.

이 패키지는 기존 12보행 프레임 이름과 네 방향 idle 목록을 그대로 보존한다. **16개 향로 공격은 이번에 새로 그린 동작**이다. 원래 공격 16개가 있었다거나 기존 공격을 교체했다고 기록하지 않는다.

| 항목 | 값 |
| --- | --- |
| 실제 char 키 | `withered_priest` |
| 보행 PNG | `ashveil-withered-priest-walk.png`, 72 × 128 px |
| 보행 셀 | 24 × 32 px, 3열 × 4행 |
| 방향 행 | `down`, `left`, `right`, `up` |
| 기존 walk 이름 | 방향별 `withered_priest_w_{방향}0`, `1`, `2` |
| 기존 idle | 방향별 `withered_priest_w_{방향}1` |
| 신규 공격 PNG | `ashveil-withered-priest-attack.png`, 128 × 160 px |
| 신규 공격 셀 | 32 × 40 px, 4열 × 4행 |
| 신규 attack 이름 | 방향별 `withered_priest_a_{방향}0`, `1`, `2`, `3` |
| 신규 공격 포즈 | 준비·향로 올리기·내려치기/앞으로 뻗기·회복 |

향로는 일반 장비를 임의로 고정한 무기가 아니라 실제 사제 자연 공격의 `향로 내려치기`와 도감 §19.1의 꺼진 향로를 표현한다. 작은 금속 통과 끈만 있으며 불꽃·발광·연기를 넣지 않았다. 일반 말라붙은 자의 무기 없는 두 손 붙잡기/뻗기와 동작·기물·옷 실루엣이 다르다.

## 병합 조각과 지면

`tools/art/withered-priest-manifest.fragment.json`은 `sheets`, `frames`, `chars` 병합 조각이다. 실제 매니페스트를 읽거나 수정하는 설치 기능은 없다.

- 시트 키: `withered_priest`, `withered_priest_atk`만 포함한다.
- 캐릭터 키: `withered_priest` 하나만 포함한다.
- 프레임 키: `withered_priest_` 접두사의 28개만 포함한다.
- 보행 anchor: `[0.5, 31/32]`.
- 신규 공격 anchor: `[0.5, 39/40]`.
- 공격 셀 안의 몸 오프셋: `[4, 8]`. `39 − 8 = 31`이므로 지면이 일치한다.
- 원본 배율 `renderScale: 1`, `headOffset: 27`.
- 실제 보행 12개 모두 불투명 픽셀 범위 y=4~30, 높이 27px, 발 밑면 y=31이다.

기존 anchor y=0.92와 암묵 배율 0.72를 유지한 변경이라고 주장하지 않는다. 새 원본과 합의된 같은 지면에 맞춘 명시값이다. 일반형 `withered`·그늘 사람·공용 `mon1_withered` 및 다른 캐릭터의 항목을 포함하거나 수정하지 않는다.

## 제작 원본과 재현

`tools/art/draw-withered-priest.py`가 신체·얼굴·로브·끈·향로·방향·보행·공격의 픽셀 원본이다. 기존 자체 좌표 캔버스·관절 선·PNG/SVG 인코더와 검토 시트 구조를 재사용했고 인체·복식·기물·팔 동작은 새 좌표로 작성했다. 외부 이미지·기존 캐릭터 시트의 픽셀을 입력·추출·크롭·트레이싱·재색칠하지 않았다.

```sh
python3 tools/art/draw-withered-priest.py
python3 tools/art/draw-withered-priest.py --check
```

Python 표준 라이브러리만 사용하며 첫 명령은 자기 소유의 새 아트·팔레트·병합 조각·출처 파일 8개만 생성한다. 두 번째는 결과 바이트를 재생성해 저장된 파일과 비교하고 파일을 쓰지 않는다.

같은 이름의 SVG는 PNG와 동일한 정수 픽셀을 보존하는 편집 원본이다. `ashveil-withered-priest-palette.json`에 22색 팔레트, `ashveil-withered-priest-source.json`에 기존 계약·새 동작 수·방법·해시가 있다.

`ashveil-withered-priest-contact.png`는 640 × 1304 px 4배 검토 시트다. 위는 보행 12개, 아래는 신규 공격 16개이며 각 방향 행은 D/L/R/U다.

## 직접 확인과 검사

보행 PNG·공격 PNG·전체 검토 시트를 각각 `view_image`로 실제 열어 얼굴·살색·옷·향로 동작을 확인했다. 가벼운 아트 검사로 다음 항목을 확인했다.

- `--check`의 8개 파일 결정적 바이트 재현 통과.
- PNG 크기·RGBA 형식·알파 값 0/255와 SVG 전 픽셀 일치.
- 28개 프레임 시트 경계와 외곽 여백·방향별 포즈 차이.
- 실제 기존 캐릭터와 12개 보행 이름·네 방향 idle 목록의 정확한 일치.
- 기존 attack 부재와 신규 향로 공격 16개의 구분.
- 사제 전용 키 및 같은 지면·오프셋·명시 배율.
- 실제 보행 12개 모두 27px 높이.

실제 게임 등록·실행 검증은 아직 수행하지 않았다. 게임 소스·Core·Def·공용 시트·실제 매니페스트·git은 수정하지 않았고 GPU·브라우저·프로젝트 검사·무거운 검사는 실행하지 않았다.

## SHA-256

제작 도구: `9ef2179ed25e0016ed5c284f341f9e551b32cafe0b0a878b814d18902c69cb0b`

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `public/sprites/original/ashveil-withered-priest-walk.png` | 1550 | `852db89c4239057c77dc431c837c61148e1a82c0201690f5eeb6d4709e992030` |
| `public/sprites/original/ashveil-withered-priest-attack.png` | 2299 | `1b8d9a7b8bfed8c44da28c5ea92b0d6a544916bd3b1d2c6a88bf61285b31a6f5` |
| `public/sprites/original/ashveil-withered-priest-walk.svg` | 135472 | `03706efd67e695625d283514ca092fd86b7fdb82a790f6b24b34ba942698df95` |
| `public/sprites/original/ashveil-withered-priest-attack.svg` | 203934 | `ed2bf502c5158585a7e6e899af5b72fdb216febdc6f4bd96ca4151b9d3bcc922` |
| `public/sprites/original/ashveil-withered-priest-contact.png` | 16472 | `2f2d77b052f2afcd51f11a2befbb25990bbc558c55b4bd56de41ee8c3812bc16` |
| `public/sprites/original/ashveil-withered-priest-palette.json` | 399 | `dad818212319a3cbf83e999847c50af9e2761f20dc858fe2d0f2932f9dfb1234` |
| `tools/art/withered-priest-manifest.fragment.json` | 4950 | `bdd3a7f5bf99896e30fe1895407fd6063563d1f44416bc9be9f09295cbac67dd` |


## v0.287 적용

Root가 원본 접촉 시트를 직접 열어 검토한 뒤 전용 두 시트·기존12보행/idle·신규16공격·char의 실제 배율/앵커를 함께 적용했다. 공용 시트와 다른 char는 바이트 보존했다. 게임 Root에서8개 산출물 --check 재현도 통과했다. 실제 게임 화면 검증은 아직 남아 있다. 위 준비 패키지 기록은 제작 당시 범위다.
