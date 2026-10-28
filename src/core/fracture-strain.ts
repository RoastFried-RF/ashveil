import {part} from './body'
import {log,rng,type World} from './ctx'
import type {Creature,Region} from './types'

/** Existing unsupported-fracture strain, shared by the actual acting limbs. */
export function worsenFractures(w:World,c:Creature,where:'leg'|Region){
 const random=rng(w,'body')
 for(const wound of c.body.wounds){
  if(!wound.fracture||wound.splint||wound.fracture.progress>=1)continue
  const region=w.db.body(c.body.def).parts.find(p=>p.id===wound.part)?.region
  if(where==='leg'?region!=='lleg'&&region!=='rleg':region!==where)continue
  const grade=wound.fracture.grade
  if(grade==='hairline'&&random.int(0,99)<3)wound.fracture.grade='simple'
  else if(grade==='simple'&&random.int(0,99)<2){wound.fracture.grade='compound';wound.bleed+=wound.severity;wound.contam=Math.min(100,wound.contam+30)}
  else continue
  if(c.faction==='player')log(w,'warn',`부러진 ${part(w,c,wound.part).label}에 힘을 싣자 뼈가 더 어긋난다. 부목이 필요하다.`)
 }
}
