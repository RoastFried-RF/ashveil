"""Read-only canonical source crops, labelled as diagnostic material."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
B=Path(__file__).parent;OLD=Path('/workspace/.ashveil-planned/v335-garden-machine-art')
f=json.loads((OLD/'sprites.fragment.json').read_text());m=json.loads((OLD/'partial-models.json').read_text())['models']['sower']
for mode in ['idle','work','walk']:
 key=m['clips'][mode]['down'][0];sheet,x,y,w,h=f['frames'][key];image=Image.open(OLD/'originals'/Path(f['sheets'][sheet]).name).convert('RGBA');z=3 if mode!='walk' else 2
 crop=image.crop((x,y,x+w,y+h)).resize((w*z,h*z),Image.Resampling.NEAREST);diag=Image.new('RGBA',(w*z,h*z+40),(48,46,40,255));diag.alpha_composite(crop,(0,40));draw=ImageDraw.Draw(diag);draw.text((8,6),f'CANONICAL {mode} front0 raw crop [{x},{y},{w},{h}] x{z}',fill=(242,226,188,255));draw.text((8,21),'READ-ONLY SOURCE DIAGNOSTIC, not new artwork',fill=(183,170,139,255));diag.convert('RGB').save(B/'diagnostics'/f'canonical-{mode}-front0-source.png')
