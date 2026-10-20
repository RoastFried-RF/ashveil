import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { aiDecide } from '../src/core/ai'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, type World } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { emitNoise } from '../src/core/perception'
import { residentProvisionGoal } from '../src/core/resident-provisions'
import { residentPreparingRest, residentSleepFoodTarget } from '../src/core/resident-rest'
import { residentNeedsDrink, residentWaterGoal } from '../src/core/resident-water'
import { initializeResidentWarmth, residentWarmthGoal } from '../src/core/resident-warmth'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { thermalActivity } from '../src/core/thermal'
import { db } from './helpers'
const template=newGame(db,{seed:'resident-warmth',overworld:true})
function setup(){
  const w:World={db,s:structuredClone(template)},p=player(w),m=w.s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!
  m.currentRegion=site.id;m.position={...site.cell};w.s.creatures=[p];w.s.time=12*1200*100;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0};w.s.sources=[];w.s.storyteller.budget=-1e9;p.pos={x:20,y:20}
  for(let y=12;y<=25;y++)for(let x=17;x<=42;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  initializeSettlement(w);const doctor=w.s.creatures.find((c)=>c.clinicSite)!,guard=w.s.creatures.find((c)=>c.def==='Creature.SettlementGuard')!,fire=w.s.map.residentHearth!
  p.pos={x:33,y:19}
  for(const c of w.s.creatures){c.nextAct=c.id===p.id||c.id===doctor.id?w.s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,wetness:0,stress:0,protein:100,vitamin:100})}
  w.s.map.lights=[{pos:fire.pos,radius:12,kind:'campfire'}];invalidateLights(w)
  return{w,p,doctor,guard,fire,site}
}
function wait(w:World,n:number){for(let i=0;i<n;i++)expect(playerAct(w,{type:'wait'})).toBeNull()}
describe('주민 보온·수면 준비·일상 소음',()=>{
  it('보온은 기존 화덕을 기억하며 재진입 때 불·물품·몸을 만들지 않는다',()=>{
    const{w,site}=setup(),hash=stateHash(w.s);initializeResidentWarmth(w,site);initializeSettlement(w);expect(stateHash(w.s)).toBe(hash)
  })
  it('차가운 의사는 실제 화덕으로 걸어 작업 대사/체온을 거친 뒤 돌아온다',()=>{
    const{w,doctor,fire}=setup();doctor.needs.bodyTemp=35.8;const ids=doctor.bag.map((it)=>it.uid),hash=stateHash(w.s),before=w.s.time;expect(residentWarmthGoal(w,doctor)?.pos).toEqual(fire.pos);expect(stateHash(w.s)).toBe(hash)
    let peak=doctor.needs.bodyTemp;for(let i=0;i<12;i++){expect(playerAct(w,{type:'rest',turns:200})).toBeNull();peak=Math.max(peak,doctor.needs.bodyTemp)}expect(peak).toBeGreaterThanOrEqual(36.8);expect(doctor.pos).toEqual(doctor.home);expect(doctor.needs.bodyTemp).toBeGreaterThan(36.5);expect(doctor.needs.kcal).toBeLessThan(1000);expect(doctor.bag.map((it)=>it.uid)).toEqual(ids);expect(doctor.residentWarming).toBeUndefined();expect(w.s.time-before).toBeGreaterThan(20000)
  })
  it('시작/완료 함수 자체는 체온이나 열량을 즉시 바꾸지 않고 기존 작업 상태를 쓴다',()=>{
    const{w,doctor,fire}=setup();doctor.pos={x:fire.pos.x+1,y:fire.pos.y};doctor.needs.bodyTemp=35.5;const temp=doctor.needs.bodyTemp,kcal=doctor.needs.kcal,time=w.s.time;expect(perform(w,doctor,{type:'warmByFire'})).toMatchObject({ok:true,tu:0});expect(thermalActivity(w,doctor)).toBe('work');expect(doctor.needs.bodyTemp).toBe(temp)
    for(let i=0;i<200;i++)activityStep(w,doctor);expect(doctor.activity).toBeUndefined();expect([doctor.needs.bodyTemp,doctor.needs.kcal,w.s.time]).toEqual([temp,kcal,time])
  })
  it('원격 화덕의 꺼짐을 미리 읽지 않고 도착해 확인하며 재시도를 미룬다',()=>{
    const{w,doctor,fire}=setup();doctor.needs.bodyTemp=35.8;const known=residentWarmthGoal(w,doctor),hash=stateHash(w.s);expect(residentWarmthGoal(w,doctor)).toEqual(known);expect(stateHash(w.s)).toBe(hash);w.s.map.lights[0].off=true;expect(residentWarmthGoal(w,doctor)).toEqual(known);doctor.pos={x:fire.pos.x+1,y:fire.pos.y};expect(aiDecide(w,doctor).type).not.toBe('warmByFire');expect(doctor.residentWarmAfter).toBe(turnOf(w)+1200)
  })
  it('불이 꺼지거나 떠나거나 움직일 수 없으면 몸 풀기를 중단한다',()=>{
    for(const kind of ['fire','distance','body']){const{w,doctor,fire}=setup();doctor.pos={x:fire.pos.x+1,y:fire.pos.y};expect(perform(w,doctor,{type:'warmByFire'}).ok).toBe(true);if(kind==='fire')w.s.map.lights[0].off=true;if(kind==='distance')doctor.pos={x:20,y:20};if(kind==='body')doctor.unconscious=true;activityStep(w,doctor);expect(doctor.activity).toBeUndefined();expect(doctor.needs.bodyTemp).toBe(37)}
  })
  it('불이나 움직일 몸이 없는 직접 요청은 시간·몸·물품을 바꾸지 않는다',()=>{
    const{w,p}=setup();p.pos={x:20,y:20};const hash=stateHash(w.s);expect(perform(w,p,{type:'warmByFire'}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('보온의 상하 문턱은 작은 온도 변화에 왕복하지 않고 실제 목표까지 이어진다',()=>{
    const{w,doctor}=setup();doctor.needs.bodyTemp=36.2;expect(residentWarmthGoal(w,doctor)).toBeNull();doctor.residentWarming=true;expect(residentWarmthGoal(w,doctor)).not.toBeNull();doctor.needs.bodyTemp=36.8;expect(residentWarmthGoal(w,doctor)).toBeNull()
  })
  it('취침 전에는 실제 병물로 결손100ml 이하를 만들고 실제 식량으로700kcal를 준비한다',()=>{
    const{w,doctor}=setup();doctor.needs.fatigue=70;doctor.needs.kcal=100;doctor.needs.waterDeficit=300;expect(residentPreparingRest(w,doctor)).toBe(true);expect(residentSleepFoodTarget(w,doctor)).toBe(700)
    let action=aiDecide(w,doctor);expect(action.type).toBe('consume');expect(perform(w,doctor,action).ok).toBe(true);expect(doctor.needs.waterDeficit).toBe(100);expect(residentNeedsDrink(w,doctor)).toBe(false)
    action=aiDecide(w,doctor);expect(perform(w,doctor,action).ok).toBe(true);expect(doctor.needs.kcal).toBe(450);expect(doctor.needs.waterDeficit).toBeGreaterThan(100);for(let i=0;i<3&&doctor.needs.kcal<700;i++){action=aiDecide(w,doctor);expect(perform(w,doctor,action).ok).toBe(true)}expect(doctor.needs.kcal).toBe(800)
    wait(w,8);expect(doctor.activity?.kind).toBe('sleep');expect(doctor.asleep).toBe(true);expect(doctor.needs.waterDeficit).toBeLessThanOrEqual(101)
  })
  it('취침 준비에 모자란 음식/물은 실제 창고/우물 목표를 쓰며 체내 자원을 만들지 않는다',()=>{
    const{w,doctor}=setup();doctor.needs.fatigue=70;doctor.needs.kcal=600;doctor.bag=doctor.bag.filter((it)=>!db.item(it.def).food);doctor.needs.waterDeficit=200;for(const it of doctor.bag)if(db.item(it.def).drink&&!db.item(it.def).drink!.alcohol)it.uses=0
    const hash=stateHash(w.s);expect(residentProvisionGoal(w,doctor)).not.toBeNull();expect(residentWaterGoal(w,doctor)).not.toBeNull();expect(stateHash(w.s)).toBe(hash);expect(doctor.needs.kcal).toBe(600)
  })
  it('평소에는 취침 준비 버퍼를 강제하지 않고 보이는 적 앞에서는 경비 대응을 먼저 한다',()=>{
    const{w,doctor,guard}=setup();doctor.needs.kcal=100;doctor.needs.waterDeficit=300;expect(residentPreparingRest(w,doctor)).toBe(false);expect(residentNeedsDrink(w,doctor)).toBe(false);expect(aiDecide(w,doctor).type).not.toBe('consume');guard.needs.bodyTemp=35.5;w.s.creatures.push(createCreature(w,'Creature.Reaver',{x:guard.pos.x+1,y:guard.pos.y}));expect(aiDecide(w,guard).type).not.toBe('warmByFire')
  })
  it('익숙한 생활 소리에 깨어도 경보12나 조사 이동으로 번지지 않는다',()=>{
    const{w,p,doctor,guard}=setup();p.pos={x:21,y:20};doctor.pos={x:20,y:20};guard.pos={x:24,y:20};doctor.ai.mode='wander';guard.ai.mode='guard';doctor.room=guard.room=0
    for(const c of [doctor,guard]){c.asleep=true;c.activity={kind:'sleep',remaining:9600,label:'수면'};c.needs.fatigue=70}
    emitNoise(w,p.pos,5,p.id);expect(doctor.asleep).toBe(false);expect(doctor.activity?.wokeBy).toContain('익숙한');expect(doctor.ai.mode).toBe('wander');expect(guard.asleep).toBe(true);expect(w.s.noiseEvents.some((n)=>n.radius===12)).toBe(false)
    wait(w,1);expect(doctor.residentRestAfter).toBeUndefined();expect(doctor.drowsyUntil).toBeGreaterThan(turnOf(w))
  })
  it('적대 소리와 큰 경보는 여전히 같은 방의 주민을 깨운다',()=>{
    const{w,p,doctor,guard}=setup();p.pos={x:22,y:23};doctor.pos={x:20,y:20};guard.pos={x:24,y:20};doctor.room=guard.room=0
    for(const c of [doctor,guard]){c.asleep=true;c.activity={kind:'sleep',remaining:9600,label:'수면'};c.needs.fatigue=70}
    const foe=createCreature(w,'Creature.Reaver',{x:21,y:20});w.s.creatures.push(foe);emitNoise(w,foe.pos,5,foe.id);expect(doctor.asleep).toBe(false);expect(guard.asleep).toBe(false);expect(w.s.noiseEvents.some((n)=>n.radius===12)).toBe(true)
  })
  it('보온 중간 각인과 재개는 체온 적산·물품·몸 전체가 같다',()=>{
    const{w,doctor}=setup();doctor.needs.bodyTemp=35.8;wait(w,30);expect(doctor.activity?.kind).toBe('warm');const copy={db,s:deserialize(serialize(w.s))};wait(w,500);wait(copy,500);expect(stateHash(copy.s)).toBe(stateHash(w.s))
  },10000) // 두 세계의 실제 신체/AI 1,030턴을 모두 진행하므로 병렬 실행 여유를 둔다.
  it('v18의 수업·몸·수면·병과 식량은 무료 회복 없이 유지한다',()=>{
    const{w}=setup(),old=JSON.parse(serialize(w.s));old.version=18;delete old.map.residentWarmthInitialized;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:18}).toEqual(old)
  })
})
