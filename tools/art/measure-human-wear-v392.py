"""Measure source breadth and fingertip projection; outputs JSON only, never edits PNGs."""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json
ROOT=Path(__file__).resolve().parents[2]
manifest=json.loads((ROOT/'src/client/sprites.json').read_text());normal=json.loads((ROOT/'src/client/render/human-art.json').read_text());mutants=json.loads((ROOT/'src/client/render/human-mutants.json').read_text());images={}
def encode(v):return json.dumps(v,ensure_ascii=False,indent=2)+'\n'
def pixels(source):
 sheet,x,y,w,h=manifest['frames'][source['frame']]
 if sheet not in images:images[sheet]=Image.open(ROOT/'public'/manifest['sheets'][sheet]).getchannel('A')
 alpha=np.array(images[sheet].crop((x,y,x+w,y+h)));allowed=alpha>=128
 if source.get('clip'):
  mask=Image.new('1',(w,h));ImageDraw.Draw(mask).polygon([tuple(p)for p in source['clip']],fill=1);allowed&=np.array(mask)
 yy,xx=np.where(allowed);return np.column_stack([xx,yy]).astype(float)
def breadth(points,a,b):
 a=np.array(a);delta=np.array(b)-a;length=float(np.linalg.norm(delta));assert length>0;axis=delta/length;relative=points-a;along=relative@axis;across=relative@np.array([-axis[1],axis[0]]);valid=(along>=length*.25)&(along<=length*.75);bins=np.floor(along[valid]).astype(int);values=across[valid]
 spans=[float(np.ptp(values[bins==i]))+1 for i in np.unique(bins)if np.count_nonzero(bins==i)>1];assert spans
 return float(np.median(spans))
result={'models':{},'pieces':{},'heads':{}}
for name,spec in {'human':normal,**mutants}.items():
 views={}
 for direction,base in spec['base'].items():
  torso=base['torso'];fit={'torso':{'breadth':breadth(pixels(torso),torso['a'],torso['b'])},'upper':{},'forearm':{}}
  for side in ['left','right']:
   upper=base['upper'][side];lower=base['forearm'][side];points=pixels(lower);wrist=np.array(lower['wrist']);axis=np.array(lower['b'])-wrist;axis/=np.linalg.norm(axis);split_normal=np.array(lower.get('split',{}).get('normal',[0,1]));hand=points[(points-wrist)@split_normal>=0];projection=(hand-wrist)@axis;end=hand[projection>=projection.max()-1].mean(axis=0).tolist()
   fit['upper'][side]={'breadth':breadth(pixels(upper),upper['a'],upper['b'])}
   fit['forearm'][side]={'breadth':breadth(points,lower['a'],lower['wrist']),'palmBreadth':breadth(hand,lower['wrist'],end),'handTip':end}
  torso_points=pixels(torso);waist=torso_points[abs(torso_points[:,1]-torso['waist'])<=3];fit['torso']['waistBreadth']=float(np.ptp(waist[:,0]))+1
  views[direction]=fit
 result['models'][name]=views
for spec in [normal,*mutants.values(),{'base':{},'heads':json.loads((ROOT/'src/client/render/human-heads.json').read_text())['heads']}]:
 for head in [*[b['head']for b in spec['base'].values()],*[source for role in spec.get('heads',{}).values()for source in role.values()]]:result['heads'][head['frame']]={'breadth':breadth(pixels(head),head['a'],head['b'])}
legacy_piece_fit=json.loads((ROOT/'src/client/render/human-fit.json').read_text()).get('pieceSources',{})
for kind,views in normal['pieces'].items():
 if kind not in ['shirt','coat','mail','apron','cuirass','upperCloth','upperLeather','upperMail','forearmCloth','forearmLeather','gloveLeather','gloveWool','helmet','belt','boot']:continue
 result['pieces'][kind]={}
 for direction,source in views.items():
  source={**source,**legacy_piece_fit.get(kind,{}).get(direction,{})}
  width,height=manifest['frames'][source['frame']][3:]
  row={'breadth':breadth(pixels(source),source['a'],source['b'])}
  if kind=='boot':
   adjusted=json.loads((ROOT/'src/client/render/human-fit.json').read_text()).get('pieceSources',{}).get('boot',{}).get(direction,{});ankle=adjusted.get('a',source['a']);center=[ankle[0],max(10,ankle[1]*.23)];pp=pixels(source);rim=pp[abs(pp[:,1]-center[1])<=2];outer=float(np.ptp(rim[:,0]))+1 if len(rim)else width;row['opening']={'center':center,'rx':outer*.30,'ry':height*.035}
  if kind in ['upperCloth','upperLeather','upperMail','forearmCloth','forearmLeather','gloveLeather','gloveWool']:
   center=[source['a'][0],source['a'][1]*(.42 if kind.startswith('glove')else 1)];pp=pixels(source);rim=pp[abs(pp[:,1]-center[1])<=2];outer=float(np.ptp(rim[:,0]))+1 if len(rim)else width;row['opening']={'center':center,'rx':outer*.30,'ry':height*(.05 if kind.startswith('upper')else .035),'rotation':float(np.arctan2(-(source['b'][0]-source['a'][0]),source['b'][1]-source['a'][1]))}
  if kind=='belt':row.update({'a':[5,height*.45],'b':[width-5,height*.45],'mount':[width/2,66 if direction=='down'else 53 if direction=='up'else 52],'beltSplitY':40 if direction=='down'else 35 if direction=='up'else 38})
  if kind in ['shirt','coat','mail']and direction in ['down','up']:
   frame=manifest['frames'][source['frame']];width=frame[3];left,right=(width-20,20)if direction=='down'else(20,width-20)
   row['wornShoulders']={'left':[left,75 if kind=='coat'else 65],'right':[right,75 if kind=='coat'else 65]}
  result['pieces'][kind][direction]=row
(ROOT/'src/client/render/human-wear-fit.json').write_text(encode(result));out=ROOT/'tools/art/direction-v392/wear-fit.json';out.write_text(encode(result))
print(json.dumps({'bodyModels':len(result['models']),'garmentKinds':len(result['pieces']),'output':str(out),'rasterEdits':0}))
