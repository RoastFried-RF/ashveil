import {beforeAll,describe,it,expect} from 'vitest'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {configureScriptHost} from '../src/core/script-hooks'
import {activityStep,perform} from '../src/core/actions'
import {newGame,stopActivity} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {equip,unequip,makeItem,addToBag} from '../src/core/items'
import {startCraft,startMaintenance} from '../src/core/crafting'
import {deserialize,serialize} from '../src/core/save'
import {finishBase} from './base-camp-fixture'
import type {ScriptHost} from '../src/core/script-contracts'
let host:ScriptHost
beforeAll(async()=>{host=await createQuickJSScriptHost()})
const id='item-lifecycle-test',record=(kind:string)=>'ctx.modState.events=[...(ctx.modState.events??[]),{kind:"'+kind+'",...e}];return []',methods=['onEquip','onUnequip','onCrafted','onRepair']as const
function setup(badEquip=false){
 const source='export default defineMod({workers:{Gear:{kind:"ItemCompWorker",'+methods.map(m=>m+'(ctx,e){'+(badEquip&&m==='onEquip'?'ctx.modState.bad=true;ctx.rng.int(0,10);return [{type:"spawnCreature"}]':record(m))+'}').join(',')+'}}})',l=loadMods([...readPackages(),{manifest:{id,name:'아이템 생애 검사',version:'1',dependencies:['core'],scripts:{stage:2,entry:'scripts/main.js',api:'^1.1.0'}},defs:[],patches:['Item.PaddedJacket','Item.LeatherCoat','Item.Bandage','Item.RustyKnife'].map(target=>({op:'add' as const,target,path:'/compWorker',value:id+':Gear'})),scripts:[{file:'scripts/main.js',source}]}],[id]);expect(l.report.errors).toEqual([]);expect(configureScriptHost(l.db,host)).toEqual([])
 const w:World={db:l.db,s:newGame(l.db,{seed:'actual-item-lifecycles',background:'Bg.Hunter'})},p=player(w);p.traits=[];p.abilities=[];p.bag=[];p.equip={};p.needs.fatigue=0;p.needs.kcal=3000;p.needs.waterDeficit=0;p.needs.bodyTemp=37;p.skills={};return{w,p,add:(def:string,count=1)=>{const it=makeItem(w,def,count);expect(addToBag(w,p,it)).toBe(0);return it}}
}
function events(w:World){return(w.s.scriptState!.mods[id]as {events:({kind:string;uid:number;item:string;slot?:string;before?:number;after?:number})[]}|undefined)?.events??[]}
const control=(w:World):World=>({db:loadMods(readPackages(),[]).db,s:structuredClone(w.s)})
describe('성공한 실제 아이템 착탈/제작/수리의 단계2 컴포넌트',()=>{
 it('onConsume 없이 생애 메서드만 등록하고 원래 장비 UID를 착탈 순서대로 전달한다',()=>{const d=setup(),it=d.add('Item.PaddedJacket'),b=control(d.w);expect(equip(d.w,d.p,it.uid)).toBeNull();expect(equip(b,player(b),it.uid)).toBeNull();expect(unequip(d.w,d.p,'chest')).toBeNull();expect(unequip(b,player(b),'chest')).toBeNull();expect(events(d.w).map(e=>[e.kind,e.uid,e.slot])).toEqual([['onEquip',it.uid,'chest'],['onUnequip',it.uid,'chest']]);expect(d.w.s.creatures).toEqual(b.s.creatures);expect(d.w.s.nextId).toBe(b.s.nextId)})
 it('실제 긴 착용은 시작/부분 진행에서 호출하지 않고 완료 후 한 번만 알린다',()=>{const d=setup(),it=d.add('Item.LeatherCoat');expect(perform(d.w,d.p,{type:'equip',uid:it.uid}).ok).toBe(true);expect(d.p.activity).toBeDefined();expect(events(d.w)).toEqual([]);activityStep(d.w,d.p);expect(events(d.w)).toEqual([]);finishBase(d.w,d.p);expect(d.p.equip.chest!.uid).toBe(it.uid);expect(it.half).toBeUndefined();expect(events(d.w)).toMatchObject([{kind:'onEquip',uid:it.uid}])})
 it('중단된 반착용은 완료 콜백을 만들지 않으며 재개해 실제 완성할 때 한 번만 알린다',()=>{const d=setup(),it=d.add('Item.LeatherCoat');perform(d.w,d.p,{type:'equip',uid:it.uid});activityStep(d.w,d.p);stopActivity(d.w,d.p);expect(events(d.w)).toEqual([]);expect(it.half).toBe(true);expect(perform(d.w,d.p,{type:'equip',uid:it.uid}).ok).toBe(true);finishBase(d.w,d.p);expect(events(d.w)).toMatchObject([{kind:'onEquip',uid:it.uid}])})
 it('실제 교체는 원래 옷을 벗어 바닥에 놓은 뒤 새 옷을 완성하는 각각 한 번만 기록한다',()=>{const d=setup(),old=d.add('Item.PaddedJacket'),next=d.add('Item.LeatherCoat');equip(d.w,d.p,old.uid);expect(perform(d.w,d.p,{type:'equip',uid:next.uid}).ok).toBe(true);finishBase(d.w,d.p);expect(events(d.w).map(e=>[e.kind,e.uid])).toEqual([['onEquip',old.uid],['onUnequip',old.uid],['onEquip',next.uid]]);expect(d.p.bag.some(i=>i.uid===old.uid)).toBe(true)})
 it('실제 탈의 후 바닥에 놓기도 같은 원래 UID의 한 번만 기록한다',()=>{const d=setup(),it=d.add('Item.PaddedJacket');equip(d.w,d.p,it.uid);expect(perform(d.w,d.p,{type:'unequip',slot:'chest',dropAfter:true}).ok).toBe(true);finishBase(d.w,d.p);expect(d.w.s.map.tiles.flatMap(t=>t.items).some(i=>i.uid===it.uid)).toBe(true);expect(events(d.w).map(e=>e.kind)).toEqual(['onEquip','onUnequip'])})
 it('부족 재료/부분 제작에서는 호출하지 않고 실제 원래 재료를 쓰고 완성품을 받을 때 호출한다',()=>{const d=setup();expect(startCraft(d.w,d.p,'Recipe.Bandage',1)).not.toBeNull();expect(events(d.w)).toEqual([]);const cloth=d.add('Item.Cloth',3);expect(startCraft(d.w,d.p,'Recipe.Bandage',1)).toBeNull();activityStep(d.w,d.p);expect(events(d.w)).toEqual([]);finishBase(d.w,d.p);expect(cloth.count).toBe(1);expect(events(d.w)).toMatchObject([{kind:'onCrafted',item:'Item.Bandage',recipe:'Recipe.Bandage'}]);expect(d.p.bag.some(i=>i.def==='Item.Bandage')).toBe(true)})
 it('실제 현장 수리로 같은 원래 칼의 내구가 개선된 뒤에만 이전/이후를 전달한다',()=>{const d=setup(),knife=d.add('Item.RustyKnife');knife.durability=10;d.add('Item.StoneHammer');expect(startMaintenance(d.w,d.p,'repair',knife.uid,1)).not.toBeNull();d.add('Item.IronScrap');expect(startMaintenance(d.w,d.p,'repair',knife.uid,1)).toBeNull();activityStep(d.w,d.p);expect(events(d.w)).toEqual([]);finishBase(d.w,d.p);expect(events(d.w)).toMatchObject([{kind:'onRepair',uid:knife.uid,before:10,after:knife.durability}]);expect(knife.durability).toBeGreaterThan(10)})
 it('실패한 콜백은 이미 완료한 원래 착용을 유지하고 자기 효과만 원자적으로 버린다',()=>{const d=setup(true),it=d.add('Item.PaddedJacket');expect(equip(d.w,d.p,it.uid)).toBeNull();expect(d.p.equip.chest!.uid).toBe(it.uid);expect(d.w.s.scriptState!.mods).toEqual({});expect(Object.keys(d.w.s.rng).some(k=>k.startsWith('mod.'))).toBe(false);expect(d.w.s.scriptState!.disabled).toEqual([id+':worker.Gear.onEquip']);expect(unequip(d.w,d.p,'chest')).toBeNull();expect(events(d.w)).toMatchObject([{kind:'onUnequip',uid:it.uid}])})
 it('실제 물품이 없는 실패와 인물 사본의 착용은 실제 콜백을 만들지 않는다',()=>{const d=setup(),it=d.add('Item.PaddedJacket'),copy=structuredClone(d.p);expect(equip(d.w,d.p,-1)).not.toBeNull();expect(equip(d.w,copy,it.uid)).toBeNull();expect(events(d.w)).toEqual([]);expect(d.p.equip.chest).toBeUndefined()})
 it('저장 복원한 다음 실제 탈의의 전체 상태/난수/원래 물품은 동일하다',()=>{const d=setup(),it=d.add('Item.PaddedJacket');equip(d.w,d.p,it.uid);d.w.s=deserialize(serialize(d.w.s));const b:World={db:d.w.db,s:deserialize(serialize(d.w.s))};expect(unequip(d.w,player(d.w),'chest')).toBeNull();expect(unequip(b,player(b),'chest')).toBeNull();expect(serialize(b.s)).toBe(serialize(d.w.s))})
})
