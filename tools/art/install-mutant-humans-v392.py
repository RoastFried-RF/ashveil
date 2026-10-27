"""Register original image_gen body components. Numeric source analysis only; no image edits."""
from pathlib import Path
import hashlib,json,shutil,importlib.util,math
import numpy as np
from scipy.ndimage import label,find_objects
from PIL import Image
from human_source_masks_v392 import triangles,attach_roots,orphan_table
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'tools/art/direction-v392/mutants';OUT.mkdir(parents=True,exist_ok=True)
helper_spec=importlib.util.spec_from_file_location('original_registration',ROOT/'tools/art/install-human-art-v389.py');helper=importlib.util.module_from_spec(helper_spec);helper_spec.loader.exec_module(helper)
def encode(v):return json.dumps(v,ensure_ascii=False,indent=2)+'\n'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
originals={
 'shade':('exec-564c1fb1-abe9-4af5-a8b1-54c46288007a.png','art-prompt-withered.txt'),
 'withered':('exec-a53a70d9-5f98-4125-8ad7-44fd28b6e590.png','art-prompt-withered-r2.txt'),
 'spore':('exec-385cd862-17c3-4c4a-8e4b-da0310d9d470.png','art-prompt-spore.txt'),
 'heads':('exec-08384bcb-5358-4d46-ad4b-136ce8963eb8.png','art-prompt-heads.txt'),
 'spore_heads':('exec-a6c4df0a-56fb-49d0-b7e8-69477cf1cdda.png','art-prompt-spore-heads-r2.txt')}
fragment={'sheets':{},'sheetSizes':{},'frames':{}};images={};components={};records={}
for kind,(filename,prompt)in originals.items():
 original=ROOT.parent/'generated_images'/filename;im=Image.open(original);assert im.mode=='RGBA';images[kind]=im
 alpha=np.array(im.getchannel('A'));labels,n=label(alpha>=16,np.ones((3,3)));counts=np.bincount(labels.ravel());parts=[]
 for index,box in enumerate(find_objects(labels),1):
  if counts[index]>1000:parts.append({'id':index,'rect':[box[1].start,box[0].start,box[1].stop,box[0].stop]})
 expected=28 if kind=='heads'else 8 if kind=='spore_heads'else 24;assert len(parts)==expected,(kind,len(parts))
 rows=4;cols=7 if kind=='heads'else 2 if kind=='spore_heads'else 6;group={}
 for part in parts:
  l,t,r,b=part['rect'];cx,cy=(l+r)/2,(t+b)/2
  row=min(3,int(cy/(im.height/4)));col=min(cols-1,int(cx/(im.width/cols)))
  if cols==6:col=min(range(6),key=lambda i:abs(cx-[100,280,450,610,760,940][i]))
  assert(row,col)not in group,(kind,row,col);group[row,col]=part
 assert len(group)==expected
 components[kind]=(group,labels)
 dest=ROOT/'public/sprites/original/direction-v392'/('mutant-'+kind+'-v392.png')
 if dest.exists():assert digest(dest)==digest(original)
 else:shutil.copy2(original,dest)
 sheet='av392_mutant_'+kind;fragment['sheets'][sheet]=str(dest.relative_to(ROOT/'public'));fragment['sheetSizes'][sheet]=list(im.size)
 shutil.copy2(ROOT/'test-results/autonomy-v392'/prompt,OUT/(kind+'-prompt.txt'))
 records[kind]={'reference':str(ROOT/'public/sprites/original/direction-v389/human-base-parts-v381.png')if kind=='shade'else str(ROOT.parent/'generated_images'/('exec-385cd862-17c3-4c4a-8e4b-da0310d9d470.png'if kind=='spore_heads'else'exec-564c1fb1-abe9-4af5-a8b1-54c46288007a.png')),'original':str(original),'sha256':digest(original),'installed':str(dest.relative_to(ROOT)),'size':list(im.size),'alphaRange':im.getchannel('A').getextrema(),'majorAlpha16Components':len(parts),'pixelEdits':0,'tool':'image_gen','prompt':str((OUT/(kind+'-prompt.txt')).relative_to(ROOT)),'regions':[]}
