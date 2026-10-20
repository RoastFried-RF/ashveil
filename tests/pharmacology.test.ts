import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { administerDrug, drugLines, drugPreview, pharmacologyTick, finishTopical, startTopical } from '../src/core/pharmacology'
import { alcoholStage, dependency, drugEffects, drugTolerance, withdrawalStage } from '../src/core/drug-state'
import { addWound, bodyTick, capacity, consciousness, painTotal, totalBleed } from '../src/core/body'
import { perform, multiTurnFactor, stumbleChance } from '../src/core/actions'
import { sleepQuality } from '../src/core/conditions'
import { createCreature } from '../src/core/creatures'
import { player, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { playerAct, runUntilInput } from '../src/core/game'
import { addToBag, makeItem, splitInBag } from '../src/core/items'
import { invalidateLights } from '../src/core/fov'
import { initiative } from '../src/core/scheduler'
import { addEffect } from '../src/core/traits'
import { activeThoughts } from '../src/core/thoughts'
import { thermalState, temperatureDelta } from '../src/core/thermal'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { makeWorld } from './helpers'
function setup() {
  const w=makeWorld('pharmacology-contracts','Bg.Deserter'),p=player(w)
  w.s.creatures=[p]; p.pos={x:20,y:20}; p.traits=[];p.traumas=[];p.thoughts=[];p.effects=[];p.age=undefined;p.background=undefined;p.abilities=[];p.bag=[];p.equip={}
  p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.hp=95
  Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,fatigue:40,sleepDebt:0,stress:0,bodyTemp:37,wetness:0,skinWetness:{}})
  w.s.time=14*TURNS_PER_HOUR*100;p.nextAct=w.s.time;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0}
  for(let y=17;y<=23;y++)for(let x=17;x<=23;x++){const t=w.s.map.tiles[y*w.s.map.w+x];t.t='Terrain.Earth';t.roof=true;t.items=[]}
  w.s.map.lights=[{pos:{...p.pos},radius:6,kind:'campfire'}];invalidateLights(w)
  return {w,p}
}
function dose(w:World,id:string) { expect(administerDrug(w,player(w),'Drug.'+id)).toBeNull() }
function add(w:World,id:string,count=1) {const it=makeItem(w,'Item.'+id,count);expect(addToBag(w,player(w),it)).toBe(0);return it}
function wound(w:World,part='LeftForearm',severity=5) {return addWound(w,player(w),{part,def:'Wound.Cut',severity,source:'검증 상처'}).wound}
function dependent(w:World,family:'analgesic'|'alcohol'|'stimulant',elapsed:number) { const p=player(w); p.drugs={active:[],tolerance:{},lastDose:{[family]:turnOf(w)-elapsed},addicted:[family],toleranceAt:turnOf(w),revision:0} }
function finish(w:World) {let n=0;while(w.s.simulationPending&&n++<10000)runUntilInput(w,200);expect(n).toBeLessThan(10000)}

