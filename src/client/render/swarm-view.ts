/** Representative individual original sprites, not a literal census or anatomical body. */
import {Container,Sprite,type Texture} from 'pixi.js'
import {advanceWalk,createWalkMotion,observeWalk,resetWalk,walkPosition} from './walk-motion'
import type {Pos} from '../../core/geom'
import type {SwarmState} from '../../core/types'
import type {World} from '../../core/ctx'
export interface SwarmArt {frames:string[];fps:number;anchors?:Record<string,[number,number]>;renderScale?:number;textures:Record<string,Texture>}
export class SwarmView {
 readonly root=new Container({label:'original-moth-colony'})
 private readonly insects:{sprite:Sprite;phase:number;angle:number;frame:string}[]=[]
 private readonly motion:ReturnType<typeof createWalkMotion>
 private time=0
 private shown=false
 private tileVisible=false
 private displayAlpha=0
 private lastCount=0
 private lastCohesion=100
 private state:SwarmState
 private readonly clip:SwarmArt
 constructor(state:SwarmState,art:SwarmArt){
  this.state=state;this.motion=createWalkMotion(state.pos);this.clip=art
  if(!this.clip.frames.length)throw Error('군체의 원래 비행 포즈가 필요하다')
  for(let i=0;i<48;i++){const sprite=new Sprite(this.clip.textures[this.clip.frames[0]]);this.root.addChild(sprite);const n=((Math.imul(state.uid+1,1103515245)+Math.imul(i+1,12345))>>>0)/4294967296;this.insects.push({sprite,phase:n*1000+i*71,angle:i*2.399963229728653,frame:''})}
 }
 sync(w:World,state:SwarmState,visible:ReadonlySet<number>,moves:readonly {from:Pos;to:Pos}[]=[]){
  this.tileVisible=visible.has(state.pos.y*w.s.map.w+state.pos.x)
  const shown=this.tileVisible&&state.members>0&&state.cohesion>0
  if(!this.shown&&shown)resetWalk(this.motion,state.pos);else if(shown)observeWalk(this.motion,state.pos,moves)
  this.shown=shown;this.state=state;this.root.visible=this.tileVisible&&(shown||this.displayAlpha>0)
  if(!this.tileVisible){this.displayAlpha=0;this.root.alpha=0}
 }
 update(w:World,dt:number,visible:ReadonlySet<number>,instant=false){
  if(!this.tileVisible)return
  const target=this.shown?Math.min(1,this.state.cohesion/50):0;this.displayAlpha=instant?target:this.displayAlpha+Math.sign(target-this.displayAlpha)*Math.min(Math.abs(target-this.displayAlpha),Math.max(0,dt)/160);this.root.alpha=this.displayAlpha;this.root.visible=this.displayAlpha>0;if(!this.root.visible)return
  if(!instant)this.time+=Math.max(0,dt)
  advanceWalk(this.motion,dt,instant,180);const p=walkPosition(this.motion),density=this.state.members/this.state.initialMembers*this.state.cohesion/100,count=this.shown?Math.min(48,Math.max(1,Math.ceil(density*48))):this.lastCount,cohesion=this.shown?this.state.cohesion:this.lastCohesion
  if(this.shown){this.lastCount=count;this.lastCohesion=cohesion}
  this.root.position.set(p.x*16+8,p.y*16+14);this.root.alpha=this.displayAlpha
  for(const [i,bug]of this.insects.entries()){
   const t=(this.time+bug.phase)/1000,r=Math.sqrt((i+.5)/count)*(16+8*(1-cohesion/100)),angle=bug.angle+t*.7,x=Math.cos(angle)*r+Math.sin(t*1.9+bug.phase)*2,y=Math.sin(angle)*r*.7-22+Math.cos(t*1.4+bug.phase)*3
   const grid={x:Math.floor((this.root.x+x)/16),y:Math.floor((this.root.y+y)/16)},inside=grid.x>=0&&grid.y>=0&&grid.x<w.s.map.w&&grid.y<w.s.map.h,index=grid.y*w.s.map.w+grid.x
   bug.sprite.visible=i<count&&inside&&visible.has(index)&&!w.db.terrain(w.s.map.tiles[index].t).wall
   if(!bug.sprite.visible)continue
   const indexFrame=Math.floor((this.time+bug.phase)*this.clip.fps/1000)%this.clip.frames.length,key=this.clip.frames[indexFrame]
   if(key!==bug.frame){bug.frame=key;bug.sprite.texture=this.clip.textures[key];bug.sprite.anchor.set(...(this.clip.anchors?.[key]??[.5,.5]))}
   bug.sprite.scale.set((this.clip.renderScale??.012)*.65*(.75+((i*7)%11)/22));bug.sprite.position.set(x,y);bug.sprite.rotation=angle+Math.PI/2;bug.sprite.alpha=.65+(i%5)*.06
  }
 }
 inspect(){return{uid:this.state.uid,visible:this.root.visible,center:walkPosition(this.motion),representativeSprites:this.root.visible?this.insects.filter(b=>b.sprite.visible).length:0,originalFrames:[...new Set(this.insects.filter(b=>b.sprite.visible).map(b=>b.frame))],tracked:this.insects.slice(0,3).map((b,i)=>({id:i,frame:b.frame,x:b.sprite.x,y:b.sprite.y,visible:b.sprite.visible})),authoredDirections:1,runtimeRotation:true}}
 destroy(){this.root.destroy({children:true})}
}
