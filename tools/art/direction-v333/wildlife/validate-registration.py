"""Staging file/hash/crop audit only. Does not create a World or rewrite PNGs."""
from pathlib import Path
from PIL import Image
import hashlib,json
R=Path(__file__).resolve().parent
ORIGINALS=Path(__file__).resolve().parents[4]/'public/sprites/original/direction-v333'
m=json.loads((R/'sprites.fragment.json').read_text());p=json.loads((R/'registration-proof.json').read_text())
images={};errors=[]
for row in p['originals']:
 path=ORIGINALS/Path(row['file']).name
 if hashlib.sha256(path.read_bytes()).hexdigest()!=row['sha256']:errors.append(row['id']+': SHA mismatch')
 with Image.open(path)as im:im.verify()
for sheet,final in m['sheets'].items():
 path=ORIGINALS/Path(final).name;im=Image.open(path).convert('RGBA');images[sheet]=im
 if list(im.size)!=m['sheetSizes'][sheet]:errors.append(sheet+': sheet size mismatch')
for key,(sheet,x,y,w,h)in m['frames'].items():
 im=images.get(sheet)
 if not im or x<0 or y<0 or w<1 or h<1 or x+w>im.width or y+h>im.height:errors.append(key+': crop out of range');continue
 if not im.getchannel('A').crop((x,y,x+w,y+h)).point(lambda a:255 if a>=128 else 0).getbbox():errors.append(key+': empty opaque frame')
references=[]
for key,c in m['chars'].items():
 for name,clip in [('idle',c['idle']),('walk',c['walk']),('attack',c['attack']),*c['motions'].items()]:
  if set(clip)!=set(['down','left','right','up']):errors.append(key+'/'+name+': wrong facings')
  for d,frames in clip.items():
   if len(frames)!=4:errors.append(key+'/'+name+'/'+d+': not four actual frames')
   for frame in frames:
    references.append(frame)
    if frame not in m['frames']:errors.append(frame+': missing referenced frame')
    transform=c['frameTransforms'].get(frame)
    if not transform or not all(0<=v<=1 for v in transform['anchor'])or transform['scale']<=0:errors.append(frame+': invalid foot transform')
    if transform and transform.get('flipX'):errors.append(frame+': unexpected mirrored registration')
 if c['heldItems']:errors.append(key+': quadruped must not receive invented human equipment overlays')
regions=[tuple(v)for v in m['frames'].values()]
if len(regions)!=len(set(regions)):errors.append('A repeated source rectangle was counted as a distinct authored region')
if p['opaqueBorderContinuityFindings']:errors.append('Selected frames still cross opaque crop edges')
result={'scope':'staging file/hash/reference/crop audit; does not prove locomotion, canonical AI or main-game integration','errors':errors,'pngCRCsVerified':len(p['originals']),'preservedHashesVerified':len(p['originals']),'proposedSheets':len(m['sheets']),'registeredSpecies':len(m['chars']),'registeredFrames':len(m['frames']),'uniqueRegisteredSourceRegions':len(set(regions)),'referencedFrames':len(references),'rejectedRegions':p['rejectedOriginalRegions'],'mirrors':0,'mainGameModified':False}
(R/'validation-proof.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2));assert not errors
