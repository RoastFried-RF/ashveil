// 읽기 전용 기생 개체 상태. 피는 parasiteTick에서 한 번만 소비한다.
import type { World } from './ctx'
import type { Creature } from './types'
export function parasiteBloodRate(w:World,c:Creature):number {
  if(!c.alive)return 0
  return (c.parasites??[]).reduce((n,a)=>{const d=w.db.creature(a.creature.def).parasite;return n+(d&&a.creature.alive?Math.max(0,Math.min(d.mlPerTurn,d.maxFedMl-a.fedMl)):0)},0)
}
