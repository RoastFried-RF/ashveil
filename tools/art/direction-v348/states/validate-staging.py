"""Staging-only original/crop/partial-clip/provenance validation, no world/build."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label,find_objects
import numpy as np,json,hashlib,struct,zlib
P=Path(__file__).resolve().parent;errors=[]
def check(t,m):
 if not t:errors.append(m)
def load(n):return json.loads((P/n).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def crc(p):
 b=p.read_bytes();at=8;count=0;check(b[:8]==b'\x89PNG\r\n\x1a\n','signature '+p.name)
 while at<len(b):
  n=struct.unpack('>I',b[at:at+4])[0];tag=b[at+4:at+8];payload=b[at+8:at+8+n];v=struct.unpack('>I',b[at+8+n:at+12+n])[0];check(zlib.crc32(tag+payload)&0xffffffff==v,'CRC '+p.name);at+=n+12;count+=1
  if tag==b'IEND':break
 check(at==len(b),'PNG length '+p.name);return count
gen=load('generation-results.json')['results'];check(len(gen)==5 and all(g['status']=='generated' for g in gen),'exact5 successful bounded requests'); originals=[]
arrays={};labels={};large={}
for g in gen:
 m=g['motion'];p=P/'originals'/f'cinder-bear-{m}-v1.png';r=load(f'records/cinder-bear-{m}-v1.json');check(sha(p)==r['sha256']==sha(Path(r['source'])),m+': source changed');check(r['exactToolArguments']==load(f'requests/cinder-bear-{m}-v1.json'),m+': exact request changed');check(r['attempts']==1 and r['automaticRegeneration']==0,m+': generation limit')
 for ref in r['referenceInputs']:check(sha(Path(ref['path']))==ref['sha256'],m+': reference changed')
 original={'motion':m,'sha256':r['sha256'],'CRCChunks':crc(p)};originals.append(original);ar=np.array(Image.open(p).convert('RGBA'));arrays['av346_cinder_bear_'+m+'_v1']=ar;lab,_=label(ar[:,:,3]>=16);labels[m]=lab;big=set()
 for i,sl in enumerate(find_objects(lab),1):
  if sl is not None and np.count_nonzero(lab[sl]==i)>=800:big.add(i)
 large[m]=big;check(len(big)==16,m+': source16regions')
survey=load('source-survey.json');priorErrors=[]
for ref in survey['references']:check(sha(P/ref['copy'])==ref['sha256']==sha(Path(ref['source'])),'reference copy changed')
for row in survey['priorStagingBaseline']:
 if not Path(row['path']).is_file() or sha(Path(row['path']))!=row['sha256']:priorErrors.append(row['path'])
check(not priorErrors,'prior staging changed');now={str(p) for root in survey['priorStagingRoots'] for p in Path(root).rglob('*') if p.is_file()};check(now=={r['path'] for r in survey['priorStagingBaseline']},'prior membership changed')
frag=load('sprites.fragment.json');allf=load('candidate-crops.json');part=load('cinder-bear.states.partial.json');analysis=load('registration-analysis.json');anchors=load('foot-anchors.json')['frames'];fail=load('failure-detail.json');check(len(frag['frames'])==72 and len(allf['frames'])==80,'72proposed/80candidate');check(len(frag['sheets'])==5,'5originals')
held={k for row in part['heldDirections'] for k in row['frames']};check(len(held)==8 and not(held&set(frag['frames'])),'held8mustnotregister');check(set(allf['frames'])-set(frag['frames'])==held,'exactheldset');check(part['active'] is False and part['activationReady'] is False,'must be inactive');check('chars'not in frag,'no runtime character install')
unique=[];foreign=[];lost=0;edge=0;allHashes=[]
for row in analysis['frames']:
 k=row['frame'];s,x,y,w,h=allf['frames'][k];ar=arrays[s];H,W=ar.shape[:2];check(0<=x<x+w<=W and 0<=y<y+h<=H,k+': bounds');crop=ar[y:y+h,x:x+w];allHashes.append(hashlib.sha256(crop.tobytes()).hexdigest());check(allHashes[-1]==row['sourceRGBACropSHA256'],k+': crop bytes')
 tr=allf['frameTransforms'][k];check(tr['scale']==.14,k+': fixed scale');sx,sy=anchors[k]['originalSheetPoint'];check(all(0<=a<=1 for a in tr['anchor']),k+': anchor');check(abs((sx-x)/w-tr['anchor'][0])<1e-12 and abs((sy-y)/h-tr['anchor'][1])<1e-12,k+': anchor source point')
 if k not in frag['frames']:continue
 unique.append((s,x,y,w,h));m=row['motion'];lab=labels[m];other=(set(np.unique(lab[y:y+h,x:x+w]))&large[m])-{row['componentId']}
 if other:foreign.append(k)
 lost+=int(np.count_nonzero(lab==row['componentId'])-np.count_nonzero(lab[y:y+h,x:x+w]==row['componentId']));edge+=int(np.count_nonzero(crop[0,:,3]>=16)+np.count_nonzero(crop[-1,:,3]>=16)+np.count_nonzero(crop[:,0,3]>=16)+np.count_nonzero(crop[:,-1,3]>=16))
check(len(set(unique))==72 and len(set(allHashes))==80,'unique originals/crops');check(not foreign and lost==0 and edge==0,'proposed crop contamination/loss/border');clips=[]
for m,dirs in part['motions'].items():
 for d,keys in dirs.items():check(len(keys)==4 and all(k in frag['frames'] for k in keys),m+d+': complete4clip');clips.append((m,d))
check(len(clips)==18,'18directionalclips');check('left'not in part['motions']['hurt']and'left'not in part['motions']['rise'],'leftnotfilledwithfallback');check(len(part['frameTransforms'])==72,'72transforms');check(len(fail['frames'])==6,'six actual contaminated rectangles');b=load('diagnostics/browser-observation.json');check(not b['errors'] and b['observation']['mainGameLoaded'] is False,'isolated browser')
proof={'scope':'Bounded original/state-crop/native-canvas artifact audit only; no Core/Native gameplay acceptance','errors':errors,'imageGenCalls':5,'automaticRegenerations':0,'preservedOriginalPNGs':5,'originals':originals,'generatedUniqueCandidateRegions':80,'proposedUniqueSourceRegions':72,'heldClipRegions':8,'heldDirectionalClips':[{'motion':'hurt','direction':'left'},{'motion':'rise','direction':'left'}],'actualContaminatedTightRects':6,'proposedOtherLargeComponents':foreign,'proposedLostConnectedPixelsAlpha16':lost,'proposedOpaqueBorderPixelsAlpha16':edge,'directionalClipsProposed':18,'priorStagingFileChecks':len(survey['priorStagingBaseline']),'priorStagingMismatches':priorErrors,'browserCanvasCount':b['observation']['canvasCount'],'active':False,'activationReady':False,'mainGameModified':False};(P/'validation-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print(json.dumps(proof,ensure_ascii=False,indent=2));raise SystemExit(bool(errors))
