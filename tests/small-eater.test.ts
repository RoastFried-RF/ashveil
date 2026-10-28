import {describe,expect,it} from 'vitest'
import {consumptionThoughtFixture} from './consumption-thoughts-fixture'
import {nourish} from '../src/core/nutrition'
import {overeatThreshold,nutritionDef} from '../src/core/nutrition-state'
import {activeThoughts} from '../src/core/thoughts'
import {hasEffect} from '../src/core/traits'
import {turnOf} from '../src/core/ctx'
import {playerAct,runUntilInput} from '../src/core/game'
import {stateHash,serialize,deserialize} from '../src/core/save'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const setup=()=>{const d=consumptionThoughtFixture();d.p.traits=['Trait.SmallEater'];return d}
describe('소식가의 실제 과식 경계',()=>{
 it('조회는 전체 상태를 바꾸지 않으며 과식 기준1500과 저장 상한3000을 구분한다',()=>{const d=setup(),before=stateHash(d.s);expect(overeatThreshold(d.w,d.p)).toBe(1500);expect(nutritionDef(d.w).maxKcal).toBe(3000);expect(stateHash(d.s)).toBe(before)})
 it.each([[1499,1,false],[1499,1.01,true],[1500,1,true],[1501,0,false],[1501,-1,false]] as const)('잔고%s + 실제 열량%s의 경계', (balance,kcal,overate)=>{const d=setup();d.p.needs.kcal=balance;nourish(d.w,d.p,kcal);expect(hasEffect(d.p,'overfull',turnOf(d.w))).toBe(overate);expect(activeThoughts(d.w,d.p).some(t=>t.def==='Thought.Overate')).toBe(overate)})
 it('일반 인물은1500을 넘어도3000을 넘기 전에는 과식하지 않는다',()=>{const d=setup();d.p.traits=[];d.p.needs.kcal=1500;nourish(d.w,d.p,350);expect(overeatThreshold(d.w,d.p)).toBe(3000);expect(hasEffect(d.p,'overfull',turnOf(d.w))).toBe(false)})
 it('원래 건빵3개 중 실제1개를 먹어야 과식 기억/2시간 효과를 얻고 저장 칼로리는1500을 넘는다',()=>{const d=setup(),food=d.add('Item.Hardtack',3);d.p.needs.kcal=1499;const at=d.s.time;expect(playerAct(d.w,{type:'consume',uid:food.uid})).toBeNull();expect((d.s.time-at)/100).toBe(2);expect(food.count).toBe(2);expect(d.p.needs.kcal).toBeGreaterThan(1500);expect(hasEffect(d.p,'overfull',turnOf(d.w))).toBe(true);expect(activeThoughts(d.w,d.p).find(t=>t.def==='Thought.Overate')).toMatchObject({mood:-2,remaining:2398})})
 it('이미1500을 넘는 옛 저장을 복원/조회해도 먹기 전의 과식 사건을 만들지 않는다',()=>{const d=setup();d.p.needs.kcal=1700;const copy={db:d.w.db,s:deserialize(serialize(d.s))},before=stateHash(copy.s);activeThoughts(copy,copy.s.creatures.find(c=>c.id===copy.s.playerId)!);expect(stateHash(copy.s)).toBe(before);expect(copy.s.creatures.find(c=>c.id===copy.s.playerId)!.effects).toEqual([])})
 it('실제 소비 뒤 미완료 휴식을 저장하고 나머지19턴을 전체 동일하게 이어간다',()=>{const d=setup(),food=d.add('Item.Hardtack',3);d.p.needs.kcal=1499;expect(playerAct(d.w,{type:'consume',uid:food.uid})).toBeNull();expect(playerAct(d.w,{type:'rest',turns:20},2)).toBeNull();const copy={db:d.w.db,s:deserialize(serialize(d.s))},at=d.s.time;runUntilInput(d.w);runUntilInput(copy);expect((d.s.time-at)/100).toBe(19);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.p.bag.find(i=>i.uid===food.uid)!.count).toBe(2)})
 it('음수 과식 기준의 모드는 검증에서 거절한다',()=>{const id='bad-overeat',m=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Trait.SmallEater',path:'/mods/overeatAt',value:-1}]}],[id]);expect(m.report.errors.length).toBeGreaterThan(0)})
})
