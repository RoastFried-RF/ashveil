import {spritePixelHit} from './sprite-hit'
/** Borrowed original textures; this view never owns gameplay, time or atlas lifetimes. */
import {Container,Matrix,Sprite,type Texture} from 'pixi.js'
import {pinMatrix,project,type Point,type RigPose} from './articulated-gait'
export interface RigChassis {texture:Texture;pivot:Point;scale:number;key?:string;registration?:{source:[Point,Point];target:[Point,Point]}}
export interface RigArt {
 textures:Record<'body'|'upper'|'lower'|'foot',Texture>
 body:{pivot:Point;scale:number}
 upper:{proximal:Point;distal:Point;thickness:number}
 lower:{proximal:Point;distal:Point;thickness:number}
 foot:{ankle:Point;scale:number}
}
export class ArticulatedRigView {
 readonly root=new Container({label:'articulated-original-body'})
 private readonly far=new Container({label:'far-drive-legs',sortableChildren:true})
 private readonly near=new Container({label:'near-drive-legs',sortableChildren:true})
 private readonly body:Sprite
 private chassis:RigChassis
 private previousBody:Sprite|null=null
 private previousChassis:RigChassis|null=null
 private bodyMix=1
 private blendSeconds=.12
 private readonly legs=new Map<string,{upper:Sprite;lower:Sprite;foot:Sprite;root:Container}>()
 private readonly sprites:Sprite[]=[]
 constructor(private readonly art:RigArt){
  this.chassis={...art.body,texture:art.textures.body,key:'idle'};this.body=this.sprite(art.textures.body);this.root.addChild(this.far,this.body,this.near)
  for(const id of['LH','LF','RH','RF']){
   const root=new Container({label:id}),upper=this.sprite(art.textures.upper),lower=this.sprite(art.textures.lower),foot=this.sprite(art.textures.foot)
   root.addChild(foot,lower,upper);(id.endsWith('H')?this.far:this.near).addChild(root);this.legs.set(id,{root,upper,lower,foot})
  }
 }
 private sprite(texture:Texture){const s=new Sprite({texture,roundPixels:false});this.sprites.push(s);return s}
 setChassis(chassis:RigChassis,seconds=.12){
  if(this.chassis.texture===chassis.texture)return
  if(!this.previousBody){this.previousBody=this.sprite(this.chassis.texture);this.root.addChildAt(this.previousBody,this.root.getChildIndex(this.body))}
  this.previousChassis=this.chassis;this.previousBody.texture=this.chassis.texture;this.previousBody.tint=this.body.tint;this.previousBody.visible=seconds>0
  this.chassis=chassis;this.body.texture=chassis.texture;this.bodyMix=seconds>0?0:1;this.blendSeconds=Math.max(.001,seconds)
 }
 update(pose:RigPose,origin:Point=pose.root,seconds=0){
  const base=project({...origin,z:0})
  const local=(p:Parameters<typeof project>[0])=>{const q=project(p);return{x:q.x-base.x,y:q.y-base.y}}
  const body=local(pose.body)
  const align=(sprite:Sprite,chassis:RigChassis)=>{
   if(chassis.registration){const {source,target}=chassis.registration,t=target.map(p=>({x:p.x+body.x,y:p.y+body.y})),scale=Math.hypot(target[1].x-target[0].x,target[1].y-target[0].y)/Math.hypot(source[1].x-source[0].x,source[1].y-source[0].y),m=pinMatrix(source[0],source[1],t[0],t[1],scale);sprite.setFromMatrix(new Matrix(m.a,m.b,m.c,m.d,m.e,m.f))}
   else{sprite.position.set(body.x-chassis.pivot.x*chassis.scale,body.y-chassis.pivot.y*chassis.scale);sprite.rotation=0;sprite.skew.set(0);sprite.scale.set(chassis.scale)}
  }
  align(this.body,this.chassis);this.bodyMix=Math.min(1,this.bodyMix+Math.max(0,seconds)/this.blendSeconds);this.body.alpha=this.bodyMix
  if(this.previousBody&&this.previousChassis){align(this.previousBody,this.previousChassis);this.previousBody.alpha=1-this.bodyMix;this.previousBody.visible=this.bodyMix<1}
  for(const leg of pose.legs){
   const view=this.legs.get(leg.id);if(!view)continue
   const group=leg.far?this.far:this.near;if(view.root.parent!==group)group.addChild(view.root);view.root.zIndex=leg.sole.y
   const hip=local(leg.hip),knee=local(leg.knee),ankle=local(leg.ankle)
   for(const [sprite,part,a,b]of [[view.upper,this.art.upper,hip,knee],[view.lower,this.art.lower,knee,ankle]] as const){const m=pinMatrix(part.proximal,part.distal,a,b,part.thickness);sprite.setFromMatrix(new Matrix(m.a,m.b,m.c,m.d,m.e,m.f))}
   view.foot.position.set(ankle.x-this.art.foot.ankle.x*this.art.foot.scale,ankle.y-this.art.foot.ankle.y*this.art.foot.scale);view.foot.scale.set(this.art.foot.scale)
  }
 }
 hit(screen:Point){return this.root.visible&&this.root.alpha>0&&this.sprites.some(sprite=>spritePixelHit(sprite,screen))}
 inspect(){
  const matrix=(sprite:Sprite)=>{const m=sprite.localTransform;return[m.a,m.b,m.c,m.d,m.tx,m.ty]}
  const all:Sprite[]=[];const visit=(node:Container)=>{if(node instanceof Sprite)all.push(node);for(const child of node.children)visit(child)};visit(this.root)
  return{sprites:all.length,liveTextures:all.filter(s=>!s.destroyed&&!s.texture.destroyed&&!s.texture.source.destroyed).length,sourceCount:new Set(all.map(s=>s.texture.source)).size,body:matrix(this.body),chassis:this.chassis.key??'unnamed',chassisBlend:this.bodyMix,legs:Object.fromEntries([...this.legs].map(([id,l])=>[id,{upper:matrix(l.upper),lower:matrix(l.lower),foot:matrix(l.foot)}]))}
 }
 setTint(color:number){for(const sprite of this.sprites)sprite.tint=color}
 /** Release display objects only. Shared atlas originals outlive every instance. */
 destroy(){this.root.destroy({children:true})}
}
