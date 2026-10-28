import {SAVE_VERSION} from '../src/core/game'
import {describe,it,expect} from 'vitest'
import {storyDirectorFixture} from './story-director-fixture'
import {storyUnitCost,commitStoryPressure} from '../src/core/story-director'
import {createCreature} from '../src/core/creatures'
import {newGame} from '../src/core/game'
import {storytellerTick} from '../src/core/storyteller'
import {turnOf,type World} from '../src/core/ctx'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {db} from './helpers'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
describe('실제 추가 순찰 인원의 단가/유한 예산과 편성 영수',()=>{
 for(const [id,cost]of[['Creature.Reaver',25],['Creature.ReaverArcher',30],['Creature.ReaverChief',60]]as const)it(`${id} 실제 인원 단가는${cost}이며 조회로 몸/예산/난수를 바꾸지 않는다`,()=>{const d=storyDirectorFixture(),c=createCreature(d.w,id,{x:22,y:20}),before=stateHash(d.s);expect(storyUnitCost(d.w,c)).toBe(cost);expect(stateHash(d.s)).toBe(before)})
 it('기본25예산이 있어도 실제 궁수30이 부족하면 지불이 원자적으로 거절된다',()=>{const d=storyDirectorFixture();d.director.budgetTenths=290;const before=serialize(d.s);expect(commitStoryPressure(d.w,30)).toBe(false);expect(serialize(d.s)).toBe(before)})
 it('실제 궁수 단가30을 낼 수 있을 때에만 정확히30을 차감한다',()=>{const d=storyDirectorFixture();d.director.budgetTenths=540;expect(commitStoryPressure(d.w,30)).toBe(true);expect(d.director.budgetTenths).toBe(240)})
 it('실제 편성한 원래 궁수/근접병과 비용 기록이 일치하고 없는 인원을 만들지 않는다',()=>{let archer=false,melee=false;for(let n=0;n<80&&(!archer||!melee);n++){const w:World={db,s:newGame(db,{seed:'unit-price-'+n,storyteller:'pursuit'})};w.s.time=36000*100;const state=w.s.storyteller.director!;state.lastAt=36000;state.budgetTenths=540;const ids=w.s.creatures.map(c=>c.id),next=w.s.nextId;storytellerTick(w);const receipt=state.lastPurchase;if(!receipt?.extraId)continue;const extra=w.s.creatures.find(c=>c.id===receipt.extraId)!;expect(extra.ai.mode).toBe('patrol');expect(extra.ai.route).toHaveLength(3);expect(ids).toContain(extra.id);expect(w.s.creatures.map(c=>c.id)).toEqual(ids);expect(w.s.nextId).toBe(next);expect(receipt.at).toBe(turnOf(w));expect(receipt.cost).toBe(extra.def==='Creature.ReaverArcher'?30:25);expect(state.budgetTenths).toBe(540-receipt.cost*10);if(extra.def==='Creature.ReaverArcher')archer=true;else melee=true}expect(archer).toBe(true);expect(melee).toBe(true)})
 it('예산26에서는 추가 궁수를 가정하지 않고 실제로 지불할 빈도 강화만 기록한다',()=>{let checked=false;for(let n=0;n<100&&!checked;n++){const w:World={db,s:newGame(db,{seed:'only-frequency-'+n,storyteller:'pursuit'})};w.s.time=3600000;const state=w.s.storyteller.director!;state.lastAt=36000;state.budgetTenths=260;storytellerTick(w);if(state.lastPurchase&&!state.lastPurchase.extraId){expect(state.lastPurchase.cost).toBe(25);expect(state.budgetTenths).toBe(10);expect(w.s.creatures.filter(c=>c.ai.mode==='patrol').length).toBeLessThanOrEqual(3);checked=true}}expect(checked).toBe(true)})
 it('현재 실제 비용/추가 인물 기록은 각인으로 그대로 복원된다',()=>{for(let n=0;n<50;n++){const w:World={db,s:newGame(db,{seed:'receipt-restore-'+n,storyteller:'pursuit'})};w.s.time=3600000;const state=w.s.storyteller.director!;state.lastAt=36000;state.budgetTenths=540;storytellerTick(w);if(!state.lastPurchase)continue;expect(JSON.parse(serialize(deserialize(serialize(w.s))))).toEqual(JSON.parse(serialize(w.s)));return}throw Error('actual purchase receipt missing')})
 it('구형134의 과거 강화에서 지불/추가 인물 기록을 추정하지 않는다',()=>{const d=storyDirectorFixture();d.director.lastMajorAt=turnOf(d.w);const raw=JSON.parse(serialize(d.s));raw.version=134;delete raw.storyteller.director.lastPurchase;const copy=deserialize(JSON.stringify(raw));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:134}).toEqual(raw);expect(copy.storyteller.director!.lastPurchase).toBeUndefined()})
 it('잘못된 생물/비용은 모드 검증에서 거절한다',()=>{const id='bad-unit-price',m=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Event.ReaverPatrol',path:'/director/unitCosts/Creature.ReaverArcher',value:-1}]}],[id]);expect(m.report.errors.length).toBeGreaterThan(0)})
})
