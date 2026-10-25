from pathlib import Path
import json,hashlib
r=Path('/workspace/.ashveil-planned/v377-culler-runtime');v2=json.loads((r/'diagnostics/v2/observation.json').read_text());ev=v2['events'];by={e['name']:e['state'] for e in ev};source=json.loads((r/'source-contract.json').read_text());baseline=json.loads((r/'records/v373-read-only-baseline.json').read_text())
changed=[p for p,h in baseline.items() if hashlib.sha256(Path(p).read_bytes()).hexdigest()!=h];assert not changed
assert hashlib.sha256((r/source['stagedByteCopy']).read_bytes()).hexdigest()==source['sourceSha256']
assert not v2['errors'] and len(ev)==60 and len(v2['shots'])==24
assert all(e['state']['display']['partInstances']==23 and e['state']['display']['sourceRegions']==6 and len(e['state']['display']['legOwners'])==6 and len(e['state']['display']['toolOwners'])==2 for e in ev)
metrics={'maximumPlanarReachErrorPixels':max(e['state']['metrics']['maxReachError'] for e in ev),'maximumFixedPlanarLengthErrorPixels':max(e['state']['metrics']['maxLengthError'] for e in ev),'maximumContinuousSameOwnerContactSlipPixels':max(e['state']['metrics']['maxContinuousContactSlip'] for e in ev),'maximumTransformedSourcePinArithmeticErrorPixels':max(e['state']['display']['maxPinMappingError'] for e in ev),'minimumProjectedSupportMarginPixels':min(e['state']['metrics']['minProjectedSupportMargin'] for e in ev)}
phaseOK={}
for side in ('right','left'):
 other='left' if side=='right' else 'right'
 phaseOK[side]={phase:by[f'{side}-{phase}']['phaseStates'][side]==phase and by[f'{side}-{phase}']['phaseStates'][other]=='guard' for phase in ('windup','contact','follow','recover')}
 assert all(phaseOK[side].values())
