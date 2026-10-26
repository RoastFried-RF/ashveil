# v389 착용 torso panel 원문 handoff

승인된 image_gen **정확1call/1PNG**, 추가호출·자동재생성0이다. 자체 v381 중립몸체와 v320 자체 장비 atlas를 직접 본 뒤 참고로 사용했다. 새 그림은 피부·사지·착용자 없는 의복 물체16개다. 메인·등록·Core·브라우저·게임·빌드·테스트 수정/실행0이다. 부모가 raw를 직접 열어 **source 후보16개**를 수락했으며 실제 착용fit/동작/출시 수락과 분리했다.

원문: `originals/torso-panels-v1.png`, **1254×1254 RGBA,1781139bytes**, SHA256 **c4dd3df2d50e64289aa14f2da06791a29154d9e195343afb3fb35496a86b0621**. 도구 원문은 `/workspace/generated_images/exec-667d5c15-478f-4bcc-9c37-b490bca841e7.png`에 그대로 있다. 요청의 선호2048×2048은 실현되지 않았다. 정확prompt/request·tool output_hint·참고원문/SHA·조건실패를 보존했다.

- 행은 실제 FRONT/down, VIEWER-LEFT/left, VIEWER-RIGHT/right, BACK/up이다. 앞여밈/옆으로향한앞가장자리/뒤솔기·닫힌후드가 구분된다.
- 열은 rag_shirt_torso, leather_coat_body, iron_mail_torso, hood_shell이다. sourceID는 `av389_worn_{kind}_{facing}`이다.
- 셔츠·코트·메일은 **몸판만**이며 양상완·전완 소매는 없다. 코트 하단과벨트는 그코트의소스특징이고 별도 Item.LeatherBelt/보관기능을뜻하지않는다. 후드는얼굴없는shell/cowl이다.
- 셔츠/메일 arm·neck 및후드 face내부는 실제불투명안감이다.37표식이모두α>=200이고투명표식0이다. **투명aperture요청은불충족**이며그림을지워구멍을만들지않았다. 부모는실제목·팔·머리뒤안감/실제얼굴local-pass로가림을검토할예정이다. back후드 facecontour는null이다.

## 바로 소비할 좌표

`contracts/garment-landmarks.json`은16원문별 exactcrop/관측방향, raw/crop/normalized/RGBA의 collar·shoulder·armhole·hem·코트belt waist를제공한다. 수동graphic점85개,불확실도±8rawpx다. profile far표식과3D축은null이다. 이것은정확히선택한source좌표이며그feature가정확한해부관절이라는뜻이아니다. 후드3면 inner dark-lining contour도수동근사치이며 alpha구멍/PNG삭제mask가아니다.

`contracts/uniform-registration-candidates.json`에는v381목/허리그래픽기준을이용한12개몸판의uniform similarity제안을보존했다. 셔츠/메일은hem을waist높이에대응시키고, 코트는실제belt를waist에맞춘다. 원문을raw base affine에합성할수있으나실제fit은미수락이다. 독립armhole graphic잔차는최소3.01~최대20.23raw body px이며물리관절오차가아니다. 후드는정확한body/head가림검토가필요해자동matrix수락을제공하지않았다.

`contracts/sprites.fragment.json`은1sheet/16frame의**제안**이며main에등록하지않았다. `source-layout.json`은crop만필요한소비자를위한같은16영역이다. 재사용/반전0, 새캐릭터0, 애니메이션프레임0이다.

## 알파·분리와 남은 한계

α16은22성분으로16주요물체+6작은잔상7픽셀(maxα20)이다. 제안crop의주요물체손실0/다른주요물체혼입0이다. 작은α16잔상7픽셀과crop밖α1잔상2038픽셀(maxα2),canvasα1edge3은그대로남겼다. α16edge0이다. 원문이α1-clean하다고주장하지않는다.

원래4×4명목셀높이는313.5px이며실제물체높이비율은0.756~0.871이다. 일부물체가명목행경계를넘지만실제crop끼리주요혼입은없다. 넓은여백55%나2048크기성공을꾸미지않았다. 생성원문을지우거나리샘플·재색칠·mask PNG로보정하지않았다.

16물체는4벌의전체착용/25apparel전체/사지·장화·장갑/보행·공격·양손/전인간형원화완료가아니다. 기존v382/v384/v332의보류기록도그대로다. 부모가실제중립몸체와가림·동작·UID·결손소유를검토해해당부품만활성여부를결정한다.
