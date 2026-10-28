"""Read-only installed bytes/region audit, separate from visual or release approval."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
m=json.loads((ROOT/'src/client/sprites.json').read_text())
receipt=json.loads((HERE/'installation.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
errors=[]
for row in receipt['originals']:
 if sha(ROOT/row['path'])!=row['sha256']:errors.append('Installed PNG mismatch: '+row['path'])
 copies=list(HERE.glob('*/originals/'+Path(row['path']).name))
 if not any(sha(copy)==row['sha256']for copy in copies):errors.append('No exact archived source: '+row['path'])
c=m['chars']['av331_cinder_bear']
clips=[c['walk'],c['idle'],c['attack'],*c['attackVariants'].values(),*c['motions'].values()]
keys={key for clip in clips for frames in clip.values()for key in frames}
regions={tuple(m['frames'][key])for key in keys}
if len(keys)!=144 or len(regions)!=144:errors.append('144distinct original body regions required')
if any(c['frameTransforms'][key].get('flipX',False)for key in keys):errors.append('New body mirroring is not authored source')
if c['attackVariants']['paw']!=c['attack']:errors.append('The base paw alias is explicitly shared')
icons=['av331_cinder_bear_hide','av331_bear_fat','av331_bear_claw','av331_bear_bile','av350_bear_processing_notes']
if len({tuple(m['frames'][key])for key in icons})!=5:errors.append('Five independent icon regions required')
if len(receipt['originals'])!=15:errors.append('Fifteen selected original PNGs required')
result={'scope':'Installed bytes/rectangles only; not anatomy, locomotion or release approval','originalPNGs':len(receipt['originals']),'uniqueBodyRegions':len(regions),'uniqueIconRegions':len(icons),'motionFamilies':9,'walkFramesPerDirection':4,'dense12Approved':False,'newBodyMirrors':0,'sharedPawAlias':True,'errors':errors}
print(json.dumps(result))
raise SystemExit(bool(errors))
