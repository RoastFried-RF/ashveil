"""Whole-family source-display composites only. Never writes replacement art."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
B=Path(__file__).parent
V334=Path('/workspace/.ashveil-planned/v334-fauna-art')
V342=Path('/workspace/.ashveil-planned/v342-cinder-bear-walk')
def read(p):return json.loads(Path(p).read_text())
oldf=read(V334/'sprites.fragment.json');oldp=read(V334/'cinder-bear.partial.json')
sidef=read(V342/'sprites.fragment.json');sidep=read(V342/'cinder-bear.walk.partial.json')
newf=read(B/'sprites.fragment.json');newp=read(B/'cinder-bear.walk-up.partial.json')
for zoom in [1,4]:
 out=Image.new('RGBA',(1200,920),(48,46,40,255));draw=ImageDraw.Draw(out)
 for row,direction in enumerate(['down','left','right','up']):
  for col in range(5):
   if col==0:f,p,base,key=oldf,oldp,V334,oldp['clips']['idle'][direction][0];label=f'v334 idle {direction}'
   elif direction=='down':f,p,base,key=oldf,oldp,V334,oldp['clips']['walk']['down'][col-1];label=f'v334 down phase{col-1}'
   elif direction in ['left','right']:f,p,base,key=sidef,sidep,V342,sidep['clips']['walk'][direction][col-1];label=f'v342 {direction} phase{col-1}'
   else:f,p,base,key=newf,newp,B,newp['clips']['walk']['up'][col-1];label=f'v344 up phase{col-1}'
   sheet,x,y,w,h=f['frames'][key];tr=p['frameTransforms'][key];image=Image.open(base/'originals'/Path(f['sheets'][sheet]).name).convert('RGBA');scale=tr['scale']*zoom;gx,gy=col*240+120,row*230+202
   draw.rectangle((col*240,row*230,(col+1)*240-1,(row+1)*230-1),outline=(91,85,68,255));draw.text((col*240+10,row*230+12),label,fill=(239,224,189,255));draw.text((col*240+10,row*230+29),f'DISPLAY DIAGNOSTIC x{zoom}',fill=(178,166,134,255));draw.line((gx-96,gy,gx+96,gy),fill=(117,109,79,255));draw.line((gx,gy-5,gx,gy+5),fill=(173,158,112,255))
   display=image.crop((x,y,x+w,y+h)).resize((round(w*scale),round(h*scale)),Image.Resampling.NEAREST);out.alpha_composite(display,(round(gx-w*tr['anchor'][0]*scale),round(gy-h*tr['anchor'][1]*scale)))
 out.convert('RGB').save(B/'diagnostics'/f'four-direction-family-x{zoom}.png')
