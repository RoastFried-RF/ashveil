// 실제 수심/장비만 읽는다. 짐의 무게로 익사를 판정하지 않는다(CANON D22).
import { terrainAt, tileAt, turnOf, type World } from './ctx'
import type { Pos } from './geom'
import type { Creature, WaterSafetyDef } from './types'
export const aquaticRules=(w:World)=>w.db.get<WaterSafetyDef>('WaterSafety.Human').aquatic!
export function deepWaterAt(w:World,pos:Pos):boolean{const tile=tileAt(w,pos);return terrainAt(w,pos).water==='deep'&&(!tile.icy||(tile.iceHoleUntil??0)>turnOf(w))}
export function inDeepWater(w:World,c:Creature):boolean{return deepWaterAt(w,c.pos)&&!c.body.machine&&!w.db.body(c.body.def).waterBreathing}
export const equippedBulk=(w:World,c:Creature)=>Object.values(c.equip).reduce((n,i)=>n+(i?w.db.item(i.def).bulk??0:0),0)
export const aquaticHypoxiaPenalty=(w:World,c:Creature)=>c.aquatic?Math.min(1,c.aquatic.hypoxia/aquaticRules(w).hypoxiaFatalTurns):0
export const drowningFatal=(w:World,c:Creature)=>!!c.aquatic&&c.aquatic.hypoxia>=aquaticRules(w).hypoxiaFatalTurns
