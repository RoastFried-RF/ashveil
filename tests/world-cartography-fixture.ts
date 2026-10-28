import {worldObservationsFixture} from './world-observations-fixture'
import {TURNS_PER_DAY,TURNS_PER_HOUR,tileAt} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {player} from '../src/core/ctx'
export function worldCartographyFixture(){
 const d=worldObservationsFixture(),{s,p}=d
 // 더 늦은 실제 낮의 유효 초기 장면이다. 옛 관찰 시각 이전으로 되돌리지 않는다.
 s.time=(Math.floor(s.time/100/TURNS_PER_DAY)+1)*TURNS_PER_DAY*100+12*TURNS_PER_HOUR*100;p.nextAct=s.time;s.weather='clear';s.map.lights=[];p.literacy=2;p.literate=true;p.needs.nutritionDay=Math.floor(s.time/100/TURNS_PER_DAY);p.needs.stress=0;p.bag=[];p.equip={}
 tileAt(d.w,p.pos)!.roof=false;invalidateLights(d.w);updatePlayerVision(d.w,p)
 const paper=makeItem(d.w,'Item.Note'),ink=makeItem(d.w,'Item.Ink',3);if(addToBag(d.w,p,paper)||addToBag(d.w,p,ink))throw Error('world map material space')
 const w={db:d.w.db,s:deserialize(serialize(s))},actor=player(w),act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(w,a,budget);if(e)throw Error(e)}
 return{w,s:w.s,p:actor,m:w.s.overworld!,paper:actor.bag.find(i=>i.uid===paper.uid)!,ink:actor.bag.find(i=>i.uid===ink.uid)!,act,index:d.index,action:{type:'drawWorldMap' as const,paperUid:paper.uid,inkUid:ink.uid}}
}
export type WorldCartographyPhase='quote'|'observed'|'drawn'|'stopped'|'pending'
export function worldCartographyNativeFixture(phase:WorldCartographyPhase){
 const d=worldCartographyFixture(),initialTime=d.s.time
 if(phase!=='quote')d.act({type:'surveyWorld'})
 if(phase==='drawn')d.act(d.action)
 if(phase==='stopped'){d.act(d.action,10);d.act({type:'stopActivity'})}
 if(phase==='pending')d.act(d.action,2)
 return{...d,proof:{phase,initialTime,actualElapsedTU:d.s.time-initialTime,paperUid:d.paper.uid,inkUid:d.ink.uid,inkBefore:3,initialDayAdvancedWithoutRewinding:true}}
}
