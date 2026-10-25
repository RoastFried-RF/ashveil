"""Install six original care/bedding icons and five one-tile bedding art registrations."""
from pathlib import Path
import argparse
import hashlib
import json
import runpy
import shutil
import struct
ROOT=Path(__file__).resolve().parents[2]
ARCHIVE=ROOT/'tools/art/direction-v386'
HISTORY=ARCHIVE/'history/v386-care-art'
STAGING=ROOT.parent/'.ashveil-planned/v386-care-art'
MANIFEST=ROOT/'src/client/sprites.json'
PUBLIC=ROOT/'public/sprites/original/direction-v386/care-bedding-props-v1.png'
PATCH=ROOT/'src/content/core/patches/zzz-care-props-v386.json'
SHA='2bca0f1dcef8b529d5987b9cf4c92334e548425bcf03858aa058570f3573d325'
UTIL=runpy.run_path(str(ROOT/'tools/art/install-culler-icons-v380.py'))

def read(p): return json.loads(p.read_bytes())
def digest(b): return hashlib.sha256(b).hexdigest()
def encoded(v): return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()
def copy_exact(s,t,write):
 b=s.read_bytes()
 if t.exists(): assert t.read_bytes()==b,('Historical/original bytes differ',t)
 elif write:
  t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(s,t)
 return {'path':str(t.relative_to(ROOT)),'sha256':digest(b),'bytes':len(b)}

