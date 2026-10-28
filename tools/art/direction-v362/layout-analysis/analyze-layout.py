"""Read-only source observations + hypothetical2.5D calibration maths.

Does not import/execute client/Core/game code or alter source PNGs.
"""
import hashlib,json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
B=Path(__file__).parent;V357=Path('/workspace/.ashveil-planned/v357-sower-directional-rig');V335=Path('/workspace/.ashveil-planned/v335-garden-machine-art');V354=Path('/workspace/.ashveil-planned/v354-sower-front-rig');REPO=Path('/workspace/ashveil')
def read(p):return json.loads(Path(p).read_text())
def write(n,d):(B/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def hypot(v):return math.hypot(*v)
S=math.sqrt(.5);j=read(V357/'joint-registration.json');f=read(V335/'sprites.fragment.json');model=read(V335/'partial-models.json')['models']['sower']
GRAPHICS={
 'left':{'spoutTip':[432,653],'sensorCentre':[119,453],'sideVentCentre':[432,470],'tallTankNeck':[350,101],'shortTankNeck':[562,190]},
 'right':{'spoutTip':[356,623],'sensorCentre':[695,423],'sideVentCentre':[337,430],'tallTankNeck':[467,72],'shortTankNeck':[228,153]},
 'back':{'spoutTip':[424,593],'rearVentCentre':[423,402],'tallTankNeck':[511,52],'shortTankNeck':[321,143]},
}
NEAR={'left':['LF','LH'],'right':['RF','RH'],'back':['LH','RH']}
FAR={'left':['RF','RH'],'right':['LF','LH'],'back':['LF','RF']}
observed={'format':1,'activationReady':False,'newPixelArt':0,'newImageGenerationCalls':0,'coordinateConvention':'source/crop pixels, right/bottom exclusive; body fittings are observed painted caps, physical hips remain null','directions':{},'counts':{'sourcePngsReviewed':3,'uniqueV357SourceRegions':12,'partsPerDirection':4,'authoredGaitFrames':0,'potentialSpriteInstancesPerVisibleDirection':13,'potentialInstancesIfAllThreeDirectionsShownSeparately':39,'runtimeInstancesCreatedHere':0}}
layout={'format':1,'activationReady':False,'sourceOnly':True,'bodyTrialNotAccepted':'Reference.07 and range.065–.075 are visual native-envelope trials, not forced FRONT scaling or calibrated physical origins. Canonical full-machine and new legless body extents are different quantities.','directions':{}}
partsPinCount=0
for direction,d in j['directions'].items():
 source=V357/d['sourcePng'];im=Image.open(source).convert('RGBA');alpha=np.asarray(im.getchannel('A'));record={'source':str(source),'sourceSha256':sha(source),'sourceSize':list(im.size),'observedBodyFittings':{},'physicalHipObservations':{leg:{'observedSource':None,'calibratedDisplay':None,'reason':'body corner ownership/mounting plane not established from painted cap'} for leg in ['LF','RF','LH','RH']},'parts':{},'trueRearJointSurfaceObserved':None if direction=='back' else 'not a rear-surface claim','sourceDirectionReview':'sensor left' if direction=='left' else 'sensor right' if direction=='right' else 'rear vent; no front optics'}
 for part,p in d['parts'].items():
  x,y,w,h=p['crop'];pr={'frameKey':p['frameKey'],'crop':[x,y,w,h],'insideSource':x>=0 and y>=0 and x+w<=im.width and y+h<=im.height,'cropRgbaSha256':hashlib.sha256(im.crop((x,y,x+w,y+h)).tobytes()).hexdigest(),'joints':{}}
  for name,pin in p['joints'].items():
   px,py=pin['source'];patch=alpha[py-12:py+13,px-12:px+13];q={'observedSource':[px,py],'crop':[px-x,py-y],'normalizedCrop':[(px-x)/w,(py-y)/h],'sourceAlpha':int(alpha[py,px]),'radius12SquareMinAlpha':int(patch.min()),'physicalHipOr3DAxisRoleConfirmed':False};pr['joints'][name]=q;partsPinCount+=1
   if part=='chassis':record['observedBodyFittings'][name]=q
  if p.get('axisFromObservedPaintedCenters'):
   ax=p['axisFromObservedPaintedCenters'];v=ax['vector'];pr['paintedAxis']={'sourceA':ax['start'],'sourceB':ax['end'],'vector':v,'length':hypot(v),'angleRadians':math.atan2(v[1],v[0]),'notVerified3DMechanicalAxis':True}
  if p.get('sole'):
   ankle=p['joints']['ankle']['source'];sole=p['sole']['sourcePoint'];vec=[sole[0]-ankle[0],sole[1]-ankle[1]];scaleTo4_62=4.62/vec[1];pr['sole']={'observedApproximateSourcePoint':sole,'sourcePointAlpha':int(alpha[sole[1],sole[0]]),'crop':[sole[0]-x,sole[1]-y],'sourceSpan':p['sole']['sourceSpan'],'ankleToSoleSourceVector':vec,'atFrontScale03':{'vector':[v*.03 for v in vec],'displayCropSize':[w*.03,h*.03]},'uniformScaleIfHoldingFrontVerticalOffset4_62':scaleTo4_62,'atHeightMatchedScale':{'vector':[v*scaleTo4_62 for v in vec],'displayCropSize':[w*scaleTo4_62,h*scaleTo4_62]},'contactOrPressureProof':False,'oppositeAnkleOrLiftedUndersideObserved':None}
  record['parts'][part]=pr
 observed['directions'][direction]=record
 canonDir='up' if direction=='back' else direction;ck=model['clips']['idle'][canonDir][0];wk=model['clips']['work'][canonDir][0];oldFrame=f['frames'][ck];oldTr=model['frameTransforms'][ck];body=d['parts']['chassis'];spout=GRAPHICS[direction]['spoutTip'];x,y,w,h=body['crop']
 layout['directions'][direction]={'graphicalSourceAnchors':{'points':GRAPHICS[direction],'certainty':'approximate visible graphical landmarks ±6 source pixels; not hip observations or physical-root calibration'},'canonicalIdle':{'key':ck,'frame':oldFrame,'transform':oldTr,'fullMachineDisplaySize':[oldFrame[3]*oldTr['scale'],oldFrame[4]*oldTr['scale']]},'canonicalWork':{'key':wk,'frame':f['frames'][wk],'transform':model['frameTransforms'][wk],'backRawRequiresExistingFlipX':direction=='back'},'body':{'crop':body['crop'],'displayEnvelopeAtReference07':[w*.07,h*.07],'sourceGraphicPivotTrial':spout,'cropGraphicPivotTrial':[spout[0]-x,spout[1]-y],'displayGraphicPivotTrial':[0,-9],'uniformScaleReferenceOnly':.07,'notHipAlignedOrSamePhysicalOrigin':True},'physicalHips':{leg:{'observedSource':None,'inferred':None} for leg in ['LF','RF','LH','RH']},'idealRotationNearGroupNotSourceProof':NEAR[direction],'idealRotationFarGroupNotSourceProof':FAR[direction],'layeringProposalBackToFront':['geometrically far full legs/feet, in camera-ground depth order','chassis alpha with folded tools/spout retained','geometrically near legs/feet in depth order'],'layeringLimit':'Source FRONT far flags RH/LH cannot be retained for every yaw. Corner ownership and cam-depth must be calibrated before these ideal groups become runtime layers. Baked body bosses may overlap/double shared proximal caps.','footContract':record['parts']['foot']['sole'],'bodyScaleAndPinAlignmentAccepted':False}
observed['counts']['visiblePaintedPinOrBossObservations']=partsPinCount
write('source-observations.json',observed);write('directional-layout-proposals.json',layout)

# Current FRONT assumptions transcribed from read-only code, never executed.
hips={'RF':(-14.91,0,23/S),'LF':(14.91,0,23/S),'RH':(-10,-4/S,23/S),'LH':(10,-4/S,23/S)}
soles={'RF':(-21,0,0),'LF':(21,0,0),'RH':(-15,-6/S,0),'LH':(15,-6/S,0)}
def rotate(p,a):return (p[0]*math.cos(a)-p[1]*math.sin(a),p[0]*math.sin(a)+p[1]*math.cos(a),p[2])
def project(p):return [p[0],(p[1]-p[2])*S]
yaws={'front':0,'left':math.pi/2,'right':-math.pi/2,'back':math.pi}
projection={'format':1,'activationReady':False,'sourceClientPath':'src/client/render/articulated-gait.ts','sourceClientSha256AtReview':sha(REPO/'src/client/render/articulated-gait.ts'),'sourceClientImportedOrExecuted':False,'currentFrontAssumptions':{'projection':'screenX=x, screenY=(groundY-z)*SQRT1_2','physicalUpper':17.5,'physicalLower':17.5,'hipHeight':23/S,'ankleHeight':4.62/S,'bodySourcePivot':[395,428],'bodyScale':.07,'footScale':.03,'rearHipGroundDepth':4/S,'rearHipAssumptionsNotAnatomicalProof':True},'parentReportedFrontNativeOnly':{'observations':125,'stanceDrift':0,'reachErrorApprox':5.62e-15,'assumedCOMSupportExits':0,'independentlyReproducedHere':False,'notDirectionalAcceptance':True},'idealYawProjections':{}}
for direction,angle in yaws.items():projection['idealYawProjections'][direction]={'yawRadians':angle,'hips':{k:project(rotate(p,angle)) for k,p in hips.items()},'soles':{k:project(rotate(p,angle)) for k,p in soles.items()},'notObservedSourceCoordinates':True}
sameSideBound=math.hypot(14.91-10,4/S);rightPair=[139,446],[578,376];dv=[rightPair[1][i]-rightPair[0][i] for i in range(2)];span=hypot(dv)*.07;backSpan=math.hypot(660-177,375-378)
projection['calibrationFindings']={'left':{'observedChassisBosses':1,'identifiablePhysicalHips':0,'fitConclusion':'A single unowned visible cap can always be matched by translation under many scale/yaw choices; it cannot calibrate four hips/camera/body origin. Front-side joint is hidden by sensor/lower armor.'},'right':{'observedChassisBosses':3,'identifiablePhysicalHips':0,'conditionalSameSidePairTest':{'sourcePairs':['aftLowerBoss[139,446]','forwardSmallBoss[578,376]'],'assumptionOnly':'IF these two caps are assigned the same flank fore/hind physical corners','sourceVector':dv,'displaySeparationAt07':span,'frontSkeletonSameSideXYDistance':sameSideBound,'maximumProjectedSeparationUnderAnyYaw':sameSideBound,'fitsRigidYawAt07UnderThisAssignment':False,'bodyScaleNeededForThisSpanToNotExceedBound':sameSideBound/hypot(dv),'notProofThisCapAssignmentIsCorrect':True},'fitConclusion':'Do not force these caps to FRONT hips via body stretch/nonuniform distortion. Role mapping and2.5D body-depth calibration are missing.'},'back':{'observedChassisBosses':2,'identifiablePhysicalHips':0,'conditionalPairSpan':{'sourceSeparation':backSpan,'displaySeparationAt07':backSpan*.07,'frontInferredRearHipPairSeparation':20,'frontForeHipPairSeparation':29.82,'uniformScaleIfAssignedToInferredRearPair':20/backSpan,'uniformScaleIfAssignedToForePair':29.82/backSpan,'pairPhysicalOwnershipConfirmed':False},'fitConclusion':'A body-facing rear vent and two painted caps do not assign these caps to near hind versus far fore bearings. FRONT inferred rear width/depth may need calibration; no source scaling/hip assignment accepted.'},'allDirections':['Canonical LEFT/RIGHT show front optics and side vent together; cardinal labels do not establish exact±90 orthographic yaw.','The inferred FRONT skeleton was fit to one view, not a measured3D chassis. Link reach success does not constrain source joint/camera calibration.','Choose directional2.5D graphical correspondence and explicit inferred mount planes, then compare projected joints to source pins in a parent-only isolated view.','Do not nonuniformly distort body art to fake pin agreement. Keep all hidden physical observations null.']}
projection['calibrationNeeded']=['Use visible body landmarks (tank necks, optics/vent, spout) for graphical native-size alignment independently from hip roles.','LEFT needs another identified same-plane mount or an explicit design assumption for the hidden fore/opposite corner; one cap cannot solve pose.','RIGHT needs physical ownership of the three different bosses; do not assume sensor bracket/small boss equals fore hip.','BACK needs a declared bearing/corner correspondence and relative rear width/depth, with front/far occlusion checked.','For each facing derive ankle correction from that foot source sole vector and scale; FRONT.33/4.62 is not universal.','After per-direction calibration, parent must inspect native source overlap, projected joint alignment, foot lock, reach/support and actual directional transitions.']
write('projection-calibration-analysis.json',projection)

write('bearing-surface-review.json',{'format':1,'activationReady':False,'backBodyObserved':'rear louvered vent, tall screen-right/short screen-left tanks, no front optical face','paintedGoldCapsObserved':True,'doubleSidedBearingMechanicallyPossible':True,'possibilityIsNotObservation':'A through-shaft or capped two-sided bearing can expose similar gold caps from both ends. A visible round cap therefore neither proves an impossible rear view nor proves that a true rear surface/hidden bearing construction was authored.','trueRearJointSurfaceObserved':None,'oppositeBearingFaceObserved':None,'physicalRotaryAxis3DObserved':None,'nearAndFarSourceSurfacesSeparatelyAuthored':False,'sourceCapsHaveOpaqueCentres':True,'limitations':['Each direction supplies one upper/lower/foot painted view, not near+far hardware skins.','Shared lighting/paint rotates with the display sprite; no view-dependent backside or underside is generated.','Fixed medium-extension lower source is not an authored variable piston stroke.','Foot is one flat stance camera; lifted underside/alternate ankle face remains unobserved.','Mechanical symmetry could be adopted only as an explicit design assumption and still needs parent source-overlap/occlusion review.'],'fullDirectionalRigApproved':False})
write('handoff-contract.json',{'format':1,'activationReady':False,'newPixels':0,'newImageCalls':0,'sourceRegionsReviewed':12,'sourcePngsReviewed':3,'physicalHipsObserved':0,'newRuntimeFrames':0,'fullFourDirectionRigAccepted':False,'runtimeSpritesCreatedHere':0,'sourceInstanceAccounting':'1 body+4upper+4lower+4foot=13 display sprites for one facing. Three separate panels would borrow39 instances from12 unique v357 regions; these are not39 new sources or animation frames. FRONT v354 is a separate4-region source.','keepNulls':True,'bodyNonuniformDistortionToForceFitAllowed':False,'parentIsolatedPrototypeOnly':'Parent is implementing a borrowed13-sprite view separately; this metadata neither activates it in main nor inherits FRONT metrics as directional acceptance.','noMainCoreDefBuildTestGameCommitPush':True})
write('provenance.json',{'format':1,'imageGenerationCalls':0,'newArtPixels':0,'originalPngChanged':False,'mainClientCoreDefChanged':False,'parentCodeImportedOrRun':False,'gameOrTestsRun':False,'sources':[{'path':str(V357/d['sourcePng']),'sha256':sha(V357/d['sourcePng'])} for d in j['directions'].values()]+[{'path':str(V335/'originals'/n),'sha256':sha(V335/'originals'/n)} for n in ['sower-idle-v2.png','sower-work-v1.png']],'registrationSha256':sha(V357/'joint-registration.json'),'clientSourceSha256':projection['sourceClientSha256AtReview'],'analysisScope':'Pillow/NumPy read source pixels/alpha and draw a few labelled diagnostic displays only. Python projected points are conditional geometry, not game/Native tests.'})

# Diagnostic1: canonical full-machine versus uncalibrated body-only native trial.
board=Image.new('RGBA',(1440,960),(48,46,40,255));draw=ImageDraw.Draw(board)
for row,direction in enumerate(['left','right','back']):
 canon='up' if direction=='back' else direction;ik=model['clips']['idle'][canon][0];wk=model['clips']['work'][canon][0]
 for col in range(3):
  gx,gy=col*480+240,row*320+288;draw.rectangle((col*480,row*320,(col+1)*480-1,(row+1)*320-1),outline=(91,85,68,255));draw.line((gx-210,gy,gx+210,gy),fill=(113,105,78,255))
  if col<2:
   key=ik if col==0 else wk;sheet,x,y,w,h=f['frames'][key];tr=model['frameTransforms'][key];img=Image.open(V335/'originals'/Path(f['sheets'][sheet]).name).convert('RGBA');crop=img.crop((x,y,x+w,y+h));z=tr['scale']*4
   if tr.get('flipX'):crop=crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   display=crop.resize((round(w*z),round(h*z)),Image.Resampling.NEAREST);anchor=tr['anchor'];ax=(1-anchor[0]) if tr.get('flipX') else anchor[0];board.alpha_composite(display,(round(gx-w*ax*z),round(gy-h*anchor[1]*z)));label=f'v335 {"idle" if col==0 else "work registered"} {direction}'
  else:
   d=j['directions'][direction];img=Image.open(V357/d['sourcePng']).convert('RGBA');x,y,w,h=d['parts']['chassis']['crop'];p=GRAPHICS[direction]['spoutTip'];z=.07*4;display=img.crop((x,y,x+w,y+h)).resize((round(w*z),round(h*z)),Image.Resampling.NEAREST);board.alpha_composite(display,(round(gx-(p[0]-x)*z),round(gy-9*4-(p[1]-y)*z)));label=f'v357 {direction} BODY ONLY .07 trial'
  draw.text((col*480+12,row*320+12),label,fill=(240,223,185,255));draw.text((col*480+12,row*320+29),'DISPLAY x4 / no hip calibration or rig acceptance',fill=(181,169,139,255))
board.convert('RGB').save(B/'diagnostics'/'native-body-comparison-trials-x4.png')

# Diagnostic2: exact source axes/sole crop points, with actual size and null roles.
board=Image.new('RGBA',(1600,1050),(48,46,40,255));draw=ImageDraw.Draw(board)
for row,direction in enumerate(['left','right','back']):
 d=j['directions'][direction];img=Image.open(V357/d['sourcePng']).convert('RGBA')
 for col,part in enumerate(['chassis','upper','lower','foot']):
  p=d['parts'][part];x,y,w,h=p['crop'];zoom=min(350/w,265/h);ox=col*400+(400-w*zoom)/2;oy=row*350+55+(270-h*zoom)/2;display=img.crop((x,y,x+w,y+h)).resize((round(w*zoom),round(h*zoom)),Image.Resampling.NEAREST);board.alpha_composite(display,(round(ox),round(oy)));draw.text((col*400+10,row*350+8),f'{direction} {part} / source{d["sourceSize"]}',fill=(240,223,185,255));draw.text((col*400+10,row*350+24),'painted caps only; physical roles null',fill=(181,169,139,255))
  for name,pin in p['joints'].items():
   px,py=pin['source'];xx,yy=ox+(px-x)*zoom,oy+(py-y)*zoom;draw.ellipse((xx-4,yy-4,xx+4,yy+4),outline=(162,214,142,255),width=2)
  if p.get('axisFromObservedPaintedCenters'):
   q=p['axisFromObservedPaintedCenters'];draw.line([(ox+(q['start'][0]-x)*zoom,oy+(q['start'][1]-y)*zoom),(ox+(q['end'][0]-x)*zoom,oy+(q['end'][1]-y)*zoom)],fill=(135,185,222,255),width=2)
  if p.get('sole'):
   px,py=p['sole']['sourcePoint'];xx,yy=ox+(px-x)*zoom,oy+(py-y)*zoom;draw.ellipse((xx-4,yy-4,xx+4,yy+4),outline=(242,196,123,255),width=2);draw.text((col*400+10,row*350+333),'sole vector '+str(observed['directions'][direction]['parts']['foot']['sole']['ankleToSoleSourceVector']),fill=(242,196,123,255))
board.convert('RGB').save(B/'diagnostics'/'source-axes-and-sole-vectors.png')

# Diagnostic3: ideal rotated FRONT hips, without pretending to match the images.
board=Image.new('RGB',(1440,600),(48,46,40));draw=ImageDraw.Draw(board)
for col,direction in enumerate(['front','left','right','back']):
 ox,oy=col*360+180,440;draw.text((col*360+12,12),direction+' ideal yaw only',fill=(240,223,185));draw.text((col*360+12,30),'not calibrated to v357 source',fill=(181,169,139));q=projection['idealYawProjections'][direction]
 for leg,p in q['hips'].items():
  x,y=ox+p[0]*6,oy+p[1]*6;draw.ellipse((x-4,y-4,x+4,y+4),outline=(163,215,144),width=2);draw.text((x+6,y-12),leg,fill=(163,215,144));sole=q['soles'][leg];sx,sy=ox+sole[0]*6,oy+sole[1]*6;draw.line((x,y,sx,sy),fill=(122,151,181),width=1)
 draw.text((col*360+12,550),'hidden FRONT rear hip assumptions',fill=(181,169,139))
board.save(B/'diagnostics'/'ideal-front-skeleton-yaw-projection.png')
print(json.dumps({'v357Sources':3,'uniqueRegions':12,'paintedPinOrBossPoints':partsPinCount,'newArtPixels':0,'rightConditionalPairSpanAt07':span,'sameSideHipMaxProjectedBound':sameSideBound,'backPairSpanAt07':backSpan*.07,'footVectorsAt03':{d:observed['directions'][d]['parts']['foot']['sole']['atFrontScale03']['vector'] for d in observed['directions']},'diagnosticImagesWritten':3},indent=2))
