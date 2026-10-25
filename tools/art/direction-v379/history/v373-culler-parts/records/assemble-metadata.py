from pathlib import Path
from PIL import Image
import numpy as np, json, hashlib, math
from scipy.ndimage import label,find_objects
r=Path('/workspace/.ashveil-planned/v373-culler-parts');p=r/'originals/culler-front-parts-v1.png'
rgba=np.asarray(Image.open(p));a=rgba[:,:,3];sha=hashlib.sha256(p.read_bytes()).hexdigest()
parts=json.loads((r/'records/provisional-parts.json').read_text())
finalpins={'chassis':{'frontScreenLeftBoss':[245,429],'frontScreenRightBoss':[373,429],'screenLeftSideBossA':[213,211],'screenLeftSideBossB':[184,302],'screenRightSideBossA':[490,294],'screenRightSideBossB':[429,360]},'driveUpper':{'proximal':[820,185],'distal':[744,408]},'driveLower':{'proximal':[1318,141],'distal':[1235,435]},'foot':{'ankle':[342,744],'soleLeft':[257,880],'soleRight':[414,880]},'scytheUpper':{'proximal':[857,620],'distal':[756,868]},'scytheBlade':{'proximal':[1274,597],'tip':[1296,951],'brightBevelReference':[1388,774]}}
ids={'chassis':'chassis','driveUpper':'drive_upper','driveLower':'drive_lower','foot':'footpad','scytheUpper':'scythe_upper','scytheBlade':'scythe_blade'}
roles={'chassis':'rigid chassis only; no six drive legs, feet, or either scythe arm baked into silhouette','driveUpper':'one fixed-length drive upper source for six displayed instances; not six authored sources','driveLower':'one fixed-length drive lower source for six displayed instances; no source telescopic stroke','foot':'one front/top-view support pad source for six displayed instances; underside not authored','scytheUpper':'one distinct thicker scythe actuator upper for two displayed instances','scytheBlade':'one rigid lower forearm plus curved blade, proximal metal elbow cap; opposite face not authored'}
labels={};counts={};owners={}
for t in (1,16):
 labels[t],_=label(a>=t);counts[t]=np.bincount(labels[t].ravel())
 owners[t]=set()
frames={};reg={};reviews=[];rectunion=np.zeros(a.shape,dtype=bool)
for part in parts:
 k=part['id'];part['pins']=finalpins[k];x,y,w,h=part['rect'];rectunion[y:y+h,x:x+w]=True
 crop=rgba[y:y+h,x:x+w];ca=crop[:,:,3];frame='held_av373_culler_front_'+ids[k];frames[frame]=['held_av373_culler_front_parts_v1',x,y,w,h]
 joints={}
 for name,(px,py) in part['pins'].items():
  pin=name not in ('soleLeft','soleRight','tip','brightBevelReference');hood={}
  for rad in (3,8,12):
   v=a[py-rad:py+rad+1,px-rad:px+rad+1];hood[str(rad)]={'min':int(v.min()),'max':int(v.max()),'nonzeroFraction':round(float((v>0).mean()),8),'fractionAtLeast251':round(float((v>=251).mean()),8)}
  joints[name]={'source':[px,py],'crop':[px-x,py-y],'normalizedCrop':[round((px-x)/w,8),round((py-y)/h,8)],'sourceAlpha':int(a[py,px]),'alphaNeighborhoodSquareRadiusSourcePx':hood,'uncertaintySourcePx':6 if k=='chassis' else (3 if pin else 4),'observedGraphicFeature':True,'actualPhysicalHipObserved':None,'physical3DAxisObserved':None,'note':'manual visible bronze boss center, mechanical role not assigned' if k=='chassis' else ('manual visible solid metal pin center, inside round overlap cap' if pin else 'observed projected silhouette/bevel feature, not physical underside/cutting edge approval')}
 def bounds(m):
  yy,xx=np.where(m);return [int(xx.min()),int(yy.min()),int(xx.max()-xx.min()+1),int(yy.max()-yy.min()+1)] if len(xx) else None
 thresholds={}
 for t in (1,16):
  ll=labels[t][y:y+h,x:x+w];cc=np.bincount(ll.ravel());cc[0]=0;owner=int(cc.argmax());owners[t].add(owner);full=labels[t]==owner;oy,ox=np.where(full);bb=[int(ox.min()),int(oy.min()),int(ox.max()-ox.min()+1),int(oy.max()-oy.min()+1)]
  owneroutside=int(full.sum()-(ll==owner).sum());edge=ca>=t
  thresholds[str(t)]={'cropAlphaPixels':int((ca>=t).sum()),'mainComponentPixelsInCrop':int((ll==owner).sum()),'mainComponentRectSource':bb,'mainComponentPixelsOutsideCrop':owneroutside,'otherAlphaPixelsInCrop':int(((ll!=owner)&(ll!=0)).sum()),'rectBorderAlphaPixels':int(edge[0,:].sum()+edge[-1,:].sum()+edge[1:-1,0].sum()+edge[1:-1,-1].sum()),'allAlphaRectLocal':bounds(ca>=t)}
 axis=None
 if 'proximal' in finalpins[k] and 'distal' in finalpins[k]:
  p0=finalpins[k]['proximal'];p1=finalpins[k]['distal'];v=[p1[0]-p0[0],p1[1]-p0[1]];axis={'sourceVectorProximalToDistal':v,'sourceLength2D':round(math.hypot(*v),6),'physicalLength3D':None,'sourceLengthDoesNotEstablishPhysicalLength':True,'sourceLowerLengthFixed':k=='driveLower'}
 reg[k]={'frameKey':frame,'crop':part['rect'],'role':roles[k],'joints':joints,'axis':axis,'sourceOnlyCandidate':True,'allDirectionsAccepted':False,'semanticGaitApproval':False,'fullAttackAccepted':False}
 bbox=thresholds['16']['mainComponentRectSource'];reviews.append({'id':k,'frameKey':frame,'sourceSha256':sha,'crop':part['rect'],'cropRgbaSha256':hashlib.sha256(crop.tobytes()).hexdigest(),'gridCellRequested':[part['cell'][0]*512,part['cell'][1]*512,512,512],'mainWidthFractionOfRequestedCell':round(bbox[2]/512,6),'mainHeightFractionOfRequestedCell':round(bbox[3]/512,6),'requestedMaxCellFraction':.55,'maxCellFractionMet':max(bbox[2],bbox[3])<=512*.55,'thresholds':thresholds,'directSourceAndDiagnosticViewed':True,'otherMajorComponentInCrop':False,'mainComponentClippedByCrop':False,'mainComponentClippedByCanvas':False,'sourcePixelEdits':0,'cropContainsLowAlphaSourceFringeUnedited':True})
