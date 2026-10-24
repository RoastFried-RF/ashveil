/** Beaks separate a finite actual portion before consuming small original food units. */
import type {ActResult} from './actions'
import {carcassCount,takeCarcassPortion} from './carcass'
import {bestiaryEntry} from './bestiary-state'
import {creatureById,inBounds,tileAt,type World} from './ctx'
import {hasLos} from './fov'
import {cheb} from './geom'
import {itemDef,makeItem} from './items'
import {diagonalBlocked} from './path'
import {animalMouthReady,wildlifeRules} from './wildlife'
import type {Creature,ItemInst} from './types'

const fail=(msg:string):ActResult=>({ok:false,tu:0,msg})
export function tearFoodError(w:World,c:Creature,item:ItemInst|undefined){
 if(!animalMouthReady(w,c)||!splittableFood(w,c,item))return '실제로 찢어 먹을 원래 고기와 부리가 없다'
 return null
}
export function splittableFood(w:World,c:Creature,item:ItemInst|undefined){const split=wildlifeRules(w,c)?.scavenging?.split;return !!split&&!!item&&item.def===split.source&&item.count>0&&!item.missingItem&&!item.half&&!item.foodFrozen&&!(item.cookProgress??0)}
function splitPortion(w:World,c:Creature,item:ItemInst){
 const rule=wildlifeRules(w,c)!.scavenging!.split,floor=tileAt(w,c.pos).items,original=structuredClone(item)
 let pieces:ItemInst
 if(item.count===1)pieces=item
 else{item.count--;pieces=makeItem(w,rule.piece,rule.pieces);floor.push(pieces)}
 Object.assign(pieces,original,{uid:pieces.uid,def:rule.piece,count:rule.pieces})
 if(pieces.contaminantAsh!==undefined)pieces.contaminantAsh/=rule.pieces
 if(pieces.foodSaltGrams!==undefined)pieces.foodSaltGrams/=rule.pieces
 if(pieces.foodWater)pieces.foodWater={...pieces.foodWater,ml:pieces.foodWater.ml/rule.pieces,quality:{...pieces.foodWater.quality}}
 delete pieces.cookProgress;return pieces
}
export function tearFloorFood(w:World,c:Creature,uid:number):ActResult{
 const item=tileAt(w,c.pos).items.find(i=>i.uid===uid),error=tearFoodError(w,c,item);if(error)return fail(error)
 splitPortion(w,c,item!);return{ok:true,tu:100}
}
export function carrionError(w:World,c:Creature,corpse:Creature|undefined){
 if(!animalMouthReady(w,c)||!corpse||!carcassFood(w,c,corpse))return '실제로 뜯을 수 있는 동물 사체와 고기가 없다'
 if(!inBounds(w,corpse.pos)||cheb(c.pos,corpse.pos)>1||!hasLos(w,c.pos,corpse.pos)||diagonalBlocked(w,c.pos,corpse.pos.x-c.pos.x,corpse.pos.y-c.pos.y))return '원래 사체에 닿지 않는다'
 return null
}
export function tearCarrion(w:World,c:Creature,target:number):ActResult{
 const corpse=creatureById(w,target),error=carrionError(w,c,corpse);if(error)return fail(error)
 const source=carcassFood(w,c,corpse!)!,item=takeCarcassPortion(w,corpse!,source)!
 tileAt(w,c.pos).items.push(item);const split=wildlifeRules(w,c)?.scavenging?.split;if(split&&source===split.source)splitPortion(w,c,item);return{ok:true,tu:100}
}
export function carcassFood(w:World,c:Creature,corpse:Creature){
 const rule=wildlifeRules(w,c),split=rule?.scavenging?.split;if(corpse.alive||corpse.dissected||bestiaryEntry(w,corpse.def)?.kind!=='animal')return
 return(split?[split.source,split.piece]:rule?.carrionFoods??[]).find(id=>carcassCount(corpse,id)>0&&!corpse.carcassStock?.[id]?.foodFrozen)
}

export function birdFloorFood(w:World,c:Creature){return tileAt(w,c.pos).items.find(i=>!tearFoodError(w,c,i)&&!!itemDef(w,i).food)}
