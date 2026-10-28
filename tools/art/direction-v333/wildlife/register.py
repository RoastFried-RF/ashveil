"""Read original alpha; write JSON/HTML only. Never alter/crop PNG bytes."""
from pathlib import Path
from PIL import Image
import hashlib,json,statistics,sys

ROOT=Path(__file__).resolve().parent
PROJECT=Path(__file__).resolve().parents[4]
ORIGINALS=PROJECT/'public/sprites/original/direction-v333'
sys.path.insert(0,str(PROJECT/'tools/art/direction-v322'))
from read_atlas import analyze
DIRS=['down','left','right','up']
SPECS={
 'ashhorn-stag':{'key':'av331_ashhorn_stag','label':'재뿔사슴','scale':.17,'headOffset':49,'shadow':[17,6],'healthBarWidth':26,'gait':850},
 'tuskhog':{'key':'av331_tuskhog','label':'엄니돼지','scale':.12,'headOffset':30,'shadow':[14,5],'healthBarWidth':25,'gait':800},
}
JOBS=[('idle-v1',4,[('idle',0)]),('walk-v1',4,[('walk',0)]),('attack-v1',4,[('attack',0)]),('hurt-fall-v1',8,[('hurt',0)]),('sleep-rise-v1',8,[('sleep',0),('rise',4)]),('fall-v2',4,[('fall',0)])]
manifest={'sheets':{},'sheetSizes':{},'frames':{},'chars':{}}
preview={'species':SPECS,'sheets':{},'frames':{},'clips':{},'notes':{'notGameAcceptance':True,'rejectedRegionCount':32,'originalSourceCount':12,'newAuthoredAcceptedRegions':224,'mirroredRegions':0,'reversePlaybackCountedAsNew':0}}
inventory=[];edge_checks=[];rejected=[];accepted_windows=set()

def reg(path,columns):
 im=Image.open(path).convert('RGBA');alpha=im.getchannel('A');base=analyze(path,columns);rows=[]
 for ri,row in enumerate(base):
  row_top=min(p['frame'][1]for p in row);row_bottom=max(p['frame'][1]+p['frame'][3]for p in row)
  prior_bottom=max(p['frame'][1]+p['frame'][3]for p in base[ri-1])if ri else 0
  next_top=min(p['frame'][1]for p in base[ri+1])if ri<3 else im.height
  top=(prior_bottom+row_top)//2 if ri else 0;bottom=(row_bottom+next_top)//2 if ri<3 else im.height
  poses=[]
  for ci,p in enumerate(row):
   x,y,w,h=p['frame'];left=(row[ci-1]['frame'][0]+row[ci-1]['frame'][2]+x)//2 if ci else 0
   right=(x+w+row[ci+1]['frame'][0])//2 if ci+1<columns else im.width
   box=alpha.crop((left,top,right,bottom)).point(lambda a:255 if a>=64 else 0).getbbox()
   assert box,(path,ri,ci,'empty alpha')
   a,b,c,d=left+box[0],top+box[1],left+box[2],top+box[3]
   x0=max(left,a-2);y0=max(top,b-2);x1=min(right,c+2);y1=min(bottom,d+2)
   # Only original low contact pixels define the foot pivot; head/antler height
   # is never used to shift a physical actor's root horizontally.
   foot_top=max(b,d-max(4,round((d-b)*.06)))
   xs=[xx for yy in range(foot_top,d)for xx in range(a,c)if im.getpixel((xx,yy))[3]>=128]
   foot_x=(min(xs)+max(xs))/2 if xs else (a+c)/2
   anchor=[(foot_x-x0)/(x1-x0),(d-y0)/(y1-y0)]
   poses.append({'frame':[x0,y0,x1-x0,y1-y0],'anchor':anchor,'opaqueHeight':d-b,'contact':{'x':foot_x,'y':d},'facing':DIRS[ri],'row':ri,'column':ci})
   # A touching rectangle alone is not clipping. Count only a continuous
   # opaque edge into a neighboring excluded pixel, not low-alpha hidden RGB.
   cuts=0
   for yy in range(y0,y1):
    for xx,out in [(x0,x0-1),(x1-1,x1)]:
     if 0<=out<im.width and im.getpixel((xx,yy))[3]>=128 and im.getpixel((out,yy))[3]>=128:cuts+=1
   for xx in range(x0,x1):
    for yy,out in [(y0,y0-1),(y1-1,y1)]:
     if 0<=out<im.height and im.getpixel((xx,yy))[3]>=128 and im.getpixel((xx,out))[3]>=128:cuts+=1
   edge_checks.append({'source':path.name,'row':ri,'column':ci,'continuousOpaqueCutPixels':cuts})
  rows.append(poses)
 return im.size,rows

