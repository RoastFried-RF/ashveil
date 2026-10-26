/** Source-preserving 2D skeletal projection. No game actions, clock, RNG or world mutation. */
import type {HumanBaseDirection,HumanDirection,HumanPoint,HumanSide,HumanSource} from './human-spec'
import type {MotionName} from './character-motion'
export type HPoint=[number,number]
export type HMatrix=[number,number,number,number,number,number]
export const hpAdd=(a:HumanPoint,b:HumanPoint):HPoint=>[a[0]+b[0],a[1]+b[1]]
export const hpSub=(a:HumanPoint,b:HumanPoint):HPoint=>[a[0]-b[0],a[1]-b[1]]
export const hpMul=(a:HumanPoint,n:number):HPoint=>[a[0]*n,a[1]*n]
export const hpMix=(a:HumanPoint,b:HumanPoint,t:number):HPoint=>hpAdd(hpMul(a,1-t),hpMul(b,t))
export const hpLength=(a:HumanPoint)=>Math.hypot(a[0],a[1])
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
const projection=Math.SQRT1_2
export const hTransform=(m:HMatrix,p:HumanPoint):HPoint=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]]
export function hAt(source:HumanPoint,target:HumanPoint,scale:number,rotation=0):HMatrix{
 const a=Math.cos(rotation)*scale,b=Math.sin(rotation)*scale,c=-b,d=a
 return[a,b,c,d,target[0]-a*source[0]-c*source[1],target[1]-b*source[0]-d*source[1]]
}
export function hSoleMatrix(source:HumanSource,target:HumanPoint,mirror=false):HMatrix{
 const scale=source.scale??.013,x=mirror?-scale:scale
 return[x,0,0,scale,target[0]-x*source.b[0],target[1]-scale*source.b[1]]
}
/** Keep the measured span size/orientation while pinning a separately observed attachment. */
export function hPinMount(source:HumanSource,a:HumanPoint,b:HumanPoint,widthScale:number,attachment?:HumanPoint):HMatrix{
 const matrix=hPin(source,a,b,widthScale)
 if(attachment&&source.mount){const projected=hTransform(matrix,source.mount);matrix[4]+=attachment[0]-projected[0];matrix[5]+=attachment[1]-projected[1]}
 return matrix
}
/** Along-axis foreshortening is explicit; transverse source width is never enlarged to hide a gap. */
export function hPin(source:HumanSource,a:HumanPoint,b:HumanPoint,widthScale:number,mirror=false):HMatrix{
 const s=hpSub(source.b,source.a),t=hpSub(b,a),sl=hpLength(s)||1,tl=hpLength(t)||1,sx=s[0]/sl,sy=s[1]/sl,tx=t[0]/tl,ty=t[1]/tl,k=tl/sl,w=widthScale*(mirror?-1:1)
 const out:HMatrix=[tx*k*sx+ty*w*sy,ty*k*sx-tx*w*sy,tx*k*sy-ty*w*sx,ty*k*sy+tx*w*sx,0,0]
 out[4]=a[0]-out[0]*source.a[0]-out[2]*source.a[1];out[5]=a[1]-out[1]*source.a[0]-out[3]*source.a[1];return out
}
export function hTwoLink(a:HumanPoint,target:HumanPoint,l1:number,l2:number,bend:number){
 const delta=hpSub(target,a),distance=hpLength(delta),axis=distance?hpMul(delta,1/distance):[0,1]as HPoint,reach=clamp(distance,Math.abs(l1-l2)+1e-5,l1+l2-1e-5),end=hpAdd(a,hpMul(axis,reach)),along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along))
 return{joint:hpAdd(a,hpAdd(hpMul(axis,along),hpMul([-axis[1],axis[0]],height*bend))),end,error:hpLength(hpSub(end,target))}
}
const heading:Record<HumanDirection,HPoint>={down:[0,1],left:[-1,0],right:[1,0],up:[0,-1]}
export interface HumanFootInput {x:number;y:number;lift:number;contact:boolean;present:boolean;swing:boolean;plantId?:number}
export interface HumanPoseInput {
 direction:HumanDirection;root:HumanPoint;mode:MotionName;phase:number;stride:number;moving:boolean;crouched:boolean;prone:boolean;alive:boolean;fall:number;hipDip?:number
 hands?:Partial<Record<HumanSide,HumanPoint>>
 actionSide?:HumanSide
 footMounts?:Partial<Record<HumanSide,HumanPoint>>
}
export interface HumanBone {a:HPoint;b:HPoint;matrix:HMatrix;z:number;reachError:number}
export interface HumanPose {
 torso:HMatrix;head:HMatrix;neck:HPoint;hip:HPoint;headTop:HPoint
 shoulders:Record<HumanSide,HPoint>;hips:Record<HumanSide,HPoint>;grips:Record<HumanSide,HPoint>
 bones:Record<string,HumanBone>;feet:Record<HumanSide,HumanFootInput&{actual:HPoint;error:number}>
 maxReachError:number
}
/** Major anatomical owners share a persistent skeleton through all action families. */
export function humanPose(base:HumanBaseDirection,input:HumanPoseInput,feet:Record<HumanSide,HumanFootInput>):HumanPose{
 const {direction,mode,phase}=input,forward=heading[direction],sway=input.moving?Math.sin(input.stride*Math.PI):0,work=mode==='work'?Math.sin(phase*Math.PI*2):0
 const lowering=(input.crouched?4:mode==='crouchDown'?4*phase:mode==='stand'?4*(1-phase):0)+(input.hipDip??0)
 const hipHeight=14.5-lowering/projection,hip:HPoint=[0,-hipHeight*projection],lean=(mode==='attack'?.025*Math.sin(phase*Math.PI):mode==='hurt'?-.055*Math.sin(phase*Math.PI):mode==='work'?.025*work:mode==='throw'?.045*Math.sin(phase*Math.PI):0)*(direction==='left'?-1:1)
 const torso=hAt(base.torso.a,hip,.06,lean),neck=hTransform(torso,base.torso.neck),head=hAt(base.head.a,neck,base.head.scale??.06,lean*.5),bones:Record<string,HumanBone>={},shoulders={}as Record<HumanSide,HPoint>,hips={}as Record<HumanSide,HPoint>,grips={}as Record<HumanSide,HPoint>,footResults={}as HumanPose['feet'];let maxReachError=0
 for(const side of ['left','right']as const){
  const Side=side==='left'?'Left':'Right',far=direction==='left'?side==='right':direction==='right'?side==='left':side==='left',z=far?10:20,leg=base.legs[side],hipPoint=hTransform(torso,base.torso.hips[side]),observedFoot=feet[side],foot=observedFoot.present?observedFoot:{...observedFoot,x:input.root[0]+hipPoint[0],y:input.root[1],lift:0},sole:HPoint=[foot.x-input.root[0],foot.y-input.root[1]-foot.lift],footHeight=hpLength(hpSub(base.foot.b,base.foot.a))*.06
  hips[side]=hipPoint
  // A paperdoll has a screen-space joint projection, not a physical3D leg solver.
  // Preserve planted sole pixels instead of pinning a clamped/inaccessible virtual ankle.
  const ankle=hpAdd(sole,input.footMounts?.[side]??[0,-footHeight]),upperLength=hpLength(hpSub(leg.knee,leg.a)),lowerLength=hpLength(hpSub(leg.b,leg.knee)),ratio=upperLength/(upperLength+lowerLength),bend=input.crouched?2.2:foot.swing?1.1:.25,knee=hpAdd(hpMix(hipPoint,ankle,ratio),[forward[0]*bend,forward[1]*bend*.35]),actualSole=sole,mirror=(direction==='up'||direction==='down')&&side==='right',sol={error:0}
  bones[Side+'Thigh']={a:hipPoint,b:knee,matrix:hPin({...leg,b:leg.knee},hipPoint,knee,.035,mirror),z,reachError:sol.error}
  bones[Side+'Shin']={a:knee,b:ankle,matrix:hPin({...leg,a:leg.knee},knee,ankle,.035,mirror),z:z+1,reachError:sol.error}
  bones[Side+'Foot']={a:ankle,b:actualSole,matrix:hPin(base.foot,ankle,actualSole,.06,mirror),z:z+2,reachError:sol.error}
  footResults[side]={...foot,actual:actualSole,error:hpLength(hpSub(actualSole,sole))};maxReachError=Math.max(maxReachError,sol.error)
  const upper=base.upper[side],lower=base.forearm[side],shoulder=hTransform(torso,base.torso.shoulders[side]),armSign=direction==='left'?-1:direction==='right'?1:(side==='left'?1:-1)*(direction==='up'?-1:1),lUpper=hpLength(hpSub(upper.b,upper.a))*.052,lLower=hpLength(hpSub(lower.b,lower.a))*.052
  shoulders[side]=shoulder
  const localSway=sway*(side==='left'?1:-1),normal:HPoint=hpAdd(shoulder,[armSign*(.8+localSway),lUpper+lLower-.2]),pulse=Math.sin(Math.PI*clamp((phase-.12)/.72,0,1))**2,active=side===(input.actionSide??'right'),strike=hpAdd(shoulder,[forward[0]*6+armSign,5+forward[1]*5]),guard=hpAdd(neck,[armSign*3,5]),defaultGrip=mode==='attack'?hpMix(normal,active?strike:guard,pulse*(active?1:.4)):mode==='block'?hpMix(normal,guard,Math.sin(phase*Math.PI)**2):mode==='throw'&&active?hpMix(normal,strike,Math.sin(phase*Math.PI)**2):mode==='work'?hpAdd(shoulder,[forward[0]*5+armSign*1.5,7+work*.7]):mode==='use'?hpMix(normal,hpAdd(neck,[armSign*1.5,4+Math.sin(phase*Math.PI)*2]),Math.sin(phase*Math.PI)**2):mode==='interact'?hpMix(normal,hpAdd(shoulder,[armSign*3,6]),Math.sin(phase*Math.PI)**2):normal,targetGrip=input.hands?.[side]??defaultGrip,arm=hTwoLink(shoulder,targetGrip,lUpper,lLower,-armSign),armZ=direction==='left'?side==='right'?5:50:direction==='right'?side==='left'?5:50:direction==='up'?5:50
  bones[Side+'UpperArm']={a:shoulder,b:arm.joint,matrix:hPin(upper,shoulder,arm.joint,.052),z:armZ,reachError:arm.error}
  bones[Side+'Forearm']={a:arm.joint,b:arm.end,matrix:hPin(lower,arm.joint,arm.end,.052),z:armZ+1,reachError:arm.error}
  const wrist=hTransform(bones[Side+'Forearm'].matrix,lower.wrist)
  bones[Side+'Hand']={a:wrist,b:arm.end,matrix:bones[Side+'Forearm'].matrix,z:armZ+2,reachError:arm.error};grips[side]=arm.end;maxReachError=Math.max(maxReachError,arm.error)
 }
 return{torso,head,neck,hip,headTop:hTransform(head,base.head.b),shoulders,hips,grips,bones,feet:footResults,maxReachError}
}
/** End-exclusive source masks allocate one original to separate anatomical draw owners. */
export function hHalfPlane(width:number,height:number,origin:HumanPoint,normal:HumanPoint,distal:boolean):HPoint[]{
 return hClip([[0,0],[width,0],[width,height],[0,height]],origin,normal,distal)
}
export function hClip(polygon:readonly HPoint[],origin:HumanPoint,normal:HumanPoint,distal:boolean):HPoint[]{
 const distance=(p:HumanPoint)=>((p[0]-origin[0])*normal[0]+(p[1]-origin[1])*normal[1])*(distal?1:-1),out:HPoint[]=[]
 for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(hpMix(a,b,da/(da-db)))}return out
}
