# face-mounts-r1 기본32장 최종 읽기전용 리뷰

담당PNG **32장을모두직접열었다**: wanderer4방향×고글/마스크/both12장, worker/healer/trader/guard/reaver4방향×마스크20장이다. 다른담당자의고글/both40장은이리뷰에서보았다고세지않는다. 부모audit의72DOM기록/errors[]와직접32PNG를구분한다.

**이32장에서새P1/P2는발견하지않았다.** 이전고글의눈앞·위띄움은wandererFRONT/LEFT/RIGHT의고글단독과both에서보이지않는다. 렌즈는실제눈높이에붙고,마스크는입과아래얼굴에놓인다. 동시에쓰는경우에도기형적인회전/거대화/서로뒤엉킴이보이지않는다. 다른5역할의20마스크도각머리의입·아래얼굴에맞으며눈위로올라가얼굴전체를가리는문제는보이지않는다.

## 가림·소유 확인

LEFT/RIGHT고글metadata는현재불변본의near-side규칙과같이각각LeftEye/RightEye를가리킨다. arms/legs와같은near-side규칙을쓴다는코드도읽었다. 이것은현재정지화면의표시소유검토이며눈결손/수술의실제Core분기검증으로쓰지않는다.

보이는눈/입의27개source mount와headgraphic landmark는관찰JSON에서최대4.44e-16world차이다. **이수치만으로수락한것이아니며실제32PNG를모두보고얼굴가림·크기·방향을함께판정했다.**

UP에서는얼굴·렌즈가머리뒤로뚫고나오는현상이보이지않는다. 숨은눈/입landmark는null이며,고글은rearstrapproxy/strap-only가림,마스크는뒤head가림문맥이다. 원문maskreverse미증명·원래rear고글의상부렌즈그림존재를지우거나새뒤면원화가생겼다고하지않는다.

## 증거와 한계

사용불변본은 `/workspace/.ashveil-checkpoints/v389-face-final-r6`다.32파일SHA/관찰상태/sourceHash/소유와pin기록은baseline32-report.json,불변본source파일/원문PNG해시는baseline32-source-evidence.json에있다. immutable renderer SHA가모든32audit의exportedRenderer값과같음을읽기전용으로확인했다.

워크벤치는같은HumanView를쓰지만합성surface/UID이며CoreWorld를만들지않는다. 실제게임whole-state·연속보행/공격/넘어짐가림·31모델/의복25벌·전체의수족·실제3D·숨은반대면원화완료를증명하지않는다. 이번main/product/원문수정·브라우저·게임·테스트·새PNG·생성은0이다. baseline32-*파일만작성해다른담당자의기록은덮어쓰지않았다.
