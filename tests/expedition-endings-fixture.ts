/** Finite initial evidence from actual work/disclosure; exit positioning is explicit fixture preparation. */
import {spireFixture} from './spire-fixture'
import {evidenceFixture} from './evidence-fixture'
import {playerAct} from '../src/core/game'
import {updatePlayerVision} from '../src/core/fov'
import {expeditionEndingQuote} from '../src/core/expedition-endings'
export type EndingKind='signal'|'unveiled'|'witness'|'acknowledged'
export function endingFixture(kind:EndingKind){
 if(kind==='witness'){
  const d=evidenceFixture(),begin=d.s.time,sourceUIDs=d.papers.map(i=>i.uid)
  const error=playerAct(d.w,{type:'discloseEvidence',target:d.reformer.id,rule:d.rule});if(error)throw Error(error)
  if(!d.m.society?.disclosures?.some(r=>r.source===d.p.id&&r.rule===d.rule))throw Error('actual disclosure missing')
  d.p.pos={...d.s.map.exits[0]};updatePlayerVision(d.w,d.p)
  const quote=expeditionEndingQuote(d.w,d.p,kind);if(quote.error)throw Error(quote.error)
  return{w:d.w,s:d.s,p:d.p,m:d.m,kind,proof:{actualPreparationTU:d.s.time-begin,sourceUIDs,initialExitPositionExplicit:true}}
 }
 const d=spireFixture(),begin=d.s.time
 for(const operation of ['repair','transmit',...(kind==='unveiled'?['stop']:kind==='acknowledged'?['receive']:[])]){
  const error=playerAct(d.w,{type:'deviceWork',pos:d.pos,uid:d.device.uid,operation});if(error||!d.device.completed.includes(operation))throw Error(error??'actual operation incomplete')
 }
 const back=d.s.map.links.find(l=>l.to==='surface')!;d.p.pos={...back.pos};const error=playerAct(d.w,{type:'stairs'});if(error)throw Error(error)
 d.p.pos={...d.s.map.exits[0]};updatePlayerVision(d.w,d.p);const quote=expeditionEndingQuote(d.w,d.p,kind);if(quote.error)throw Error(quote.error)
 return{w:d.w,s:d.s,p:d.p,m:d.m,kind,proof:{actualPreparationTU:d.s.time-begin,sourceUIDs:[d.plate.uid],initialExitPositionExplicit:true}}
}
