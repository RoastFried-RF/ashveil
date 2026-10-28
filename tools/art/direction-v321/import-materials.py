"""Register unmodified generated material fields; native rectangles only."""
from pathlib import Path
from PIL import Image
import argparse,json,hashlib
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent;PUB=ROOT/'public/sprites/original/direction-v321'
parser=argparse.ArgumentParser();parser.add_argument('--install',action='store_true');args=parser.parse_args()
f={'sheets':{},'frames':{}};audit=[]
for name in ['stone','ground','walls','water']:
    path=PUB/(name+'.png');w,h=Image.open(path).size;sheet='av321_'+name;f['sheets'][sheet]=str(path.relative_to(ROOT/'public'))
    if name in ['stone','ground','water']:
        side=(min(w,h)//2-2)//8*8
        fields=[[sheet,(i%2)*(w//2)+2,(i//2)*(h//2)+2,side,side]for i in range(4)]
        if name=='stone':
            for i,frame in enumerate(fields):f['frames']['kt_floor_q'+str(i)]=frame
            cell=side//8
            for i in range(20):f['frames']['cd_floor'+str(i)]=[sheet,fields[3][1]+(i%5)*cell,fields[3][2]+(i//5)*cell,cell,cell]
            f['frames']['wall_top']=[sheet,fields[0][1]+cell,fields[0][2]+cell,cell,cell]
        elif name=='ground':
            for family,index,count in [('grass',0,3),('grassdirt',0,3),('dirt',1,3),('mud',2,4),('ash',3,4)]:
                for i in range(count):f['frames'][family+str(i)]=fields[index]
        else:
            f['frames']['water_shallow']=fields[0];f['frames']['water_deep']=fields[1]
    else:
        for i in range(8):f['frames']['wall_face'+str(i)]=[sheet,(i%4)*(w//4)+2,(i//4)*(h//2)+2,w//4-4,h//2-4]
    audit.append({'file':str(path.relative_to(ROOT)),'size':[w,h],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pngUnmodified':True})
(HERE/'materials.fragment.json').write_text(json.dumps(f,indent=2)+'\n');(HERE/'material-audit.json').write_text(json.dumps({'sources':audit,'frames':f['frames'],'sampling':'Stone and surface fields subdivide into8x8 real16world-pixel cells, preserving a continuous large material field.'},indent=2)+'\n')
if args.install:
    m=json.loads((ROOT/'src/client/sprites.json').read_text())
    for key in f:m[key].update(f[key])
    (ROOT/'src/client/sprites.json').write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps({'sheets':len(f['sheets']),'frames':len(f['frames']),'installed':args.install}))
