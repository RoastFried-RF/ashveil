"""Register untouched generated PNG bytes and measured source masks. Never edits image pixels."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,shutil,importlib.util
from human_source_masks_v392 import triangles,attach_roots,orphan_table
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tools/art/direction-v392'
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('prior_installer',ROOT/'tools/art/install-human-art-v389.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
def encode(value):return json.dumps(value,ensure_ascii=False,indent=2)+'\n'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
sources=[
 ('micro','/workspace/generated_images/exec-44765d80-d7c2-47b3-a851-80b51852bbc9.png','micro-loss-overlays-v392.png','6f84cf081be0576d442eb157b6b49ea782a096c1d737b3da07ef595489da86e8'),
 ('feet','/workspace/generated_images/exec-266de711-a9f8-429f-9dba-01288878c35d.png','anatomical-feet-v392.png','35f4a10a250ed4dfb18bf1f7da4d2d668d90c2cd9ba50ceef2709b9993440748')]
fragment={'sheets':{},'sheetSizes':{},'frames':{}}
records={};images={}
for kind,original,name,expected in sources:
 original=Path(original);assert digest(original)==expected
 folder=ROOT/'public/sprites/original/direction-v392';folder.mkdir(parents=True,exist_ok=True);dest=folder/name
 if dest.exists() and digest(dest)!=expected:
  assert kind=='micro' and digest(dest)=='8839417066b3bc4811bc9f1a8d733342b65111493ee4b64ed7ffaccc20eecdf5','Refuse unrelated source replacement'
  shutil.copy2(original,dest)
 elif not dest.exists():shutil.copy2(original,dest)
 sheet='av392_'+kind;im=Image.open(original);assert im.mode=='RGBA';images[kind]=im
 fragment['sheets'][sheet]=str(dest.relative_to(ROOT/'public'));fragment['sheetSizes'][sheet]=list(im.size)
 records[kind]={'original':str(original),'installed':str(dest.relative_to(ROOT)),'sha256':expected,'size':list(im.size),'alphaRange':im.getchannel('A').getextrema(),'pixelEdits':0,'requests':1,'acceptedUniqueRegions':12 if kind=='micro'else 8}
def region(kind,name,band):
 im=images[kind];alpha=im.getchannel('A');x,y,r,b=band;part=alpha.crop(band);bb=part.point(lambda v:255 if v>=16 else 0).getbbox();assert bb
 rect=[max(x,x+bb[0]-4),max(y,y+bb[1]-4),min(r,x+bb[2]+4),min(b,y+bb[3]+4)]
 key='av392_'+name;fragment['frames'][key]=['av392_'+kind,rect[0],rect[1],rect[2]-rect[0],rect[3]-rect[1]]
 return key,rect
names=['eye_down','eye_left','eye_right','finger_cap','nose_down','nose_left','nose_right','ear_cap','jaw_down','jaw_left','jaw_right','toe_cap']
# Observed seam centres in the R2 original, not assumed cell centres.
anchors=[(206,204),(588,201),(976,201),(1357,204),(204,530),(589,531),(977,531),(1351,538),(203,783),(586,779),(973,779),(1358,860)]
patches={}
for i,name in enumerate(names):
 row,col=divmod(i,4);band=(col*384,row*1024//3,(col+1)*384,(row+1)*1024//3);key,rect=region('micro',name,band);w,h=fragment['frames'][key][3:]
 gx,gy=anchors[i];a=[gx-rect[0],gy-rect[1]];opaque=images['micro'].getchannel('A').crop(rect).point(lambda v:255 if v>=128 else 0).getbbox()
 patches[name]={'frame':key,'a':a,'b':[a[0],a[1]+1],'size':[w,h],'opaqueWidth':opaque[2]-opaque[0],'opaqueBottom':opaque[3]-1,'mount':a}
# Source toe order, not the generated column labels, assigns the frontal owners.
bands=[(0,400),(400,735),(735,1068),(1068,1536)]
# Global observed ankle centres; sole y is measured from original alpha128 below.
ankles={('down','left'):[748,220],('down','right'):[275,220],('left','left'):[370,575],('left','right'):[856,576],('right','left'):[210,927],('right','right'):[688,929],('up','left'):[293,1300],('up','right'):[739,1300]}
feet={};foot_regions={}
for row,direction in enumerate(['down','left','right','up']):
 feet[direction]={}
 for side in ['left','right']:
  col=(1 if side=='left'else 0)if direction=='down'else(0 if side=='left'else 1)
  key,rect=region('feet','foot_'+side+'_'+direction,(col*512,bands[row][0],(col+1)*512,bands[row][1]))
  alpha=images['feet'].getchannel('A').crop(rect);strong=alpha.point(lambda v:255 if v>=128 else 0);bb=strong.getbbox();ankle=ankles[(direction,side)];a=[ankle[0]-rect[0],ankle[1]-rect[1]];width=fragment['frames'][key][3]
  scale=(3.1 if direction in ['down','up']else 6.1)/width
  feet[direction][side]={'frame':key,'a':a,'b':[a[0],bb[3]-1],'split':{'origin':a,'normal':[0,1]},'scale':scale,'solePinned':True}
  foot_regions[key]={'rect':rect,'alpha':alpha,'direction':direction,'side':side,'baseSoleY':bb[3]-1}
# Polygons trace the visible original digits. Hidden profile fingers are not invented.
def cut(polygon,cap,width):return {'polygon':polygon,'triangles':triangles(polygon),'cap':cap,'width':width}
hand_left_down={
 'Thumb':cut([[31,145],[43,151],[37,164],[31,174],[32,182],[23,184],[15,178],[16,166],[23,151]],[33,150],11),
 'Index':cut([[46,157],[57,165],[55,178],[45,192],[30,199],[23,198],[23,191],[36,178],[38,170]],[47,162],12),
 'Middle':cut([[56,154],[65,160],[65,176],[52,191],[44,190],[52,175]],[59,159],10),
 'Ring':cut([[65,150],[73,153],[73,168],[61,182],[56,182],[62,168]],[68,154],9),
 'Pinky':cut([[73,147],[82,150],[81,163],[73,177],[65,178],[72,163]],[77,152],8)}
def mirror_cuts(cuts,width):return {k:cut([[width-x,y]for x,y in v['polygon']],[width-v['cap'][0],v['cap'][1]],v['width'])for k,v in cuts.items()}
hands={'av381_down_LeftForearmPalm':hand_left_down,'av381_down_RightForearmPalm':mirror_cuts(hand_left_down,99)}
# Profile rows use their own measured palm/curled fingertip positions.
for frame,width,flip,dy in [('av381_left_LeftForearmPalm',89,False,-12),('av381_left_RightForearmPalm',101,True,-17),('av381_right_LeftForearmPalm',90,True,-17),('av381_right_RightForearmPalm',93,False,-17)]:
 raw={k:cut([[x,y+dy]for x,y in v['polygon']],[v['cap'][0],v['cap'][1]+dy],v['width'])for k,v in hand_left_down.items()}
 hands[frame]=mirror_cuts(raw,width)if flip else raw
# Back view has more separated, straighter knuckles than the curled palm/front.
back={
 'Thumb':cut([[23,159],[36,162],[30,180],[26,192],[16,194],[12,185],[14,173]],[25,164],11),
 'Index':cut([[33,169],[45,174],[43,199],[36,210],[26,210],[25,201],[31,188]],[38,174],12),
 'Middle':cut([[46,172],[58,172],[57,198],[49,207],[38,210],[39,198],[44,186]],[50,175],11),
 'Ring':cut([[59,168],[70,170],[70,190],[61,201],[51,204],[54,189]],[63,173],10),
 'Pinky':cut([[72,165],[81,165],[82,183],[74,194],[66,196],[68,184]],[76,169],9)}
hands['av381_up_LeftForearmPalm']=back;hands['av381_up_RightForearmPalm']=mirror_cuts(back,100)
# Attach stumps to surviving opaque palm/forefoot, excluding the union of all digits.
# This is numeric registration against untouched source alpha, never a raster edit.
hand_cleanup={};hand_all_digits_cut={}
manifest_data=json.loads((ROOT/'src/client/sprites.json').read_text());base_data=json.loads((ROOT/'src/client/render/human-art.json').read_text())
for base in base_data['base'].values():
 for source in base['forearm'].values():
  frame=source['frame'];sheet,x,y,w,h=manifest_data['frames'][frame];image=Image.open(ROOT/'public'/manifest_data['sheets'][sheet]);alpha=image.getchannel('A').crop((x,y,x+w,y+h));attach_roots(hands[frame],alpha,source['wrist'],frame);hand_cleanup[frame]=orphan_table(hands[frame],alpha,source['wrist'])[0];tip=max(c['cap'][1]+c['width']*.12 for c in hands[frame].values());hand_all_digits_cut[frame]=[[0,tip],[w,tip],[w,h],[0,h]]
# Foot cut coordinates are global observations converted to their actual crop frame.
global_toes={
 ('down','left'):[
  ([[668,297],[719,302],[724,345],[718,371],[685,376],[664,357]],[692,307],39),
  ([[718,302],[750,308],[761,346],[757,367],[730,370],[721,350]],[735,312],26),
  ([[748,298],[775,300],[786,338],[783,358],[760,363],[754,342]],[762,307],23),
  ([[772,289],[797,292],[810,326],[809,347],[788,352],[781,331]],[785,300],21),
  ([[795,275],[817,279],[833,308],[833,329],[815,336],[804,317]],[809,288],19)],
 ('down','right'):[
  ([[299,301],[348,297],[364,356],[347,375],[313,374],[298,349]],[325,307],39),
  ([[267,306],[300,301],[301,350],[291,369],[266,367],[259,345]],[284,313],26),
  ([[243,300],[270,299],[266,343],[260,362],[236,358],[232,337]],[255,307],23),
  ([[220,291],[245,288],[238,331],[229,352],[209,347],[208,326]],[232,300],21),
  ([[199,278],[222,275],[215,317],[204,337],[187,329],[189,307]],[210,288],19)],
 ('left','left'):[
  ([[99,638],[137,623],[165,632],[135,652],[112,660],[96,652]],[134,635],25),
  ([[112,651],[150,638],[173,646],[151,666],[127,675],[108,666]],[146,649],23),
  ([[135,662],[170,648],[195,656],[175,682],[149,690],[130,677]],[165,660],24),
  ([[160,676],[191,658],[217,671],[204,695],[179,702],[157,690]],[190,673],25),
  ([[186,680],[217,665],[245,678],[229,701],[202,704],[182,694]],[217,680],26)],
 ('left','right'):[([[575,643],[621,636],[667,650],[654,682],[620,699],[589,691],[572,674]],[625,651],41)],
 ('right','left'):[([[401,978],[446,975],[479,990],[484,1010],[462,1029],[422,1038],[398,1023]],[434,990],41)],
 ('right','right'):[
  ([[913,971],[938,977],[960,989],[958,1006],[940,1011],[909,990]],[925,985],25),
  ([[889,979],[916,979],[943,1001],[939,1018],[920,1024],[885,999]],[905,991],23),
  ([[867,988],[894,989],[922,1012],[918,1028],[896,1034],[861,1010]],[883,1001],24),
  ([[844,996],[871,998],[900,1022],[890,1040],[869,1046],[838,1021]],[859,1011],25),
  ([[824,1003],[850,1006],[877,1029],[867,1047],[845,1048],[818,1028]],[839,1018],26)]}
foot_detail={}
for key,row in foot_regions.items():
 rect=row['rect'];raw=global_toes.get((row['direction'],row['side']),[]);cuts={}
 for i,(polygon,cap,width)in enumerate(raw):
  suffix='Toe'+str(i+1);cuts[suffix]=cut([[x-rect[0],y-rect[1]]for x,y in polygon],[cap[0]-rect[0],cap[1]-rect[1]],width)
 source=feet[row['direction']][row['side']];attach_roots(cuts,row['alpha'],source['a'],key)
 # Numeric alpha analysis only. No modified source raster is written.
 alpha=row['alpha'];opaque=alpha.point(lambda v:255 if v>=128 else 0);by_mask=[[]for _ in range(32)]
 digit_masks=[]
 for i in range(5):
  mask=Image.new('1',alpha.size);draw=ImageDraw.Draw(mask)
  if 'Toe'+str(i+1)in cuts:draw.polygon([tuple(p)for p in cuts['Toe'+str(i+1)]['polygon']],fill=1)
  digit_masks.append(mask)
 maxima=[-1]*32
 pixels=opaque.load()
 for y in range(alpha.height):
  for x in range(alpha.width):
   if pixels[x,y]:
    bits=sum((1<<i)for i,mask in enumerate(digit_masks)if mask.getpixel((x,y)));maxima[bits]=max(maxima[bits],y)
 orphan_triangles,source_soles=orphan_table(cuts,alpha,source['a'])if cuts else([[]for _ in range(32)],[row['baseSoleY']]*32)
 sole=[]
 for missing in range(32):
  highest=source_soles[missing]
  cap_source=patches['toe_cap'];cap_h=cap_source['opaqueBottom'];cap_a=cap_source['a'][1];cap_w=cap_source['opaqueWidth']
  for i in range(5):
   c=cuts.get('Toe'+str(i+1))
   if c and missing&(1<<i):highest=max(highest,c['cap'][1]+(cap_h-cap_a)*c['width']/cap_w)
  sole.append(highest)
 foot_detail[key]={'orphanTrianglesByMask':orphan_triangles,'cuts':cuts,'soleYByMissingMask':sole,'alphaThreshold':128,'baseSoleY':row['baseSoleY']}
detail={'patches':patches,'feet':feet,'hands':hands,'handCleanup':hand_cleanup,'handAllDigitsCut':hand_all_digits_cut,'footDetails':foot_detail,'note':'Source-facing normalization includes swapped generated frontal columns. Profile inner foot exposes Toe1 only; rear toes are occluded. Numeric sole tables account for clipped source alpha and visible stump caps. Masks/landmarks are2D registration, not new raster variants or3D anatomy.'}
(OUT/'detail-source-data.json').write_text(encode(detail));(ROOT/'src/client/render/human-details.json').write_text(encode(detail))
manifest=ROOT/'src/client/sprites.json';text=manifest.read_text();previous=helper.previous_values(text)
for section,entries in fragment.items():
 top,_=helper.members(text);existing,_=helper.members(text,top[section][0]);replacements=[]
 for key,value in entries.items():
  assert key.startswith('av392_')
  if key in existing:
   begin,end=existing[key]
   if json.loads(text[begin:end])!=value:replacements.append((begin,end,json.dumps(value,ensure_ascii=False)))
 for begin,end,value in sorted(replacements,reverse=True):text=text[:begin]+value+text[end:]
 text=helper.append_entries(text,section,entries)
after=helper.previous_values(text)
for section,entries in previous.items():
 for key,value in entries.items():
  if not key.startswith('av392_'):assert after[section][key]==value,('Changed previous registry bytes',section,key)
manifest.write_text(text)
(OUT/'manifest.fragment.json').write_text(encode(fragment))
records['feet']['layoutNormalization']={'observedRowBands':bands,'frontColumnsSwappedAtRegistration':True,'requested20PercentPaddingMissed':True,'noPieceClippingOrNeighborInRegisteredCrop':True,'rearHasNoVisibleToes':True,'sourceDirectionLabelsNotAssumed':True}
records['micro']['prompt']='test-results/autonomy-v392/art-prompt-micro-r2.txt';records['micro']['requests']=2;records['micro']['supersededCandidate']={'sha256':'8839417066b3bc4811bc9f1a8d733342b65111493ee4b64ed7ffaccc20eecdf5','reason':'External dark rings, projected profile nose and floating stumps; never published','original':'/workspace/generated_images/exec-4cb3ad55-8e0e-486c-9c5c-67cf25fae5af.png'};records['feet']['prompt']='test-results/autonomy-v392/art-prompt-feet.txt'
records['micro']['supersededCandidate']['history']='tools/art/direction-v392/history/micro-r1-rejected.png'
for kind in ['micro','feet']:
 records[kind]['tool']='image_gen';records[kind]['transparentBackground']=True;records[kind]['reference']='public/sprites/original/direction-v389/human-base-parts-v381.png';records[kind]['referenceSHA256']=digest(ROOT/records[kind]['reference']);records[kind]['publishedPrompt']='tools/art/direction-v392/'+kind+'-prompt.txt'
for kind in ['micro','feet']:
 shutil.copy2(ROOT/records[kind]['prompt'],OUT/(kind+'-prompt.txt'))
(folder/'LICENSE.txt').write_text('Original ASHVEIL art generated with OpenAI image_gen for this project. Source bytes preserved; no third-party raster copied or traced. See tools/art/direction-v392/source-audit.json for SHA256, prompts and normalization.\n')
(OUT/'source-audit.json').write_text(encode(records))
print(json.dumps({'originalPNGs':2,'newRegions':20,'sourcePixelEdits':0,'footSources':8,'handSourceMasks':len(hands)}))
