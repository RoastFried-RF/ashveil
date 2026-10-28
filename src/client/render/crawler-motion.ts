/** Distance history follows the supplied interpolated actor exactly. No independent root steering. */
import {crawlerBodyId,crawlerLegId,type CrawlerPoint as Point,type CrawlerSpec} from './crawler-spec'
type TrailPoint=Point&{s:number}
type Swing={start:Point;end:Point;progress:number}
interface Leg {id:string;ownerId:string;index:number;side:number;nextLift:number;anchor:Point;foot:Point;epoch:number;swing:Swing|null;disabled:boolean}
export interface CrawlerBody {id:string;index:number;position:Point;heading:number}
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y}),sub=(a:Point,b:Point):Point=>({x:a.x-b.x,y:a.y-b.y}),mul=(a:Point,n:number):Point=>({x:a.x*n,y:a.y*n})
export const crawlerDistance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const mix=(a:Point,b:Point,t:number)=>add(mul(a,1-t),mul(b,t))
const smooth=(t:number)=>t*t*t*(10+t*(-15+6*t))
export const crawlerForward=(heading:number)=>({x:Math.cos(heading),y:Math.sin(heading)})
const right=(heading:number)=>({x:-Math.sin(heading),y:Math.cos(heading)})
export function crawlerTwoLink(hip:Point,foot:Point,u:number,l:number,back:Point){
 const v=sub(foot,hip),requested=Math.hypot(v.x,v.y),axis=requested>1e-9?mul(v,1/requested):{x:1,y:0},d=Math.max(Math.abs(u-l)+1e-7,Math.min(u+l-1e-7,requested))
 const along=(u*u-l*l+d*d)/(2*d),h=Math.sqrt(Math.max(0,u*u-along*along));let normal={x:-axis.y,y:axis.x};if(normal.x*back.x+normal.y*back.y<0)normal=mul(normal,-1)
 const knee=add(hip,add(mul(axis,along),mul(normal,h))),end=add(hip,mul(axis,d))
 return{hip,knee,end,error:crawlerDistance(end,foot),unreachable:Math.abs(requested-d)>1e-5}
}
/** Both source registration points map exactly; reflection only shares the dorsal drawing. */
export function crawlerPinMatrix(a:Point,b:Point,A:Point,B:Point,mirror=false){
 const sv=sub(b,a),tv=sub(B,A),sl=Math.hypot(sv.x,sv.y),tl=Math.hypot(tv.x,tv.y),u=mul(sv,1/sl),v={x:-u.y,y:u.x},t=mul(tv,1/(tl||1)),n={x:-t.y,y:t.x},scale=tl/sl,sign=mirror?-1:1
 const m={a:scale*(t.x*u.x+sign*n.x*v.x),b:scale*(t.y*u.x+sign*n.y*v.x),c:scale*(t.x*u.y+sign*n.x*v.y),d:scale*(t.y*u.y+sign*n.y*v.y),e:0,f:0};m.e=A.x-m.a*a.x-m.c*a.y;m.f=A.y-m.b*a.x-m.d*a.y;return m
}
export function crawlerBodyMatrix(pivot:Point,target:Point,heading:number,scale:number){const R=right(heading),F=crawlerForward(heading),m={a:R.x*scale,b:R.y*scale,c:-F.x*scale,d:-F.y*scale,e:0,f:0};m.e=target.x-m.a*pivot.x-m.c*pivot.y;m.f=target.y-m.b*pivot.x-m.d*pivot.y;return m}
let owners=0
export class CrawlerMotion {
 readonly owner=++owners
 root:Point
 heading:number
 distance=0
 private readonly trail:TrailPoint[]=[]
 private readonly legs:Leg[]=[]
 constructor(private readonly spec:CrawlerSpec,point:Point,heading:number){
  this.root={...point};this.heading=heading
  const F=crawlerForward(heading),span=this.span()
  for(let s=-span;s<0;s+=.5)this.trail.push({...add(point,mul(F,s)),s});this.trail.push({...point,s:0})
  const bodies=this.bodies(),L=spec.layout
  for(let i=0;i<8;i++)for(const side of [-1,1]){const phase=(i*2+(side<0?0:9))%16,nextLift=phase*L.stride/16,body=bodies[i],anchor=add(this.nominal(body,side),mul(crawlerForward(body.heading),nextLift-(L.stride-L.swingTravel)/2));this.legs.push({id:crawlerLegId(i,side),ownerId:body.id,index:i,side,nextLift,anchor,foot:{...anchor},epoch:0,swing:null,disabled:false})}
 }
 private span(){return this.spec.layout.firstOffset+7*this.spec.layout.pitch+this.spec.layout.stride*3}
 private sample(s:number):Point{
  const a=this.trail;if(s<=a[0].s){const first=a[0],next=a[1],length=crawlerDistance(first,next)||1;return add(first,mul(sub(next,first),(s-first.s)/length))}
  if(s>=this.distance)return {...this.root}
  let lo=0,hi=a.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(a[m].s>s)hi=m;else lo=m}return mix(a[lo],a[hi],(s-a[lo].s)/(a[hi].s-a[lo].s))
 }
 bodies():CrawlerBody[]{const L=this.spec.layout;return Array.from({length:8},(_,i)=>{const s=this.distance-L.firstOffset-(i<7?i*L.pitch:6*L.pitch+L.tailOffset),position=this.sample(s),before=this.sample(s-L.pitch*.2),after=this.sample(s+L.pitch*.2);return{id:crawlerBodyId(i),index:i,position,heading:Math.atan2(after.y-before.y,after.x-before.x)}})}
 hip(body:CrawlerBody,side:number){const art=body.index===7?this.spec.art.tail:this.spec.art.middle,p=side<0?art.left:art.right;const m=crawlerBodyMatrix(art.pivot,body.position,body.heading,this.spec.layout.bodyScale);return{x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}}
 private nominal(body:CrawlerBody,side:number){return add(this.hip(body,side),mul(right(body.heading),side*this.spec.layout.outreach))}
 private step(ds:number,seconds:number,disabled:ReadonlySet<string>){
  const L=this.spec.layout,bodies=this.bodies()
  for(const leg of this.legs){const body=bodies[leg.index],off=disabled.has(leg.id)||disabled.has(body.id);if(off!==leg.disabled){leg.swing=null;leg.disabled=off;leg.anchor=this.nominal(body,leg.side);leg.foot={...leg.anchor};leg.epoch++}}
  let swinging=this.legs.filter(l=>l.swing).length
  const pending=this.legs.filter(l=>!l.swing&&!l.disabled).map(l=>({l,body:bodies[l.index],d:crawlerDistance(this.hip(bodies[l.index],l.side),l.anchor)})).sort((a,b)=>b.d-a.d)
  if(ds>0)for(const p of pending)if((this.distance>=p.l.nextLift||p.d>L.upper+L.lower-1.1)&&swinging<8){const lead=(L.stride-L.swingTravel)/2+L.swingTravel;p.l.swing={start:{...p.l.foot},end:add(this.nominal(p.body,p.l.side),mul(crawlerForward(p.body.heading),lead)),progress:0};p.l.nextLift=this.distance+L.stride;swinging++}
  for(const leg of this.legs){
   const body=bodies[leg.index]
   if(leg.disabled){leg.foot=add(this.hip(body,leg.side),mul(right(body.heading),leg.side*L.outreach*.35));continue}
   const s=leg.swing;if(!s){leg.foot={...leg.anchor};continue}
   // A real game corner is not curvature-limited. Recover toward the current body's
   // reachable forefoot target rather than planting the stale pre-corner target.
   if(ds>0)s.end=add(this.nominal(body,leg.side),mul(crawlerForward(body.heading),(L.stride-L.swingTravel)/2+L.swingTravel))
   const extension=crawlerDistance(this.hip(body,leg.side),leg.foot),recovery=1+Math.max(0,extension-(L.upper+L.lower-2))*2
   s.progress=Math.min(1,s.progress+(ds>0?ds/L.swingTravel*recovery:seconds/L.settleSeconds));const t=smooth(s.progress),out=mul(right(body.heading),leg.side*.54*Math.sin(Math.PI*t));leg.foot=add(mix(s.start,s.end,t),out)
   if(s.progress>=1){leg.foot={...s.end};leg.anchor={...s.end};leg.epoch++;leg.swing=null}
  }
 }
 update(point:Point,heading:number,milliseconds:number,disabled:ReadonlySet<string>=new Set()){
  const from=this.root,travel=crawlerDistance(point,from),steps=Math.max(1,Math.ceil(travel/.12)),seconds=Math.max(0,Math.min(.096,milliseconds/1000));this.heading=heading
  for(let j=1;j<=steps;j++){const next=mix(from,point,j/steps),ds=crawlerDistance(this.root,next);this.root=next;if(ds>1e-9){this.distance+=ds;this.trail.push({...next,s:this.distance});while(this.trail.length>2&&this.trail[1].s<this.distance-this.span())this.trail.shift()}this.step(ds,seconds/steps,disabled)}
  // Exact supplied root, including on diagonal and abrupt game turns.
  this.root={...point};return this.pose()
 }
 pose(){const bodies=this.bodies(),L=this.spec.layout;return{owner:this.owner,root:{...this.root},heading:this.heading,distance:this.distance,bodies,legs:this.legs.map(l=>{const body=bodies[l.index],hip=this.hip(body,l.side);return{...l,anchor:{...l.anchor},foot:{...l.foot},contact:!l.swing&&!l.disabled,...crawlerTwoLink(hip,l.foot,L.upper,L.lower,mul(crawlerForward(body.heading),-1))}})}}
}
export type CrawlerPose=ReturnType<CrawlerMotion['pose']>
