/** Borrowed source parts, six actual motor owners and two separately owned scythes. */
import {Container,Graphics,Matrix,Sprite,type Texture} from 'pixi.js'
import {spritePixelHit} from './sprite-hit'
import {CullerMotion,cullerDistance,cullerPinMatrix,cullerSmooth,cullerSolve,type CullerPose} from './culler-motion'
import {cullerDriveIds,cullerToolParts,type CullerAttackKind,type CullerDir,type CullerDirectionSpec,type CullerPoint as Point,type CullerSpec,type CullerToolId} from './culler-spec'
export interface CullerPartState {missing:boolean;damage:number;efficiency:number}
export interface CullerPresentation {direction:CullerDir;alive:boolean;prone:boolean;cooling:boolean;action:string;phase:number;attackMode?:string;attackVector:Point;attackDistance:number;flash:number;tint:number;parts:Readonly<Record<string,CullerPartState>>}
export interface CullerArt {spec:CullerSpec;textures:Record<string,Texture>}
type Clip={x:number;y:number;w:number;h:number}
type Angles=[number,number]
export interface CullerToolSnapshot {id:CullerToolId;arm:string;blade:string;stage:string;active:boolean;shoulder:Point;elbow:Point;tip:Point;angles:Angles;armVisible:boolean;bladeVisible:boolean;disabled:boolean;contactError:number|null;contactTarget:Point|null}
const blend=(a:Angles,b:Angles,t:number):Angles=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
const point=(base:Point,length:number,angle:number):Point=>({x:base.x+length*Math.cos(angle),y:base.y+length*Math.sin(angle)})
const selectedAttack=(spec:CullerSpec,state:CullerPresentation)=>['attack','shoot','throw'].includes(state.action)?spec.attackTools[state.attackMode??'']:undefined
const bodyLower=(spec:CullerDirectionSpec,state:CullerPresentation)=>(!state.alive||state.prone?cullerSmooth(state.phase):state.action==='rise'?1-cullerSmooth(state.phase):0)*spec.layout.deathLower
class CullerFacingView {
 readonly root=new Container({label:'culler-source-facing',sortableChildren:true})
 private readonly shadow=new Graphics()
 private readonly faults=new Graphics()
 private readonly effect=new Graphics()
 private readonly body:Sprite
 private readonly legs=new Map<string,{root:Container;upper:Sprite;lower:Sprite;foot:Sprite}>()
 private readonly tools=new Map<CullerToolId,{root:Container;upper:Sprite;blade:Sprite;angles:Angles;active:boolean;stage:string;elbow:Point;tip:Point}>()
 private readonly sprites:Sprite[]=[]
 private lastTools:CullerToolSnapshot[]=[]
 private effectKind:CullerAttackKind|null=null
 private clock=0
 private cooling=false
 constructor(readonly direction:CullerDir,readonly spec:CullerDirectionSpec,private readonly art:CullerArt){
  const sprite=(key:string)=>{const s=new Sprite({texture:art.textures[key],roundPixels:false});this.sprites.push(s);return s}
  this.shadow.zIndex=-5;this.root.addChild(this.shadow)
  for(const id of cullerDriveIds){const root=new Container({label:id}),upper=sprite(spec.art.driveUpper.frame),lower=sprite(spec.art.driveLower.frame),foot=sprite(spec.art.foot.frame);root.zIndex=spec.layout.legs[id].far?-3:2;root.addChild(foot,lower,upper);this.root.addChild(root);this.legs.set(id,{root,upper,lower,foot})}
  this.body=sprite(spec.art.chassis.frame);this.body.zIndex=0;this.root.addChild(this.body)
  for(const id of ['left','right'] as const){const source=spec.layout.tools[id],root=new Container({label:id+'-scythe'}),upper=sprite(spec.art.scytheUpper.frame),blade=sprite(spec.art.scytheBlade.frame);root.zIndex=source.far?-1:3;root.addChild(blade,upper);this.root.addChild(root);this.tools.set(id,{root,upper,blade,angles:[...source.guard],active:false,stage:'guard',elbow:{x:0,y:0},tip:{x:0,y:0}})}
  this.faults.zIndex=4;this.effect.zIndex=5;this.root.addChild(this.faults,this.effect)
 }
 update(pose:CullerPose,state:CullerPresentation,attack:CullerAttackKind|undefined,milliseconds:number,instant:boolean){
  const S=this.spec,A=S.art,L=S.layout,local=(p:Point)=>({x:p.x-pose.root.x,y:p.y-pose.root.y}),lower=bodyLower(S,state)
  this.clock+=instant?0:Math.max(0,milliseconds);this.cooling=state.cooling&&state.alive&&!state.prone
  const tint=(id:string)=>{if(state.tint!==0xffffff)return state.tint;if(state.flash>0)return state.flash>.5?0xffb6a1:0xe89075;if(!state.alive)return 0x7f7768;const d=Math.max(0,Math.min(1,state.parts[id]?.damage??0));return(Math.round(255-d*62)<<16)|(Math.round(255-d*110)<<8)|Math.round(255-d*134)}
  const set=(sprite:Sprite,m:ReturnType<typeof cullerPinMatrix>)=>sprite.setFromMatrix(new Matrix(m.a,m.b,m.c,m.d,m.e,m.f))
  const b=A.chassis,hurt=state.action==='hurt'?Math.sin(state.phase*Math.PI)*.6:0;this.body.position.set(b.offset.x-b.pivot.x*b.scale+hurt,b.offset.y-b.pivot.y*b.scale+lower);this.body.scale.set(b.scale);this.body.tint=tint('Chassis');this.body.visible=!state.parts.Chassis?.missing
  this.shadow.clear()
  for(const leg of pose.legs){
   const display=this.legs.get(leg.id)!,hip=local(leg.hip),knee=local(leg.knee),end=local(leg.end),sole=local(leg.sole);display.root.visible=!state.parts[leg.id]?.missing&&!state.parts.Chassis?.missing
   // Dying body lowers independently; remaining drives retain their actual ownership.
   set(display.upper,cullerPinMatrix(A.driveUpper.proximal,A.driveUpper.distal,hip,knee,leg.mirror));set(display.lower,cullerPinMatrix(A.driveLower.proximal,A.driveLower.distal,knee,end,leg.mirror));display.foot.position.set(end.x-A.foot.ankle.x*A.foot.scale,end.y-A.foot.ankle.y*A.foot.scale);display.foot.scale.set(A.foot.scale)
   display.upper.tint=display.lower.tint=display.foot.tint=tint(leg.id)
   if(display.root.visible)this.shadow.ellipse(sole.x,sole.y,3,1).fill({color:0,alpha:leg.contact?.25:.1})
  }
  this.lastTools=[]
  for(const id of ['left','right'] as const){
   const source=L.tools[id],display=this.tools.get(id)!,[arm,blade]=cullerToolParts(id),off=!state.alive||state.prone||state.parts[arm]?.efficiency===0||state.parts[blade]?.efficiency===0
   const active=attack===id&&!off,shoulder={x:source.shoulder.x+hurt,y:source.shoulder.y+lower},guard=source.guard
   let angles:Angles=guard,stage='guard',contactError:number|null=null,contactTarget:Point|null=null
   if(off){angles=source.dead;stage=state.alive?'disabled':'dead'}
   else if(active){
    const target={x:state.attackVector.x*16,y:state.attackVector.y*16-9},contact=cullerSolve(shoulder,target,source.upper,source.blade,{x:source.shoulder.x||1,y:1}),contactAngles:Angles=[Math.atan2(contact.knee.y-shoulder.y,contact.knee.x-shoulder.x),Math.atan2(contact.end.y-contact.knee.y,contact.end.x-contact.knee.x)],p=Math.max(0,Math.min(1,state.phase))
    contactError=contact.error;contactTarget=target
    if(p<.28){angles=blend(guard,source.windup,cullerSmooth(p/.28));stage='windup'}else if(p<.40){angles=blend(source.windup,contactAngles,cullerSmooth((p-.28)/.05));stage='contact'}else if(p<.64){angles=blend(contactAngles,source.follow,cullerSmooth((p-.40)/.24));stage='follow'}else{angles=blend(source.follow,guard,cullerSmooth((p-.64)/.36));stage='recover'}
   }
   if(active||instant){display.angles=[...angles]}
   else{const amount=1-Math.exp(-Math.max(0,milliseconds)/120);display.angles=blend(display.angles,angles,amount);if(!off&&display.angles.some((a,i)=>Math.abs(a-guard[i])>.01))stage='interruptedRecover'}
   display.active=active;display.stage=stage;display.elbow=point(shoulder,source.upper,display.angles[0]);display.tip=point(display.elbow,source.blade,display.angles[1])
   display.upper.visible=!state.parts[arm]?.missing&&!state.parts.Chassis?.missing;display.blade.visible=display.upper.visible&&!state.parts[blade]?.missing
   set(display.upper,cullerPinMatrix(A.scytheUpper.proximal,A.scytheUpper.distal,shoulder,display.elbow,source.mirror));set(display.blade,cullerPinMatrix(A.scytheBlade.proximal,A.scytheBlade.tip,display.elbow,display.tip,source.mirror));display.upper.tint=tint(arm);display.blade.tint=tint(blade)
   this.lastTools.push({id,arm,blade,stage,active,shoulder,elbow:{...display.elbow},tip:{...display.tip},angles:[...display.angles],armVisible:display.upper.visible,bladeVisible:display.blade.visible,disabled:off,contactError,contactTarget})
  }
  this.faults.clear()
  if(this.cooling){const alpha=.35+Math.sin(this.clock/700)*.12;for(let n=0;n<3;n++)this.faults.moveTo(A.chassis.offset.x-2,A.chassis.offset.y+n+lower).lineTo(A.chassis.offset.x+2,A.chassis.offset.y+n+lower).stroke({color:0x91a399,width:.5,alpha})}
  for(const [id,p]of Object.entries({SensorHead:L.emitters.acid,AcidTank:{x:0,y:L.emitters.acid.y-8},NetLauncher:L.emitters.net,PowerCore:{x:0,y:b.offset.y},CoolingLoop:{x:3,y:b.offset.y-3},ControlCircuit:{x:-3,y:b.offset.y-3},OpticalSensor:L.emitters.acid,AcousticSensor:{x:-5,y:b.offset.y},ThermalSensor:{x:5,y:b.offset.y},Antenna:{x:0,y:b.offset.y-10}}))if(state.parts[id]?.missing||state.parts[id]?.damage>.3){const color=state.parts[id]?.missing?0x6b392b:0xa67842;this.faults.moveTo(p.x-1,p.y-1+lower).lineTo(p.x+1,p.y+1+lower).moveTo(p.x-1,p.y+1+lower).lineTo(p.x+1,p.y-1+lower).stroke({color,width:.65})}
  this.effect.clear();this.effectKind=null
  if(state.alive&&!state.prone&&!instant&&(attack==='acid'||attack==='net')&&state.phase>.25&&state.phase<.8){
   const required=attack==='acid'?'AcidTank':'NetLauncher'
   if(!state.parts[required]?.missing&&state.parts[required]?.efficiency!==0){
    this.effectKind=attack;const at=L.emitters[attack],target={x:state.attackVector.x*16*state.attackDistance,y:state.attackVector.y*16*state.attackDistance-9},dx=target.x-at.x,dy=target.y-at.y,length=Math.hypot(dx,dy)||1,v={x:dx/length,y:dy/length},t=Math.max(0,Math.min(1,(state.phase-.25)/.4)),travel=length*cullerSmooth(t),center={x:at.x+v.x*travel,y:at.y+v.y*travel},normal={x:-v.y,y:v.x}
    if(attack==='acid'){for(let i=0;i<9;i++){const q=(i+1)/9,spread=Math.sin(i*2.3)*q*3,along=travel*q;this.effect.moveTo(at.x+v.x*along+normal.x*spread,at.y+v.y*along+normal.y*spread).lineTo(at.x+v.x*(along+1)+normal.x*spread,at.y+v.y*(along+1)+normal.y*spread).stroke({color:0x8b9b68,width:.6,alpha:1-t*.45})}}
    else{const size=2+3*t,u={x:.7071,y:.35355},v={x:-.7071,y:.35355},at=(a:number,b:number)=>({x:center.x+u.x*a+v.x*b,y:center.y+u.y*a+v.y*b});for(let i=-2;i<=2;i++){const offset=i*size/2,a=at(-size,offset),b=at(size,offset),c=at(offset,-size),d=at(offset,size);this.effect.moveTo(a.x,a.y).lineTo(b.x,b.y).moveTo(c.x,c.y).lineTo(d.x,d.y)}this.effect.stroke({color:0xb1a889,width:.35,alpha:1-t*.25})}
   }
  }
 }
 hit(screen:Point){return this.sprites.some(s=>s.visible&&s.parent?.visible&&spritePixelHit(s,screen))}
 headY(){const b=this.spec.art.chassis;return b.offset.y-b.pivot.y*b.scale-2}
 inspect(){return{direction:this.direction,sourceFrame:this.spec.art.chassis.frame,drawInstances:this.sprites.length,visibleDrawInstances:this.sprites.filter(s=>s.visible&&s.parent?.visible).length,liveTextures:this.sprites.filter(s=>!s.destroyed&&!s.texture.destroyed&&!s.texture.source.destroyed).length,tools:structuredClone(this.lastTools),effect:this.effectKind,cooling:this.cooling,body:{x:this.body.x,y:this.body.y,scale:this.body.scale.x}}}
 destroy(){this.root.destroy({children:true})}
}
export class CullerView {
 readonly root=new Container({label:'six-drive-two-scythe-culler'})
 private readonly content=new Container()
 private readonly mask=new Graphics()
 private current:{direction:CullerDir;motion:CullerMotion;view:CullerFacingView;pose:CullerPose}|null=null
 private outgoing:{view:CullerFacingView;remaining:number}|null=null
 private clips:Clip[]|null=null
 private resetNext=true
 private wasInstant=false
 private maxReachError=0
 private observedRoot:Point={x:0,y:0}
 private state:CullerPresentation|null=null
 private readonly radius:number
 constructor(private readonly art:CullerArt){this.root.addChild(this.content,this.mask);this.radius=Math.max(...Object.values(art.spec.directions).map(d=>{const L=d.layout,b=d.art.chassis,t=art.textures[b.frame];return Math.max(Math.hypot(b.offset.x,b.offset.y)+Math.max(t.width,t.height)*b.scale,...Object.values(L.tools).map(p=>Math.hypot(p.shoulder.x,p.shoulder.y)+p.upper+p.blade),...Object.values(L.legs).map(p=>Math.hypot(p.hip.x,p.hip.y)+L.upper+L.lower))}))+4}
 reset(){this.resetNext=true}
 update(point:Point,state:CullerPresentation,milliseconds:number,instant=false){
  const prior=this.current,teleport=!!prior&&cullerDistance(point,prior.pose.root)>64,instantReset=instant&&(!this.wasInstant||!!prior&&cullerDistance(point,prior.pose.root)>1e-7);this.wasInstant=instant
  if(!prior||prior.direction!==state.direction||this.resetNext||teleport||instantReset){
   this.outgoing?.view.destroy();this.outgoing=null
   if(prior){if(!this.resetNext&&!teleport&&!instant)this.outgoing={view:prior.view,remaining:120};else prior.view.destroy()}
   const direction=state.direction,spec=this.art.spec.directions[direction],motion=new CullerMotion(spec,point),view=new CullerFacingView(direction,spec,this.art);this.content.addChild(view.root);this.current={direction,motion,view,pose:motion.pose()};this.resetNext=false;this.maxReachError=0
  }
  const current=this.current!,off=new Set(cullerDriveIds.filter(id=>state.parts[id]?.missing||state.parts[id]?.efficiency===0));if(!state.alive||state.prone)for(const id of cullerDriveIds)off.add(id)
  const lower=bodyLower(this.art.spec.directions[state.direction],state)
  current.pose=current.motion.update(point,instant?0:milliseconds,off,lower);this.observedRoot={...point};this.maxReachError=Math.max(this.maxReachError,...current.pose.legs.map(l=>l.error));current.view.update(current.pose,state,selectedAttack(this.art.spec,state),milliseconds,instant)
  this.state=state
  if(this.outgoing){this.outgoing.remaining=Math.max(0,this.outgoing.remaining-milliseconds);this.outgoing.view.root.alpha=this.outgoing.remaining/120;current.view.root.alpha=1-this.outgoing.remaining/120;if(this.outgoing.remaining===0){this.outgoing.view.destroy();this.outgoing=null}}else current.view.root.alpha=1
 }
 setClip(rects:Clip[]|null){this.clips=rects;this.mask.clear();if(rects===null){this.content.mask=null;return}for(const r of rects)this.mask.rect(r.x,r.y,r.w,r.h);this.mask.fill(0xffffff);this.content.mask=this.mask}
 hit(screen:Point){if(!this.root.visible||this.root.alpha<=0)return false;const p=this.root.toLocal(screen);if(this.clips&&!this.clips.some(r=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h))return false;return !!(this.current?.view.root.alpha&&this.current.view.hit(screen)||this.outgoing?.view.root.alpha&&this.outgoing.view.hit(screen))}
 headY(){return this.current?.view.headY()??-60}
 clipRadius(){return Math.max(this.radius,16*(this.state?.attackDistance??1)+16)}
 get sourceFrame(){return this.current?.view.spec.art.chassis.frame??''}
 inspect(){if(!this.current)return null;return{...this.current.view.inspect(),root:{...this.observedRoot},owner:this.current.pose.owner,pose:structuredClone(this.current.pose),maxReachError:this.maxReachError,transition:!!this.outgoing,transitionInstances:this.outgoing?23:0,parts:structuredClone(this.state?.parts??{}),action:this.state?.action,attackMode:this.state?.attackMode,sourcePNGs:4,sourceRegions:24,authoredDirections:4,authoredFullBodyWalkFrames:0,clipRects:this.clips?.map(r=>({...r}))??null,limits:['view-specific2D layouts, new contact owner at facing switch','hidden physical axes and opposite surfaces unverified','BACK appendages and toe/heel direction unproven','baked chassis sensors/tank are marked damaged, not independently detached art','no true3D collision or stability proof']}}
 destroy(){this.content.mask=null;this.current?.view.destroy();this.outgoing?.view.destroy();this.current=null;this.outgoing=null;this.root.destroy({children:true})}
}
