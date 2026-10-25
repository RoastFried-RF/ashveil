#!/usr/bin/env python3
"""Read-only source PNG analysis. Writes JSON only; no image edits/exports/resampling."""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'originals/ashmoth-four-states-v1.png'
arr=np.asarray(Image.open(SOURCE).convert('RGBA'))
a=arr[:,:,3];height,width=a.shape

def bounds(mask,x=0,y=0):
    yy,xx=np.nonzero(mask)
    return [int(xx.min()+x),int(yy.min()+y),int(xx.max()+x+1),int(yy.max()+y+1)] if len(xx) else None

def stat(mask):
    labels,n=ndimage.label(mask)
    sizes=np.bincount(labels.ravel())[1:]
    return {'pixels':int(mask.sum()),'components':int(n),'componentsAtLeast8Pixels':int((sizes>=8).sum()),'componentsAtLeast32Pixels':int((sizes>=32).sum())}

hist=np.bincount(a.ravel(),minlength=256)
edge=np.concatenate([a[0,:],a[-1,:],a[1:-1,0],a[1:-1,-1]])
whole={'path':str(SOURCE),'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceSize':[width,height],'mode':'RGBA','alphaExtrema':[int(a.min()),int(a.max())],'alphaHistogram':hist.tolist(),'nonzeroCanvasEdgePixels':int((edge>0).sum()),'canvasEdgeAlphaMaximum':int(edge.max()),'canvasEdgeAlphaAtLeast8':int((edge>=8).sum()),'thresholds':{str(t):{'bboxXYXY':bounds(a>=t),**stat(a>=t)} for t in [1,8,16,32,128,240]}}
states=[]
for name,role,(x,y,w,h) in [
    ('loose','loose restless environmental swarm',(0,0,768,512)),
    ('dense','concentration around an unpainted attractor',(768,0,768,512)),
    ('moving','one asymmetric right-weighted stream state',(0,512,768,512)),
    ('dispersing','thin outward-scattering state',(768,512,768,512))]:
    q=a[y:y+h,x:x+w]
    ts={str(t):{'bboxSourceXYXY':bounds(q>=t,x,y),**stat(q>=t)} for t in [1,8,16,32,128,240]}
    bx0,by0,bx1,by1=ts['8']['bboxSourceXYXY']
    pad=8;cx=max(x,bx0-pad);cy=max(y,by0-pad);cx1=min(x+w,bx1+pad);cy1=min(y+h,by1+pad)
    region=arr[cy:cy1,cx:cx1]
    # Only hashes/numeric measurements of memory crops; no crop PNG is written.
    yy,xx=np.nonzero(q>=16);weights=q[yy,xx].astype(float)
    centroid=[float(np.average(xx+x,weights=weights)),float(np.average(yy+y,weights=weights))]
    maskinside=np.zeros_like(q,dtype=bool);maskinside[cy-y:cy1-y,cx-x:cx1-x]=True
    states.append({'state':name,'meaning':role,'nominalQuadrantXYWH':[x,y,w,h],'thresholds':ts,
      'cropProposalXYWH':[cx,cy,cx1-cx,cy1-cy],'cropDerivation':'alpha >=8 bounding box plus eight original pixels, no mask/cleanup/resampling',
      'croppedRGBASHA256':hashlib.sha256(region.tobytes()).hexdigest(),
      'outsideCropAlphaAtLeast8Pixels':int(((q>=8)&~maskinside).sum()),'outsideCropAlpha1to7Pixels':int(((q>0)&(q<8)&~maskinside).sum()),
      'regionCenterSourceXY':[(bx0+bx1)/2,(by0+by1)/2],'alpha16WeightedCentroidSourceXY':centroid,
      'anchorSemantics':'Airborne swarm region center only. No foot/ground contact, real light position or biological COM is observed.',
      'newAnimationFrames':0,'uniqueStaticStateRegions':1,'runtimeRegistered':False})
gutters={}
for name,q in [('vertical_x720_816',a[:,720:816]),('horizontal_y470_550',a[470:550,:])]:
    gutters[name]={'nonzeroPixels':int((q>0).sum()),'alphaAtLeast8Pixels':int((q>=8).sum()),'alphaAtLeast16Pixels':int((q>=16).sum()),'maximumAlpha':int(q.max())}
result={'format':1,'wholeSource':whole,'states':states,'gutters':gutters,'countCaution':'Connected components are image topology, not moth counts. Wing/body overlap or alpha threshold can merge/split insects. Visual samples do not encode actor population, health or density units.','imageMutationCount':0,'imageOutputCount':0}
(ROOT/'alpha-analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sourceSHA':whole['sha256'],'canvasEdge':{k:v for k,v in whole.items() if 'Edge' in k},'states':[{k:s[k] for k in ['state','cropProposalXYWH','regionCenterSourceXY','outsideCropAlpha1to7Pixels']} for s in states],'gutters':gutters},ensure_ascii=False,indent=2))
