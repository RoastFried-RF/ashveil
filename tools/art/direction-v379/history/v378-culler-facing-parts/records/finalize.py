from pathlib import Path
import json,hashlib
r=Path('/workspace/.ashveil-planned/v378-culler-facing-parts');review=json.loads((r/'parts-review.json').read_text());registration=json.loads((r/'joint-registration.json').read_text());budget=json.loads((r/'records/call-budget.json').read_text());refs=json.loads((r/'records/references.json').read_text());baseline=json.loads((r/'records/old-stages-baseline.json').read_text());alph=json.loads((r/'records/alpha-analysis.json').read_text())
assert budget['actualTotalCalls']==3 and all(v==1 for v in budget['actualCalls'].values()) and budget['actualAutomaticRegeneration']==0
changed=[p for p,h in baseline.items() if hashlib.sha256(Path(p).read_bytes()).hexdigest()!=h];assert not changed
hashes={};pins=[];regions=[]
for d,v in review['directions'].items():
 o=json.loads((r/f'records/{d.lower()}-tool-output.json').read_text());assert (r/v['sourcePng']).read_bytes()==Path(o['toolOriginalPath']).read_bytes();hashes[d]=v['sourceSHA256']
 for p in v['parts']:
  assert p['thresholds']['1']['mainComponentPixelsOutsideCrop']==0 and p['thresholds']['16']['mainComponentPixelsOutsideCrop']==0
  assert p['thresholds']['16']['foreignMajorComponentPixels']==p['thresholds']['16']['cropBorderAlphaPixels']==0
  assert not p['max55PercentCellMet'];regions.append(p['cropRgbaSHA256'])
 for p in registration['directions'][d]['parts'].values():
  pins += [q['alphaNeighborhoodSquareRadiusSourcePx']['12']['minAlpha'] for n,q in p['graphicPoints'].items() if 'Cap' in n]
