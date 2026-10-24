/** Shared game/gallery equipment choreography. Presentation data only. */
import type {ItemDef} from '../../core/types'
import type {Dir} from './atlas'
export type WeaponKind='blade'|'greatblade'|'axe'|'club'|'hammer'|'polearm'|'staff'|'bow'|'crossbow'|'rifle'|'pistol'|'shield'|'torch'|'lantern'|'item'
export type AttackStyle='slash'|'thrust'|'chop'|'smash'|'unarmed'|'shoot'|'throw'
export interface HeldEquipment {id:string;uid?:number;sprite:string;kind:WeaponKind;grip:[number,number];axis:number;length:number;restAngle?:number;tipFraction?:number;twoHanded:boolean;lit:boolean}
export interface EquipmentAction {style:AttackStyle;slot:0|1|null;weapon?:HeldEquipment;direction:Dir;vector:{x:number;y:number}}
const HALF_PI=Math.PI/2
export function equipmentSpec(def:ItemDef,uid?:number,lit=false):HeldEquipment{
 const family=def.attacks?.[0]?.family??'',name=def.sprite.toLowerCase()
 const kind:WeaponKind=def.ranged?(family==='archery'?'bow':family==='crossbow'?'crossbow':def.twoHanded?'rifle':'pistol'):name.includes('buckler')?'shield':name.includes('torch')?'torch':name.includes('lantern')?'lantern':family==='spear'?(def.attacks?.[0]?.damageType==='blunt'?'staff':'polearm'):family==='blade'?(def.twoHanded?'greatblade':'blade'):family==='axe'?'axe':family==='blunt'?(name.includes('hammer')?'hammer':'club'):'item'
 const settings:Record<WeaponKind,{grip:[number,number];axis:number;length:number}>={
  blade:{grip:[.52,.79],axis:-HALF_PI,length:14},greatblade:{grip:[.51,.84],axis:-HALF_PI,length:32},axe:{grip:[.51,.77],axis:-HALF_PI,length:19},club:{grip:[.52,.81],axis:-HALF_PI,length:24},hammer:{grip:[.5,.78],axis:-HALF_PI,length:20},polearm:{grip:[.52,.68],axis:-HALF_PI,length:39},staff:{grip:[.52,.68],axis:-HALF_PI,length:39},bow:{grip:[.635,.5],axis:0,length:27},crossbow:{grip:[.49,.71],axis:-HALF_PI,length:27},rifle:{grip:[.51,.71],axis:-HALF_PI,length:33},pistol:{grip:[.48,.71],axis:0,length:16},shield:{grip:[.5,.5],axis:-HALF_PI,length:18},torch:{grip:[.52,.67],axis:-HALF_PI,length:23},lantern:{grip:[.5,.18],axis:-HALF_PI,length:14},item:{grip:[.5,.65],axis:-HALF_PI,length:12},
 }
 const h=def.heldSprite,source=h?{grip:h.grip,axis:h.axisDegrees*Math.PI/180,length:h.length,restAngle:h.restDegrees===undefined?undefined:h.restDegrees*Math.PI/180,tipFraction:h.tipFraction}:{}
 return{id:def.id,uid,sprite:def.sprite,kind,...settings[kind],...source,twoHanded:!!def.twoHanded,lit}
}
/** Presentation distance from source grip to the impact end, independent of game reach. */
export function equipmentTipReach(item:HeldEquipment){return item.length*(item.tipFraction??(item.axis===0?1-item.grip[0]:item.grip[1]))}
export function attackStyle(family:string|undefined,damage:string|undefined,weapon:HeldEquipment|undefined,ranged=false,throwing=false):AttackStyle{
 if(throwing)return'throw';if(ranged)return'shoot';if(!weapon)return'unarmed'
 if(damage==='stab'||family==='spear')return'thrust'
 if(family==='axe')return'chop'
 return family==='blunt'||weapon.kind==='torch'?'smash':'slash'
}
export const attackDurations:Record<AttackStyle,number>={slash:520,thrust:480,chop:640,smash:620,unarmed:400,shoot:500,throw:540}
export function attackDuration(style:AttackStyle,weapon?:HeldEquipment){return attackDurations[style]+(weapon?.kind==='greatblade'?120:0)}
export const actionStage=(phase:number)=>phase<.3?'prepare':phase<.52?'strike':phase<.74?'followThrough':'recover'
const smooth=(a:number,b:number,t:number)=>a+(b-a)*(t*t*(3-2*t))
const blendAngle=(from:number,to:number,amount:number)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*amount
function curve(phase:number,points:readonly[number,number][]){
 const p=Math.max(0,Math.min(1,phase));for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(p<=b[0])return smooth(a[1],b[1],(p-a[0])/(b[0]-a[0]))}return points.at(-1)![1]
}
/** Deliberate anticipation, a short contact hold, follow-through, then a complete return. */
export function attackBodyPhase(phase:number){return curve(phase,[[0,0],[.18,.125],[.3,.25],[.43,.5],[.51,.5],[.72,.75],[1,1]])}
export interface HandPose {x:number;y:number;angle:number;behind:boolean;visible:boolean;alpha:number}
export function heldPose(input:{item:HeldEquipment;slot:0|1;direction:Dir;mode:string;phase:number;stride:number;moving:boolean;crouched:boolean;wrist?:readonly[number,number];sourceGrip?:boolean;action?:EquipmentAction}):HandPose{
 const{item,slot,direction:dir,mode,phase,moving,stride,crouched,wrist,action}=input,side=dir==='left'||dir==='right',facing=dir==='left'?-1:1,sign=slot===0?-1:1
 let x=side?facing*(slot===0?6:2):sign*(dir==='up'?-5:5),y=crouched?-11:-16,angle=(item.restAngle??-HALF_PI)+(side?facing*.12:sign*.13)
 if(moving){const sway=Math.sin(stride*Math.PI);y+=sway*(slot===0?1:-.8);angle+=sway*.06}
 if(wrist){x=wrist[0];y=wrist[1]}
 const rest={x,y,angle}
 if(mode==='block'){
  x=side?facing*(item.kind==='shield'?10:6):sign*4;y=crouched?-17:-23;angle=item.kind==='shield'?-HALF_PI:side?-HALF_PI+facing*.75:-HALF_PI+sign*.6
  const weight=curve(phase,[[0,0],[.3,1],[.72,1],[1,0]])
  x=rest.x+(x-rest.x)*weight;y=rest.y+(y-rest.y)*weight;angle=blendAngle(rest.angle,angle,weight)
 }
 const attacking=mode==='attack'&&action?.slot===slot
 if(attacking){
  const base=Math.atan2(action.vector.y,action.vector.x),style=action.style,mirrored=action.vector.x<0?-1:1
  const offsets:Record<AttackStyle,readonly[number,number][]>= {
   slash:[[0,-1.1],[.25,-2],[.43,.18],[.51,.18],[.72,.85],[1,-1.1]],chop:[[0,-1.15],[.27,-2.3],[.43,.65],[.51,.65],[.74,1.05],[1,-1.15]],smash:[[0,-1],[.28,-2],[.45,.45],[.52,.45],[.74,.8],[1,-1]],thrust:[[0,-.35],[.23,-.15],[.42,0],[.52,0],[.76,.15],[1,-.35]],unarmed:[[0,0],[1,0]],shoot:[[0,0],[1,0]],throw:[[0,0],[1,0]],
  }
  angle=blendAngle(rest.angle,base+mirrored*curve(phase,offsets[style]),curve(phase,[[0,0],[.12,1],[.8,1],[1,0]]));const extension=curve(phase,[[0,0],[.24,-1.5],[.43,style==='thrust'?5:1.5],[.51,style==='thrust'?5:1.5],[.74,1],[1,0]])
  // A reviewed source palm already follows the authored arm. Extend only legacy estimates.
  if(!input.sourceGrip){x+=action.vector.x*extension;y+=action.vector.y*extension}
 }
 if(mode==='shoot'&&slot===(action?.slot??0)){
  const vec=action?.vector??{x:side?facing:0,y:dir==='up'?-1:dir==='down'?1:0},recoil=item.kind==='rifle'||item.kind==='pistol'?curve(phase,[[0,0],[.38,0],[.45,1.6],[.6,.8],[1,0]]):0
  angle=Math.atan2(vec.y,vec.x);x=(side?facing*8:slot===0?-2:2)-vec.x*recoil;y=(crouched?-18:-23)-vec.y*recoil
  const weight=curve(phase,[[0,0],[.24,1],[.8,1],[1,0]])
  x=rest.x+(x-rest.x)*weight;y=rest.y+(y-rest.y)*weight;angle=blendAngle(rest.angle,angle,weight)
 }
 if(mode==='work'&&['bow','crossbow','rifle','pistol'].includes(item.kind)){angle=-HALF_PI+(side?facing*1.1:.65);y=crouched?-12:-16}
 if(mode==='use'||mode==='interact'){angle=-HALF_PI+sign*.35;y=crouched?-13:-17}
 if(mode==='throw'&&action?.slot===slot){angle=-HALF_PI+facing*curve(phase,[[0,-.5],[.3,-1],[.5,1],[1,0]])}
 return{x,y,angle,behind:dir==='up',visible:!(mode==='throw'&&action?.slot===slot&&phase>=.5),alpha:dir==='up'?.8:1}
}
export function supportHand(main:HandPose,item:HeldEquipment):{x:number;y:number}{
 const distance=item.kind==='bow'?-6:Math.min(6,item.length*.18)
 return{x:main.x+Math.cos(main.angle)*distance,y:main.y+Math.sin(main.angle)*distance}
}
