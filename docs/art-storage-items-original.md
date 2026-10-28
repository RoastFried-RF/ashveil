# ASHVEIL 원본 보관·화살 아이콘

2026-10-20에 마대 자루·빈 가죽 화살통·가죽 허리띠·화살 묶음용으로 직접 그렸다. 캐릭터 원본과 같은 낡은 가죽·바랜 청록·상아 깃·구리 팔레트를 사용한다. 실루엣·주름·꿰맨 자국·깃·철촉을 모두 새 정수 좌표로 설계했다. 외부 이미지 입력·아이콘 추출·기존 그림의 재색칠·트레이싱은 없다.

## 파일과 권장 연결

각 아이콘은 32 × 32 px, RGBA PNG이며 배경은 완전 투명하다. SVG는 PNG와 같은 픽셀을 정수 좌표의 편집 가능한 사각형으로 보존한다.

| 실제 Def | PNG 파일 | 권장 새 아틀라스 프레임 | 디자인 |
| --- | --- | --- | --- |
| `Item.Sack` | `public/sprites/original/items/ashveil-sack.png` | `ashveil_sack` | 묶인 린넨 자루, 부푼 주름, 바랜 청록 수선 패치 |
| `Item.Quiver` | `public/sprites/original/items/ashveil-quiver.png` | `ashveil_quiver` | 빈 입구와 닫힌 밑바닥이 보이는 긴 가죽 통, 운반 끈, 구리 테두리 |
| `Item.LeatherBelt` | `public/sprites/original/items/ashveil-leather-belt.png` | `ashveil_leather_belt` | 둥글게 말린 허리띠, 구리 버클, 설명에 맞는 작은 주머니 |
| `Item.Arrow` | `public/sprites/original/items/ashveil-arrow-bundle.png` | `ashveil_arrow_bundle` | 밝은 깃과 철촉이 있는 세 화살, 바랜 천 묶음 |

네 프레임의 영역은 모두 `[0, 0, 32, 32]`이다. 이미지마다 같은 이름의 `.svg`가 있다. 아이콘 자체에는 수량·품질·선택 상태를 넣지 않았다. 화살의 세 실루엣은 묶음을 나타내는 도상이며 실제 소지 수량은 기존 UI가 표시한다. 화살통은 제작 직후 빈 상태와 맞는다.

본 작업은 아트 파일을 제공한다. 실제 Def·아틀라스·매니페스트 연결은 포함하지 않는다. 적용 시 기존 `cloth`·`arrow`·`leather_coat`의 공용 이미지를 교체하면 관련 없는 품목까지 달라지므로 위의 별도 프레임과 프로젝트의 Def PATCH 절차를 사용한다. URL은 GitHub Pages 하위 경로를 지원하도록 `import.meta.env.BASE_URL`에 `sprites/original/items/파일명.png`를 이어서 만든다.

## 제작 원본과 재생성

- `tools/art/draw-storage-items.py`: 직접 작성한 픽셀 좌표·폴리곤·주름·재질 클러스터. Python 표준 라이브러리만 사용하며 이미지 파일을 입력받지 않는다.
- `public/sprites/original/items/ashveil-storage-items-palette.json`: 19색 재질 팔레트.
- `public/sprites/original/items/ashveil-storage-items-source.json`: 원본 도구와 PNG/SVG·팔레트·검토 시트의 크기·SHA-256·권장 Def 연결.
- `public/sprites/original/items/ashveil-storage-items-contact.png`: 768 × 248 px 검토 시트. 왼쪽부터 자루·화살통·허리띠·화살이며 각 열의 큰 그림은 4배 정수 확대, 아래 둘은 어두운 배경과 밝은 배경에서 실제 1배 표시다.

```sh
python3 tools/art/draw-storage-items.py
python3 tools/art/draw-storage-items.py --check
```

첫 명령은 이 도구 소유의 새 아트 파일 11개만 재생성한다. 두 번째 명령은 결과 바이트가 현재 파일과 같은지 확인하고 파일을 쓰지 않는다. PNG는 직접 RGBA를 인코딩하며 보간·블러·안티앨리어싱을 적용하지 않는다.

## 확인

- 실제 4배/1배 검토 시트를 `view_image`로 확인했다.
- 네 PNG의 32 × 32 크기·RGBA 형식·완전 투명/불투명 두 알파 값·외곽 여백을 확인했다.
- SVG의 사각형을 별도로 래스터화한 좌표와 PNG의 모든 픽셀이 같음을 확인했다.
- `--check`로 11개 파일의 결정적 재생성을 확인했다.
- 전체 테스트·브라우저·GPU·Core·UI 소스·기존 문서·git은 변경하거나 실행하지 않았다.

## SHA-256

제작 도구: `f2710e3945930725b2a09bc0aeaf267809c59da5c9d799a799c95a872606937a`

| 파일 | SHA-256 |
| --- | --- |
| `ashveil-sack.png` | `102b243303e41eb3a85a312113b11866724b3f08372f90fbff456b3890cd691d` |
| `ashveil-sack.svg` | `30353c5ff1383a29a406448dd04fd8f8f04648d40cd3c191cad9f1b874e6b3ee` |
| `ashveil-quiver.png` | `dcb3e444e019a45522b16a5dcd14bd59d34ef9283e266d2e0b669dcf5ca69643` |
| `ashveil-quiver.svg` | `d636352b70a2ed351cb1e54bf33fc39d09f3e9d0c9372b89cb624f7fe58c690f` |
| `ashveil-leather-belt.png` | `0721307b2adb53a3437e34daeb719ff5bb79c937936f2e4db501ca064ee71891` |
| `ashveil-leather-belt.svg` | `7e9b33bd7dee57529c778bf05d502f0bca4e38004c527122b61669d387db89b1` |
| `ashveil-arrow-bundle.png` | `31e7e94aab296cc322f9450b4f43fac26f79cec4f87aa6b0fb81db48b9d7d4eb` |
| `ashveil-arrow-bundle.svg` | `f3d839d495f226b6141f9b2f92bb3436a2da614f8907a5ed4b35e54ed799e0a6` |
| `ashveil-storage-items-contact.png` | `042310cbd86627224bc5f54168d9f3e6d6b7bf614b52b5d7fb7a313820c20e67` |
| `ashveil-storage-items-palette.json` | `e9457b8e90003db0d08e3c7f432185d4a9a35da2881b2ac80b9f1b7646cf5b3a` |