assert len(set(regions))==18
visual={'scope':'source-only directional component review; no actual rig or game observation','allThreeOriginalPNGsDirectlyViewed':True,'canonicalAtlasAndFrontPartsDirectlyViewedAgain':True,'directlyOpenedDiagnostics':[f'diagnostics/first-markers/{d}-parts-light.png'for d in ('left','right','back')]+[f'diagnostics/{d}-parts-dark.png'for d in ('left','right','back')],'sourcePixelsUnchangedAcrossMarkerRefinement':True,'directionFindings':{'LEFT':{'chassis':'FRONT optical face points lower-left/left; longitudinal top plate train and one rear-screen-right mint tank match canonical row2; no drive strut/foot/blade baked into hull','links':'two filled bronze endcaps and steel side plates visible; cap/front-flank obliquity is compatible as side-link source, not measured real3D orientation','foot':'broad low pad with circular cap, but largely front/oblique three-lobe silhouette; LEFT toe/heel not established','blade':'proximal cap/forearm/blade continuous, full curved point; broad bright strip on convex screen-right face, true concave cutting edge unproven'},'RIGHT':{'chassis':'FRONT optical face points lower-right/right; one mint tank at rear-screen-left matches canonical row3; no long legs or tools baked into hull','links':'drive struts lean opposite source axis and cap visible face switches relative to LEFT; scythe upper source angle differs but same near-side cap character; actual physical side/owner unknown','foot':'low pad remains broadly front/oblique; clear RIGHT toe/heel not established','blade':'continuous cap/forearm/curved blade, different exposed cap face; sharp inner cutting edge and full actual side face unproven'},'BACK':{'chassis':'rear cooling grille nearest viewer, tank screen-left, front optical face hidden; matches canonical row1 poses0-2','links':'decorated circular caps still resemble generic side/front joint surfaces; no complete verified rear/inside/retainer geometry. Keep five appendage sources held for actual reverse-face review','foot':'small raised tab behind cap is visible, but true heel-to-viewer/toe-away ownership is not demonstrated','blade':'continuous root and reverse-looking cap flank, but same bright convex blade-face family. Actual reverse blade surface and inner edge remain unverified','hollowBodySockets':'near lower two black-centered rings look hollow; alpha253 opacity is not evidence of solid metal pins'}},'material':'worn grey steel, dull brass, mint tank identity coherent with own front source; raw tank has small red scratched/paint mark inherited from front study, no readable text or declared meaning','largeVisibleFogGroundShadowOnRgbaComparison':False,'strictFullPromptAccepted':False,'allPhysicalHipsShoulders3DAxesObserved':None,'newDirectionsGaitAccepted':False,'newScytheAttacksAccepted':False,'active':False,'releaseAccepted':False}
(r/'visual-review.json').write_text(json.dumps(visual,ensure_ascii=False,indent=2)+'\n')
contract={'format':1,'scope':'LEFT/RIGHT/BACK source-only6-component candidates per sheet; not runtime registration','sourcePNGs':{d:{'path':review['directions'][d]['sourcePng'],'sha256':hashes[d],'size':[1536,1024],'exactRequest':f'requests/culler-{d.lower()}-parts-v1.json','exactPrompt':f'requests/culler-{d.lower()}-parts-v1.prompt.txt','promptSha256':hashlib.sha256((r/f'requests/culler-{d.lower()}-parts-v1.prompt.txt').read_bytes()).hexdigest()}for d in hashes},'actualImagegenCalls':3,'perDirectionCalls':budget['actualCalls'],'actualAutomaticRegeneration':0,'newSourcePNGs':3,'newUniqueSourceRegions':18,'sourceAnimationFrames':0,'additionalReferencePNGs':2,'onlyConsistencyInputs':refs['referenceImages'],'sourceCropAlpha':'parts-review.json','sourceGraphicPinsAndNullPhysicalJoints':'joint-registration.json','heldFrameProposalOnly':'sprites.fragment.json','visualReview':'visual-review.json','candidateAndHeldBoundary':{'chassisThreeViews':'camera/tank/sensor-or-vent identity source candidates; no actual6-leg attachment tested','leftRightLinks':'visible endcap/source-axis geometric side-link candidates; physical orientation and exact limb owner not established','feetAllThree':'held for actual toe/heel direction and true ankle/sole plane review','backAppendagesAllFive':'held for true rear/inside surface verification; graphic cap coordinates remain observed but actual requested-direction joint role not proven','allThreeBlades':'continuous geometric candidates only; true concave inner cutting edge unproven','wholeDirectionalSixPartSetsAccepted':False},'registrationGuidance':['Use the exact source crops; no original PNG rasterization, masking, alpha removal, resampling, recolor or reflection performed.','All frame keys are held_av378_; no chars, anims or active registry entry is created.','A visible opaque graphic cap is a2D registration candidate, not a measured physical3D pin axis.','All6 physical hip and2physical shoulder observations are null; BACK far-side tool shoulder locations remain unobserved.','Foot chords use observed alpha16 lower-contour samples; their slope is not a verified ground plane.','Only two large scythe-upper endcaps are treated as geometric points; intermediate plates/fasteners do not prove another joint or a piston stroke.','Do not repair tank ownership by blindly flipping whole source; no display flip has been applied here.','If parent later instances one link across6legs/two tools, these remain6source regions per direction, not a new fullbody gait or attack frame bank.'],'observedAlpha':{'majorComponentsPerPNG':6,'mainSourcePixelsLostAcross18Crops':0,'foreignMajorComponentPixelsAcross18Crops':0,'alpha16CropBorderPixelsAcross18Crops':0,'mainCanvasClipping':0,'graphicMetalPins':len(pins),'minimumPinNeighborhoodRadius12Alpha':min(pins),'maximumPinNeighborhoodRadius12Alpha':max(pins),'oneBackAlpha16Residual':{'source':[858,651],'rgba':[70,57,43,17],'insideScytheUpperCrop':True,'preserved':True}},'failedOrHeldGenerationConditions':['All18 main regions exceed55percent of their512cell in at least one dimension; some hulls cross nominal cell boundaries. Actual crops retain separated complete main sources.','Strict alpha1-clean gutters not achieved: small original residues and canvas-edge alpha1 retained; per-source counts/borders remain in metadata.','All directional foot toe/heel and actual BACK appendage surfaces not established.','True sharp concave blade edge not established; no physical3D reconstruction.'],'unchangedOldFilesVerified':len(baseline),'oldFilesChanged':changed,'privateStaticPreviewSessions':2,'allPrivateBrowsersClosed':True,'httpServersStarted':0,'sourcePixelEdits':0,'actualMainRegistration':False,'newCharEntries':0,'newAnimEntries':0,'authoringPublisherCoreExistingStagesSharedBuildGameTestsCommitPushChanged':False,'active':False,'releaseAccepted':False,'sixLegGaitAccepted':False,'scytheAttackAccepted':False,'acidSprayAccepted':False,'captureNetAccepted':False,'physical3DSkeletonAccepted':False}
(r/'handoff-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n')
final={'format':1,'stage':'v378-culler-facing-parts','frozen':True,'imagegenCalls':3,'callsByDirection':budget['actualCalls'],'automaticRegeneration':0,'sourcePNGs':3,'uniqueRawRegions':18,'referencePNGs':2,'sourceSHA256':hashes,'sourcePixelEdits':0,'allSourceOriginalBytesEqual':True,'allThreeOriginalPNGsDirectlyViewed':True,'directComparisonSourceAndGraphicMarkersViewed':True,'candidate':'three directional hulls and geometric link sources, with directional feet/BACK surfaces/inner blade edge held','allPromptConditionsMet':False,'allSixDirectionalSourceSetsAccepted':False,'allPhysicalHipsShoulders3DAxesObserved':None,'newAuthoredWalkFrames':0,'newAuthoredAttackFrames':0,'actualRigAssemblyReviewed':False,'active':False,'releaseAccepted':False,'gaitAccepted':False,'attackAccepted':False,'acidNetAccepted':False,'physical3DSkeletonAccepted':False,'allPrivateBrowsersClosed':True,'httpServerStarted':False,'authoringPublisherCoreOldStagesRegistrySharedBuildGameTestsPushChanged':False}
(r/'art-final.json').write_text(json.dumps(final,ensure_ascii=False,indent=2)+'\n')
readme='''# v378 구제기 LEFT / RIGHT / BACK 분리 원화 — source-only 동결

자체 canonical idle-v2와 v373 FRONT parts 원문을 둘 다 다시 직접 열었고 이2원문만 일관성 입력으로 사용했다. 각방향 image_gen **정확1회**, 총3회/3PNG/18고유 source영역, 자동재생성0이다. 원문은 도구 출력 바이트 그대로 복사했고 추가편집/반전/재색칠/알파제거/리샘플/cropPNG 제작은0이다. 원문의 그림을 실제6족/2낫 gait나 새 공격프레임으로 세지 않는다.

| 방향 | 원문 | SHA-256 |
|---|---|---|
| LEFT | `originals/culler-left-parts-v1.png` | `85f4e077937684d7236ba4faca526f07bd6b261ac65fa36c7eb1097be15cbf8a` |
| RIGHT | `originals/culler-right-parts-v1.png` | `d2eec22ac3c089daf809a9f7388740f2dc4d784f321b5f1f6c3fb4fa5a13553a` |
| BACK | `originals/culler-back-parts-v1.png` | `cd9cd7084159d8c1da0d59b0e8e4216357e725106f25f52cd76a8186f001cfd9` |

세원문은 모두1536×1024 RGBA다. 도구 원본 경로·바이트 수·동일성은 `records/left|right|back-tool-output.json`, 정확 인수/프롬프트는 `requests/culler-방향-parts-v1.json`/`.prompt.txt`다. 입력 SHA는 canonical `51670a65d139794b3284da16556fbcc11f19434a57b81d5587cbebfed59b7662`, FRONT `6f30979dc5c4db6496c135718e84fa70eef52ebfc936af126a1b121471c6542a`이며참고복사본은 새원화로 세지 않는다.

## 직접 검토한 방향과 보류 경계

원문3개·각방향 canonical/front/새6부품 비교 진단을 직접 열었다. LEFT는 왼쪽 앞센서와 오른쪽 뒤쪽 민트탱크, RIGHT는 오른쪽 앞센서와 왼쪽 뒤쪽 탱크, BACK은 카메라쪽 rear vent와 화면왼쪽 탱크/가려진 front optics를 유지했다. 긴 drive strut/발판/낫이 hull에 baked되지 않았고 짧은 bearing block/boss만 남았다. 닫힌 등판/상자와 낡은 회색강철·황동·민트색의 정체성이 이어졌다.

**완전한 방향별6부품 수락은 false**다. 좌우 link는 서로 다른 캡 노출면/판 측면과 실제 보이는 두 큰 핀 중심을 가진 기하학 후보지만 실제3D방향/좌우 limb소유를 증명하지 않는다. 세발판은 낮고 넓은 지지판으로 읽히나 여전히 정면/사선형3엽 실루엣이고 requested toe/heel방향이 확정되지 않았다. BACK의 다리·낫5부품은 장식된 원형 cap이 일반 정면/측면과 비슷해 **진짜 rear/inside/retainer면을 확증하지 못했으므로 보류**다. BACK 몸체를 검토했다는 사실로 나머지 부품까지 뒷면 완성으로 세지 않는다.

세 낫은 근위 cap→짧은 forearm→곡선날→끝이 연결된 원문이다. 밝은 넓은 bevel이 여전히 화면오른쪽 볼록면을 따라 안쪽 오목한 진짜 절삭날은 미확정이다. 날기부/끝 좌표는 기하학 관측이며 실제공격·휴대안전·역면 승인이 아니다. 낫upper의 중간판/fastener도 보이나 큰 끝cap2개 외 추가 진짜 관절/피스톤 stroke를 단정하지 않았다.

BACK 차체 아랫쪽 두 black-centered ring은 속이 빈 socket처럼 보인다. 알파가 높아도 금속핀이 실재한다는 뜻이 아니므로 solid-metal pin으로 등록하지 않았다. 모든 physical DriveLeg1~6 hip·양tool shoulder·3D축은 null이다. 원문cap을 보여 준 것과 가려진 pivot을 측정한 것은 다르다.

## 정확 크롭

각시트3열×2행 순서, source x/y/width/height이며 오른쪽·아래는 배타적이다. `sprites.fragment.json`의18키는 모두 `held_av378_…` 제안이고 실제 registry/캐릭터/애니메이션은0이다.

| 부품 | LEFT | RIGHT | BACK |
|---|---|---|---|
| chassis | `[113,139,489,345]` | `[84,109,495,390]` | `[107,77,391,395]` |
| drive upper | `[716,175,252,322]` | `[731,155,265,348]` | `[701,148,231,321]` |
| drive lower | `[1146,91,251,424]` | `[1179,107,283,413]` | `[1212,88,234,402]` |
| flat foot | `[157,714,345,219]` | `[146,702,359,244]` | `[139,698,329,221]` |
| scythe upper | `[681,555,271,395]` | `[685,569,266,383]` | `[721,571,231,362]` |
| scythe lower/blade | `[1176,555,271,421]` | `[1195,570,281,407]` | `[1194,539,260,427]` |

`joint-registration.json`에 각원문cap/발하단/날끝의 source·crop·정규화 좌표/수동오차/주변알파/2D source축과 physical null을 분리했다. 원문에 보이는 graphic pin24개는 radius12 square 최저알파249~253이며 소스각도 그대로다. 실제3D힌지라고 확정하지 않는다. source2D축 길이가 방향마다 다르다는 것은 실제bone길이가 다르다는 증거가 아니다.

발 ankle은 LEFT[325,794],RIGHT[296,784],BACK[304,787]다. 읽기 분석한 alpha16하단윤곽 chord는 LEFT[244,908]→[376,923],RIGHT[242,926]→[384,932],BACK[231,902]→[376,901]이며 각 midpoint와ankle offset이 JSON에 있다. 기울어진 윤곽을 가짜 수평선으로 바꾸지 않았고 실제발바닥/지면/접지승인은 null/false다. 날끝은 alpha128윤곽 표본 LEFT[1295,966],RIGHT[1346,963],BACK[1318,959]이며 sharpedge판정과 구분한다.

## 알파·분리·실패 조건

18영역 모두 주요그림 손실0/이웃 major성분혼입0/alpha16크롭경계0이며 실제몸/끝/발 잘림0이다. 각PNG 큰 연결 성분은6개다. BACK의 전체alpha16성분은7개로 `[858,651] RGBA[70,57,43,17]`의 고립1픽셀이 scytheUpper crop안에 남아 있다. 이를 숨기거나 지우지 않았다. 그외 alpha16크롭바깥 잔점은0이다.

| 원문 | alpha1 주요성분밖 잔점 | crop밖 잔점 | whole-canvas alpha1경계 | alpha16잔점 |
|---|---:|---:|---:|---:|
| LEFT |11513 (최대alpha2)|9453|70|0|
| RIGHT |5892 (최대alpha3)|4985|21|0|
| BACK |3011 (최대alpha3)|2668|22|1 (alpha17, crop안)|

alpha1크롭경계는 순서대로 LEFT66/1/2/0/9/7,RIGHT5/22/10/0/0/0,BACK12/0/2/2/4/2다. 낮은 알파를 그대로 보존했으므로 strict alpha1-clean 수락false다. 흰바탕/어두운실제RGBA비교에서 큰 갈색안개/바닥그림자는 보이지 않았다. 불투명 RGB 미리보기만으로 배경제거를 하지 않았다.

**각셀≤55% 조건은18부품 모두 적어도 한축에서 미달**이다. 일부hull은 명목512cell 경계도 넘지만 실제다른파트와 겹치지 않는 위의 크롭은 확보했다. 이조건미달을 축소로 숨기거나 bodyclip과 혼동하지 않는다. 넓이비율/nominal-cell밖pixel/cropRGBA SHA/alpha1·16수치는 `parts-review.json`,전체수치는 `records/alpha-analysis.json`에 남겼다. 예산3콜을 소진했으며 자동재생성0을 지켰다.

## 파일·보존·실행 범위

`handoff-contract.json`이 부모 source-only 접점이고 실제통합은 부모 검토후 별도다. canonical해당방향은 raw LEFT=row2/RIGHT=row3/BACK=row1 poses0~2를 사용했고 wrong-side BACK3는 기준으로 쓰지 않았다. 진단의 첫 수동표식은 `records/first-markers.json`, `diagnostics/first-markers/`에 보존했다. 발하단/날끝 읽기분석과body보스중심을 세밀화한 최종수동점은 `records/manual-graphic-points.json`,최종dark/light비교는 `diagnostics/`다. 모든 진단PNG/HTML/SVG표식은 배포 source아트가 아니다.

Pillow/NumPy/SciPy는 읽기전용 분석에만 사용했다. 사적 static페이지 두세션은 finally로브라우저를닫았고 HTTP서버는 시작하지 않았다. authoring/publisher/Core/기존staging/등록/공유빌드/게임/테스트/commit/push 변경0이다. canonical+v373+v377 기존106파일SHA 불변을 확인했다. 새3방향이라고6족/낫gait·산·포획망·완성3D를 수락하지 않는다. `active/release/gait/attack/physical3D` 승인은 false다. `artifact-sha256.json`은 자기자신을제외한 동결파일해시다.
'''
(r/'README.md').write_text(readme)
(r/'records/final-checks.json').write_text(json.dumps({'allThreeToolOriginalsByteEqual':True,'allEighteenUniqueCropRgbaHashes':True,'allEighteenMainComponentsFullyContainedAtAlpha1And16':True,'foreignMajorComponentPixels':0,'alpha16CropBorderPixels':0,'oldFilesVerified':len(baseline),'oldFilesChanged':changed,'actualImagegenCalls':3,'automaticRegeneration':0,'graphicPinsRadius12MinimumAlpha':min(pins),'graphicPinsRadius12MaximumAlpha':max(pins),'allStageJsonParsed':True,'noMainGameBuildTestOrRegistrationExecuted':True,'staticPreviewSessions':2,'allPrivateBrowsersClosed':True,'httpServersStarted':0},indent=2)+'\n')
for p in r.rglob('*.json'):json.loads(p.read_text())
files={str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(r.rglob('*')) if p.is_file() and p.name!='artifact-sha256.json'}
(r/'artifact-sha256.json').write_text(json.dumps({'algorithm':'sha256','scope':'all frozen files except this manifest','files':files},indent=2)+'\n')
print(json.dumps({'root':str(r),'frozenFileCountExceptManifest':len(files),'sourceSHA256':hashes,'oldFilesUnchanged':len(baseline),'pinsRadius12MinMax':[min(pins),max(pins)],'metadataSHA256':{k:files[k] for k in ('art-final.json','handoff-contract.json','joint-registration.json','parts-review.json','sprites.fragment.json','README.md')}},indent=2))
