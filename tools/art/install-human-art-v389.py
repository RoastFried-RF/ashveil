"""Build source-preserving v389 HumanSpec; --check plans without registry/public writes.
--write installs five unchanged PNGs and116 frame registrations, never chars/anims.
Graphic2D anchors/shared material aliases are not authored anatomical surfaces or3D proof.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import shutil
import struct

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT/'tools/art/direction-v389'
HISTORY = ARCHIVE/'history'
STAGING = ROOT.parent/'.ashveil-planned'
MANIFEST = ROOT/'src/client/sprites.json'
ART = ROOT/'src/client/render/human-art.json'
DIRECTIONS = ('down','left','right','up')
FACE = {'front':'down','left':'left','right':'right','back':'up'}
SIDES = ('left','right')
SOURCES = (
 ('v381-human-body-parts','originals/wanderer-components-four-facings-v1.png','av389_human_base_v381','human-base-parts-v381.png','f05cfe92abe4e81218d5f415310a008a0335379729ad5b6af2c641c45938e25e'),
 ('v386-trouser-art','originals/cloth-trouser-panels-four-facings-v1.png','av389_human_trousers_v386','sewn-trouser-panels-v386.png','da657fa5718552d5acaf93d9fcd2c40cf914c8b0f3e2624a0d8a3e19cd16b997'),
 ('v389-worn-torso-art','originals/torso-panels-v1.png','av389_worn_torso_panels_v1','worn-torso-panels-v1.png','c4dd3df2d50e64289aa14f2da06791a29154d9e195343afb3fb35496a86b0621'),
 ('v389-worn-limb-art','originals/worn-limb-garments-four-facings-v1.png','av389_worn_limb_garments_v1','worn-limb-garments-v1.png','9e6155cbfa81eacddb18776596d768786fcc027376a4f122c817d514bea9f947'),
 ('v389-worn-accessory-art','originals/worn-accessories-four-facings-v1.png','av389_worn_accessories_v1','worn-accessories-v1.png','cd434a2070913380747181e7d871f067bdffa8459c079757e0ed856d0f653c3d'),
)
LIMB_KINDS = {
 'linen_short_upper_sleeve':'upperCloth','worn_leather_upper_sleeve':'upperLeather',
 'iron_mail_upper_sleeve':'upperMail','padded_cloth_forearm_sleeve':'forearmCloth',
 'leather_forearm_sleeve':'forearmLeather','leather_glove':'gloveLeather',
 'wool_glove':'gloveWool','ankle_leather_boot':'boot',
}
ACCESSORY_KINDS = {'leather_apron':'apron','oilcloth_cloak':'cloak','scrap_helmet':'helmet',
 'ash_mask':'mask','protective_goggles':'goggles','leather_quiver':'quiver',
 'leather_belt':'belt','chitin_cuirass':'cuirass'}
TORSO_KINDS = {'rag_shirt_torso':'shirt','leather_coat_body':'coat','iron_mail_torso':'mail','hood_shell':'hood'}

def encoded(value):
 return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
def digest(data):
 return hashlib.sha256(data).hexdigest()
def read(path):
 return json.loads(path.read_bytes())
def mid(a,b):
 return [(a[0]+b[0])/2,(a[1]+b[1])/2]
def local(source,crop):
 return [source[0]-crop[0],source[1]-crop[1]]

def members(text,start=0):
 """Keep previous registry member value bytes exactly; do not reserialize them."""
 decoder,found,pos=json.JSONDecoder(),{},start+1
 assert text[start]=='{'
 while True:
  while text[pos].isspace() or text[pos]==',':pos+=1
  if text[pos]=='}':return found,pos
  key,pos=decoder.raw_decode(text,pos);assert key not in found,('Duplicate JSON key',key)
  while text[pos].isspace():pos+=1
  assert text[pos]==':';pos+=1
  while text[pos].isspace():pos+=1
  begin=pos;_,pos=decoder.raw_decode(text,pos);found[key]=(begin,pos)

def previous_values(text):
 top,_=members(text);out={}
 for section,(begin,end) in top.items():
  out[section]={k:text[a:b] for k,(a,b) in members(text,begin)[0].items()} if text[begin]=='{' else {'__value__':text[begin:end]}
 return out

def append_entries(text,section,entries):
 top,_=members(text);existing,close=members(text,top[section][0]);incoming={}
 for key,value in entries.items():
  if key in existing:
   begin,end=existing[key];assert json.loads(text[begin:end])==value,('Refuse different existing value',section,key)
  else:incoming[key]=value
 if not incoming:return text
 pos=close
 while text[pos-1].isspace():pos-=1
 body=json.dumps(incoming,ensure_ascii=False,indent=2)[2:-2]
 return text[:pos]+(',' if existing else '')+'\n'+'\n'.join('  '+line for line in body.splitlines())+text[pos:]

def build(source_root):
 inputs={};copies=[];fragment={'sheets':{},'sheetSizes':{},'frames':{}}
 def use(folder,name):
  path=source_root/folder/name;data=path.read_bytes()
  inputs[str(Path(folder)/name)]={'sha256':digest(data),'bytes':len(data)}
  return path,data
 def contract(folder,name):return json.loads(use(folder,name)[1])
 sheet_by_folder={}
 for folder,name,sheet,public_name,sha in SOURCES:
  path,data=use(folder,name);assert digest(data)==sha,('Original source changed',path)
  assert data[:8]==b'\x89PNG\r\n\x1a\n' and data[24:26]==bytes((8,6)),('RGBA8 PNG required',path)
  width,height=struct.unpack('>II',data[16:24]);target='sprites/original/direction-v389/'+public_name
  fragment['sheets'][sheet]=target;fragment['sheetSizes'][sheet]=[width,height]
  copies.append({'sourceRelative':str(Path(folder)/name),'public':'public/'+target,'sha256':sha,'bytes':len(data)})
  sheet_by_folder[folder]=sheet
 def frame(key,folder,crop):
  sheet=sheet_by_folder[folder];assert len(crop)==4 and all(isinstance(x,int) for x in crop)
  x,y,w,h=crop;sw,sh=fragment['sheetSizes'][sheet]
  assert min(x,y)>=0 and min(w,h)>0 and x+w<=sw and y+h<=sh,('Out-of-bounds crop',key,crop)
  value=[sheet,*crop]
  assert key not in fragment['frames'] or fragment['frames'][key]==value
  fragment['frames'][key]=value
  return key
 def source(frame_key,a,b,**extra):
  assert len(a)==len(b)==2 and math.hypot(b[0]-a[0],b[1]-a[1])>0,('Degenerate graphic pair',frame_key,a,b)
  return {'frame':frame_key,'a':a,'b':b,**extra}
 base_folder='v381-human-body-parts';assembly=contract(base_folder,'assembly-contract.json')
 joints=contract(base_folder,'joint-registration.json')['parts'];torso_contract=contract(base_folder,'torso-contract.json')
 panels=contract('v386-trouser-art','panel-sources.json');panel_map={p['rawId']:p for p in panels['parts']}
 base={}
 for direction in DIRECTIONS:
  chosen=assembly['facings'][direction]
  def part(key):
   row=joints[key];frame(key,base_folder,row['sourceCrop']);return row
  def pt(row,name):return row['landmarks'][name]['crop']
  head=part(chosen['head']);torso=part(chosen['torso']);foot=part(chosen['shinFoot'])
  lm=torso['landmarks'];waist=mid(lm['waistLeft']['crop'],lm['waistRight']['crop'])
  hips={s:lm[s+'Hip']['crop'] for s in SIDES};neck=lm['neckSocket']['crop']
  torso_source=source(chosen['torso'],mid(hips['left'],hips['right']),neck,neck=neck,waist=waist[1],
   chestEnd=neck[1]+(waist[1]-neck[1])*.55,shoulders={s:lm[s+'Shoulder']['crop'] for s in SIDES},hips=hips)
  upper={};forearm={};legs={}
  for s in SIDES:
   up_id=chosen['upperArms'][s];up=part(up_id);upper[s]=source(up_id,pt(up,'shoulderOverlap'),pt(up,'elbowOverlap'))
   lower_id=chosen['forearmHands'][s];lower=part(lower_id);split=lower['wristSplit']
   forearm[s]=source(lower_id,pt(lower,'elbowOverlap'),pt(lower,'gripCenter'),wrist=pt(lower,'wrist'),
    split={'origin':local(split['originSource'],lower['sourceCrop']),'normal':split['distalNormalSource']})
   panel_id=panels['observedFacingMapping'][direction][SIDES.index(s)];panel=panel_map[panel_id]
   assert panel['observedFacing']==direction and panel['clothSourceCandidateAccepted']
   assert panel['mainAlpha16Lost']==panel['foreignMajorAlpha16InCrop']==0
   key=frame(panel_id,'v386-trouser-art',panel['sourceCrop']);p=panel['landmarks']
   legs[s]=source(key,p['upperOverlapCenter']['crop'],p['lowerHemCenter']['crop'],knee=p['kneeFoldCenter']['crop'])
  ankle=foot['ankleSplit']
  base[direction]={'head':source(chosen['head'],pt(head,'neckOverlap'),[head['sourceCrop'][2]/2,0]),
   'torso':torso_source,'upper':upper,'forearm':forearm,'legs':legs,
   'foot':source(chosen['shinFoot'],pt(foot,'ankle'),pt(foot,'sole'),
    split={'origin':local(ankle['originSource'],foot['sourceCrop']),'normal':ankle['distalNormalSource']})}
 pieces={}
 torso_art=contract('v389-worn-torso-art','contracts/garment-landmarks.json')
 for row in torso_art['bindings']:
  kind=TORSO_KINDS[row['kind']];direction=row['actualFacing'];m=row['landmarks']
  if kind=='hood':a,b=m['collarCenter']['crop'],m['crownCenter']['crop']
  else:a,b=m['collarCenter']['crop'],m['waistBeltCenter' if kind=='coat' else 'hemCenter']['crop']
  key=frame(row['sourceUniqueId'],'v389-worn-torso-art',row['sourceRect'])
  pieces.setdefault(kind,{})[direction]=source(key,a,b)
 limb=contract('v389-worn-limb-art','garment-contract.proposal.json')
 for row in limb['pieces']:
  kind=LIMB_KINDS[row['garment']];direction=FACE[row['facing']];m=row['anchorsCropLocalPixels']
  key=frame(row['key'],'v389-worn-limb-art',row['sourceCrop'])
  if kind=='boot':
   a,b=m['ankleGraphicHinge'],m['soleBaseline']
   extra={'split':{'origin':a,'normal':[b[0]-a[0],b[1]-a[1]]}}
  elif kind in ('gloveLeather','gloveWool'):
   a,b=m['wristSeam'],m['distalFingerPocket']
   extra={'split':{'origin':a,'normal':[b[0]-a[0],b[1]-a[1]]}}
  else:a,b,extra=m['graphicProximal'],m['graphicDistal'],{}
  pieces.setdefault(kind,{})[direction]=source(key,a,b,**extra)
 accessory=contract('v389-worn-accessory-art','source-regions.json')
 supplemental=contract('v389-worn-accessory-art','secondary-mounts.json')
 for region,row in accessory['regions'].items():
  garment,facing=region.split('.');kind=ACCESSORY_KINDS[garment];direction=FACE[facing];points=row['graphicMounts']
  a=points[0]['cropXY']
  b=points[1]['cropXY'] if len(points)>1 else supplemental['regions'][region]['cropXY']
  hem=supplemental.get('cuirassHem',{}).get(region)
  if kind=='cuirass' and hem is not None:b=hem['cropXY']
  key=frame('av389_worn_'+kind+'_'+direction,'v389-worn-accessory-art',row['crop'])
  pieces.setdefault(kind,{})[direction]=source(key,a,b)
 wardrobe={}
 def wear(ids,rule):
  for item in ids:assert item not in wardrobe;wardrobe[item]=dict(rule)
 wear(['Item.RagShirt','Item.CustomShirt'],{'torso':'shirt','upper':'upperCloth'})
 wear(['Item.WoolShirt'],{'torso':'shirt','upper':'upperCloth','tint':0xb6ae98})
 wear(['Item.OilclothShirt'],{'torso':'shirt','upper':'upperCloth','tint':0x75807a})
 wear(['Item.PaddedJacket'],{'torso':'shirt','upper':'upperCloth','forearm':'forearmCloth','tint':0xc3b69d})
 wear(['Item.LeatherCoat','Item.CustomCoat'],{'torso':'coat','upper':'upperLeather','forearm':'forearmLeather'})
 wear(['Item.WolfCoat'],{'torso':'coat','upper':'upperLeather','forearm':'forearmLeather','tint':0xb9b3a5})
 wear(['Item.ScrapMail','Item.CustomMail','Item.IronMail'],{'torso':'mail','upper':'upperMail'})
 wear(['Item.SteelMail'],{'torso':'mail','upper':'upperMail','tint':0xc6cbcc})
 for item,rule in {
  'Item.Hood':{'accessory':'hood'},'Item.ScrapHelmet':{'accessory':'helmet'},
  'Item.AshMask':{'accessory':'mask'},'Item.OpticalGoggles':{'accessory':'goggles'},
  'Item.LeatherApron':{'torso':'apron'},'Item.CrawlerCuirass':{'torso':'cuirass'},
  'Item.OilclothCloak':{'accessory':'cloak'},'Item.OiledRaincoat':{'accessory':'cloak','tint':0x788078},
  'Item.Gloves':{'hands':'gloveLeather'},'Item.WoolGloves':{'hands':'gloveWool'},
  'Item.Boots':{'feet':'boot'},'Item.LeatherBelt':{'accessory':'belt'},'Item.Quiver':{'accessory':'quiver'},
 }.items():wear([item],rule)
 current=contract('v389-human-clothing-review','records/resolved-wearables.json')
 assert set(wardrobe)=={d['id'] for d in current['clothing']} and len(wardrobe)==25
 old=contract('v384-prosthetic-mounts','contracts/selected-prosthetic-art.json');registry=read(MANIFEST);replacements={}
 for row in old['items']:
  key=row['proposedSprite'];assert registry['frames'][key][1:]==row['sourceRect'],('Existing replacement frame changed',key)
  sheet=registry['frames'][key][0];path=ROOT/'public'/registry['sheets'][sheet]
  assert digest(path.read_bytes())==row['sourceSha256']
  mount=row['mountGraphicCandidate']['crop'];tip=(row.get('tipGraphicCandidate') or row['axisEndGraphicCandidate'])['crop']
  replacements[row['def']]=source(key,mount,tip,root=mount,tip=tip)
 spec={'id':'av389_human','base':base,'pieces':pieces,'wardrobe':wardrobe,'replacements':replacements}
 assert set(pieces)==set(TORSO_KINDS.values())|set(LIMB_KINDS.values())|set(ACCESSORY_KINDS.values())
 assert len(pieces)==20 and all(set(v)==set(DIRECTIONS) for v in pieces.values())
 assert len(fragment['frames'])==116 and len(replacements)==6
 assert not any('Thigh' in key and key.startswith('av381_') for key in fragment['frames'])
 # Preserve requests and historical metadata; never rewrite their source-only/rejected flags.
 for folder,*_ in SOURCES:
  root=source_root/folder
  for path in sorted(root.rglob('*')):
   if path.is_file() and (path.parent.name=='requests' or path.name in ('prompt.txt','request.txt','generation-args.json','provenance.json','visual-review.json','handoff-contract.json','README.md','HANDOFF.md')):
    use(folder,str(path.relative_to(root)))
 provenance={'version':389,'status':'source-contract-plan-no-character-activation','humanSpecId':spec['id'],
  'sourcePNGs':copies,'registeredSourceRegions':116,'baseAuthoredRegionsReused':28,'sewnIntrinsicClothingRegionsReused':8,
  'newGarmentSourceRegions':80,'newGarmentSourcePNGs':3,'newAnimationFrames':0,'newChars':0,
  'prostheticExistingSharedViews':6,'wardrobeAliases':wardrobe,
  'inputs':inputs,'originalPixelsEdited':0,'newRasterMasks':0,'historicalFlagsChanged':False,
  'assumptions':{'chestEnd':'neck.y +.55*(waist.y-neck.y), client-only source allocation assumption; Chest/Abdomen are not separately authored.',
   'headTop':'source-crop top-center graphic bound, not observed skull anatomy',
   'legOwners':'two generic sewn panels per actual facing assigned left/right display roles, anatomical source ownership unproved',
   'garments':'all25 actual apparel IDs explicitly share20 part kinds and selected tints, not25 independently authored costumes',
   'accessoryExclusion':'BoneCharm/SealRing have no apparel rules and are outside this25-item HumanSpec; no fabricated ring socket',
   'replacementViews':'existing av384one-view objects shared explicitly, hidden/backside not proved; efficiency0 metal stays visible in owner renderer'},
  'parentNativeAcceptance':'pending-separate-parent-record','runtimeActivation':False,'releaseAccepted':False}
 # Finite source-contract consistency checks, no renderer/browser or game execution.
 sources=[]
 for direction in DIRECTIONS:
  b=base[direction];sources.extend([b['head'],b['torso'],b['foot'],*b['upper'].values(),*b['forearm'].values(),*b['legs'].values()])
 for views in pieces.values():sources.extend(views.values())
 sources.extend(replacements.values())
 for row in sources:
  registered=fragment['frames'].get(row['frame']) or registry['frames'][row['frame']]
  width,height=registered[3:5]
  for key in ('a','b','wrist','knee','root','tip','neck'):
   if key in row:
    x,y=row[key];assert math.isfinite(x) and math.isfinite(y) and 0<=x<=width and 0<=y<=height,('Graphic point outside original crop',row['frame'],key,row[key])
  if 'split' in row:
   n=row['split']['normal'];assert math.hypot(*n)>0
 for entry in copies:
  installed=ROOT/entry['public']
  if installed.exists():assert digest(installed.read_bytes())==entry['sha256'],('Changed public original',installed)
 return spec,fragment,provenance,copies,inputs

def exact_file(path,data,write):
 if path.exists():assert path.read_bytes()==data,('Refuse different existing bytes',path)
 elif write:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 mode=parser.add_mutually_exclusive_group();mode.add_argument('--check',action='store_true');mode.add_argument('--write',action='store_true')
 parser.add_argument('--source-root',type=Path,default=HISTORY if (HISTORY/'source-contract-index.json').is_file() else STAGING)
 args=parser.parse_args();stage=args.source_root.resolve()
 spec,fragment,provenance,copies,inputs=build(stage)
 before=MANIFEST.read_bytes();text=before.decode();prior=previous_values(text);after=text
 for section,rows in fragment.items():after=append_entries(after,section,rows)
 again=after
 for section,rows in fragment.items():again=append_entries(again,section,rows)
 assert again==after,'Registry append must be idempotent without changing existing values'
 installed=previous_values(after);projection={s:{k:installed[s][k] for k in rows} for s,rows in prior.items()}
 assert projection==prior,'Previous registry value bytes changed'
 old,new=json.loads(text),json.loads(after);assert old['chars']==new['chars'] and old['anims']==new['anims']
 if ART.exists():assert ART.read_bytes()==encoded(spec),'HumanSpec differs; review before replacing generated art'
 if args.write:
  # Parent must serialize this explicit write with other registry owners.
  assert MANIFEST.read_bytes()==before,'Concurrent registry write'
  for entry in copies:exact_file(ROOT/entry['public'],(stage/entry['sourceRelative']).read_bytes(),True)
  for name,entry in inputs.items():
   data=(stage/name).read_bytes();assert digest(data)==entry['sha256'];exact_file(HISTORY/name,data,True)
  exact_file(HISTORY/'source-contract-index.json',encoded(inputs),True)
  exact_file(ART,encoded(spec),True)
  assert MANIFEST.read_bytes()==before,'Concurrent registry write after source copies; retry safely'
  if after!=text:MANIFEST.write_bytes(after.encode())
 ARCHIVE.mkdir(parents=True,exist_ok=True)
 # Plan artifacts only; --check never changes sprites/public, chars or historical inputs.
 for name,data in [('sprites.fragment.json',fragment),('provenance.json',provenance)]:
  exact_file(ARCHIVE/name,encoded(data),True)
 result={'mode':'write' if args.write else 'check' if args.check else 'plan',
  'sourceContractConsistency':True,'humanArtMatches':ART.exists() and ART.read_bytes()==encoded(spec),
  'publicSourcesPresent':sum((ROOT/e['public']).exists() for e in copies),'publicSourcesExpected':5,
  'registryWouldChange':after!=text,'priorRegistryValueBytesPreserved':True,'charsAndAnimsChanged':False,
  'frames':116,'sheets':5,'replacementFramesReused':6,'wardrobeItems':25,'garmentKinds':20,'runtimeActivated':False}
 if args.write:
  receipt={'status':'sources-and-human-spec-registered-parent-native-pending','resourceRegistrationCompleted':True,
   'manifestBeforeSHA256':digest(before),'manifestAfterSHA256':digest(after.encode()),
   'priorValueSHA256':digest(encoded(prior)),'afterProjectionValueSHA256':digest(encoded(projection)),
   'humanArtSHA256':digest(encoded(spec)),'newChars':0,'newAnims':0,
   'originalSources':copies,'historicalActiveFlagsChanged':False,'nativeAcceptance':'pending-parent','runtimeActivated':False}
  receipt_path=ARCHIVE/'installation.json'
  if receipt_path.exists():
   saved=read(receipt_path)
   assert saved['originalSources']==copies and saved['humanArtSHA256']==receipt['humanArtSHA256']
   assert saved['priorValueSHA256']==saved['afterProjectionValueSHA256']
  else:exact_file(receipt_path,encoded(receipt),True)
 (ARCHIVE/'check.json').write_bytes(encoded(result))
 print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
