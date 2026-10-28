"""Labelled display composites, not sprite assets. Originals are only read."""
import json
from pathlib import Path
from PIL import Image,ImageDraw

B=Path(__file__).parent
OLD=Path('/workspace/.ashveil-planned/v334-fauna-art')
f=json.loads((B/'sprites.fragment.json').read_text())
p=json.loads((B/'cinder-bear.walk.partial.json').read_text())
candidates=json.loads((B/'candidate-crops.json').read_text())['regions']
oldf=json.loads((OLD/'sprites.fragment.json').read_text())
oldp=json.loads((OLD/'cinder-bear.partial.json').read_text())
for zoom in [1,4]:
    tilew,tileh=240,230
    out=Image.new('RGBA',(tilew*5,tileh*3),(48,46,40,255));draw=ImageDraw.Draw(out)
    for row,direction in enumerate(['left','right','up']):
        for col in range(5):
            gx,gy=col*tilew+120,row*tileh+202
            draw.rectangle((col*tilew,row*tileh,(col+1)*tilew-1,(row+1)*tileh-1),outline=(92,86,68,255))
            if col==0:
                key=oldp['clips']['idle'][direction][0];sheet,x,y,w,h=oldf['frames'][key];tr=oldp['frameTransforms'][key]
                image=Image.open(OLD/'originals'/Path(oldf['sheets'][sheet]).name).convert('RGBA');label=f'prior v334 idle {direction}'
            elif direction=='up':
                raw=col-1;v=candidates[f'held_v342_cinder_bear_walk_up_raw{raw}'];x,y,w,h=v['crop'];tr=v['proposedTransform'];image=Image.open(B/'originals'/v['source']).convert('RGBA');label=f'HELD up raw{raw}'
            else:
                key=p['clips']['walk'][direction][col-1];sheet,x,y,w,h=f['frames'][key];tr=p['frameTransforms'][key];image=Image.open(B/'originals'/Path(f['sheets'][sheet]).name).convert('RGBA');raw=candidates[key]['rawSourceIndex'];label=f'{direction} phase{col-1} raw{raw}'
            scale=tr['scale']*zoom;crop=image.crop((x,y,x+w,y+h));size=(round(w*scale),round(h*scale));display=crop.resize(size,Image.Resampling.NEAREST)
            draw.text((col*tilew+10,row*tileh+12),label,fill=(235,220,183,255));draw.text((col*tilew+10,row*tileh+29),f'DISPLAY DIAGNOSTIC x{zoom}',fill=(181,169,137,255))
            draw.line((gx-96,gy,gx+96,gy),fill=(117,109,79,255));draw.line((gx,gy-5,gx,gy+5),fill=(173,158,112,255))
            out.alpha_composite(display,(round(gx-w*tr['anchor'][0]*scale),round(gy-h*tr['anchor'][1]*scale)))
    out.convert('RGB').save(B/'diagnostics'/f'proposed-grounded-crops-x{zoom}.png')
