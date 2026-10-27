"""Register observed original prosthetic parts. Only read/measure PNGs; copy raw bytes."""
from pathlib import Path
import json, hashlib, shutil
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tools/art/direction-v394'
DEST=ROOT/'public/sprites/original/direction-v394'
DEST.mkdir(parents=True,exist_ok=True)
SOURCES={
 'low':('exec-7bbf7b5d-daaf-479a-8fd2-611252e75bae.png',[0,410,780,1024]),
 'leg':('exec-74511c8d-b589-4866-a00f-238abb893055.png',[0,600,887]),
 'pioneer':('exec-478bde03-fabd-40ab-9cda-90215ab9bf78.png',[0,562,1024]),
 'gardener':('exec-7b852820-4ef0-42c3-8cef-101e043bc725.png',[0,204,416,603,834,1065,1254]),
 'hook':('exec-396c74a3-2a85-41a2-8a15-f4b4b7c23e2a.png',[0,724]),
}
directions=['down','left','right','up']
manifest={'sheets':{},'sheetSizes':{},'frames':{}}
images={};audit=[]
for key,(file,bands) in SOURCES.items():
 raw=Path('/workspace/generated_images')/file
 dest=DEST/f'prosthetic-{key}-v394.png'
 shutil.copy2(raw,dest)
 assert raw.read_bytes()==dest.read_bytes()
 images[key]=np.asarray(Image.open(raw).convert('RGBA'))
 manifest['sheets']['av394_prosthetic_'+key]=str(dest.relative_to(ROOT/'public'))
 manifest['sheetSizes']['av394_prosthetic_'+key]=[images[key].shape[1],images[key].shape[0]]
 audit.append({'source':str(raw),'installed':str(dest.relative_to(ROOT)),
   'sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'size':[images[key].shape[1],images[key].shape[0]],
   'rowBands':bands,'pixelsEdited':False})

def register(sheet,row,col,name):
 image=images[sheet];h,w=image.shape[:2];bands=SOURCES[sheet][1]
 left,right=w*col//4,w*(col+1)//4;top,bottom=bands[row:row+2]
 a=image[top:bottom,left:right,3];yy,xx=np.nonzero(a>=128)
 assert len(xx)>100,(sheet,row,col)
 x0=max(left,left+int(xx.min())-4);x1=min(right,left+int(xx.max())+5)
 y0=max(top,top+int(yy.min())-4);y1=min(bottom,top+int(yy.max())+5)
 frame='av394_'+name;manifest['frames'][frame]=['av394_prosthetic_'+sheet,x0,y0,x1-x0,y1-y0]
 alpha=image[y0:y1,x0:x1,3];ys,xs=np.nonzero(alpha>=128)
 width,height=x1-x0,y1-y0
 def center(lo,hi):
  by,bx=np.nonzero(alpha[int(height*lo):max(int(height*lo)+1,int(height*hi))]>=128)
  assert len(bx),(name,lo,hi)
  return[round(float(np.mean(bx)),2),round(float(np.mean(by))+int(height*lo),2)]
 source={'frame':frame,'a':center(.05,.15),'b':center(.86,.96),'directional':True}
 return source,alpha

views={key:{d:{'parts':{}}for d in directions}for key in ['PegLeg','ArticulatedLeg','HookHand','GlassEye','PioneerArm','GardenerLimb']}
for col,direction in enumerate(directions):
 peg,alpha=register('low',0,col,'peg_'+direction)
 ys,xs=np.nonzero(alpha>=128);peg['b']=[round(float(np.mean(xs[ys>=ys.max()-2])),2),int(ys.max())]
 views['PegLeg'][direction]['whole']=peg
 shaft_y=round(peg['b'][1]*.70);shaft_x=np.nonzero(alpha[shaft_y:shaft_y+4]>=128)[1]
 assert len(shaft_x)
 distal={**peg,'a':[round(float(np.mean(shaft_x)),2),shaft_y],'clip':[[0,round(peg['b'][1]*.66,2)],[alpha.shape[1],round(peg['b'][1]*.66,2)],[alpha.shape[1],alpha.shape[0]],[0,alpha.shape[0]]]}
 views['PegLeg'][direction]['distal']=distal
 # The first mixed sheet's hook row has inconsistent profiles/rear and is never registered.
 hook,_=register('hook',0,col,'hook_'+direction);views['HookHand'][direction]['whole']=hook
 # Observed iris: mixed columns2/3 face right/left, opposite to their requested order.
 eyeCol={'down':0,'left':2,'right':1,'up':3}[direction]
 eye,alpha=register('low',2,eyeCol,'glass_eye_'+direction)
 eye['a']=[round(alpha.shape[1]*({'left':.21,'right':.79}.get(direction,.5)),2),round(alpha.shape[0]*.52,2)]
 views['GlassEye'][direction]['whole']=eye
 for model,sheet,rows in [('ArticulatedLeg','leg',[('Shin',0),('Foot',1)]),('PioneerArm','pioneer',[('Forearm',0),('Hand',1)]),('GardenerLimb','gardener',list(zip(['UpperArm','Forearm','Hand','Thigh','Shin','Foot'],range(6))))]:
  for owner,row in rows:
   source,alpha=register(sheet,row,col,model.lower()+'_'+owner.lower()+'_'+direction)
   if owner=='Foot':
    ys,xs=np.nonzero(alpha>=128);sole=ys.max();source['b']=[round(float(np.mean(xs[ys>=sole-2])),2),int(sole)];source['solePinned']=True
   if owner=='Hand':
    # Wrist pivot remains proximal; a held tool belongs in the visible palm/gripper opening.
    source['b']=[round(alpha.shape[1]*.5,2),round(alpha.shape[0]*.58,2)]
   views[model][direction]['parts'][owner]=source

replacements={'Prosthetic.'+key:value for key,value in views.items()}
assert len(manifest['frames'])==52
registryPath=ROOT/'src/client/sprites.json';registry=json.loads(registryPath.read_text())
registry['sheets'].update(manifest['sheets']);registry['sheetSizes'].update(manifest['sheetSizes']);registry['frames'].update(manifest['frames'])
registryPath.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
(ROOT/'src/client/render/human-prosthetic-views.json').write_text(json.dumps(replacements,indent=2)+'\n')
(OUT/'manifest.fragment.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'views.json').write_text(json.dumps(replacements,indent=2)+'\n')
(OUT/'source-audit.json').write_text(json.dumps({'generatedRequests':5,'preservedRawOriginals':5,'activeRawPNGs':5,'registeredUniqueRegions':52,'newAuthoredActionFrames':0,'observedNormalization':{'eyeLeft':'mixed row3column3','eyeRight':'mixed row3column2'},'rejectedRegions':['low row2 all4 hook cells: inconsistent edge-on/rear views; replaced by dedicated4-view hook original'],'registration':'Observed alpha bounds/attachment centroids; runtime acceptance is recorded separately in docs/release-v394-proof.json','sources':audit},indent=2)+'\n')
(DEST/'LICENSE.txt').write_text('Original ASHVEIL project artwork generated for this project using OpenAI image generation. Own direction-v384 concepts supplied as references. Raw generated PNG bytes preserved. Prompts and review: tools/art/direction-v394. No third-party game pixels copied or traced.\n')
print(json.dumps({'rawPNGs':5,'frameKeys':52,'rawBytesUnchanged':True}))
