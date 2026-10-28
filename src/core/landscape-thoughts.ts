// 실제 서 있는 지역의 보이는 야외 풍경만 읽는다. 원격 고향 위치나 과거 발견을 만들지 않는다.
import {capacity,bodyDef} from './body'
import {tileAt,type World} from './ctx'
import {lightLevel} from './fov'
import {worldIndex} from './overworld'
import type {BackgroundDef,Creature,ThoughtDef} from './types'
export function landscapeThoughts(w:World,c:Creature){
 const m=w.s.overworld,home=c.background&&w.db.tryGet<BackgroundDef>(c.background)?.homeland
 if(!m||!home||!c.alive||c.asleep||c.unconscious||bodyDef(w,c).kind!=='humanoid'||w.s.map.kind!=='surface'||tileAt(w,c.pos).roof||capacity(w,c,'sight')<=0||lightLevel(w,c.pos)>=3)return[]
 const cell=m.cells[worldIndex(m,w.s.map.worldCell??m.position)]
 if(!cell||home.biomes?.length&&!home.biomes.includes(cell.biome)||home.river!==undefined&&home.river!==!!cell.river)return[]
 return w.db.all<ThoughtDef>('Thought').filter(d=>d.homeLandscape).map(d=>({def:d.id,label:d.label,mood:d.mood,count:1}))
}
