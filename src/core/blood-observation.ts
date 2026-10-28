// 실제 흐르는 외부 출혈만 목격한다. 같은 상처의 같은 출혈 동안에는 한 번만 반응한다.
import {bodyDef,effectiveBleed,tryPart} from './body'
import type {World} from './ctx'
import {canSee,hasLos} from './fov'
import {cheb} from './geom'
import {rememberLifeEvent} from './life-memories'
import {diagonalBlocked} from './path'
import type {Creature} from './types'

export function observeBleeding(w:World,source:Creature){
 if(!source.alive||!w.s.creatures.includes(source)||bodyDef(w,source).kind==='mechanical')return
 const wounds=source.body.wounds.filter(wound=>{
  if(wound.internal||tryPart(w,source,wound.part)?.internal)return false
  if(effectiveBleed(w,source,wound)<=0){delete wound.bloodSeenBy;return false}
  return true
 })
 if(!wounds.length)return
 for(const observer of w.s.creatures){
  if(!observer.alive||observer.asleep||observer.unconscious||bodyDef(w,observer).kind!=='humanoid'||!canSee(w,observer,source.pos)||!hasLos(w,observer.pos,source.pos)||cheb(observer.pos,source.pos)<=1&&diagonalBlocked(w,observer.pos,source.pos.x-observer.pos.x,source.pos.y-observer.pos.y))continue
  let newlySeen=false
  for(const wound of wounds){
   if(wound.bloodSeenBy?.includes(observer.id))continue
   ;(wound.bloodSeenBy??=[]).push(observer.id)
   newlySeen=true
  }
  // 한 시점에 여러 상처를 처음 봐도 하나의 실제 목격 사건이다.
  if(newlySeen)rememberLifeEvent(w,observer,'seenBlood')
 }
}
