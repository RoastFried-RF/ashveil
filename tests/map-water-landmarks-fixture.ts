import {mapWritingFixture} from './map-writing-fixture'
import {DIRS} from '../src/core/geom'
import {inBounds,terrainAt,turnOf} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
export function mapWaterFixture(){
 const d=mapWritingFixture(),m=d.s.map
 const choices=m.tiles.flatMap((t,index)=>{const water=d.w.db.terrain(t.t);if(!water.water&&!water.waterSource)return[];const pos={x:index%m.w,y:Math.floor(index/m.w)},bank=DIRS.map(v=>({x:pos.x+v.x,y:pos.y+v.y})).find(p=>p.x>2&&p.y>2&&p.x<m.w-3&&p.y<m.h-3&&inBounds(d.w,p)&&terrainAt(d.w,p).passable&&!terrainAt(d.w,p).water&&!m.rooms.some(r=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.w&&p.y<r.y+r.h));return bank?[{pos,bank,terrain:water.id,label:water.label}]:[]})
 const water=choices[0];if(!water)throw Error('원래 지상의 실제 물가')
 // 유효 초기 미탐색 물가와 원래 종이/잉크다. 이전 이동/독서/관찰 입력을 실행했다고 주장하지 않는다.
 d.p.pos={...water.bank};d.p.nextAct=d.s.time;for(const t of m.tiles){t.seen=false;delete t.observed}for(const r of m.rooms)r.discovered=false;d.s.visible=[]
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 return {...d,water,act}
}
export type MapWaterPhase='initial'|'observed'|'drawn'|'read'|'pending'
export function mapWaterNativeFixture(phase:MapWaterPhase){
 const d=mapWaterFixture(),initialTime=d.s.time
 const act=d.act
 if(phase!=='initial')act({type:'wait'})
 if(phase==='drawn'||phase==='read')act(d.action)
 if(phase==='read')act({type:'read',uid:d.paper.uid})
 if(phase==='pending')act(d.action,2)
 return {...d,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,completedWorldTurns:turnOf(d.w)-Math.floor(initialTime/100),water:d.water,paperUid:d.paper.uid,inkUid:d.ink.uid,initialUnexploredBankExplicit:true}}
}
