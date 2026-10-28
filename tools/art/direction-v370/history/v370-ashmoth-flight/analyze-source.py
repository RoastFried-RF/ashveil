#!/usr/bin/env python3
"""Read-only measurements of the untouched source PNG; writes JSON, never game pixels."""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'originals/ashmoth-flight-four-poses-v1.png'
arr=np.asarray(Image.open(SOURCE).convert('RGBA'));a=arr[:,:,3]
POSES=[('raised',[0,0,627,627],[226,162,225,363],[339,351]),('spread',[627,0,627,627],[635,202,550,323],[908,351]),('downstroke',[0,627,627,627],[136,740,410,353],[339,890]),('folded',[627,627,627,627],[817,740,185,345],[909,890])]
def bbox(mask,x=0,y=0):
 yy,xx=np.nonzero(mask)
 return [int(xx.min()+x),int(yy.min()+y),int(xx.max()+x+1),int(yy.max()+y+1)] if len(xx) else None
def describe(q,x=0,y=0):
 out={}
 for t in [1,8,16,32,128,248,255]:
  m=q>=t;labels,n=ndimage.label(m);sizes=np.bincount(labels.ravel())[1:]
  out[str(t)]={'bboxSourceXYXY':bbox(m,x,y),'pixels':int(m.sum()),'connectedComponents':int(n),'componentsAtLeast16Pixels':int((sizes>=16).sum())}
 return out
states=[]
for name,(qx,qy,qw,qh),(x,y,w,h),anchor in POSES:
 q=a[qy:qy+qh,qx:qx+qw];mask=np.zeros_like(q,dtype=bool);mask[y-qy:y-qy+h,x-qx:x-qx+w]=True
 outside=q[~mask]
 bx0,by0,bx1,by1=bbox(q>=16,qx,qy)
 states.append({'pose':name,'nominalQuadrantXYWH':[qx,qy,qw,qh],'cropXYWH':[x,y,w,h],'manualThoraxCenterSourceXY':anchor,'thoraxAlpha':int(a[anchor[1],anchor[0]]),'thoraxRGBA':arr[anchor[1],anchor[0]].tolist(),'thresholds':describe(q,qx,qy),'cropRGBAHash':hashlib.sha256(arr[y:y+h,x:x+w].tobytes()).hexdigest(),'cropSelection':'alpha>=8 bbox plus8px per side, no pixel mask or file rewrite','omittedAlpha1to7Pixels':int(((outside>0)&(outside<8)).sum()),'omittedAlphaAtLeast8Pixels':int((outside>=8).sum()),'alpha16WidthFractionOfCell':(bx1-bx0)/qw,'alpha16HeightFractionOfCell':(by1-by0)/qh,'requestedAtMost60PercentEachDimension':(bx1-bx0)<=qw*.6 and (by1-by0)<=qh*.6,'localThoraxFromCellOrigin':[anchor[0]-qx,anchor[1]-qy]})
edge=np.r_[a[0,:],a[-1,:],a[1:-1,0],a[1:-1,-1]]
gutters={}
for name,q in [('observedSafeVertical_x550_635',a[:,550:635]),('observedSafeHorizontal_y530_730',a[530:730,:])]:gutters[name]={'nonzeroPixels':int((q>0).sum()),'alphaAtLeast8Pixels':int((q>=8).sum()),'alphaAtLeast16Pixels':int((q>=16).sum()),'maxAlpha':int(q.max())}
result={'format':1,'source':str(SOURCE),'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceSize':[arr.shape[1],arr.shape[0]],'alphaHistogram':np.bincount(a.ravel(),minlength=256).tolist(),'thresholds':describe(a),'edge':{'nonzeroPixels':int((edge>0).sum()),'maxAlpha':int(edge.max()),'alphaAtLeast8Pixels':int((edge>=8).sum())},'safeGutters':gutters,'poses':states,'alphaBBoxCaution':'alpha1 includes tiny stray pixels; alpha16/8 boxes are analysis thresholds, not applied masks. RGBA crop hashes measure source bytes only.','originalImageWrites':0,'originalImagePixelEdits':0,'resamplingOperations':0}
(ROOT/'alpha-analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sha':result['sourceSHA256'],'edge':result['edge'],'safeGutters':gutters,'poses':[{k:s[k] for k in ['pose','cropXYWH','manualThoraxCenterSourceXY','thoraxAlpha','alpha16WidthFractionOfCell','alpha16HeightFractionOfCell','requestedAtMost60PercentEachDimension','omittedAlphaAtLeast8Pixels']} for s in states]},indent=2))
