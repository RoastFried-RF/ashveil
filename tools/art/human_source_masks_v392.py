"""Read-only source geometry/alpha analysis. No asset pixels are changed or saved."""
import math
from PIL import Image,ImageDraw
def triangles(polygon):
 def cross(a,b,c):return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 area=sum(polygon[i][0]*polygon[(i+1)%len(polygon)][1]-polygon[(i+1)%len(polygon)][0]*polygon[i][1]for i in range(len(polygon)))
 indices=list(range(len(polygon)));out=[]
 if area<0:indices.reverse()
 while len(indices)>3:
  for j,index in enumerate(indices):
   a,b,c=polygon[indices[j-1]],polygon[index],polygon[indices[(j+1)%len(indices)]]
   if cross(a,b,c)<=1e-9:continue
   if any(all(cross(x,y,polygon[k])>=-1e-9 for x,y in [(a,b),(b,c),(c,a)])for k in indices if k not in [indices[j-1],index,indices[(j+1)%len(indices)]]):continue
   out.append([a,b,c]);indices.pop(j);break
  else:raise ValueError('Non-simple source mask '+repr(polygon))
 out.append([polygon[i]for i in indices]);return out
def attach_roots(cuts,alpha,wrist,label):
 opaque=alpha.point(lambda v:255 if v>=128 else 0);union=Image.new('1',alpha.size);draw=ImageDraw.Draw(union)
 for c in cuts.values():draw.polygon([tuple(p)for p in c['polygon']],fill=1)
 def parent(p):
  x,y=map(round,p);return 0<=x<alpha.width and 0<=y<alpha.height and opaque.getpixel((x,y)) and not union.getpixel((x,y))
 for suffix,c in cuts.items():
  start=c['cap'];dx,dy=wrist[0]-start[0],wrist[1]-start[1];length=math.hypot(dx,dy);assert length>0
  step=[dx/length,dy/length];root=None
  for n in range(math.ceil(length*4)+1):
   p=[start[0]+step[0]*n/4,start[1]+step[1]*n/4]
   if parent(p):root=p;break
  assert root is not None,('No surviving source root',label,suffix)
  c['cap']=root
  for n in range(1,math.ceil(c['width']*.25*4)+1):
   p=[root[0]+step[0]*n/4,root[1]+step[1]*n/4]
   if not parent(p):break
   c['cap']=p
  assert parent(c['cap']),('Nonopaque stump root',label,suffix,c['cap'])
def orphan_table(cuts,alpha,root):
 # Source-connected skin after each finite loss combination. Remove only islands
 # separated by the actual cut, with exact disjoint row rectangles (no raster output).
 width,height=alpha.size;values=list(alpha.getdata());original={i for i,v in enumerate(values)if v>=16}
 def component(points):
  seed=min(points,key=lambda i:(i%width-root[0])**2+(i//width-root[1])**2);seen={seed};queue=[seed]
  for i in queue:
   x=i%width;y=i//width
   for dy in [-1,0,1]:
    for dx in [-1,0,1]:
     xx,yy=x+dx,y+dy
     if 0<=xx<width and 0<=yy<height:
      j=yy*width+xx
      if j in points and j not in seen:seen.add(j);queue.append(j)
  return seen
 original=component(original);digit_sets=[]
 for c in cuts.values():
  mask=Image.new('1',alpha.size);ImageDraw.Draw(mask).polygon([tuple(p)for p in c['polygon']],fill=1);digit_sets.append({i for i,v in enumerate(mask.getdata())if v})
 table=[];soles=[];cache={};suffixes=list(cuts)
 for mask in range(32):
  effective=sum((1<<i)for i in range(len(suffixes))if mask&(1<<i))
  if not effective:table.append([]);soles.append(max(i//width for i in original if values[i]>=128));continue
  if effective in cache:triangles,sole=cache[effective];table.append(triangles);soles.append(sole);continue
  removed=set().union(*(digit_sets[i]for i in range(len(suffixes))if effective&(1<<i)));remaining=original-removed;connected=component(remaining);orphans=remaining-connected;sole=max(i//width for i in connected if values[i]>=128)
  runs=[]
  for y in sorted({i//width for i in orphans}):
   xs=sorted(i%width for i in orphans if i//width==y);start=previous=xs[0]
   for x in xs[1:]+[width+1]:
    if x!=previous+1:runs.append([start,y,previous+1,y+1]);start=x
    previous=x
  # Rectangles exactly allocate source pixels; shared edges do not overlap skin.
  triangles=[]
  for x,y,r,b in runs:triangles.extend([[[x,y],[r,y],[r,b]],[[x,y],[r,b],[x,b]]])
  cache[effective]=(triangles,sole);table.append(triangles);soles.append(sole)
 return table,soles
