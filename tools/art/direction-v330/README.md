# v330 지속 처치 도구의 손 접점

작성·원화 대조: 2026-10-24.

`medical-grips.json`은 기존 v322 인물 원화에 의료 도구를 붙이기 위한 수동 접점 자료다. 신규 원화나 애니메이션이 아니며, 원본 PNG와 공개 이미지 파일을 수정하지 않았다.

## 좌표와 손의 의미

```json
{
  "format": 1,
  "frames": {
    "실제 sprites.json 프레임 키": {
      "main": [26, 118],
      "off": null
    }
  }
}
```

- 좌표 원점은 `sprites.json.frames[frameKey]`에 정의된 **원래 크롭의 왼쪽 위**다. 단위는 원본 픽셀이고, x는 오른쪽·y는 아래로 증가한다.
- 좌표에는 `frameTransforms`의 anchor, scale, flipX와 표시 위치를 아직 적용하지 않았다. 소비자가 해당 프레임의 변환을 적용해야 한다. 크롭 너비·높이가 프레임마다 다르므로 전체 시트 좌표나 고정 셀 좌표로 해석하면 안 된다.
- `main`은 **최종 표시 인물의 해부학적 오른손**, `off`는 왼손이다. 화면의 왼쪽·오른쪽이나 가까운 손·먼 손을 뜻하지 않는다.
- `guard`와 `healer`의 `left0..3`은 오른쪽을 보는 원본 크롭을 `flipX: true`로 표시한다. 해당 원본의 보이는 가까운 손을 최종 표시의 왼손(`off`)으로 기록했고, 가려진 오른손(`main`)은 `null`이다. 좌표 자체는 뒤집지 않은 원본 크롭 기준이다.
- 접점은 실제로 드러난 손바닥/손가락 영역의 중심을 수동으로 골랐다. 도구의 손잡이 모양별 회전축이나 손가락 관절, 완전한 신체 IK를 뜻하지 않는다. 정수 픽셀 단위 수동 표식이므로 도구별 작은 정렬 보정은 별도다.
- `null`은 소매·몸통·다른 손에 가려졌거나, 보이는 손을 독립적으로 구분하기 어려운 경우다. 추정 위치가 아니다. 소비자가 반대 손이나 공중에 임의의 대체 접점을 만들어서는 안 된다.

## 실제로 대조한 범위

`src/client/sprites.json`의 현재 `work` 프레임을 대상으로 원본 크롭을 방향별 접촉 시트와 확대 이미지로 열어 봤다. 이후 모든 128프레임에 접점 표시를 겹친 진단 이미지를 다시 열어 피부/장갑 영역과 대조하고 소매나 손 밖에 있던 점을 수정했다. 같은 원화를 쓰는 캐릭터 별칭을 별개 원화로 세지 않았다.

| 고유 원화 모델 | 조회한 캐릭터 별칭 | 방향 × 실제 프레임 | main 접점 | off 접점 |
| --- | --- | ---: | ---: | ---: |
| wanderer | player | 4 × 4 | 13 | 12 |
| guard | resident_guard | 4 × 4 | 12 | 11 |
| reaver | reaver1 | 4 × 4 | 15 | 12 |
| patient | shade0 | 4 × 4 | 11 | 10 |
| spore | spore0 | 4 × 4 | 16 | 12 |
| worker | resident_worker | 4 × 4 | 12 | 12 |
| healer | resident_healer | 4 × 4 | 11 | 10 |
| trader | resident_trader | 4 × 4 | 16 | 12 |
| 합계 | 고유 원화 8종 | **128** | **106** | **91** |

총 197개 손 접점과 59개 `null` 손 슬롯이다. 미대조 work 프레임은 없다. 모든 모델의 `up`에서는 먼 왼손을 확실히 볼 수 없어 `off`가 `null`이다. 양손 모두 가려진 프레임은 다음 7개다.

- `av322_wanderer_work_up3`
- `av322_reaver_work_up3`
- `av322_patient_work_up0..3` (실제 키는 각각 네 개)
- `av322_healer_work_up3`

