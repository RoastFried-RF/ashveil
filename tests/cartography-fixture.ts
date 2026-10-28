import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {makeItem,addToBag} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {tileAt,turnOf} from '../src/core/ctx'
import type {Rumor,MapDocument} from '../src/core/types'
export function initialMapReport(mapId='crypt2',x=7,id='initial-surveyor-map'):Rumor{
 const mapDocument:MapDocument={title:'낡은 조사 지도',author:'이전 조사자',mapId,kind:'dungeon',depth:2,w:48,h:36,writtenAt:0,reliability:60,error:2,rooms:[{roomIndex:0,name:'서쪽 창고',x,y:8,w:5,h:4}]}
 return{id,kind:'room',mapId,mapDepth:2,mapW:48,mapH:36,roomName:'서쪽 창고',text:'이전 조사자가 그린 창고 위치다. 가서 확인하기 전에는 모른다.',source:'원래 조사 지도 쪽지',hop:0,writtenAt:0,foundAt:0,mapDocument}
}
export function cartographyFixture(){
 const d=conditionThoughtsFixture('cartography-proof');d.p.literacy=2;d.p.literate=true;d.s.knowledge.rumors=[]
 // 초기 독서 장면은 글씨를 실제로 읽을 밝기의 낮 바깥이다.
 tileAt(d.w,d.p.pos).roof=false;invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const addReport=(report:Rumor)=>{const note=makeItem(d.w,'Item.Note');note.note=structuredClone(report);if(addToBag(d.w,d.p,note))throw Error('original map note');return note}
 return{...d,addReport}
}
export type CartographyPhase='unread'|'read'|'conflict'|'verified'|'contradicted'|'pending'
export function cartographyNativeFixture(phase:CartographyPhase){
 const d=cartographyFixture(),mapId=phase==='verified'||phase==='contradicted'?d.s.map.id:'crypt2',first=initialMapReport(mapId),note=d.addReport(first)
 if(phase==='verified'||phase==='contradicted'){
  first.mapDocument!.kind='surface';first.mapDocument!.depth=0;first.mapDocument!.w=d.s.map.w;first.mapDocument!.h=d.s.map.h;note.note=structuredClone(first)
  // 명시적인 유효 초기 탐험 기록이다. 화면 안에서 과거 탐험을 실행했다는 뜻이 아니다.
  const index=d.s.map.rooms.findIndex(r=>r.type!=='entry'),room=d.s.map.rooms[index]!;room.discovered=true
  note.note!.roomName=room.name;note.note!.text='이전 조사자가 그린 '+room.name+'의 위치다. 직접 탐험한 기록과 비교할 수 있다.'
  const shift=phase==='verified'?0:room.x+room.w+5<=d.s.map.w?5:-5
  note.note!.mapDocument!.rooms=[{roomIndex:index,name:room.name,x:room.x+shift,y:room.y,w:room.w,h:room.h}]
  for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++){const t=tileAt(d.w,{x,y});t.seen=true;t.observed={terrain:t.t,at:turnOf(d.w)-100}}
 }
 const initialSecond=phase==='conflict'?d.addReport(initialMapReport(mapId,12,'second-map-report')):undefined
 const initialDocument=structuredClone(note.note!.mapDocument!),initialTime=d.s.time
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 if(phase!=='unread')act({type:'read',uid:note.uid})
 let secondUid:number|undefined
 if(initialSecond){secondUid=initialSecond.uid;act({type:'read',uid:initialSecond.uid})}
 if(phase==='pending')act({type:'rest',turns:20},2)
 updatePlayerVision(d.w,d.p)
 return{...d,note,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,noteUid:note.uid,initialDocument,secondUid,mapId,pending:phase==='pending'}}
}
