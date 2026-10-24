"""Read-only source alpha/crop analysis, no image edits. Emit inactive candidates."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label,find_objects
import numpy as np,json,hashlib
P=Path(__file__).resolve().parent;M=['hurt','fall','sleep','rise','work'];D=['down','left','right','up'];SCALE=.14

def write(n,v):(P/n).write_text(json.dumps(v,ensure_ascii=False,indent=2,default=int)+'\n')
frames={};sheets={};sizes={};allFrames={};allTr={};anchors={};analysis=[];clips={m:{} for m in M};held=[];geometry=[]
xs={'down':[165,479,789,1098],'left':[190,500,810,1118],'right':[163,475,785,1095],'up':[163,477,789,1098]}
for m in M:
 src=P/'originals'/f'cinder-bear-{m}-v1.png';im=Image.open(src).convert('RGBA');ar=np.array(im);a=ar[:,:,3];H,W=a.shape;lab,_=label(a>=16);objects=[]
 for i,sl in enumerate(find_objects(lab),1):
  if sl is not None and np.count_nonzero(lab[sl]==i)>=800:objects.append({'id':i,'bbox':[sl[1].start,sl[0].start,sl[1].stop,sl[0].stop]})
 assert len(objects)==16,(m,len(objects));large={x['id'] for x in objects};objects.sort(key=lambda v:(v['bbox'][1]+v['bbox'][3])/2);rows=[sorted(objects[r*4:(r+1)*4],key=lambda v:v['bbox'][0]) for r in range(4)];sheet=f'av346_cinder_bear_{m}_v1';sheets[sheet]=f'sprites/original/direction-v346/cinder-bear-{m}-v1.png';sizes[sheet]=[W,H]
 for r,d in enumerate(D):
  group=[];bad=[]
  for c,obj in enumerate(rows[r]):
   bx,by,bx2,by2=obj['bbox'];selected=None;tests=[]
   for pad in [3,2,1,0]:
    x=max(0,bx-pad);y=max(0,by-pad);x2=min(W,bx2+pad);y2=min(H,by2+pad);other=sorted((set(np.unique(lab[y:y2,x:x2]))&large)-{obj['id']});tests.append({'padding':pad,'otherComponents':other})
    if not other and pad>=1 and bx>0 and by>0 and bx2<W and by2<H:selected=(x,y,x2,y2,pad);break
   safe=selected is not None
   if selected is None:selected=(max(0,bx-3),max(0,by-3),min(W,bx2+3),min(H,by2+3),3)
   x,y,x2,y2,pad=selected;w=x2-x;h=y2-y;key=f'av346_cinder_bear_{m}_{d}{c}';allFrames[key]=[sheet,x,y,w,h];group.append(key)
   gx=xs[d][c];gy=by2-2;anchor=[(gx-x)/w,(gy-y)/h];allTr[key]={'anchor':anchor,'scale':SCALE};anchors[key]={'source':str(src.relative_to(P)),'originalSheetPoint':[gx,gy],'cropPoint':[gx-x,gy-y],'kind':'review-candidate body-ground projection','selection':'Approximate nominal footprint/body-ground base chosen from observed stance/rest band; not a per-limb contact assertion.','contactVisibility':'Near paw/body contacts visible; far folded legs can be partly occluded. No fabricated contact point for hidden limb.','state':m,'geometrySafe':safe}
   crop=ar[y:y2,x:x2];foreign=sorted((set(np.unique(lab[y:y2,x:x2]))&large)-{obj['id']});border=int(np.count_nonzero(crop[0,:,3]>=16)+np.count_nonzero(crop[-1,:,3]>=16)+np.count_nonzero(crop[:,0,3]>=16)+np.count_nonzero(crop[:,-1,3]>=16));row={'frame':key,'motion':m,'direction':d,'index':c,'componentId':obj['id'],'sourceBBoxAlpha16':obj['bbox'],'crop':[x,y,w,h],'paddingPx':pad,'sourceRGBACropSHA256':hashlib.sha256(crop.tobytes()).hexdigest(),'otherLargeComponents':foreign,'opaqueCropBorderPixelsAlpha16':border,'geometrySafe':safe,'paddingTrials':tests};analysis.append(row)
   if not safe:bad.append(key)
  if bad:held.append({'motion':m,'direction':d,'frames':group,'unsafeFrames':bad,'reason':'A complete source-body rectangle includes another large bear even at0padding; cannot fix by cropping/scale. Entire4pose direction held.'})
  else:
   clips[m][d]=group
   for key in group:frames[key]=allFrames[key]
  geometry.append({'motion':m,'direction':d,'geometrySafe':not bad,'unsafeFrames':bad})
write('candidate-crops.json',{'scope':'All80 candidate rectangles including unsafe held regions; not registry','frames':allFrames,'frameTransforms':allTr,'active':False})
write('registration-analysis.json',{'generatedOriginalPNGs':5,'generatedCandidateRegions':80,'proposedRegistryRegionsGeometryOnly':len(frames),'geometryHeldDirections':held,'frames':analysis,'active':False,'semanticReview':'pending final source-crop/support comparison'})
write('sprites.fragment.json',{'sheets':sheets,'sheetSizes':sizes,'frames':frames})
partial={'character':'av331_cinder_bear','active':False,'activationReady':False,'scope':'Partial state-motion authoring proposal, not full runtime character. Preserve existing idle/walk/swipe/bite.','motions':clips,'frameTransforms':{k:allTr[k] for k in frames},'proposedMotionDurations':{'hurt':480,'fall':900,'sleep':5200,'rise':1200,'work':2000},'globalFallRuntimeCaveat':'Current fall presentation may use global fall duration rather than char override; parent must inspect runtime.','heldDirections':held,'bodyScale':SCALE};write('cinder-bear.states.partial.json',partial)
write('foot-anchors.json',{'scale':SCALE,'sourceProjectionWarning':'These are approximate body-ground bases, not four independently proven paw contact/physics points. Parent Native acceptance remains pending.','frames':anchors,'active':False})
old=Path('/workspace/.ashveil-planned/v334-fauna-art');s=json.loads((old/'sprites.fragment.json').read_text());partialOld=json.loads((old/'cinder-bear.partial.json').read_text());feet=json.loads((old/'foot-anchors.json').read_text())['frames'];oldframes={k:v for k,v in s['frames'].items() if k.startswith('av334_cinder_bear_idle_')};oldtrs=partialOld.get('frameTransforms',{})
if not oldtrs:
 for k,f in oldframes.items():
  px,py=feet[k]['cropPoint'];oldtrs[k]={'anchor':[px/f[3],py/f[4]],'scale':.14}
write('preview-data.json',{'motions':M,'directions':D,'frames':allFrames,'frameTransforms':allTr,'proposedFrames':list(frames),'candidateAnalysis':analysis,'clips':{m:{d:[f'av346_cinder_bear_{m}_{d}{c}' for c in range(4)] for d in D} for m in M},'oldIdleFrames':oldframes,'oldIdleTransforms':{k:v for k,v in oldtrs.items() if k in oldframes},'oldIdleURL':'references/ref0-cinder-bear-idle-v1.png','scale':SCALE,'durations':partial['proposedMotionDurations'],'sourceURLs':{f'av346_cinder_bear_{m}_v1':f'originals/cinder-bear-{m}-v1.png' for m in M}})
print(json.dumps({'candidateRegions':80,'geometryProposed':len(frames),'heldDirections':[{'motion':x['motion'],'direction':x['direction'],'unsafeFrames':x['unsafeFrames']} for x in held]},ensure_ascii=False,indent=2))
