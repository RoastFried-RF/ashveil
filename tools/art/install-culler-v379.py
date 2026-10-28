"""Archive immutable own authoring history, then register four original sheets. No raster edits."""
from pathlib import Path
import hashlib,json,math,shutil
ROOT=Path(__file__).resolve().parents[2]
RECORD=ROOT/'tools/art/direction-v379';HISTORY=RECORD/'history';HISTORY.mkdir(parents=True,exist_ok=True)
stages={
 'v373-culler-parts':ROOT/'tools/art/direction-v374/history/v373-culler-parts',
 'v377-culler-runtime':Path('/workspace/.ashveil-planned/v377-culler-runtime'),
 'v378-culler-facing-parts':Path('/workspace/.ashveil-planned/v378-culler-facing-parts')}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
preserved={}
for name,source in stages.items():
 target=HISTORY/name
 if not target.exists():shutil.copytree(source,target)
 files={str(p.relative_to(source)):sha(p) for p in source.rglob('*') if p.is_file()}
 assert all((target/p).is_file() and sha(target/p)==digest for p,digest in files.items()),name
 preserved[name]=files
front=json.loads((HISTORY/'v373-culler-parts/joint-registration.json').read_text())
sides=json.loads((HISTORY/'v378-culler-facing-parts/joint-registration.json').read_text())['directions']
model=json.loads((HISTORY/'v377-culler-runtime/source-contract.json').read_text())
def p(x,y):return dict(x=x,y=y)
def local(q,crop):return p(q[0]-crop[0],q[1]-crop[1])
def radians(a):return [float(n) for n in a]
source_names={'down':'front','left':'left','right':'right','up':'back'}
expected={'front':'6f30979dc5c4db6496c135718e84fa70eef52ebfc936af126a1b121471c6542a','left':'85f4e077937684d7236ba4faca526f07bd6b261ac65fa36c7eb1097be15cbf8a','right':'d2eec22ac3c089daf809a9f7388740f2dc4d784f321b5f1f6c3fb4fa5a13553a','back':'cd9cd7084159d8c1da0d59b0e8e4216357e725106f25f52cd76a8186f001cfd9'}
drives=['DriveRF','DriveRM','DriveRH','DriveLF','DriveLM','DriveLH'];directions={};frames={};sheets={};sizes={};originals=[]
for direction,name in source_names.items():
 original=HISTORY/('v373-culler-parts' if name=='front' else 'v378-culler-facing-parts')/'originals'/('culler-'+name+'-parts-v1.png')
 assert sha(original)==expected[name]
 public=ROOT/'public/sprites/original/direction-v379'/original.name;public.parent.mkdir(parents=True,exist_ok=True)
 if public.exists():assert public.read_bytes()==original.read_bytes()
 else:shutil.copyfile(original,public)
 originals.append(dict(historyPath=str(original.relative_to(ROOT)),publicPath=str(public.relative_to(ROOT)),sha256=sha(original),size=[1536,1024]))
 sheet='av379_culler_'+name+'_source';sheets[sheet]=str(public.relative_to(ROOT/'public'));sizes[sheet]=[1536,1024]
 parts=front['parts'] if name=='front' else sides[name.upper()]['parts'];art={};raw={}
 for key,part in parts.items():
  crop=part.get('crop',part.get('sourceRect'));points=part.get('joints',part.get('graphicPoints'));raw[key]=dict(crop=crop,points=points)
  snake={'driveUpper':'drive_upper','driveLower':'drive_lower','scytheUpper':'scythe_upper','scytheBlade':'scythe_blade','foot':'foot','chassis':'chassis'}[key]
  frame='av379_culler_'+name+'_'+snake;frames[frame]=[sheet,*crop];art[key]=dict(frame=frame)
  if key in ['driveUpper','driveLower','scytheUpper']:
   for out,old in [('proximal','proximal' if name=='front' else 'proximalGraphicCap'),('distal','distal' if name=='front' else 'distalGraphicCap')]:art[key][out]=local(points[old]['source'],crop)
  elif key=='scytheBlade':
   art[key]['proximal']=local(points['proximal' if name=='front' else 'proximalGraphicCap']['source'],crop)
   art[key]['tip']=local(points['tip' if name=='front' else 'bladeTip']['source'],crop)
  elif key=='foot':
   ankle=points['ankle' if name=='front' else 'ankleGraphicCap']['source']
   chord=[points['soleLeft']['source'],points['soleRight']['source']] if name=='front' else part['sole']['observedAlpha16LowerContourChord']
   sole=[(chord[0][0]+chord[1][0])/2,(chord[0][1]+chord[1][1])/2]
   art[key].update(ankle=local(ankle,crop),sole=local(sole,crop),scale=.027)
 pivot={'front':[325,300],'left':[350,310],'right':[330,310],'back':[310,300]}[name];body_scale=.108 if name in ['front','back'] else .10;offset=p(0,-27 if name in ['front','back'] else -25)
 art['chassis'].update(pivot=local(pivot,raw['chassis']['crop']),scale=body_scale,offset=offset)
 def attach(q):return p((q[0]-pivot[0])*body_scale+offset['x'],(q[1]-pivot[1])*body_scale+offset['y'])
 if name=='front':
  hips={k:attach(q) for k,q in [('Drive'+k,v) for k,v in model['assumedGraphicAttachmentSource'].items()]}
  soles=dict(zip(drives,[[-21.6,7.2],[-25.2,-7.2],[-18.6,-20.4],[21.6,7.2],[25.2,-7.2],[18.6,-20.4]]))
  shoulders={k:attach(q) for k,q in model['assumedToolAttachmentSource'].items()}
 elif name=='back':
  hips={k:attach(q) for k,q in zip(drives,[[424,211],[459,313],[407,441],[200,211],[157,313],[224,444]])}
  soles=dict(zip(drives,[[18.6,-20.4],[25.2,-7.2],[21.6,7.2],[-18.6,-20.4],[-25.2,-7.2],[-21.6,7.2]]));shoulders={'right':attach([407,170]),'left':attach([225,170])}
 elif name=='right':
  hips={k:attach(q) for k,q in zip(drives,[[409,454],[335,402],[235,356],[486,338],[360,270],[145,242]])}
  soles=dict(zip(drives,[[26,6],[10,1],[-16,-5],[20,-15],[-3,-21],[-27,-25]]));shoulders={'right':attach([409,454]),'left':attach([490,374])}
 else:
  hips={k:attach(q) for k,q in zip(drives,[[190,370],[350,265],[578,264],[265,445],[375,393],[497,348]])}
  soles=dict(zip(drives,[[-20,-15],[3,-21],[27,-25],[-26,6],[-10,1],[16,-5]]));shoulders={'left':attach([265,445]),'right':attach([190,370])}
 legs={}
 for key in drives:
  side=key[5];pos=key[-1]
  if name in ['front','back']:
   sign=(-1 if side=='R' else 1)*(1 if name=='front' else -1);bend=p(sign,0);far=pos in ['M','H'] if name=='front' else pos in ['F','M'];mirror=side=='L'
  else:
   near=(side=='R' if name=='right' else side=='L');sign=1 if name=='right' else -1;bend=p((1 if pos=='F' else -1 if pos=='H' else .1)*sign,1);far=not near;mirror=not near
  legs[key]=dict(hip=hips[key],sole=p(*soles[key]),bend=bend,far=far,mirror=mirror)
 blade=art['scytheBlade'];blade_length=math.hypot(blade['tip']['x']-blade['proximal']['x'],blade['tip']['y']-blade['proximal']['y'])*.045
 tools={}
 for side in ['right','left']:
  if name=='front':
   values=dict(guard=[2.94,1.18],windup=[3.75,2.30],follow=[1.15,.45],dead=[2.30,-1.05]);mirror=side=='left';far=False
   if side=='left':values={k:[math.pi-a for a in v] for k,v in values.items()}
  elif name=='back':
   values=dict(guard=[.20,-1.18],windup=[-.61,-2.30],follow=[1.99,-.45],dead=[.84,-2.09]);mirror=side=='left';far=True
   if side=='left':values={k:[math.pi-a for a in v] for k,v in values.items()}
  else:
   near=(side=='right' if name=='right' else side=='left');values=dict(guard=[.3,1.3] if near else [-.25,1.6],windup=[-1.1,-.25] if near else [-1.5,.2],follow=[1.0,2.4] if near else [1.2,2.2],dead=[2.3,-1.05]);mirror=not near;far=not near
   if name=='left':values={k:[math.pi-a for a in v] for k,v in values.items()}
  tools[side]=dict(shoulder=shoulders[side],upper=10.8 if name in ['front','back'] else 10,blade=blade_length,mirror=mirror,far=far,**{k:radians(v) for k,v in values.items()})
 emitters={'acid':p(0,-17),'net':p(0,-30)} if name=='front' else {'acid':p(0,-43),'net':p(0,-36)} if name=='back' else {'acid':p(18,-16),'net':p(-6,-35)} if name=='right' else {'acid':p(-18,-16),'net':p(6,-35)}
 directions[direction]=dict(art=art,layout=dict(upper=15,lower=16.2,stride=12,swingTravel=6,settleSeconds=.30,clearance=1.5,deathLower=7.2,legs=legs,tools=tools,emitters=emitters),physical3DVerified=False)
