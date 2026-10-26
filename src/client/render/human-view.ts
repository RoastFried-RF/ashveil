/** Visible actor's original-part paperdoll. Textures are borrowed; the world is read-only. */
import {Container,Graphics,Matrix,Sprite} from 'pixi.js'
import {tex} from './atlas'
import {spritePixelHit} from './sprite-hit'
import {HumanGait,type HumanGaitPose} from './human-gait'
import {hAt,hClip,hHalfPlane,hPin,hSoleMatrix,hTransform,hTwoLink,hpAdd,hpLength,hpMix,hpSub,humanPose,type HMatrix,type HPoint,type HumanPose,type HumanPoseInput} from './human-model'
import type {HumanClothingState,HumanSurface} from './human-state'
import type {HumanPoint,HumanSide,HumanSource,HumanSpec} from './human-spec'
import {humanEndpointOwner,humanWithHead} from './human-spec'
interface DrawNode {root:Container;sprite:Sprite;mask:Graphics;clip:HPoint[]|null;owner:string;uid?:number;role:string;frame:string}
interface Input extends Omit<HumanPoseInput,'hands'> {dtMs:number;instant:boolean;tint:number;alpha:number;unknown:boolean}
const sides=['left','right']as const
const partName=(side:HumanSide)=>side==='left'?'Left':'Right'
const rgb=(a:number,b:number)=>(((a>>16&255)*(b>>16&255)/255)<<16)|(((a>>8&255)*(b>>8&255)/255)<<8)|((a&255)*(b&255)/255)
function inside(p:HumanPoint,polygon:readonly HumanPoint[]){let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result}return result}
export class HumanView {
 readonly root=new Container({label:'actual-owned-human-parts',sortableChildren:true})
 private readonly gait=new HumanGait()
 private readonly nodes=new Map<string,DrawNode>()
 private surface:HumanSurface|null=null
 private input:Input|null=null
 private pose:HumanPose|null=null
 private gaitPose:HumanGaitPose|null=null
 private handTargets:Partial<Record<HumanSide,HumanPoint>>={}
 private used=new Set<string>()
 constructor(readonly spec:HumanSpec,readonly headRole?:string){this.spec=humanWithHead(spec,headRole)}
 sync(surface:HumanSurface|undefined){this.surface=surface??null}
 reset(){this.gait.reset();this.pose=null;this.gaitPose=null}
 prepare(input:Input){
  this.input=input;this.handTargets={};if(!this.surface)return
  const supported=(side:HumanSide)=>!input.prone&&input.alive&&['Thigh','Shin','Foot'].every(suffix=>{const p=this.surface!.parts[partName(side)+suffix];return !!p?.present&&p.efficiency>0})
  this.gaitPose=this.gait.update({root:{x:input.root[0],y:input.root[1]},facing:input.direction,moving:input.moving&&!input.prone,dtMs:input.instant?0:input.dtMs,instant:input.instant,available:{left:supported('left'),right:supported('right')}})
  this.solve()
 }
 private solve(){if(this.input&&this.gaitPose){const footMounts:Partial<Record<HumanSide,HumanPoint>>={};for(const side of sides){const replacement=this.surface?.parts[partName(side)+'Foot']?.replacement,source=replacement?.root===partName(side)+'Foot'?this.spec.replacements[replacement.def]?.distal:undefined;if(source?.solePinned)footMounts[side]=hTransform(hSoleMatrix(source,[0,0],this.soleMirror(side)),source.a)}this.pose=humanPose(this.spec.base[this.input.direction],{...this.input,hands:this.handTargets,footMounts},{left:this.gaitPose.left,right:this.gaitPose.right})}}
 private soleMirror(side:HumanSide){return this.input?.direction==='right'||(this.input?.direction==='down'||this.input?.direction==='up')&&side==='right'}
 grip(side:HumanSide):HPoint{return this.pose?.grips[side]??[0,-12]}
 handDepth(side:HumanSide){return this.pose?.bones[partName(side)+'Hand'].z??52}
 usable(side:HumanSide){const p=this.surface?.parts[partName(side)+'Hand'];return !!p?.present&&p.efficiency>0}
 /** Keep a held item's actual grip within the same source arm's reachable chain. */
 handTarget(side:HumanSide,target:HumanPoint):HPoint{
  if(!this.pose||!this.input)return [...target]
  const base=this.spec.base[this.input.direction],u=base.upper[side],f=base.forearm[side],a=this.pose.shoulders[side],end=hTwoLink(a,target,hpLength(hpSub(u.b,u.a))*.052,hpLength(hpSub(f.b,f.a))*.052,side==='left'?1:-1).end
  this.handTargets[side]=end;this.solve();return end
 }
 private dimensions(source:HumanSource){const t=tex(source.frame);return{w:t.width,h:t.height}}
 private rectangle(source:HumanSource):HPoint[]{const{w,h}=this.dimensions(source);return[[0,0],[w,0],[w,h],[0,h]]}
 private sourceBand(source:HumanSource,low:number,high:number){
  let polygon=this.rectangle(source);const normal=hpSub(source.b,source.a)
  if(Number.isFinite(low))polygon=hClip(polygon,hpMix(source.a,source.b,low),normal,true)
  if(Number.isFinite(high))polygon=hClip(polygon,hpMix(source.a,source.b,high),normal,false)
  return polygon
 }
 private emit(key:string,owner:string,source:HumanSource,matrix:HMatrix,z:number,clip:HPoint[]|null=null,uid?:number,role='flesh',tint=0xffffff){
  const input=this.input!;if(clip&&clip.length<3)return
  let node=this.nodes.get(key)
  if(!node){const root=new Container(),sprite=new Sprite(tex(source.frame)),mask=new Graphics();root.addChild(sprite,mask);node={root,sprite,mask,clip:null,owner,uid,role,frame:source.frame};this.nodes.set(key,node);this.root.addChild(root)}
  const sprite=node.sprite;node.owner=owner;node.uid=uid;node.role=role;node.frame=source.frame;node.clip=clip;node.root.visible=true;node.root.zIndex=z;node.root.setFromMatrix(new Matrix(...matrix));sprite.texture=tex(source.frame);sprite.tint=rgb(tint,input.unknown?0x202028:input.tint)
  node.mask.clear();if(clip){node.mask.poly(clip.flat()).fill(0xffffff);sprite.mask=node.mask}else sprite.mask=null
  this.used.add(key)
 }
 private flesh(owner:string,source:HumanSource,matrix:HMatrix,z:number,clip:HPoint[]|null=null){
  const part=this.surface?.parts[owner];if(!part?.flesh)return
  const tint=part.damage>.6?0xb38d82:part.damage>.2?0xd6b9aa:0xffffff;this.emit('base:'+owner,owner,source,matrix,z,clip,undefined,owner.endsWith('Thigh')||owner.endsWith('Shin')?'intrinsic-underclothing':'flesh',tint)
 }
 render(style?:{tint:number;alpha:number}){
  const input=this.input,pose=this.pose,surface=this.surface;if(!input||!pose||!surface){this.root.visible=false;return}
  if(style){input.tint=style.tint;input.alpha=style.alpha}
  this.root.visible=true;this.root.alpha=input.alpha;this.root.rotation=(input.prone||!input.alive)?Math.PI/2*input.fall:0;this.root.y=(input.prone||!input.alive)?-2*input.fall:0;this.used=new Set()
  const dir=input.direction,base=this.spec.base[dir],headSize=this.dimensions(base.head),torsoSize=this.dimensions(base.torso),clothing=surface.clothing.filter(c=>this.spec.wardrobe[c.def]),coveredHand=(side:HumanSide)=>clothing.some(c=>!c.half&&this.spec.wardrobe[c.def].hands&&c.parts.includes(partName(side)+'Hand')),coveredFoot=(side:HumanSide)=>clothing.some(c=>!c.half&&this.spec.wardrobe[c.def].feet&&c.parts.includes(partName(side)+'Foot'))
  this.flesh('Chest',base.torso,pose.torso,30,[[0,0],[torsoSize.w,0],[torsoSize.w,base.torso.chestEnd],[0,base.torso.chestEnd]])
  this.flesh('Abdomen',base.torso,pose.torso,30,[[0,base.torso.chestEnd],[torsoSize.w,base.torso.chestEnd],[torsoSize.w,base.torso.waist],[0,base.torso.waist]])
  this.flesh('Pelvis',base.torso,pose.torso,31,[[0,base.torso.waist],[torsoSize.w,base.torso.waist],[torsoSize.w,torsoSize.h],[0,torsoSize.h]])
  this.flesh('Skull',base.head,pose.head,70)
  for(const side of sides){
   const Side=partName(side),upper=base.upper[side],forearm=base.forearm[side],leg=base.legs[side],foot=base.foot,u=pose.bones[Side+'UpperArm'],f=pose.bones[Side+'Forearm'],h=pose.bones[Side+'Hand'],t=pose.bones[Side+'Thigh'],s=pose.bones[Side+'Shin'],p=pose.bones[Side+'Foot'],fs=this.dimensions(forearm),ls=this.dimensions(leg),ps=this.dimensions(foot),wristNormal=forearm.split?.normal??hpSub(forearm.b,forearm.a),legNormal=hpSub(leg.b,leg.a),footNormal=foot.split?.normal??hpSub(foot.b,foot.a)
   this.flesh(Side+'UpperArm',upper,u.matrix,u.z)
   this.flesh(Side+'Forearm',forearm,f.matrix,f.z,hHalfPlane(fs.w,fs.h,forearm.wrist,wristNormal,false))
   if(!coveredHand(side))this.flesh(Side+'Hand',forearm,h.matrix,h.z,hHalfPlane(fs.w,fs.h,forearm.wrist,wristNormal,true))
   this.flesh(Side+'Thigh',leg,t.matrix,t.z,hHalfPlane(ls.w,ls.h,leg.knee,legNormal,false))
   this.flesh(Side+'Shin',leg,s.matrix,s.z,hHalfPlane(ls.w,ls.h,leg.knee,legNormal,true))
   if(!coveredFoot(side))this.flesh(Side+'Foot',foot,p.matrix,p.z,hHalfPlane(ps.w,ps.h,foot.a,footNormal,true))
  }
  for(const state of clothing)this.drawClothing(state)
  this.drawReplacements()
  for(const state of surface.accessories){
   if(this.spec.wardrobe[state.def]?.accessory==='quiver'){if(surface.parts.Chest?.present)this.drawAccessory(state.uid,'quiver',0xffffff);continue}
   const ring=state.slot==='ring1'?'right':state.slot==='ring2'?'left':undefined,point=ring?pose.grips[ring]:hpAdd(pose.neck,[0,3]),owner=ring?partName(ring)+'Hand':'Neck'
   if(!surface.parts[owner]?.present)continue
   const source:HumanSource={frame:state.sprite,a:[0,0],b:[0,1]},size=this.dimensions(source),scale=(ring?1.3:2.3)/Math.max(size.w,size.h);source.a=[size.w*.5,size.h*.4]
   this.emit('jewel:'+state.uid,owner,source,hAt(source.a,point,scale),ring?60:42,null,state.uid,'accessory')
  }
  // Opaque hood/helmet lining stays in its original image. The actual face occludes it.
  const headCover=clothing.some(c=>['hood','helmet'].includes(this.spec.wardrobe[c.def].accessory??'')&&surface.parts.Skull?.present)
  if(headCover&&dir!=='up'&&surface.parts.Skull?.flesh){const w=headSize.w,h=headSize.h,clip=base.head.face?.map(p=>[p[0],p[1]]as HPoint)??[[w*.3,h*.38],[w*.7,h*.38],[w*.82,h*.56],[w*.82,h*.9],[w*.18,h*.9],[w*.18,h*.56]]as HPoint[];this.emit('face','Skull',base.head,pose.head,74,clip,undefined,'face-occlusion')}
  // Face-mounted objects belong in front of the face, including while a hood is worn.
  for(const state of clothing){const kind=this.spec.wardrobe[state.def].accessory;if(kind==='mask'||kind==='goggles')this.drawAccessory(state.uid,kind,this.spec.wardrobe[state.def].tint??0xffffff)}
  for(const[key,node]of this.nodes)if(!this.used.has(key)){node.root.destroy({children:true});this.nodes.delete(key)}
 }
 private drawClothing(state:HumanClothingState){
  const pose=this.pose!,input=this.input!,base=this.spec.base[input.direction],rule=this.spec.wardrobe[state.def],tint=rule.tint??0xffffff,owns=(owner:string)=>state.parts.includes(owner)&&!!this.surface!.parts[owner]?.present
  if(rule.torso){
   const source=this.spec.pieces[rule.torso][input.direction],waist=hTransform(pose.torso,[base.torso.a[0],base.torso.waist]),target=state.half?hpAdd(pose.neck,[1.3,2]):pose.neck,end=state.half?hpAdd(waist,[1.3,2]):waist,length=hpLength(hpSub(end,target)),scale=length/Math.max(1,hpLength(hpSub(source.b,source.a))),matrix=hPin(source,target,end,scale),span=waist[1]-pose.neck[1],chest=hTransform(pose.torso,[base.torso.a[0],base.torso.chestEnd])[1],hip=pose.hip[1]
   const bands:[string,number,number][]=[['Chest',-Infinity,(chest-pose.neck[1])/span],['Abdomen',(chest-pose.neck[1])/span,1.03],['Pelvis',1.03,rule.torso==='apron'?Infinity:(hip+1-pose.neck[1])/span]]
   for(const[owner,low,high]of bands)if(owns(owner))this.emit('wear:'+state.uid+':'+owner,owner,source,matrix,32+state.layer*.3,this.sourceBand(source,low,high),state.uid,'clothing',this.conditionTint(tint,state.durability[owner]))
   if(rule.torso==='coat')for(const side of sides){const owner=partName(side)+'Thigh';if(!owns(owner))continue;const size=this.dimensions(source),polygon=this.sourceBand(source,(hip+1-pose.neck[1])/span,Infinity),left=input.direction==='up'?side==='left':side==='right',mid=(source.a[0]+source.b[0])/2,clip=hClip(polygon,[mid,0],[1,0],!left);this.emit('wear:'+state.uid+':tail:'+side,owner,source,matrix,31.5+state.layer*.3,clip.length?clip:[[0,0],[size.w,0],[0,0]],state.uid,'clothing',tint)}
  }
  for(const side of sides){
   const Side=partName(side)
   for(const[kind,owner,fraction]of [[rule.upper,Side+'UpperArm',rule.upper==='upperCloth'?.7:1],[rule.forearm,Side+'Forearm',1],[rule.hands,Side+'Hand',1]]as const){
    if(!kind||!owns(owner)||state.half&&side==='right')continue
    const source=this.spec.pieces[kind][input.direction],bone=pose.bones[owner],end=owner.endsWith('Forearm')?pose.bones[Side+'Hand'].a:bone.b,b=hpMix(bone.a,end,fraction),uniform=hpLength(hpSub(b,bone.a))/Math.max(1,hpLength(hpSub(source.b,source.a)))
    this.emit('wear:'+state.uid+':'+owner,owner,source,hPin(source,bone.a,b,uniform),bone.z+.3+state.layer*.1,null,state.uid,'clothing',this.conditionTint(tint,state.durability[owner]))
   }
   if(rule.feet){const source=this.spec.pieces.boot[input.direction],bone=pose.bones[Side+'Foot'],uniform=hpLength(hpSub(bone.b,bone.a))/Math.max(1,hpLength(hpSub(source.b,source.a))),matrix=hPin(source,bone.a,bone.b,uniform),size=this.dimensions(source),normal=hpSub(source.b,source.a);for(const[suffix,distal]of [['Shin',false],['Foot',true]]as const){const owner=Side+suffix;if(owns(owner))this.emit('wear:'+state.uid+':'+owner,owner,source,matrix,bone.z+.5+state.layer*.1,hHalfPlane(size.w,size.h,source.a,normal,distal),state.uid,'clothing',this.conditionTint(tint,state.durability[owner]))}}
  }
  if(rule.accessory&&!['mask','goggles','quiver'].includes(rule.accessory))this.drawAccessory(state.uid,rule.accessory,tint)
 }
 private conditionTint(base:number,durability=100){return rgb(base,durability<=0?0x81736b:durability<35?0xb9a695:0xffffff)}
 private drawAccessory(uid:number,kind:NonNullable<import('./human-spec').HumanWardrobeRule['accessory']>,tint:number){
  const input=this.input!,pose=this.pose!,surface=this.surface!,source=this.spec.pieces[kind][input.direction],base=this.spec.base[input.direction],size=this.dimensions(source);let a:HPoint,b:HPoint,z:number,owner:string,clip:HPoint[]|null=null
  if(kind==='hood'||kind==='helmet'){
   if(!surface.parts.Skull?.present)return;owner='Skull';a=pose.neck;b=pose.headTop;z=72
  }else if(kind==='mask'||kind==='goggles'){
   const eye=kind==='goggles',near=input.direction==='left'?'RightEye':input.direction==='right'?'LeftEye':undefined;if(eye&&near&&!surface.parts[near]?.present||!eye&&!surface.parts.Nose?.present)return
   owner=eye?near??'LeftEye':'Nose';const head=this.dimensions(base.head),point=hTransform(pose.head,[head.w*(input.direction==='left'?.27:input.direction==='right'?.73:.5),head.h*(eye?.45:.61)]),width=eye?4.8:4.1;a=hpAdd(point,[-width/2,0]);b=hpAdd(point,[width/2,0]);z=input.direction==='up'?69:76
   if(input.direction==='up'&&eye)clip=[[0,size.h*.49],[size.w,size.h*.49],[size.w,size.h*.73],[0,size.h*.73]]
  }else if(kind==='belt'){
   if(!surface.parts.Pelvis?.present)return;owner='Pelvis';const point=hTransform(pose.torso,[base.torso.a[0],base.torso.waist+4]);a=hpAdd(point,[-3,0]);b=hpAdd(point,[3,0]);z=42
  }else if(kind==='quiver'){
   if(!surface.parts.Chest?.present)return;owner='Chest';const rear=input.direction==='right'?-1:1;a=hpAdd(pose.neck,[3*rear,-1]);b=hpAdd(pose.hip,[2*rear,-1]);z=input.direction==='up'?44:input.direction==='left'||input.direction==='right'?6:4
  }else{
   if(!surface.parts.Chest?.present)return;owner='Chest';a=pose.neck;b=hpAdd(pose.hip,[0,4]);z=input.direction==='up'?44:6
  }
  const length=hpLength(hpSub(b,a)),scale=length/Math.max(1,hpLength(hpSub(source.b,source.a)));this.emit('accessory:'+uid,owner,source,hPin(source,a,b,scale),z,clip,uid,'clothing',tint)
 }
 private drawReplacements(){
  const pose=this.pose!,surface=this.surface!,input=this.input!,seen=new Set<number>()
  for(const part of Object.values(surface.parts)){
   const replacement=part.replacement;if(!replacement||seen.has(replacement.uid))continue;seen.add(replacement.uid);const registered=this.spec.replacements[replacement.def];if(!registered)continue
   const root=replacement.root,source=/(?:Hand|Foot)$/.test(root)&&registered.distal?registered.distal:registered,side:HumanSide=root.startsWith('Right')?'right':'left',bone=pose.bones[root],z=bone?.z??75;let a:HPoint,b:HPoint
   if(root.endsWith('Eye')){
    if(input.direction==='up'||input.direction==='left'&&side==='left'||input.direction==='right'&&side==='right')continue
    const head=this.spec.base[input.direction].head,size=this.dimensions(head),point=hTransform(pose.head,[size.w*(input.direction==='left'?.27:input.direction==='right'?.73:side==='left'?.64:.37),size.h*.45]),imageSize=this.dimensions(source)
    this.emit('replacement:'+replacement.uid,root,source,hAt(source.a,point,.9/Math.max(imageSize.w,imageSize.h)),75,null,replacement.uid,'prosthetic');continue
   }else if(!bone)continue
   else{a=bone.a;const endpoint=humanEndpointOwner(root);if(!endpoint)continue;b=pose.bones[endpoint].b}
   const length=hpLength(hpSub(b,a)),scale=length/Math.max(1,hpLength(hpSub(source.b,source.a))),matrix=source.solePinned?hSoleMatrix(source,b,this.soleMirror(side)):hPin(source,a,b,scale,side==='right'&&(input.direction==='down'||input.direction==='up'))
   this.emit('replacement:'+replacement.uid,root,source,matrix,z+.15,null,replacement.uid,'prosthetic',replacement.efficiency<=0?0x817b70:replacement.durability<35?0xb4a18c:0xffffff)
  }
 }
 hit(point:{x:number;y:number}){return this.root.visible&&[...this.nodes.values()].some(node=>{if(!node.root.visible||!spritePixelHit(node.sprite,point))return false;const local=node.sprite.toLocal(point);return !node.clip||inside([local.x,local.y],node.clip)})}
 headY(){return this.pose?.headTop[1]??-32}
 get sourceFrame(){return this.input?this.spec.base[this.input.direction].torso.frame:''}
 inspect(){return this.input&&this.pose?{direction:this.input.direction,mode:this.input.mode,base:this.spec.id,headRole:this.headRole??'wanderer',frame:this.sourceFrame,root:[...this.input.root],grips:structuredClone(this.pose.grips),gait:this.gaitPose?structuredClone(this.gaitPose):null,maxArmReachError:this.pose.maxReachError,legProjection:'2d-cutout',fixedLegLengths:false,footProjection:structuredClone(this.pose.feet),parts:[...this.nodes.values()].filter(n=>n.root.visible).map(n=>({owner:n.owner,uid:n.uid,role:n.role,source:n.frame,clip:!!n.clip,z:n.root.zIndex})),sourceFramesAreNotAuthoredActionFrames:true}:null}
 destroy(){this.nodes.clear();this.root.destroy({children:true})}
}