describe('실제 투여·내성·몸 기능',()=>{
  it('02 검산8: 내성40의 세 번째 팅크는28/8.4%, 투여 후60에서 다음은24.5다',()=>{
    const {w,p}=setup();p.drugs={active:[],tolerance:{analgesic:40},lastDose:{},addicted:[],toleranceAt:turnOf(w),revision:0}
    expect(drugPreview(w,p,'Drug.PoppyTincture')).toMatchObject({pain:28,tolerance:40});expect(drugPreview(w,p,'Drug.PoppyTincture').addiction).toBeCloseTo(.084,12)
    dose(w,'PoppyTincture');expect(drugEffects(w,p).pain).toBe(28);expect(drugTolerance(w,p,'analgesic')).toBe(60);expect(drugPreview(w,p,'Drug.PoppyTincture').pain).toBe(24.5)
  })
  it('같은 약 재투여는 실효를 유지하고 지속만 갱신하며 내성을 누적한다',()=>{
    const {w,p}=setup();dose(w,'WhiteTablet');const initial=drugEffects(w,p).pain,first=p.drugs!.active[0].until
    w.s.time+=100;dose(w,'WhiteTablet');expect(p.drugs!.active).toHaveLength(1);expect(drugEffects(w,p).pain).toBe(initial);expect(p.drugs!.active[0].until).toBe(first+1);expect(drugTolerance(w,p,'analgesic')).toBeGreaterThan(49)
  })
  it('각성제를 연타해도 피로/기력을 반복 회복하지 않는다',()=>{
    const {w,p}=setup();p.needs.fatigue=90;p.needs.energy=10;dose(w,'PillStimulant');expect(p.needs.fatigue).toBe(50)
    p.needs.energy=20;p.needs.fatigue=65;dose(w,'PillStimulant');expect(p.needs.fatigue).toBe(65);expect(p.needs.energy).toBe(20)
  })
  it('내성은 자정을 기준으로 초기화하지 않고 실제24시간 동안 계열별3/5/4만큼 감소한다',()=>{
    const {w,p}=setup();p.drugs={active:[],tolerance:{analgesic:50,alcohol:50,stimulant:50},lastDose:{},addicted:[],toleranceAt:turnOf(w),revision:0}
    w.s.time+=TURNS_PER_DAY*100;expect(drugTolerance(w,p,'analgesic')).toBe(47);expect(drugTolerance(w,p,'alcohol')).toBe(45);expect(drugTolerance(w,p,'stimulant')).toBe(46)
    w.s.time+=TURNS_PER_DAY*100/2;expect(drugTolerance(w,p,'alcohol')).toBe(42.5)
  })
  it('조회는 난수/상태를 바꾸지 않으며 저장으로 약효·내성·금단을 재설정하지 않는다',()=>{
    const {w,p}=setup();dose(w,'PoppyTincture');const hash=stateHash(w.s)
    drugPreview(w,p,'Drug.WhiteTablet');drugEffects(w,p);drugTolerance(w,p,'analgesic');drugLines(w,p);expect(stateHash(w.s)).toBe(hash)
    const copy={db:w.db,s:deserialize(serialize(w.s))};expect(stateHash(copy.s)).toBe(hash);expect(drugEffects(copy,player(copy))).toEqual(drugEffects(w,p))
  })
  it('v4 각인은 버전만 올리고 몸·영양·구형 효과를 한 번도 재보정하지 않는다',()=>{
    const {w,p}=setup();p.needs.kcal=-1234.5;p.needs.waterDeficit=890;wound(w);addEffect(p,'analgesic',turnOf(w)+1200)
    const saved=JSON.parse(serialize(w.s));saved.version=4;const restored=deserialize(JSON.stringify(saved))
    expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:4}).toEqual(saved);expect(deserialize(serialize(restored))).toEqual(restored)
  })
  it('실제 소지품 사용은 한 턴을 소비하고 그UID의 정제 한 개만 쓴다',()=>{
    const {w,p}=setup(),it=add(w,'Painkiller',2),before=w.s.time
    expect(playerAct(w,{type:'consume',uid:it.uid})).toBeNull();expect(w.s.time-before).toBe(100);expect(it.count).toBe(1);expect(drugEffects(w,p).pain).toBe(50)
  })
  it('고정 비율 대신 실제 통증에서 정제50을 빼며 골절/상처 자체를 치료하지 않는다',()=>{
    const {w,p}=setup();wound(w,'LeftForearm',25);wound(w,'RightForearm',25);wound(w,'LeftShin',25);const before=painTotal(w,p),wounds=structuredClone(p.body.wounds)
    expect(before).toBeGreaterThan(50);dose(w,'WhiteTablet');expect(painTotal(w,p)).toBeCloseTo(before-50,10);expect(p.body.wounds).toEqual(wounds)
  })
  it('팅크의P약물.08과 호흡−.1이 실제 의식과 호흡 기능에 함께 반영된다',()=>{
    const {w,p}=setup();expect(consciousness(w,p)).toBe(1);dose(w,'PoppyTincture')
    expect(capacity(w,p,'breathing')).toBeCloseTo(.9,10);expect(consciousness(w,p)).toBeCloseTo(.92*(.4+.6*.9),10)
  })
  it('잠꽃의 수면+.1과 쓴재잎의수면−.2가 실제 수면 질에 적용된다',()=>{
    const {w,p}=setup(),base=sleepQuality(w,p);dose(w,'PoppyTincture');expect(sleepQuality(w,p)).toBeCloseTo(base+.1,10)
    const second=setup(),b=sleepQuality(second.w,second.p);dose(second.w,'AshLeaf');expect(sleepQuality(second.w,second.p)).toBeCloseTo(b-.2,10)
  })
  it('쓴재잎은 실제 피로30/주도권4/출혈1.1을 바꾸고 끝날 때40을 한 번만 더한다',()=>{
    const {w,p}=setup();const wd=wound(w);wd.bleed=5;const bleed=totalBleed(w,p),speed=initiative(p,w);dose(w,'AshLeaf')
    expect(p.needs.fatigue).toBe(10);expect(initiative(p,w)).toBe(speed+4);expect(totalBleed(w,p)).toBeCloseTo(bleed*1.1,10)
    w.s.time+=4800*100;pharmacologyTick(w,p);expect(p.needs.fatigue).toBe(50);const hash=stateHash(w.s);pharmacologyTick(w,p);expect(stateHash(w.s)).toBe(hash)
  })
  it('술은 두 시간마다 한 잔씩 대사하며 단계별 실제 다턴/비틀거림과 출혈을 바꾼다',()=>{
    const {w,p}=setup(),wd=wound(w);wd.bleed=5;const base=totalBleed(w,p),time=multiTurnFactor(w,p),stumble=stumbleChance(w,p,p.pos)
    for(let i=1;i<=3;i++){dose(w,'Alcohol');expect(alcoholStage(w,p)).toBe(i)}
    expect(multiTurnFactor(w,p)).toBeCloseTo(time*1.35,10);expect(stumbleChance(w,p,p.pos)).toBe(stumble+15);expect(totalBleed(w,p)).toBeCloseTo(base*1.45,10)
    w.s.time+=2400*100;pharmacologyTick(w,p);expect(alcoholStage(w,p)).toBe(2);w.s.time+=2400*100;pharmacologyTick(w,p);expect(alcoholStage(w,p)).toBe(1)
  })
  it('술의 거짓 온기는 물리 체감을 올리지 않고 실제 열손실을15%높인다',()=>{
    const {w,p}=setup();w.s.map.lights=[];w.s.map.tiles[p.pos.y*w.s.map.w+p.pos.x].roof=false;invalidateLights(w)
    const before=thermalState(w,p),delta=temperatureDelta(p,before);expect(delta).toBeLessThan(0);dose(w,'Alcohol');const after=thermalState(w,p)
    expect(after.feels).toBe(before.feels);expect(after.falseWarmth).toBe(2);expect(temperatureDelta(p,after)).toBeCloseTo(delta*1.15,10)
  })
  it('흰버들 차는 정상 체온 목표를 낮추지 않고 발열 목표만0.5°C낮춘다',()=>{
    const {w,p}=setup();p.needs.bodyTemp=39.8;addEffect(p,'fever',turnOf(w)+4800,40)
    const neutral=()=>{const s=thermalState(w,p);return {...s,feels:(s.low+s.high)/2}}
    const before=temperatureDelta(p,neutral());dose(w,'WillowTea')
    expect(thermalState(w,p).antipyretic).toBe(.5);expect(temperatureDelta(p,neutral())).toBeLessThan(before)
    p.effects=[];p.needs.bodyTemp=37;expect(temperatureDelta(p,neutral())).toBe(0)
  })
  it('정화 앰플은 실제 이질 노출을 만들 수 있고 미감정 이름은 누설하지 않는다',()=>{
    const {w,p}=setup();w.s.rng.body=[0,0,0,1]
    expect(administerDrug(w,p,'Drug.PurificationAmpoule','Item.PurificationAmpoule',1,undefined,false)).toBeNull()
    expect(p.diseases?.some((d)=>d.def==='Disease.Dysentery')).toBe(true);expect(drugLines(w,p).join(' ')).toContain('밀봉된 앰플');expect(drugLines(w,p).join(' ')).not.toContain('정화 앰플')
  })
  it('NPC도 같은 정제를 쓰면 같은 의식 감점과 약효를 받는다',()=>{
    const {w,p}=setup(),npc=createCreature(w,'Creature.Reaver',{x:21,y:20});npc.stats={...p.stats};npc.needs.fatigue=40
    expect(administerDrug(w,npc,'Drug.WhiteTablet')).toBeNull();dose(w,'WhiteTablet');expect(consciousness(w,npc)).toBeCloseTo(consciousness(w,p),10);expect(drugEffects(w,npc).pain).toBe(50)
  })
})

