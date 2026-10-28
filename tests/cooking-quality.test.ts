import {SAVE_VERSION} from '../src/core/game'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {describe,expect,it} from 'vitest'
import {activityStep,perform,consumeFor} from '../src/core/actions'
import {cookingQualityBase} from '../src/core/crafting'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {masteryStage} from '../src/core/skills'
import {activeThoughts} from '../src/core/thoughts'
import {player} from '../src/core/ctx'
import {cookingFixture as setup} from './campfire-cooking-fixture'
import {finishBase} from './base-camp-fixture'
const output=(d:ReturnType<typeof setup>)=>d.p.bag.find(i=>i.def==='Item.BakedPotato')!
function cook(d:ReturnType<typeof setup>){expect(perform(d.w,d.p,{type:'cook',uid:d.raw.uid}).ok).toBe(true);finishBase(d.w,d.p);return output(d)}
describe('직접 굽기의 실제 지각/생존 음식 품질과 원본 음식 아이콘',()=>{
 it('품질 기초 견적은 실제 몸/물품/시간/난수를 바꾸지 않는다',()=>{const d=setup(),hash=stateHash(d.s);expect(cookingQualityBase(d.w,d.p)).toBe(15);expect(stateHash(d.s)).toBe(hash)})
 it('같은 실제 난수/재료에서 지각5가 Q기초10만 높인다',()=>{const a=setup(),b=setup();b.p.stats.per+=5;expect(cookingQualityBase(b.w,b.p)-cookingQualityBase(a.w,a.p)).toBe(10);const x=cook(a),y=cook(b);expect(y.foodQ!-x.foodQ!).toBe(10)})
 it('실제 생존 숙달 한 단계는 같은 기초에4를 더한다',()=>{const d=setup(),before=cookingQualityBase(d.w,d.p);d.p.skills.survival=5;expect(masteryStage(d.w,d.p,'survival')).toBe(1);expect(cookingQualityBase(d.w,d.p)-before).toBe(4)})
 it('조리 시작과199턴에는 결과/Q/추가 난수나 영양이 없다',()=>{const d=setup(),before=structuredClone(d.s.rng);perform(d.w,d.p,{type:'cook',uid:d.raw.uid});for(let i=0;i<199;i++)activityStep(d.w,d.p);expect(output(d)).toBeUndefined();expect(d.raw.def).toBe('Item.RawPotato');expect(d.raw.cookProgress).toBe(199);expect(d.s.rng).toEqual(before);expect(d.p.needs.kcal).toBe(0)})
 it('실제200번째 턴만 한 결과/Q 판정과 독립 음식 난수를 만든다',()=>{const d=setup(),before=structuredClone(d.s.rng),out=cook(d);expect(out.foodQ).toBeGreaterThanOrEqual(0);expect(out.foodQ).toBeLessThanOrEqual(30);expect(Object.fromEntries(Object.entries(d.s.rng).filter(([key])=>key!=='cooking.'+d.raw.uid))).toEqual(before);expect(d.s.rng['cooking.'+d.raw.uid]).toBeDefined();expect(d.p.bag.filter(i=>i.def==='Item.BakedPotato')).toHaveLength(1);expect(d.p.needs.kcal).toBe(0)})
 it('이미 완료된 뒤 추가 활동 호출은 Q를 다시 굴리지 않는다',()=>{const d=setup(),out=cook(d),q=out.foodQ,before=structuredClone(d.s.rng);activityStep(d.w,d.p);expect(out.foodQ).toBe(q);expect(d.s.rng).toEqual(before)})
 it('같은 한 개의 실제 조리 영양/신선도/재와 해동 상태를 보존한다',()=>{const d=setup();d.raw.foodFrozen=true;d.raw.foodBurnt=true;const out=cook(d);expect(out).toMatchObject({count:1,def:'Item.BakedPotato',freshness:73,contaminantAsh:.4,foodThawed:true,foodBurnt:true});expect(d.w.db.item(out.def).food).toMatchObject({kcal:150,protein:4,vitamin:4,water:120})})
 it('실제 조리 시작 조건을 저장하고 도중 능력치 표시 변경으로 마지막 턴 Q를 바꾸지 않는다',()=>{const a=setup(),b=setup();for(const d of[a,b])perform(d.w,d.p,{type:'cook',uid:d.raw.uid});b.p.stats.per=30;for(const d of[a,b])finishBase(d.w,d.p);expect(output(a).foodQ).toBe(output(b).foodQ)})
 it('높은 실제 지각/숙달로 만든 한 끼를 먹은 당사자만 좋은 음식 사고를 받는다',()=>{const d=setup();d.p.stats.per=30;d.p.skills.survival=80;const out=cook(d);expect(out.foodQ).toBeGreaterThanOrEqual(45);expect(consumeFor(d.w,d.p,d.p,out.uid).ok).toBe(true);expect(activeThoughts(d.w,d.p).some(t=>t.def==='Thought.FineMeal')).toBe(true);expect(d.p.needs.kcal).toBe(150)})
 it('낮은 실제 Q의 같은 한 끼는 좋은 음식 사고를 지어내지 않는다',()=>{const d=setup(),out=cook(d);expect(out.foodQ).toBeLessThan(45);consumeFor(d.w,d.p,d.p,out.uid);expect(d.p.thoughts.some(t=>t.def==='Thought.FineMeal')).toBe(false)})
 it('같은3개 더미의 원래 한 개만 익히고 나머지2개는 원본으로 남긴다',()=>{const d=setup(undefined,3),out=cook(d);expect(d.raw.count).toBe(2);expect(d.raw.def).toBe('Item.RawPotato');expect(out.count).toBe(1);expect(out.uid).not.toBe(d.raw.uid);expect(d.raw.cookProgress).toBeUndefined()})
 it('완료 직전 전체 각인은 같은 다음 한 번의 품질 난수와 결과를 보존한다',()=>{const d=setup();perform(d.w,d.p,{type:'cook',uid:d.raw.uid});for(let i=0;i<199;i++)activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy])activityStep(w,player(w));expect(copy.s).toEqual(JSON.parse(serialize(d.s)));expect(copy.s.version).toBe(SAVE_VERSION)})
 it('구형80 완성 음식에는 과거 Q를 추정하지 않는다',()=>{const d=setup(),food=d.add('Item.BakedPotato'),old=JSON.parse(serialize(d.s));old.version=80;const copy=deserialize(JSON.stringify(old));expect({...copy,version:80}).toEqual(old);expect(player({db:d.w.db,s:copy}).bag.find(i=>i.uid===food.uid)!.foodQ).toBeUndefined()})
 it('구형80 실제 진행 중 조리도 기록된 남은1턴 뒤에만 음식Q를 만든다',()=>{const d=setup();perform(d.w,d.p,{type:'cook',uid:d.raw.uid});for(let i=0;i<199;i++)activityStep(d.w,d.p);const old=JSON.parse(serialize(d.s));old.version=80;delete old.creatures.find((c:typeof d.p)=>c.id===d.p.id).activity.cookQualityBase;const copy={db:d.w.db,s:deserialize(JSON.stringify(old))};expect(player(copy).activity!.remaining).toBe(1);activityStep(copy,player(copy));expect(player(copy).bag.find(i=>i.def==='Item.BakedPotato')!.foodQ).toBeTypeOf('number')})
 it('치즈와 잿딸기는 서로 다른 자체 원본32×32 프레임이며 버섯 그림을 쓰지 않는다',()=>{
  const d=setup(),keys=['complete_item_cheese','complete_item_ash_berry']
  expect([d.w.db.item('Item.Cheese').sprite,d.w.db.item('Item.AshBerry').sprite]).toEqual(keys)
  const m=JSON.parse(readFileSync('src/client/sprites.json','utf8')),frames=keys.map(key=>m.frames[key])
  for(const frame of frames){expect(frame.slice(3)).toEqual([32,32]);expect(m.sheets[frame[0]]).toContain('/original/')}
  expect(frames[0]).not.toEqual(frames[1])
  const [a,b]=keys.map(key=>readFileSync('public/sprites/original/complete/items/'+key+'.png'))
  for(const img of[a,b]){expect(img!.readUInt32BE(16)).toBe(32);expect(img!.readUInt32BE(20)).toBe(32)}
  expect(a!.equals(b!)).toBe(false)
 })
 it('보관한 원본 출처의 SHA-256과 PNG 내용이 일치하며 라이선스를 보존한다',()=>{const m=JSON.parse(readFileSync('tools/art/food-sources.json','utf8'));expect(m.modified).toBe(false);for(const i of m.icons)expect(createHash('sha256').update(readFileSync(i.file)).digest('hex')).toBe(i.sha256);expect(readFileSync(m.licenseFile,'utf8')).toContain('public')})
})
