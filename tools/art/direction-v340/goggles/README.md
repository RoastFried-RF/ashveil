# v341 차광 고글 독립 원화

**새 독립1PNG/1고유 아이콘 영역**이다. 앞 v340 회수품1PNG/4영역의 수를 늘리거나 원문을 바꾸지 않았다. 같은 자체 산업 유리/금속 재질과 가죽 스트랩의 색/물성만 참고해 image_gen으로 새로 만들었다. 입력은 v340 자체 회수품 원문과 기존 자체 가죽 허리띠2PNG이며 직접 보고 사용했다. 타 게임 픽셀·외부 이미지·트레이싱은 없다.

부모가 준비한 실제 `src/content/core/defs/surveyor-v340.json`의 **Item.OpticalGoggles/av341_optical_goggles/head/[2,1]**를 읽어 [읽기 전용 스냅샷](item-definition.snapshot.json)으로 보존했다. 보호/장착/제작 수치를 추가하거나 수정하지 않았고, 이 스냅샷은 새 Def 등록 파일이 아니다. 원래 Def가 이미 정확한 sprite키를 쓰므로 Def패치 없이 원본과 frame을 부모가 연결할 수 있다.

## 실제 형태와 축소 검토

수평3/4관점의 인간용 고글1개다. 어두운 차광 렌즈**2개**, 짧은 코 연결 다리, 둔한 금속/가죽 테와 작은 바깥 측면판, 뒤로 연결된 실제 갈색 가죽 스트랩·버클이 있다. 스트랩이 두 앞 렌즈를 가리지 않으며 열린 내부는 투명하다. 렌즈에 눈/인물·발광·열지도·마법 효과를 넣지 않았다. 바닥·고정 그림자·얼굴·마네킹·손·UI도 없다.

원문과 최종 [상세](diagnostics/detail.png), [32×16·64×32](diagnostics/native.png), [3배경 알파](diagnostics/alpha.png)3장을 직접 열었다.32×16에서도 두 렌즈와 뒤 스트랩이 구분되고64×32에서는 버클·코 연결 다리·측면판이 더 잘 읽힌다. 아주 작은 리벳/가죽 주름까지32×16에서 모두 유지된다고 주장하지 않는다. 전체crop을 실제 ItemIcon.vue와 같은 `min(box.w/frame.w,box.h/frame.h)` 공식으로 종횡비를 유지해 맞췄다. 실제 게임 컴포넌트나 장착 장면을 실행한 것은 아니다.

독립 alpha확대진단의 처음 캔버스 참조 오류를 고친 후 다시 캡처하고 최종3장을 다시 열었다. 이 과정에서 생성 원본은 바꾸지 않았다. 최종 검토와 SHA는 [native-review.json](native-review.json)에 있다. 게임 내 보호 효과/제작/장착과 얼굴 위 착용 그림은 이 아이콘 검토에 포함하지 않았다.

## 원문과 등록

원문은 실제**1774×887**, `originals/optical-goggles-v1.png`다. 정확crop은**[368,220,1102,515]**이고 알파≥16그림 주위4px 여백이다. 원본 그림은 캔버스 바깥에서 왼372/위224/오른308/아래156px 떨어져 있으며 스트랩/버클/렌즈가 잘리지 않았다. 전체crop 종횡비는약2.1398이다.

- [sprites.fragment.json](sprites.fragment.json): 실제1시트·크기·`av341_optical_goggles`1frame. 원문 바이트를 `public/sprites/original/direction-v341/`에 복사할 제안이다.
- [item-art.fragment.json](item-art.fragment.json): 기존 부모 Item의 키/2×1칸/head·미리보기 크기32×16/64×32. 렌즈/버클의 원래 좌표는 직접 고른 근사 참고이며 표시 anchor나 보호 판정점이 아니다.
- [install-plan.json](install-plan.json): 원본 목적 경로/SHA와 부모 통합 조건.
- `requests/`, `records/`: 정확 prompt/도구 인수·자체 입력 SHA·도구 반환 경로·보존본/출력 SHA.
- [source-survey.json](source-survey.json): 기존 자체 입력/실제 부모 Def·표시 공식과 v340/v338 전체61파일 불변 기준선.

PNG를 그대로 보존했다. Pillow/NumPy/SciPy는 알파/연결 영역/crop·CRC와 SHA만 읽었다. 원문 픽셀 수정, PNG crop저장·리샘플링·재인코딩·배경 제거는 하지 않았다. canvas 축소/확대는 별도 진단이며 새 원화 PNG로 세지 않는다. 첫 후보가 물리 형태와 native검토를 통과해 실패한 생성 원문0개이며 삭제/재분류로 후보를 숨기지 않았다.

## 검사 범위

원본 SHA·PNG CRC, 실제1sheet/1frame 범위, 전체 연결 원화의 알파≥16픽셀 손실0·crop경계0, 부모 Item의 실제key/head/2×1 매핑, 기존v340/v338전61파일 바이트/파일목록 불변을 확인했다. 독립 진단은13canvas·브라우저오류0·게임로드false다. 결과는 [validation-proof.json](validation-proof.json)에 있다. 이 검사들이 실제 제작/장착/보호 게임 동작이나 출시 수락을 대신하지 않는다. `active:false`다.

```sh
python3 /workspace/.ashveil-planned/v341-optical-goggles/validate-staging.py
python3 -m http.server 6354 --bind 127.0.0.1 --directory /workspace/.ashveil-planned/v341-optical-goggles
node /workspace/.ashveil-planned/v341-optical-goggles/capture-staging.mjs
```

최종 source/등록은 [art-final.json](art-final.json)에 동결했다. 메인src/public/docs/dist·게임상태·기존확정staging을 수정하지 않았고 빌드·Full/World·commit/push를 하지 않았다. 독립 진단서버는 검토 후 종료했다.
