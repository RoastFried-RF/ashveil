"""Read original RGBA bounds and register exact crops. Never writes raster pixels."""
from pathlib import Path
from PIL import Image
import hashlib,json

root=Path(__file__).resolve().parents[3]
path=root/'public/sprites/original/direction-v333/harvest-materials-v1.png'
im=Image.open(path).convert('RGBA');w,h=im.size
names=['ashhorn_antler','ashhorn_hide','ashhorn_sinew','bone_marrow','tuskhog_hide','tuskhog_tusk','tuskhog_lard']
frames={};bounds={}
for index,name in enumerate(names):
    col,row=index%4,index//4;left,right=round(col*w/4),round((col+1)*w/4);top,bottom=round(row*h/2),round((row+1)*h/2)
    points=[(x,y) for y in range(top,bottom) for x in range(left,right) if im.getpixel((x,y))[3]>=64]
    assert points,name
    x0,y0=min(x for x,y in points),min(y for x,y in points);x1,y1=max(x for x,y in points)+1,max(y for x,y in points)+1
    assert x0>left and y0>top and x1<right and y1<bottom,(name,'opaque source touches neighbor cell boundary')
    x0=max(left,x0-2);y0=max(top,y0-2);x1=min(right,x1+2);y1=min(bottom,y1+2)
    frames['av331_'+name]=['av333_harvest_materials',x0,y0,x1-x0,y1-y0];bounds[name]=[x0,y0,x1,y1]
opaque_false_colour=sum(1 for r,g,b,a in im.getdata() if a>=128 and (r>200 and g<25 and b<25 or g>200 and r<25 and b<25))
assert opaque_false_colour==0
target=root/'src/client/sprites.json';m=json.loads(target.read_text())
m['sheets']['av333_harvest_materials']=str(path.relative_to(root/'public'));m.setdefault('sheetSizes',{})['av333_harvest_materials']=[w,h];m['frames'].update(frames)
target.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
proof={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceSize':[w,h],'exactCrops':frames,'opaqueFalseRedGreenPixels':opaque_false_colour,'originalPngPixelsModified':False}
(Path(__file__).parent/'harvest-registration.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'registered':len(frames),'sourceSize':[w,h],'originalPngPixelsModified':False}))
