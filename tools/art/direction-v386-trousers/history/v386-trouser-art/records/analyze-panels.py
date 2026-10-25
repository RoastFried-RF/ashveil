"""Read-only original pixel analysis. No crop/resample/repaired PNG is saved."""
from pathlib import Path
from PIL import Image
from scipy import ndimage
import numpy as np,json,hashlib

p=Path(__file__).resolve().parents[1]
source=p/'originals/cloth-trouser-panels-four-facings-v1.png'
rgba=np.array(Image.open(source));alpha=rgba[:,:,3];h,w=alpha.shape
labels,count=ndimage.label(alpha>=16);sizes=np.bincount(labels.ravel());major=[int(i) for i in range(1,count+1) if sizes[i]>1000]
labels1,_=ndimage.label(alpha>=1)
objects=[]
for i in major:
 y,x=np.where(labels==i);bbox=[int(x.min()),int(y.min()),int(x.max()-x.min()+1),int(y.max()-y.min()+1)];objects.append((float(y.mean()),float(x.mean()),i,bbox))
objects.sort(key=lambda q:(int(q[0]//384),q[1]))
points=[([321,88],[317,248],[319,351]),([709,87],[708,248],[710,351]),([321,458],[282,604],[335,729]),([708,456],[745,608],[702,728]),([320,827],[366,985],[311,1095]),([708,827],[668,985],[699,1095]),([321,1189],[325,1344],[326,1453]),([705,1189],[705,1346],[711,1453])]
facings=['down','down','left','right','right','left','up','up']
parts=[];covered=np.zeros(alpha.shape,bool)
for n,(_,_,i,bbox) in enumerate(objects):
 mask=labels==i;first=np.flatnonzero(mask)[0];id1=labels1.ravel()[first];y,x=np.where(labels1==id1);x0,y0,x1,y1=max(0,int(x.min())-8),max(0,int(y.min())-8),min(w,int(x.max())+9),min(h,int(y.max())+9);crop=[x0,y0,x1-x0,y1-y0];covered[y0:y1,x0:x1]=True
 interior=ndimage.binary_erosion(mask,iterations=4);values=alpha[interior];landmarks={}
 for name,point in zip(['upperOverlapCenter','kneeFoldCenter','lowerHemCenter'],points[n]):
  xx,yy=point;landmarks[name]={'source':point,'crop':[xx-x0,yy-y0],'sourceRGBA':rgba[yy,xx].tolist(),'method':'manually observed cuff/fold/hem graphic center; not a physical/anatomical axis','uncertaintySourcePx':8 if name=='kneeFoldCenter' else 6,'actual3DAxis':None}
 frame={'rawId':f'av386_trouser_panel_r{n//2+1}c{n%2+1}','row':n//2+1,'column':n%2+1,'requestedFacing':['down','left','right','up'][n//2],'observedFacing':facings[n],'requestedAnatomicalOwner':'LeftThigh' if n%2==0 else 'RightThigh','observedAnatomicalOwner':None,'anatomicalOwnershipVerified':False,'sourceCrop':crop,'alpha16Bounds':bbox,'alpha16Pixels':int(mask.sum()),'mainAlpha16Lost':int(mask.sum()-mask[y0:y1,x0:x1].sum()),'foreignMajorAlpha16InCrop':int(sum(((labels[y0:y1,x0:x1]==k).sum()) for k in major if k!=i)),'alpha16CropBorderPixels':int((alpha[y0,x0:x1]>=16).sum()+(alpha[y1-1,x0:x1]>=16).sum()+(alpha[y0:y1,x0]>=16).sum()+(alpha[y0:y1,x1-1]>=16).sum()),'nominalCellOccupancy':{'width':bbox[2]/512,'height':bbox[3]/384,'requested45x65Passed':bbox[2]/512<=.45 and bbox[3]/384<=.65},'interiorOpacity':{'samples':int(values.size),'minimumAlpha':int(values.min()),'medianAlpha':float(np.median(values)),'fractionAlpha240Plus':float((values>=240).mean()),'fractionAlpha250Plus':float((values>=250).mean()),'note':'Opaque cloth meaning is visually present; source alpha is not rewritten to255.'},'landmarks':landmarks,'clothSourceCandidateAccepted':True,'active':False,'releaseApproved':False,'limits':['Graphic anchors do not prove anatomical owner, physical knee pivot or 3D garment surface.','This panel has no waistband/pelvis and is not a complete trousers item.']}
 parts.append(frame)
mapping={f:[x['rawId'] for x in parts if x['observedFacing']==f] for f in ['down','left','right','up']}
d={'format':1,'active':False,'releaseApproved':False,'source':str(source.relative_to(p)),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'size':[w,h],'originalPNGs':1,'uniqueAuthoredRegions':len(parts),'sourcePixelEdits':0,'sourceRotation':0,'sourceReflection':0,'parts':parts,'observedFacingMapping':mapping,'actualAnatomicalOwner':None,'completeTrousersItem':False}
(p/'panel-sources.json').write_text(json.dumps(d,indent=2)+'\n')
outside=alpha[~covered]
(p/'records/source-alpha-analysis.json').write_text(json.dumps({'readOnly':True,'alpha16MajorComponents':len(major),'alpha1Pixels':int((alpha>=1).sum()),'alpha16Pixels':int((alpha>=16).sum()),'alpha255Pixels':int((alpha==255).sum()),'maxAlpha':int(alpha.max()),'outsideSelectedCrops':{'alpha1Pixels':int((outside>=1).sum()),'alpha16Pixels':int((outside>=16).sum()),'maximumAlpha':int(outside.max())},'allMajorSourcePixelsLost':sum(x['mainAlpha16Lost'] for x in parts),'foreignMajorAlpha16InCrops':sum(x['foreignMajorAlpha16InCrop'] for x in parts),'principalCropBorderAlpha16Pixels':sum(x['alpha16CropBorderPixels'] for x in parts),'noPixelEditsOrAlphaRemoval':True},indent=2)+'\n')
print(json.dumps({'mapping':mapping,'crops':[x['sourceCrop'] for x in parts],'outsideAlpha16':int((outside>=16).sum()),'outsideMaximumAlpha':int(outside.max())},indent=2))
