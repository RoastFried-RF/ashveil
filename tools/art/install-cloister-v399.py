"""Register full atlas cells from the byte-exact generated original; never write image pixels."""
from pathlib import Path
import json,hashlib
from PIL import Image
root=Path(__file__).resolve().parents[2]
source=json.loads((root/'tools/art/direction-v399/source.json').read_text());raw=root/source['raw'];assert hashlib.sha256(raw.read_bytes()).hexdigest()==source['SHA256'];im=Image.open(raw);assert list(im.size)==source['size'];alpha=im.getchannel('A')
p=root/'src/client/sprites.json';m=json.loads(p.read_text());sheet='av399_cloister_evidence';path=source['raw'].removeprefix('public/');assert sheet not in m['sheets']or m['sheets'][sheet]==path;m['sheets'][sheet]=path;m['sheetSizes'][sheet]=source['size']
for key,row in zip(['av399_abbot_final_record','av399_amalgam_capsule_remnant'],source['regions']):
 x,y,w,h=row['cell'];bx,by,bw,bh=row['opaqueBounds'];opaque=alpha.crop((x,y,x+w,y+h)).point(lambda a:255 if a>=128 else 0).getbbox();assert opaque==(bx-x,by-y,bx-x+bw,by-y+bh);assert 0<opaque[0]<opaque[2]<w and 0<opaque[1]<opaque[3]<h;frame=[sheet,x,y,w,h];assert key not in m['frames']or m['frames'][key]==frame;m['frames'][key]=frame
p.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'registered':2,'rawSHA256':source['SHA256'],'pixelWrites':False,'fullCellLowAlphaFringeRetained':True}))
