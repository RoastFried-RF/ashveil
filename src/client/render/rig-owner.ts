/** Per-visible-actor presentation owner. It borrows atlas textures and never edits the world. */
import {Container,Graphics} from 'pixi.js'
import {ArticulatedGait,project,type Point,type RigPose} from './articulated-gait'
import {ArticulatedRigView,type RigArt,type RigChassis} from './articulated-rig-view'
import {tex,type Dir} from './atlas'
import type {RigSpec} from './rig-spec'
type Model={art:RigArt;layout:RigSpec['directions'][Dir]['layout'];idle:RigChassis;work:RigChassis[];frames:string[];idleFrame:string}
export class RigOwner {
 readonly root=new Container({label:'visible-actor-rig-owner'})
 private readonly shadow=new Graphics()
 private readonly models:Record<Dir,Model>
 private current:{dir:Dir;model:Model;view:ArticulatedRigView;gait:ArticulatedGait;pose:RigPose;point:Point}|null=null
 private outgoing:{view:ArticulatedRigView;remaining:number}|null=null
 private needsReset=true
 private wasInstant=false
 private sourceFrame=''
 constructor(spec:RigSpec){
  this.root.addChild(this.shadow)
  const prepare=(dir:Dir):Model=>{
   const d=spec.directions[dir],art:RigArt={textures:{body:tex(d.art.body.frame),upper:tex(d.art.upper.frame),lower:tex(d.art.lower.frame),foot:tex(d.art.foot.frame)},body:d.art.body,upper:d.art.upper,lower:d.art.lower,foot:d.art.foot}
   return{art,layout:d.layout,idle:{...d.art.body,texture:art.textures.body,key:'idle'},work:d.work.map(f=>({...f,texture:tex(f.frame)})),frames:d.work.map(f=>f.frame),idleFrame:d.art.body.frame}
  }
  this.models={down:prepare('down'),left:prepare('left'),right:prepare('right'),up:prepare('up')}
 }
 reset(){this.needsReset=true}
 update(dir:Dir,screen:Point,workPhase:number|null,milliseconds:number,instant=false){
  const point={x:screen.x,y:screen.y/Math.SQRT1_2},model=this.models[dir],old=this.current
  const teleport=!!old&&Math.hypot(point.x-old.point.x,point.y-old.point.y)>64
  const instantReset=instant&&(!this.wasInstant||!old||Math.hypot(point.x-old.point.x,point.y-old.point.y)>1e-7);this.wasInstant=instant
  if(!old||old.dir!==dir||this.needsReset||teleport||instantReset){
   this.outgoing?.view.destroy();this.outgoing=null
   if(old){if(!this.needsReset&&!teleport&&!instant){this.outgoing={view:old.view,remaining:120}}else old.view.destroy()}
   const heading={down:{x:0,y:1},up:{x:0,y:-1},left:{x:-1,y:0},right:{x:1,y:0}}[dir],gait=new ArticulatedGait(point,heading,model.layout),view=new ArticulatedRigView(model.art)
   this.root.addChild(view.root);this.current={dir,model,view,gait,pose:gait.pose(),point};this.needsReset=false
  }
  const c=this.current!,seconds=Math.max(0,milliseconds)/1000
  c.pose=c.gait.update(point,instant?0:seconds);c.point=point
  if(workPhase!==null&&model.work.length){const index=Math.min(model.work.length-1,Math.floor(Math.max(0,Math.min(1,workPhase))*model.work.length));c.view.setChassis(model.work[index],instant?0:.12);this.sourceFrame=model.frames[index]}
  else{c.view.setChassis(model.idle,instant?0:.12);this.sourceFrame=model.idleFrame}
  c.view.update(c.pose,point,instant?1:seconds)
  if(this.outgoing){this.outgoing.remaining=Math.max(0,this.outgoing.remaining-milliseconds);this.outgoing.view.root.alpha=this.outgoing.remaining/120;c.view.root.alpha=1-this.outgoing.remaining/120;if(!this.outgoing.remaining){this.outgoing.view.destroy();this.outgoing=null}}
  else c.view.root.alpha=1
  this.shadow.clear();const center=project({...point,z:0})
  for(const leg of c.pose.legs){const p=project({...leg.sole,z:0});this.shadow.ellipse(p.x-center.x,p.y-center.y-1,5,1.7).fill({color:0,alpha:leg.contact?.35:.13})}
 }
 setTint(color:number){this.current?.view.setTint(color);this.outgoing?.view.setTint(color)}
 hit(screen:Point){return this.root.visible&&this.root.alpha>0&&!!(this.current?.view.hit(screen)||this.outgoing?.view.hit(screen))}
 get frame(){return this.sourceFrame}
 headY(){return this.current?.view.root.getLocalBounds().minY??-50}
 inspect(){return this.current?{frame:this.sourceFrame,direction:this.current.dir,pose:structuredClone(this.current.pose),display:this.current.view.inspect(),transition:!!this.outgoing}:null}
 destroy(){this.current?.view.destroy();this.outgoing?.view.destroy();this.current=null;this.outgoing=null;this.root.destroy({children:true})}
}
