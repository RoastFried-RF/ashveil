// 약탈단 작성자의 의도적 거짓 시설. 자신의 실제 시야 안 마른 자리만 골라 물이 있다고 적는다.
import {canSee} from './fov'
import {inBounds,rng,terrainAt,type World} from './ctx'
import {DIRS} from './geom'
import type {CartographyDef,Creature,MapDocument} from './types'
export function mapFraudRules(w:World,c:Creature){const r=w.db.get<CartographyDef>('Cartography.Hearth').fraud;return c.id!==w.s.playerId&&r?.factions.includes(c.faction)?r:undefined}
export function addFalseMapFacilities(w:World,c:Creature,paperUid:number,d:MapDocument):void{
 const rules=mapFraudRules(w,c);if(!rules||d.kind!=='surface')return
 const random=rng(w,`items.mapFraud.${paperUid}`);if(!random.chance(rules.chance))return
 const candidates=[{...c.pos},...DIRS.map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y}))].filter(p=>inBounds(w,p)&&canSee(w,c,p)&&terrainAt(w,p).passable&&!terrainAt(w,p).water&&!terrainAt(w,p).waterSource&&!(d.landmarks??[]).some(l=>l.x===p.x&&l.y===p.y))
 const count=random.int(...rules.facilityCount)
 for(let i=0;i<count&&candidates.length&&(d.landmarks?.length??0)<128;i++){const index=random.int(0,candidates.length-1),pos=candidates.splice(index,1)[0]!;(d.landmarks??=[]).push({...pos,kind:'water',label:random.pick(rules.labels)})}
}
