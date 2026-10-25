// Saved local nerve effects; queries allocate no RNG or world state.
import type {World} from './ctx'
import type {Creature} from './types'
export function paralysedPart(w:World,c:Creature,id:string){return !!c.paralysis?.some(e=>e.until>Math.floor(w.s.time/100)&&e.parts.includes(id))}
export function paralysisMoveMult(w:World,c:Creature){return c.paralysis?.some(e=>e.until>Math.floor(w.s.time/100)&&(e.region==='lleg'||e.region==='rleg'))?2:1}
export function paralysisKey(w:World,c:Creature){return c.paralysis?.filter(e=>e.until>Math.floor(w.s.time/100)).map(e=>e.parts.join(',')).join(';')??''}
