"""Register20 original role head regions without raster editing; activate10 ordinary human keys."""
from pathlib import Path
import argparse,json,hashlib,runpy,shutil
ROOT=Path(__file__).resolve().parents[2]
ARCHIVE=ROOT/'tools/art/direction-v389/history/role-heads'
u=runpy.run_path(str(ROOT/'tools/art/install-human-art-v389.py'))
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');parser.add_argument('--source',type=Path,default=ROOT.parent/'.ashveil-planned/v389-human-role-heads');args=parser.parse_args()
source=args.source if args.source.exists() else ARCHIVE
raw=source/'originals/role-heads-four-facings-v1.png';data=raw.read_bytes();sha=hashlib.sha256(data).hexdigest();assert sha=='2d6f88f7119b623423660b39826e4c1ff05a914f053703507e81853675deecfe'
contract=json.loads((source/'head-contract-runtime.json').read_text());roles=contract['roles'];heads={};frames={};sheet='av389_role_heads_v1'
for role,views in roles.items():
 heads[role]={}
 for direction,entry in views.items():
  frames[entry['frame']]=[sheet,*entry['crop']]
  heads[role][direction]={k:v for k,v in entry.items() if k in ['frame','a','b','face','scale'] and v is not None}
assert len(frames)==20 and len(heads)==5
p=ROOT/'src/client/sprites.json';text=p.read_text();before=u['previous_values'](text)
for section,entries in [('sheets',{sheet:'sprites/original/direction-v389/role-heads-four-facings-v1.png'}),('sheetSizes',{sheet:[1536,1024]}),('frames',frames)]:text=u['append_entries'](text,section,entries)
activation={'hero':None,'original_wanderer_hero':None,'resident_worker':'worker','resident_healer':'healer','resident_guard':'guard','resident_trader':'trader','reaver0':'reaver','reaver1':'reaver','complete_reaver_chief':'reaver','complete_reaver_archer':'reaver'}
top,_=u['members'](text);members,_=u['members'](text,top['chars'][0])
for key in sorted(activation,key=lambda key:members[key][0],reverse=True):
 a,b=members[key];fields={'human':True}
 if activation[key]:fields['humanHead']=activation[key]
 wrapped='{"value":'+text[a:b]+'}';updated=u['append_entries'](wrapped,'value',fields);bounds,_=u['members'](updated);x,y=bounds['value'];text=text[:a]+updated[x:y]+text[b:]
after=u['previous_values'](text)
assert all(after[section][key]==value for section,rows in before.items() for key,value in rows.items() if not(section=='chars' and key in activation))
out=ROOT/'src/client/render/human-heads.json';encoded=json.dumps({'heads':heads},ensure_ascii=False,indent=2)+'\n';public=ROOT/'public/sprites/original/direction-v389/role-heads-four-facings-v1.png'
if args.write:
 p.write_text(text);out.write_text(encoded);public.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(raw,public)
 ARCHIVE.mkdir(parents=True,exist_ok=True)
 for relative in ['head-contract-runtime.json','originals/role-heads-four-facings-v1.png']:
  target=ARCHIVE/relative;target.parent.mkdir(parents=True,exist_ok=True)
  if target.exists():assert target.read_bytes()==(source/relative).read_bytes()
  else:shutil.copyfile(source/relative,target)
else:assert p.read_text()==text and out.read_text()==encoded and public.read_bytes()==data
receipt={'rawSHA256':sha,'newPNG':1,'regions':20,'roles':5,'ordinaryHumanKeys':activation,'sourcePixelEdits':0,'authoredActionFrames':0,'inputFailure':'First request rejected before generation:6 references exceed tool limit5; preserved separately. Explicit new allowance used5 references, one successful generation.','alphaLimit':'Faint alpha1 gutters exist; alpha16 principal regions are separated. No alpha filtering or raster rewrite.','contract':'history/role-heads/head-contract-runtime.json'}
record=ROOT/'tools/art/direction-v389/head-registration.json'
if args.write:record.write_text(json.dumps(receipt,indent=2)+'\n')
else:assert json.loads(record.read_text())==receipt
print(json.dumps({'write':args.write,'regions':20,'activatedHumanKeys':len(activation),'originalSHA256':sha,'originalPixelsChanged':False}))
