// 동전은 기존 개인 지갑 사이에서만 옮긴다. 상점 공금/새 화폐/아이템 UID를 만들지 않는다.
import { capacity } from './body'
import { creatureById, log, type World } from './ctx'
import { economyDef } from './economy'
import { hasLos } from './fov'
import { cheb } from './geom'
import { diagonalBlocked } from './path'
import type { Creature } from './types'
export function corpseMoneyQuote(w:World,c:Creature,target=w.s.loot?.id){
  const out={error:null as string|null,id:undefined as number|undefined,amount:0},loot=w.s.loot,corpse=creatureById(w,target)
  if(c.id!==w.s.playerId||!c.alive||!loot||loot.kind!=='corpse'||loot.id!==target||!corpse||corpse.alive||!corpse.searched){out.error='수색한 시체의 주머니를 확인해야 한다';return out}
  if(cheb(c.pos,corpse.pos)>1||!hasLos(w,c.pos,corpse.pos)||diagonalBlocked(w,c.pos,corpse.pos.x-c.pos.x,corpse.pos.y-c.pos.y)){out.error='시체 곁으로 가야 한다';return out}
  const amount=corpse.money??0,wallet=c.money??0
  if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(wallet)||wallet<0||!Number.isSafeInteger(wallet+amount)){out.error='동전 수량을 확인할 수 없다';return out}
  out.id=corpse.id;out.amount=amount
  if(c.unconscious||c.asleep||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)out.error='주머니를 뒤질 손과 의식이 필요하다'
  else if(!amount)out.error='남은 동전이 없다'
  return out
}
export function takeCorpseMoney(w:World,c:Creature,target:number,expectedAmount?:number):string|null{
  const q=corpseMoneyQuote(w,c,target)
  if(q.error)return q.error
  if(expectedAmount!==undefined&&expectedAmount!==q.amount)return '주머니의 동전 수량이 달라졌다'
  const corpse=creatureById(w,target)!
  corpse.money=0;c.money=(c.money??0)+q.amount
  log(w,'info',`시체의 주머니에서 ${q.amount}${economyDef(w).currency}을(를) 꺼냈다.`)
  return null
}
