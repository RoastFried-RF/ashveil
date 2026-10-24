"""One-original independent left8supplement audit; no main/game/world mutation."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label,find_objects
import json,hashlib,numpy as np,struct,zlib
P=Path(__file__).resolve().parent;errors=[]
def check(x,m):
 if not x:errors.append(m)
def load(n):return json.loads((P/n).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
gen=load('generation-result.json');check(gen['status']=='generated'and gen['calls']==1 and gen['retries']==0,'exact1call/noretry');r=load('records/cinder-bear-left-states-v1.json');p=P/'originals/cinder-bear-left-states-v1.png';check(sha(p)==r['sha256']==sha(Path(r['source'])),'source changed');check(r['exactToolArguments']==load('requests/cinder-bear-left-states-v1.json'),'exact request changed')
for ref in r['referenceInputs']:check(sha(Path(ref['path']))==ref['sha256'],'reference input changed')
b=p.read_bytes();at=8;count=0;check(b[:8]==b'\x89PNG\r\n\x1a\n','PNGsignature')
while at<len(b):
 n=struct.unpack('>I',b[at:at+4])[0];tag=b[at+4:at+8];payload=b[at+8:at+8+n];v=struct.unpack('>I',b[at+8+n:at+12+n])[0];check(zlib.crc32(tag+payload)&0xffffffff==v,'PNGCRC');at+=n+12;count+=1
 if tag==b'IEND':break
check(at==len(b),'PNGlength')
s=load('source-survey.json');oldErrors=[]
for f in s['v346FrozenBaseline']:
 if not Path(f['path']).is_file()or sha(Path(f['path']))!=f['sha256']:oldErrors.append(f['path'])
check(not oldErrors,'v346 frozen bytes changed');paths={str(x)for x in Path('/workspace/.ashveil-planned/v346-bear-state-art').rglob('*')if x.is_file()};check(paths=={f['path']for f in s['v346FrozenBaseline']},'v346 file membership changed')
for ref in s['references']:check(sha(P/ref['copy'])==ref['sha256']==sha(Path(ref['source'])),'copied input changed')
f=load('sprites.fragment.json');part=load('cinder-bear.states.partial.json');anc=load('foot-anchors.json')['frames'];analysis=load('registration-analysis.json');check(len(f['sheets'])==1 and len(f['frames'])==8,'onePNG/eightnewregions');check(set(part['motions'])=={'hurt','rise'},'only2motions');check(part['active']is False and part['activationReady']is False,'inactive only')
keys=set()
for m in ['hurt','rise']:
 check(set(part['motions'][m])=={'left'},'left only');clip=part['motions'][m]['left'];check(len(clip)==4,'four independent poses')
 for k in clip:check(k.startswith('av349_')and k in f['frames'],'independent new keys');keys.add(k)
check(keys==set(f['frames'])==set(part['frameTransforms']),'exact new8reference set');check(not any(k.startswith('av346_')for k in f['frames']),'oldheldkeysnotinstalled')
im=Image.open(p).convert('RGBA');ar=np.array(im);check(list(im.size)==next(iter(f['sheetSizes'].values())),'actualsheetdimensions');lab,_=label(ar[:,:,3]>=16);large=set()
for i,sl in enumerate(find_objects(lab),1):
 if sl is not None and np.count_nonzero(lab[sl]==i)>=800:large.add(i)
check(len(large)==8,'eight body components');foreign=[];lost=0;edge=0;hashes=[];regions=[]
for row in analysis['frames']:
 k=row['frame'];sheet,x,y,w,h=f['frames'][k];check(0<=x<x+w<=im.width and 0<=y<y+h<=im.height,k+':bounds');crop=ar[y:y+h,x:x+w];other=(set(np.unique(lab[y:y+h,x:x+w]))&large)-{row['componentId']}
 if other:foreign.append(k)
 lost+=int(np.count_nonzero(lab==row['componentId'])-np.count_nonzero(lab[y:y+h,x:x+w]==row['componentId']));edge+=int(np.count_nonzero(crop[0,:,3]>=16)+np.count_nonzero(crop[-1,:,3]>=16)+np.count_nonzero(crop[:,0,3]>=16)+np.count_nonzero(crop[:,-1,3]>=16));hashes.append(hashlib.sha256(crop.tobytes()).hexdigest());check(hashes[-1]==row['sourceRGBACropSHA256'],k+':rawcrop');regions.append((sheet,x,y,w,h));tr=part['frameTransforms'][k];sx,sy=anc[k]['originalSheetPoint'];check(tr['scale']==part['clipScales'][row['motion']],k+':clip-unit scale');check(all(0<=v<=1 for v in tr['anchor']),k+':anchor');check(abs((sx-x)/w-tr['anchor'][0])<1e-12 and abs((sy-y)/h-tr['anchor'][1])<1e-12,k+':sourceanchor')
check(len(set(regions))==len(set(hashes))==8,'eight unique source crops');check(not foreign and lost==0 and edge==0,'loss/foreign/border');browser=load('diagnostics/browser-observation.json');check(not browser['errors']and browser['observation']['mainGameLoaded']is False,'isolated browser')
prop=load('proportion-comparison.json');end=prop['riseFinalVersusV346'];warnings=['Requested width<=60%ofequalcell exceeded in7/8source silhouettes; parent directly reviewed source and prioritised complete separation/losslesscrop/neighbour0.']
proof={'scope':'Independent8pose original/crop/clip-scale/native-canvas audit only; no Core/Native gameplay acceptance','errors':errors,'warnings':warnings,'imageGenCalls':1,'automaticRegenerations':0,'preservedNewOriginalPNGs':1,'newUniqueSourceRegions':8,'PNGCRCChunks':count,'sourceSHA256':r['sha256'],'sourceSize':list(im.size),'proposedLargeNeighbourComponents':foreign,'lostConnectedBodyPixelsAlpha16':lost,'opaqueCropBorderPixelsAlpha16':edge,'widthRequestCompliantRegions':analysis['widthRequestCompliantRegions'],'clipScales':part['clipScales'],'riseFinalWorldSize':end['newWorldBodySize'],'oldV346FinalWorldSize':end['oldWorldBodySize'],'v346FrozenFileChecks':len(s['v346FrozenBaseline']),'v346Mismatches':oldErrors,'browserCanvasCount':browser['observation']['canvasCount'],'active':False,'activationReady':False,'mainGameModified':False};(P/'validation-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print(json.dumps(proof,ensure_ascii=False,indent=2));raise SystemExit(bool(errors))
