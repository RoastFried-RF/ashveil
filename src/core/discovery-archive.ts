// A historical summary of what this character knew/believed. No truth lookup or new-life grants.
import {bestiaryDetails,bestiaryEntry,bestiaryKnown,bestiaryStage} from './bestiary-state'
import {turnOf,type World} from './ctx'
import {pillBelief} from './knowledge-state'
import type {Creature,DiscoveryArchive,DiscoveryKind,InteractionDef} from './types'
export const DISCOVERY_KIND_LABEL:Record<DiscoveryKind,string>={bestiary:'도감',identification:'감별',recipe:'제작법',book:'완독',map:'지도·탐험',fieldNote:'현장 기록',rumor:'소문·문서',interaction:'상호작용'}
export function buildDiscoveryArchive(w:World,c:Creature):DiscoveryArchive|undefined{
 if(c.id!==w.s.playerId)return
 const records:DiscoveryArchive['records']=[],keys=new Set<string>();let omitted=0
 const add=(kind:DiscoveryKind,id:string,title:string,details:string[])=>{
  const key=kind+':'+id;if(keys.has(key))return;keys.add(key)
  if(records.length>=1000){omitted++;return}
  records.push({kind,id,title:title.slice(0,200),details:details.filter(Boolean).slice(0,16).map(line=>line.slice(0,1200))})
 }
 const label=(id:string)=>w.db.tryGet(id)?.label??id,k=w.s.knowledge
 for(const id of Object.keys(k.bestiary).sort()){
  if(!w.db.has(id)||!bestiaryKnown(w,id,c))continue
  const entry=bestiaryEntry(w,id),stage=bestiaryStage(w,id,c)
  add('bestiary',entry?.id??id,stage>0?entry?.label??label(id):entry?.silhouette??'정체를 모르는 존재',bestiaryDetails(w,id,c))
 }
 // The seed's secret appearance/effect table is deliberately never consulted.
 for(const id of [...new Set([...Object.keys(k.pillKnown),...Object.keys(k.pillBeliefs??{})])].sort()){
  const belief=pillBelief(w,id);if(!belief||!belief.belief&&!belief.evidence.length&&!belief.ruledOut.length)continue
  add('identification',id,label(id),[belief.belief?`${belief.confidence==='certain'?'당시 확신':'당시 추정'}: ${label(belief.belief)}`:'정체를 확정하지 못함',...(belief.ruledOut.length?['배제한 효능: '+belief.ruledOut.map(label).join(', ')]:[]),...belief.evidence.slice(-3).map(e=>e.text)])
 }
 for(const id of [...new Set(c.recipes??[])].sort())add('recipe',id,label(id),['이 생애에서 알고 있던 제작법 · 다음 인물에게 능력을 지급하지 않는다'])
 for(const id of [...new Set(c.booksRead??[])].sort())add('book',id,label(id),['완독 기록 · 기록했다는 사실이 해석의 정확함을 보장하지 않는다'])
 const maps=[{region:w.s.overworld?.currentRegion??'',map:w.s.map},...Object.values(w.s.maps).map(map=>({region:w.s.overworld?.currentRegion??'',map})),...Object.entries(w.s.overworld?.scenes??{}).flatMap(([region,scene])=>[scene.map,...Object.values(scene.maps)].map(map=>({region,map}))) ]
 for(const{region,map}of maps.sort((a,b)=>(a.region+':'+a.map.id)<(b.region+':'+b.map.id)?-1:(a.region+':'+a.map.id)>(b.region+':'+b.map.id)?1:0)){
  const seen=map.tiles.filter(t=>t.seen).length;if(!seen)continue
  add('map',region+':'+map.id,map.name,[`직접 본 칸 ${seen}개 · ${map.depth>0?'지하 '+map.depth+'층':'지상'}`,'관찰하지 않은 지형과 현재의 숨은 변화는 기록하지 않는다'])
 }
 for(const memory of c.fieldMaps??[])add('map','memory:'+String(memory.region)+':'+memory.mapId,memory.name,[`당시 기록한 방 ${memory.rooms.length}개 · 계단 ${memory.stairs.length}개`,...memory.rooms.map(room=>`${room.name} (${room.x}, ${room.y})`),...memory.stairs.map(stair=>`${stair.label} (${stair.x}, ${stair.y})`)])
 for(const[key,observation]of Object.entries(w.s.overworld?.worldObservations??{}).sort(([a],[b])=>Number(a)-Number(b))){
  const i=Number(key),m=w.s.overworld!;if(!Number.isSafeInteger(i)||i<0||i>=m.w*m.h||observation.at>turnOf(w))continue
  const cell=observation.cell;add('map','world:'+key,`세계 지도 (${i%m.w}, ${Math.floor(i/m.w)})`,[`당시 관찰: ${label(cell.biome)} · ${cell.sea?'바다':'육지'}`,`관찰 ${observation.at}턴 · 고도 ${cell.altitude} · 기온 ${cell.temperature}°C`,'저장된 관찰만 남긴다. 현재의 숨은 지형은 다시 조회하지 않는다'])
 }
 for(const note of c.fieldNotes??[])add('fieldNote',note.key,note.title,[note.text])
 for(const rumor of k.rumors??[]){
  if(rumor.foundAt>turnOf(w))continue
  const doc=rumor.mapDocument??rumor.worldMapDocument
  add('rumor',rumor.id,doc?.title??rumor.text,[`출처: ${rumor.source} · 전언 ${rumor.hop}단계`,rumor.text,...(doc?[`문서 주장 · 작성자 ${doc.author} · 신뢰도 ${doc.reliability} · 오차 ${doc.error}`]:[]),'당시 들은 주장이다. 현재 사실이나 정확성을 보증하지 않는다'])
 }
 for(const discovery of k.interactions??[]){const def=w.db.tryGet<InteractionDef>(discovery.id);add('interaction',discovery.id,def?.label??discovery.id,[({experience:'직접 경험',witness:'목격',book:'문헌',rumor:'소문'})[discovery.method]+' · '+discovery.source,def?.formula??''])}
 return{format:1,at:turnOf(w),records,omitted}
}
