import {describe,expect,it} from 'vitest'
import {perform} from '../src/core/actions'
import {applyContentTransition} from '../src/core/content-transition'
import {addToBag,equip,makeItem} from '../src/core/items'
import {missingItemPlan} from '../src/core/missing-items'
import {serialize} from '../src/core/save'
import {prisonerFixture} from './prisoner-fixture'

function setup(filled=true){const d=prisonerFixture();d.p.bag=[];d.p.equip={};const belt=makeItem(d.w,'Item.LeatherBelt');addToBag(d.w,d.p,belt);expect(equip(d.w,d.p,belt.uid)).toBeNull();if(filled){const food=makeItem(d.w,'Item.Jerky',2);addToBag(d.w,d.p,food);perform(d.w,d.p,{type:'openBag',uid:belt.uid});perform(d.w,d.p,{type:'lootPut',uid:food.uid})}return{...d,belt}}
function unknown(d:ReturnType<typeof setup>){delete d.s.loadHash;delete d.s.contentItemShapes;delete d.s.contentDefinitions;delete d.s.contentMods;delete d.s.gameVersion;delete d.s.defSchemaVersion}

describe('구형 각인의 실제 빈/사용한 주머니와 기록 공백',()=>{
 it('같은 실제 해시에 모양 기록만 없으면 내용물이 있는 주머니도 원본 배치로 확인하고 보강한다',()=>{const d=setup();delete d.s.contentItemShapes;const before=JSON.parse(serialize(d.s));expect(applyContentTransition(d.w)).toBeNull();expect(d.s.contentItemShapes).toEqual(d.w.db.itemShapeManifest());expect({...JSON.parse(serialize(d.s)),contentItemShapes:undefined}).toEqual({...before,contentItemShapes:undefined})})
 it('기록 없는 빈 주머니는 과거 해시/크기를 만들지 않고 계속 쓸 수 있다',()=>{const d=setup(false);unknown(d);const before=serialize(d.s);expect(applyContentTransition(d.w)).toBeNull();expect(serialize(d.s)).toBe(before);expect(d.s).not.toHaveProperty('contentItemShapes');expect(d.s).not.toHaveProperty('loadHash')})
 it('기록 없는 생애에서 주머니를 실제로 채운 뒤에도 다시 불러올 실물을 확인한다',()=>{const d=setup(false);unknown(d);const food=makeItem(d.w,'Item.Jerky',2);addToBag(d.w,d.p,food);expect(perform(d.w,d.p,{type:'openBag',uid:d.belt.uid}).ok).toBe(true);expect(perform(d.w,d.p,{type:'lootPut',uid:food.uid}).ok).toBe(true);const before=serialize(d.s);expect(applyContentTransition(d.w)).toBeNull();expect(serialize(d.s)).toBe(before);expect(d.belt.contents![0]).toMatchObject({uid:food.uid,count:2,gx:0,gy:0});expect(d.s).not.toHaveProperty('loadHash')})
 it('기록이 없더라도 현재 실제 격자 밖/겹치는 물품은 재배치하지 않고 차단한다',()=>{for(const kind of['outside','overlap']as const){const d=setup();unknown(d);if(kind==='outside')d.belt.contents![0].gx=2;else{const extra=makeItem(d.w,'Item.Jerky');extra.gx=0;extra.gy=0;d.belt.contents!.push(extra)}const before=serialize(d.s);expect(missingItemPlan(d.s,d.w.db).errors.join('\n')).toContain('내부 격자');expect(serialize(d.s)).toBe(before)}})
 it('기록된 실제 용량은 비어 있어도 현재 다른 크기로 조용히 바꾸지 않는다',()=>{const d=setup(false);d.s.contentItemShapes!['Item.LeatherBelt'].storage=[1,1];const before=serialize(d.s);expect(missingItemPlan(d.s,d.w.db).errors.join('\n')).toContain('내부 격자');expect(serialize(d.s)).toBe(before)})
})
