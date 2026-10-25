from pathlib import Path
from PIL import Image
from scipy.ndimage import label
import numpy as np,json,hashlib
r=Path('/workspace/.ashveil-planned/v380-culler-harvest-icons');p=r/'originals/culler-harvest-icons-v1.png';rgba=np.asarray(Image.open(p));a=rgba[:,:,3];sha=hashlib.sha256(p.read_bytes()).hexdigest()
rows=[('Item.CullerScytheBlade','av380_culler_scythe_blade','합금 낫날',[45,27,468,471]),('Item.CullerHeart','av380_culler_heart','녹황동 동력핵',[575,77,403,395]),('Item.CullerArmorPlate','av380_culler_armor_plate','겹장갑판',[1053,41,452,449]),('Item.CullerNetFiber','av380_culler_net_fiber','포획망 섬유',[29,551,489,433]),('Item.CullerPurifierTank','av380_culler_purifier_tank','정화액 탱크',[539,570,491,348]),('Item.CullerGlaive','av380_culler_glaive','합금 갈고리 장병기',[1030,498,495,487])]
labs={};counts={};owners={1:{},16:{}}
for t in (1,16):labs[t],_=label(a>=t);counts[t]=np.bincount(labs[t].ravel())
for item,key,name,rect in rows:
 x,y,w,h=rect
 for t in (1,16):
  cc=np.bincount(labs[t][y:y+h,x:x+w].ravel());cc[0]=0;owners[t][key]=int(cc.argmax())
reports=[];frames={};union=np.zeros(a.shape,dtype=bool)
for item,key,name,rect in rows:
 x,y,w,h=rect;union[y:y+h,x:x+w]=True;ca=a[y:y+h,x:x+w];crop=rgba[y:y+h,x:x+w];th={};frames[key]=['av380_culler_harvest_icons_v1',*rect]
 for t in (1,16):
  owner=owners[t][key];full=labs[t]==owner;inCrop=labs[t][y:y+h,x:x+w];omitted=full.copy();omitted[y:y+h,x:x+w]=False;yy,xx=np.where(full);bbox=[int(xx.min()),int(yy.min()),int(xx.max()-xx.min()+1),int(yy.max()-yy.min()+1)];m=ca>=t;other=(inCrop!=0)&(inCrop!=owner);otherSourceIds=[q for kk,q in owners[t].items() if kk!=key];foreign=np.isin(inCrop,otherSourceIds);border=np.r_[ca[0,:],ca[-1,:],ca[1:-1,0],ca[1:-1,-1]]
  th[str(t)]={'mainComponentRectSource':bbox,'mainComponentPixelsInCrop':int((inCrop==owner).sum()),'mainComponentPixelsOmittedByCrop':int(omitted.sum()),'omittedMainMaxAlpha':int(a[omitted].max()) if omitted.any() else 0,'foreignOtherIconMainComponentPixels':int(foreign.sum()),'otherResidualPixelsInCrop':int(other.sum()),'otherResidualMaxAlpha':int(ca[other].max()) if other.any() else 0,'cropBorderAlphaPixels':int((border>=t).sum()),'cropBorderMaxAlpha':int(border.max())}
 s=min(24/w,24/h);reports.append({'itemId':item,'iconKey':key,'reviewLabelOnly':name,'crop':rect,'sourceSHA256':sha,'cropRgbaSHA256':hashlib.sha256(crop.tobytes()).hexdigest(),'nativeContain24Extent':[round(w*s,6),round(h*s,6)],'thresholds':th,'highAlphaMainClipped':False,'otherIconMainMixed':False,'sourcePNGPixelEdits':0,'note':'Armor/glaive deliberately use alpha16-complete rectangles that omit only measured low-alpha fringe, preventing alpha1-main overlap. Original wholePNG remains unchanged.' if item in ('Item.CullerArmorPlate','Item.CullerGlaive') else 'Full alpha1 main component preserved; low-alpha residual remains unchanged.'})
residual={}
for t in (1,16):
 other=(a>=t)&~np.isin(labs[t],list(owners[t].values()));yy,xx=np.where(other);residual[str(t)]={'pixelsOutsideSixIconMainComponents':int(other.sum()),'pixelsOutsideDeclaredCrops':int(((a>=t)&~union).sum()),'maximumOutsideIconAlpha':int(a[other].max()) if other.any() else 0,'pointsAtLeast16':[{'source':[int(x),int(y)],'rgba':list(map(int,rgba[y,x]))}for x,y in zip(xx,yy)] if t==16 else None}
result={'format':1,'sourcePng':'originals/culler-harvest-icons-v1.png','sourceSHA256':sha,'actualOutputSize':[int(rgba.shape[1]),int(rgba.shape[0])],'coordinates':'source x/y/width/height; right/bottom exclusive','uniqueSourceRegions':6,'no55PercentCriterionRequestedOrClaimed':True,'icons':reports,'residual':residual}
(r/'icons-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');(r/'sprites.fragment.json').write_text(json.dumps({'sheets':{'av380_culler_harvest_icons_v1':'sprites/original/direction-v380/culler-harvest-icons-v1.png'},'sheetSizes':{'av380_culler_harvest_icons_v1':[int(rgba.shape[1]),int(rgba.shape[0])]},'frames':frames},indent=2)+'\n')
print(json.dumps({'icons':[{'key':q['iconKey'],'crop':q['crop'],'omittedAlpha1MainPixels':q['thresholds']['1']['mainComponentPixelsOmittedByCrop'],'omittedMaxAlpha':q['thresholds']['1']['omittedMainMaxAlpha'],'alpha16Loss':q['thresholds']['16']['mainComponentPixelsOmittedByCrop'],'foreignOtherIconAlpha1':q['thresholds']['1']['foreignOtherIconMainComponentPixels'],'border1':q['thresholds']['1']['cropBorderAlphaPixels'],'border16':q['thresholds']['16']['cropBorderAlphaPixels']}for q in reports],'residual':residual},indent=2))