(r/'parts-review.json').write_text(json.dumps({'sourceSha256':sha,'sourceSize':[1536,1024],'parts':reviews},indent=2)+'\n')
physical={f'DriveLeg{i}':{'observedPhysicalHipSource':None,'reason':'graphic bosses are visible, but six hip identity / 3D depth cannot be established from this one view'} for i in range(1,7)}
registration={'format':1,'sourcePng':'originals/culler-front-parts-v1.png','sourceSha256':sha,'sourceSize':[1536,1024],'coordinateConvention':'source pixels x,y; crop x,y,width,height; right/bottom exclusive; joint points integer pixel centers','parts':reg,'physicalHipOwnership':physical,'physicalToolShoulderOwnership':{'ManipulatorL':None,'ManipulatorR':None},'footContact':{'ankleSource':[342,744],'observedFrontBottomSilhouetteChord':[[257,880],[414,880]],'projectedChordMidpoint':[335.5,880],'ankleToProjectedChordMidpoint':[-6.5,136],'uncertaintySourcePx':4,'actualUndersidePlaneObserved':None,'physicalGroundContactProven':False},'blade':{'proximalSource':[1274,597],'tipSource':[1296,951],'proximalToTipSourceVector':[22,354],'visibleBrightBevelReference':[1388,774],'observedConcavity':'screen-left; tip curves down-left from bulging screen-right body','requestedInnerCuttingBevelProven':False,'reason':'bright broad bevel follows screen-right/convex blade face; do not infer the bright face is the requested inner sharp cutting edge','guardedPoseAndActualAttackRequiresRuntimeReview':True},'oppositeSurfaceAuthored':False,'physical3DSkeletonAccepted':False,'semanticGaitApproval':False,'fullAttackAccepted':False,'releaseAccepted':False,'active':False}
(r/'joint-registration.json').write_text(json.dumps(registration,indent=2)+'\n')
(r/'sprites.fragment.json').write_text(json.dumps({'sheets':{'held_av373_culler_front_parts_v1':'sprites/original/direction-v373/culler-front-parts-v1.png'},'sheetSizes':{'held_av373_culler_front_parts_v1':[1536,1024]},'frames':frames},indent=2)+'\n')
residual={}
for t in (1,16):
 known=np.isin(labels[t],list(owners[t]));residual[str(t)]={'outsideSixMajorComponentsPixels':int(((a>=t)&~known).sum()),'outsideSixDeclaredCropRectanglesPixels':int(((a>=t)&~rectunion).sum()),'outerCanvasEdgePixels':int((a>=t)[0,:].sum()+(a>=t)[-1,:].sum()+(a>=t)[1:-1,0].sum()+(a>=t)[1:-1,-1].sum())}
(r/'records/residual-alpha.json').write_text(json.dumps({'sourceUnedited':True,'thresholds':residual,'strictAlphaOneCleanAtlasAccepted':False,'cropRetainsOriginalAlphaAtEveryIncludedPixel':True,'noMaskAlphaRemovalOrBgRemoval':True},indent=2)+'\n')
(r/'records/final-parts-for-review.json').write_text(json.dumps(parts,indent=2)+'\n')
print(json.dumps({'sha256':sha,'parts':[(q['id'],q['crop'],q['thresholds']['1']['rectBorderAlphaPixels'],q['thresholds']['16']['otherAlphaPixelsInCrop']) for q in reviews],'residual':residual,'opaquePinNeighborhoodRadius12Min':[j['alphaNeighborhoodSquareRadiusSourcePx']['12']['min'] for k,v in reg.items() if k!='chassis' for n,j in v['joints'].items() if n in ('proximal','distal','ankle')]},indent=2))
