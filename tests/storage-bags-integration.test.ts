import {describe,expect,it} from 'vitest'
import {perform} from '../src/core/actions'
import {loadMods} from '../src/core/defs'
import {exchange,tradePrice,tradeQuote} from '../src/core/economy'
import {addToBag,makeItem} from '../src/core/items'
import {applyMissingItems,missingItemPlan,stateItemEntries} from '../src/core/missing-items'
import {serialize} from '../src/core/save'
import type {ItemDef} from '../src/core/types'
import {readPackages} from '../tools/loadContent'
import {firstImpressionsFixture} from './first-impressions-fixture'
import {prisonerFixture} from './prisoner-fixture'

function filled(){const d=prisonerFixture();d.p.bag=[];const sack=makeItem(d.w,'Item.Sack'),food=makeItem(d.w,'Item.Jerky',2);addToBag(d.w,d.p,sack);addToBag(d.w,d.p,food);perform(d.w,d.p,{type:'openBag',uid:sack.uid});perform(d.w,d.p,{type:'lootPut',uid:food.uid});return{...d,sack,food:sack.contents![0]}}

describe('자루의 실제 거래와 없어진 물품 복구',()=>{
 it('내용물의 실제 개수/상태 가격을 합산하며 견적은 원본을 바꾸지 않는다',()=>{const d=firstImpressionsFixture(),sack=makeItem(d.w,'Item.Sack'),food=makeItem(d.w,'Item.Jerky',3);food.freshness=47;sack.contents=[food];const empty={...sack,contents:[]},before=serialize(d.s);for(const buy of[true,false])expect(tradePrice(d.w,d.p,d.trader,sack,buy)).toBe(tradePrice(d.w,d.p,d.trader,empty,buy)+3*tradePrice(d.w,d.p,d.trader,food,buy));expect(serialize(d.s)).toBe(before)})
 it('원래 상점에 내용물째 팔고 다시 사도 내부 UID/배치/물량과 총현금을 보존한다',()=>{const d=firstImpressionsFixture();d.p.bag=[];const sack=makeItem(d.w,'Item.Sack'),food=makeItem(d.w,'Item.Jerky',2);food.gx=3;food.gy=2;food.freshness=61;food.contaminantAsh=.3;sack.contents=[food];addToBag(d.w,d.p,sack);const original=structuredClone(sack.contents),cash=d.p.money!+d.market.money,next=d.s.nextId;expect(exchange(d.w,d.p,d.trader,[],[{uid:sack.uid,count:1}])).toBeNull();expect(d.p.bag).toEqual([]);expect(d.market.items.find(i=>i.uid===sack.uid)!.contents).toEqual(original);expect(exchange(d.w,d.p,d.trader,[{uid:sack.uid,count:1}],[])).toBeNull();expect(d.p.bag.find(i=>i.uid===sack.uid)!.contents).toEqual(original);expect(d.market.items.some(i=>i.uid===sack.uid)).toBe(false);expect(d.p.money!+d.market.money).toBe(cash);expect(d.s.nextId).toBe(next)})
 it('내부 보관물을 자루에 숨겨 거래할 수 없고 거절은 원본 그대로다',()=>{const d=firstImpressionsFixture(),sack=makeItem(d.w,'Item.Sack'),food=makeItem(d.w,'Item.Jerky');food.def='Item.MissingPlaceholder';food.missingItem={def:'gone',size:[1,1],maxStack:1,label:'원본',original:{...food,def:'gone'}};sack.contents=[food];addToBag(d.w,d.p,sack);const before=serialize(d.s);expect(tradeQuote(d.w,d.p,d.trader,[],[{uid:sack.uid,count:1}]).error).toContain('보관물');expect(exchange(d.w,d.p,d.trader,[],[{uid:sack.uid,count:1}])).toContain('보관물');expect(serialize(d.s)).toBe(before)})
 it('자루가 사라졌다 돌아와도 실제 내부 참조와 변경 상태를 복원한다',()=>{const d=filled(),packages=readPackages();for(const p of packages)p.defs=p.defs.filter(x=>!['Item.Sack','Recipe.Sack'].includes(x.id));const removed=loadMods(packages,[]);expect(removed.report.errors).toEqual([]);const uid=d.food.uid;expect(applyMissingItems(d.s,removed.db)).toBeNull();expect(d.sack.def).toBe('Item.MissingPlaceholder');expect(d.sack.contents![0].uid).toBe(uid);d.sack.contents![0].freshness=23;expect(applyMissingItems(d.s,d.w.db)).toBeNull();expect(d.sack.def).toBe('Item.Sack');expect(d.sack.contents![0]).toMatchObject({uid,freshness:23});expect(stateItemEntries(d.s).filter(e=>e.item.uid===uid)).toHaveLength(1)})
 it('가방의 격자 축소나 제거는 기록된 내부 물품을 재배치하지 않고 차단한다',()=>{const d=filled();for(const storage of[[2,2],undefined]){const packages=readPackages();for(const p of packages)for(const x of p.defs)if(x.id==='Item.Sack'&&x.defType==='Item'){const item=x as ItemDef;if(storage)item.storage=storage as[number,number];else delete item.storage;}const changed=loadMods(packages,[]);expect(changed.report.errors).toEqual([]);const before=serialize(d.s);expect(missingItemPlan(d.s,changed.db).errors.join('\n')).toContain('내부 격자');expect(applyMissingItems(d.s,changed.db)).toContain('내부 격자');expect(serialize(d.s)).toBe(before)}})
 it('켠 광원을 자루에 넣어 연료/광원 상태를 숨길 수 없다',()=>{const d=filled(),torch=makeItem(d.w,'Item.Torch');torch.lit=true;addToBag(d.w,d.p,torch);const before=serialize(d.s);expect(perform(d.w,d.p,{type:'lootPut',uid:torch.uid}).ok).toBe(false);expect(serialize(d.s)).toBe(before)})
})
