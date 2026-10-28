"""Clearly labelled held-candidate displays only; never creates sprite artwork."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
B=Path(__file__).parent;OLD=Path('/workspace/.ashveil-planned/v334-fauna-art')
def read(p):return json.loads(Path(p).read_text())
candidates=read(B/'candidate-crops.json')['frames'];review=read(B/'source-review.json')['directions'];reg=read(B/'registration-analysis.json')['candidateFrames'];oldf=read(OLD/'sprites.fragment.json');oldp=read(OLD/'cinder-bear.partial.json')
comparison={'format':1,'activationReady':False,'displayOnlyNotAcceptedBody':True,'directions':{}}
for d in ['down','left','right','up']:
 k=oldp['clips']['idle'][d][0];fr=oldf['frames'][k];tr=oldp['frameTransforms'][k];cs=[v for k,v in candidates.items() if '_'+d+'_raw' in k];widths=[v['candidateSourceRegion'][2]*v['proposedTransform']['scale'] for v in cs];heights=[v['candidateSourceRegion'][3]*v['proposedTransform']['scale'] for v in cs]
 comparison['directions'][d]={'oldIdleDisplaySize':[fr[3]*tr['scale'],fr[4]*tr['scale']],'candidateDisplayWidthRange':[min(widths),max(widths)],'candidateDisplayHeightRange':[min(heights),max(heights)],'intendedFacingIsNotActualForAllLeftCandidates':d=='left'}
(B/'model-comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
def draw_source(out,source,crop,tr,gx,gy,zoom):
 x,y,w,h=crop;image=Image.open(source).convert('RGBA');scale=tr['scale']*zoom;display=image.crop((x,y,x+w,y+h)).resize((round(w*scale),round(h*scale)),Image.Resampling.NEAREST);out.alpha_composite(display,(round(gx-w*tr['anchor'][0]*scale),round(gy-h*tr['anchor'][1]*scale)))
for direction in ['down','left','right','up']:
 out=Image.new('RGBA',(720,920),(48,46,40,255));draw=ImageDraw.Draw(out)
 for i in range(12):
  key=f'held_av345_cinder_bear_walk_{direction}_raw{i}';v=candidates[key];r=review[direction]['frames'][i];col,row=i%3,i//3;gx,gy=col*240+120,row*230+202
  draw.rectangle((col*240,row*230,(col+1)*240-1,(row+1)*230-1),outline=(91,85,68,255));draw.text((col*240+8,row*230+10),f'HELD raw{i} facing '+r['observedFacing'],fill=(241,222,183,255));draw.text((col*240+8,row*230+26),'asked '+r['requestedLimb']+' '+r['requestedSubphase'],fill=(181,169,137,255));draw.text((col*240+8,row*230+42),'observed '+str(r['observedRecoveringPaws']),fill=(221,153,114,255));draw.text((col*240+8,row*230+58),f'foreign pixels: {reg[key]["otherLargeSilhouettePixelsAlpha16"]}',fill=(221,153,114,255));draw.line((gx-96,gy,gx+96,gy),fill=(117,109,79,255));draw.line((gx,gy-5,gx,gy+5),fill=(173,158,112,255))
  draw_source(out,B/'originals'/v['original'],v['candidateSourceRegion'],v['proposedTransform'],gx,gy,4)
 out.convert('RGB').save(B/'diagnostics'/f'held-{direction}-all12-grounded-x4.png')
for zoom in [1,4]:
 out=Image.new('RGBA',(1200,920),(48,46,40,255));draw=ImageDraw.Draw(out)
 for row,direction in enumerate(['down','left','right','up']):
  for col in range(5):
   gx,gy=col*240+120,row*230+202
   if col==0:
    key=oldp['clips']['idle'][direction][0];sheet,x,y,w,h=oldf['frames'][key];tr=oldp['frameTransforms'][key];source=OLD/'originals'/Path(oldf['sheets'][sheet]).name;crop=[x,y,w,h];label=f'v334 idle {direction}'
   else:
    i=[0,4,7,11][col-1];v=candidates[f'held_av345_cinder_bear_walk_{direction}_raw{i}'];tr=v['proposedTransform'];source=B/'originals'/v['original'];crop=v['candidateSourceRegion'];label=f'HELD {direction} raw{i}'
   draw.rectangle((col*240,row*230,(col+1)*240-1,(row+1)*230-1),outline=(91,85,68,255));draw.text((col*240+10,row*230+12),label,fill=(239,224,189,255));draw.text((col*240+10,row*230+29),f'DISPLAY DIAGNOSTIC x{zoom}',fill=(178,166,134,255));draw.line((gx-96,gy,gx+96,gy),fill=(117,109,79,255));draw.line((gx,gy-5,gx,gy+5),fill=(173,158,112,255));draw_source(out,source,crop,tr,gx,gy,zoom)
 out.convert('RGB').save(B/'diagnostics'/f'held-model-vs-idle-x{zoom}.png')
