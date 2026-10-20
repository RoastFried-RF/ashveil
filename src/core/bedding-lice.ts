// 같은 실제 침구의 이만 실제로 누운 다음 몸에 옮겨간다.
import {channelTurns} from './action-time'
import {bodyDef,capacity} from './body'
import {beddingMapKey,beddingLiceState,lyingOnBedding,setBeddingLice,setBeddingWetness} from './camping'
import {creatureAt,inBounds,log,rng,tileAt,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {cheb,eq,type Pos} from './geom'
import {mapWorlds} from './journey'
import {diagonalBlocked} from './path'
import {addEffect,hasEffect} from './traits'
import {spendWashWater,washWaterSupply} from './wash-water'
import type {Activity,BeddingContactDef,Creature} from './types'
export const beddingLiceRules=(w:World)=>w.db.get<BeddingContactDef>('BeddingContact.Hearth').lice
export function activeBeddingLice(w:World,pos:Pos){const state=beddingLiceState(tileAt(w,pos));return state&&state.until>turnOf(w)?state:undefined}
export function beddingLiceTick(w:World){
 const d=beddingLiceRules(w)
 const now=turnOf(w),seen=new Set<typeof w.s.map>()
 for(const local of mapWorlds(w,false)){
  if(seen.has(local.s.map))continue;seen.add(local.s.map)
  for(const light of local.s.map.lights)if(light.beddingFireId!==undefined){const tile=tileAt(local,light.pos);if(tile.beddingFire?.id===light.beddingFireId)setBeddingLice(tile)}
  for(const c of local.s.creatures){
   const lying=lyingOnBedding(local,c)
   if(c.beddingLying&&c.beddingLying.until<=now)delete c.beddingLying
   if(!d||!c.alive||!d.hostBodies.includes(bodyDef(local,c).id)||!inBounds(local,c.pos)||!lying){delete c.beddingContact;continue}
   const tile=tileAt(local,c.pos)
   if(!local.db.terrain(tile.t).bedding){delete c.beddingContact;continue}
   if(tile.beddingFire){setBeddingLice(tile);delete c.beddingContact;continue}
   let state=activeBeddingLice(local,c.pos)
   if(!state&&beddingLiceState(tile))setBeddingLice(tile)
   if(w.s.hygieneEnabled===false){delete c.beddingContact;continue}
   if(hasEffect(c,'lice',now)){
    if(state)state.until=now+d.surviveTurns
    else{state={source:c.id,at:now,until:now+d.surviveTurns};setBeddingLice(tile,state)}
    delete c.beddingContact;continue
   }
   if(!state){delete c.beddingContact;continue}
   const old=c.beddingContact,uid=tile.placed?.item.uid,same=!!old&&old.map===beddingMapKey(local)&&eq(old.pos,c.pos)&&old.terrain===tile.t&&old.uid===uid&&old.sourceAt===state.at
   if(same&&old.lastAt===now)continue
   const contact=c.beddingContact={map:beddingMapKey(local),pos:{...c.pos},terrain:tile.t,...(uid!==undefined?{uid}:{}),sourceAt:state.at,lastAt:now,turns:same&&old.lastAt+1===now?old.turns+1:1}
   if(contact.turns<d.checkTurns)continue
   contact.turns-=d.checkTurns
   if(rng(local,`body.bedding.lice.${c.id}.${beddingMapKey(local)}.${c.pos.y*local.s.map.w+c.pos.x}`).chance(d.contactChance)){
    addEffect(c,'lice',Number.MAX_SAFE_INTEGER);delete c.beddingContact
    if(c.id===local.s.playerId)log(local,'warn','누워 있던 침구에서 이가 옮았다. 몸과 침구를 따로 씻어야 한다.')
   }
  }
 }
}
export function beddingWashQuote(w:World,c:Creature,pos:Pos){
 const d=beddingLiceRules(w),out={error:null as string|null,turns:0,waterMl:d?.washWaterMl??0,binding:undefined as Activity['beddingWash']}
 if(!d||!inBounds(w,pos)||!w.db.terrain(tileAt(w,pos).t).bedding){out.error='실제 침구가 아니다';return out}
 const tile=tileAt(w,pos),occupant=creatureAt(w,pos)
 if(tile.beddingFire){out.error='침구의 불을 먼저 꺼야 한다';return out}
 if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2){out.error='깨어서 침구를 씻을 손을 쓸 수 있어야 한다';return out}
 if(cheb(c.pos,pos)>1||!canSee(w,c,pos)||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y)){out.error='침구 바로 곁으로 가야 한다';return out}
 if(occupant&&occupant.id!==c.id){out.error='누군가 침구를 쓰고 있다';return out}
 if(!washWaterSupply(w,c,d.washWaterMl).available){out.error=`침구를 씻을 실제 물 ${d.washWaterMl}ml 또는 물가가 필요하다`;return out}
 const turns=channelTurns(w,c,d.washTurns)
 if(turns===null){out.error='몸 상태 때문에 침구를 씻을 수 없다';return out}
 out.turns=turns;out.binding={map:beddingMapKey(w),terrain:tile.t,...(tile.placed?{uid:tile.placed.item.uid}:{})};return out
}
export function startBeddingWash(w:World,c:Creature,pos:Pos):string|null{
 if(c.activity)return '하던 일을 먼저 마쳐야 한다'
 const q=beddingWashQuote(w,c,pos);if(q.error)return q.error
 c.activity={kind:'washBedding',remaining:q.turns,total:q.turns,target:{...pos},beddingWash:q.binding,label:'침구 세탁',woundCount:c.body.wounds.length};return null
}
export function beddingWashStep(w:World,c:Creature):boolean{
 const a=c.activity!,q=beddingWashQuote(w,c,a.target!)
 if(q.error||!a.beddingWash||JSON.stringify(q.binding)!==JSON.stringify(a.beddingWash)){
  if(c.id===w.s.playerId)log(w,'warn',`침구 세탁 중단: ${q.error??'원래 침구가 바뀌었다'}.`)
  c.activity=undefined;return true
 }
 if(a.remaining>0)return false
 if(!spendWashWater(w,c,q.waterMl)){c.activity=undefined;return true}
 const tile=tileAt(w,a.target!);setBeddingLice(tile);setBeddingWetness(tile,100);c.activity=undefined
 if(c.id===w.s.playerId)log(w,'info',`실제 물 ${q.waterMl}ml로 같은 침구를 씻었다. 몸에 남은 이는 별도로 씻어야 한다.`)
 return true
}
