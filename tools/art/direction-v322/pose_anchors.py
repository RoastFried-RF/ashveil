"""Read preserved alpha for foot/hip pivots and side-facing primary wrists."""
import statistics

def attachment(alpha,pose,name,direction,scale,human):
 x,y,w,h=pose['frame'];bottom=round(y+pose['anchor'][1]*h);height=pose['bodyHeight'];top=bottom-height;pixels=alpha.load()
 if name in ['walk','idle','crouchWalk']:
  ys=range(top+round(height*.48),top+round(height*.63))
  xs=[px for py in ys for px in range(x,x+w)if pixels[px,py]>=192]
  center=statistics.median(xs)if xs else x+w/2
 elif name in ['fall','sleep']and w>height*1.2:center=x+w/2
 else:
  xs=[px for py in range(max(top,bottom-max(3,round(height*.055))),bottom)for px in range(x,x+w)if pixels[px,py]>=192]
  center=(min(xs)+max(xs))/2 if xs else x+w/2
 anchor=[(center-x)/w,pose['anchor'][1]];result={'anchor':anchor,'scale':scale}
 if human and name in ['attack','shoot','block','hurt']and direction in ['left','right']:
  edges=[]
  for py in range(top+round(height*.27),top+round(height*.53)):
   row=[px for px in range(x,x+w)if pixels[px,py]>=192]
   if row:edges.append((min(row)if direction=='left'else max(row),py))
  if edges:
   values=sorted(p[0]for p in edges);limit=values[round((len(values)-1)*(.08 if direction=='left'else .92))];margin=max(2,height*.01)
   outer=[point for point in edges if(point[0]<=limit+margin if direction=='left'else point[0]>=limit-margin)]
   wrist=statistics.median(p[0]for p in outer)+(height*.025 if direction=='left'else-height*.025);wy=statistics.median(p[1]for p in outer)
   result['mainHand']=[(wrist-center)*scale,(wy-bottom)*scale]
 return result
