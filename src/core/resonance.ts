// 귀로 듣는 고음의 존재만 공개한다. 숨은 개체의 이름/수/위치/도감은 만들지 않는다.
import {bodyDef,capacity} from './body'
import {inBounds,type World} from './ctx'
import {cheb} from './geom'
import {machineReady} from './machine-state'
import {ambientNoise,hearingBonus,noiseCost} from './perception'
import type {Creature} from './types'

const SILENCE=Object.freeze({machine:false,tower:false})
export function resonanceState(w:World,c:Creature):{readonly machine:boolean;readonly tower:boolean}{
 let machine=false,tower=false
 if(!c.traits.some(id=>!!w.db.trait(id).resonance))return SILENCE
 if(!c.alive||c.asleep||c.unconscious||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id||!inBounds(w,c.pos)||bodyDef(w,c).kind!=='humanoid'||capacity(w,c,'consciousness')<.3||capacity(w,c,'hearing')<=0)return SILENCE
 const bonus=hearingBonus(w,c)-ambientNoise(w),cell=w.s.map.worldCell??w.s.overworld?.position
 for(const id of c.traits){
  const rule=w.db.trait(id).resonance;if(!rule)continue
  if(!machine){
   let costs:Map<number,number>|undefined
   machine=w.s.creatures.some(source=>{
    if(source.id===c.id||!source.alive||source.faction!==rule.faction||source.mapId!==undefined&&source.mapId!==w.s.map.id||!inBounds(w,source.pos)||!machineReady(w,source)||bodyDef(w,source).kind!=='mechanical')return false
    const distance=cheb(c.pos,source.pos);if(distance>rule.radius)return false
    costs??=noiseCost(w,c.pos,rule.radius)
    const cost=costs.get(source.pos.y*w.s.map.w+source.pos.x)??distance+8
    return rule.radius-cost+bonus>=0
   })
  }
  if(!tower&&cell)tower=!!w.s.overworld?.towers.some(t=>!t.shutdown&&t.output>0&&(cell.x-t.cell.x)**2+(cell.y-t.cell.y)**2<=rule.towerRadius**2)
 }
 return{machine,tower}
}
