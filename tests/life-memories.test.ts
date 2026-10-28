import {SAVE_VERSION} from '../src/core/game'
import {describe,expect,it} from 'vitest'
import {lifeMemoriesFixture} from './life-memories-fixture'
import {boiledMealFixture} from './boiled-meal-fixture'
import {lifeMemoryThoughts} from '../src/core/life-memories'
import {activeThoughts} from '../src/core/thoughts'
import {activityStep,perform} from '../src/core/actions'
import {playerAct,runUntilInput,stopActivity} from '../src/core/game'
import {talk} from '../src/core/economy'
import {startBeddingWash} from '../src/core/bedding-lice'
import {finishBase} from './base-camp-fixture'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {drinkVolume} from '../src/core/wash-water'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const setup=lifeMemoriesFixture
const memories=(d:ReturnType<typeof setup>,id:string)=>activeThoughts(d.w,d.p).filter(t=>t.def===id)
describe('실제 생활 행동의 기분 기억',()=>{
 it('데이터 조회는 물/기억/시간/UID/난수를 만들지 않는다',()=>{const d=setup(),before=stateHash(d.s);for(const event of['wash','warmMeal','talk','innSleep']as const)expect(lifeMemoryThoughts(d.w,event)).toHaveLength(1);expect(stateHash(d.s)).toBe(before)})
 it('실제2L 몸 씻기의 마지막 턴에만3/12시간 기억을 남긴다',()=>{const d=setup(),bucket=d.water(),uid=bucket.uid;expect(perform(d.w,d.p,{type:'wash'}).ok).toBe(true);const n=d.p.activity!.remaining;for(let i=0;i<n-1;i++)activityStep(d.w,d.p);expect(memories(d,'Thought.Washed')).toEqual([]);expect(drinkVolume(d.w,bucket)).toBe(2000);activityStep(d.w,d.p);expect(memories(d,'Thought.Washed')).toMatchObject([{mood:3,count:1,remaining:14400}]);expect(d.p.bag.find(i=>i.uid===uid)).toMatchObject({def:'Item.WaterBucket',uses:0})})
 it('물이 모자라진 실패한 몸 씻기에는 기억을 주지 않는다',()=>{const d=setup(),bucket=d.water();perform(d.w,d.p,{type:'wash'});bucket.uses=5;finishBase(d.w,d.p);expect(memories(d,'Thought.Washed')).toEqual([]);expect(drinkVolume(d.w,bucket)).toBe(1000)})
 it('침구를 씻은 일은 몸을 씻은 기억으로 바꾸지 않는다',()=>{const d=setup();d.water();const pos={x:d.p.pos.x,y:d.p.pos.y+1};tileAt(d.w,pos).t='Terrain.Bed';expect(startBeddingWash(d.w,d.p,pos)).toBeNull();finishBase(d.w,d.p);expect(memories(d,'Thought.Washed')).toEqual([])})
 it('실제400턴 귀리죽을 만들어 먹을 때만 따뜻한 음식3/4시간을 얻는다',()=>{const d=boiledMealFixture(220),uid=d.bowl.uid;expect(playerAct(d.w,{type:'wait'})).toBeNull();expect(playerAct(d.w,{type:'craft',id:d.recipe})).toBeNull();const food=d.p.bag.find(i=>i.uid===uid)!;expect(food.def).toBe('Item.OatmealBowl');expect(perform(d.w,d.p,{type:'consume',uid}).ok).toBe(true);expect(activeThoughts(d.w,d.p).find(t=>t.def==='Thought.WarmMeal')).toMatchObject({mood:3,count:1,remaining:4800});expect(d.p.bag.find(i=>i.uid===uid)?.def).toBe('Item.Bowl')})
 it('이미 식은 음식이나 실패한 섭취로 따뜻한 기억을 만들지 않는다',()=>{const d=setup(),food=d.add('Item.OatmealBowl');food.foodHeatedAt=turnOf(d.w)-100000;expect(perform(d.w,d.p,{type:'consume',uid:food.uid}).ok).toBe(true);expect(memories(d,'Thought.WarmMeal')).toEqual([]);expect(perform(d.w,d.p,{type:'consume',uid:-1}).ok).toBe(false);expect(memories(d,'Thought.WarmMeal')).toEqual([])})
 it('최근 데운 기록이 남아도 실제로 얼어 버린 음식에는 온기나 따뜻한 기억이 없다',()=>{const d=setup(),food=d.add('Item.OatmealBowl');food.foodHeatedAt=turnOf(d.w);food.foodFrozen=true;const before=d.p.needs.bodyTemp;expect(perform(d.w,d.p,{type:'consume',uid:food.uid}).ok).toBe(true);expect(d.p.needs.bodyTemp).toBe(before);expect(memories(d,'Thought.WarmMeal')).toEqual([])})
 it('체온 상한에 도달했어도 실제 따뜻한 음식의 기억은 남는다',()=>{const d=setup(),food=d.add('Item.OatmealBowl');food.foodHeatedAt=turnOf(d.w);d.p.needs.bodyTemp=40;expect(perform(d.w,d.p,{type:'consume',uid:food.uid}).ok).toBe(true);expect(memories(d,'Thought.WarmMeal')[0]?.mood).toBe(3);expect(d.p.needs.bodyTemp).toBe(40)})
 it('실제 대화는 기본3/수다쟁이6/외톨이0이며1일 지속한다',()=>{for(const[traits,mood]of[[[],3],[['Trait.Talkative'],6],[['Trait.Loner'],0]]as [string[],number][]){const d=setup();d.p.traits=traits;expect(talk(d.w,d.p,d.keeper)).toBeNull();const memory=memories(d,'Thought.Talked');if(mood)expect(memory).toMatchObject([{mood,count:1,remaining:28800}]);else expect(memory).toEqual([])}})
 it('반복 대화는 합산하지 않고 실제 마지막 대화의 한 기억만 갱신한다',()=>{const d=setup();talk(d.w,d.p,d.keeper);d.s.time+=100;talk(d.w,d.p,d.keeper);expect(memories(d,'Thought.Talked')).toMatchObject([{mood:3,count:1,remaining:28800}]);expect(d.p.thoughts.filter(t=>t.def==='Thought.Talked')).toHaveLength(1)})
 it('원격/잠/실신/죽음/적대/의식 부족의 실패한 대화에는 기억을 주지 않는다',()=>{for(const mode of['far','sleep','actorSleep','coma','dead','actorDead','hostile','brain']){const d=setup();if(mode==='far')d.p.pos={x:20,y:20};if(mode==='sleep')d.keeper.asleep=true;if(mode==='actorSleep')d.p.asleep=true;if(mode==='coma')d.keeper.unconscious=true;if(mode==='dead')d.keeper.alive=false;if(mode==='actorDead')d.p.alive=false;if(mode==='hostile')d.keeper.faction='reavers';if(mode==='brain')d.p.body.missing.push('Brain');expect(talk(d.w,d.p,d.keeper),mode).not.toBeNull();expect(memories(d,'Thought.Talked')).toEqual([])}})
 it('일반 주민에게 플레이어용 전체 사고를 몰래 부여하지 않는다',()=>{const d=setup();talk(d.w,d.p,d.keeper);expect(d.keeper.thoughts).toEqual([])})
 it('실제 유료 침대에서도 수면 시작/조회만으로 숙박 기억이 생기지 않는다',()=>{const d=setup();d.rent();const before=stateHash(d.s);expect(memories(d,'Thought.InnSleep')).toEqual([]);expect(stateHash(d.s)).toBe(before);expect(perform(d.w,d.p,{type:'sleep'}).ok).toBe(true);expect(memories(d,'Thought.InnSleep')).toEqual([]);stopActivity(d.w,d.p);expect(memories(d,'Thought.InnSleep')).toEqual([])})
 it('돈을 내고 자기 침대에서 실제 한 턴 잔 뒤5/12시간 숙박 기억을 얻는다',()=>{const d=setup(),cash=d.p.money!,marketCash=d.s.overworld!.markets![d.keeper.traderSite!].money,q=d.rent();d.sleepStep();expect(memories(d,'Thought.InnSleep')).toMatchObject([{mood:5,count:1,remaining:14400}]);expect(d.p.money).toBe(cash-q.fee);expect(d.s.overworld!.markets![d.keeper.traderSite!].money).toBe(marketCash+q.fee);stopActivity(d.w,d.p);expect(memories(d,'Thought.InnSleep')).toHaveLength(1)})
 it('같은 여관 침대에서 휴식만 하면 숙박 수면 기억을 받지 않는다',()=>{const d=setup();d.rent();perform(d.w,d.p,{type:'rest',turns:1});activityStep(d.w,d.p);expect(memories(d,'Thought.InnSleep')).toEqual([])})
 it('자기 계약이 없는 침대에서는 잠들거나 숙박 기억을 얻지 않는다',()=>{const d=setup();d.p.pos={...d.bed.pos};expect(perform(d.w,d.p,{type:'sleep'}).ok).toBe(false);expect(memories(d,'Thought.InnSleep')).toEqual([])})
 it('실제 수면 중 계약 만료/침대 소실은 더 이상 숙박 기억을 갱신하지 않는다',()=>{for(const mode of['expired','terrain']){const d=setup();d.rent();d.sleepStep();const old=structuredClone(d.p.thoughts);d.s.time+=100;if(mode==='expired')d.bed.lease!.until=turnOf(d.w);else d.bedTile().t='Terrain.Earth';activityStep(d.w,d.p);expect(d.p.thoughts).toEqual(old)}})
 it('실제 수면 턴을 더 보내도 숙박은 하나이며 마지막 관찰 시점으로 갱신한다',()=>{const d=setup();d.rent();d.sleepStep();d.s.time+=100;activityStep(d.w,d.p);expect(memories(d,'Thought.InnSleep')).toMatchObject([{mood:5,count:1,remaining:14400}]);expect(d.p.thoughts.filter(t=>t.def==='Thought.InnSleep')).toHaveLength(1)})
 it('기억은 정확한 마지막 유효 턴까지 유지하고 만료 때 사라진다',()=>{const d=setup();talk(d.w,d.p,d.keeper);d.s.time+=28799*100;expect(memories(d,'Thought.Talked')[0]?.remaining).toBe(1);d.s.time+=100;expect(memories(d,'Thought.Talked')).toEqual([])})
 it('미완료 수면을 각인 복원한 뒤 똑같이 실제 턴/중단과 기억을 남긴다',()=>{const d=setup();d.rent();expect(playerAct(d.w,{type:'sleep'},1)).toBeNull();const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w,2);runUntilInput(copy,2);expect(playerAct(d.w,{type:'stopActivity'})).toBeNull();expect(playerAct(copy,{type:'stopActivity'})).toBeNull();expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)));expect(memories(d,'Thought.InnSleep')).toHaveLength(1)})
 it('구형87은 과거 목욕/식사/대화/숙박을 지어내지 않고 전체를 보존한다',()=>{const d=setup(),old=JSON.parse(serialize(d.s));old.version=87;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:87}).toEqual(old)})
 it('잘못된 생활 사건/특성 수정치 메타데이터는 실제 콘텐츠 검증에서 거절한다',()=>{for(const[path,value]of[['/lifeEvent','unknown'],['/durationTurns',0],['/traitMoodKey',12]]as const){const id='bad-life-memory',loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'add',target:'Thought.Washed',path,value}]}],[id]);expect(loaded.report.errors.length).toBeGreaterThan(0)}})
})
