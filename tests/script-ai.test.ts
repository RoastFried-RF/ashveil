import {beforeAll,describe,it,expect} from 'vitest'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {configureScriptHost} from '../src/core/script-hooks'
import {scriptAITargetScores} from '../src/core/script-ai'
import {capacity} from '../src/core/body'
import {aiDecide} from '../src/core/ai'
import {newGame,SAVE_VERSION} from '../src/core/game'
import {player,tileAt,type World} from '../src/core/ctx'
import {createCreature} from '../src/core/creatures'
import {invalidateLights} from '../src/core/fov'
import {deserialize,serialize,stateHash} from '../src/core/save'
import type {ScriptHost} from '../src/core/script-contracts'
let host:ScriptHost
beforeAll(async()=>{host=await createQuickJSScriptHost()})
const preferred='ctx.modState.calls=(ctx.modState.calls??0)+1;return e.options.map(o=>({targetId:o.targetId,bonus:ctx.view.creatures.find(c=>c.id===o.targetId).faction==="coalition"?30:0}))'
function setup(body=preferred,creature='Creature.Reaver'){
 const id='ai-worker-test',loaded=loadMods([...readPackages(),{manifest:{id,name:'AI 검사',version:'1',dependencies:['core'],scripts:{stage:2,entry:'scripts/main.js'}},defs:[],patches:[{op:'add',target:creature,path:'/considerationWorker',value:id+':Choice'}],scripts:[{file:'scripts/main.js',source:'export default defineMod({workers:{Choice:{kind:"AIConsiderationWorker",score(ctx,e){'+body+'}}}})'}]}],[id]);expect(loaded.report.errors).toEqual([]);expect(configureScriptHost(loaded.db,host)).toEqual([])
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-visible-ai-worker',background:'Bg.Hunter'})},p=player(w);p.pos={x:20,y:20}
 const actor=createCreature(w,creature,{x:20,y:21}),other=createCreature(w,'Creature.SettlementGuard',{x:21,y:20});w.s.creatures=[p,actor,other];w.s.map.lights=[];w.s.map.ambient=1;w.s.weather='clear';w.s.weatherUntil=1e12
 for(let y=17;y<=24;y++)for(let x=17;x<=24;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
 for(const c of w.s.creatures){c.traits=[];c.abilities=[];c.background=undefined;c.asleep=false;c.unconscious=false;c.needs.kcal=1000;c.needs.waterDeficit=0;c.needs.fatigue=10;c.needs.energy=100;c.needs.bodyTemp=37;c.ai.morale=1;c.home=undefined;c.facing=0}
 actor.faction='reavers';other.faction='coalition';invalidateLights(w);return{w,p,actor,other,id}
}
describe('현재 실제 보이는 적 후보의 단계2 AI 점수',()=>{
 it('실제 후보의 정수 보정만 저장하고 코어 난수/몸/아이템은 유지한다',()=>{const d=setup(),rng=structuredClone(d.w.s.rng),bodies=structuredClone(d.w.s.creatures.map(c=>c.body)),uid=d.w.s.nextId,scores=scriptAITargetScores(d.w,d.actor,[d.other,d.p]);expect(scores?.get(d.other.id)).toBe(30);expect(scores?.get(d.p.id)).toBe(0);expect(d.w.s.scriptState!.mods[d.id]).toEqual({calls:1});for(const[k,v]of Object.entries(rng))expect(d.w.s.rng[k as keyof typeof rng]).toEqual(v);expect(d.w.s.creatures.map(c=>c.body)).toEqual(bodies);expect(d.w.s.nextId).toBe(uid)})
 it('실제 AI 판단이 점수가 높은 기존 적을 공격 대상으로 선택한다',()=>{const d=setup(),uid=d.w.s.nextId,ids=d.w.s.creatures.map(c=>c.id),action=aiDecide(d.w,d.actor);expect(action).toMatchObject({type:'attack',target:d.other.id});expect(d.actor.ai.target).toBe(d.other.id);expect(d.w.s.nextId).toBe(uid);expect(d.w.s.creatures.map(c=>c.id)).toEqual(ids)})
 it('기계형 AI도 같은 실제 적 후보 점수를 사용하고 전원/부품을 만들지 않는다',()=>{const d=setup(preferred,'Creature.TenderDrone');d.actor.body.machine!.alert=2;const machine=structuredClone(d.actor.body.machine),uid=d.w.s.nextId,action=aiDecide(d.w,d.actor);expect(action,JSON.stringify({machine:d.actor.body.machine,hp:d.actor.hp,cap:capacity(d.w,d.actor,'consciousness'),mods:d.w.s.scriptState!.mods,mode:d.actor.ai.mode})).toMatchObject({type:'attack',target:d.other.id});expect(d.actor.body.machine).toEqual({...machine,errorLoop:undefined,lastAction:action});expect(d.w.s.nextId).toBe(uid)})
 it('미리보기는 같은 점수를 반환하지만 전체 상태를 바꾸지 않는다',()=>{const d=setup(),before=stateHash(d.w.s);expect(scriptAITargetScores(d.w,d.actor,[d.p,d.other],true)?.get(d.other.id)).toBe(30);expect(stateHash(d.w.s)).toBe(before)})
 it('안 보이는 적·항복·아군·사본은 입력 뷰/후보에 들어가지 않는다',()=>{const d=setup('ctx.modState.targets=e.options.map(o=>o.targetId);return []');d.other.pos={x:23,y:21};tileAt(d.w,{x:21,y:21}).t='Terrain.RuinWall';tileAt(d.w,{x:22,y:21}).t='Terrain.RuinWall';invalidateLights(d.w);const copy=structuredClone(d.p);copy.id=99999;const friend=createCreature(d.w,'Creature.Reaver',{x:19,y:21});d.w.s.creatures.push(friend);scriptAITargetScores(d.w,d.actor,[d.p,d.other,copy,friend]);expect(d.w.s.scriptState!.mods[d.id]).toEqual({targets:[d.p.id]})})
 it.each(['return [{targetId:999999,bonus:30}]','return [{targetId:e.options[0].targetId,bonus:1.5}]','return [{targetId:e.options[0].targetId,bonus:10},{targetId:e.options[0].targetId,bonus:20}]','return [{type:"spawnCreature"}]','return 2'])('잘못된 목록은 모드 데이터/난수도 적용하지 않고 기본 목표를 선택한다 (%s)',body=>{const d=setup('ctx.modState.bad=true;ctx.rng.int(1,9);'+body),rng=structuredClone(d.w.s.rng),uid=d.w.s.nextId;expect(scriptAITargetScores(d.w,d.actor,[d.p,d.other])).toBeNull();expect(d.w.s.scriptState!.mods).toEqual({});expect(d.w.s.rng).toEqual(rng);expect(d.w.s.scriptState!.disabled).toEqual([d.id+':worker.Choice.score']);expect(aiDecide(d.w,d.actor)).toMatchObject({type:'attack',target:d.p.id});expect(d.w.s.nextId).toBe(uid)})
 it('정수 가산은 후보마다±30으로 제한한다',()=>{const d=setup('return e.options.map((o,n)=>({targetId:o.targetId,bonus:n?999:-999}))'),scores=scriptAITargetScores(d.w,d.actor,[d.p,d.other]);expect([...scores!.values()]).toEqual([-30,30])})
 it('예산 초과는 점수 메서드만 중단하며 다음 판단은 기본 목표로 진행한다',()=>{const d=setup('while(true){}');expect(scriptAITargetScores(d.w,d.actor,[d.p,d.other])).toBeNull();expect(d.w.s.scriptState!.disabled).toEqual([d.id+':worker.Choice.score']);expect(aiDecide(d.w,d.actor)).toMatchObject({type:'attack',target:d.p.id})})
 it('아무 적도 없거나 원래 배우가 사본/수면이면 VM을 호출하지 않는다',()=>{for(const mode of ['none','copy','sleep']as const){const d=setup(),before=stateHash(d.w.s),actor=mode==='copy'?structuredClone(d.actor):d.actor;if(mode==='sleep')actor.asleep=true;const actualBefore=stateHash(d.w.s);expect(scriptAITargetScores(d.w,actor,mode==='none'?[]:[d.p,d.other])).toBeNull();expect(stateHash(d.w.s)).toBe(actualBefore);if(mode!=='sleep')expect(actualBefore).toBe(before)}})
 it('각인 복원 뒤 같은 실제 판단과 전체 상태를 재현한다',()=>{const d=setup(),other:World={db:d.w.db,s:deserialize(serialize(d.w.s))};d.w.s=deserialize(serialize(d.w.s));const actor=d.w.s.creatures.find(c=>c.id===d.actor.id)!,copy=other.s.creatures.find(c=>c.id===d.actor.id)!;expect(aiDecide(d.w,actor)).toEqual(aiDecide(other,copy));expect(JSON.parse(serialize(d.w.s))).toEqual(JSON.parse(serialize(other.s)))})
 it('163각인에는 버전만 올리고 과거 AI 점수를 만들지 않는다',()=>{const {db}=loadMods(readPackages(),[]),s=newGame(db,{seed:'ai-worker-legacy'});s.version=163;expect(deserialize(JSON.stringify(s))).toEqual({...s,version:SAVE_VERSION});expect(s.scriptState).toBeUndefined()})
})
