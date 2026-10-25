/** Dedicated six-drive planar presentation, supplied actor root only. No Core/world clock. */
import {cullerDriveIds,type CullerDriveId,type CullerDirectionSpec,type CullerPoint as Point} from './culler-spec'
export const cullerDistance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const mix=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})
export const cullerSmooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t)}
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y})
export function cullerSolve(hip:Point,goal:Point,upper:number,lower:number,bend:Point){
 const dx=goal.x-hip.x,dy=goal.y-hip.y,requested=Math.hypot(dx,dy),d=Math.max(Math.abs(upper-lower)+1e-7,Math.min(upper+lower-1e-7,requested)),ux=requested>1e-9?dx/requested:0,uy=requested>1e-9?dy/requested:1,along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along))
 let nx=-uy,ny=ux;if(nx*bend.x+ny*bend.y<0){nx=-nx;ny=-ny}
 const knee={x:hip.x+ux*along+nx*height,y:hip.y+uy*along+ny*height},end={x:hip.x+ux*d,y:hip.y+uy*d}
 return{hip:{...hip},knee,end,requested:{...goal},error:cullerDistance(end,goal)}
}
/** Source pin pair maps uniformly; opposite handedness is explicit display reuse. */
export function cullerPinMatrix(a:Point,b:Point,A:Point,B:Point,mirror=false){
 const flip=mirror?-1:1,sx=(b.x-a.x)*flip,sy=b.y-a.y,dx=B.x-A.x,dy=B.y-A.y,scale=Math.hypot(dx,dy)/Math.hypot(sx,sy),angle=Math.atan2(dy,dx)-Math.atan2(sy,sx),co=Math.cos(angle),si=Math.sin(angle),m={a:co*scale*flip,b:si*scale*flip,c:-si*scale,d:co*scale,e:0,f:0}
 m.e=A.x-m.a*a.x-m.c*a.y;m.f=A.y-m.b*a.x-m.d*a.y;return m
}
type Foot={anchor:Point;point:Point;epoch:number;disabled:boolean;swing:{start:Point;end:Point;nominal:Point;progress:number}|null}
const tripods:readonly (readonly CullerDriveId[])[]=[['DriveRF','DriveLM','DriveRH'],['DriveLF','DriveRM','DriveLH']]
let owners=0
export class CullerMotion {
 readonly owner=++owners
 root:Point
 distance=0
 private nextTripod=0
 private group:CullerDriveId[]=[]
 private bodyLower=0
 private maxLandingAdjustment=0
 private readonly feet:Record<CullerDriveId,Foot>
 constructor(private readonly spec:CullerDirectionSpec,point:Point){this.root={...point};this.feet=Object.fromEntries(cullerDriveIds.map(id=>{const anchor=add(point,spec.layout.legs[id].sole);return[id,{anchor,point:{...anchor},epoch:0,disabled:false,swing:null}]})) as Record<CullerDriveId,Foot>}
 private offset(){const foot=this.spec.art.foot;return{x:(foot.sole.x-foot.ankle.x)*foot.scale,y:(foot.sole.y-foot.ankle.y)*foot.scale}}
 private landing(id:CullerDriveId,direction:Point){
  const L=this.spec.layout,leg=L.legs[id],rest=add(this.root,leg.sole),nominal={x:rest.x+direction.x*L.stride/4,y:rest.y+direction.y*L.stride/4},offset=this.offset(),hip={x:this.root.x+leg.hip.x,y:this.root.y+leg.hip.y+this.bodyLower},dx=nominal.x-offset.x-hip.x,dy=nominal.y-offset.y-hip.y,d=Math.hypot(dx,dy),planned=Math.max(Math.abs(L.upper-L.lower)+2,Math.min(L.upper+L.lower-2,d)),end={x:hip.x+dx/(d||1)*planned+offset.x,y:hip.y+dy/(d||1)*planned+offset.y}
  this.maxLandingAdjustment=Math.max(this.maxLandingAdjustment,cullerDistance(end,nominal));return{end,nominal}
 }
 update(point:Point,milliseconds:number,disabled:ReadonlySet<string>=new Set(),bodyLower=0){
  this.bodyLower=bodyLower
  const from={...this.root},travel=cullerDistance(from,point),count=Math.max(1,Math.ceil(travel/.15)),seconds=Math.min(.096,Math.max(0,milliseconds/1000)),L=this.spec.layout
  for(let i=1;i<=count;i++){
   this.root=mix(from,point,i/count);const ds=travel/count,dt=seconds/count;this.distance+=ds
   for(const id of cullerDriveIds){const f=this.feet[id],off=disabled.has(id);if(off!==f.disabled){f.disabled=off;f.swing=null;f.anchor=add(this.root,L.legs[id].sole);f.point={...f.anchor};f.epoch++}}
   this.group=this.group.filter(id=>!!this.feet[id].swing)
   const direction={x:(point.x-from.x)/(travel||1),y:(point.y-from.y)/(travel||1)},offset=this.offset(),begin=(id:CullerDriveId)=>{const f=this.feet[id];f.swing={start:{...f.point},...this.landing(id,direction),progress:0};if(!this.group.includes(id))this.group.push(id)}
   const enabled=cullerDriveIds.filter(id=>!this.feet[id].disabled),maxSwing=Math.max(1,Math.floor(enabled.length/2)),threatened=enabled.filter(id=>{const f=this.feet[id],hip=add(this.root,L.legs[id].hip),ankle={x:f.anchor.x-offset.x,y:f.anchor.y-offset.y},d=cullerDistance(hip,ankle);return !f.swing&&(d>L.upper+L.lower-4||d<Math.abs(L.upper-L.lower)+4)})
   if(ds>0&&!this.group.length){const ordinary=tripods[this.nextTripod].filter(id=>!this.feet[id].disabled),ids=[...new Set([...threatened,...ordinary])].slice(0,maxSwing);this.nextTripod=(this.nextTripod+1)%2;for(const id of ids)begin(id)}
   // Finish the raised feet first, then transfer threatened contacts. Healthy
   // six-drive presentation keeps at least three planted pads; no gravity proof.
   if(ds>0)for(const id of threatened)if(!this.feet[id].swing&&this.group.length<maxSwing)begin(id)
   const urgentWaiting=threatened.some(id=>!this.feet[id].swing)
   for(const id of cullerDriveIds){const f=this.feet[id],leg=L.legs[id]
    if(f.disabled){const hip=add(this.root,leg.hip);f.point={x:hip.x+leg.bend.x*2,y:hip.y+6+this.bodyLower};continue}
    const s=f.swing;if(!s){f.point={...f.anchor};continue}
    if(ds>0)Object.assign(s,this.landing(id,direction))
    const hip=add(this.root,leg.hip),ankle={x:f.point.x-offset.x,y:f.point.y-offset.y},extension=cullerDistance(hip,ankle),recovery=Math.max(urgentWaiting?12:1,1+Math.max(0,extension-(L.upper+L.lower-4))*2)
    s.progress=Math.min(1,s.progress+(ds>0?ds/L.swingTravel*recovery:dt/L.settleSeconds));const t=cullerSmooth(s.progress);f.point=mix(s.start,s.end,t)
    if(s.progress>=1){f.point={...s.end};f.anchor={...s.end};f.epoch++;f.swing=null}
   }
  }
  this.root={...point};return this.pose()
 }
 pose(){const L=this.spec.layout,offset=this.offset()
  return{owner:this.owner,root:{...this.root},distance:this.distance,tripod:[...this.group],maxLandingAdjustment:this.maxLandingAdjustment,legs:cullerDriveIds.map(id=>{
   const f=this.feet[id],spec=L.legs[id],lift=f.swing?L.clearance*Math.sin(Math.PI*cullerSmooth(f.swing.progress)):0,rawAnkle={x:f.point.x-offset.x,y:f.point.y-lift-offset.y},base=add(this.root,spec.hip),hip={x:base.x,y:base.y+this.bodyLower},minimum=Math.abs(L.upper-L.lower)+.5,d=cullerDistance(hip,rawAnkle)
   // An airborne recovery curve goes around the fully folded two-link exclusion
   // circle. Keep its unconstrained candidate; stance anchors are never projected.
   const fallback=Math.hypot(spec.bend.x,spec.bend.y)||1,direction=d>1e-9?{x:(rawAnkle.x-hip.x)/d,y:(rawAnkle.y-hip.y)/d}:{x:spec.bend.x/fallback,y:spec.bend.y/fallback}
   const ankle=f.swing&&d<minimum?{x:hip.x+direction.x*minimum,y:hip.y+direction.y*minimum}:rawAnkle,sole={x:ankle.x+offset.x,y:ankle.y+offset.y}
   return{id,ownerId:id,contact:!f.swing&&!f.disabled,disabled:f.disabled,anchor:{...f.anchor},sole,ground:{...f.point},epoch:f.epoch,lift,far:spec.far,mirror:spec.mirror,nominalLanding:f.swing?{...f.swing.nominal}:null,plannedLanding:f.swing?{...f.swing.end}:null,unconstrainedAirAnkle:f.swing?rawAnkle:null,airTrajectoryAdjustment:f.swing?cullerDistance(rawAnkle,ankle):0,...cullerSolve(hip,ankle,L.upper,L.lower,spec.bend)}
  })}
 }
}
export type CullerPose=ReturnType<CullerMotion['pose']>
