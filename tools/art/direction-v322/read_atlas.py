"""Inspect original alpha only; no raster output or pixel modification."""
import statistics
from PIL import Image

def bands(values,minimum,merge=1):
 runs=[];start=None
 for index,value in enumerate(values+[0]):
  if value>minimum and start is None:start=index
  if value<=minimum and start is not None:runs.append([start,index]);start=None
 result=[]
 for start,end in runs:
  if result and start-result[-1][1]<=merge:result[-1][1]=end
  else:result.append([start,end])
 return result

def analyze(path,columns=8):
 im=Image.open(path).convert('RGBA');w,h=im.size;alpha=im.getchannel('A');pixels=alpha.load()
 rows=bands([sum(v>=192 for v in alpha.crop((0,y,w,y+1)).get_flattened_data())for y in range(h)],max(10,w//120))
 assert len(rows)==4,('Expected4 rows',path,rows)
 poses=[]
 for row,(top,bottom)in enumerate(rows):
  cols=bands([sum(v>=192 for v in alpha.crop((x,top,x+1,bottom)).get_flattened_data())for x in range(w)],max(2,(bottom-top)//120))
  assert len(cols)==columns,('Expected8 separated silhouettes',path,row,cols)
  frames=[]
  for col,(left,right)in enumerate(cols):
   box=alpha.crop((left,top,right,bottom)).point(lambda v:255 if v>=192 else 0).getbbox();assert box
   x0,y0,x1,y1=left+box[0],top+box[1],left+box[2],top+box[3]
   torso=[x for y in range(y0+round((y1-y0)*.22),y0+round((y1-y0)*.44))for x in range(x0,x1)if pixels[x,y]>=192]
   center=statistics.median(torso)if torso else(x0+x1)/2
   # Padding stops in the transparent gutter before the adjacent silhouette.
   guardLeft=(cols[col-1][1]+left)//2 if col else 0
   guardRight=(right+cols[col+1][0])//2 if col+1<len(cols)else w
   a=max(guardLeft,x0-2);b=max(0,y0-2);c=min(guardRight,x1+2);d=min(h,y1+2)
   frames.append({'frame':[a,b,c-a,d-b],'anchor':[(center-a)/(c-a),(y1-b)/(d-b)],'bodyHeight':y1-y0,'row':row,'column':col})
  poses.append(frames)
 return poses
