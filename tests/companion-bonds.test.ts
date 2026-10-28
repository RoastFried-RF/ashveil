import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { companionBondDef, ensureCompanionBond } from '../src/core/companion-bond-state'
import { companionBondTick, hearCompanionBond, initializeResidentPersonality, recordCompanionBond } from '../src/core/companion-bonds'
import { isCompanion } from '../src/core/companion-state'
import { companionTick, dismissCompanion, hireCompanion, payCompanion } from '../src/core/companions'
import { resolveAttack } from '../src/core/combat'
import { player, tileAt, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { hostile } from '../src/core/diplomacy'
import { talk } from '../src/core/economy'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { addToBag, equip, makeItem } from '../src/core/items'
import { moraleOf } from '../src/core/morale'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { db } from './helpers'
const template=newGame(db,{seed:'companion-bonds',background:'Bg.Hunter',overworld:true})
function setup(hire=true){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!
 m.currentRegion=site.id;m.position={...site.cell};s.creatures=[p];s.sources=[];s.time=12*1200*100;s.storyteller.budget=-1e9
 for(let y=12;y<28;y++)for(let x=17;x<44;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
 initializeSettlement(w);const c=s.creatures.find((c)=>db.creature(c.def).ai==='guard')!
 for(const a of s.creatures){a.nextAct=s.time;a.hp=95;a.age=undefined;a.traits=[];a.background=undefined;a.traumas=[];a.effects=[];a.body.wounds=[];a.body.missing=[];a.body.blood=a.body.bloodMax;a.asleep=false;a.unconscious=false;a.activity=undefined;a.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(a.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0})}
 p.pos={x:20,y:20};c.pos={x:21,y:20};p.money=1000;c.money=17;s.map.ambient=1;s.map.lights=[];s.creatures=[p,c];invalidateLights(w)
 if(hire)expect(hireCompanion(w,c)).toBeNull()
 return{w,s,p,c,m,site}
}
function together(w:World,c:ReturnType<typeof player>,turns=1200){for(let i=0;i<turns;i++){w.s.time+=100;companionBondTick(w,c)}}
describe('동료 관계·성향 충돌과 관찰한 태도',()=>{
 it('새 주민의 성향은 같은 시드/인물별 스트림으로 한 번 지정하고 기존 성향을 보존한다',()=>{const a=setup(false),b=setup(false);a.c.traits=[];b.c.traits=[];const main=structuredClone(a.s.rng.world);initializeResidentPersonality(a.w,a.c);initializeResidentPersonality(b.w,b.c);expect(a.c.traits).toEqual(b.c.traits);expect(companionBondDef(a.w).personalities).toContain(a.c.traits[0]);expect(a.s.rng.world).toEqual(main);const hash=stateHash(a.s);initializeResidentPersonality(a.w,a.c);expect(stateHash(a.s)).toBe(hash)})
 it('같이 보며 깨어 지낸 실제1200턴을 채워야 관계가 쌓이고 일일 긍정 상한을 쓴다',()=>{const{w,c}=setup();together(w,c,1199);expect(c.companion!.bond!.score).toBe(0);together(w,c,1);expect(c.companion!.bond!.score).toBe(1);together(w,c,3600);expect(c.companion!.bond!.score).toBe(3);expect(c.companion!.bond!.positiveToday).toBe(3);expect(c.companion!.bond!.events).toHaveLength(3)})
 it('같은 턴에 반복 호출해도 시간/관계/난수/물품이 변하지 않는다',()=>{const{w,c}=setup();w.s.time+=100;companionBondTick(w,c);const hash=stateHash(w.s);for(let i=0;i<10;i++)companionBondTick(w,c);expect(stateHash(w.s)).toBe(hash)})
 it('원격·벽 너머·수면·실신·해고한 사람과의 시간은 관계로 누적하지 않는다',()=>{for(const mode of ['far','wall','sleepPlayer','sleepNpc','unconscious','dismissed']){const{w,p,c}=setup();if(mode==='far')p.pos.x+=10;if(mode==='wall'){p.pos={x:23,y:20};for(let y=12;y<28;y++)tileAt(w,{x:22,y}).t='Terrain.RuinWall'}if(mode==='sleepPlayer')p.asleep=true;if(mode==='sleepNpc')c.asleep=true;if(mode==='unconscious')c.unconscious=true;if(mode==='dismissed')c.companion!.status='dismissed';invalidateLights(w);together(w,c,1200);expect(c.companion!.bond!.score,mode).toBe(0);expect(c.companion!.bond!.together,mode).toBe(0)}})
 it('냉혈/다정의 충돌은 방향에 관계없이 같은 실제 동행 손실로 남는다',()=>{for(const reverse of [false,true]){const{w,p,c}=setup();p.traits=[reverse?'Trait.ColdBlooded':'Trait.TenderHearted'];c.traits=[reverse?'Trait.TenderHearted':'Trait.ColdBlooded'];together(w,c);expect(c.companion!.bond!.score).toBe(-2);expect(c.companion!.bond!.events.at(-1)).toMatchObject({kind:'conflict',delta:-2});expect(c.companion!.bond!.heard!.attitude).toBe('neutral')}})
 it('공통 성향은 누적에 반영하되 같은 날 무한 긍정 점수를 주지 않는다',()=>{const{w,p,c}=setup();p.traits=['Trait.Pious'];c.traits=['Trait.Pious'];together(w,c);expect(c.companion!.bond!.score).toBe(2);together(w,c);expect(c.companion!.bond!.score).toBe(3);together(w,c);expect(c.companion!.bond!.score).toBe(3)})
 it('함께 있던 시간을 유지하되 달력만 건너뛴 시간은 무료로 누적하지 않는다',()=>{const{w,c}=setup();together(w,c,600);w.s.time+=TURNS_PER_DAY*100;companionBondTick(w,c);expect(c.companion!.bond!.together).toBe(601);expect(c.companion!.bond!.score).toBe(0);together(w,c,599);expect(c.companion!.bond!.score).toBe(1)})
 it('급료는 실제 현금 이전 후 한 번 반영하고 거절한 지급은 관계도 바꾸지 않는다',()=>{const{w,p,c}=setup(),money=p.money!,cash=c.money!;expect(payCompanion(w,c)).toBeNull();expect(c.companion!.bond!.score).toBe(1);expect([p.money,c.money]).toEqual([money-6,cash+6]);const hash=stateHash(w.s);expect(payCompanion(w,c)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)})
 it('선불 만료의 관계 손실은 한 번뿐이며 원격으로 돈을 빼지 않는다',()=>{const{w,p,c}=setup(),money=p.money,cash=c.money;w.s.time=c.companion!.paidUntil*100;companionTick(w,c);expect(c.companion!.bond!.score).toBe(-5);expect(c.companion!.status).toBe('unpaid');const hash=stateHash(w.s);companionTick(w,c);expect(stateHash(w.s)).toBe(hash);expect([p.money,c.money]).toEqual([money,cash])})
 it('관계 때문에 헤어져도 같은 몸/장비/현금이 현지에 남는다',()=>{const{w,p,c}=setup(),body=structuredClone(c.body),bag=structuredClone(c.bag),money=[p.money,c.money],id=w.s.nextId;recordCompanionBond(w,c,'conflict',-25,'검증 갈등');expect(c.companion!.status).toBe('left');expect(isCompanion(w,c)).toBe(false);expect(w.s.creatures).toContain(c);expect(c.body).toEqual(body);expect(c.bag).toEqual(bag);expect([p.money,c.money]).toEqual(money);expect(w.s.nextId).toBe(id)})
 it('대화는 당시 태도만 알려 주고 이후 사적인 관계 변화를 자동 공개하지 않는다',()=>{const{w,p,c}=setup();recordCompanionBond(w,c,'conflict',-10,'검증');const old=structuredClone(c.companion!.bond!.heard);expect(old!.attitude).toBe('neutral');expect(talk(w,p,c)).toBeNull();expect(c.companion!.bond!.heard!.attitude).toBe('uneasy');const heard=structuredClone(c.companion!.bond!.heard);recordCompanionBond(w,c,'together',40,'검증');expect(c.companion!.bond!.heard).toEqual(heard);expect(talk(w,p,c)).toBeNull();expect(c.companion!.bond!.heard!.attitude).toBe('trust')})
 it('청각·의식·거리·수면 조건이 안 되면 태도 조회로 숨은 마음을 갱신하지 않는다',()=>{for(const mode of ['deaf','far','sleep','unconscious']){const{w,p,c}=setup();recordCompanionBond(w,c,'conflict',-10,'검증');if(mode==='deaf')p.body.missing=['LeftEar','RightEar'];if(mode==='far')p.pos.x+=4;if(mode==='sleep')c.asleep=true;if(mode==='unconscious')c.unconscious=true;const hash=stateHash(w.s);hearCompanionBond(w,c);expect(stateHash(w.s),mode).toBe(hash)}})
 it('관계 점수는 NPC 자신의 사기에만 반영하고 읽기가 상태를 바꾸지 않는다',()=>{const{w,c}=setup(),base=moraleOf(w,c);recordCompanionBond(w,c,'together',40,'검증');const hash=stateHash(w.s);expect(moraleOf(w,c)).toBe(base+2);expect(stateHash(w.s)).toBe(hash)})
 it('실제 고용주의 공격 시도는 계약을 해제하고 반격/목격 평판 규칙을 쓴다',()=>{const{w,p,c,m}=setup(),knife=makeItem(w,'Item.RustyKnife');addToBag(w,p,knife);expect(equip(w,p,knife.uid)).toBeNull();resolveAttack(w,p,c);expect(c.alive).toBe(true);expect(c.companion!.status).toBe('betrayed');expect(isCompanion(w,c)).toBe(false);expect(hostile(w,p,c)).toBe(true);expect(c.attackedBy).toContain(p.id);expect(m.society!.events.some((e)=>e.target===c.id)).toBe(true);expect(c.companion!.bond!.events.filter((e)=>e.kind==='betrayal')).toHaveLength(1);resolveAttack(w,p,c);expect(c.companion!.bond!.events.filter((e)=>e.kind==='betrayal')).toHaveLength(1)})
 it('관계 누적 중간 저장/재개는 점수·시간·난수·들은 태도가 전체 동일하다',()=>{const{w,c}=setup();together(w,c,700);const copy:World={db,s:deserialize(serialize(w.s))},other=copy.s.creatures.find((a)=>a.id===c.id)!;together(w,c,500);together(copy,other,500);expect(stateHash(copy.s)).toBe(stateHash(w.s))})
 it('구형26각인은 기존 몸/성향/계약을 바꾸거나 과거 신뢰를 지어내지 않는다',()=>{const{w,c}=setup(),old=JSON.parse(serialize(w.s));old.version=26;delete old.creatures.find((a:typeof c)=>a.id===c.id).companion.bond;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:26}).toEqual(old);const other=copy.creatures.find((a)=>a.id===c.id)!;ensureCompanionBond({db,s:copy},other);expect(other.companion!.bond!.score).toBe(0);expect(other.companion!.bond!.together).toBe(0)})
 it('실제 한 시간 휴식의 공통 스케줄러에서도 함께 지낸 시간이 쌓인다',()=>{const{w,p,c}=setup(),before=turnOf(w);expect(playerAct(w,{type:'rest',turns:1200},1000)).toBeNull();for(let i=0;w.s.simulationPending&&i<100;i++)runUntilInput(w,1000);expect(w.s.simulationPending).toBeFalsy();expect(turnOf(w)-before).toBe(1200);expect(c.companion!.bond!.score).toBe(1);expect(p.needs.waterDeficit+(p.needs.waterRemainder??0)).toBeGreaterThan(0)},15000)
 it('해고/재고용으로 이미 쌓인 관계와 일일 상한을 초기화하지 못한다',()=>{const{w,c}=setup();recordCompanionBond(w,c,'together',5,'검증');const bond=c.companion!.bond!;bond.positiveToday=3;expect(dismissCompanion(w,c)).toBeNull();expect(hireCompanion(w,c)).toBeNull();expect(c.companion!.bond).toBe(bond);expect(bond.score).toBe(5);expect(bond.positiveToday).toBe(3);recordCompanionBond(w,c,'conflict',-40,'검증');const hash=stateHash(w.s);expect(hireCompanion(w,c)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)})

})
