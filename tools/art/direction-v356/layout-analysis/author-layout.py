"""Read-only source/maths analysis. No art generation, game or Core execution."""
import hashlib,json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
B=Path(__file__).parent
V335=Path('/workspace/.ashveil-planned/v335-garden-machine-art')
V354=Path('/workspace/.ashveil-planned/v354-sower-front-rig')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(n,d):(B/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def length(a,b):return math.hypot(b[0]-a[0],b[1]-a[1])
f=read(V335/'sprites.fragment.json');m=read(V335/'partial-models.json')['models']['sower'];j=read(V354/'joint-registration.json')

# Source pixels hand-placed after viewing the original and enlarged exact crop.
# Circular fore hip pins are visible. Piston exit/ankle collar landmarks are not
# observed circular knee/ankle axes; hidden rear hip locations stay null.
BASELINES={
 'idle':{'key':m['clips']['idle']['down'][0],'groundOrigin':[196,342],'uncertaintySourcePixels':3,'legs':{
  'RF':{'hip':[130,240],'kneeLandmark':[109,286],'ankleLandmark':[103,325],'soleRim':[103,341]},
  'LF':{'hip':[255,240],'kneeLandmark':[278,287],'ankleLandmark':[285,325],'soleRim':[284,342]},
  'RH':{'hip':None,'kneeLandmark':None,'ankleLandmark':None,'soleRim':[127,318]},
  'LH':{'hip':None,'kneeLandmark':None,'ankleLandmark':None,'soleRim':[258,318]},
 }},
 'work':{'key':m['clips']['work']['down'][0],'groundOrigin':[176,1151],'uncertaintySourcePixels':4,'legs':{
  'RF':{'hip':[108,1049],'kneeLandmark':[84,1098],'ankleLandmark':[76,1137],'soleRim':[78,1151]},
  'LF':{'hip':[249,1049],'kneeLandmark':[276,1098],'ankleLandmark':[286,1137],'soleRim':[285,1151]},
  'RH':{'hip':None,'kneeLandmark':None,'ankleLandmark':None,'soleRim':[113,1125]},
  'LH':{'hip':None,'kneeLandmark':None,'ankleLandmark':None,'soleRim':[259,1125]},
 }},
 'walk':{'key':m['clips']['walk']['down'][0],'groundOrigin':[333,553],'uncertaintySourcePixels':6,'legs':{
  'RF':{'hip':[198,355],'kneeLandmark':[168,447],'ankleLandmark':[143,525],'soleRim':[136,554]},
  'LF':{'hip':[462,355],'kneeLandmark':[509,444],'ankleLandmark':[545,522],'soleRim':[540,552]},
  'RH':{'hip':None,'kneeLandmark':None,'ankleLandmark':None,'soleRim':[192,500]},
  'LH':{'hip':None,'kneeLandmark':None,'ankleLandmark':None,'soleRim':[470,492]},
 }},
}
canonical={'format':1,'sourceOnly':True,'newPixels':0,'coordinateConvention':'Original sheet pixels. Anatomical LF/RF in FRONT appear on viewer-right/left. RH/LH rear visible sole rims are partly occluded. There is no painted floor; soleRim means approximate visible lower silhouette, not physical pressure/contact proof.','reviewScope':{'originalsDirectlyOpened':['sower-idle-v2.png','sower-work-v1.png','sower-walk-down-v2.png'],'frontFramesCompared':12,'fullyRegisteredBaselineFrames':3,'otherFrontFrames':'Frame/crop references below are compared context only, not twelve newly authored landmark registrations.'},'baselines':{},'comparedFrameReferences':{}}
ratios=[]
for mode,baseline in BASELINES.items():
 key=baseline['key'];sheet,x,y,w,h=f['frames'][key];tr=m['frameTransforms'][key];scale=tr['scale'];source=V335/'originals'/Path(f['sheets'][sheet]).name;im=Image.open(source).convert('RGBA');z=3 if mode!='walk' else 2
 diag=Image.new('RGBA',(w*z,h*z+50),(48,46,40,255));diag.alpha_composite(im.crop((x,y,x+w,y+h)).resize((w*z,h*z),Image.Resampling.NEAREST),(0,50));draw=ImageDraw.Draw(diag);draw.text((8,7),f'{mode} front0: green=observed hip, orange=estimated exit/collar',fill=(241,226,185,255));draw.text((8,23),'Rear hips occluded/null; blue=visible partial sole rim. DIAGNOSTIC ONLY',fill=(182,171,140,255))
 data={**baseline,'source':str(source),'sourceSha256':sha(source),'frame':f['frames'][key],'sourceRenderScale':scale,'sourceRegisteredGroundSheetPoint':[x+w*tr['anchor'][0],y+h*tr['anchor'][1]],'rootOriginMeaning':'Mean approximate front sole silhouette, kept separate from old authoring ground projection','legs':{}}
 for limb,points in baseline['legs'].items():
  p={**points,'hipStatus':'visible fore circular brass pin' if points['hip'] else 'occluded; no source observation','kneeStatus':'estimated projected piston-exit landmark; no visible true circular axis' if points['kneeLandmark'] else 'occluded/unregistered','ankleStatus':'estimated visible collar/attachment landmark, not a visible front-facing rotary pin' if points['ankleLandmark'] else 'occluded/unregistered','soleStatus':'approximate visible lower support rim; partial rear rim' if limb in ['RH','LH'] else 'approximate visible lower support rim'}
  p['bodyGroundSpace']={name:None if pt is None else [(pt[0]-baseline['groundOrigin'][0])*scale,(pt[1]-baseline['groundOrigin'][1])*scale] for name,pt in points.items()}
  if points['hip']:
   u=length(points['hip'],points['kneeLandmark'])*scale;l=length(points['kneeLandmark'],points['ankleLandmark'])*scale;p['projectedLandmarkLengths']={'upper':u,'lower':l,'lowerOverUpper':l/u,'notPhysical3DLinkMeasurement':True};ratios.append(l/u)
  data['legs'][limb]=p
  for name,pt in points.items():
   if pt is None:continue
   px,py=(pt[0]-x)*z,(pt[1]-y)*z+50;color=(152,218,140,255) if name=='hip' else (136,186,225,255) if name=='soleRim' else (243,166,108,255);draw.ellipse((px-5,py-5,px+5,py+5),outline=color,width=2);draw.text((px+7,py-13),limb+' '+name,fill=color)
 diag.convert('RGB').save(B/'diagnostics'/f'canonical-{mode}-landmarks-diagnostic.png');canonical['baselines'][mode]=data
 canonical['comparedFrameReferences'][mode]=[{'key':key,'frame':f['frames'][key],'transform':m['frameTransforms'][key]} for key in m['clips'][mode]['down']]
canonical['projectedLowerUpperRatioRange']=[min(ratios),max(ratios)]
canonical['ratioLimit']='Approximately 0.72–0.86 from painterly visible exit/collar landmarks, not measured physical hinges; pose, foreshortening and original model variation matter.'
write('canonical-front-observations.json',canonical)

source=V354/'originals/sower-front-rig-components-v1.png';im=Image.open(source).convert('RGBA');alpha=np.asarray(im.getchannel('A'));jointReview={'format':1,'source':str(source),'sourceSha256':sha(source),'directlyOpened':True,'newPixels':0,'sourceRegistrationSha256':sha(V354/'joint-registration.json'),'parts':{},'visibleBossRoleCaution':'Upper outer bosses [160,374]/[636,373] visibly exist but rear-leg ownership is unproven. LH/RH observed hip remains null.'}
for part,v in j['parts'].items():
 q={'crop':v['crop'],'joints':{}}
 for name,p in v['joints'].items():
  px,py=p['source'];patch=alpha[py-12:py+13,px-12:px+13];q['joints'][name]={'sourcePoint':[px,py],'sourceAlpha':int(alpha[py,px]),'radius12SquareMinAlpha':int(patch.min()),'radius12SquareNonzeroFraction':float((patch>0).mean()),'review':'Independently seen solid bronze/metal pin cap; no transparent hole at proposed pivot. Role as rear hip still unproven for upperOuter bosses.'}
 if v.get('axisSource'):q['projectedAxis']={'vector':v['axisSource']['vector'],'length':length(v['axisSource']['start'],v['axisSource']['end']),'angleRadians':math.atan2(v['axisSource']['vector'][1],v['axisSource']['vector'][0]),'notPhysical3DAxisProof':True}
 jointReview['parts'][part]=q
foot=j['parts']['foot'];ankle=foot['joints']['ankle']['source'];sole=foot['sole']['sourcePoint'];jointReview['footAnkleToSoleSourceVector']=[sole[0]-ankle[0],sole[1]-ankle[1]];jointReview['readabilityLimits']=['All four components are one front/top painted view, with fixed lighting; shared instances are not new authored frames.','Opaque pin caps permit overlap registration, but do not prove perfect contour/paint matching once rotated.','Upper/lower actual source axes are tilted; never use texture centre or assume vertical/collinear.','Lower is one fixed-medium-extension piece. Physics fixed-link projection is separate from authoring a telescoping cylinder.','Foot is one flat projected source; no lifted underside or alternate pitch surfaces were authored.','Fore links can overlap/cross body optics or folded calibration manipulators if the layout/z is wrong; only parent display inspection can accept that.']
write('v354-pin-review.json',jointReview)
diag=Image.new('RGBA',im.size,(48,46,40,255));diag.alpha_composite(im);draw=ImageDraw.Draw(diag)
for part,v in j['parts'].items():
 for name,p in v['joints'].items():
  px,py=p['source'];ambiguous=name.startswith('upperOuter');color=(183,147,223,255) if ambiguous else (157,216,142,255);draw.ellipse((px-12,py-12,px+12,py+12),outline=color,width=2);draw.text((px+15,py-12),part+' '+name+(' ROLE UNKNOWN' if ambiguous else ''),fill=color)
 if v.get('axisSource'):draw.line([tuple(v['axisSource']['start']),tuple(v['axisSource']['end'])],fill=(139,184,226,255),width=2)
draw.line([(875,1165),(1030,1165)],fill=(245,206,125,255),width=2);draw.line([tuple(ankle),tuple(sole)],fill=(139,184,226,255),width=2);draw.text((16,12),'v355 READ-ONLY PIN/AXIS DIAGNOSTIC — no new artwork; rear hip interpretation remains unobserved',fill=(242,226,188,255));diag.convert('RGB').save(B/'diagnostics'/'v354-visible-pins-axis-alpha-diagnostic.png')

# A separate screen-plane example illustrates viable proportions only. It is
# NOT the parent's physical15+15 3D configuration or an observed machine rig.
uSource=j['parts']['upper']['axisSource'];lSource=j['parts']['lower']['axisSource'];uLen=length(uSource['start'],uSource['end'])*.037;lLen=length(lSource['start'],lSource['end'])*.025
fit={'format':1,'activationReady':False,'scope':'Alternative projected2D length comparison, not parent3D configuration and not runtime authoring','upperSourceScaleExample':.037,'lowerSourceScaleExample':.025,'upperProjectedLengthExample':uLen,'lowerProjectedLengthExample':lLen,'lowerOverUpperExample':lLen/uLen,'canonicalApproximateLandmarkRatioRange':canonical['projectedLowerUpperRatioRange'],'physical3DLengthsUnproven':True,'frontNeutralReachExamples':{}}
for limb,hip,contact in [('RF',[-14.91,-23],[-21,0]),('LF',[14.91,-23],[21,0])]:
 a=[contact[0]-.33,contact[1]-4.62];d=length(hip,a);cos=(d*d-uLen*uLen-lLen*lLen)/(2*uLen*lLen);fit['frontNeutralReachExamples'][limb]={'proposedHip':hip,'proposedSole':contact,'ankleFromSharedFootSourceOffset':a,'projectedHipToAnkleDistance':d,'allowedDistanceInterval':[abs(uLen-lLen),uLen+lLen],'reachableInThis2DExample':abs(uLen-lLen)<d<uLen+lLen,'bendAngleDegrees':math.degrees(math.acos(max(-1,min(1,cos)))),'notAnObservedPinPosture':True}
write('projected-length-comparison.json',fit)

# Projected layout proposals are explicit assumptions, separate from observations.
layout={'format':1,'activationReady':False,'frame':'FRONT only; x right, y down, units hypothetical native display pixels, origin mean neutral front sole ground projection','body':{'sourcePivot':[395,428],'sourcePivotMeaning':'midpoint of observed foreground hip pins [182,428]/[608,428]','proposedScale':.07,'proposedPivotDisplay':[0,-23],'worldHeightAndFloorNotObserved':True},'hips':{'RF':{'observedSource':[182,428],'displayProposal':[-14.91,-23],'status':'source pin observed; display placement proposed'},'LF':{'observedSource':[608,428],'displayProposal':[14.91,-23],'status':'source pin observed; display placement proposed'},'RH':{'observedSource':None,'inferredDisplayProposal':[-10,-27],'status':'occluded/inferred; not upper-outer boss observation'},'LH':{'observedSource':None,'inferredDisplayProposal':[10,-27],'status':'occluded/inferred; not upper-outer boss observation'}},'neutralSoleContacts':{'RF':[-21,0],'LF':[21,0],'RH':[-15,-6],'LH':[15,-6]},'neutralContactStatus':'Proposed fit to approximate canonical visible sole-rim layout, not a floor/contact simulation result','partSourceVectors':{'upper':j['parts']['upper']['axisSource']['vector'],'lower':j['parts']['lower']['axisSource']['vector'],'footAnkleToSole':jointReview['footAnkleToSoleSourceVector']},'footDisplayScaleProposal':.03,'footAnkleToSoleDisplayVector':[.33,4.62],'drawOrderBackToFrontProposal':['rear RH/LH foot and lower and upper links','whole chassis/body','foreground RF/LF foot and lower and upper links'],'occlusion':['Rear hips and proximal links are behind chassis alpha. Partial rear pad exposure is expected; do not make all four hips visible.','Foreground proximal pin centres align to observed body pins. Its shared upper cap may cover/nest over a bigger baked-in body boss; overlap/diameter and double-ring readability are unapproved.','Keep folded belly calibration tools and central spout as body pixels. They are not drive legs, hip handles or foot supports.','Left/right ordering within each far/near pair is not an authored crossing rule; changing depth/facing requires parent projected-depth ordering.'],'notRuntimeRegistration':True}
write('layout-proposal.json',layout)

parent={'format':1,'activationReady':False,'authority':'Parent message describing a FRONT render prototype, not source observation or Core rule','model':'fixed physical 3D two-link IK followed by orthographic display projection','groundYProjection':.707,'heightZProjection':.707,'upperPhysicalLength':15,'lowerPhysicalLength':15,'foregroundHipHeightZ':32.53,'ankleHeightZ':6.54,'foregroundHipX':[-14.91,14.91],'neutralFrontSoleX':[-21,21],'strideDistancePhysical':20,'stanceDuty':.75,'distanceDrivenNotTimeDriven':True,'physicsOrGameplayImplementedHere':False,'caveat':'Physical15+15 is an unimplemented parent assumption. Canonical projected landmark ratios and v354 source pixel axes do not prove it; source texture foreshortening/lighting still needs display review.'}
dz=parent['foregroundHipHeightZ']-parent['ankleHeightZ'];dx=21-14.91;half=parent['strideDistancePhysical']*parent['stanceDuty']/2;parent['analyticReachIllustration']={'verticalDifference':dz,'neutralHorizontalDifference':dx,'stanceHalfTravel':half,'nominalWorstDistance':math.sqrt(dz*dz+dx*dx+half*half),'twoLinkMaximum':30,'notAPlayedOrRenderedValidation':True}
write('parent-3d-prototype-assumptions.json',parent)

phases=[('LH',[0,.25],[-1,-1.8]),('LF',[.25,.5],[-1,-4.3]),('RH',[.5,.75],[1,-1.8]),('RF',[.75,1],[1,-4.3])]
def inside_triangle(point,tri):
 cross=[]
 for i in range(3):
  a,c=tri[i],tri[(i+1)%3];cross.append((c[0]-a[0])*(point[1]-a[1])-(c[1]-a[1])*(point[0]-a[0]))
 return all(v>=-1e-9 for v in cross) or all(v<=1e-9 for v in cross)
gait={'format':1,'activationReady':False,'proposalOnly':True,'newWalkSourceFrames':0,'phaseUnits':'cycle normalized0..1 driven by real rendered root path distance / parent stride20, not elapsed frame time','stanceDuty':.75,'oneRecoveryAtATime':True,'baselineProjectedGroundCOMHint':[0,-3],'noMassOrPhysicsProof':True,'phases':[],'swingPathProposal':{'horizontal':'smoothstep5(u)=6u^5-15u^4+10u^3 from previous trailing release to next leading landing; each physical step is a render assumption','vertical':'small sin(pi*u)^2 hump, optional physical height≈3; keep pad flat because no underside source exists','sourceFootPitch':'Keep source foot flat/front-oriented. Rotating a foot to show an unseen sole is not authored support.'},'footLockProposal':['During stance retain each projected world-ground plant, transform by actual root movement; do not drag every foot with body centre.','Release exactly one leg at a time. At landing start new stance plant; never teleport to a nominal paw offset.','Body COM hints are support-plane projected assumptions, not visible body-centre or actual mass calculation.','On movement stop do not advance a walking clock endlessly. Preserve planted feet and complete a safe active recovery smoothly if parent chooses, without adding Core movement/actions.'],'notCoreLocomotion':['No time unit/resource/collision/ground simulation or distance implementation is performed in this metadata.','Only FRONT display is considered. Shared front parts do not author left/right/back views or guarantee slope contacts.']}
contacts=layout['neutralSoleContacts']
for limb,interval,com in phases:
 support=[k for k in ['RF','LF','RH','LH'] if k!=limb];triangle=[contacts[k] for k in support];gait['phases'].append({'recoveryLeg':limb,'intervalStartInclusiveEndExclusive':interval,'stanceLegs':support,'projectedGroundCOMHint':com,'hintInsideProposedSupportTriangle':inside_triangle(com,triangle),'hintIsNotObservedForceOrPhysics':True})
write('gait-and-support-proposal.json',gait)

# A skeletal layout diagram only: lines/points, no source component assembly.
diag=Image.new('RGB',(1100,640),(47,45,39));draw=ImageDraw.Draw(diag);draw.text((18,12),'v355 FRONT LAYOUT PROPOSAL / wireframe only / no new art or game execution',fill=(241,225,187));draw.text((18,31),'green=observed-source fore hip mapped by proposal; purple=inferred rear hip; blue=neutral sole proposal',fill=(180,171,141));z=8;ox,oy=300,520
project=lambda p:(ox+p[0]*z,oy+p[1]*z)
for limb in ['RH','LH','RF','LF']:
 hip=layout['hips'][limb].get('displayProposal',layout['hips'][limb].get('inferredDisplayProposal'));footpt=contacts[limb];h=project(hip);p=project(footpt);color=(167,146,218) if limb in ['RH','LH'] else (157,214,140);draw.line((h,p),fill=color,width=2);draw.ellipse((h[0]-5,h[1]-5,h[0]+5,h[1]+5),outline=color,width=2);draw.ellipse((p[0]-12,p[1]-4,p[0]+12,p[1]+4),outline=(133,181,220),width=2);draw.text((h[0]+7,h[1]-20),limb+' hip '+('inferred' if limb in ['RH','LH'] else 'source-pin map'),fill=color);draw.text((p[0]+7,p[1]+9),limb+' sole proposal',fill=(133,181,220))
for i,p in enumerate(gait['phases']):
 bx,by=660,95+i*120;tri=[contacts[k] for k in p['stanceLegs']];pts=[(bx+q[0]*5,by+q[1]*5) for q in tri];draw.polygon(pts,outline=(164,172,120));com=p['projectedGroundCOMHint'];cx,cy=bx+com[0]*5,by+com[1]*5;draw.ellipse((cx-4,cy-4,cx+4,cy+4),fill=(224,174,114));draw.text((805,by-35),p['recoveryLeg']+' recovery',fill=(240,223,184));draw.text((805,by-17),'3 support; COM hint inside',fill=(180,171,140))
diag.save(B/'diagnostics'/'layout-and-support-wireframe.png')
write('provenance.json',{'format':1,'newPixelArtGenerated':0,'imageGenerationCalls':0,'existingPngModified':False,'mainOrCoreModified':False,'gameBuildOrNativeExecuted':False,'sources':[{'path':str(V335/'originals'/p),'sha256':sha(V335/'originals'/p)} for p in ['sower-idle-v2.png','sower-work-v1.png','sower-walk-down-v2.png']]+[{'path':str(source),'sha256':sha(source)}],'v354RegistrationSha256':sha(V354/'joint-registration.json'),'readOnlyAnalysis':'Pillow/NumPy read originals, alpha and labelled diagnostic crops/points only; pure Python geometry proposals do not run the game/Core.'})
print(json.dumps({'canonicalBaselineFrames':3,'canonicalContextFrames':12,'jointReviewParts':len(jointReview['parts']),'sourceAxes':{k:v.get('projectedAxis') for k,v in jointReview['parts'].items() if v.get('projectedAxis')},'supportHintsInside':all(p['hintInsideProposedSupportTriangle'] for p in gait['phases']),'parentHypotheticalReach':parent['analyticReachIllustration'],'imageGenerationCalls':0},indent=2))
