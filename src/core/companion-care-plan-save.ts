import type {Creature} from './types'
const integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0
const positive=(n:unknown)=>integer(n)&&Number(n)>0
const text=(s:unknown)=>typeof s==='string'&&s.length>0&&s.length<16384
const kinds=new Set(['diagnose','dose','bandage','disinfect','tourniquet','splint','suture','ligate','tendon','extract','reduce'])
export function validateCompanionCarePlans(actors:Creature[]){
 for(const c of actors){
  const p=c.companion?.carePlan
  if(p!==undefined){
   if(!p||!positive(p.uid)||!positive(p.patient)||!text(p.map)||p.region!==undefined&&!text(p.region)||![p.startedAt,p.updatedAt,p.cursor].every(integer)||p.updatedAt<p.startedAt||!['running','waiting','paused','complete'].includes(p.status)||!Array.isArray(p.steps)||p.steps.length<1||p.steps.length>128||p.cursor>p.steps.length||p.status==='complete'&&p.cursor!==p.steps.length||p.status!=='complete'&&p.cursor>=p.steps.length||p.reason!==undefined&&!text(p.reason)||p.dueAt!==undefined&&!integer(p.dueAt)||p.scheduleRule!==undefined&&!text(p.scheduleRule)||p.status==='waiting'&&(p.dueAt===undefined||p.dueAt<p.updatedAt||!p.scheduleRule))throw Error('동료 처치 순서의 원래 환자·진행 기록이 올바르지 않다')
   for(const s of p.steps){
    const r=s?.request,b=s?.bindings
    if(s.waitTurns!==undefined&&(!integer(s.waitTurns)||s.waitTurns>28800*30))throw Error('예약 간호의 대기 시간 기록이 올바르지 않다')
    if(!r||!kinds.has(r.kind)||r.patient!==p.patient||r.uid!==undefined&&!positive(r.uid)||r.woundId!==undefined&&!positive(r.woundId)||r.part!==undefined&&!text(r.part)||!text(s.label)||!positive(s.turns)||s.quality!==null&&(!Number.isFinite(s.quality)||s.quality<0||s.quality>100)||!Array.isArray(s.lines)||s.lines.length>128||s.lines.some(l=>!text(l))||!b||!Array.isArray(b.supplies)||b.supplies.length>128)throw Error('동료 처치 순서의 확인한 단계가 올바르지 않다')
    for(const it of [b.uid,b.tool])if(it&&(!positive(it.uid)||!text(it.def)))throw Error('동료 처치 순서의 원래 도구 기록이 올바르지 않다')
    const ids=new Set<number>()
    for(const it of b.supplies){if(!it||!positive(it.uid)||!text(it.def)||!positive(it.count)||it.uses!==undefined&&!positive(it.uses)||ids.has(it.uid))throw Error('동료 처치 순서의 원래 의료품 수량이 올바르지 않다');ids.add(it.uid)}
   }
   if(p.status==='waiting'&&(!positive(p.steps[p.cursor]?.waitTurns)||p.dueAt!==p.updatedAt+p.steps[p.cursor]!.waitTurns!))throw Error('예약 간호 시각이 확인한 원래 대기 시간과 다르다')
  }
  if(c.activity?.companionCarePlan!==undefined&&(!positive(c.activity.companionCarePlan)||!p||c.activity.companionCarePlan!==p.uid||c.activity.patientId!==p.patient||!c.activity.companionClinical||!['treat','diagnose','dose'].includes(c.activity.kind)))throw Error('동료 처치 활동의 원래 순서 연결이 올바르지 않다')
 }
}
