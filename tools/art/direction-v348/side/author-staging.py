"""Staging-only metadata/provenance and labelled read-only diagnostics.

Pillow never writes replacement art or changes original PNG bytes.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

BASE=Path(__file__).parent
REPO=Path('/workspace/ashveil')
OUT=Path('/tmp/ashveil-v342-cinder-bear-walk')
OUT.mkdir(parents=True,exist_ok=True)
def write(name,data): (BASE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def read(path): return json.loads(Path(path).read_text())
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

ANALYSIS=read(BASE/'source-analysis.json')
ORDERS={'left':[0,1,2,3],'right':[2,1,0,3],'up':None}
GROUND={
 'left':[[335,578],[946,570],[335,1131],[946,1131]],
 'right':[[335,590],[943,589],[338,1100],[941,1087]],
 'up':[[346,590],[926,589],[353,1149],[925,1145]],
}
PAWS={
 'left':[
  {'LF':([292,565],'planted'),'RF':([129,552],'planted'),'LH':([562,520],'swing'),'RH':([432,535],'planted')},
  {'LF':([822,518],'swing'),'RF':([879,550],'planted'),'LH':([1171,550],'planted'),'RH':([1031,533],'planted')},
  {'LF':([292,1113],'planted'),'RF':([133,1105],'planted'),'LH':([570,1099],'planted'),'RH':([438,1080],'swing')},
  {'LF':([881,1115],'planted'),'RF':([793,1058],'swing'),'LH':([1161,1103],'planted'),'RH':([1041,1084],'planted')},
 ],
 'right':[
  {'RF':([391,575],'planted'),'LF':([535,551],'planted'),'RH':([92,513],'swing'),'LH':([220,537],'planted')},
  {'RF':([991,575],'planted'),'LF':([1130,536],'swing'),'RH':([730,558],'planted'),'LH':([850,538],'planted')},
  {'RF':([361,1088],'planted'),'LF':([530,1065],'planted'),'RH':([106,1056],'planted'),'LH':([174,1044],'swing')},
  {'RF':([1054,1045],'swing'),'LF':([1005,1071],'planted'),'RH':([719,1062],'planted'),'LH':([855,1057],'planted')},
 ],
 'up':[
  {'LH':([232,545],'swing'),'RH':([456,579],'planted'),'unknownFore':([309,521],'planted')},
  {'LH':([809,579],'planted'),'RH':([1052,579],'planted'),'unknownFore':([940,524],'swing')},
  {'LH':([234,1140],'planted'),'RH':([470,1092],'swing'),'unknownFore':([380,1116],'planted')},
  {'LH':([809,1138],'planted'),'RH':([1052,1135],'planted'),'unknownFore':([911,1097],'swing')},
 ],
}
fragment={'sheets':{},'sheetSizes':{},'frames':{},'chars':{}}
partial={'format':1,'activationReady':False,'intendedCharacterKey':'av331_cinder_bear','clips':{'walk':{}},'frameTransforms':{},'sourceOrder':ORDERS,'notRuntimeCharDef':True,'missingAcceptedDirections':['up'],'previousFrontDirection':'v334 down4 exists as separate partial; model consistency remains pending'}
candidate={'format':1,'activationReady':False,'regions':{},'sourceOrder':ORDERS}
anchors={'format':1,'activationReady':False,'frames':{}}
review={'format':1,'activationReady':False,'pointMeaning':'Manual approximate visible paw centres in original sheet pixels for labelled diagnostic review, not runtime contacts or exact hitboxes. LF/RF/LH/RH are anatomical left/right front/hind. Unknown fore remains unknown.','directions':{}}
registration={'format':1,'frames':{}}
for direction in ['left','right','up']:
 filename=f'cinder-bear-walk-{direction}-v1.png'; sheet=f'av342_cinder_bear_walk_{direction}_v1';meta=ANALYSIS[filename]
 image=Image.open(BASE/'originals'/filename).convert('RGBA');alpha=np.asarray(image.getchannel('A'));labels,n=ndimage.label(alpha>=16,structure=np.ones((3,3)));areas=np.bincount(labels.ravel());slices=ndimage.find_objects(labels)
 accepted=ORDERS[direction] is not None
 if accepted:
  fragment['sheets'][sheet]='sprites/original/direction-v342/'+filename;fragment['sheetSizes'][sheet]=meta['size'];partial['clips']['walk'][direction]=[]
 diagnostic=Image.new('RGBA',image.size,(47,45,39,255));diagnostic.alpha_composite(image);draw=ImageDraw.Draw(diagnostic)
 directionReview={'status':'staging-four-pose-proposal' if accepted else 'held-unconfirmed-forelimb-ownership','sourceReadingOrder':[0,1,2,3],'proposedPlaybackSourceOrder':ORDERS[direction],'rawFrames':[]}
 for region in meta['regionsAlpha16Area400']:
  raw=region['index'];x,y,w,h=region['crop'];gx,gy=GROUND[direction][raw];scale=.075 if accepted else .085
  key=f'av342_cinder_bear_walk_{direction}{ORDERS[direction].index(raw)}' if accepted else f'held_v342_cinder_bear_walk_up_raw{raw}'
  crop=[x,y,w,h];transform={'anchor':[(gx-x)/w,(gy-y)/h],'scale':scale};digest=hashlib.sha256(image.crop((x,y,x+w,y+h)).tobytes()).hexdigest()
  candidate['regions'][key]={'source':filename,'rawSourceIndex':raw,'crop':crop,'groundSheet':[gx,gy],'proposedTransform':transform,'status':directionReview['status'],'rgbaCropSha256':digest}
  if accepted:
   fragment['frames'][key]=[sheet,*crop];partial['frameTransforms'][key]=transform;partial['clips']['walk'][direction].append((ORDERS[direction].index(raw),key))
   anchors['frames'][key]={'source':filename,'rawSourceIndex':raw,'originalSheetPoint':[gx,gy],'cropPoint':[gx-x,gy-y],'kind':'bear-body-ground-projection','flipX':False,'notIndividualPawContact':True}
   ownlabel=next(i for i,sl in enumerate(slices,1) if sl is not None and [sl[1].start,sl[0].start,sl[1].stop,sl[0].stop]==region['bbox'])
   other=np.unique(labels[y:y+h,x:x+w]);foreign=sum(int((labels[y:y+h,x:x+w]==i).sum()) for i in other if i and i!=ownlabel and areas[i]>=400)
   registration['frames'][key]={'source':filename,'rawSourceIndex':raw,'crop':crop,'insideSource':x>=0 and y>=0 and x+w<=image.width and y+h<=image.height,'otherLargeSilhouettePixelsAlpha16':foreign,'rgbaCropSha256':digest,'displaySize':[w*scale,h*scale]}
  paws={name:{'sourcePoint':point,'state':state} for name,(point,state) in PAWS[direction][raw].items()}
  if direction=='up': paws.update({'LF':{'sourcePoint':None,'state':'ownership-unconfirmed'},'RF':{'sourcePoint':None,'state':'ownership-unconfirmed'}})
  directionReview['rawFrames'].append({'rawSourceIndex':raw,'paws':paws,'individuallyIdentifiedPaws':4 if accepted else 2,'frontPawOwnershipConfirmed':accepted})
  draw.rectangle((x,y,x+w-1,y+h-1),outline=(145,155,104,255));draw.text((x,y-15),f'raw{raw} '+('proposal phase'+str(ORDERS[direction].index(raw)) if accepted else 'HELD fore ownership'),fill=(245,231,188,255))
  for name,(point,state) in PAWS[direction][raw].items():
   px,py=point;color=(240,157,100,255) if state=='swing' else (163,209,137,255);draw.ellipse((px-5,py-5,px+5,py+5),outline=color,width=2);draw.text((px+7,py-12),name+' '+state,fill=color)
  draw.line((gx-12,gy,gx+12,gy),fill=(249,229,129,255),width=2);draw.line((gx,gy-10,gx,gy+10),fill=(249,229,129,255),width=2)
 review['directions'][direction]=directionReview
 diagnostic.convert('RGB').save(OUT/f'{direction}-paw-review-diagnostic.png')
for direction,frames in partial['clips']['walk'].items(): partial['clips']['walk'][direction]=[key for _,key in sorted(frames)]
hashes=[r['rgbaCropSha256'] for r in registration['frames'].values()]
registration['summary']={'newOriginalPngs':3,'candidateCells':12,'registeredStagingProposals':len(hashes),'heldCells':4,'insideSource':sum(r['insideSource'] for r in registration['frames'].values()),'uniqueRegisteredRgbaCrops':len(set(hashes)),'otherLargeSilhouettePixelsAlpha16':sum(r['otherLargeSilhouettePixelsAlpha16'] for r in registration['frames'].values()),'mirroredAliases':0,'reverseReusedSourceFrames':0,'runtimeCharDefs':0}
for name,data in [('sprites.fragment.json',fragment),('cinder-bear.walk.partial.json',partial),('candidate-crops.json',candidate),('foot-anchors.json',anchors),('paw-review.json',review),('registration-analysis.json',registration)]:write(name,data)

records=[]
for item in read(BASE/'generation-records.json'):
 args=read(BASE/item['request']);original=BASE/item['original'];records.append({**item,'tool':'image_gen.imagegen','toolVersionDisclosed':False,'exactArguments':args,'requestSha256':sha(BASE/item['request']),'inputs':[{'path':path,'sha256':sha(path)} for path in args['referenced_image_paths']],'originalEqualsToolOutputBytes':original.read_bytes()==Path(item['toolOutput']).read_bytes(),'status':review['directions'][item['direction']]['status']})
prior=Path('/workspace/.ashveil-planned/v334-fauna-art')
seen=['cinder-bear-idle-v1.png','cinder-bear-swipe-v2.png','cinder-bear-bite-v3.png','cinder-bear-walk-down-v1.png','cinder-bear-walk-left-v1.png','cinder-bear-walk-right-v1.png','cinder-bear-walk-up-v1.png']
sourceFiles=['docs/lore/bestiary.md','tools/content-plans/expanded-creatures-v331/core-fragment/defs/bodies-v331.json','tools/content-plans/expanded-creatures-v331/core-fragment/defs/creatures-v331.json','.agents/skills/ashveil-character-motion/SKILL.md']
write('provenance.json',{'format':1,'date':'2026-10-24','activationReady':False,'newPixelTool':'image_gen.imagegen','noThirdPartyPixels':True,'pngReencoded':False,'generationRounds':1,'noRetries':True,'records':records,'directlyReopenedPriorOriginals':{name:sha(prior/'originals'/name) for name in seen},'priorFailureRecord':{'path':str(prior/'README.md'),'sha256':sha(prior/'README.md')},'reviewedSourceHashes':{name:sha(REPO/name) for name in sourceFiles},'priorReferencesNotNewV342Art':True})
bodies=read(REPO/sourceFiles[1]);creatures=read(REPO/sourceFiles[2]);body=next(d for d in bodies if d.get('id')=='Body.CinderBear');creature=next(d for d in creatures if d.get('id')=='Creature.CinderBear')
write('scope-contract.json',{'format':1,'activationReady':False,'body':body,'creature':creature,'target':'missing left/right/up each4 =12 basic four-phase source poses; not 12 poses per direction','boundedGeneration':'one proposal image per direction, three calls total; no retries','newProposalLeftRightFrames':8,'upHeldFrames':4,'reasonUpHeld':'Hind left/right recovery alternates, but central underbelly fore sole in raw1/raw3 is not traceable to opposite anatomical front legs; hidden connection cannot be sold as manually confirmed.','minimumNextAlternative':'Do not enlarge/regenerate another whole sheet. Need a vetted single-direction bear forelimb path/pose guide or separate LF/RF recovery poses with both shoulder-to-paw connections exposed for structural review before a future image_gen request. Do not activate or mirror/reverse-fill missing up frames.'})
write('playback-contract.json',{'format':1,'activationReady':False,'proposalCycleMs':1400,'sourceKeyPosesPerDirection':4,'uniformPoseMs':350,'sourceOrder':ORDERS,'leftRightPhaseOrder':['LH recovery','LF recovery','RH recovery','RF recovery'],'suggestedGaitNotApplied':True,'coreMoveTuNotChanged':True,'loreMoveTu':90,'draftCreatureMoveTu':100,'differenceIsExistingNotResolvedByArt':True,'notTwelveFrameDensity':True,'actualDistanceFootSlideAndSpeedNotAccepted':True})
write('activation-contract.json',{'format':1,'activationReady':False,'runtimeCharDefWritten':False,'stagingSourcePoseProposals':8,'heldSourceCells':4,'existingV334BearPreserved':True,'missing':['confirmed rear forelimb alternation','front and all new direction model consistency with v334 idle/swipe/bite','real movement distance/cycle cadence/weight and foot sliding acceptance','full higher frame density and further body states/portraits/damage masks','Core creature behavior and parent runtime integration/release acceptance'],'doNotActivateFromThisFragment':True})
print(json.dumps(registration['summary'],indent=2))
