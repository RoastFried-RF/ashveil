import {scoutRoomNativeFixture} from './scout-room-rumors-fixture'
import {npcFieldMap} from '../src/core/npc-map-memory'
import {turnOf} from '../src/core/ctx'
export type ScoutStairPhase='returned'|'heard'|'conflict'|'pending'
export function scoutStairNativeFixture(phase:ScoutStairPhase){
 const d=scoutRoomNativeFixture('returned',initial=>{
  if(phase!=='conflict')return
  const p=initial.initialNpcPos
  // 과거에 읽은 유효 초기 지도이며 귀환/대화 중간에 새 지식을 넣지 않는다.
  initial.s.knowledge.rumors!.push({id:'initial-old-stair-map',kind:'map',regionId:initial.s.overworld?.currentRegion,mapId:initial.s.map.id,text:'예전 행상이 그린 계단 위치',source:'이전에 읽은 행상 지도',hop:0,writtenAt:0,foundAt:0,mapDocument:{title:'오래된 계단 약도',author:'이전 행상',mapId:initial.s.map.id,kind:initial.s.map.kind,depth:initial.s.map.depth,w:initial.s.map.w,h:initial.s.map.h,writtenAt:0,reliability:40,error:3,rooms:[],stairs:[{...p,label:'위로 이어진다는 계단'}]}})
 })
 const stair=npcFieldMap(d.w,d.npc)!.stairs.find(s=>s.x===d.initialNpcPos.x&&s.y===d.initialNpcPos.y)!
 if(!stair)throw Error('실제 원래 계단 관찰 없음')
 if(phase!=='returned')d.act({type:'talk',target:d.npc.id})
 if(phase==='pending')d.act({type:'rest',turns:20},2)
 return {...d,stair,proof:{...d.proof,phase,actualTurns:turnOf(d.w)-d.proof.initialTime/100,actualStairObservationAt:stair.seenAt}}
}
