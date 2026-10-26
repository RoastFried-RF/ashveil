# v389 남은 소품9조합 읽기전용 검토

요청한 `workbench-r5/item-Item.{AshMask|OpticalGoggles|LeatherBelt}-{left|right|up}.png` **9장을모두직접열었다**. 이들은같은HumanView의합성UID/surface이며CoreworldCreated:false/wholeStateEvidence:false다. parent155DOM기록/errors[]와직접9시각리뷰를분리한다. main/product/원문수정·브라우저·게임·테스트·생성·새PNG는0이다.

방향과크기는이전거대화/90·180도회전에비해수정됐다. 좌우·후면허리띠는허리선에붙고,후면고글은strap-only문맥으로표시되며머리뒤로렌즈그림이뚫고나오는문제는보이지않는다. 후면mask는머리뒤에있다. 다만reverse/inner원문이정확히뒤면이라는증명은그대로없으며,숨은눈·입의접촉점은null로남겼다.

## 확정 P2 한 건: 옆면 고글의 렌즈가 눈 앞·위에 떠 있음

LEFT/RIGHT그림에서보이는near lens가실제눈앞으로밀려있다. 수평a/b를전체strap폭으로넓혀거대화/회전은해결했지만runtime은여전히그pair중점을generic eye에맞춘다. 옆면원문의보이는렌즈는전체strap중앙이아니므로다른point mount가필요하다.

|방향|lens와span중점의차이|관측eye후보까지포함한4×화면오프셋|
|---|---|---|
|LEFT|왼쪽1.930worldpx|왼쪽8.51px,위3.63px|
|RIGHT|오른쪽1.804worldpx|오른쪽7.81px,위2.51px|

수치는불변본renderer hash `0eff8b0fbad7c798ddae2417f1b963cf000228103b44e822c706c0203328814f`와동일한9화면의idle2D계산이다. sourceeye±3/gear±4px의불확실도와물리3D미증명은유지한다. 부모에게즉시전달했고부모는P2확인후CI를취소하고같은묶음의mount보정을진행한다고보고했다. **보정후새PNG는아직직접보지않아수락하지않는다.**

## 별도로 공급한 관측점

모든점은원문그대로의raw/crop/normalized/RGBA와불확실도를가진다. 기존a/b수평span은크기용으로유지하고source mount를별도로실제head graphic point에붙이는제안이다.

- `proposals/wanderer-eye-graphic-mounts.json`: defaultv381 aEye crop DOWN[66,89](실제두눈평균),LEFT[43,86],RIGHT[99,80],UPnull. 눈이름은부모현재runtime요청alias를따르며실제3D해부좌우를새로증명한것이아니다. 옛v384candidate문서는변경하지않았다.
- `proposals/goggle-source-mounts.json`: sourceMount crop DOWN[103.5,52](두frontlens평균),LEFT[31,43],RIGHT[147,42],UP[94,49](뒤strap/buckleproxy). 후면actualeye는null이다.
- `proposals/mouth-and-mask-panel-mounts.json`: 관측입술선crop DOWN[66,115],LEFT[43,113],RIGHT[104,107]. 기존실제mask panelprimary crop DOWN[95,54],LEFT[41,55],RIGHT[144,49]도원문paint를확인했다. UP mouth/panel은null이다. 이것은선택한2D표시면중심의fit후보이지물리contact관측이아니다.

마스크에도부착점을개선할수있지만이9장으로별도P2를확정하지않았다. 부모가새mouth-fit후최종PNG로판단하도록후보만공급했다. 다른headrole의눈/입관측,실제gogglegrip/눈결손조건,숨은뒤면/새4방향원화/실제게임Core검증완료로세지않는다.

파일9개SHA/합성상태/exportedSourceHashes는review.json,고글의원인계산은goggle-pin-diagnostic.json이다. 기존원문정방향과소스픽셀은그대로보존된다.
