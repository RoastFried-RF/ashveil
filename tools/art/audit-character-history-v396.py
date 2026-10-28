"""Collect one exact historical character-frame witness per preserved PNG sheet."""
from pathlib import Path
import json,hashlib
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--snapshot-root',type=Path,required=True);parser.add_argument('--baseline-registry',type=Path,required=True);args=parser.parse_args()
r=Path(__file__).resolve().parents[2];m=json.loads((r/'src/client/sprites.json').read_text());snapshots=args.snapshot_root;names=['v318-base-craft-stock-implementation','v319-wiki-art-publication-ready','v321-character-terrain-quality-publication-r2','v322-motion-expansion-publication-r1'];sources=[];members={};changed=[];baselineRaw=args.baseline_registry.read_bytes();baseline=json.loads(baselineRaw)
for name in names:
 path=snapshots/name/'src/client/sprites.json';raw=path.read_bytes();old=json.loads(raw);references={}
 for owner,c in old['chars'].items():
  blocks=[(field,c.get(field)) for field in ['walk','idle','attack']]+[(f'motions.{k}',v) for k,v in c.get('motions',{}).items()]
  for field,block in blocks:
   for direction,keys in (block or {}).items():
    for key in keys:references.setdefault(key,[]).append(owner+'.'+field+'.'+direction)
  if c.get('portrait'):references.setdefault(c['portrait'],[]).append(owner+'.portrait')
 accepted=[]
 for key,owners in sorted(references.items()):
  frame=old['frames'].get(key)
  if not frame:continue
  sheet=frame[0];same=m['frames'].get(key)==frame and m['sheets'].get(sheet)==old['sheets'].get(sheet)
  if not same:changed.append({'snapshot':name,'key':key,'historicalSheet':sheet});continue
  members.setdefault(sheet,{'path':m['sheets'][sheet],'sha256':hashlib.sha256((r/'public'/m['sheets'][sheet]).read_bytes()).hexdigest(),'witnessFrames':set()})['witnessFrames'].add(key)
  accepted.append({'frame':key,'rectangle':frame,'owners':owners})
 unique={}
 for witness in accepted:unique.setdefault(witness['rectangle'][0],witness)
 sources.append({'snapshot':name,'registrySHA256':hashlib.sha256(raw).hexdigest(),'references':list(unique.values())})
a={'baselineRegistrySHA256':hashlib.sha256(baselineRaw).hexdigest(),'previousHistorySheets':baseline['characterSheetHistory'],'policy':'Historical character source classification only. All old PNGs, rectangles and explicit saved-frame requests remain available. Current bodies and resolved icons still request their actual sources.','sources':sources,'sheetWitnesses':{k:{**v,'witnessFrames':sorted(v['witnessFrames'])[:1]} for k,v in sorted(members.items())},'historicalAliasesRetargetedAndNotUsedAsWitnesses':changed,'addedHistorySheets':sorted(set(members)-set(baseline['characterSheetHistory']))}
(r/'tools/art/direction-v396/history-audit.json').write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'acceptedSheets':len(members),'newHistorySheets':len(a['addedHistorySheets']),'retargetedHistoricalAliases':len(changed)}))
