# v389 Foot-only 실제게임 r7 후속 시각리뷰

**LeftFoot/RightFoot×DOWN/LEFT/RIGHT/UP의실제body PNG8장과matching presentation8개를직접확인했다. 새P1/P2는발견하지않았으며,이전HWB-06의길게매달린금속꼬리는8장모두에서보이지않는다.** 그림크기는작은평발판으로읽히고,정강이끝과발목영역사이에눈에띄는열린틈도없다.

이것은부모의불변본 `/workspace/.ashveil-checkpoints/v389-human-final-r2`를사용한실제게임정지화면이다. 부모audit의독립Corewhole-Node8쌍/errors[]와이직접시각리뷰를분리한다. 이담당자는Core/브라우저/게임/테스트를재실행하지않았고,원문·main·불변본수정과생성·새PNG도0이다.

## 실루엣과 접합

기존대각ankle→mean-sole축을수직Footbone에강제로맞추는회전을중단했다. 현재원문은 uniform0.013/rotation0이며,source b[146.5,139]의가상지지선에맞춘다. source a[313,43]을같은matrix로변환한발목오프셋을정강이끝에도사용한다. 이는그림이이어지는2D계약이며실측3D발목축이아니다.

직접연8화면에서크게늘어진발판·바닥아래여러픽셀꼬리·끊어진정강이/발접합은보이지않는다. source/renderer검토도이관측과맞는다. 기존원문 SHA **64b83b162a71bbc6cc56331a057e7f79b70379d694a420eb1bfc5f81a8294b46**는그대로이며 `av389_articulated_foot_owned`는그원문의[156,684,360,141]하위영역이다.

α128/200의최하단source row index는139로,139보다아래row의해당픽셀은0이다. 하지만α1/16은row140에각각33/19픽셀이남아있다. 이잔상index오프셋은0.013worldpx이고픽셀행의하단edge까지포함하면최대0.026worldpx,현재3×화면에서0.078px다. 따라서**α1-clean이나완전삭제를주장하지않고**,기존1.7455worldpx의보이는돌출과분리한다. 수치는source좌표관례이며실제물리지면충돌검사가아니다.

## 범위와 한계

- 8장을보았어도**단일기존사선원문의2D이동/균등배율/명시반전**이다.새4방향발원화·새뒤면·실제3D골격/균형을만들었다고세지않는다.
- LEFT는두owner모두원래view,RIGHT는두owner모두mirror,DOWN/UP은Rightowner만mirror다. 반전은새원화가아니다.
- 모든캡처는idle이다.연속보행미끄럼·공격/넘어짐전환·다른의수족과설치root·전체인간착용미술수락은이번증거범위밖이다.
- 원래r3/r4실패·검토기록은수정하지않았다.이보고서가HWB-06의현재관측후속이며,과거pin-error0를실루엣수락으로다시해석하지않는다.

직접연8파일/SHA/8presentation과부모Core검사구분은review.json,불변본sourceSHA는source-evidence.json,source알파/가상지지선분석은source-fit-review.json에있다.
