"""Register the eight original portrait panels without editing image pixels."""
from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
m=json.loads((ROOT/'src/client/sprites.json').read_text());plan=json.loads((HERE/'actor-plan.json').read_text());w,h=Image.open(ROOT/'public/sprites/original/direction-v321/portraits.png').size
sheet='av321_portraits';m['sheets'][sheet]='sprites/original/direction-v321/portraits.png'
for i,role in enumerate(['wanderer','guard','reaver','worker','healer','trader','patient','spore']):
    height=h//2;width=height*4//5
    key='av321_portrait_'+role;m['frames'][key]=[sheet,(i%4)*(w//4)+(w//4-width)//2,(i//4)*height,width,height]
    for design in plan:
        if design['id']==role:
            for binding in design['bindings']:m['chars'][binding]['portrait']=key
(ROOT/'src/client/sprites.json').write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps({'portraits':8,'canvas':[w,h]}))
