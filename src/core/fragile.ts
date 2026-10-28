import {ageFood} from './food-safety'
import {ambientTemp} from './environment'
import {canSee} from './fov'
import {emitNoise} from './perception'
import {itemDef} from './items'
import {log,player,rng,terrainAt,turnOf,type World} from './ctx'
import type {Pos} from './geom'
import type {Creature,ItemInst} from './types'
export function fragileDropChance(w:World,it:ItemInst,pos:Pos){
 const f=itemDef(w,it).fragile,t=terrainAt(w,pos)
 return f?f.dropChance*(t.water?f.waterMult??1:t.bedding?f.beddingMult??1:1):0
}
/** 견적/실패 검사가 끝나 실제 원래 물품을 바닥으로 옮길 때만 호출한다. */
export function dropFragile(w:World,c:Creature,it:ItemInst,pos:Pos){
 const d=itemDef(w,it),f=d.fragile,chance=fragileDropChance(w,it,pos)
 if(!f||chance<=0||!rng(w,'items.fragile').chance(chance))return false
 if(d.food?.freshHours||d.drink?.freshHours){ageFood(w,it,ambientTemp(w,pos),Math.max(0,turnOf(w)-(it.foodAgedAt??turnOf(w))),c.needs.wetness>=50);it.foodAgedAt=turnOf(w)}
 it.def=f.result
 if(f.noise)emitNoise(w,pos,f.noise,c.id)
 if(c.id===w.s.playerId||canSee(w,player(w),pos))log(w,'warn',d.label+' 더미가 바닥에 부딪혀 깨졌다. 원래 내용물은 남았다.')
 return true
}
