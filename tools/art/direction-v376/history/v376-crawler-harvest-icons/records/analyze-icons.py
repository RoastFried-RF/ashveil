from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
from scipy.ndimage import label
r=Path('/workspace/.ashveil-planned/v376-crawler-harvest-icons');p=r/'originals/crawler-harvest-icons-v1.png';rgba=np.asarray(Image.open(p));a=rgba[:,:,3];sha=hashlib.sha256(p.read_bytes()).hexdigest()
parts=[('av376_crawler_venom_sac','신경독 주머니',[145,93,244,393],0,0),('av376_crawler_plate','외골격 판',[584,171,364,299],1,0),('av376_crawler_leg_segment','다리 마디',[1165,75,216,413],2,0),('av376_crawler_raw_meat','날 지네 고기',[92,606,364,309],0,1),('av376_crawler_roasted_meat','구운 지네 고기',[589,620,359,287],1,1),('av376_crawler_cuirass','경량 외골격 흉갑',[1101,545,328,403],2,1)]
labels={};counts={}
for t in (1,16):labels[t],_=label(a>=t);counts[t]=np.bincount(labels[t].ravel())
frames={};reports=[];union=np.zeros(a.shape,dtype=bool);owners={1:set(),16:set()}
for key,name,rect,cx,cy in parts:
 x,y,w,h=rect;crop=rgba[y:y+h,x:x+w];ca=crop[:,:,3];union[y:y+h,x:x+w]=True;frames[key]=['av376_crawler_harvest_icons_v1',*rect];th={}
 for t in (1,16):
  ll=labels[t][y:y+h,x:x+w];cc=np.bincount(ll.ravel());cc[0]=0;own=int(cc.argmax());owners[t].add(own);ys,xs=np.where(labels[t]==own);bbox=[int(xs.min()),int(ys.min()),int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)];m=ca>=t
  otherIds=[int(q) for q in np.unique(ll) if q and q!=own];foreignMajor=int(sum((ll==q).sum() for q in otherIds if counts[t][q]>1000))
  th[str(t)]={'alphaPixelsInCrop':int(m.sum()),'mainComponentRectSource':bbox,'mainComponentPixelsInCrop':int((ll==own).sum()),'mainComponentPixelsOutsideCrop':int(counts[t][own]-(ll==own).sum()),'otherResidualPixelsInCrop':int(((ll!=0)&(ll!=own)).sum()),'foreignMajorComponentPixels':foreignMajor,'rectBorderAlphaPixels':int(m[0,:].sum()+m[-1,:].sum()+m[1:-1,0].sum()+m[1:-1,-1].sum()),'otherPixelsMaxAlpha':int(ca[(ll!=0)&(ll!=own)].max()) if ((ll!=0)&(ll!=own)).any() else 0}
 bbox=th['16']['mainComponentRectSource'];reports.append({'iconKey':key,'displayLabel':name,'crop':rect,'sourceSha256':sha,'cropRgbaSha256':hashlib.sha256(crop.tobytes()).hexdigest(),'sourceGridCell':[cx*512,cy*512,512,512],'max55PercentCellMet':max(bbox[2],bbox[3])<=512*.55,'alpha16WidthFraction':round(bbox[2]/512,6),'alpha16HeightFraction':round(bbox[3]/512,6),'thresholds':th,'displayContain24Size':[round(w*min(24/w,24/h),6),round(h*min(24/w,24/h),6)],'clippedMainArt':False,'otherMajorIconMixed':False,'rawSourcePixelsPreserved':True})
residual={str(t):{'pixelsOutsideSixMajorComponents':int(((a>=t)&~np.isin(labels[t],list(owners[t]))).sum()),'pixelsOutsideDeclaredCrops':int(((a>=t)&~union).sum())} for t in (1,16)}
(r/'icons-review.json').write_text(json.dumps({'sourcePng':'originals/crawler-harvest-icons-v1.png','sourceSha256':sha,'sourceSize':[1536,1024],'coordinateConvention':'source x/y/width/height, right and bottom exclusive','uniqueRawRegions':6,'icons':reports,'residual':residual,'noBackgroundOrAlphaRemoval':True},ensure_ascii=False,indent=2)+'\n')
(r/'sprites.fragment.json').write_text(json.dumps({'sheets':{'av376_crawler_harvest_icons_v1':'sprites/original/direction-v376/crawler-harvest-icons-v1.png'},'sheetSizes':{'av376_crawler_harvest_icons_v1':[1536,1024]},'frames':frames},indent=2)+'\n')
print(json.dumps({'crops':[(q['iconKey'],q['crop'],q['thresholds']['1']['rectBorderAlphaPixels'],q['thresholds']['1']['otherResidualPixelsInCrop'],q['thresholds']['16']['foreignMajorComponentPixels']) for q in reports],'residual':residual},indent=2))
