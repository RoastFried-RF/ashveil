/** Read-only continuous clinical props. Bind original UIDs; never replace a lost tool. */
import {creatureById,findItem,handCapacity,itemDef,treatmentArm,type Activity,type Creature,type ItemInst,type World} from '../../core'
import {medicalCycles,medicalPropSpec,type MedicalKind,type MedicalProp} from './medical-motion'
export {medicalPropAngle} from './medical-motion'
export interface MedicalPresentation {key:string;kind:MedicalKind;cycle:number;props:MedicalProp[]}
export const isMedicalActivity=(act:Activity|undefined)=>!!act&&['treat','diagnose','dose','medicate'].includes(act.kind)
export function medicalPresentation(w:World,c:Creature):MedicalPresentation|null{
 const act=c.activity;if(!isMedicalActivity(act)||!c.alive||c.asleep||c.unconscious)return null
 const p=act!.patientId===undefined?c:creatureById(w,act!.patientId)
 if(!p?.alive||Math.max(Math.abs(p.pos.x-c.pos.x),Math.abs(p.pos.y-c.pos.y))>1)return null
 const kind:MedicalKind=act!.kind==='diagnose'?'examine':act!.kind==='dose'?'dose':act!.kind==='medicate'?'wash':act!.treat==='amputate'?'cut':act!.treat==='extract'?'extract':act!.treat==='reduce'?'reduce':['suture','ligate','tendon'].includes(act!.treat??'')?'needle':act!.treat==='splint'?'splint':act!.treat==='disinfect'?'wash':'wrap'
 const target=act!.woundId===undefined?act!.limb:p.body.wounds.find(wd=>wd.id===act!.woundId)?.part
 const arm=treatmentArm(w,c,p===c?target:undefined)==='rarm'?'main':'off',props:MedicalProp[]=[]
 const valid=(item:ItemInst|undefined)=>!!item&&!item.missingItem&&!item.half&&item.count>0&&(item.uses??1)>0&&(item.durability??100)>0
 const append=(item:ItemInst,to:'main'|'off',primary:boolean)=>{
  if(handCapacity(w,c,to==='main'?'Right':'Left')<.1)return
  props.push(medicalPropSpec(kind,primary,{uid:item.uid,sprite:itemDef(w,item).sprite,arm:to}))
 }
 const uid=act!.toolUid??act!.uid
 if(uid!==undefined){const item=findItem(c,uid);if(!valid(item))return null;append(item!,arm,true)}
 for(const bound of act!.supplies??[]){
  if(bound.uid===uid)continue
  const item=findItem(c,bound.uid);if(!valid(item)||item!.def!==bound.def||item!.count<bound.count)return null
  if(kind==='needle'&&props.length<2)append(item!,arm==='main'?'off':'main',false)
 }
 return{key:[act!.kind,act!.treat,act!.patientId??c.id,act!.woundId,act!.limb,uid,act!.total].join(':'),kind,cycle:medicalCycles[kind],props}
}