for record in records.values():record['referenceSHA256']=digest(Path(record['reference']))
def region(kind,row,col,name):
 group,labels=components[kind];part=group[row,col];l,t,r,b=part['rect'];padding=2
 while padding>=0:
  box=[max(0,l-padding),max(0,t-padding),min(images[kind].width,r+padding),min(images[kind].height,b+padding)];x,y,xx,yy=box
  foreign=sum(int(np.count_nonzero(labels[y:yy,x:xx]==other['id']))for other in group.values()if other['id']!=part['id'])
  if foreign==0:break
  padding-=1
 assert padding>=0,('Neighbor in original crop',kind,row,col)
 key='av392_mutant_'+name;fragment['frames'][key]=['av392_mutant_'+kind,x,y,xx-x,yy-y]
 records[kind]['regions'].append({'frame':key,'sourceRow':row,'sourceColumn':col,'crop':box,'foreignMajorAlpha16Pixels':foreign,'alpha16ComponentFullyContained':True})
 return key,box
DIRECTIONS=['down','left','right','up'];SIDES=['left','right'];models={};details=json.loads((ROOT/'src/client/render/human-details.json').read_text());old=json.loads((ROOT/'src/client/render/human-art.json').read_text())
def point_on_skin(kind,box,y):
 l,t,r,b=box;alpha=np.array(images[kind].getchannel('A'))[t:b,l:r];ys=max(0,min(alpha.shape[0]-1,round(y)));xs=np.where(alpha[ys]>=128)[0]
 return[float(np.median(xs))if len(xs)else(r-l)/2,y]
def source(frame,a,b,**extra):return {'frame':frame,'a':a,'b':b,**extra}
def head_source(kind,row,col,name,factor):
 key,box=region(kind,row,col,name);w,h=box[2]-box[0],box[3]-box[1];direction=DIRECTIONS[row]
 # Source observations by atlas, with separate visible profile ownership.
 ey=.51 if kind in ['heads','spore_heads']else .50 if kind=='withered'else .53
 mouth=.72 if kind in ['heads','spore_heads']else .72 if kind=='withered'else .76
 eyes=({'left':[w*.65,h*ey],'right':[w*.35,h*ey]}if direction=='down'else {'left':[w*.27,h*ey]}if direction=='left'else {'right':[w*.73,h*ey]}if direction=='right'else {})
 return source(key,[w*.5,h*.97],[w*.5,0],neckStartY=h*.78,scale=5.8*factor/(h*.97),eyes=eyes,**({'mouth':[w*(.5 if direction=='down'else .29 if direction=='left'else .71),h*mouth]}if direction!='up'else{}))
