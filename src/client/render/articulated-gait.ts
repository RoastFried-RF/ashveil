/** Client-only FRONT rig experiment. World rules never depend on this pose. */
export type Point = {x:number;y:number}
export type Vec3 = Point & {z:number}
export type LegId = 'LH'|'LF'|'RH'|'RF'
export const LEG_ORDER:readonly LegId[] = ['LH','LF','RH','RF']
const PROJECTION = Math.SQRT1_2
export const project = (p:Vec3):Point => ({x:p.x,y:(p.y-p.z)*PROJECTION})
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z})
const mul=(v:Vec3,n:number):Vec3=>({x:v.x*n,y:v.y*n,z:v.z*n})
const sub=(a:Vec3,b:Vec3)=>add(a,mul(b,-1))
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z
const length=(v:Vec3)=>Math.hypot(v.x,v.y,v.z)
const unit=(v:Vec3)=>mul(v,1/(length(v)||1))
const blend=(a:Vec3,b:Vec3,t:number)=>add(mul(a,1-t),mul(b,t))
const smooth=(n:number)=>{const t=Math.min(1,Math.max(0,n));return t*t*(3-2*t)}

/** Fixed physical links; only the projection foreshortens their source axes. */
export function solveTwoLink(hip:Vec3,ankle:Vec3,upper:number,lower:number,bend:Vec3){
 if(!(upper>0&&lower>0))throw Error('관절 길이는 양수여야 합니다')
 const delta=sub(ankle,hip),requestedDistance=length(delta),axis=requestedDistance>1e-9?unit(delta):{x:0,y:0,z:-1}
 const distance=Math.min(upper+lower-1e-7,Math.max(Math.abs(upper-lower)+1e-7,requestedDistance))
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance)
 let normal=sub(bend,mul(axis,dot(bend,axis)))
 if(length(normal)<1e-7){const fallback=Math.abs(axis.x)<.8?{x:1,y:0,z:0}:{x:0,y:1,z:0};normal=sub(fallback,mul(axis,dot(fallback,axis)))}
 const knee=add(hip,add(mul(axis,along),mul(unit(normal),Math.sqrt(Math.max(0,upper*upper-along*along)))))
 const end=add(hip,mul(axis,distance))
 return{hip,knee,ankle:end,requestedAnkle:ankle,unreachable:Math.abs(requestedDistance-distance)>1e-5,error:length(sub(end,ankle))}
}

/** Affine canvas/Pixi matrix maps both opaque source pins exactly to joints. */
export function pinMatrix(sourceA:Point,sourceB:Point,targetA:Point,targetB:Point,thickness:number){
 const sx=sourceB.x-sourceA.x,sy=sourceB.y-sourceA.y,sourceLength=Math.hypot(sx,sy)
 if(sourceLength<1e-8||thickness<=0)throw Error('유효한 원화 핀과 두께가 필요합니다')
 const dx=targetB.x-targetA.x,dy=targetB.y-targetA.y,targetLength=Math.hypot(dx,dy)
 // Collapse only the longitudinal axis if a link points into the camera.
 const tx=targetLength>1e-9?dx/targetLength:1,ty=targetLength>1e-9?dy/targetLength:0
 const ux=sx/sourceLength,uy=sy/sourceLength,longitudinal=targetLength/sourceLength
 const a=tx*longitudinal*ux+ty*thickness*uy,b=ty*longitudinal*ux-tx*thickness*uy
 const c=tx*longitudinal*uy-ty*thickness*ux,d=ty*longitudinal*uy+tx*thickness*ux
 return{a,b,c,d,e:targetA.x-a*sourceA.x-c*sourceA.y,f:targetA.y-b*sourceA.x-d*sourceA.y}
}

