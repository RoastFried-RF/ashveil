"""Read-only original alpha/regions and explicitly labelled source diagnostics."""
import json,hashlib,re
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage
B=Path(__file__).parent
reports={}
for path in sorted((B/'originals').glob('*.png')):
 image=Image.open(path).convert('RGBA');alpha=np.asarray(image.getchannel('A'));mask=alpha>=16;labels,_=ndimage.label(mask,structure=np.ones((3,3)));areas=np.bincount(labels.ravel());regions=[]
 for i,sl in enumerate(ndimage.find_objects(labels),1):
  if sl is None or areas[i]<400:continue
  ys,xs=sl;regions.append({'bbox':[xs.start,ys.start,xs.stop,ys.stop],'alpha16Area':int(areas[i])})
 regions.sort(key=lambda r:(int(((r['bbox'][1]+r['bbox'][3])/2)/image.height*4),(r['bbox'][0]+r['bbox'][2])/2))
 diagnostic=Image.new('RGBA',image.size,(48,46,40,255));diagnostic.alpha_composite(image);draw=ImageDraw.Draw(diagnostic)
 for i,r in enumerate(regions):
  x0,y0,x1,y1=r['bbox'];x,y=max(0,x0-1),max(0,y0-1);w,h=min(image.width,x1+1)-x,min(image.height,y1+1)-y;r.update({'rawSourceIndex':i,'requestedRow':i//3,'requestedCol':i%3,'crop':[x,y,w,h],'rgbaCropSha256':hashlib.sha256(image.crop((x,y,x+w,y+h)).tobytes()).hexdigest()})
  draw.rectangle((x,y,x+w-1,y+h-1),outline=(151,161,112,255));draw.text((x+2,y+2),f'raw{i} row{i//3} col{i%3} CANDIDATE ONLY',fill=(245,227,187,255))
 reports[path.name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':list(image.size),'alphaExtrema':[int(alpha.min()),int(alpha.max())],'lowAlphaPixelCount1to15':int(((alpha>0)&(alpha<16)).sum()),'opaqueCanvasEdgePixelsAlpha16':int(mask[0].sum()+mask[-1].sum()+mask[:,0].sum()+mask[:,-1].sum()),'regionsAlpha16Area400':regions}
 diagnostic.convert('RGB').save(B/'diagnostics'/(path.stem+'-source-regions.png'))
 print(path.name,'regions',len(regions),'alpha16Edges',reports[path.name]['opaqueCanvasEdgePixelsAlpha16'])
(B/'source-analysis.json').write_text(json.dumps(reports,indent=2)+'\n')
