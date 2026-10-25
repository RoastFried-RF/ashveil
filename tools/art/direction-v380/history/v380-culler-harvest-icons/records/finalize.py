from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
r=Path('/workspace/.ashveil-planned/v380-culler-harvest-icons');d=json.loads((r/'icons-review.json').read_text());meta=json.loads((r/'records/tool-output.json').read_text());rgba=np.asarray(Image.open(r/'originals/culler-harvest-icons-v1.png'));sha=meta['sourceSha256'];icons={q['itemId']:q for q in d['icons']};baseline=json.loads((r/'records/old-stages-baseline.json').read_text());changed=[p for p,h in baseline.items() if hashlib.sha256(Path(p).read_bytes()).hexdigest()!=h];assert not changed
assert (r/'originals/culler-harvest-icons-v1.png').read_bytes()==Path(meta['toolOriginalPath']).read_bytes();assert len(set(q['cropRgbaSHA256'] for q in d['icons']))==6
for q in d['icons']:
 assert q['thresholds']['16']['mainComponentPixelsOmittedByCrop']==q['thresholds']['16']['cropBorderAlphaPixels']==0
 assert q['thresholds']['1']['foreignOtherIconMainComponentPixels']==0
points={'Item.CullerScytheBlade':{'mountingEyeGraphicCenter':([466,226],'observed dark mounting eye, NOT a solid metal pin'),'lowerHookPointCandidate':([270,480],'visible alloy hook contour, not a measured3D cutting edge')},'Item.CullerHeart':{'leftTerminalGraphicCenter':([755,110],'visible terminal surface/cavity, electrical polarity unknown'),'rightTerminalGraphicCenter':([825,120],'visible terminal surface/cavity, electrical polarity unknown')},'Item.CullerPurifierTank':{'topCapGraphicCenter':([843,610],'top fitting/cap appearance only'),'leftPortGraphicCenter':([583,831],'fitting appearance; open-looking mouth, contents and seal unknown')},'Item.CullerGlaive':{'buttGraphicCenter':([1054,960],'visible shaft butt cap'),'bladeMountingEyeGraphicCenter':([1354,577],'dark head mounting eye, not a solid pin'),'shaftSocketCandidate':([1310,660],'manual junction of shaft and head collar'),'hookTipAlpha128':([1415,677],'alpha128 lower blade-head contour sample in x>=1380 head region'),'visibleLeatherWrapCenter':([1201,787],'one prominent wrap visibly present'),'proposedMainGripZone':([1158,844],'PROPOSED bare-shaft hand zone, no hand pose authored'),'proposedOffGripZone':([1259,724],'PROPOSED bare-shaft hand zone, no hand pose authored')}}
landmarks={}
for item,rows in points.items():
 icon=icons[item];x,y,w,h=icon['crop'];values={}
 for name,(pos,note)in rows.items():
  px,py=pos;values[name]={'source':pos,'crop':[px-x,py-y],'normalizedCrop':[round((px-x)/w,8),round((py-y)/h,8)],'sourceRGBA':list(map(int,rgba[py,px])),'kind':note,'manualUncertaintySourcePx':12 if name.startswith('proposed') else 6,'actualPhysical3DAxisObserved':None,'actualRuntimeBindingApproved':False}
 landmarks[item]={'frameKey':icon['iconKey'],'sourceGraphicPoints':values,'inventoryOnly':True,'worldHeldPoseAuthored':False,'physicalDimensionsObserved':None}
