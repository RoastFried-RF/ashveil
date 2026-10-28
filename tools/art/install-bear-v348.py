"""Register original source rectangles only; keep every source byte and historical review."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[2]
STAGE=ROOT.parent/'.ashveil-planned'
def read(path):return json.loads(path.read_text())
base=read(STAGE/'v334-fauna-art/cinder-bear.partial.json')
side=read(STAGE/'v342-cinder-bear-walk/cinder-bear.walk.partial.json')
rear=read(STAGE/'v344-cinder-bear-rear-walk/cinder-bear.walk-up.partial.json')
states=read(STAGE/'v346-bear-state-art/cinder-bear.states.partial.json')
left=read(STAGE/'v349-bear-left-state-art/cinder-bear.states.partial.json')
manifest_path=ROOT/'src/client/sprites.json'
m=read(manifest_path)
assert 'av331_cinder_bear'not in m['chars'],'Already registered; never silently overwrite originals'
walk={**base['clips']['walk'],**side['clips']['walk'],**rear['clips']['walk']}
motions={name:{**clip,**left['motions'].get(name,{})}for name,clip in states['motions'].items()}
for name,clip in [('walk',walk),('idle',base['clips']['idle']),('attack',base['clips']['attack']),('bite',base['clips']['bite']),*motions.items()]:
 assert set(clip)=={'down','left','right','up'},(name,list(clip))
 assert all(len(keys)==4 and len(set(keys))==4 for keys in clip.values()),name
selected={key for clip in [walk,base['clips']['idle'],base['clips']['attack'],base['clips']['bite'],*motions.values()]for keys in clip.values()for key in keys}
sources=[('base','v334-fauna-art'),('side','v342-cinder-bear-walk'),('rear','v344-cinder-bear-rear-walk'),('states','v346-bear-state-art'),('left','v349-bear-left-state-art'),('materials','v347-cinder-bear-harvest-icons'),('notes','v350-bear-processing-notes')]
archive=ROOT/'tools/art/direction-v348';archive.mkdir(parents=True,exist_ok=True)
originals=[]
for label,folder in sources:
 stage=STAGE/folder;fragment=read(stage/'sprites.fragment.json')
 keys=set(fragment['frames'])&selected if label not in ['materials','notes']else set(fragment['frames'])
 sheets={fragment['frames'][key][0]for key in keys}
 for sheet in sorted(sheets):
  rel=fragment['sheets'][sheet];source=stage/'originals'/Path(rel).name;target=ROOT/'public'/rel
  assert source.is_file(),source
  sha=hashlib.sha256(source.read_bytes()).hexdigest()
  if target.exists():assert target.read_bytes()==source.read_bytes(),target
  else:target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
  if sheet in m['sheets']:assert m['sheets'][sheet]==rel
  m['sheets'][sheet]=rel;m.setdefault('sheetSizes',{})[sheet]=fragment['sheetSizes'][sheet]
  originals.append({'path':str(target.relative_to(ROOT)),'source':str(source),'sha256':sha})
 for key in sorted(keys):
  if key in m['frames']:assert m['frames'][key]==fragment['frames'][key]
  m['frames'][key]=fragment['frames'][key]
 # Preserve historical proposed active:false records verbatim; the parent receipt below owns installation.
 history=archive/label
 assert not history.exists(),history
 shutil.copytree(stage,history,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
transforms={**base['frameTransforms'],**side['frameTransforms'],**rear['frameTransforms'],**states['frameTransforms'],**left['frameTransforms']}
assert selected<=set(m['frames']) and selected<=set(transforms)
assert len(selected)==144,len(selected)
# A bear's shoulder stays lower than an upright person. This is a runtime scale, not raster resampling.
registered={key:{**transforms[key],'scale':transforms[key]['scale']*.75}for key in sorted(selected)}
m['chars']['av331_cinder_bear']={'walk':walk,'idle':base['clips']['idle'],'attack':base['clips']['attack'],'attackVariants':{'paw':base['clips']['attack'],'bite':base['clips']['bite']},'motions':motions,'anchor':[.5,1],'renderScale':.105,'headOffset':33,'shadow':[18,7],'healthBarWidth':24,'heldItems':False,'gait':{'walk':1400,'crouchWalk':1800},'motionDurations':{'attack':700,'hurt':400,'fall':650,'rise':800,'sleep':2600,'work':1600},'frameTransforms':registered}
manifest_path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
receipt={'version':348,'stage':'installed-development-awaits-native-review','releaseApproved':False,'uniqueBodyRegions':len(selected),'uniqueIconRegions':5,'walkFramesPerDirection':4,'denseWalk12Approved':False,'runtimeScaleFactor':.75,'rasterChanges':False,'originals':originals,'scope':'Parent registration: historical staging active:false is preserved; this receipt does not approve actual game locomotion, every limb state or v1release.'}
(archive/'installation.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'bodyRegions':144,'icons':5,'originalPngs':len(originals),'receipt':str(archive/'installation.json')}))
