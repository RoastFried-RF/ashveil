"""Staging-only held candidate metadata. Never writes sprite pixels."""
import hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
B=Path(__file__).parent
def read(p):return json.loads(Path(p).read_text())
def write(n,d):(B/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
# Manual observations after opening every whole sheet and exact lower-body grid.
# Entries: observed recovery limb(s), confirmed planted paws, unconfirmed paws, note.
OBS={
 'down':[
 (None,['LF','RF'],['LH','RH'],'Both near forepaws planted; requested LH toe-off cannot be traced behind torso.'),
 (['LF'],['RF'],['LH','RH'],'Viewer-right near foreleg recoils/lifts rather than requested LH; hind connection hidden.'),
 (None,['LF','RF'],['LH','RH'],'Two near forefeet planted, one central far paw; LH touchdown ownership not established.'),
 (['LF'],['RF'],['LH','RH'],'Viewer-right near forepaw recovery visible; no independent proof of both hind supports.'),
 (['LF'],['RF'],['LH','RH'],'LF mid-recovery visible; same hidden hind support limitation.'),
 ([],['LF','RF'],['LH','RH'],'Both near forefeet down; LF end pose is a partial observation, not full gait acceptance.'),
 (['RF'],['LF'],['LH','RH'],'Viewer-left nearest FORE paw lifts in intended RH hind row; wrong limb.'),
 (['RF'],['LF'],['LH','RH'],'RF near forepaw recovery repeats intended RH hind mid-swing; wrong limb.'),
 (None,['LF','RF'],['LH','RH'],'Near forefeet down; RH hind touchdown ownership remains hidden.'),
 (['RF'],['LF'],['LH','RH'],'RF near forepaw recovery readable; unseen hinds prevent three-support confirmation.'),
 (['RF'],['LF'],['LH','RH'],'RF recovery readable, but raw6/7 already repeat same forelimb in hind beat.'),
 ([],['LF','RF'],['LH','RH'],'RF touchdown-like forefoot pose; full hind cycle absent.'),
 ],
 'left':[
 (['LH'],['LF','RF','RH'],[],'Near hind LH lifted; partial correct LH toe-off silhouette.'),
 (['LH','RH'],['LF','RF'],[],'Both hind paws are curled/lifted; violates single recovery and three planted supports.'),
 ([],['LF','RF','LH','RH'],[],'Four pads down, partial LH landing-like pose; row middle already has two hind recoveries.'),
 (['RF'],['LF','LH','RH'],[],'Far fore RF starts recovery although this is intended near LF row.'),
 (['LF'],['LH','RH'],['RF'],'Near LF recovery replaces raw3 far RF; ownership switches within one three-stage step; far fore support obscured.'),
 ([],['LF','RF','LH','RH'],[],'Forefeet down; partial static landing geometry, not continuous ownership from raw3.'),
 (['RH'],['LF','RF','LH'],[],'Faces RIGHT, not LEFT; near-right hind recovery readable only in wrong heading.'),
 (['LH','RH'],['LF','RF'],[],'Faces RIGHT and both hind paws curl up, two-support failure.'),
 ([],['LF','RF','LH','RH'],[],'Faces RIGHT; all paws down does not repair left clip.'),
 (['LH'],['LF','RF','RH'],[],'Faces RIGHT; far hind recovers in intended RF FORE beat.'),
 (['LH'],['LF','RF','RH'],[],'Faces RIGHT and far hind stays raised while intended RF forefeet remain down.'),
 ([],['LF','RF','LH','RH'],[],'Faces RIGHT; far fore extends, full direction remains wrong.'),
 ],
 'right':[
 (['RH'],['LF','RF','LH'],[],'Near RH recovers instead of intended far LH.'),
 (['LH','RH'],['LF','RF'],[],'Both hind paws curl/lift; cannot be a single far-LH recovery with three supports.'),
 (['LF'],['RF','LH','RH'],[],'Hinds grounded but far FORE LF is flexed during intended LH touchdown.'),
 (['LF'],['RF','LH','RH'],[],'Far LF recovery is readable; partial correct LF first stage.'),
 (['RF'],['LF','LH','RH'],[],'Near RF replaces far LF within the same requested LF step; shoulder ownership changes.'),
 ([],['LF','RF','LH','RH'],[],'Four paws down; partial landing pose cannot fix prior ownership switch.'),
 ([],['LF','RF','LH','RH'],[],'Near hind is still down; requested toe-off progression not clear.'),
 (['RH'],['LF','RF','LH'],[],'Near RH mid-recovery readable as a partial pose.'),
 ([],['LF','RF','LH','RH'],[],'Four paws down, partial RH end pose; whole twelve-step cycle still fails.'),
 (['LF'],['RF','LH','RH'],[],'Far LF lifts in intended near RF row.'),
 (['RF'],['LF','LH','RH'],[],'Near RF recovery follows far LF raw9, changing owner within three-stage step.'),
 ([],['LF','RF','LH','RH'],[],'Forefeet down, partial landing shape; raw9/10 are not same-limb subphases.'),
 ],
 'up':[
 (['LH'],['RH','RF'],['LF'],'Left hind sole visible; one far foreleg is obscured so three planted supports unconfirmed.'),
 (['LH'],['RH','RF'],['LF'],'LH recovery readable, far LF contact remains hidden.'),
 (['RH'],['LH','RF'],['LF'],'Right hind now shortened/recovering during requested LEFT-hind landing; ownership switches.'),
 (['LF'],['LH','RH'],['RF'],'Outside-left fore recovery readable, far/right fore path disappears behind body.'),
 (['LF'],['LH','RH'],['RF'],'LF mid-recovery readable, RF support not confirmed.'),
 ([],['LF','LH','RH'],['RF'],'LF down with both hinds; fourth fore support still occluded.'),
 (['RH'],['LF','LH'],['RF'],'RH sole visible and left fore appears down; RF path obscured.'),
 (['RH'],['LF','LH'],['RF'],'RH recovery visible; same unknown RF support.'),
 (['LF'],['LH','RH'],['RF'],'Both hinds down but outside-left FORE is flexed in RH touchdown; extra phase change.'),
 (['RF'],['LH','RH'],['LF'],'Outside-right fore recovery visible, left fore hidden.'),
 (['RH'],['LH'],['LF','RF'],'Large near RIGHT-HIND sole replaces expected far RF fore mid-swing; wrong limb.'),
 ([],['RF','LH','RH'],['LF'],'Right fore is down, left fore unconfirmed; full rear twelve-step chain not established.'),
 ],
}
GROUND={
 'down':[[260,307],[631,307],[1000,313],[260,603],[625,603],[1003,608],[259,905],[627,909],[1003,909],[251,1203],[620,1208],[1001,1213]],
 'left':[[225,317],[628,319],[1039,318],[222,604],[629,598],[1042,605],[224,896],[631,894],[1038,897],[219,1187],[617,1187],[1038,1186]],
 'right':[[230,309],[656,309],[1054,309],[229,605],[651,598],[1058,603],[233,913],[660,915],[1059,913],[239,1208],[645,1195],[1054,1205]],
 'up':[[305,299],[629,300],[968,301],[307,610],[628,611],[965,602],[300,912],[626,913],[978,919],[300,1231],[630,1225],[981,1224]],
}
a=read(B/'source-analysis.json');candidates={'format':1,'activationReady':False,'candidateOnly':True,'frames':{}};review={'format':1,'activationReady':False,'approvedFullClips':0,'approvedRuntimeFrames':0,'notation':'Anatomical LF/RF/LH/RH. null recovery means not established from visible limbs; empty recovery means no obvious raised paw, not an approved full contact event.','directions':{}};registration={'format':1,'candidateFrames':{}}
for direction in ['down','left','right','up']:
 name=f'cinder-bear-walk-{direction}-v1.png';meta=a[name];im=Image.open(B/'originals'/name).convert('RGBA');alpha=np.asarray(im.getchannel('A'));labels,_=ndimage.label(alpha>=16,structure=np.ones((3,3)));areas=np.bincount(labels.ravel());slices=ndimage.find_objects(labels)
 frames=[]
 for r in meta['regionsAlpha16Area400']:
  i=r['rawSourceIndex'];key=f'held_av345_cinder_bear_walk_{direction}_raw{i}';x,y,w,h=r['crop'];gx,gy=GROUND[direction][i];scale=.13 if direction in ['down','up'] else .11
  observedFacing='right' if direction=='left' and i>=6 else direction;recovering,ground,unknown,note=OBS[direction][i]
  candidates['frames'][key]={'original':name,'rawSourceIndex':i,'candidateSourceRegion':[x,y,w,h],'proposedGroundSheetPoint':[gx,gy],'proposedGroundCropPoint':[gx-x,gy-y],'proposedTransform':{'anchor':[(gx-x)/w,(gy-y)/h],'scale':scale},'rgbaCropSha256':r['rgbaCropSha256'],'approved':False,'notRuntimeSpriteFrame':True}
  frameReview={'candidateKey':key,'rawSourceIndex':i,'requestedFacing':direction,'observedFacing':observedFacing,'requestedLimb':['LH','LF','RH','RF'][i//3],'requestedSubphase':['toe-off','mid-swing','touchdown'][i%3],'observedRecoveringPaws':recovering,'confirmedPlantedPaws':ground,'unconfirmedPaws':unknown,'observation':note,'approved':False,'fullClipStatus':'held'};frames.append(frameReview)
  own=next(n for n,sl in enumerate(slices,1) if sl is not None and [sl[1].start,sl[0].start,sl[1].stop,sl[0].stop]==r['bbox']);other=np.unique(labels[y:y+h,x:x+w]);foreign=sum(int((labels[y:y+h,x:x+w]==n).sum()) for n in other if n and n!=own and areas[n]>=400)
  registration['candidateFrames'][key]={'insideSource':x>=0 and y>=0 and x+w<=im.width and y+h<=im.height,'otherLargeSilhouettePixelsAlpha16':foreign,'rgbaCropSha256':r['rgbaCropSha256']}
 review['directions'][direction]={'requestedSourcePoses':12,'fullClipAccepted':False,'frames':frames}
registration['summary']={'rawPngs':4,'candidateCells':48,'candidateRgbaHashes':len({v['rgbaCropSha256'] for v in registration['candidateFrames'].values()}),'candidateCropsInsideSource':sum(v['insideSource'] for v in registration['candidateFrames'].values()),'otherLargeSilhouettePixelsAlpha16':sum(v['otherLargeSilhouettePixelsAlpha16'] for v in registration['candidateFrames'].values()),'approvedFrames':0,'approvedFullClips':0,'runtimeCharDefs':0,'mirroredCopiedReversedInterpolatedFrames':0}
write('candidate-crops.json',candidates);write('source-review.json',review);write('registration-analysis.json',registration)
write('sprites.fragment.json',{'sheets':{},'sheetSizes':{},'frames':{},'chars':{}})
records=[]
for record in read(B/'generation-records.json'):
 args=read(B/record['request']);records.append({**record,'toolVersionDisclosed':False,'exactArguments':args,'requestSha256':sha(B/record['request']),'inputs':[{'path':p,'sha256':sha(p)} for p in args['referenced_image_paths']],'originalEqualsToolOutputBytes':(B/record['original']).read_bytes()==Path(record['toolOutput']).read_bytes(),'status':'held-density-phase-model-contract-failure'})
seen=sorted({x['path'] for r in records for x in r['inputs']})
write('provenance.json',{'format':1,'date':'2026-10-24','activationReady':False,'generationCalls':4,'rounds':1,'retries':0,'otherSpeciesOrMotions':0,'newPixelTool':'image_gen.imagegen','thirdPartyPixelsUsed':False,'pngReencoded':False,'copiedReversedInterpolatedPixels':False,'directlyReopenedOwnReferencePngs':[{'path':p,'sha256':sha(p)} for p in seen],'commonModelReferences':'v334 idle/swipe-v2/bite-v3 are same first three inputs to all four calls; direction-specific fourth input is guidance only.','records':records})
write('activation-contract.json',{'format':1,'activationReady':False,'newCandidateCells':48,'acceptedDensityClips':0,'acceptedRuntimeFrames':0,'runtimeCharDefs':0,'noFillingFromOtherRowsDirectionsOrOldFrames':True,'existingApprovedBasicSourcesPreserved':True,'sourceLimit':'Only the raw candidate count is48. Do not claim48 accepted animation frames, four-direction12-pose completion, or v1 release acceptance.','minimumFollowup':'Parent will inspect actual native size/movement/transition of previously clear basic source poses separately. This task performs no further generation or automatic retry; do not mirror/copy/reverse rows to fill density failures.'})
write('playback-contract.json',{'format':1,'activationReady':False,'requestedFourBeatSubphases':['LH toe-off','LH mid-swing','LH touchdown','LF toe-off','LF mid-swing','LF touchdown','RH toe-off','RH mid-swing','RH touchdown','RF toe-off','RF mid-swing','RF touchdown'],'unappliedCycleProposalMs':1440,'unappliedUniformPoseProposalMs':120,'actualUsableClip':False,'timingNotApplied':True,'coreTimeUnitsOrResourcesChanged':False})
print(json.dumps(registration['summary'],indent=2))