(r/'landmarks-and-grips.json').write_text(json.dumps({'sourceSHA256':sha,'coordinateConvention':'source x/y and crop-local x/y; source points are graphical/manual candidates only','items':landmarks,'glaiveTwoHandRuntimePoseApproved':False,'twoSeparatedLeatherGripBandsClearlyObserved':False,'sameBladeFamilyVisualCandidate':True,'identicalLooseAndMountedBladeGeometryProven':False},ensure_ascii=False,indent=2)+'\n')
visual={'sourceOriginalDirectlyViewed':True,'ownReferencesDirectlyViewedBeforeGeneration':True,'privateNative24DarkLightCheckerDirectlyViewed':True,'privateNative32DirectlyViewed':True,'nearest24DiagnosticMagnificationDirectlyViewed':True,'directlyOpenedDiagnostics':['diagnostics/six-icons-24px-and-source-review.png','diagnostics/native24-dark-strip.png'],'findings':{'Item.CullerScytheBlade':'Compact grey hooked/crescent alloy cutting part with reinforced root hardware, no long shaft/whole upper arm; distinct from long glaive at24px. Small root details reduce to a bronze cluster.','Item.CullerHeart':'Squat green/brass block/spool with two raised terminals and vent bands; distinct from pale horizontal oval tank. Advanced function/power charge is contextual, not encoded by icon.','Item.CullerArmorPlate':'Thick rectangular layered steel slab with bolts; grey layered silhouette distinct from net. Fine layer count/thickness not reliable at24px.','Item.CullerNetFiber':'Folded bundle with large crossing strands and open-looking diamond weave; coarse grid survives24px. Individual thread/layer/material properties are not literal counts.','Item.CullerPurifierTank':'Pale mint oval/capsule reservoir, brass bands/top cap/left connector. Distinct shape/color from squat dark core. One open-looking fitting means sealed/filled acid state cannot be inferred.','Item.CullerGlaive':'Full long diagonal shaft with a matching hooked alloy head, no floating blade. The long shaft distinguishes it from loose blade at24px but dark wood is thin on dark UI and separate two-hand grip details collapse. One prominent leather wrap and neck bindings are visible; two explicit separate leather grips are not established.'},'largeVisibleFogOrGroundShadowOnRgbaDisplay':False,'sixInventorySilhouettesDistinguishableAt24Candidate':True,'notStrictIndexedPaletteOrHandPixelGrid':True,'noLiteralPowerAcidWeightMeshQuantityEncoded':True,'noActualItemStatsRecipesOrGameReviewed':True,'heldWeaponMotionApproved':False,'fullPromptPassed':False,'releaseAccepted':False}
(r/'visual-review.json').write_text(json.dumps(visual,ensure_ascii=False,indent=2)+'\n')
browser=json.loads((r/'diagnostics/browser-observation.json').read_text());browser['actualNative24DomReviewed']=True;browser['directlyOpenedDiagnosticFiles']=visual['directlyOpenedDiagnostics'];(r/'diagnostics/browser-observation.json').write_text(json.dumps(browser,indent=2)+'\n')
contract={'format':1,'scope':'staging-only original Culler six inventory icons; parent maps actual Item stats/recipes/registration','sourcePng':'originals/culler-harvest-icons-v1.png','sourceSHA256':sha,'actualOutputSize':meta['actualOutputSize'],'actualOriginalByteCount':meta['originalByteCount'],'exactRequest':'requests/culler-harvest-icons-v1.json','exactPrompt':'requests/exact-prompt.txt','promptSHA256':'de620874273ecd865c16d3f24cde784dad3b49e3d8e6a8b5e6da713a70c2e33b','toolResponseMetadata':'records/tool-response-metadata.json','toolOriginalPath':meta['toolOriginalPath'],'originalToolBytesEqual':True,'actualImagegenCalls':1,'actualSourcePNGs':1,'uniqueSourceRegions':6,'automaticRegeneration':0,'additionalReferenceCopies':2,'onlyConsistencyReferences':'records/references.json','itemFrameMapping':json.loads((r/'item-icon-proposals.json').read_text())['items'],'sourceFramesProposal':'sprites.fragment.json','cropAlphaRegionSHA':'icons-review.json','relevantGraphicEyeFittingAndGripCandidates':'landmarks-and-grips.json','private24pxEvidence':'visual-review.json + diagnostics/','noManufacturedOutputDimensions':True,'no55PercentCriterionRequestedOrClaimed':True,'alphaSummary':{'highAlphaMainLoss':0,'foreignOtherIconMainMixAtAlpha1And16':0,'alpha16CropBorderPixels':0,'mainCanvasClipping':0,'lowAlphaMainFringeOmittedByFrameRects':{'armor':{'pixels':250,'maximumAlpha':2},'glaive':{'pixels':336,'maximumAlpha':2},'others':0,'sourcePNGUnmodified':True},'lowAlphaResidueOutsideSixIconMainComponents':16039,'maximumLowResidueAlpha':3,'nonzeroPixelsOutsideSixFrameRects':9263,'canvasAlpha1EdgePixels':124,'alpha16ResidualPixels':[{'source':[1355,648],'rgba':[49,37,25,16]},{'source':[53,721],'rgba':[53,41,29,17]}],'alpha16ResidualOutsideFrames':0,'strictAllAlphaGuttersZero':False},'failedOrIncompleteRequestCriteria':['Wide fully alpha-zero gutter is not achieved: armor/glaive alpha1 main bboxes overlap5rows. Selected frame rectangles omit only measuredalpha1-2fringe, retain every alpha16 main pixel, and mix no other icon main pixels. Whole original bytes retained.','Two separate leather grip areas on glaive are not clearly established; one prominent wrap plus neck binding are visible. Two-hand in-game placement needs parent runtime review.','Tank side connector looks open; sealed/filled acid state is unverified. Art does not encode actual capacity or contents.','Source has fine material detail and many shades; no strict indexed palette/hand-pixel grid proof. Native24 keeps silhouettes but thin shaft and fine machine details reduce.'],'bindingLimits':['Inventory frame keys are suggestions only; Item ids are exactly parent-requested ids and no resolved Def was changed.','No actual harvest/drop/craft/food/armor/weapon behavior or stats were implemented/validated here.','Loose blade and polearm head share a visual alloy/hook family, not a proven identical physical part model.','Graphic mounting eyes contain dark hole interiors; alpha opacity is not evidence of solid metal pin or a true3D axis.','Proposed two-hand shaft zones lie on visible source pixels, not authored hand poses or accepted held-motion anchors.','Diagnostic canvas/UI screenshots are not generated source sprites and must not be registered as art.'],'oldFilesVerified':len(baseline),'oldFilesChanged':changed,'privateBrowserClosed':True,'httpServerStarted':False,'sourcePixelEdits':0,'sourceReencodings':0,'newCharEntries':0,'newAnimEntries':0,'actualMainRegistration':False,'authoringSpritesDocsCoreContentBuildGameTestsPushChanged':False,'active':False,'releaseAccepted':False}
(r/'handoff-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n')
final={'format':1,'stage':'v380-culler-harvest-icons','frozen':True,'sourceSHA256':sha,'actualOutputSize':meta['actualOutputSize'],'sourceOriginalByteCount':meta['originalByteCount'],'actualImagegenCalls':1,'originalPNGs':1,'uniqueSourceRegions':6,'automaticRegeneration':0,'sourcePixelEdits':0,'originalToolBytesEqual':True,'sourceAndPrivate24And32DisplayDirectlyViewed':True,'silhouetteReadabilityCandidate':True,'strictPromptAllCriteriaPassed':False,'strictAlpha1CleanSource':False,'heldWeaponMotionAccepted':False,'actualItemStatsRecipesValidated':False,'mainRegistrationCompleted':False,'active':False,'releaseAccepted':False,'oldFilesVerifiedUnchanged':len(baseline),'privateBrowserClosed':True,'httpServerStarted':False,'mainAuthoringSpritesDocsCoreContentBuildGameTestsPushChanged':False}
(r/'art-final.json').write_text(json.dumps(final,ensure_ascii=False,indent=2)+'\n')
readme='''# v380 구제기 회수품·장병기 아이콘 — source-only 동결

자체 v376 inventory와 v378 LEFT Culler 원문을 먼저 직접 열고 이2개만 일관성 입력으로 사용했다. image_gen **정확1회/원문PNG1개/고유6영역/자동재생성0**이다. 타 게임 에셋·원문픽셀편집·재색칠·반전·마스크·알파제거·리샘플·파생cropPNG 제작은0이다. 실제Item/Core/콘텐츠/레시피/등록/공유빌드/게임/테스트/push는 부모 담당이고 여기서 변경하지 않았다.

원문 `originals/culler-harvest-icons-v1.png`의 실제 출력은1536×1024 RGBA,2,365,557bytes다.

`SHA-256: b389c1be22914533bff7536ae62b2c1604ca407e879a19494721e703a3f1452d`

도구 원문 `/workspace/generated_images/exec-21ff3b8d-c709-407d-b6aa-710c4516cb65.png`와 보존본은 바이트가 같다. 실제폭/높이는PNG를 읽어 기록했다. 프롬프트는 `requests/exact-prompt.txt`, 정확 인수는 `requests/culler-harvest-icons-v1.json`, 도구응답키/정확output_hint와 원본바이트대응은 `records/tool-response-metadata.json`에 보존했다. Base64를 메타데이터에 중복하지 않고 해당 원문PNG를 보존했다. prompt SHA는 `de620874273ecd865c16d3f24cde784dad3b49e3d8e6a8b5e6da713a70c2e33b`다.

## 물품과 정확 제안 크롭

키는 부모의Item ID를 그대로 대응한 frame이름 제안이다. main Def/registry는 변경하지 않았다. source x/y/width/height이며 오른쪽·아래는 배타적이다.

| 요청Item | 제안frame key | 정확crop |
|---|---|---|
| `Item.CullerScytheBlade` | `av380_culler_scythe_blade` | `[45,27,468,471]` |
| `Item.CullerHeart` | `av380_culler_heart` | `[575,77,403,395]` |
| `Item.CullerArmorPlate` | `av380_culler_armor_plate` | `[1053,41,452,449]` |
| `Item.CullerNetFiber` | `av380_culler_net_fiber` | `[29,551,489,433]` |
| `Item.CullerPurifierTank` | `av380_culler_purifier_tank` | `[539,570,491,348]` |
| `Item.CullerGlaive` | `av380_culler_glaive` | `[1030,498,495,487]` |

`sprites.fragment.json`은1sheet/실제size/6frames의 등록 **제안만**이다. 캐릭터0/애니메이션0이며 장병기 아이콘이 실제held-motion/양손포즈 완성은 아니다.

## 직접 본 원문과24px

원문과 `diagnostics/six-icons-24px-and-source-review.png`, `diagnostics/native24-dark-strip.png`를 직접 열었다. 사적인 DOM은contain/transform/overflow+pixelated 방식으로 native24/32를 검정·밝은색·체커 위에 표시했다.24px canvas×6는 읽기용 진단이며 원화가 아니다. 메인 소지품창/플레이를 본 증거로 쓰지 않는다.

분리낫날은 긴shaft 없이 큰 회색hook/뿌리기구가 있는 회수품으로, 장병기는 같은합금hook계열의 작은머리에 긴 갈색자루가 붙어 구별된다. 동력핵은 녹황동의 낮은 블록/스풀과 두터미널, 탱크는 밝은민트의 가로타원으로 나뉜다. 장갑판의 두껍고길쭉한금속겹과 망의 큰 교차격자는24px에서도 다르게 읽혔다.

장병기의 어두운shaft는24px에서 매우얇고 두손/목재세부가 줄어든다. 원문에는 눈에띄는 가죽wrap1개와 목부분binding이 보이며, 요청한 두개의명확히분리된가죽grip을 충족했다고 쓰지 않는다. 동력핵의 고급기능/전력량, 탱크의 산/내용량/밀봉 상태는 아이콘으로 확인할수없고 탱크의 한 fitting은 열린입구처럼 보인다. 망의thread/겹수·장갑의 실제두께도 literal수치가 아니다. 고해상도 원문에는 미세질감/여러명암이 있어 엄격한 indexedpalette나수작업pixelgrid를 제작했다고 주장하지 않는다.

## 알파·크롭과 실패 기준

실제 alpha16 주요그림6개는 모두 크롭안에 있고 본체손실0/다른icon main혼입0/alpha16crop경계0/실제캔버스 본체잘림0이다.6crop RGBA해시는 모두 다르다. 원문alpha16 전체성분은8개로 mesh[53,721] alpha17과 glaive[1355,648] alpha16 고립점2개가 각각crop안에 남아 있다.

완전히 넓은alpha0간격 조건은 충족하지 못했다. armor/glaive alpha1 main bbox가5행 겹치며 tank의 저alpha rightfringe도 인접한다. 다른아이콘의main pixel이 들어오지 않는 위의사각형을 정했고 **armor250px/glaive336px의 alpha1~2 fringe만 frame밖**으로 남겼다. 다른4개는 alpha1 main생략0이다. 원본전체PNG는 한픽셀도 바꾸지 않았으며 생략위치/최대알파/다른아이콘혼입과SHA는 `icons-review.json`에 명시했다. 이처럼 낮은alpha만croprect밖에 두는 것을 원본을 고쳤다고 기록하거나 strictalpha1완전보존이라고 주장하지 않는다.

원문전체 alpha0은950802px,alpha1~15는58117px,alpha16~250는49931px,alpha251이상은514014px,최대254다.6아이콘main밖 잔점16039px의 최대alpha3,6crop밖9263px,wholecanvas alpha1경계124px가 보존됐다. crop alpha1경계는순서대로11/18/95/56/21/114,alpha16경계는전부0이다. 실제RGBA의밝은/어두운배경 표시에서 큰색안개/바닥그림자는 보이지 않았으나 strict alpha1-clean은false다. 출력 크기나 셀점유 목표를 만들어성공이라고 세지 않았다.

## 기부·손잡이 후보와 부모접점

`landmarks-and-grips.json`은 분리날/장병기 mounting eye, terminal/fitting, shaft끝·socket·leatherwrap과 제안 main/offshaft zone을 source/crop/정규화 좌표로 남긴다. 장병기 후보 main[1158,844]/off[1259,724]는 실제shaft픽셀 위지만 손이그려진포즈도 실제양손리그수락도 아니다. 검은mounting eye는 속이빈구멍처럼 보이므로 opaquealpha만 보고solidmetalpin이라 하지 않는다. 실제3D축/기능은null이다. 느슨한날과 장병기머리는 같은재질/hook가족으로 읽히지만 정확히같은3D부품형상이라는 증거는 없다.

`handoff-contract.json`이 부모전달계약이다. 실제스탯/드롭/제작·재료소모/무기손/사거리/모션/게임표시는 부모가연결해야 한다. source-only의 `active/releaseAccepted/heldWeaponMotionAccepted`는false다. 실패기준을남기고추가생성하지 않았다.

자체브라우저는finally로종료했고HTTP서버는시작하지않았다. v376/v378기존77파일SHA불변을확인했다. 메인sprites/root/docs/Core/content/build/game/tests/push 변경0이다. `artifact-sha256.json`은자기자신을제외한동결파일해시다.
'''
(r/'README.md').write_text(readme)
(r/'records/final-checks.json').write_text(json.dumps({'originalToolBytesEqual':True,'uniqueRegionHashes':6,'highAlpha16MainLoss':0,'foreignOtherIconMainPixelsAlpha1And16':0,'alpha16CropBorderPixels':0,'alpha1To2FringeOmittedByFrames':{'armor':250,'glaive':336},'allOriginalPixelsPreservedInWholePNG':True,'actualImagegenCalls':1,'actualRegeneration':0,'sourceWidthHeightReadFromActualPNG':[int(rgba.shape[1]),int(rgba.shape[0])],'oldFilesVerified':len(baseline),'oldFilesChanged':changed,'privateBrowserClosed':True,'httpServerStarted':False,'noMainDefRegistrationBuildGameTestsPushExecuted':True},indent=2)+'\n')
for p in r.rglob('*.json'):json.loads(p.read_text())
files={str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(r.rglob('*'))if p.is_file()and p.name!='artifact-sha256.json'}
(r/'artifact-sha256.json').write_text(json.dumps({'algorithm':'sha256','scope':'all frozen files except this manifest','files':files},indent=2)+'\n')
print(json.dumps({'root':str(r),'frozenFilesExceptManifest':len(files),'sourceSHA256':sha,'oldFilesUnchanged':len(baseline),'metadataSHA256':{k:files[k]for k in ('art-final.json','handoff-contract.json','sprites.fragment.json','icons-review.json','landmarks-and-grips.json','README.md')}},indent=2))
