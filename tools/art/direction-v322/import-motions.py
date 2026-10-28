"""Register preserved original PNG poses. Never resample or modify source pixels."""
from pathlib import Path
import argparse,copy,hashlib,json,statistics
from PIL import Image
from pose_anchors import attachment
from semantic_registration import repair
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--install',action='store_true');parser.add_argument('--partial',action='store_true');args=parser.parse_args()
plan=json.loads((HERE/'generation-plan.json').read_text());roles=json.loads((HERE.parent/'direction-v321/actor-plan.json').read_text());baseline=json.loads((HERE/'baseline-characters.json').read_text());manifest=json.loads((ROOT/'src/client/sprites.json').read_text())
fragment={'sheets':{},'frames':{},'chars':{}};audit=[];missing=[]
for role in roles:
 jobs=[job for job in plan if job['role']==role['id']];clips={};transforms={};sheets={};frames={};roleMissing=[];sourceHashes=[]
 for job in jobs:
  source=HERE/'sources'/(job['id']+'.json')
  if not source.exists():roleMissing.append(job['id']);continue
  record=json.loads(source.read_text())
  if not record['accepted']:roleMissing.append(job['id']);continue
  accepted=next(a for a in reversed(record['attempts'])if a['accepted']);path=ROOT/accepted['installed'];assert hashlib.sha256(path.read_bytes()).hexdigest()==accepted['sha256']
  sheet='av322_'+job['id'].replace('-','_');sheets[sheet]=str(path.relative_to(ROOT/'public'));rows=accepted['poses'];mode=job['mode'];alpha=Image.open(path).convert('RGBA').getchannel('A');sourceHashes.append({'id':job['id'],'sha256':accepted['sha256']})
  groups=[]
  if accepted.get('layout')in['locomotion-A','locomotion-B']:
   for direction,row in zip(['down','left','right','up'],rows):
    segments={'walk':row}if accepted['layout']=='locomotion-A'else{'walk':row[:4],'idle':row[4:8]}
    groups.append((direction,segments,row[4:8]))
  elif mode in ['locomotion','combat','active']:
   for index,direction in enumerate(job['directions']):
    pair=rows[index*2]+rows[index*2+1]
    if mode=='locomotion':segments={'walk':pair[:12],'idle':pair[12:16]};refs=pair[12:16]
    elif mode=='combat':segments={'attack':pair[:8],'block':pair[8:12],'hurt':pair[12:16]};refs=[pair[0],pair[7],pair[11],pair[15]]
    else:segments={'crouchWalk':pair[:8],'work':pair[8:12],'use':pair[12:16]};refs=[pair[15]]
    groups.append((direction,segments,refs))
  else:
   for direction,row in zip(job['directions'],rows):
    if mode=='ground':segments={'fall':row[:6],'sleep':row[6:8]};refs=[row[0]]
    else:segments={'shoot':row[:4],'throw':row[4:6],'interact':row[6:8]};refs=[row[3],row[7]]
    groups.append((direction,segments,refs))
  for direction,segments,refs in groups:
   scale=role['height']/statistics.median(p['bodyHeight']for p in refs)
   for name,poses in segments.items():
    keys=[]
    for index,pose in enumerate(poses):
     offset=len(clips.get(name,{}).get(direction,[]));key=f'av322_{role["id"]}_{name}_{direction}{offset+index}'if accepted.get('layout')else f'av322_{role["id"]}_{name}_{direction}{index}';keys.append(key);frames[key]=[sheet,*pose['frame']];transforms[key]=attachment(alpha,pose,name,direction,scale,role['id']in['wanderer','guard','reaver','worker','healer','trader','patient','spore'])
    if accepted.get('layout'):clips.setdefault(name,{}).setdefault(direction,[]).extend(keys)
    else:clips.setdefault(name,{})[direction]=keys
 if roleMissing:
  missing.extend(roleMissing)
  if args.partial:continue
  continue
 corrections=repair(role['id'],clips,frames,transforms)
 for direction in ['down','left','right','up']:
  clips.setdefault('rise',{})[direction]=list(reversed(clips['fall'][direction]))
  clips.setdefault('crouchDown',{})[direction]=clips['fall'][direction][:3]
  clips.setdefault('stand',{})[direction]=list(reversed(clips['fall'][direction][:3]))
 char=copy.deepcopy(baseline['characters'][role['bindings'][0]]);char.pop('attackAnchor',None);char['walk']=clips.pop('walk');char['idle']=clips.pop('idle');char['attack']=clips.pop('attack');char['motions']=clips;char['frameTransforms']=transforms
 char['anchor']=[.5,1];char['renderScale']=transforms[char['idle']['down'][0]]['scale'];char['headOffset']=role['height']+2
 for binding in role['bindings']:
  assigned=copy.deepcopy(char);assigned['portrait']=baseline['characters'][binding].get('portrait')
  if not assigned['portrait']:assigned.pop('portrait')
  ratio=role.get('bindingHeights',{}).get(binding,role['height'])/role['height'];assigned['renderScale']*=ratio;assigned['headOffset']*=ratio
  for transform in assigned['frameTransforms'].values():
   transform['scale']*=ratio
   if 'mainHand'in transform:transform['mainHand']=[value*ratio for value in transform['mainHand']]
  if binding=='tender_drone_inert':
   assigned.pop('attack',None);assigned.pop('motions',None)
   for mode in ['walk','idle']:assigned[mode]={d:[assigned['idle'][d][0]]for d in ['down','left','right','up']}
  fragment['chars'][binding]=assigned
 fragment['sheets'].update(sheets);fragment['frames'].update(frames)
 audit.append({'model':role['id'],'registrations':role['bindings'],'frameKeys':len(frames),'uniqueSourceRegions':len({tuple(v)for v in frames.values()}),'facingCorrections':corrections,'sources':sourceHashes,'counts':{name:{direction:len(keys)for direction,keys in clip.items()}for name,clip in {'walk':char['walk'],'idle':char['idle'],'attack':char['attack'],**clips}.items()}})
if missing and not args.partial:raise SystemExit('Missing accepted original sheets: '+', '.join(missing))
fragment['characterSheetHistory']=sorted(set(manifest.get('characterSheetHistory',[])+baseline['characterSheetHistory']))
(HERE/'motions.fragment.json').write_text(json.dumps(fragment,indent=2)+'\n');(HERE/'motion-audit.json').write_text(json.dumps({'models':audit,'missing':missing,'pngPixelsModified':False,'partial':args.partial},indent=2)+'\n')
if args.install:
 for key in ['sheets','frames','chars']:manifest[key].update(fragment[key])
 manifest['characterSheetHistory']=fragment['characterSheetHistory'];(ROOT/'src/client/sprites.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'models':len(audit),'registrations':len(fragment['chars']),'newSheets':len(fragment['sheets']),'newFrames':len(fragment['frames']),'missing':len(missing),'installed':args.install}))
