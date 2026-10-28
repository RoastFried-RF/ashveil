"""Register visually reviewed source-pixel palms; analyze originals without altering PNGs."""
from pathlib import Path
from PIL import Image
import hashlib,json

root=Path(__file__).resolve().parents[3]
source=json.loads((Path(__file__).parent/'patient-grips/patient-grips.json').read_text())
manifest=json.loads((root/'src/client/sprites.json').read_text())
assert source['format']==1
images={};hashes={};frames={};counts={'main':0,'off':0,'occluded':0}
for key,row in source['frames'].items():
    sheet,x,y,width,height=manifest['frames'][key]
    path=root/'public'/manifest['sheets'][sheet]
    if sheet not in images:
        images[sheet]=Image.open(path).convert('RGBA')
        hashes[manifest['sheets'][sheet]]=hashlib.sha256(path.read_bytes()).hexdigest()
    result={}
    for arm in ['main','off']:
        point=row[arm]
        if point is None:
            result[arm]=None;counts['occluded']+=1;continue
        px,py=point
        assert 0<=px<width and 0<=py<height,(key,arm,point,'outside original crop')
        rgba=images[sheet].getpixel((x+px,y+py))
        assert rgba[3]>=64,(key,arm,point,'unreliable transparent palm',rgba)
        samples=[images[sheet].getpixel((x+xx,y+yy)) for xx in range(max(0,px-1),min(width,px+2)) for yy in range(max(0,py-1),min(height,py+2))]
        samples=[p for p in samples if p[3]>=128]
        assert samples,(key,arm,'no opaque palm colour')
        rgb=[round(sum(p[i] for p in samples)/len(samples))for i in range(3)]
        result[arm]={'point':point,'color':rgb[0]*65536+rgb[1]*256+rgb[2]};counts[arm]+=1
    frames[key]=result
target=root/'src/client/render/held-grips.json'
target.write_text(json.dumps({'format':1,'sourceSha256':hashes,'frames':frames},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'frames':len(frames),'sourcePNGs':len(hashes),'palms':counts,'output':str(target.relative_to(root)),'originalPNGsModified':False}))
