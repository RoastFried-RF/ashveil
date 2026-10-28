# v371 재나방 채집·가공 아이콘 등록

고정 원문 1PNG, 1774×887, 410,455bytes에서 다음 두 영역을 등록했다.

| frame | 원문 x,y,width,height |
|---|---|
| `av371_moth_wing_dust` | `[245,343,454,324]` |
| `av371_roasted_moths` | `[1080,323,445,349]` |

public 원문은 `sprites/original/direction-v371/ashmoth-harvest-icons-v1.png`, SHA256은 `3262d4adf9ef3f7babe0447e708a291b27dd349591daaa5cbda5f19f773ed0d9`다. 바이트 그대로 복사했으며 픽셀 수정·리샘플·알파 제거·PNG 재인코딩은 0회다. 새 char/anim은 없다. 기존 manifest 값의 원래 JSON 바이트를 보존하며 sheet1/frame2만 추가했다.

원문 전체를 직접 열어 왼쪽 회색 안료/석기 그릇과 오른쪽 구운 갈색 곤충/목기 그릇을 확인했다. 작은 조각의 수나 크기를 1g 가루·50마리 입력·10g 음식 규칙의 증거로 해석하지 않는다. 그 규칙과 실제 ItemDef 연결은 부모 담당이다.

제작자 분석상 의미 있는 실루엣은 각 칸 55% 안이고, crop/캔버스 경계 alpha0·중앙148px 완전 투명·crop 밖 alpha≥8 누락0·이웃 오염0이다. 이 분석을 설치 담당자가 픽셀 루프로 재검증한 것은 아니다. crop 밖 alpha1–7 잔상은 각각67/133px 남는다. 원문 전체가 완전 alpha0 배경이라는 주장은 하지 않는다.

왼쪽 그릇은 요청한 매우 얕은 접시보다 두껍고 입자가 자갈처럼 읽힐 수 있다. 오른쪽 일부 날개는 비교적 온전하고 크며, 그려진 몇 마리는 상징적 음식 표현이다. 실제32/48px UI·레시피/가공·채집·최종 출시 수락은 아직 부모 Native 검토 범위다. 설치 receipt는 후보 상태와 `releaseApproved:false`를 유지한다.

`history/v371-ashmoth-harvest-icons/`에 원문·정확 prompt/생성 인수·호출1회·provenance·최종 frame-proposals·알파 분석·원문 진단2장과 README를 바이트 그대로 보존했다. 진단/보관 복사본은 추가 원화가 아니다. 제작자의 기존 false 상태는 수정하지 않았다. 매핑은 `sprites.fragment.json`, 별도 설치 기록은 `installation.json`이다.

저장소 루트에서 재현한다. 보관된 원문이 있으면 외부 staging 없이 동작한다.

```sh
python3 tools/art/install-ashmoth-icons-v371.py --write
python3 tools/art/install-ashmoth-icons-v371.py --check
```

등록 담당자는 `--write`만 실행했다. `--check`와 테스트·빌드·게임·Native 검증은 부모가 실행하며 Core/Defs/Atlas/Renderer/UI·publisher·Git·이전 staging은 변경하지 않았다.
