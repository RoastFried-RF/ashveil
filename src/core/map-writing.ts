import {mapFraudRules,addFalseMapFacilities} from './map-fraud'
// 직접 탐험한 초기 기록을 종이에 옮긴다. 완료 전에는 재료와 지도 난수를 쓰지 않는다.
import {clamp,log,rng,turnOf,type World} from './ctx'
import {capacity} from './body'
import {multiTurnFactor} from './action-time'
import {lightLevel} from './fov'
import {masteryStage} from './skills'
import {learnRumor} from './rumor-state'
import {cartographyDef} from './cartography'
import {fieldMapRegion,npcRecordedMap} from './npc-map-memory'
import {canSee} from './fov'
import {knownCreatureName} from './bestiary-state'
import type {Creature,MapDocument} from './types'
export const mapDrawingRegion=fieldMapRegion
const signature=(w:World)=>JSON.stringify(cartographyDef(w).writing)
export function mapDrawingQuote(w:World,c:Creature,paperUid:number,inkUid:number,factor=multiTurnFactor(w,c)){
 const rule=cartographyDef(w).writing,job=c.mapDrawingJob
 let error:string|null=null
 const paper=c.bag.find(i=>i.uid===paperUid),ink=c.bag.find(i=>i.uid===inkUid)
 if(c.worldMapDrawingJob)error='먼저 진행 중인 월드 지도를 마치거나 취소해야 한다'
 else if(!rule)error='지도 작성법이 없다'
 else if(w.db.body(c.body.def).kind!=='humanoid')error='직접 탐험 기록을 가진 사람만 그릴 수 있다'
 else if(!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.5)error='깨어 있어야 한다'
 else if((c.literacy??(c.literate?1:0))<rule.minLiteracy)error='문해1 이상이 필요하다'
 else if(capacity(w,c,'manipulation')<rule.minManipulation||capacity(w,c,'sight')<=0)error='보고 손을 움직일 수 있어야 한다'
 else if(lightLevel(w,c.pos)>=2)error='지도를 그리기에는 어둡다'
 else if(!Number.isFinite(factor)||factor<=0||factor>4)error='몸 상태가 지도 작성에 적합하지 않다'
 else if(!paper||paper.def!==rule.paper||paper.count!==1||paper.note)error='내용이 없는 원래 종이1장이 필요하다'
 else if(!ink||ink.uid===paperUid||ink.def!==rule.ink||ink.count<1)error='지도용 잉크1회분이 필요하다'
 else if(job&&(job.paperUid!==paperUid||job.inkUid!==inkUid||job.signature!==signature(w)||job.draft.mapId!==w.s.map.id||job.region!==mapDrawingRegion(w)||ink.count!==job.inkCount))error='원래 종이·잉크·지역·작성법이 달라졌다. 이전 작업을 취소할 수 있다'
 else if(!job&&(c.id===w.s.playerId?!w.s.map.rooms.some(r=>r.discovered)&&!w.s.map.tiles.some(t=>{const o=t.observed,d=o&&Number.isFinite(o.at)&&o.at>=0&&o.at<=turnOf(w)&&w.db.terrain(o.terrain);return d&&(d.stairs||w.s.map.kind==='surface'&&(d.water||d.waterSource))}):!npcRecordedMap(w,c)?.rooms.length&&!npcRecordedMap(w,c)?.stairs.length&&!npcRecordedMap(w,c)?.landmarks?.length))error='직접 탐험한 방이나 계단·물 지형 기록이 없다'
 const stage=masteryStage(w,c,'survival'),reliability=job?.draft.reliability??Math.min(mapFraudRules(w,c)?.reliability??100,clamp((rule?.baseReliability??40)+stage*(rule?.perMastery??10),0,100)),errorTiles=job?.draft.error??clamp((rule?.baseError??3)-Math.floor(stage/(rule?.errorEvery??2)),0,5),total=job?.total??Math.max(1,Math.ceil((rule?.turns??60)*factor))
 return{error,total,remaining:job?.remaining??total,reliability,errorTiles}
}
function draft(w:World,c:Creature,reliability:number,error:number):MapDocument{
 const m=w.s.map,stairs:NonNullable<MapDocument['stairs']>=[],landmarks:NonNullable<MapDocument['landmarks']>=[]
 if(c.id===w.s.playerId)for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){const t=m.tiles[y*m.w+x]!,o=t.observed,d=o&&Number.isFinite(o.at)&&o.at>=0&&o.at<=turnOf(w)&&w.db.terrain(o.terrain);if(d&&d.stairs&&stairs.length<128)stairs.push({x,y,label:d.label});if(m.kind==='surface'&&d&&(d.water||d.waterSource)&&landmarks.length<128)landmarks.push({x,y,kind:'water',label:d.label})}
 else{for(const s of npcRecordedMap(w,c)?.stairs??[])if(stairs.length<128)stairs.push({x:s.x,y:s.y,label:s.label});if(m.kind==='surface')for(const l of npcRecordedMap(w,c)?.landmarks??[])if(landmarks.length<128)landmarks.push({x:l.x,y:l.y,kind:'water',label:l.label})}
 const commission=c.id===w.s.playerId?(w.s.overworld?.contracts??[]).find(r=>r.kind==='surveyMap'&&!r.worldSurvey&&r.status==='active'&&r.region===mapDrawingRegion(w)&&r.mapId===m.id&&turnOf(w)>=r.accepted&&turnOf(w)<r.deadline)?.id:undefined
 const rooms=c.id===w.s.playerId?m.rooms.flatMap((r,roomIndex)=>r.discovered?[{roomIndex,type:r.type,name:r.name,x:r.x,y:r.y,w:r.w,h:r.h}]:[]):(npcRecordedMap(w,c)?.rooms??[]).map(({roomIndex,type,name,x,y,w,h})=>({roomIndex,type,name,x,y,w,h}))
 return{cartographer:{id:c.id,name:c.name,seed:w.s.seed},...(commission?{commission}:{}),...(landmarks.length?{landmarks}:{}),title:c.name+'의 탐험 지도',author:c.name,mapId:m.id,kind:m.kind,depth:m.depth,w:m.w,h:m.h,surveyedAt:turnOf(w),writtenAt:turnOf(w),reliability,error,stairs,rooms:rooms.slice(0,128)}
}
export function startMapDrawing(w:World,c:Creature,paperUid:number,inkUid:number,factor:number):string|null{
 const q=mapDrawingQuote(w,c,paperUid,inkUid,factor);if(q.error)return q.error
 if(!c.mapDrawingJob)c.mapDrawingJob={paperUid,inkUid,inkCount:c.bag.find(i=>i.uid===inkUid)!.count,signature:signature(w),region:mapDrawingRegion(w),remaining:q.total,total:q.total,draft:draft(w,c,q.reliability,q.errorTiles)}
 c.activity={kind:'drawMap',remaining:q.remaining,total:q.total,label:'지도 작성'}
 return null
}
export function cancelMapDrawing(c:Creature):string|null{if(!c.mapDrawingJob)return '취소할 지도 작업이 없다';delete c.mapDrawingJob;if(c.activity?.kind==='drawMap')delete c.activity;return null}
export function mapDrawingStep(w:World,c:Creature):boolean{
 const job=c.mapDrawingJob,act=c.activity;if(!job||!act)return true
 const q=mapDrawingQuote(w,c,job.paperUid,job.inkUid);if(q.error){const observer=w.s.creatures.find(o=>o.id===w.s.playerId);if(c.id===w.s.playerId)log(w,'warn','지도 작성 중단: '+q.error+'. 진행은 남아 있다.');else if(observer&&canSee(w,observer,c.pos))log(w,'info',knownCreatureName(w,c)+'이(가) 지도 작성을 멈췄다.');delete c.activity;return true}
 job.remaining=act.remaining;if(job.remaining>0)return false
 const paper=c.bag.find(i=>i.uid===job.paperUid)!,ink=c.bag.find(i=>i.uid===job.inkUid)!,d=structuredClone(job.draft),random=rng(w,`items.cartography.${paper.uid}`),omit=(100-d.reliability)/200
 d.rooms=d.rooms.filter(()=>!random.chance(omit)).map(r=>({...r,x:clamp(r.x+random.int(-d.error,d.error),0,d.w-r.w),y:clamp(r.y+random.int(-d.error,d.error),0,d.h-r.h)}))
 d.stairs=d.stairs?.filter(()=>!random.chance(omit)).map(s=>({...s,x:clamp(s.x+random.int(-d.error,d.error),0,d.w-1),y:clamp(s.y+random.int(-d.error,d.error),0,d.h-1)}));d.writtenAt=turnOf(w)
 if(d.landmarks)d.landmarks=d.landmarks.filter(()=>!random.chance(omit)).map(s=>({...s,x:clamp(s.x+random.int(-d.error,d.error),0,d.w-1),y:clamp(s.y+random.int(-d.error,d.error),0,d.h-1)}))
 addFalseMapFacilities(w,c,paper.uid,d)
 ink.count--;if(ink.count===0)c.bag=c.bag.filter(i=>i!==ink)
 paper.note={id:`map:${w.s.seed}:${paper.uid}`,kind:'map',regionId:job.region,source:c.name+'의 직접 작성',text:c.name+'이(가) 직접 탐험 기록을 옮겨 그린 지도다. 누락이나 위치 오차가 있을 수 있다.',writtenAt:d.writtenAt,foundAt:d.writtenAt,hop:0,mapDocument:d}
 learnRumor(w,c,paper.note);delete c.mapDrawingJob;delete c.activity
 if(c.id===w.s.playerId)log(w,'good','지도 작성을 마쳤다. 종이에 지도를 남기고 잉크1회분을 썼다.')
 else{const observer=w.s.creatures.find(o=>o.id===w.s.playerId);if(observer&&canSee(w,observer,c.pos))log(w,'info',knownCreatureName(w,c)+'이(가) 지도를 마쳤다.')}
 return true
}
