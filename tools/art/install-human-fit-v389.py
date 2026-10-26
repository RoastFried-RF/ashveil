"""Register reviewed distal regions of two unchanged v384 object sources. No raster output."""
from pathlib import Path
import json,hashlib,runpy
ROOT=Path(__file__).resolve().parents[2]
u=runpy.run_path(str(ROOT/'tools/art/install-human-art-v389.py'))
p=ROOT/'src/client/sprites.json';text=p.read_text();m=json.loads(text)
regions={'av389_pioneer_hand_owned':('av384_pioneer_arm',[10,388,300,315]),'av389_articulated_foot_owned':('av384_articulated_leg',[4,604,360,141])}
frames={};records={}
for key,(source,rect) in regions.items():
 sheet,x,y,w,h=m['frames'][source];a,b,c,d=rect;assert a>=0 and b>=0 and a+c<=w and b+d<=h
 frames[key]=[sheet,x+a,y+b,c,d]
 path=ROOT/'public'/m['sheets'][sheet];records[key]={'parentFrame':source,'parentLocalRect':rect,'frame':frames[key],'originalSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'purpose':'Only distal mechanical owner, not a new authored object or facing'}
updated=u['append_entries'](text,'frames',frames);before=u['previous_values'](text);after=u['previous_values'](updated);assert all(after[s][k]==value for s,rows in before.items() for k,value in rows.items());p.write_text(updated)
receipt={'frameAliasesAdded':2,'newPNG':0,'newAuthoredObjects':0,'sourcePixelsEdited':0,'regions':records,'fitData':'src/client/render/human-fit.json','PioneerGrip':'Observed claw gap, not distal claw tip; original reference remains unchanged','scope':'One original oblique object view, source subdivision and affine pose only. Hidden opposite faces not authored.'}
r=ROOT/'tools/art/direction-v389/fit-registration.json'
if r.exists():assert json.loads(r.read_text())==receipt
else:r.write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'frameAliases':len(frames),'originalPixelsChanged':False,'existingValueBytesPreserved':True}))