describe('금단·과용·수면제와 임시 처치의 각인',()=>{
  it('진통24h/술18h/각성12h에서 금단이 시작되고24/48시간 뒤 단계가 오른다',()=>{
    for(const [family,wait] of [['analgesic',24],['alcohol',18],['stimulant',12]] as const){const {w,p}=setup();dependent(w,family,wait*TURNS_PER_HOUR-1);expect(withdrawalStage(w,p)).toBe(0);w.s.time+=100;expect(withdrawalStage(w,p)).toBe(1);w.s.time+=TURNS_PER_DAY*100;expect(withdrawalStage(w,p)).toBe(2);w.s.time+=TURNS_PER_DAY*100;expect(withdrawalStage(w,p)).toBe(3)}
  })
  it('금단은 실제 통증5/3단계진통15·조작.85·수면−.3·사고−10/−18/−25로 이어진다',()=>{
    const {w,p}=setup(),base=sleepQuality(w,p);dependent(w,'analgesic',TURNS_PER_DAY);expect(painTotal(w,p)).toBe(5);expect(capacity(w,p,'manipulation')).toBe(1)
    w.s.time+=TURNS_PER_DAY*100;expect(capacity(w,p,'manipulation')).toBeCloseTo(.85,10);expect(sleepQuality(w,p)).toBeCloseTo(Math.max(.2,base-.3),10)
    w.s.time+=TURNS_PER_DAY*100;expect(painTotal(w,p)).toBe(15);expect(activeThoughts(w,p).find((t)=>t.def==='Thought.Withdrawal')?.mood).toBe(-25)
  })
  it('술의3단계 금단은 실제 발작 기절을 만들며 같은 턴 중복 판정하지 않는다',()=>{
    const {w,p}=setup();dependent(w,'alcohol',66*TURNS_PER_HOUR);w.s.rng.body=[0,0,0,1];pharmacologyTick(w,p)
    expect(p.unconscious).toBe(true);expect(p.cond?.faintUntil).toBeGreaterThan(turnOf(w));expect(drugLines(w,p).join(' ')).toContain('떨림섬망');const hash=stateHash(w.s);pharmacologyTick(w,p);expect(stateHash(w.s)).toBe(hash)
  })
  it('P약물합>.5는 호흡을반감하고10턴마다실제기절위험을 판정한다',()=>{
    const {w,p}=setup();for(let i=0;i<9;i++)dose(w,'Alcohol');expect(drugEffects(w,p).consciousness).toBeCloseTo(.54,12);expect(capacity(w,p,'breathing')).toBe(.5)
    w.s.rng.body=[0,0,0,1];pharmacologyTick(w,p);expect(p.unconscious).toBe(true);const hash=stateHash(w.s);pharmacologyTick(w,p);expect(stateHash(w.s)).toBe(hash)
  })
  it('15일 무투여로 의존이 해소되고10%변환으로 금주가를 얻을 수 있다',()=>{
    const {w,p}=setup();dependent(w,'alcohol',15*TURNS_PER_DAY);p.traits=['Trait.Alcoholic'];w.s.rng.body=[0,0,0,1];pharmacologyTick(w,p)
    expect(dependency(w,p,'alcohol').addicted).toBe(false);expect(p.traits).not.toContain('Trait.Alcoholic');expect(p.traits).toContain('Trait.Teetotaler')
    const copy={db:w.db,s:deserialize(serialize(w.s))};expect(withdrawalStage(copy,player(copy))).toBe(0)
  })
  it('구형 음주 직후 각인을 읽어도 이미 마신 시각을 잃지 않는다',()=>{
    const {w,p}=setup();p.traits=['Trait.Alcoholic'];addEffect(p,'alcohol',turnOf(w)+1200);addEffect(p,'drankRecently',turnOf(w)+TURNS_PER_DAY-1200)
    expect(dependency(w,p,'alcohol').stage).toBe(0);dose(w,'Alcohol');expect(drugEffects(w,p).alcoholDoses).toBe(2);expect(p.effects.some((e)=>e.kind==='alcohol')).toBe(false)
  })
  it('구형 정제 효과는 만료되거나 같은 약을 다시 쓸 때까지 보존한다',()=>{
    const {w,p}=setup();wound(w,'LeftForearm',25);const base=painTotal(w,p);addEffect(p,'analgesic',turnOf(w)+1200)
    expect(painTotal(w,p)).toBeCloseTo(base*.3,10);dose(w,'WhiteTablet');expect(p.effects.some((e)=>e.kind==='analgesic')).toBe(false);expect(drugEffects(w,p).pain).toBe(50)
  })
  it('수면제는 실제2시간 수면을 강제하고 수동 중단을 거부하며 중간 저장도 이어진다',()=>{
    const {w,p}=setup();p.needs.fatigue=70;const it=add(w,'PillBlue');w.s.knowledge.pillMap[it.def]='Pill.Sedative';const before=w.s.time
    expect(playerAct(w,{type:'consume',uid:it.uid},30)).toBeNull();expect(w.s.simulationPending).toBe(true);expect(p.activity?.drugSleep).toBe(true);expect(playerAct(w,{type:'stopActivity'},30)).toContain('약기운')
    const copy={db:w.db,s:deserialize(serialize(w.s))};finish(w);finish(copy);expect(w.s.time-before).toBe(2400*100);expect(p.activity).toBeUndefined();expect(p.asleep).toBe(false);expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('수면제 중에도35°C미만의 신체 위험이 수면을 깨운다',()=>{
    const {w,p}=setup(),it=add(w,'PillBlue');w.s.knowledge.pillMap[it.def]='Pill.Sedative';p.needs.bodyTemp=34.9
    expect(playerAct(w,{type:'consume',uid:it.uid},100)).toBeNull();finish(w);expect(p.activity).toBeUndefined();expect(p.asleep).toBe(false);expect(w.s.log.some((l)=>l.text.includes('추위에 잠이'))).toBe(true)
  })
  it('습포는3턴 뒤 그UID를 소비하고 중간 각인 복원 결과가 같다',()=>{
    const {w,p}=setup(),wd=wound(w),it=add(w,'BitterMoss'),before=w.s.time
    expect(playerAct(w,{type:'medicate',uid:it.uid,woundId:wd.id},1)).toBeNull();expect(w.s.simulationPending).toBe(true);expect(p.bag.some((i)=>i.uid===it.uid)).toBe(true)
    const copy={db:w.db,s:deserialize(serialize(w.s))};finish(w);finish(copy);expect(w.s.time-before).toBe(300);expect(wd.topicalDrug?.def).toBe('Drug.BitterMoss');expect(p.bag.some((i)=>i.uid===it.uid)).toBe(false);expect(drugEffects(w,p).topicalPain).toBe(2);expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('완료 전에 선택한 습포가 사라지면 같은 종류의 다른UID를 대신 쓰지 않는다',()=>{
    const {w,p}=setup(),wd=wound(w),a=add(w,'BitterMoss',2),b=splitInBag(w,p,a.uid,1,1,0)!;expect(startTopical(w,p,a.uid,wd.id,1)).toBeNull();const activity={...p.activity!};p.bag=p.bag.filter((i)=>i.uid!==a.uid)
    expect(finishTopical(w,p,activity)).toBe(false);expect(p.bag.find((i)=>i.uid===b.uid)?.count).toBe(1);expect(wd.topicalDrug).toBeUndefined()
  })
  it('내부 상처에 습포를 바르거나 외용약을 삼키면 상태와 자원을 바꾸지 않는다',()=>{
    const {w,p}=setup(),wd=wound(w),it=add(w,'BitterMoss');wd.internal=true;const hash=stateHash(w.s)
    expect(startTopical(w,p,it.uid,wd.id,1)).toContain('겉으로');expect(perform(w,p,{type:'consume',uid:it.uid}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('습포의 감염 억제는 대상 상처에만 적용되고 전신 항생제와는 가장 큰 값을 쓴다',()=>{
    const {w,p}=setup(),a=wound(w,'LeftForearm'),b=wound(w,'RightForearm');for(const x of [a,b]){x.bleed=0;x.infection={progress:10,immunity:0}}
    expect(administerDrug(w,p,'Drug.BitterMoss',undefined,1,a.id)).toBeNull();const startA=a.infection!.progress,startB=b.infection!.progress
    for(let i=0;i<1200;i++){w.s.time+=100;bodyTick(w,p,false)}
    const da=a.infection!.progress-startA,db=b.infection!.progress-startB;expect(db).toBeGreaterThan(0);expect(da/db).toBeCloseTo(.6,5)
    expect(administerDrug(w,p,'Drug.PillAntibiotic')).toBeNull();const aa=a.infection!.progress,bb=b.infection!.progress
    for(let i=0;i<1200;i++){w.s.time+=100;bodyTick(w,p,false)}
    expect(a.infection!.progress-aa).toBeCloseTo(b.infection!.progress-bb,5)
  })
})
