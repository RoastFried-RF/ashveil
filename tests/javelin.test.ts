import {describe,expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {aiDecide} from '../src/core/ai'
import {addWound} from '../src/core/body'
import {botDecide} from '../src/core/bot'
import {startCraft} from '../src/core/crafting'
import {player,tileAt,turnOf} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct,SAVE_VERSION} from '../src/core/game'
import {addToBag,equip,itemDef,makeItem,quickCount,quickItem} from '../src/core/items'
import {stateItemEntries} from '../src/core/missing-items'
import {Rng,seedState} from '../src/core/rng'
import {deserialize,serialize} from '../src/core/save'
import {configureScriptHost} from '../src/core/script-hooks'
import {throwItems,throwQuote} from '../src/core/throwing'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import {readPackages} from '../tools/loadContent'
import {prisonerFixture} from './prisoner-fixture'

function setup(held:'bag'|'main'|'off'='bag'){
 const d=prisonerFixture();d.s.overworld=undefined;d.s.maps={};d.s.offCreatures={};d.s.map.kind='dungeon';d.s.map.depth=3;d.s.map.ambient=1;d.s.map.lights=[]
 d.p.bag=[];d.p.equip={};d.p.traits=[];d.p.abilities=[];d.p.needs.energy=100;d.target.pos={x:24,y:20};d.target.equip={};d.target.bag=[];d.target.hp=100;d.target.reactPolicy='none';d.target.nextAct=1e12;d.target.ai.mode='hunt';d.target.ai.target=d.p.id;d.target.ai.alertTurn=turnOf(d.w)
 for(let y=12;y<30;y++)for(let x=12;x<30;x++)Object.assign(tileAt(d.w,{x,y}),{t:'Terrain.Earth',roof:true,items:[],spores:undefined})
 const javelin=makeItem(d.w,'Item.Javelin');Object.assign(javelin,{quality:2,dirty:true,durability:63,edge:72});if(held==='bag')expect(addToBag(d.w,d.p,javelin)).toBe(0);else d.p.equip[held]=javelin
 invalidateLights(d.w);updatePlayerVision(d.w,d.p);return {...d,javelin}
}
type Fixture=ReturnType<typeof setup>
function attack(d:Fixture){return perform(d.w,d.p,{type:'throwAttack',uid:d.javelin.uid,target:d.target.id})}
function thrown(d:Fixture){return tileAt(d.w,d.target.pos).items.filter(i=>i.def==='Item.Javelin')}
function finish(d:Fixture){for(let n=0;d.p.activity&&n<1000;n++)activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined()}
function unchanged(d:Fixture){const before=serialize(d.s);expect(attack(d).ok).toBe(false);expect(serialize(d.s)).toBe(before)}
describe('같은 회수형 투창과 실제 손의 투척',()=>{
 it('정본 투척 찌르기11/관통15와 등록한1×4·최대1을 쓴다',()=>{const d=setup(),def=itemDef(d.w,d.javelin);expect(def.size).toEqual([1,4]);expect(def.maxStack).toBe(1);expect(def.twoHanded).not.toBe(true);expect(def.throwable).toMatchObject({range:8,effective:4,attack:{damageType:'stab',damage:11,pen:15}});expect(def.attacks![0].family).toBe('spear')})
 it('미리보기는 실제 무기·팔을 읽고 전체 상태/UID/난수를 바꾸지 않는다',()=>{const d=setup('main'),before=serialize(d.s),q=throwQuote(d.w,d.p,d.javelin.uid,d.target.id);expect(q.error).toBeNull();expect(q.item).toBe(d.javelin);expect(q.wield).toMatchObject({arm:'rarm',throwing:true,twoHanded:false});expect(serialize(d.s)).toBe(before)})
 it('주무기 투척은 같은 UID의 슬롯을 비우고 원래 상태로 한 자루만 착지한다',()=>{const d=setup('main'),before=structuredClone(d.javelin);expect(attack(d)).toEqual({ok:true,tu:100});expect(d.p.equip.main).toBeUndefined();expect(d.p.bag).toEqual([]);expect(thrown(d)).toEqual([before]);expect(stateItemEntries(d.s).filter(e=>e.item.uid===d.javelin.uid)).toHaveLength(1);expect(d.p.needs.energy).toBe(93)})
 it('보조 손의 투창은 주무기 도끼를 그대로 두고 왼팔로 던진다',()=>{const d=setup('off'),axe=makeItem(d.w,'Item.Hatchet');d.p.equip.main=axe;const before=structuredClone(axe);expect(throwQuote(d.w,d.p,d.javelin.uid,d.target.id).wield?.arm).toBe('larm');expect(attack(d).ok).toBe(true);expect(d.p.equip.off).toBeUndefined();expect(d.p.equip.main).toEqual(before);expect(thrown(d)[0]!.uid).toBe(d.javelin.uid)})
 it('오른손을 못 쓰면 오른손 투창을 왼손으로 자동 순간이동하지 않는다',()=>{const d=setup('main');d.p.body.missing.push('RightUpperArm');unchanged(d)})
 it('오른팔을 잃어도 왼손에 든 투창은 실제 왼팔로 던진다',()=>{const d=setup('off');d.p.body.missing.push('RightUpperArm');expect(attack(d).ok).toBe(true);expect(thrown(d)).toHaveLength(1)})
 it('왼손을 못 쓰면 왼손 투창을 오른손으로 대신 던지지 않는다',()=>{const d=setup('off');d.p.body.missing.push('LeftUpperArm');unchanged(d)})
 it('배낭의 원래 투창은 남은 왼팔로 던지며 주무기를 바꾸지 않는다',()=>{const d=setup(),axe=makeItem(d.w,'Item.Hatchet');d.p.equip.main=axe;d.p.body.missing.push('RightUpperArm');expect(throwQuote(d.w,d.p,d.javelin.uid,d.target.id).wield?.arm).toBe('larm');expect(attack(d).ok).toBe(true);expect(d.p.equip.main).toBe(axe)})
 it('반쯤 장착한 물품과 착용 의복 위치의 물품은 투척 공급에서 제외한다',()=>{for(const half of [true,false]){const d=setup('main');if(half)d.javelin.half=true;else{delete d.p.equip.main;d.p.equip.chest=d.javelin}expect(throwItems(d.p)).toEqual([]);unchanged(d)}})
 it('닫힌 마대 안의 투창을 순간적으로 꺼내 던지지 않는다',()=>{const d=setup(),sack=makeItem(d.w,'Item.Sack');d.p.bag=[];sack.contents=[{...d.javelin,gx:0,gy:0,rot:true}];addToBag(d.w,d.p,sack);unchanged(d)})
 it('부서진 투척 무기는 상태/난수/슬롯을 바꾸지 않고 거절한다',()=>{const d=setup('main');d.javelin.durability=0;unchanged(d)})
 it('막힌 경로에서는 손에 든 원래 투창이 남는다',()=>{const d=setup('main');tileAt(d.w,{x:22,y:20}).t='Terrain.KtWall';invalidateLights(d.w);updatePlayerVision(d.w,d.p);unchanged(d)})
 it('상한 밖에서는 한 자루나 행동 비용을 소비하지 않는다',()=>{const d=setup('main');d.target.pos={x:29,y:20};invalidateLights(d.w);updatePlayerVision(d.w,d.p);unchanged(d)})
 it('빗나가도 같은 한 자루가 남고 화살/탄약을 만들지 않는다',()=>{const d=setup('main');for(let n=0;n<1000;n++){const seed=seedState('javelin-miss-'+n,'combat');if(new Rng([...seed]).int(0,99)===99){d.s.rng.combat=seed;break}}const hp=d.target.hp;expect(attack(d).ok).toBe(true);expect(d.target.hp).toBe(hp);expect(thrown(d)).toHaveLength(1);expect(tileAt(d.w,d.target.pos).items.map(i=>i.def)).toEqual(['Item.Javelin']);expect(d.target.body.wounds.some(w=>w.foreign)).toBe(false)})
 it('같은 투창을 실제로 주워 장착해도 UID/품질/내구/날을 복제하지 않는다',()=>{const d=setup('main');d.target.hp=3;d.s.rng.combat=[0,0,0,0];expect(playerAct(d.w,{type:'throwAttack',uid:d.javelin.uid,target:d.target.id})).toBeNull();expect(d.target.alive).toBe(false);for(let n=0;n<4;n++)expect(playerAct(d.w,{type:'move',dir:2})).toBeNull();expect(playerAct(d.w,{type:'pickup',uid:d.javelin.uid})).toBeNull();expect(thrown(d)).toEqual([]);expect(equip(d.w,d.p,d.javelin.uid)).toBeNull();expect(d.p.equip.main).toMatchObject({uid:d.javelin.uid,quality:2,dirty:true,durability:63,edge:72});expect(stateItemEntries(d.s).filter(e=>e.item.uid===d.javelin.uid)).toHaveLength(1)})
 it('손에 든 투척물만 명시적인 빠른 슬롯 집계에 추가한다',()=>{const d=setup('main');expect(quickCount(d.p,d.javelin.def)).toBe(0);expect(quickCount(d.p,d.javelin.def,undefined,true)).toBe(1);expect(quickItem(d.p,d.javelin.def,undefined,true)).toBe(d.javelin);attack(d);expect(quickCount(d.p,d.javelin.def,undefined,true)).toBe(0)})
 it('동일 종류의 배낭/손 실제 수량을 합치되 일반 소모품 기본 집계는 바꾸지 않는다',()=>{const d=setup('main'),other=makeItem(d.w,d.javelin.def);addToBag(d.w,d.p,other);expect(quickCount(d.p,d.javelin.def,undefined,true)).toBe(2);expect(quickCount(d.p,d.javelin.def)).toBe(1);expect(quickItem(d.p,d.javelin.def,undefined,true)).toBe(d.javelin)})
 it('NPC도 자기 손과 시야의 원래 투창을 던지고 플레이어 가시성을 빌리지 않는다',()=>{const d=setup('main');delete d.p.equip.main;d.target.equip.off=d.javelin;d.s.visible=[];expect(throwQuote(d.w,d.target,d.javelin.uid,d.p.id).wield?.arm).toBe('larm');expect(perform(d.w,d.target,{type:'throwAttack',uid:d.javelin.uid,target:d.p.id}).ok).toBe(true);expect(d.target.equip.off).toBeUndefined();expect(tileAt(d.w,d.p.pos).items.find(i=>i.uid===d.javelin.uid)?.count).toBe(1)})
 it('NPC와 봇도 실제 손의 투창이 유효 사거리이면 투척 행동을 선택한다',()=>{const d=setup('main');d.p.statPoints=0;d.p.abilityPoints=0;expect(botDecide(d.w)).toEqual({type:'throwAttack',uid:d.javelin.uid,target:d.target.id});delete d.p.equip.main;d.target.equip.main=d.javelin;d.target.ai.morale=100;d.target.abilities=[];expect(aiDecide(d.w,d.target)).toEqual({type:'throwAttack',uid:d.javelin.uid,target:d.p.id})})
 it('양손 투척 모드는 두 손을 요구하고 실제 두 팔에 하중을 남긴다',()=>{const d=setup('main'),loaded=loadMods([...readPackages(),{manifest:{id:'two-hand-javelin',name:'양손 투척 검사',version:'1',dependencies:['core']},defs:[],patches:[{op:'add',target:'Item.Javelin',path:'/twoHanded',value:true}]}],['two-hand-javelin']);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;for(const part of ['RightForearm','LeftForearm'])addWound(d.w,d.p,{def:'Wound.Bruise',part,severity:1,source:'두 손 하중'}).wound.fracture={grade:'hairline',progress:0};d.s.rng.body=[0,0,0,0];expect(throwQuote(d.w,d.p,d.javelin.uid,d.target.id).wield?.twoHanded).toBe(true);expect(attack(d).ok).toBe(true);expect(d.p.body.wounds.every(w=>w.fracture?.grade==='simple')).toBe(true);const e=setup('main');e.w.db=loaded.db;e.p.body.missing.push('LeftUpperArm');unchanged(e)})
 it('실제 사용한 왼팔 골절만 하중을 받고 오른팔은 악화하지 않는다',()=>{const d=setup('off');for(const part of ['RightForearm','LeftForearm']){const wound=addWound(d.w,d.p,{def:'Wound.Bruise',part,severity:1,source:'투척 하중 fixture'}).wound;wound.fracture={grade:'hairline',progress:0}}d.s.rng.body=[0,0,0,0];expect(attack(d).ok).toBe(true);expect(d.p.body.wounds.find(w=>w.part==='RightForearm')!.fracture!.grade).toBe('hairline');expect(d.p.body.wounds.find(w=>w.part==='LeftForearm')!.fracture!.grade).toBe('simple')})
 it('실제 투척/빈 슬롯/바닥 무기를 전체 각인190에서 보존한다',()=>{const d=setup('main');attack(d);const next=deserialize(serialize(d.s));expect(next.version).toBe(SAVE_VERSION);expect(JSON.parse(serialize(next))).toEqual(JSON.parse(serialize(d.s)))})
 it('189각인에 새 무기나 지난 투척 이력을 채우지 않는다',()=>{const d=setup(),raw=JSON.parse(serialize(d.s));raw.version=189;const next=deserialize(JSON.stringify(raw));raw.version=SAVE_VERSION;expect(JSON.parse(serialize(next))).toEqual(raw)})
 it('같은 각인/같은 손의 투척은 전체 세계·난수·UID가 같다',()=>{const d=setup('off'),copy={db:d.w.db,s:deserialize(serialize(d.s))};attack(d);perform(copy,player(copy),{type:'throwAttack',uid:d.javelin.uid,target:d.target.id});expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))})
 it('실제 원래 목재/고철/실과 도구·작업대의120작업으로 새 한 자루만 만든다',()=>{const d=setup();d.p.bag=[];tileAt(d.w,{x:20,y:19}).t='Terrain.Workbench';for(const[id,n]of [['Item.Wood',2],['Item.IronScrap',1],['Item.Thread',1],['Item.HuntingKnife',1],['Item.IronHammer',1]]as const)addToBag(d.w,d.p,makeItem(d.w,id,n));expect(startCraft(d.w,d.p,'Recipe.Javelin',1)).toBeNull();expect(d.p.activity!.total).toBe(120);finish(d);expect(d.p.bag.filter(i=>i.def==='Item.Javelin').map(i=>i.count)).toEqual([1]);expect(d.p.bag.some(i=>['Item.Wood','Item.IronScrap','Item.Thread'].includes(i.def))).toBe(false)})
 it('손에서 던진 실제 장비의 onUnequip은 완료 뒤 원래 UID로 한 번만 호출된다',async()=>{const d=setup('main'),id='javelin-worker',loaded=loadMods([...readPackages(),{manifest:{id,name:'실제 투척 생애',version:'1',dependencies:['core'],scripts:{stage:2,entry:'scripts/main.js',api:'^1.1.0'}},defs:[],patches:[{op:'add',target:'Item.Javelin',path:'/compWorker',value:id+':Thrown'}],scripts:[{file:'scripts/main.js',source:'export default defineMod({workers:{Thrown:{kind:"ItemCompWorker",onUnequip(ctx,e){ctx.modState.events=[...(ctx.modState.events??[]),e];return []}}}})'}]}],[id]);expect(loaded.report.errors).toEqual([]);expect(configureScriptHost(loaded.db,await createQuickJSScriptHost())).toEqual([]);d.w.db=loaded.db;throwQuote(d.w,d.p,d.javelin.uid,d.target.id);expect(d.s.scriptState?.mods[id]).toBeUndefined();expect(attack(d).ok).toBe(true);expect(d.s.scriptState!.mods[id]).toMatchObject({events:[{uid:d.javelin.uid,item:'Item.Javelin',slot:'main'}]});expect((d.s.scriptState!.mods[id]as {events:unknown[]}).events).toHaveLength(1)})
})