def main():
 p=argparse.ArgumentParser(description=__doc__);mode=p.add_mutually_exclusive_group();mode.add_argument('--write',action='store_true');mode.add_argument('--check',action='store_true');p.add_argument('--source-dir',type=Path,default=HISTORY if HISTORY.is_dir() else STAGING);args=p.parse_args();stage=args.source_dir.resolve()
 assert stage!=ARCHIVE and stage not in ARCHIVE.parents
 layout=read(stage/'contracts/care-art-layout.json');fragment=read(stage/'contracts/sprites.fragment.json');patch=read(stage/'contracts/item-sprites.patch.json');history_plan=read(stage/'records/installation-history-files.json');budget=read(stage/'records/call-budget.json');meta=read(stage/'records/generated-original.json')
 data=(stage/'originals/care-bedding-props-v1.png').read_bytes();assert digest(data)==SHA and len(data)==1986230 and data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==(1536,1024) and data[24:26]==bytes((8,6))
 prompt=(stage/'requests/care-bedding-props-v1.prompt.txt').read_bytes();request=read(stage/'requests/care-bedding-props-v1.request.json');assert request['prompt'].encode()==prompt and request['transparent_background'] is True and digest(prompt)==budget['promptSHA256']
 assert layout['sourceUniqueObjects']==layout['itemIconBindings']==len(layout['items'])==6 and layout['terrainBeddingBindings']==5
 assert budget['actualCalls']==budget['actualPNGs']==meta['actualCalls']==1 and budget['automaticRegeneration']==0 and budget['moreCallsAllowed']==0
 assert layout['pixelEdits']==layout['newCharacters']==layout['newAnimationFrames']==layout['newMedicalStations']==0 and not layout['active']
 assert len(fragment['sheets'])==len(fragment['sheetSizes'])==1 and len(fragment['frames'])==6
 assert patch==[{'op':'replace','target':i['item'],'path':'/sprite','value':i['sprite']}for i in layout['items']]
 for row in layout['items']:
  assert fragment['frames'][row['sprite']][1:]==row['sourceRect']
  assert row['sourceAlpha']['mainPixels16OutsideCrop']==row['sourceAlpha']['otherMajor16InsideCrop']==row['sourceAlpha']['alpha1MainOutsideCrop']==0
  if row['terrain']:
   assert row['worldDisplay']['boundTilePx']==[16,16] and row['worldDisplay']['rotation']==0 and not row['worldDisplay']['logicalPlacementChanged']
 before_bytes=MANIFEST.read_bytes();before=before_bytes.decode();prior=UTIL['previous_values'](before);after=before
 for section,entries in fragment.items():after=UTIL['append_entries'](after,section,entries)
 installed=UTIL['previous_values'](after);assert set(prior)==set(installed)
 projection={s:{key:installed[s][key]for key in rows}for s,rows in prior.items()};assert projection==prior,'All previous registry value bytes must survive'
 old,new=json.loads(before),json.loads(after);assert old['chars']==new['chars']and old['anims']==new['anims']
 history=[]
 for row in history_plan['files']:
  f=stage/row['path'];assert digest(f.read_bytes())==row['sha256']and f.stat().st_size==row['bytes'];history.append(copy_exact(f,HISTORY/row['path'],args.write))
 history.append(copy_exact(stage/'records/installation-history-files.json',HISTORY/'records/installation-history-files.json',args.write));public=copy_exact(stage/'originals/care-bedding-props-v1.png',PUBLIC,args.write);patch_bytes=encoded(patch)
 if PATCH.exists():assert PATCH.read_bytes()==patch_bytes,'Do not overwrite a different sprite patch'
 receipt={'version':386,'status':'six-item-icons-five-static-bedding-views-registered-awaiting-parent-native','resourceRegistrationCompleted':True,'parentDirectOriginalReview':True,'nativeAcceptance':'pending-parent-native','releaseApproved':False,'generation':{'calls':1,'PNGs':1,'regeneration':0},'sourceOriginal':public,'sourceUniqueObjects':6,'registeredFrames':fragment['frames'],'registeredItems':{i['item']:i['sprite']for i in layout['items']},'beddingDisplay':{i['terrain']:i['worldDisplay']for i in layout['items']if i['terrain']},'rendererFiles':['src/client/render/terrain-art.ts','src/client/render/MapRenderer.ts bedding branch only'],'spriteOnlyPatch':{'path':str(PATCH.relative_to(ROOT)),'sha256':digest(patch_bytes)},'newChars':0,'newAnims':0,'CoreEffectsOrOccupancyChanged':False,'logicalTilePlacementOrRotationChanged':False,'lightOrPassabilityChanged':False,'sourcePNGEdits':0,'reencodings':0,'priorRawValueDigest':digest(encoded(prior)),'afterProjectionRawValueDigest':digest(encoded(projection)),'priorRegistryValueBytesPreserved':True,'manifestBeforeSHA256':digest(before_bytes),'manifestAfterSHA256':digest(after.encode()),'historyFiles':history,'historicalSourceFlagsChanged':False,'limits':['Original alpha1 fringe retained, canvas-edge240pixels; no threshold16major loss or other-object mixing.','Requested60percent cell height exceeded by bedding5; actual crop/neighbor separation passed.','One static north-up object per item, shared by inventory/map. No authored sleeping body, made/occupied bed, sterility or free supply claim.','MedicalBag5uses remain Core state; no new medical workstation or treatment bonus.','Parent owns actual game, saved state, sleep/fire/scorch/bedsharing/Native acceptance.'],'validation':'Installer write/check and6resolved Item/5Terrain/explicit16px display registration only; no shared build/game/full tests/push.'}
 receipt_path=ARCHIVE/'installation.json';fragment_path=ARCHIVE/'sprites.fragment.json'
 if receipt_path.exists():
  saved=read(receipt_path);assert saved['registeredFrames']==fragment['frames']and saved['sourceOriginal']==public and saved['historyFiles']==history and saved['priorRawValueDigest']==saved['afterProjectionRawValueDigest']and saved['spriteOnlyPatch']==receipt['spriteOnlyPatch']
 if args.check:
  assert after==before and PATCH.read_bytes()==patch_bytes and receipt_path.is_file()and fragment_path.read_bytes()==encoded(fragment)
  assert all((ROOT/x['path']).is_file()for x in history+[public])
 if args.write:
  ARCHIVE.mkdir(parents=True,exist_ok=True);assert MANIFEST.read_bytes()==before_bytes,'Concurrent registry write; retry safely'
  if after!=before:MANIFEST.write_bytes(after.encode())
  if not PATCH.exists():PATCH.write_bytes(patch_bytes)
  if not fragment_path.exists():fragment_path.write_bytes(encoded(fragment))
  if not receipt_path.exists():receipt_path.write_bytes(encoded(receipt))
 print(json.dumps({'mode':'write'if args.write else'check'if args.check else'plan','manifestChanged':after!=before,'priorRegistryValueBytesPreserved':True,'sheets':1,'frames':6,'spriteOnlyItemPatch':6,'beddingViews':5,'newChars':0,'newAnims':0,'historyFiles':len(history),'parentNativeAcceptance':'pending'}))
if __name__=='__main__':main()
