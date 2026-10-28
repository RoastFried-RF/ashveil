# v389 workbench-r3 독립 시각리뷰

요청범위의 **81PNG를직접열었다**: 의복25종각1FRONT,6개조합×4방향24장,의수족6종의실제설치root28장(모두FRONT),결손/half/damaged/undressing4장. 폴더전체는101PNG이므로동작·속도·narrow20장은미검토로명시한다. 각각1×/2×/4×세표시가있는같은HumanView 합성화면이다. 실제게임전수검사·모든25의복4방향·의수족4방향검토로쓰지않는다.

audit의106DOM기록/errors[]는부모실행결과다. **합성UID/surface, coreWorldCreated:false,wholeStateEvidence:false**이며이담당자는브라우저/게임/Core/테스트를실행하지않았다. main편집/새PNG/원화생성도0이다. 직접본파일SHA/실제크기·미검토목록은 records/direct-image-review.json,선택81개상태와sourceHash는 synthetic-presentation-review.json에있다.

## 캡처에서 발견한 P2 6건

|항목|실제화면문제|구체후속/상태|
|---|---|---|
|HWB-01투구|FRONT는얼굴·목·어깨까지매우크고SIDE는비정상적으로기울어짐|brow→crown을neck→headtop에맞춘원인.4dir하단opening/hem a 재측정.부모적용보고/새화면미검토|
|HWB-02고글|머리보다3~4배넓게거대화|bridge→한렌즈반폭을전체폭으로쓴원인.실제수평좌우pair제안,부모적용중/새화면미검토|
|HWB-03마스크|천패널이세로마름모처럼회전해머리를덮음|중앙→위쪽의세로source축을수평face에맞춤.실제수평pair제안,부모적용중/새화면미검토|
|HWB-04허리띠|비스듬한큰띠가허리옆/등밖으로돌출|중앙→임의옆점으로확대/회전.실제좌→우bandpair제안,부모적용중/새화면미검토|
|HWB-05앞치마|긴앞판아래skirt가골반높이에서잘림|generic Pelvis band상한때문.앞치마만hem까지그리는Infinity분기,부모적용보고/새화면미검토|
|HWB-06관절의족Foot-only|금속발이정상sole선아래로가늘게내려감|cropped Foot원문의현재a→b축끝너머에실루엣이남음.수치전달/실제Native후속검토중|

이목록은**workbench-r3의동결화면결함**이다. 부모가이미수정했다고보고한항목을현재main에도미수정이라고중복주장하지않고,보정후화면은직접열지않았으므로시각수락으로바꾸지도않았다. P1은발견하지않았다.

## 즉시 제공한 정확 좌표

- `proposals/helmet-anchors.json`: a는FRONT/SIDE의실제하단opening외곽중앙column 마지막α>=128점, BACK은보이는rearhem proxy다. crop-local a/b는 DOWN[84,136]→[85,18],LEFT[95,133]→[88,13],RIGHT[88,136]→[85,14],UP[74,142]→[76,13]. 기존crown b는유지했다. 숨은physical neck축은null이다.
- `proposals/horizontal-accessories-all-directions.json`: 고글/마스크/띠의12pair 전부실제칠해진source좌→우/같은y/α>=200이다. raw/crop/불확실도±4px를기록했다. 뒤마스크의inner/reverse불명과뒷고글상부렌즈잔존은원래source제한그대로이며뒤head/strap-only가림을유지해야한다.
- 초기front-only제안은별도파일로보존했다. 어떤원문도재색칠·회전저장·mask삭제하지않았다.

## Foot-only 실루엣 문제의 근거

단순히전체원래의족을썼다고추측하지않았다. audit의실제frame은 `av389_articulated_foot_owned`이며손만Pioneer도 `av389_pioneer_hand_owned`를쓴다.

분석시점의관절발source a[313,43]→b[146.5,108.5]에대해α128픽셀의축투영t가최대1.755564(점[3,113])이고11300픽셀이b를넘는다. FRONT Footspan2.310195worldpx를맞추면실루엣이목표sole아래1.74550worldpx,4×에서약6.98px내려간다. 화면의금속발아래꼬리와일치한다. `records/articulated-foot-silhouette.json`에threshold16/128/200·원본SHA·정확crop·고정해둔분석앵커를남겼다. 부모가나중에sourcefit을바꾸어도이역사적측정은바뀌지않는다.

footProjection.error0은pin b까지만의일치다. 전체그림의지면접촉이나물리3D를증명하지않는다. source실제sole/ankle과표시축의의미를맞추고전체실루엣으로다시판정할필요가있다. 임의PNG삭제나미관측3D축은제안하지않았다.

## 나머지 직접관측

- Cuirass는실제Chest/Abdomen외골격판으로구별된다. 원래소매없는아이템의상완노출이나Pelvis미덮임을누락으로세지않았다.
- 일반Gloves/WoolGloves/Boots와Hook/Peg/Pioneer의검토된정지root그림에서새로운생체손·발복귀나괴기한전신크기P2를확정하지않았다. 이는그립/모든손가락·반대면완료증거가아니다.
- missing-hand는전완을남기고손을없앤다. half/undressing은부분소매/옷이표시되며Core장착·취소결과는실행하지않았다.
- Gardener의Y가지/두갈래는기존독자이식지형태다. 그형태만으로추가인간사지생성실패라고하지않았다.12root도같은한물체의공유이며12새해부원화가아니다.
- LEFT/RIGHT scout는후드가옆머리를덮고화살통이등쪽에붙는이전보정후보가눈으로확인된다. 합성화면이므로실제게임새whole-state수락은별도다.
- 어깨/소매/무릎접힘의cutout표현,같은재단을공유하는셔츠/외투/메일의재질차이는P3후속미술범위다.25독립원화모델완료로과장하지않는다.

원문의숨은뒤면/실제3D/전체gait/전25벌과모든prosthetic동작/배포수락은이검토의완료범위가아니다.