그 밖의 가려진 손은 해당 JSON에 개별 `null`로 남겼다. 원화의 모든 신체 동작을 조사한 자료가 아니라, 이 8종의 현재 `work` 4방향·4프레임만 조사한 자료다. 원화 프레임 수를 늘리거나 숨은 손을 새로 그리지는 않았다.

## 원본 출처

아래 파일은 모두 `public/sprites/original/direction-v322/` 아래의 기존 원본이다. 현재 프레임 키 접두사는 `av322_{model}_work_`다. 대조 시점의 SHA-256을 남겨 원화 변경 시 기준점을 재검토할 수 있게 한다.

| 파일 | SHA-256 |
| --- | --- |
| guard-active-front-left.png | `ff134a6e97d868d0b3e010c63c28d31f1a067d120a5e4ae09bd1479b27969d49` |
| guard-active-right-back.png | `b46b9ed1b635b942f42469891760ed265a42ee20aeb3f31a7267e24f0bed4432` |
| healer-active-front-left.png | `8e40f71c32fa85c6795b010832935a101f572aa8b18c27b21c01523ac9d2cd6a` |
| healer-active-right-back.png | `58888da368147f9bbf7f4317dc62618b2fa6eadea61e7d8e7c89ff36d3f647ca` |
| patient-active-front-left.png | `4daf2c0a193c8a0b8312a31f2b89d785fc0cfcb9a8b30716af89e414042ad1c6` |
| patient-active-right-back.png | `ce9bfbc2c5434ee7393f395ec65c734c3dde597cdd391c556a5bea1bbf18af6e` |
| reaver-active-front-left.png | `c2155107d9564b5cd079e8d38ae8f32f7a0a2bdb710a1c0c926f0299b49c7b2e` |
| reaver-active-right-back.png | `fec74608de6bb5698862f2a6e30e17118a86e942d80e53a3c719c40965dbda97` |
| spore-active-front-left.png | `7c8a81d1d6d6526c7c2de10bb885a11966a58dcef6b88a514b342ca55f79483f` |
| spore-active-right-back.png | `140cfaa147cb41629ae373173812a6f090eb6dabff2a103b4a29473871c1e983` |
| trader-active-front-left.png | `ef249fb89cfe2a56b31716078495bb1402559c306853185e94dc1c3c8a9c2363` |
| trader-active-right-back.png | `dde8f15ba595bf2d22a759d2c97e74858fb098597cb7524f6d4fa4a827282275` |
| wanderer-active-front-left.png | `d522f6206197cf77b0e1ab066bfdd868e0b4c545b4a8f5d4b8bda2ffc6a752a5` |
| wanderer-active-right-back.png | `de44a528ef2e5fa44415c25b8f5d9b39947ef98c4d01ed72dbc9a0a0bc2c6aab` |
| worker-active-front-left.png | `53d3279f3559873ee482b29d61515ab0bc0673ad06bd875c0afeffb97d0ad1a8` |
| worker-active-right-back.png | `10041df83bc009ff09e8e58ad5331131c1eba68484d29b1ab85b4004bb3bb87c` |

## 진단 자료와 남은 표시 확인

수동 대조에 사용한 `/tmp/ashveil-medical-{model}-work.png`, `-hands.png`, `-points.png`, `-points-final.png`는 원본을 크롭/확대한 로컬 진단 자료다. 신규 원화나 배포 자산으로 사용하지 않는다. 최종 접점 겹침 이미지는 8종 모두 열어 확인했다. 확대 이미지 일부는 보조 진단으로만 만들었으며 전부를 별개 검토 원화로 세지 않았다.

이번 접점 등록 작업에서는 빌드, 브라우저 실행, 게임 내 도구 부착 실행 검증을 하지 않았다. 실제 도구의 손잡이가 프레임 변환과 함께 손에 붙는지, `null` 손에서 적절히 숨는지, 양손의 표시 순서가 맞는지는 소비자 구현에서 별도로 확인해야 한다.