spec=dict(directions=directions,attackTools=dict(cullerLeftScythe='left',cullerRightScythe='right',cullerAcid='acid',cullerNet='net'))
registry=ROOT/'src/client/sprites.json';m=json.loads(registry.read_text());m['sheets'].update(sheets);m['sheetSizes'].update(sizes);m['frames'].update(frames)
fallback={d:[directions[d]['art']['chassis']['frame']] for d in directions}
m['chars']['av379_culler']=dict(idle=fallback,walk=fallback,attack=fallback,anchor=[.5,1],renderScale=.108,headOffset=62,healthBarWidth=28,shadow=[20,6],heldItems=False,gait=dict(walk=1600,crouchWalk=1800),motionDurations=dict(attack=1000,shoot=1000,hurt=360,fall=650,rise=650),portrait=fallback['down'][0],culler=spec)
registry.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
record=dict(version=379,character='av379_culler',sourceOriginalsReused=4,newSourcePNGs=0,newImagegenCalls=0,sourceRegions=24,nominalDrawInstances=23,authoredFullBodyWalkFrames=0,authoredFullBodyAttackFrames=0,authoredPartDirections=4,originals=originals,partsPhysical3DApproved=False,sourceFeetToeHeelApproved=False,backAppendageRearFacesApproved=False,concaveBladeInnerEdgeApproved=False,layouts='Per-facing2D display assumptions derived from visible graphic cap/sole contract; not measured physical anatomy.',attackMapping=spec['attackTools'],preservedHistoryFiles={name:len(v) for name,v in preserved.items()},spec=spec)
(RECORD/'installation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
(RECORD/'history-sha256.json').write_text(json.dumps(preserved,ensure_ascii=False,indent=2)+'\n')
(RECORD/'sprites.fragment.json').write_text(json.dumps(dict(sheets=sheets,sheetSizes=sizes,frames=frames,chars={'av379_culler':m['chars']['av379_culler']}),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(character='av379_culler',reusedPNGs=4,sourceRegions=24,newPNGs=0,preservedFiles=sum(map(len,preserved.values())))))
