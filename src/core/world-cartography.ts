// 실제로 살펴본 월드 기록만 원래 종이에 옮긴다. 숨은 현재 지형과 처음 받은 지도는 복사하지 않는다.
import {clamp,log,rng,turnOf,type World} from './ctx'
import {capacity} from './body'
import {multiTurnFactor} from './action-time'
import {canSee,lightLevel} from './fov'
import {knownCreatureName} from './bestiary-state'
import {mapFraudRules} from './map-fraud'
import {masteryStage} from './skills'
import {cartographyDef} from './cartography'
import {worldObservation,worldWithRecordedTerrain} from './world-observations'
import {learnRumor} from './rumor-state'
import type {BiomeDef,Creature,WorldMapDocument,WorldObservation} from './types'
const signature=(w:World)=>JSON.stringify([cartographyDef(w).writing,cartographyDef(w).worldWriting,w.s.seed,w.s.overworld?.w,w.s.overworld?.h])
function records(w:World,c:Creature){const m=w.s.overworld,own=c.worldScouting,source=c.id===w.s.playerId?m?.worldObservations:own?.seed===w.s.seed&&own.w===m?.w&&own.h===m?.h?own.cells:undefined;return m?Object.keys(source??{}).flatMap(k=>{const index=Number(k),o=c.id===w.s.playerId?worldObservation(w,index):source?.[index];return Number.isSafeInteger(index)&&index>=0&&index<m.cells.length&&o&&Number.isFinite(o.at)&&o.at>=0&&o.at<=turnOf(w)&&(o.source==='arrival'||o.source==='survey')&&validCell(o.cell)?[{x:index%m.w,y:Math.floor(index/m.w),seenAt:o.at,cell:structuredClone(o.cell)}]:[]}).sort((a,b)=>b.seenAt-a.seenAt||a.y-b.y||a.x-b.x).slice(0,cartographyDef(w).worldWriting?.maxCells??0):[]}
export function worldMapDrawingQuote(w:World,c:Creature,paperUid:number,inkUid:number,factor=multiTurnFactor(w,c)){
 const d=cartographyDef(w),r=d.writing,job=c.worldMapDrawingJob,paper=c.bag.find(i=>i.uid===paperUid),ink=c.bag.find(i=>i.uid===inkUid)
 let error:string|null=null
 if(!w.s.overworld||!r||!d.worldWriting)error='내가 실제로 관찰한 세계 지도가 필요하다'
 else if(c.id!==w.s.playerId&&(!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id))error='현재 현장에 직접 있어야 한다'
 else if(c.mapDrawingJob)error='먼저 진행 중인 지역 지도를 마치거나 취소해야 한다'
 else if(w.db.body(c.body.def).kind!=='humanoid'||!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5)error='깨어서 손을 쓸 수 있어야 한다'
 else if((c.literacy??(c.literate?1:0))<r.minLiteracy)error='문해1 이상이 필요하다'
 else if(capacity(w,c,'manipulation')<r.minManipulation||capacity(w,c,'sight')<=0||!Number.isFinite(factor)||factor<=0||factor>4)error='보고 손을 움직일 수 있어야 한다'
 else if(lightLevel(w,c.pos)>=2)error='지도를 그리기에는 어둡다'
 else if(!paper||paper.def!==r.paper||paper.count!==1||paper.note)error='내용이 없는 원래 종이1장이 필요하다'
 else if(!ink||ink.uid===paperUid||ink.def!==r.ink||ink.count<1)error='지도용 잉크1회분이 필요하다'
 else if(job&&(job.paperUid!==paperUid||job.inkUid!==inkUid||job.inkCount!==ink.count||job.signature!==signature(w)))error='원래 종이·잉크·세계·작성법이 달라졌다. 이전 작업을 취소할 수 있다'
 else if(!job&&!records(w,c).length)error='직접 살펴본 월드 지형 기록이 없다. 먼저 출입구나 바깥길에서 주변을 살펴야 한다'
 const stage=masteryStage(w,c,'survival'),reliability=job?.draft.reliability??Math.min(mapFraudRules(w,c)?.reliability??100,clamp((r?.baseReliability??40)+stage*(r?.perMastery??10),0,100)),errorTiles=job?.draft.error??clamp((r?.baseError??3)-Math.floor(stage/(r?.errorEvery??2)),0,d.worldWriting?.maxError??2),total=job?.total??Math.max(1,Math.ceil((r?.turns??60)*factor))
 return{error,total,remaining:job?.remaining??total,reliability,errorTiles,cells:job?.draft.cells.length??records(w,c).length}
}
export function startWorldMapDrawing(w:World,c:Creature,paperUid:number,inkUid:number,factor:number):string|null{
 const q=worldMapDrawingQuote(w,c,paperUid,inkUid,factor);if(q.error)return q.error
 const commission=c.id===w.s.playerId?w.s.overworld?.contracts?.find(r=>r.kind==='surveyMap'&&r.worldSurvey&&r.status==='active'&&turnOf(w)>=r.accepted&&turnOf(w)<r.deadline):undefined
 if(!c.worldMapDrawingJob){const m=w.s.overworld!;c.worldMapDrawingJob={paperUid,inkUid,inkCount:c.bag.find(i=>i.uid===inkUid)!.count,signature:signature(w),remaining:q.total,total:q.total,draft:{surveyedAt:turnOf(w),...(commission?{commission:commission.id}:{}),title:c.name+'의 월드 탐험 지도',author:c.name,worldSeed:w.s.seed,w:m.w,h:m.h,writtenAt:turnOf(w),reliability:q.reliability,error:q.errorTiles,cartographer:{id:c.id,name:c.name,seed:w.s.seed},cells:records(w,c)}}}
 c.activity={kind:'drawWorldMap',remaining:q.remaining,total:q.total,label:'월드 지도 작성'};return null
}
export function cancelWorldMapDrawing(c:Creature):string|null{if(!c.worldMapDrawingJob)return '취소할 월드 지도 작업이 없다';delete c.worldMapDrawingJob;if(c.activity?.kind==='drawWorldMap')delete c.activity;return null}
export function worldMapDrawingStep(w:World,c:Creature):boolean{
 const job=c.worldMapDrawingJob,act=c.activity;if(!job||act?.kind!=='drawWorldMap')return true
 const q=worldMapDrawingQuote(w,c,job.paperUid,job.inkUid);if(q.error){if(c.id===w.s.playerId)log(w,'warn','월드 지도 작성 중단: '+q.error+'. 진행은 남아 있다.');else{const observer=w.s.creatures.find(o=>o.id===w.s.playerId);if(observer&&canSee(w,observer,c.pos))log(w,'info',knownCreatureName(w,c)+'이(가) 월드 지도 작성을 멈췄다.')}delete c.activity;return true}
 job.remaining=act.remaining;if(job.remaining>0)return false
 const paper=c.bag.find(i=>i.uid===job.paperUid)!,ink=c.bag.find(i=>i.uid===job.inkUid)!,d=structuredClone(job.draft),random=rng(w,`items.worldCartography.${paper.uid}`)
 d.cells=d.cells.filter(()=>!random.chance((100-d.reliability)/200)).map(o=>({...o,x:clamp(o.x+random.int(-d.error,d.error),0,d.w-1),y:clamp(o.y+random.int(-d.error,d.error),0,d.h-1)}));d.writtenAt=turnOf(w)
 ink.count--;if(!ink.count)c.bag=c.bag.filter(i=>i!==ink)
 paper.note={id:`world-map:${w.s.seed}:${paper.uid}`,kind:'map',source:c.name+'의 직접 작성',text:'직접 살펴본 당시 월드 지형을 옮긴 지도다. 누락과 위치 오차가 있을 수 있다.',writtenAt:d.writtenAt,foundAt:d.writtenAt,hop:0,worldMapDocument:d}
 learnRumor(w,c,paper.note);delete c.worldMapDrawingJob;delete c.activity;if(c.id===w.s.playerId)log(w,'good','월드 지도를 마쳤다. 원래 종이에 쓰고 잉크1회분을 썼다.');else{const observer=w.s.creatures.find(o=>o.id===w.s.playerId);if(observer&&canSee(w,observer,c.pos))log(w,'info',knownCreatureName(w,c)+'이(가) 월드 지도를 마쳤다.')}return true
}
function validCell(c:WorldObservation['cell']):boolean{return !!c&&Object.keys(c).every(k=>['biome','sea','altitude','temperature','veil','road','oldRoad','river','lake'].includes(k))&&typeof c.biome==='string'&&typeof c.sea==='boolean'&&[c.altitude,c.temperature,c.veil].every(Number.isFinite)&&['road','oldRoad','river','lake'].every(k=>c[k as keyof typeof c]===undefined||typeof c[k as keyof typeof c]==='boolean')}
export function validWorldMapDocument(d:WorldMapDocument):boolean{
 return !!d&&(d.surveyedAt===undefined||Number.isFinite(d.surveyedAt)&&d.surveyedAt>=0&&d.surveyedAt<=d.writtenAt)&&(d.commission===undefined||typeof d.commission==='string')&&typeof d.title==='string'&&typeof d.author==='string'&&typeof d.worldSeed==='string'&&Number.isInteger(d.w)&&d.w>0&&d.w<=256&&Number.isInteger(d.h)&&d.h>0&&d.h<=256&&Number.isFinite(d.writtenAt)&&d.writtenAt>=0&&Number.isFinite(d.reliability)&&d.reliability>=0&&d.reliability<=100&&Number.isInteger(d.error)&&d.error>=0&&d.error<=2&&!!d.cartographer&&Number.isSafeInteger(d.cartographer.id)&&d.cartographer.id>0&&typeof d.cartographer.name==='string'&&d.cartographer.seed===d.worldSeed&&Array.isArray(d.cells)&&d.cells.length<=256&&d.cells.every(o=>!!o&&Number.isInteger(o.x)&&Number.isInteger(o.y)&&o.x>=0&&o.y>=0&&o.x<d.w&&o.y<d.h&&Number.isFinite(o.seenAt)&&o.seenAt>=0&&o.seenAt<=d.writtenAt&&validCell(o.cell))
}
export function knownWorldMapDocuments(w:World){const m=w.s.overworld;return m?(w.s.knowledge.rumors??[]).flatMap(r=>{const d=r.worldMapDocument;return d&&validWorldMapDocument(d)&&d.worldSeed===w.s.seed&&d.w===m.w&&d.h===m.h&&d.writtenAt<=turnOf(w)&&d.cells.every(o=>w.db.tryGet<BiomeDef>(o.cell.biome)?.defType==='Biome')?[{id:r.id,source:r.source,document:d}]:[]}):[]}
type WorldGeographyClaim=WorldMapDocument['cells'][number]&{index:number;claimId:string;documentId:string;source:string;title:string;writtenAt:number;origin:'document'|'rumor';reliability?:number;error?:number}
export function worldMapClaims(w:World,index?:number,origin?:'document'|'rumor'){
 const m=w.s.overworld;if(!m)return[]
 const claims:WorldGeographyClaim[]=knownWorldMapDocuments(w).flatMap(r=>r.document.cells.map((o,i)=>({...o,index:o.y*m.w+o.x,claimId:r.id+':'+i,documentId:r.id,source:r.source,title:r.document.title,writtenAt:r.document.writtenAt,origin:'document' as const,reliability:r.document.reliability,error:r.document.error})))
 for(const rumor of w.s.knowledge.rumors??[]){const r=rumor.worldReport;if(rumor.kind!=='map'||!r||r.worldSeed!==w.s.seed||r.w!==m.w||r.h!==m.h||!Number.isInteger(r.pos?.x)||!Number.isInteger(r.pos?.y)||r.pos.x<0||r.pos.y<0||r.pos.x>=m.w||r.pos.y>=m.h||!Number.isFinite(r.at)||r.at<0||r.at>turnOf(w)||r.at>rumor.writtenAt||rumor.writtenAt>turnOf(w)||!validCell(r.cell)||w.db.tryGet<BiomeDef>(r.cell.biome)?.defType!=='Biome')continue;claims.push({x:r.pos.x,y:r.pos.y,cell:r.cell,seenAt:r.at,index:r.pos.y*m.w+r.pos.x,claimId:rumor.id,documentId:rumor.id,source:rumor.source,title:'동료의 월드 정찰 보고',writtenAt:rumor.writtenAt,origin:'rumor'})}
 const selected=claims.filter(o=>(index===undefined||o.index===index)&&(!origin||o.origin===origin))
 const key=(c:WorldObservation['cell'])=>JSON.stringify([c.biome,c.altitude,c.temperature,c.veil,c.sea,!!c.road,!!c.oldRoad,!!c.river,!!c.lake]),groups=new Map<number,Set<string>>()
 for(const c of selected){const group=groups.get(c.index)??new Set<string>();group.add(key(c.cell));groups.set(c.index,group)}
 return selected.map(c=>{const o=worldObservation(w,c.index);return{...c,status:o&&o.source!=='initial'?(key(o.cell)===key(c.cell)?'verified':'contradicted'):'unverified',conflict:groups.get(c.index)!.size>1}})
}
/** 경로 예상은 직접 기록을 우선하고, 없는 칸만 서로 충돌하지 않는 읽은 지도로 채운다. */
export function worldWithKnownTerrain(w:World):World{
 const m=w.s.overworld;if(!m)return w
 const projected=worldWithRecordedTerrain(w),claims=new Map(worldMapClaims(w,undefined,'document').filter(c=>!c.conflict).map(c=>[c.index,c]))
 projected.s.overworld!.cells=projected.s.overworld!.cells.map((cell,index)=>{const c=claims.get(index);return !worldObservation(w,index)&&c?{...cell,...c.cell}:cell})
 return projected
}
