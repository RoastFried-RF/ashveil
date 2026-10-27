"""Install the complete generated PNG unchanged; atlas cells and alpha bounds are metadata only."""
from pathlib import Path
import hashlib,json,shutil
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'tools/art/direction-v397/rocks-source.json'
source=json.loads(SOURCE.read_text());raw=ROOT/source['raw'];assert hashlib.sha256(raw.read_bytes()).hexdigest()==source['sha256']
im=Image.open(raw);assert list(im.size)==source['size'];alpha=im.getchannel('A')
p=ROOT/'src/client/sprites.json';m=json.loads(p.read_text());sheet='av397_boulders';assert sheet not in m['sheets'] or m['sheets'][sheet]==source['raw'].removeprefix('public/')
m['sheets'][sheet]=source['raw'].removeprefix('public/');m['sheetSizes'][sheet]=source['size'];layouts=[]
for i,row in enumerate(source['regions'],1):
 key=f'av397_rock_{i}';x,y,w,h=row['cell'];bx,by,bw,bh=row['opaqueBounds'];rect=[sheet,x,y,w,h];assert key not in m['frames'] or m['frames'][key]==rect
 # No opaque part touches a boundary. The entire cell, including its low alpha fringe, stays in the atlas.
 opaque=alpha.crop((x,y,x+w,y+h)).point(lambda a:255 if a>=128 else 0).getbbox();assert opaque==(bx-x,by-y,bx-x+bw,by-y+bh);assert 0<opaque[0]<opaque[2]<w and 0<opaque[1]<opaque[3]<h
 m['frames'][key]=rect;layouts.append({'sprite':key,'anchor':[(bx-x+bw/2)/w,(by-y+bh-1)/h],'scale':21.6/bw,'opaqueWidth':bw,'worldOpaqueWidth':21.6})
p.write_text(json.dumps(m,indent=2)+'\n');(ROOT/'src/client/render/rock-art.json').write_text(json.dumps(layouts,indent=2)+'\n')
patch=[{'op':'replace','target':'Terrain.Rock','path':'/sprites','value':[r['sprite']for r in layouts]}]
(ROOT/'src/content/core/patches/rocks-original-v397.json').write_text(json.dumps(patch,indent=2)+'\n')
print(json.dumps({'rawSHA256':source['sha256'],'regions':len(layouts),'pixelWrites':False,'legacyFramePreserved':m['frames']['rock']}))
