import {describe,expect,it} from 'vitest'
import {consumptionThoughtFixture,consumptionThoughtNativeFixture} from './consumption-thoughts-fixture'
import {activeThoughts} from '../src/core/thoughts'
import {perform} from '../src/core/actions'
import {playerAct,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {turnOf,tileAt} from '../src/core/ctx'
import {nutritionDef} from '../src/core/nutrition-state'
import {nourish} from '../src/core/nutrition'
import {alcoholStage} from '../src/core/drug-state'
import {drugPreview,pharmacologyTick} from '../src/core/pharmacology'
import {latentBiteClues,activeDiseases} from '../src/core/disease-state'
import {hasEffect} from '../src/core/traits'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const memory=(d:ReturnType<typeof consumptionThoughtFixture>,id:string)=>activeThoughts(d.w,d.p).find(t=>t.def==='Thought.'+id)
describe('실제 소비 사건의 기억과 현재 물림 단서',()=>{
 it('원래 건빵3개 중1개를 공개2턴 소비하면−2/4시간의 맛 기억이다',()=>{const d=consumptionThoughtNativeFixture('bland');expect(d.proof.actualTurns).toBe(2);expect(d.p.bag.find(i=>i.uid===d.proof.itemUid)!.count).toBe(2);expect(memory(d,'BlandFood')).toMatchObject({mood:-2,count:1,remaining:4798})})
 it('실제로 잘 준비된 같은 건빵은 훌륭한 식사이며 맛없음과 중복되지 않는다',()=>{const d=consumptionThoughtFixture(),it=d.add('Item.Hardtack');it.foodQ=60;expect(perform(d.w,d.p,{type:'consume',uid:it.uid}).ok).toBe(true);expect(memory(d,'BlandFood')).toBeUndefined();expect(memory(d,'FineMeal')).toMatchObject({mood:6})})
 it('실제 탄 건빵은 기존 탄 음식 반응이며 맛없음을 중복 생성하지 않는다',()=>{const d=consumptionThoughtFixture(),it=d.add('Item.Hardtack');it.foodBurnt=true;expect(perform(d.w,d.p,{type:'consume',uid:it.uid}).ok).toBe(true);expect(memory(d,'BlandFood')).toBeUndefined();expect(memory(d,'BurntFood')).toBeDefined()})
 it('원래 염장 결과 육포도 실제 평범하게 먹을 때만 맛없음 사건이다',()=>{const d=consumptionThoughtFixture(),it=d.add('Item.Jerky');expect(memory(d,'BlandFood')).toBeUndefined();expect(perform(d.w,d.p,{type:'consume',uid:it.uid}).ok).toBe(true);expect(memory(d,'BlandFood')).toMatchObject({mood:-2})})
 it('실제 상한 사과는−6/12시간 선형이며 오래된 음식과 중복하지 않는다',()=>{const d=consumptionThoughtNativeFixture('spoiled');expect(d.proof.actualTurns).toBe(1);expect(d.p.bag.find(i=>i.uid===d.proof.itemUid)!.count).toBe(2);expect(memory(d,'SpoiledFood')).toMatchObject({mood:-5,count:1,remaining:14399});expect(memory(d,'StaleFood')).toBeUndefined()})
 it('상하지 않고 오래된 음식은 기존−2 기억을 유지한다',()=>{const d=consumptionThoughtFixture(),it=d.add('Item.DriedApple');it.freshness=40;expect(perform(d.w,d.p,{type:'consume',uid:it.uid}).ok).toBe(true);expect(memory(d,'SpoiledFood')).toBeUndefined();expect(memory(d,'StaleFood')).toBeDefined()})
 it('영양 상한을 실제 초과한 식사는 기존 과식 신체효과와−2/2시간을 함께 준다',()=>{const d=consumptionThoughtNativeFixture('overate');expect(hasEffect(d.p,'overfull',turnOf(d.w))).toBe(true);expect(d.p.needs.kcal).toBeLessThanOrEqual(nutritionDef(d.w).maxKcal);expect(memory(d,'Overate')).toMatchObject({mood:-2,count:1,remaining:2398})})
 it('상한에 정확히 도달하는 실제 영양 공급은 과식이 아니다',()=>{const d=consumptionThoughtFixture();d.p.needs.kcal=nutritionDef(d.w).maxKcal-350;nourish(d.w,d.p,350);expect(d.p.needs.kcal).toBe(nutritionDef(d.w).maxKcal);expect(hasEffect(d.p,'overfull',turnOf(d.w))).toBe(false);expect(memory(d,'Overate')).toBeUndefined()})
 it('음식 조회/없는 물품 소비 거절은 시간·기억·난수·UID를 만들지 않는다',()=>{const d=consumptionThoughtFixture(),before=stateHash(d.s);expect(memory(d,'BlandFood')).toBeUndefined();expect(perform(d.w,d.p,{type:'consume',uid:99999}).ok).toBe(false);expect(stateHash(d.s)).toBe(before)})
 it('마지막 실제 술 약효가 끝나는 공개1턴에만 숙취−5/12시간을 준다',()=>{const d=consumptionThoughtNativeFixture('hangover');expect(d.proof.actualTurns).toBe(1);expect(alcoholStage(d.w,d.p)).toBe(0);expect(memory(d,'Hangover')).toMatchObject({mood:-5,count:1,remaining:14400})})
 it('다른 술 약효가 남아 있으면 먼저 끝난 한 잔은 숙취를 만들지 않는다',()=>{const d=consumptionThoughtFixture();d.alcoholEnd(1);d.p.drugs!.active.push({...d.p.drugs!.active[0]!,until:turnOf(d.w)+10});expect(playerAct(d.w,{type:'wait'})).toBeNull();expect(alcoholStage(d.w,d.p)).toBe(1);expect(memory(d,'Hangover')).toBeUndefined()})
 it('과거에 이미 끝나 있던 모르는 약효를 새 숙취로 소급하지 않는다',()=>{const d=consumptionThoughtFixture();d.alcoholEnd(-1);expect(playerAct(d.w,{type:'wait'})).toBeNull();expect(memory(d,'Hangover')).toBeUndefined()})
 it('구형 실제 알코올 효과의 현재 종료도 약물 상태를 꾸미지 않고 기억한다',()=>{const d=consumptionThoughtFixture();d.p.effects.push({kind:'alcohol',untilTurn:turnOf(d.w)+1});expect(playerAct(d.w,{type:'wait'})).toBeNull();expect(memory(d,'Hangover')).toMatchObject({mood:-5,count:1});expect(d.p.drugs).toBeUndefined()})
 it('약효/견적의 반복 조회는 숙취나 기억·시간·난수를 만들지 않는다',()=>{const d=consumptionThoughtFixture();d.alcoholEnd(1);const before=stateHash(d.s);for(let i=0;i<4;i++){alcoholStage(d.w,d.p);drugPreview(d.w,d.p,'Drug.Alcohol');memory(d,'Hangover')}expect(stateHash(d.s)).toBe(before)})
 it('같은 실제 종료 틱을 반복 정산해도 숙취가 중복되지 않는다',()=>{const d=consumptionThoughtNativeFixture('hangover'),before=stateHash(d.s);pharmacologyTick(d.w,d.p);expect(stateHash(d.s)).toBe(before);expect(memory(d,'Hangover')!.count).toBe(1)})
 it('원래 술병을 실제 마시고 남은2400턴 약효를 모두 진행해 종료를 관찰한다',()=>{const d=consumptionThoughtFixture(),bottle=d.add('Item.Moonshine');const fire={x:d.p.pos.x+1,y:d.p.pos.y};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}];expect(playerAct(d.w,{type:'consume',uid:bottle.uid})).toBeNull();expect(bottle.uses).toBe(4);expect(memory(d,'Hangover')).toBeUndefined();const until=d.p.drugs!.active[0]!.until;expect(playerAct(d.w,{type:'rest',turns:until-turnOf(d.w)})).toBeNull();expect(turnOf(d.w)).toBe(until);expect(memory(d,'Hangover')).toMatchObject({mood:-5,count:1,remaining:14400});expect(d.p.bag.find(i=>i.uid===bottle.uid)!.uses).toBe(4)},30000)
 it('이미 아문 실제 잠복 물림의 기존 단서는 병명 없이 심리 목록에도−2이다',()=>{const d=consumptionThoughtNativeFixture('bite');expect(latentBiteClues(d.w,d.p)).toHaveLength(1);expect(activeDiseases(d.w,d.p)).toEqual([]);expect(memory(d,'BiteAche')).toMatchObject({mood:-2,count:1,label:'물린 자리가 쑤신다'});expect(memory(d,'BiteAche')!.label).not.toContain('거품병')})
 it('물린 상처가 아직 아물지 않았거나 이미 발병/면역이 되면 잠복 흉터 단서가 아니다',()=>{for(const phase of ['open','active','immune']){const d=consumptionThoughtFixture();d.latentBite();const s=d.p.diseases![0]!;if(phase==='open')d.p.body.wounds.push({id:67,def:'Wound.Bite',part:'LeftForearm',severity:2,healed:0,bleed:0,arterial:false,internal:false,contam:0,ageTurns:0,source:'원래 물림'});if(phase==='active')s.incubatesUntil=turnOf(d.w);if(phase==='immune')s.immunity=100;expect(memory(d,'BiteAche'),phase).toBeUndefined()}})
 it('물림 감염이 없거나 위치/원래 상처를 모르는 과거 기록에 단서를 추측하지 않는다',()=>{const d=consumptionThoughtFixture();expect(memory(d,'BiteAche')).toBeUndefined();d.latentBite();delete d.p.diseases![0]!.source;expect(memory(d,'BiteAche')).toBeUndefined()})
 it('현재 잠복 단서의 반복 조회는 감염/원래 흉터/난수/시간을 바꾸지 않는다',()=>{const d=consumptionThoughtFixture();d.latentBite();const before=stateHash(d.s);for(let i=0;i<4;i++)expect(memory(d,'BiteAche')!.mood).toBe(-2);expect(stateHash(d.s)).toBe(before)})
 it('미완료 휴식19턴 재개에서 실제10턴째 종료가 한 번만 발생하고 전체 상태가 같다',()=>{const d=consumptionThoughtNativeFixture('pending');expect(d.proof.actualTurns).toBe(1);expect(memory(d,'Hangover')).toBeUndefined();const w={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(w.s).toEqual(d.s);expect(memory(d,'Hangover')).toMatchObject({mood:-4,count:1,remaining:14390})})
 it('106각인은 버전만 이관하고 과거 음식·술의 기억을 추정하지 않는다',()=>{const d=consumptionThoughtFixture(),old=JSON.parse(serialize(d.s));old.version=106;const s=deserialize(JSON.stringify(old));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:106}).toEqual(old)})
 it('음식의 없는/유한하지 않은 사고 참조를 거절한다',()=>{for(const value of ['Thought.Missing','Thought.BiteAche','']){const m=loadMods([...readPackages(),{manifest:{id:'bad',name:'bad',version:'1'},defs:[],patches:[{op:'add',target:'Item.Hardtack',path:'/food/plainThought',value}]}]);expect(m.report.errors.some(e=>e.includes('plainThought')||e.includes('Thought.Missing'))).toBe(true)}})
})