export interface ArticulatedLayout {
 stride:number;swingTravel:number;swingSeconds:number;clearance:number;upper:number;lower:number
 hipHeight:number;ankleHeight:number;soleX:number;com:Point
 legs:Record<LegId,{hip:Point;sole:Point;side:number;far:boolean}>
}
export const RIG = {
 stride:20, swingTravel:5, swingSeconds:.32, clearance:3.2,
 upper:17.5,lower:17.5,soleX:.33,com:{x:0,y:-3/PROJECTION},hipHeight:23/PROJECTION,ankleHeight:4.62/PROJECTION,
 // Rear hips are inferred, not newly observed source joints.
 legs:{
  RF:{hip:{x:-14.91,y:0},sole:{x:-21,y:0},side:-1,far:false},
  LF:{hip:{x:14.91,y:0},sole:{x:21,y:0},side:1,far:false},
  RH:{hip:{x:-10,y:-4/PROJECTION},sole:{x:-15,y:-6/PROJECTION},side:-1,far:true},
  LH:{hip:{x:10,y:-4/PROJECTION},sole:{x:15,y:-6/PROJECTION},side:1,far:true},
 } satisfies Record<LegId,{hip:Point;sole:Point;side:number;far:boolean}>,
} as const satisfies ArticulatedLayout
export type RigLeg = ReturnType<typeof solveTwoLink> & {id:LegId;sole:Vec3;contact:boolean;far:boolean}
export type RigPose = {root:Point;body:Vec3;legs:RigLeg[];distance:number;swing:LegId|null;supportMargin:number}
type Swing = {id:LegId;start:Vec3;end:Vec3;at:number;progress:number}

/** Convex ground contact hull; an inside pad must not create a concave edge. */
export function contactHull(points:readonly Point[]):Point[]{
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),unique=sorted.filter((p,i)=>!i||p.x!==sorted[i-1].x||p.y!==sorted[i-1].y)
 const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
 const half=(list:Point[])=>{const h:Point[]=[];for(const p of list){while(h.length>=2&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p)}return h}
 if(unique.length<3)return unique
 return[...half(unique).slice(0,-1),...half([...unique].reverse()).slice(0,-1)]
}
/** Signed ground-plane margin: positive inside, zero at an edge. */
export function supportMargin(points:readonly Point[],center:Point):number{
 const hull=contactHull(points)
 if(hull.length<3)return -Infinity
 return Math.min(...hull.map((a,i)=>{const b=hull[(i+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y;return(dx*(center.y-a.y)-dy*(center.x-a.x))/(Math.hypot(dx,dy)||1)}))
}
function supportedCenter(points:readonly Point[],desired:Point):Point{
 if(supportMargin(points,desired)>=.5)return desired
 const hull=contactHull(points),centroid={x:hull.reduce((n,p)=>n+p.x,0)/hull.length,y:hull.reduce((n,p)=>n+p.y,0)/hull.length}
 let closest={...desired},best=Infinity
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((desired.x-a.x)*dx+(desired.y-a.y)*dy)/(dx*dx+dy*dy||1))),p={x:a.x+dx*t,y:a.y+dy*t},d=Math.hypot(p.x-desired.x,p.y-desired.y);if(d<best){closest=p;best=d}}
 return{x:closest.x*.85+centroid.x*.15,y:closest.y*.85+centroid.y*.15}
}

