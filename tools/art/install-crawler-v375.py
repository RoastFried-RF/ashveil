"""Register existing own source bytes/crops. No new pixels, aliases are not new art."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'tools/art/direction-v374/history/v372-crawler-parts/originals/crawler-parts-v1.png'
SHA='d79e58402ddfe288399997088a83bd85ee08d171e83b7dcfc342fdaf49d29d2f'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SHA
out=ROOT/'public/sprites/original/direction-v375/crawler-parts-v372.png'
out.parent.mkdir(parents=True,exist_ok=True)
if out.exists(): assert out.read_bytes()==SOURCE.read_bytes()
else: shutil.copyfile(SOURCE,out)
def point(x,y):return dict(x=x,y=y)
def part(name,**args):return dict(frame='av375_crawler_'+name,**args)
spec=dict(art=dict(
 headClosed=part('head_closed',pivot=point(207,341)),
 headOpen=part('head_open',pivot=point(201,356)),
 middle=part('middle_plate',pivot=point(165,157),left=point(31,157),right=point(299,157)),
 tail=part('tail_plate',pivot=point(128,116),left=point(26,116),right=point(230,116)),
 upper=part('upper_leg',proximal=point(72,47),distal=point(76,289)),
 lower=part('lower_hook',proximal=point(54,49),distal=point(53,285))),
 layout=dict(bodyScale=.0225,headScale=.0225,pitch=5.04,firstOffset=2.8575,tailOffset=4.455,upper=3.825,lower=3.7125,outreach=5.31,stride=6.3,swingTravel=1.62,settleSeconds=.30,ceilingLift=5))
crops=dict(head_closed=[66,86,411,368],head_open=[570,79,412,379],middle_plate=[1103,127,329,304],tail_plate=[145,601,249,309],upper_leg=[701,577,139,337],lower_hook=[1213,569,156,333])
manifest=ROOT/'src/client/sprites.json';m=json.loads(manifest.read_text())
sheet='av375_crawler_source';m['sheets'][sheet]=str(out.relative_to(ROOT/'public'));m['sheetSizes'][sheet]=[1536,1024]
for name,crop in crops.items():m['frames']['av375_crawler_'+name]=[sheet,*crop]
fallback={d:['av375_crawler_head_closed'] for d in ['down','left','right','up']}
m['chars']['av375_conduit_crawler']=dict(walk=fallback,idle=fallback,attack={d:['av375_crawler_head_open'] for d in fallback},anchor=[207/411,341/368],renderScale=.0225,headOffset=12,healthBarWidth=18,shadow=[4,2],heldItems=False,gait=dict(walk=900,crouchWalk=1100),motionDurations=dict(attack=650,hurt=360,fall=700,rise=600),portrait='av375_crawler_head_closed',crawler=spec)
manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
record=ROOT/'tools/art/direction-v375';record.mkdir(exist_ok=True)
(record/'installation.json').write_text(json.dumps(dict(version=375,character='av375_conduit_crawler',source=dict(path=str(SOURCE.relative_to(ROOT)),sha256=SHA,publicPath=str(out.relative_to(ROOT)),width=1536,height=1024),sourcePngsReused=1,newSourcePngs=0,imageGenerationCalls=0,uniqueSourceRegions=6,bodyInstances=8,walkingLegInstances=16,drawInstances=41,authoredDirections=1,authoredFullBodyWalkFrames=0,crops=crops,spec=spec,limits=['Single dorsal view reused by rotation and reflection; painted highlights rotate with parts.','Observed 2D socket/cap centers, inferred neck/overlap and hooktip contact proxy.','Game view follows supplied interpolated position; map/FOV mask clips body.','No new underside, ceiling, drop, curl or death source artwork.','Core/finite fixture/Native/release checks are parent integration, not this installation record.']),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(character='av375_conduit_crawler',sha256=SHA,sourceRegions=6,newSourcePngs=0)))
