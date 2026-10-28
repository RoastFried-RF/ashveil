#!/usr/bin/env python3
"""Read-only source/region alpha analysis. No PNG writes, cleanup or resampling."""
from pathlib import Path
import json,hashlib
from PIL import Image
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'originals/ashmoth-harvest-icons-v1.png'
arr=np.asarray(Image.open(SOURCE).convert('RGBA'));a=arr[:,:,3];height,width=a.shape
FRAMES=[('av371_moth_wing_dust',[0,0,887,887],[245,343,454,324]),('av371_roasted_moths',[887,0,887,887],[1080,323,445,349])]
def bbox(mask,x=0,y=0):
 yy,xx=np.nonzero(mask)
 return [int(xx.min()+x),int(yy.min()+y),int(xx.max()+x+1),int(yy.max()+y+1)] if len(xx) else None

def edge_values(q):return np.r_[q[0,:],q[-1,:],q[1:-1,0],q[1:-1,-1]]

def thresholds(q,x=0,y=0):
 out={}
 for t in [1,8,16,32,128,248,255]:
  mask=q>=t;labels,n=ndimage.label(mask);sizes=np.bincount(labels.ravel())[1:]
  out[str(t)]={'bboxSourceXYXY':bbox(mask,x,y),'pixels':int(mask.sum()),'components':int(n),'componentsAtLeast16Pixels':int((sizes>=16).sum())}
 return out
frames=[]
for name,(qx,qy,qw,qh),(x,y,w,h) in FRAMES:
 q=a[qy:qy+qh,qx:qx+qw];crop=a[y:y+h,x:x+w];mask=np.zeros_like(q,dtype=bool);mask[y-qy:y-qy+h,x-qx:x-qx+w]=True;outside=q[~mask]
 ts=thresholds(q,qx,qy);bx0,by0,bx1,by1=ts['16']['bboxSourceXYXY'];ce=edge_values(crop)
 other=[other for other in FRAMES if other[0]!=name][0];ox,oy,ow,oh=other[2]
 overlaps=max(0,min(x+w,ox+ow)-max(x,ox))*max(0,min(y+h,oy+oh)-max(y,oy))
 frames.append({'frameKey':name,'nominalCellXYWH':[qx,qy,qw,qh],'cropXYWH':[x,y,w,h],'cropRGBAHash':hashlib.sha256(arr[y:y+h,x:x+w].tobytes()).hexdigest(),'thresholds':ts,'cropPolicy':'alpha>=8 bbox+8 pixels per side, source not masked/edited','alphaAtLeast8OmittedOutsideCrop':int((outside>=8).sum()),'alpha1to7OutsideCrop':int(((outside>0)&(outside<8)).sum()),'cropEdgeNonzeroPixels':int((ce>0).sum()),'cropEdgeMaximumAlpha':int(ce.max()),'cropEdgeAlphaAtLeast8Pixels':int((ce>=8).sum()),'alpha16WidthFractionOfCell':(bx1-bx0)/qw,'alpha16HeightFractionOfCell':(by1-by0)/qh,'within55PercentBothDimensions':bx1-bx0<=qw*.55 and by1-by0<=qh*.55,'sourceBoxOverlapWithOtherIcon':overlaps,'otherIconMeaningfulPixelsInThisCrop':0 if overlaps==0 else None,'geometricRegionCenterSourceXY':[(bx0+bx1)/2,(by0+by1)/2]})
edge=edge_values(a);g=a[:,815:963]
report={'format':1,'source':str(SOURCE),'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceSize':[width,height],'alphaHistogram':np.bincount(a.ravel(),minlength=256).tolist(),'thresholds':thresholds(a),'canvasEdge':{'nonzeroPixels':int((edge>0).sum()),'maxAlpha':int(edge.max())},'centralFullHeightGutter':{'sourceXYWH':[815,0,148,height],'nonzeroPixels':int((g>0).sum()),'maximumAlpha':int(g.max())},'frames':frames,'sourcePixelEdits':0,'sourcePNGReencodings':0,'alphaCleanupOperations':0,'resamplingOperations':0,'newImageOutputs':0,'caution':'alpha1 boxes include stray low-alpha pixels; alpha16 boxes and connected components do not establish exact biological counts, pigment mass or inventory size readability.'}
(ROOT/'alpha-analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sha':report['sha256'],'canvasEdge':report['canvasEdge'],'centralGutter':report['centralFullHeightGutter'],'frames':[{k:s[k] for k in ['frameKey','cropXYWH','cropEdgeMaximumAlpha','alpha1to7OutsideCrop','alphaAtLeast8OmittedOutsideCrop','alpha16WidthFractionOfCell','alpha16HeightFractionOfCell','within55PercentBothDimensions','otherIconMeaningfulPixelsInThisCrop']} for s in frames]},indent=2))
