import {hallucinating,hallucinationRules} from './hallucination-state'
import {inBounds,log,rng,turnOf,type World} from './ctx'
import {DIRS,DIR_LABELS,dirIndex} from './geom'
import type {Creature} from './types'
export function hallucinationTick(w:World,c:Creature){
 const d=hallucinationRules(w),now=turnOf(w)
 if(!d||!hallucinating(w,c)){if(c.phantomSound)delete c.phantomSound;return}
 if(c.phantomSound&&(c.phantomSound.until<=now||c.phantomSound.map!==w.s.map.id))delete c.phantomSound
 if(now%d.checkTurns!==0||c.hallucinationChecked?.at===now&&c.hallucinationChecked.map===w.s.map.id)return
 c.hallucinationChecked={at:now,map:w.s.map.id}
 const r=rng(w,('body.hallucination.'+c.id)as import('./rng').RngStream)
 if(!r.chance(d.chance))return
 const candidates=DIRS.map(dir=>({x:c.pos.x+dir.x*d.range,y:c.pos.y+dir.y*d.range})).filter(pos=>inBounds(w,pos))
 if(!candidates.length)return
 const pos=r.pick(candidates)
 c.phantomSound={map:w.s.map.id,pos,at:now,until:now+d.lifetimeTurns}
 if(c.id===w.s.playerId){const direction=DIR_LABELS[dirIndex(pos.x-c.pos.x,pos.y-c.pos.y)];log(w,'flavor',direction+'쪽 어딘가에서 발소리 같은 것이 들렸다.')}
}
