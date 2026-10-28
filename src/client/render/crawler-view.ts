/** Shared game/public-viewer display. It owns sprites, never Core state or borrowed textures. */
import {Container,Graphics,Matrix,Sprite,type Texture} from 'pixi.js'
import {spritePixelHit} from './sprite-hit'
import {CrawlerMotion,crawlerBodyMatrix,crawlerDistance,crawlerForward,crawlerPinMatrix,type CrawlerPose} from './crawler-motion'
import {crawlerPartIds,type CrawlerPoint as Point,type CrawlerSpec} from './crawler-spec'
export interface CrawlerArt {spec:CrawlerSpec;textures:Record<string,Texture>}
export interface CrawlerPartState {missing:boolean;damage:number;mobility?:number}
export interface CrawlerPresentation {
 heading:number;mode:'floor'|'ceiling';alive:boolean;prone:boolean
 action:string;phase:number;attack:Point;flash:number;tint:number
 parts:Readonly<Record<string,CrawlerPartState>>
}
type Clip={x:number;y:number;w:number;h:number}
export class CrawlerView {
 readonly root=new Container({label:'conduit-crawler'})
 private readonly content=new Container({label:'crawler-source-instances'})
 private readonly shadow=new Graphics()
 private readonly clip=new Graphics()
 private readonly head:Sprite
 private readonly bodies:Sprite[]=[]
 private readonly legs:{upper:Sprite;lower:Sprite}[]=[]
 private readonly sprites:Sprite[]=[]
 private motion:CrawlerMotion|null=null
 private pose:CrawlerPose|null=null
 private needsReset=true
 private wasInstant=false
 private lift=0
 private ceiling=false
 private clipRects:Clip[]|null=null
 private frame=''
 private state:CrawlerPresentation|null=null
 private maxReachError=0
 constructor(private readonly art:CrawlerArt){
  this.root.addChild(this.shadow,this.content,this.clip)
  const sprite=(frame:string)=>{const s=new Sprite({texture:art.textures[frame],roundPixels:false});this.content.addChild(s);this.sprites.push(s);return s}
  for(let i=0;i<16;i++)this.legs.push({lower:sprite(art.spec.art.lower.frame),upper:sprite(art.spec.art.upper.frame)})
  for(let i=7;i>=0;i--)this.bodies[i]=sprite((i===7?art.spec.art.tail:art.spec.art.middle).frame)
  this.head=sprite(art.spec.art.headClosed.frame)
 }
 reset(){this.needsReset=true}
 /** World pixel root corresponds exactly to the game's interpolated actor anchor. */
 update(point:Point,state:CrawlerPresentation,milliseconds:number,instant=false){
  const teleport=!!this.motion&&crawlerDistance(point,this.motion.root)>48,instantReset=instant&&(!this.wasInstant||!!this.motion&&crawlerDistance(point,this.motion.root)>1e-7);this.wasInstant=instant
  if(!this.motion||this.needsReset||teleport||instantReset){this.motion=new CrawlerMotion(this.art.spec,point,state.heading);this.needsReset=false;this.maxReachError=0}
  const disabled=new Set(crawlerPartIds.filter(id=>state.parts[id]?.missing||state.parts[id]?.damage>=1||state.parts[id]?.mobility===0));if(!state.alive||state.prone)for(const id of crawlerPartIds)disabled.add(id)
  this.pose=this.motion.update(point,state.heading,instant?0:milliseconds,disabled);this.state=state;this.ceiling=state.alive&&state.mode==='ceiling'
  const target=this.ceiling?this.art.spec.layout.ceilingLift:0,amount=Math.max(0,milliseconds)/200;this.lift=instant?target:this.lift+Math.sign(target-this.lift)*Math.min(Math.abs(target-this.lift),this.art.spec.layout.ceilingLift*amount)
  this.content.y=-this.lift;this.content.alpha=this.ceiling?.85:1
  const local=(p:Point)=>({x:p.x-point.x,y:p.y-point.y}),set=(sprite:Sprite,m:ReturnType<typeof crawlerBodyMatrix>)=>sprite.setFromMatrix(new Matrix(m.a,m.b,m.c,m.d,m.e,m.f))
  const shade=(id:string)=>{
   if(state.tint!==0xffffff)return state.tint
   if(state.flash>0)return state.flash>.5?0xffb0a0:0xe99988
   if(!state.alive)return 0x867568
   const d=Math.max(0,Math.min(1,state.parts[id]?.damage??0)),r=Math.round(255-d*66),g=Math.round(255-d*130),b=Math.round(255-d*144);return(r<<16)|(g<<8)|b
  }
  const L=this.art.spec.layout,A=this.art.spec.art
  this.shadow.clear()
  for(const [i,body]of this.pose.bodies.entries()){
   const source=i===7?A.tail:A.middle,p=local(body.position),sprite=this.bodies[i];sprite.visible=!state.parts[body.id]?.missing
   // Hurt/death use the existing body plates. No invented authored fall or underside frames.
   if(state.action==='hurt'&&state.alive)p.x+=Math.sin(state.phase*Math.PI)*.3*(i%2?1:-1)
   set(sprite,crawlerBodyMatrix(source.pivot,p,body.heading,L.bodyScale));sprite.tint=shade(body.id)
   if(sprite.visible)this.shadow.ellipse(p.x,p.y,3.4,1.5).fill({color:0,alpha:this.ceiling?.13:state.alive?.23:.12})
  }
  for(const [i,leg]of this.pose.legs.entries()){
   const display=this.legs[i],visible=!state.parts[leg.id]?.missing&&!state.parts[leg.ownerId]?.missing;display.upper.visible=visible;display.lower.visible=visible
   const mirror=leg.side<0;set(display.upper,crawlerPinMatrix(A.upper.proximal,A.upper.distal,local(leg.hip),local(leg.knee),mirror));set(display.lower,crawlerPinMatrix(A.lower.proximal,A.lower.distal,local(leg.knee),local(leg.end),mirror));display.upper.tint=display.lower.tint=shade(leg.id)
   this.maxReachError=Math.max(this.maxReachError,leg.error)
  }
  const jawOpen=state.alive&&['attack','work','use'].includes(state.action)&&state.phase>=.16&&state.phase<.72,source=jawOpen?A.headOpen:A.headClosed;this.frame=source.frame;this.head.texture=this.art.textures[source.frame];this.head.visible=!state.parts.Head?.missing
  const thrust=state.alive&&state.action==='attack'?Math.sin(Math.min(1,state.phase)*Math.PI)*1.4:0,F=crawlerForward(state.heading),headPoint={x:F.x*thrust,y:F.y*thrust}
  set(this.head,crawlerBodyMatrix(source.pivot,headPoint,state.heading,L.headScale));this.head.tint=shade('Head')
 }
 /** Root-local visible floor rectangles. Both drawing and pointer hits use this same mask. */
 setClip(rects:Clip[]|null){this.clipRects=rects;this.clip.clear();if(rects===null){this.content.mask=null;this.shadow.mask=null;return}for(const r of rects)this.clip.rect(r.x,r.y,r.w,r.h);this.clip.fill(0xffffff);this.content.mask=this.clip;this.shadow.mask=this.clip}
 hit(screen:Point){if(!this.root.visible||this.root.alpha<=0)return false;const p=this.root.toLocal(screen);if(this.clipRects&&!this.clipRects.some(r=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h))return false;return this.sprites.some(sprite=>spritePixelHit(sprite,screen))}
 headY(){return this.content.getLocalBounds().minY-this.lift-2}
 clipRadius(){const L=this.art.spec.layout;return L.firstOffset+6*L.pitch+L.tailOffset+L.upper+L.lower+L.headScale*this.art.textures[this.art.spec.art.headClosed.frame].height+L.ceilingLift}
 get sourceFrame(){return this.frame}
 inspect(){
  if(!this.pose)return null
  const hidden=(id:string)=>!!this.state?.parts[id]?.missing
  return{sourceFrame:this.frame,sourceRegions:6,sourcePngs:1,authoredDirections:1,authoredFullBodyWalkFrames:0,sharedDrawInstances:41,owner:this.pose.owner,root:{...this.pose.root},distance:this.pose.distance,mode:this.ceiling?'ceiling':'floor',lift:this.lift,clipRects:this.clipRects?.map(r=>({...r}))??null,maxReachError:this.maxReachError,body:this.pose.bodies.map(b=>({...b,visible:!hidden(b.id),damage:this.state?.parts[b.id]?.damage??0})),headVisible:!hidden('Head'),legs:this.pose.legs.map(l=>({...l,visible:!hidden(l.id)&&!hidden(l.ownerId),damage:this.state?.parts[l.id]?.damage??0,mobility:this.state?.parts[l.id]?.mobility??1})),liveTextures:this.sprites.filter(s=>!s.destroyed&&!s.texture.destroyed&&!s.texture.source.destroyed).length,limitations:['one dorsal source rotated/reflected','projected sockets and free hooktip contact proxy','2D kinematics; not physical3D stability or limb collision']}
 }
 /** Texture lifetime belongs to atlas/viewer owners, not these borrowed instances. */
 destroy(){this.content.mask=null;this.shadow.mask=null;this.root.destroy({children:true});this.motion=null;this.pose=null}
}