for kind,factor,tint in [('shade',.7,0xc5cfc4),('withered',.8,0xe0ded4),('spore',1,0xd6dbca)]:
 base={}
 for row,direction in enumerate(DIRECTIONS):
  tr=2 if row==1 else 1 if row==2 else row # Generated torso profiles face opposite to head rows.
  key,box=region(kind,tr,1,kind+'_'+direction+'_torso');w,h=box[2]-box[0],box[3]-box[1]
  neck=point_on_skin(kind,box,h*.10);hip_y=h*.84;hip_c=point_on_skin(kind,box,hip_y);waist=h*.66
  # Observed graphic shoulder joint centres in the original, with cap overlap.
  shoulder_points={
   'shade':{'down':{'left':[332,118],'right':[210,118]},'left':{'left':[312,830],'right':[226,819]},'right':{'left':[327,459],'right':[246,470]},'up':{'left':[208,1183],'right':[343,1183]}},
   'withered':{'down':{'left':[342,111],'right':[210,111]},'left':{'left':[316,832],'right':[237,824]},'right':{'left':[328,454],'right':[253,466]},'up':{'left':[211,1188],'right':[342,1188]}},
   'spore':{'down':{'left':[347,110],'right':[217,112]},'left':{'left':[314,820],'right':[226,809]},'right':{'left':[331,445],'right':[251,454]},'up':{'left':[207,1174],'right':[352,1174]}}}
  shoulders={side:[p[0]-box[0],p[1]-box[1]]for side,p in shoulder_points[kind][direction].items()}
  if direction in ['down','up']:
   left,right=(.73,.27)if direction=='down'else(.27,.73);hips={s:[w*x,hip_y]for s,x in [('left',left),('right',right)]}
  else:hips={s:[hip_c[0]+(-2 if s=='left'else 2),hip_y]for s in SIDES}
  torso=source(key,hip_c,neck,neck=neck,waist=waist,chestEnd=h*.43,shoulders=shoulders,hips=hips,scale=10.26*factor/(hip_y-neck[1]));upper={};forearm={};legs={}
  for side_index,side in enumerate(SIDES):
   key,box=region(kind,row,2+side_index,kind+'_'+direction+'_'+side+'_arm');w,h=box[2]-box[0],box[3]-box[1];shoulder=point_on_skin(kind,box,h*.10);elbow=point_on_skin(kind,box,h*.49);wrist=point_on_skin(kind,box,h*.82);grip=point_on_skin(kind,box,h*.92);scale=12.5*factor/(math.dist(shoulder,elbow)+math.dist(elbow,grip))
   upper[side]=source(key,shoulder,elbow,scale=scale,clip=[[0,0],[w,0],[w,elbow[1]+8],[0,elbow[1]+8]])
   forearm[side]=source(key,elbow,grip,wrist=wrist,scale=scale,split={'origin':wrist,'normal':[0,1]},clip=[[0,elbow[1]-8],[w,elbow[1]-8],[w,h],[0,h]])
   # Profile leg originals are paired left/right-facing silhouettes, not valid two
   # anatomical sides in that row. Share the matching-facing source explicitly;
   # their unwanted whole feet are outside the owned hip-to-ankle clip.
   leg_col=4+side_index if direction in ['down','up']else 4 if direction=='left'else 5
   leg_row=row;key,box=region(kind,leg_row,leg_col,kind+'_'+direction+'_'+side+'_leg');w,h=box[2]-box[0],box[3]-box[1];a=point_on_skin(kind,box,h*.23);knee=point_on_skin(kind,box,h*.53);ankle=point_on_skin(kind,box,h*.87)
   legs[side]=source(key,a,ankle,knee=knee,scale=(.032 if kind=='withered'else .043)*factor,clip=[[0,a[1]-2],[w,a[1]-2],[w,ankle[1]],[0,ankle[1]]],jointOverlap=8,material='flesh-with-underclothing')
  feet={side:{**details['feet'][direction][side],'scale':details['feet'][direction][side]['scale']*factor}for side in SIDES}
  base[direction]={'hipHeight':20*factor,'head':head_source(kind,row,0,kind+'_'+direction+'_head',factor),'torso':torso,'upper':upper,'forearm':forearm,'legs':legs,'foot':{**old['base'][direction]['foot'],'scale':.06*factor},'feet':feet}
 models[kind]={'id':'av392-'+kind+'-living-parts','skinTint':tint,'motionScale':factor,'base':base,'heads':{}}
for kind,roles in [('shade',[('shade0',0),('shade1',1),('shade2',2),('shade_chief',3)]),('withered',[('priest',6)])]:
 factor=.7 if kind=='shade'else .8
 for role,col in roles:models[kind]['heads'][role]={d:head_source('heads',row,col,role+'_'+d+'_head',factor)for row,d in enumerate(DIRECTIONS)}
for col,role in enumerate(['spore0','spore1']):models['spore']['heads'][role]={d:head_source('spore_heads',row,col,role+'_'+d+'_head',1)for row,d in enumerate(DIRECTIONS)}
# Source-local finite digit regions. The displayed owner remains the actual Core
# body part; no body/UID/efficiency is inferred from these graphic2D partitions.
def clip_polygon(polygon,origin,normal):
 out=[]
 for i,a in enumerate(polygon):
  b=polygon[(i+1)%len(polygon)];da=sum((a[j]-origin[j])*normal[j]for j in [0,1]);db=sum((b[j]-origin[j])*normal[j]for j in [0,1])
  if da>=0:out.append(a)
  if (da>=0)!=(db>=0):out.append([a[j]+(b[j]-a[j])*da/(da-db)for j in [0,1]])
 return out
