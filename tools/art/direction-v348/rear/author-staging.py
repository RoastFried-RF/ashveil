"""Unmodified source metadata plus clearly labelled read-only diagnostics."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage

B=Path(__file__).parent
OUT=Path('/tmp/ashveil-v344-cinder-bear-rear-walk');OUT.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(Path(p).read_text())
def write(name,data):(B/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
filename='cinder-bear-walk-up-v1.png';sheet='av344_cinder_bear_walk_up_v1'
source=B/'originals'/filename;image=Image.open(source).convert('RGBA');meta=read(B/'source-analysis.json')[filename]
GROUND=[[355,588],[933,582],[360,1200],[934,1205]]
PAWS=[
 {'LF':([158,431],'planted'),'RF':([550,430],'planted'),'LH':([266,538],'swing'),'RH':([427,576],'planted')},
 {'LF':([736,392],'swing'),'RF':([1120,430],'planted'),'LH':([853,570],'planted'),'RH':([1017,575],'planted')},
 {'LF':([153,1055],'planted'),'RF':([547,1056],'planted'),'LH':([278,1190],'planted'),'RH':([442,1132],'swing')},
 {'LF':([746,1056],'planted'),'RF':([1164,1006],'swing'),'LH':([849,1195],'planted'),'RH':([1035,1179],'planted')},
]
FORE_PATHS=[
 {'LF':[[192,235],[158,335],[158,431]],'RF':[[520,237],[544,341],[550,430]]},
 {'LF':[[779,232],[747,325],[736,392]],'RF':[[1093,232],[1119,330],[1120,430]]},
 {'LF':[[195,860],[155,966],[153,1055]],'RF':[[520,860],[550,967],[547,1056]]},
 {'LF':[[779,860],[750,966],[746,1056]],'RF':[[1095,861],[1157,954],[1164,1006]]},
]
fragment={'sheets':{sheet:'sprites/original/direction-v344/'+filename},'sheetSizes':{sheet:meta['size']},'frames':{},'chars':{}}
partial={'format':1,'activationReady':False,'intendedCharacterKey':'av331_cinder_bear','notRuntimeCharDef':True,'clips':{'walk':{'up':[]}},'frameTransforms':{},'sourceReadingOrder':[0,1,2,3]}
anchors={'format':1,'activationReady':False,'frames':{}}
review={'format':1,'activationReady':False,'sourceOnlyAcceptance':'four basic rear source poses proposed; runtime, model unification and release acceptance pending','pawNotation':'LF/RF/LH/RH anatomical left/right front/hind; in a rear view left is viewer left. Points and paths are approximate manual display diagnostics, not exact Body hitboxes or runtime contacts.','frames':{}}
registration={'format':1,'frames':{}}
alpha=np.asarray(image.getchannel('A'));labels,_=ndimage.label(alpha>=16,structure=np.ones((3,3)));areas=np.bincount(labels.ravel());slices=ndimage.find_objects(labels)
diagnostic=Image.new('RGBA',image.size,(48,46,40,255));diagnostic.alpha_composite(image);draw=ImageDraw.Draw(diagnostic)
for region in meta['regionsAlpha16Area400']:
 i=region['index'];key=f'av344_cinder_bear_walk_up{i}';x,y,w,h=region['crop'];gx,gy=GROUND[i];tr={'anchor':[(gx-x)/w,(gy-y)/h],'scale':.07}
 fragment['frames'][key]=[sheet,x,y,w,h];partial['clips']['walk']['up'].append(key);partial['frameTransforms'][key]=tr
 anchors['frames'][key]={'source':filename,'originalSheetPoint':[gx,gy],'cropPoint':[gx-x,gy-y],'kind':'bear-body-ground-projection','notIndividualPawContact':True,'flipX':False}
 review['frames'][key]={'rawSourceIndex':i,'visiblePawOwnership':{k:{'sourcePoint':pt,'state':state} for k,(pt,state) in PAWS[i].items()},'forelimbApproximateVisiblePaths':FORE_PATHS[i],'fourPawOwnershipConfirmedInSource':True,'visiblePlantedPaws':3,'sourceSwingPaw':['LH','LF','RH','RF'][i],'rearFacingNoVisibleFace':True,'bodyLowQuadruped':True,'unknownPaws':[],'runtimeAcceptance':False}
 own=next(n for n,sl in enumerate(slices,1) if sl is not None and [sl[1].start,sl[0].start,sl[1].stop,sl[0].stop]==region['bbox']);other=np.unique(labels[y:y+h,x:x+w]);foreign=sum(int((labels[y:y+h,x:x+w]==n).sum()) for n in other if n and n!=own and areas[n]>=400)
 registration['frames'][key]={'rawSourceIndex':i,'crop':[x,y,w,h],'insideSource':x>=0 and y>=0 and x+w<=image.width and y+h<=image.height,'otherLargeSilhouettePixelsAlpha16':foreign,'rgbaCropSha256':hashlib.sha256(image.crop((x,y,x+w,y+h)).tobytes()).hexdigest(),'displaySize':[w*.07,h*.07]}
 draw.rectangle((x,y,x+w-1,y+h-1),outline=(156,164,114,255));draw.text((x,y+2),f'raw{i} source proposal: '+review['frames'][key]['sourceSwingPaw']+' recovery',fill=(250,233,187,255))
 for name,(pt,state) in PAWS[i].items():
  px,py=pt;color=(246,164,104,255) if state=='swing' else (159,214,143,255);draw.ellipse((px-5,py-5,px+5,py+5),outline=color,width=2);draw.text((px+7,py-14),name+' '+state,fill=color)
 for name,path in FORE_PATHS[i].items():draw.line([tuple(pt) for pt in path],fill=(136,184,205,255),width=2)
 draw.line((gx-15,gy,gx+15,gy),fill=(242,220,133,255),width=2);draw.line((gx,gy-10,gx,gy+10),fill=(242,220,133,255),width=2)
diagnostic.convert('RGB').save(B/'diagnostics'/'paw-paths-source-diagnostic.png')
vals=list(registration['frames'].values());registration['summary']={'newOriginalPngs':1,'candidateCells':4,'stagingSourcePoseProposals':4,'uniqueRgbaCrops':len({v['rgbaCropSha256'] for v in vals}),'insideSource':sum(v['insideSource'] for v in vals),'otherLargeSilhouettePixelsAlpha16':sum(v['otherLargeSilhouettePixelsAlpha16'] for v in vals),'mirroredAliases':0,'reverseReusedSourceFrames':0,'runtimeCharDefs':0}
for name,data in [('sprites.fragment.json',fragment),('cinder-bear.walk-up.partial.json',partial),('foot-anchors.json',anchors),('paw-review.json',review),('registration-analysis.json',registration)]:write(name,data)
record=read(B/'generation-records.json')[0];args=read(B/record['request'])
seen=args['referenced_image_paths']+['/workspace/.ashveil-planned/v342-cinder-bear-walk/originals/cinder-bear-walk-up-v1.png']
write('provenance.json',{'format':1,'date':'2026-10-24','activationReady':False,'newPixelTool':'image_gen.imagegen','toolVersionDisclosed':False,'generationCalls':1,'generatedOutputs':1,'candidateCells':4,'retries':0,'otherMotionsOrSpecies':0,'noThirdPartyPixels':True,'pngReencoded':False,'exactArguments':args,'requestSha256':sha(B/record['request']),'toolOutput':record['toolOutput'],'original':record['original'],'originalSha256':sha(source),'originalEqualsToolOutputBytes':source.read_bytes()==Path(record['toolOutput']).read_bytes(),'inputs':[{'path':p,'sha256':sha(p)} for p in args['referenced_image_paths']],'directlyReopenedReferences':[{'path':p,'sha256':sha(p)} for p in seen],'previousUnacceptedRearPreserved':True,'previousFailureRecord':{'path':'/workspace/.ashveil-planned/v342-cinder-bear-walk/README.md','sha256':sha('/workspace/.ashveil-planned/v342-cinder-bear-walk/README.md')},'analysisOnly':['Pillow source read, hashes, alpha/crop bounds, clearly labelled display composites','NumPy/SciPy source connected regions']})
write('activation-contract.json',{'format':1,'activationReady':False,'newBasicRearSourcePoseProposals':4,'sourceOnlyFourPawOwnershipConfirmed':True,'releaseAcceptance':False,'runtimeCharDefWritten':False,'missing':['same individual model/relative-size acceptance with front,left,right and v334 idle/swipe/bite','actual movement, ground projection, collision/occlusion and foot sliding acceptance','higher motion density and remaining poses/portraits/damage-state masks','parent Core/AI/runtime integration and publication acceptance'],'sourceOnlyNotTwelveFrameDensity':True,'mainFilesChanged':False})
write('playback-contract.json',{'format':1,'activationReady':False,'proposalCycleMs':1400,'uniformPoseMs':350,'poseSourceOrder':[0,1,2,3],'poseOrder':['LH recovery','LF recovery','RH recovery','RF recovery'],'notAppliedToGame':True,'coreMoveTuOrResourcesChanged':False,'notTwelveFrameDensity':True,'relativeMotionDistanceNotChecked':True})
print(json.dumps(registration['summary'],indent=2))