for species,spec in SPECS.items():
 clips={};transforms={};allposes={};sizes={}
 jobs=JOBS+([('hurt-v2',4,[('hurt',0)])]if species=='tuskhog'else[])
 for suffix,columns,accepted in jobs:
  if species=='tuskhog'and suffix=='hurt-fall-v1':accepted=[]
  ident=species+'-'+suffix;path=ORIGINALS/(ident+'.png');size,poses=reg(path,columns);allposes[suffix]=poses;sizes[suffix]=size
  sheet='av333_'+ident.replace('-','_');dest='sprites/original/direction-v333/'+path.name
  if accepted:
   manifest['sheets'][sheet]=dest;manifest['sheetSizes'][sheet]=list(size);preview['sheets'][sheet]='../../../../public/sprites/original/direction-v333/'+path.name
  rec=json.loads((ROOT/'records'/(ident+'.json')).read_text());assert hashlib.sha256(path.read_bytes()).hexdigest()==rec['sha256']
  rec['visualStatus']='source-inspected';rec['acceptedMotions']=[m for m,_ in accepted];rec['registrationMethod']='alpha64 gutter-bounded crop plus two original transparent pixels; opaque bottom6% contact pivot'
  rec['rejectedMotions']=(['hurt','fall']if species=='tuskhog'else['fall'])if suffix=='hurt-fall-v1'else[]
  if rec['rejectedMotions']:
   rec['rejectionReason']='Columns5-8 fall rolling introduces yaw in front/back headings and is replaced by dedicated sternal-collapse v2.'
   if species=='tuskhog':rec['rejectionReason']+=' Two original left-profile hurt crops also touch opaque neighboring edge pixels, so all original hurt regions are withheld and replaced by dedicated spacious hurt-v2.'
   cols=list(range(8))if species=='tuskhog'else[4,5,6,7]
   rejected.append({'source':'originals/'+path.name,'sha256':rec['sha256'],'rows':[0,1,2,3],'columns':cols,'regions':len(cols)*4,'reason':rec['rejectionReason'],'replacement':['originals/'+species+'-fall-v2.png']+(['originals/tuskhog-hurt-v2.png']if species=='tuskhog'else[])})
  (ROOT/'records'/(ident+'.json')).write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
  inventory.append({'id':ident,'file':'originals/'+path.name,'sha256':rec['sha256'],'size':list(size),'authoredRegions':columns*4,'proposedRegions':len(accepted)*16,'acceptedMotions':rec['acceptedMotions'],'rejectedMotions':rec['rejectedMotions']})
  for motion,offset in accepted:
   clips[motion]={}
   for ri,direction in enumerate(DIRS):
    keys=[]
    # Multi-action sheets were generated at a smaller authored native scale.
    # Normalize once against their actual standing pose for this direction;
    # never resize a lying pose to the height of a standing animal.
    ratio=1
    if suffix=='walk-v1':ratio=allposes['idle-v1'][ri][0]['opaqueHeight']/statistics.median(p['opaqueHeight']for p in poses[ri])
    if suffix=='hurt-fall-v1':ratio=allposes['idle-v1'][ri][0]['opaqueHeight']/poses[ri][3]['opaqueHeight']
    if suffix=='sleep-rise-v1':ratio=allposes['idle-v1'][ri][0]['opaqueHeight']/poses[ri][7]['opaqueHeight']
    for fi in range(4):
     pose=poses[ri][offset+fi];key='av333_'+species.replace('-','_')+'_'+motion+'_'+direction+str(fi)
     accepted_windows.add((path.name,ri,offset+fi))
     manifest['frames'][key]=[sheet,*pose['frame']];transforms[key]={'anchor':pose['anchor'],'scale':spec['scale']*ratio};keys.append(key)
     preview['frames'][key]={'sheet':sheet,**pose,'scale':spec['scale']*ratio}
    clips[motion][direction]=keys
 c={'idle':clips['idle'],'walk':clips['walk'],'attack':clips['attack'],'anchor':[.5,1],'renderScale':spec['scale'],'headOffset':spec['headOffset'],'shadow':spec['shadow'],'healthBarWidth':spec['healthBarWidth'],'heldItems':False,'gait':{'walk':spec['gait'],'crouchWalk':spec['gait']+200},'motions':{m:clip for m,clip in clips.items()if m not in ['idle','walk','attack']},'frameTransforms':transforms}
 manifest['chars'][spec['key']]=c;preview['clips'][species]=clips

assert len(manifest['frames'])==224
bad=[x for x in edge_checks if x['continuousOpaqueCutPixels']>0]
selected_bad=[x for x in bad if(x['source'],x['row'],x['column'])in accepted_windows]
preview['notes'].update({'rejectedRegionCount':48,'originalSourceCount':13,'newAuthoredAcceptedRegions':224});preview['originals']=inventory
report={'status':'proposed-staging-only','newSpecies':2,'newOriginalPNG':len(inventory),'proposedOriginalPNG':sum(bool(x['proposedRegions'])for x in inventory),'authoredOriginalRegions':sum(x['authoredRegions']for x in inventory),'proposedUniqueOriginalRegions':len(manifest['frames']),'rejectedOriginalRegions':sum(x['regions']for x in rejected),'mirroredOriginalRegions':0,'reversedPlaybackCountedAsNew':0,'duplicateHashes':len(inventory)-len(set(x['sha256']for x in inventory)),'opaqueBorderContinuityFindings':selected_bad,'rejectedOpaqueBorderContinuityFindings':[x for x in bad if x not in selected_bad],'originals':inventory,'visualReview':'All13 original sheets opened; native alpha-composited diagnostic pending. No main-game acceptance.','missing':['Independent portraits','Additional crouch/block/use motions','Actual core policy and in-game integration from v331 contract']}
(ROOT/'sprites.fragment.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'preview-data.json').write_text(json.dumps(preview,ensure_ascii=False,indent=2)+'\n')
(ROOT/'registration-proof.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(ROOT/'rejected'/'regions.json').write_text(json.dumps(rejected,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k not in ['originals']},ensure_ascii=False,indent=2))