export class ArticulatedGait {
 private root:Point
 private heading:Point
 private distance=0
 private nextStart=0
 private nextLeg=0
 private swing:Swing|null=null
 private feet:Record<LegId,Vec3>
 constructor(root:Point={x:0,y:0},heading:Point={x:0,y:1},private readonly layout:ArticulatedLayout=RIG){
  this.root={...root};const n=Math.hypot(heading.x,heading.y);this.heading=n?{x:heading.x/n,y:heading.y/n}:{x:0,y:1}
  // An honestly staggered initial rest stance avoids teleporting three feet
  // into a synthetic steady cycle on the first movement input.
  this.feet=Object.fromEntries(LEG_ORDER.map((id,i)=>{const rest=this.layout.legs[id].sole,lead=-(this.layout.stride-this.layout.swingTravel)/2+i*this.layout.swingTravel;return[id,{x:root.x+rest.x+this.heading.x*lead,y:root.y+rest.y+this.heading.y*lead,z:0}]})) as Record<LegId,Vec3>
 }
 /** Presentation substeps prevent a long frame from skipping a contact change. */
 update(root:Point,seconds:number):RigPose{
  if(![root.x,root.y,seconds].every(Number.isFinite)||seconds<0)throw Error('유한한 이동/시간이 필요합니다')
  const dx=root.x-this.root.x,dy=root.y-this.root.y,travel=Math.hypot(dx,dy)
  // A teleport/restore has a new owner: construct a fresh rig instead of dragging feet.
  if(travel>64)throw Error('순간 이동 시 새 관절 소유자를 생성해야 합니다')
  const steps=Math.max(1,Math.ceil(travel/.25)),start={...this.root}
  if(travel>1e-8)this.heading={x:dx/travel,y:dy/travel}
  for(let i=1;i<=steps;i++){
   this.root={x:start.x+dx*i/steps,y:start.y+dy*i/steps};this.distance+=travel/steps
   if(!this.swing&&travel>1e-8&&this.distance>=this.nextStart){
    const id=LEG_ORDER[this.nextLeg],rest=this.layout.legs[id].sole,lead=(this.layout.stride-this.layout.swingTravel)/2
    this.swing={id,start:{...this.feet[id]},end:{x:this.root.x+rest.x+this.heading.x*lead,y:this.root.y+rest.y+this.heading.y*lead,z:0},at:this.distance,progress:0}
    this.nextStart=this.distance+this.layout.swingTravel;this.nextLeg=(this.nextLeg+1)%4
   }
   const swing=this.swing
   if(swing){
    swing.progress=Math.min(1,Math.max(swing.progress,(this.distance-swing.at)/this.layout.swingTravel)+(travel<1e-8?seconds/steps/this.layout.swingSeconds:0))
    const p=smooth((swing.progress-.18)/.64),foot=blend(swing.start,swing.end,p)
    foot.z=p===0||p===1?0:this.layout.clearance*Math.sin(Math.PI*p);this.feet[swing.id]=foot
    if(swing.progress>=1){this.feet[swing.id]={...swing.end};this.swing=null}
   }
  }
  return this.pose()
 }
 pose():RigPose{
  const phase=this.swing?.progress??0,raised=!!this.swing&&phase>.18&&phase<.82
  const contacts=LEG_ORDER.filter(id=>!raised||id!==this.swing?.id).map(id=>this.feet[id])
  const baseline={x:this.root.x+this.layout.com.x,y:this.root.y+this.layout.com.y}
  const full=supportedCenter(LEG_ORDER.map(id=>({...this.feet[id],z:0})),baseline)
  let offset={x:full.x-baseline.x,y:full.y-baseline.y}
  if(this.swing){
   const support=LEG_ORDER.filter(id=>id!==this.swing!.id).map(id=>this.feet[id])
   const target=supportedCenter(support,full)
   const weight=phase<.18?smooth(phase/.18):phase>.82?smooth((1-phase)/.18):1
   offset={x:full.x-baseline.x+(target.x-full.x)*weight,y:full.y-baseline.y+(target.y-full.y)*weight}
  }
  const body={x:this.root.x+offset.x,y:this.root.y+offset.y,z:this.layout.hipHeight}
  // Balance and reach are simultaneous constraints. A sharp turn must not
  // stretch a fixed link or render a planted pad at a different world point.
  for(let pass=0;pass<32;pass++){
   let correction=0
   for(const id of LEG_ORDER){
    const hip=this.layout.legs[id].hip,sole=this.feet[id],height=this.layout.hipHeight-sole.z-this.layout.ankleHeight,maxLength=this.layout.upper+this.layout.lower-.001
    const radius=Math.sqrt(Math.max(0,maxLength*maxLength-height*height)),center={x:sole.x-this.layout.soleX-hip.x,y:sole.y-hip.y},dx=body.x-center.x,dy=body.y-center.y,d=Math.hypot(dx,dy)
    if(d>radius){const old={x:body.x,y:body.y};body.x=center.x+dx*radius/d;body.y=center.y+dy*radius/d;correction=Math.max(correction,Math.hypot(body.x-old.x,body.y-old.y))}
   }
   const com={x:body.x+this.layout.com.x,y:body.y+this.layout.com.y}
   if(supportMargin(contacts,com)<0){const supported=supportedCenter(contacts,com);body.x+=supported.x-com.x;body.y+=supported.y-com.y;correction=Math.max(correction,Math.hypot(supported.x-com.x,supported.y-com.y))}
   if(correction<1e-8)break
  }
  const legs=LEG_ORDER.map(id=>{const spec=this.layout.legs[id],hip=add(body,{...spec.hip,z:0}),sole=this.feet[id]
   const ankle={x:sole.x-this.layout.soleX,y:sole.y,z:sole.z+this.layout.ankleHeight}
   return{id,sole:{...sole},contact:!raised||id!==this.swing?.id,far:spec.far,...solveTwoLink(hip,ankle,this.layout.upper,this.layout.lower,{x:spec.side,y:0,z:0})}
  })
  return{root:{...this.root},body,legs,distance:this.distance,swing:this.swing?.id??null,supportMargin:supportMargin(contacts,{x:body.x+this.layout.com.x,y:body.y+this.layout.com.y})}
 }
}
