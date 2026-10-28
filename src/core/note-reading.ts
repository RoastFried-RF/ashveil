// 한가한 NPC가 실제 소유한 원래 쪽지만 읽는다. 읽기 전의 내용은 개인/플레이어 지식에 넣지 않는다.
import {noteReadError} from './rumors'
import {rumorList} from './rumor-state'
import {merchantMapReadingAction} from './merchant-map-reading'
import type {World} from './ctx'
import type {Creature} from './types'
import type {Action} from './actions'
export function npcNoteAction(w:World,c:Creature):Action|null{
 if(c.id===w.s.playerId||c.ai.route?.length)return null
 const known=rumorList(w,c)
 const note=c.bag.find(i=>i.note&&!known.some(r=>r.id===i.note!.id&&(!w.s.overworld||(r.regionId??'Region.GreyCloister')===(i.note!.regionId??'Region.GreyCloister')))&&!noteReadError(w,c,i))
 return note?{type:'read',uid:note.uid}:merchantMapReadingAction(w,c)
}
