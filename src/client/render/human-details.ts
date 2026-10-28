/** Original-source detail masks and loss markers. Presentation only; never writes a World. */
import {hAt,hClip,hpMix,type HMatrix,type HPoint}from'./human-model'
import {humanProfileNearSide,humanDigitSuffixes,humanToeSuffixes,type HumanDetailCut,type HumanDirection,type HumanPoint,type HumanSide,type HumanSource,type HumanSpec}from'./human-spec'
import type{HumanSurface}from'./human-state'
export interface HumanLossMark extends HumanDetailCut {owner:string;patch:string;layer:'skin'|'ear'}
const prefix=(side:HumanSide)=>side==='left'?'Left':'Right'
const absent=(parts:HumanSurface['parts'],id:string)=>!!parts[id]&&!parts[id].flesh
export function digitLossMarks(spec:HumanSpec,source:HumanSource,side:HumanSide,parts:HumanSurface['parts'],foot=false):HumanLossMark[]{
 const cuts=foot?spec.details?.footDetails[source.frame]?.cuts:spec.details?.hands[source.frame]
 const marks=Object.entries(cuts??{}).flatMap(([suffix,cut])=>cut&&absent(parts,prefix(side)+suffix)?[{...cut,owner:prefix(side)+suffix,patch:foot?'toe_cap':'finger_cap',layer:'skin'as const}]:[])
 const mask=(foot?humanToeSuffixes:humanDigitSuffixes).reduce((bits,suffix,i)=>bits|(absent(parts,prefix(side)+suffix)?1<<i:0),0),orphan=foot?spec.details?.footDetails[source.frame]?.orphanTrianglesByMask?.[mask]:spec.details?.handCleanup?.[source.frame]?.[mask]
 if(marks.length&&orphan?.length)marks[0]={...marks[0],triangles:[...(marks[0].triangles??[]),...orphan]}
 const all=!foot&&mask===31?spec.details?.handAllDigitsCut?.[source.frame]:undefined
 if(marks.length&&all)marks[0]={...marks[0],triangles:[...(marks[0].triangles??[]),...all.slice(1,-1).map((p,i)=>[all[0],p,all[i+2]])]}
 return marks
}
const ellipse=(p:HumanPoint,rx:number,ry:number):HPoint[]=>Array.from({length:16},(_,i)=>[p[0]+Math.cos(i*Math.PI/8)*rx,p[1]+Math.sin(i*Math.PI/8)*ry])
export function faceLossMarks(source:HumanSource,direction:HumanDirection,size:{w:number;h:number},parts:HumanSurface['parts']):HumanLossMark[]{
 if(!parts.Skull?.flesh)return[]
 const marks:HumanLossMark[]=[],near=humanProfileNearSide(direction),eyes=source.eyes??{},points=Object.values(eyes).filter((p):p is HumanPoint=>!!p),eye=near?eyes[near]:points.length===2?hpMix(points[0],points[1],.5):points[0],mouth=source.mouth
 const add=(owner:string,patch:string,point:HumanPoint,width:number,rx=width*.48,ry=width*.42,layer:'skin'|'ear'='skin')=>{if(absent(parts,owner))marks.push({owner,patch,cap:point,width,polygon:ellipse(point,rx,ry),layer})}
 if(direction!=='up'&&eye&&mouth&&(near||points.length===2)){
  const span=Math.max(12,Math.abs(mouth[1]-eye[1])),eyeWidth=near?span*.58:Math.abs(points[0][0]-points[1][0])*.62
  for(const[side,point]of Object.entries(eyes))if(point)add(prefix(side as HumanSide)+'Eye','eye_'+direction,point,eyeWidth,eyeWidth*.30,eyeWidth*.17)
  const nose=hpMix(eye,mouth,.55);if(near)nose[0]+=(direction==='left'?-1:1)*span*.4
  const noseWidth=near?span*.8:Math.abs(points[0][0]-points[1][0])*.85
  add('Nose','nose_'+direction,nose,noseWidth,noseWidth*.4,noseWidth*.34)
  const jawWidth=near?span*1.45:Math.abs(points[0][0]-points[1][0])*1.75,jaw=[mouth[0],mouth[1]+span*.05]as HPoint
  if(absent(parts,'Jaw'))marks.push({owner:'Jaw',patch:'jaw_'+direction,cap:jaw,width:jawWidth,polygon:ellipse([jaw[0],jaw[1]+span*.32],jawWidth*.38,jawWidth*.20),layer:'skin'})
  const ear=(side:HumanSide,point:HumanPoint,width:number,rx:number,ry:number)=>{if(absent(parts,prefix(side)+'Ear'))marks.push({owner:prefix(side)+'Ear',patch:'ear_cap',cap:near?point:hpMix(point,eye,.40),width:width*(near?.95:.65),polygon:ellipse(point,rx,ry),layer:'ear'})}
  if(near)ear(near,[size.w*(direction==='left'?.61:.29),eye[1]+span*.3],size.w*.17,size.w*.05,size.w*.07)
  else for(const side of['left','right']as const)ear(side,[size.w*(side==='left'?.88:.12),eye[1]+span*.3],size.w*.13,size.w*.065,size.w*.105)
 }
 return marks
}
/** Only exposed toes change the visible sole. Hidden rear/profile toes do not cut through a heel. */
export function lossAdjustedFoot(spec:HumanSpec,source:HumanSource,side:HumanSide,parts:HumanSurface['parts']):HumanSource{
 const detail=spec.details?.footDetails[source.frame];if(!detail)return source
 const mask=humanToeSuffixes.reduce((bits,suffix,i)=>bits|(absent(parts,prefix(side)+suffix)?1<<i:0),0),y=detail.soleYByMissingMask[mask]
 return y===undefined||y===source.b[1]?source:{...source,b:[source.b[0],y]}
}
export function lossMarkMatrix(parent:HMatrix,mark:HumanLossMark,patch:HumanSource&{size:[number,number];opaqueWidth?:number}):HMatrix{
 const inner=hAt(patch.a,mark.cap,mark.width/(patch.opaqueWidth??patch.size[0])),[a,b,c,d,tx,ty]=parent,[e,f,g,h,x,y]=inner
 return[a*e+c*f,b*e+d*f,a*g+c*h,b*g+d*h,a*x+c*y+tx,b*x+d*y+ty]
}
export const polygonArea=(p:readonly HumanPoint[])=>Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-b[0]*a[1]},0))/2
function convexPieces(polygon:readonly HumanPoint[]):HPoint[][]{
 const cross=(a:HumanPoint,b:HumanPoint,c:HumanPoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),area=polygon.reduce((n,a,i)=>{const b=polygon[(i+1)%polygon.length];return n+a[0]*b[1]-b[0]*a[1]},0),points=polygon.map(p=>[...p]as HPoint)
 if(points.length<3||polygonArea(points)<1e-7)return[]
 if(area<0)points.reverse()
 if(points.every((p,i)=>cross(points[(i+points.length-1)%points.length],p,points[(i+1)%points.length])>=-1e-8))return[points]
 const pieces:HPoint[][]=[]
 while(points.length>3){let found=false
  for(let i=0;i<points.length;i++){const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];if(cross(a,b,c)<=1e-8)continue
   if(points.some(p=>p!==a&&p!==b&&p!==c&&cross(a,b,p)>=-1e-8&&cross(b,c,p)>=-1e-8&&cross(c,a,p)>=-1e-8))continue
   pieces.push([a,b,c]);points.splice(i,1);found=true;break
  }
  if(!found)throw Error('Non-simple human source mask')
 }
 pieces.push(points);return pieces
}
/** Subtract a triangle as disjoint convex pieces; overlapping losses never re-fill another hole. */
function subtractTriangle(polygon:HPoint[],triangle:readonly HumanPoint[]):HPoint[][]{
 let inside=polygon;const outside:HPoint[][]=[],area=triangle.reduce((n,a,i)=>{const b=triangle[(i+1)%triangle.length];return n+a[0]*b[1]-b[0]*a[1]},0),sign=area<0?-1:1
 for(let i=0;i<3&&inside.length>=3;i++){
  const a=triangle[i],b=triangle[(i+1)%3],normal:HPoint=[-(b[1]-a[1])*sign,(b[0]-a[0])*sign],piece=hClip(inside,a,normal,false)
  if(piece.length>=3&&polygonArea(piece)>1e-7)outside.push(piece)
  inside=hClip(inside,a,normal,true)
 }
 return outside
}
export function detailMaskPieces(clip:readonly HumanPoint[],marks:readonly HumanLossMark[]):HPoint[][]{
 let pieces=convexPieces(clip)
 for(const mark of marks){const triangles=mark.triangles??mark.polygon.slice(1,-1).map((p,i)=>[mark.polygon[0],p,mark.polygon[i+2]])
  for(const triangle of triangles)pieces=pieces.flatMap(polygon=>subtractTriangle(polygon,triangle))
 }
 return pieces
}