stopStates=['stop-settled','restart-settled',*[f'speed-{s}-settled' for s in (0.5,1,2)]]
assert all(s in by and by[s]['swing'] is None and all(l['contact'] for l in by[s]['pose']['legs']) for s in stopStates)
life={p.name:json.loads((p/'own-lifecycle.json').read_text()) for p in (r/'diagnostics').iterdir() if p.is_dir() and (p/'own-lifecycle.json').exists()}
assert all(v['httpServerClosed'] for v in life.values())
assert all(v['browserClosed'] for v in life.values())
opened_v2=['walk-chronology','death-procedural-lowering','right-windup','right-follow','right-recover','hurt-interrupt','right-contact','left-contact','walk-sequence-2','walk-sequence-5','walk-sequence-8','initial-clean-native1x','left-windup','left-follow','left-recover','stop-settled','zero-instant']
review={'kind':'isolated actual SVG DOM source-fragment runtime observation, not main game Native','implementationPasses':1,'actualCoreCorrectionPasses':1,'runtimeDOMObservationPasses':2,'bootstrapFailureBeforePageCreation':1,'additionalImagegenCalls':0,'finalObservedStates':60,'finalSVGSceneScreenshots':24,'finalPrivatePageErrors':v2['errors'],'measured':metrics,'actualDOMOwnership':{'partInstances':23,'sourceRegions':6,'legOwners':['RF','RM','RH','LF','LM','LH'],'toolOwners':['right','left'],'oldFourLegModuloReused':False},'coverage':{'uninterruptedDistanceWalk':True,'tripodA':['RF','LM','RH'],'tripodB':['LF','RM','LH'],'stopReturnsSixContacts':True,'restartObserved':True,'speedHalfOneTwoObserved':True,'zeroInstantMovementAndToolAndDeathObserved':True,'rightToolFourPhasesWithOtherGuarded':phaseOK['right'],'leftToolFourPhasesWithOtherGuarded':phaseOK['left'],'movingAttackWaitsForSixSupport':by['moving-attack-six-support-ready']['phaseStates']['right']=='windup' and all(l['contact'] for l in by['moving-attack-six-support-ready']['pose']['legs']),'cancelRecovers':by['cancel-guard-return']['phaseStates']['right']=='guard','hitInterruptsBothTools':all(v=='interruptedRecover' for v in by['hurt-interrupts-both']['phaseStates'].values()),'hitReturnsGuard':all(v=='guard' for v in by['hurt-recovered']['phaseStates'].values()),'deathDisablesMovementAndAttackButtons':all(v2['disabled'].values()),'deadKeyboardIgnored':by['dead-key-inputs-ignored']['distance']==0,'keyboardStepObserved':abs(by['actual-keyboard-step']['distance']-24)<1e-6},'directlyOpenedFinalPNGFiles':[f'diagnostics/v2/{n}.png' for n in opened_v2],'visualAssessment':{'neutral':'same front hull/sensor and asymmetrical viewer-right tank retained; six separate pad/link groups plus two independent blades visible','walk':'chronological captures show RF/LM/RH vs LF/RM/LH exchange lift/contact; planted pads remain with moving2D grid while hull follows root; direct individual frame2/5/8 checks preserve full silhouettes','pinCaps':'upper/lower and tool upper/blade meet at visible metal caps; source-axis rotations and uniform scales used, not stretched lower raster','deathCorrection':'v1 blades drooped below foreground feet; v2 twelve-pixel hull lowering and upward/inward stow keep tips above foreground pad line in2D. This is procedural deactivation, not authored death art or real3D collision','qualityLimit':'fixed front face and highlights rotate with links; three simultaneous feet and static hull still look like a mechanical 2D puppet. No global naturalness/release approval.'},'captureLimitations':[{'file':'diagnostics/v2/walk-chronology.png','issue':'static contact-sheet viewport clipped its third column on the right; preserve as held diagnostic layout. Individual walk-sequence2/5/8 were directly opened whole. Original source and actual SVG scene captures are not clipped.'},{'issue':'PNG capture spans RAF time. Named contact PNG was requested during late contact; its after-capture state can already be early follow. Before-capture event and after-capture shot states are both preserved; no frozen phase/world injection used.'},{'issue':'No video produced. Optional recordVideo failed before page creation because ffmpeg unavailable; actual uninterrupted DOM sequence is captured as PNGs.'}],'unreviewed':['source side/back/opposite/underside','real3D mechanics/gravity/collision/mass','sharp inner cutting edge','Core-selected attack/limb loss/body UID mapping','acid/net/chase/repair/target hit/game activation','direction turn/reverse/walls/FOV/save/map transfer/GPU texture lifetimes','death during every gait/attack interruption combination','complete release-quality motion'],'frontPlanarRuntimeCandidate':True,'semanticGaitApproval':False,'fullGameNativePassed':False,'physical3DSkeletonAccepted':False,'releaseAccepted':False}
(r/'runtime-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
contract={'format':1,'scope':'FRONT single-face dedicated6-drive+2-tool planar renderer prototype only','sourceSHA256':source['sourceSha256'],'sourceSize':source['sourceSize'],'sourceContracts':'source-contract.json','newImagegenCalls':0,'newSourcePNGs':0,'reusedSourcePNGs':1,'uniqueSourceRegions':6,'displayInstances':23,'code':['model.mjs','app.mjs','index.html'],'observationEntry':'observe.mjs','observedResult':'diagnostics/v2/observation.json','metrics':metrics,'limitedPlanarPrototypeCandidate':True,'calibration':{'bodySourcePivot':[325,300],'bodyScale':.18,'bodyDisplayOffset':[0,-45],'driveUpperPlanarLength':25,'driveLowerPlanarLength':27,'drivePhysical3DLengths':None,'footDisplayScale':.045,'footObservedSourceAnkle':[342,744],'footObservedSourceChord':[[257,880],[414,880]],'footDisplayAnkleToChordOffset':[-.2925,6.12],'allPhysicalHipsObserved':None,'allPhysicalToolShouldersObserved':None,'allPhysical3DAxesObserved':None,'contactMarginMeaning':'2D projected contact hull diagnostic only; not a real gravity support proof'},'gait':{'ids':['RF','RM','RH','LF','LM','LH'],'tripods':[['RF','LM','RH'],['LF','RM','LH']],'swingDistance':6,'forwardTargetFromSwingStartRoot':12,'prototypeRootSpeedPixelsPerLocalSecond':10,'liftDisplayPixels':2.5,'stopSettleLocalSeconds':.30,'stopSettleOnlyMovesRaisedTripod':True,'sameOwnerStanceFeetRemainAtWorldAnchor':True,'zeroMode':'explicit owner reset, instant12px single-step /6px continuous discrete movement; no claim of animated contact continuity across instant jumps'},'tools':{'independentIds':['right','left'],'rightToolProjects':'viewer-left','upperPlanarLength':18,'bladeSourceScale':.075,'leftToolExplicitFlipX':True,'sourceOppositeFaceAuthored':False,'phasesLocalSeconds':{'windup':.28,'contact':.12,'follow':.24,'recover':.36},'contact':'first.05s reach then hold; no hit/damage event','cancelAndHurtRecoverFromCurrentAnglesSeconds':.32,'attackWaitsForSixContactsAfterMove':True,'hurtSeconds':.30,'death':'procedural .65s body12px lower + folded tool angles[2.30,-1.05]; no authored corpse/true3D collision'},'integrationBoundaries':['Model root movement here is synthetic presentation driven by actual local UI, not Core TU. Parent must feed actual interpolated actor positions and derive traveled distance before production use.','Use dedicated6-leg ID ownership and two independent tool channels; do not place scythes in support legs.','Map actual Core body-part/attack IDs and damaged/removed limbs to source owners separately. Both prototype buttons are not evidence every Core arm has an available natural attack.','Only FRONT source face was authored. Do not create four directions by relabeling this single view.','All graphic hip/shoulder layouts are planar assumptions; physical source observations remain null.','Pixi integration / texture borrowing / FOV / map reset / save ownership remain parent work; this prototype uses SVG DOM.','Keep v373 source flags and original bytes unchanged; never register diagnostic screenshots as authored sprites.'],'failuresAndLimits':'runtime-review.json; diagnostics/v1/failure.json; diagnostics/v1-dom/failure.json; records/core-correction.json','allPrivateResourcesClosed':True,'mainAuthoringModified':False,'publisherModified':False,'coreSharedDistBuildTestGameCommitPushChanged':False,'active':False,'releaseAccepted':False,'physical3DSkeletonAccepted':False,'oppositeFaceAccepted':False,'sharpInnerCuttingEdgeAccepted':False,'acidNetChaseRepairCompleted':False}
(r/'runtime-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n')
(r/'records/source-preservation.json').write_text(json.dumps({'sourceSHA256':source['sourceSha256'],'originalByteCopyEqual':(r/source['stagedByteCopy']).read_bytes()==Path(source['sourceOriginalPath']).read_bytes(),'v373FilesVerified':len(baseline),'v373ChangedFiles':changed,'newImagegenCalls':0,'newSourcePixelEdits':0,'newSourcePNGs':0,'allWritesInsideStage':str(r),'authoringPublisherCoreSharedDistGameBuildTestsCommitPushChanged':False,'privateLifecycles':life},indent=2)+'\n')
(r/'art-final.json').write_text(json.dumps({'format':1,'stage':'v377-culler-runtime','frozen':True,'sourceSHA256':source['sourceSha256'],'newSourcePNGs':0,'newImagegenCalls':0,'sourceRegions':6,'displayInstances':23,'implementationPasses':1,'actualCoreCorrectionPasses':1,'runtimeDOMObservationPasses':2,'bootstrapFailureBeforePage':1,'finalObservedStates':60,'finalSceneScreenshots':24,'finalPageErrors':0,'frontPlanarPrototypeCandidate':True,'metrics':metrics,'semanticGaitApproval':False,'physical3DSkeletonAccepted':False,'oppositeFaceAccepted':False,'innerBladeAccepted':False,'mainGameNativeAccepted':False,'coreAcidNetChaseRepairCompleted':False,'active':False,'releaseAccepted':False,'allPrivateBrowsersAndServersClosed':True,'authoringPublisherCoreSharedDistBuildTestsGameCommitPushChanged':False},indent=2)+'\n')
readme='''# v377 구제기23부품 · 정면 제한2D 관절 시제품

v373 원문6부품을 읽고 전용6족 모델과 별도2낫을 실제 SVG DOM으로 연결했다. 새 image_gen0 / 새 원화PNG0 / 원문1PNG·6고유영역 / 표시23인스턴스다. 메인 authoring/publisher/Core/shared dist/등록/빌드/게임/전체검사/commit/push는 변경하거나 실행하지 않았다.

원문 SHA `6f30979dc5c4db6496c135718e84fa70eef52ebfc936af126a1b121471c6542a`. `references/culler-front-parts-v1.png`는 v373 원문과 바이트가 같은 읽기용 복사본이다. v373 기존30파일 SHA를 확인했고 변경0이다. 원문 핀·crop·alpha와 각 가정은 `source-contract.json`에 있다.

## 실제 조립과 거리 보행

`model.mjs`는 기존4족/%4 코드를 import하지 않는다. `RF/RM/RH/LF/LM/LH` 여섯 소유ID와 `right/left` 두 tool ID가 독립이다. 1몸 +6×(upper/lower/foot)+2×(upper/blade)=23개의 실제 SVG image노드다. 23고유 원화나 보행23프레임이 아니다. crop별 SVG clip을 사용해 이웃 원문이 섞이지 않도록 했다.

두 tripod A(RF/LM/RH)와 B(LF/RM/LH)가 이동거리6px마다 교대한다. 공중에 있는 세 발만 이동하고, 지지 중인 발의 world좌표는 고정된다. 정지는 들린 tripod만 .30local초 동안 현재 위치에서 마무리하며 다시 출발할 때 지지발을 즉시 옮기지 않는다. 0/.5/1/2를 DOM select로 실제 바꿨다. .5/1/2는 거리 기반 동일 tripod 순서를 유지하고 표현clock만 다르다. 0은 보간 없는 명시적 owner재생성·이산이동이며, 즉시 점프의 접지 연속성을 증명했다고 세지 않는다.

모델은 **정면 단일 원문을 쓴 제한2D투영**이다. upper25/lower27/낫upper18의 표시길이와 hip/shoulder는 이 시제품의 가정이다. 원문의 기울어진 근위/원위 금속핀축을 회전·균일배율로 target joint에 맞췄으며 lower를 늘리지 않았다. 발 원문 ankle[342,744]와 하단 chord[257,880]→[414,880]의 표시offset[-.2925,6.12]를 사용했다. 보이는 boss/픽셀핀과 실제3D hip·shoulder·축을 구분해 후자는 null로 유지했다. 투영 COM 지지여유는2D진단이지 실제 질량/중력의 증거가 아니다.

## 낫·피격·중단·사망

양 도구는 준비.28→접촉.12(도달.05+짧은유지)→후속.24→회복.36local초로 독립 제어한다. 정면 anatomical right는 화면왼쪽이다. 왼낫은 같은 upper/blade 원문을 명시flipX로 공유하며 빛/면 비대칭도 반전된다. 새 반대 면 원화를 제작했다고 세지 않는다. 이동 중 공격 입력은 정지·6접지를 기다린 다음 준비로 들어간다. 실제 버튼으로 각낫 네 단계를 관찰했고 반대낫은 guarded를 유지했다. 두낫 동시 준비·피격 중단·현재각도에서의 회복·키보드 입력도 관찰했다.

1차 DOM에서 사망 때 낫이 앞발 아래로 지나치게 내려가는 시각문제를 직접 보았다. 허용된 **핵심 보정1회**로 몸 낮춤18→12px, tool 최종각[1.65,1.65]→[2.30,-1.05]로 접었다. 보정 뒤 화면을 직접 열어 낫끝이 앞발선 위로 접히는 것을 확인했다. 사망표현은 절차적 낮춤/접기이며 진짜 시체원화나3D충돌·관절물리를 증명하지 않는다. 사망 후 이동/두낫 버튼은 disabled, 키보드 R/↓도 무시됐고 초기화로 복귀했다.

## 실제 관찰 결과

최종 `diagnostics/v2/observation.json`에는 실제 DOM 버튼/키 입력으로 얻은60상태·24개 SVG장면 PNG·오류0과 before/after상태가 있다. 소스/world/API를 주입하거나 phase를 강제로 얼려서 성공 화면을 만들지 않았다. `window.cullerInspect`는 복사본을 돌려주는 읽기 관찰 함수뿐이다. 프로토타입 자체의 root는 합성표현 이동이며 Core세계가 아니다.

| 수치 | 최종 관측값 |
|---|---:|
| 제한2D 최대도달오차 | 7.160723346098895e-15px |
| 고정2D 링크길이 최대오차 | 1.7763568394002505e-14px |
| 동일owner 연속접지 최대이동 | 8.881784197001252e-16px |
| 변환한 source핀의 산술오차 | 2.842170943040401e-14px |
| 최소 투영 지지여유 | 6.694146120310034px |

이 수치는 부동소수 산술 수준의 제한2D 연결/접지 진단이다. 픽셀 cap이 실제3D에서 합당한지나 물리 안정성을 뜻하지 않는다. 멈춘 뒤 여섯발 접지, 재출발, 두 tripod 교대와 좌우 낫·취소·피격·사망을 확인했다. 거대한 기계의 단일 정면 파츠를 회전한 모습은 여전히2D 퍼펫 성격이 있으며 전방향/출시용 자연스러움 승인은 false다.

직접 연 최종 화면 목록은 `runtime-review.json`에 정확히 기록했다. 다음 개별 PNG는 전체 장면이 잘리지 않았다:

- `diagnostics/v2/initial-clean-native1x.png` (실제1× 표시), `initial-clean-3x.png`.
- `walk-sequence-2.png`, `walk-sequence-5.png`, `walk-sequence-8.png` (연속 실제이동의 두 tripod/다음주기).
- `right-contact.png`, `left-contact.png`, 각 windup/follow/recover.
- `stop-settled.png`, `hurt-interrupt.png`, `death-procedural-lowering.png`, `zero-instant.png`.

캡처는 RAF가 계속 도는 실제 화면이다. contact이름 PNG를 요청한 순간은 접촉 후반이지만 저장 뒤 JSON은 다음 follow초반일 수 있다. before event와 after shot 상태를 모두 보존했으며 정확한 한 프레임 동결이라고 쓰지 않는다. `walk-chronology.png`의 사적인 static contact sheet는 뷰포트 때문에 오른쪽3열이 잘린 **진단배치 보류본**이다. 원문/개별 scenePNG의 잘림이 아니며 해당2/5/8개별PNG를 직접 다시 열었다. 이 진단배치를 고치려고 추가 runtime회귀/브라우저 반복을 하지 않았다.

## 실패 보존과 작업 경계

초기 `diagnostics/v1/failure.json`은 선택적 Playwright영상녹화가 설치되지 않은 ffmpeg를 요구해 page생성 전 실패한 기록이다. 패키지/브라우저를 설치하지 않고 영상0·실제 DOM PNG연속기록으로 전환했다. `diagnostics/v1-dom/failure.json`은58상태/24화면까지 진행 후 마지막 queued12px 대기에서 부동소수의 exact≥ 비교로 timeout난 기록이다. 관찰 비교에1e-6 epsilon만 넣었고 세계상태를 바꾸지 않았다. 1차 모델/관찰코드는 `records/implementation-v1/`, 시각문제와 보정은 `records/core-correction.json`에 보존했다. 최종 두번째 DOM관찰은 완료됐다. 각실행 `own-lifecycle.json`에서 private browser/context/server의 finally종료를 확인했다.

부모가 통합할 때는 실제 actor보간 위치로 이동거리를 공급하고 Core body UID/손상·제거된 다리/실제공격event·도구소유/지도전환/FOV/저장/Pixi수명주기를 따로 연결해야 한다. 여기 UI이동10px/local초를 Core행동속도로 재사용하면 안 된다. 두버튼은 원문 두tool의 독립표현시제품일 뿐 실제 Core가 양팔 모두 공격가능하다는 뜻이 아니다. SOURCE는FRONT한면뿐이므로 다른 방향·반대면·밑면을 제작했다고 세지 않는다.

`runtime-contract.json`이 부모 전달 계약이다. `active`, `releaseAccepted`, `semanticGaitApproval`, `physical3DSkeletonAccepted`, 반대면/안쪽절삭날/실제게임Native 승인은 false다. 산분사·포획망·추격·수리·게임활성 완료가 아니다. `artifact-sha256.json`은 자기 자신을 제외한 동결 파일 해시다.
'''
(r/'README.md').write_text(readme)
for p in r.rglob('*.json'):json.loads(p.read_text())
files={str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(r.rglob('*')) if p.is_file() and p.name!='artifact-sha256.json'}
(r/'artifact-sha256.json').write_text(json.dumps({'algorithm':'sha256','scope':'all frozen files except this manifest','files':files},indent=2)+'\n')
print(json.dumps({'root':str(r),'frozenFilesExcludingManifest':len(files),'sourceFilesUnchanged':len(baseline),'metrics':metrics,'hashes':{k:files[k] for k in ('art-final.json','runtime-contract.json','runtime-review.json','model.mjs','app.mjs','README.md')}},indent=2))