mutant_details={'hands':{},'handCleanup':{},'handAllDigitsCut':{}}
for kind,model in models.items():
 for direction,base in model['base'].items():
  for side,arm in base['forearm'].items():
   key=arm['frame'];_,x,y,w,h=fragment['frames'][key];alpha=images[kind].getchannel('A').crop((x,y,x+w,y+h));data=np.array(alpha);wrist=arm['wrist'];yy,xx=np.where((data>=128)&(np.indices(data.shape)[0]>=wrist[1]));assert len(xx)
   left,right,top,bottom=int(xx.min()),int(xx.max()+1),wrist[1],int(yy.max()+1);span=right-left;length=bottom-top;flip=(side=='right')^(direction=='up')
   samples=[(.05,.55),(.23,.94),(.44,1),(.65,.94),(.86,.83)];seeds=[[left+(1-u if flip else u)*span,top+v*length]for u,v in samples];cuts={}
   for i,suffix in enumerate(['Thumb','Index','Middle','Ring','Pinky']):
    root_y=top+length*(.22 if i==0 else .43);polygon=[[0,root_y],[w,root_y],[w,h],[0,h]];seed=seeds[i]
    for j,other in enumerate(seeds):
     if j==i:continue
     polygon=clip_polygon(polygon,[(seed[0]+other[0])/2,(seed[1]+other[1])/2],[seed[0]-other[0],seed[1]-other[1]])
    assert len(polygon)>=3;cuts[suffix]={'polygon':polygon,'triangles':triangles(polygon),'cap':[seed[0],root_y+1],'width':span*(.23 if i==0 else .20)}
   attach_roots(cuts,alpha,wrist,key);mutant_details['hands'][key]=cuts;mutant_details['handCleanup'][key]=orphan_table(cuts,alpha,wrist)[0];tip=max(c['cap'][1]+c['width']*.12 for c in cuts.values());mutant_details['handAllDigitsCut'][key]=[[0,tip],[w,tip],[w,h],[0,h]]
(ROOT/'src/client/render/human-mutant-details.json').write_text(encode(mutant_details));(OUT/'source-detail-masks.json').write_text(encode(mutant_details))
# Reject the8spore head cells of the first mixed atlas: their profile rows face the
# opposite way. Keep the entire untouched original and publish only accepted20cells.
records['heads']['acceptedRegions']=20;records['heads']['rejectedRegions']=8;records['heads']['rejection']='Spore profile columns face opposite to row; replaced by dedicated8-head original'
records['shade']['reuse']='Rejected as terminal patient because healthy; accepted as living small-stature cave-human source after normalization'
for kind in ['shade','withered','spore']:records[kind]['normalization']={'torsoProfileRowsSwapped':True,'profileLegSidesExplicitlySharedByActualFacing':True,'feet':'shared8anatomical-v392-originals, scaled for body size','authoredWalkFrames':0,'worldRuleChanges':False}
manifest=ROOT/'src/client/sprites.json';text=manifest.read_text();previous=helper.previous_values(text)
for section,entries in fragment.items():text=helper.append_entries(text,section,entries)
chars=json.loads(text)['chars'];top,_=helper.members(text);entries,_=helper.members(text,top['chars'][0]);changes=[]
selected={'shade0':('shade','shade0'),'shade1':('shade','shade1'),'shade2':('shade','shade2'),'shade3':('shade',None),'shade_chief':('shade','shade_chief'),'withered':('withered',None),'withered_priest':('withered','priest'),'spore0':('spore','spore0'),'spore1':('spore','spore1')}
for name,(model,head)in selected.items():
 row={**chars[name],'human':True,'humanSpec':model};row.pop('humanHead',None)
 if head:row['humanHead']=head
 row['portrait']=models[model]['heads'][head]['down']['frame']if head else models[model]['base']['down']['head']['frame'];begin,end=entries[name];changes.append((begin,end,json.dumps(row,ensure_ascii=False,indent=2)))
for begin,end,value in sorted(changes,reverse=True):text=text[:begin]+value+text[end:]
after=helper.previous_values(text)
for section,values in previous.items():
 for key,value in values.items():
  if section!='chars'or key not in selected:assert after[section][key]==value,('Changed old source bytes',section,key)
manifest.write_text(text)
(ROOT/'src/client/render/human-mutants.json').write_text(encode(models));(OUT/'source-specs.json').write_text(encode(models));(OUT/'manifest.fragment.json').write_text(encode(fragment));(OUT/'source-audit.json').write_text(encode(records))
selected_frames=set()
for model,role in selected.values():
 for direction,base in models[model]['base'].items():
  head=models[model]['heads'][role][direction]if role else base['head']
  for part in [head,base['torso'],*base['upper'].values(),*base['forearm'].values(),*base['legs'].values()]:selected_frames.add(part['frame'])
selected_regions={tuple(fragment['frames'][key])for key in selected_frames if key in fragment['frames']}
print(json.dumps({'originalPNGs':5,'registeredUniqueOriginalRegions':len({tuple(v)for v in fragment['frames'].values()}),'selectedBodyUniqueOriginalRegions':len(selected_regions),'registeredFrames':len(fragment['frames']),'characters':len(selected),'pixelEdits':0,'models':list(models)}))
