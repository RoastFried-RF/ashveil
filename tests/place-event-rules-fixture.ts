import {loadDb} from '../tools/loadContent'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {updatePlayerVision} from '../src/core/fov'
import {turnOf,type World} from '../src/core/ctx'
const {db,report}=loadDb(['sample-patrol']);if(report.errors.length)throw Error(report.errors.join('\n'))
export function placeEventRulesNativeFixture(phase:'before'|'dispatched'|'waiting'|'pending'){
 const w:World={db,s:newGame(db,{seed:'place-rule-ui',overworld:true,mods:db.loadedMods})};runUntilInput(w)
 const at=3599900;w.s.time=at;w.s.weather='clear';w.s.weatherUntil=1e12
 for(const c of w.s.creatures)c.nextAct=at
 const home=w.s.map.waypoints!.homeFire;for(const light of w.s.map.lights)if(light.kind==='campfire'&&light.pos.x===home.x&&light.pos.y===home.y)light.off=true
 const m=w.s.overworld!,cell=w.s.map.worldCell??m.position;m.cells[cell.y*m.w+cell.x].temperature=20
 const fresh:World={db,s:deserialize(serialize(w.s))};updatePlayerVision(fresh,fresh.s.creatures.find(c=>c.id===fresh.s.playerId)!)
 const initialIds=fresh.s.creatures.map(c=>c.id),initialNext=fresh.s.nextId;let inputs=0
 const wait=()=>{const e=playerAct(fresh,{type:'wait'});if(e)throw Error(e);inputs++}
 if(phase==='dispatched'||phase==='waiting')wait()
 if(phase==='waiting'){for(let i=0;!fresh.s.creatures.some(c=>c.faction==='reavers'&&c.ai.mode==='patrol'&&(c.ai.waitUntil??0)>turnOf(fresh))&&i<160;i++)wait();if(!fresh.s.creatures.some(c=>c.faction==='reavers'&&c.ai.mode==='patrol'&&(c.ai.waitUntil??0)>turnOf(fresh)))throw Error('actual sample patrol wait not reached')}
 if(phase==='pending'){const e=playerAct(fresh,{type:'rest',turns:60},1);if(e)throw Error(e)}
 return{w:fresh,proof:{phase,initialTime:at,actualHeadlessWaitInputs:inputs,mods:db.loadedMods,declaredInitialWarmCell:20,declaredHomeFireUnlit:true,notClaimingPastTravelOrWeather:true,initialIds,initialNext},party:()=>fresh.s.creatures.filter(c=>c.faction==='reavers'&&c.ai.mode==='patrol')}
}
