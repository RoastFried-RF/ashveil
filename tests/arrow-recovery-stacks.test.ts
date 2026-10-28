import {describe,expect,it} from 'vitest'
import {recoverArrow} from '../src/core/abilities'
import {tileAt} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {makeItem} from '../src/core/items'
import {Rng} from '../src/core/rng'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {readPackages} from '../tools/loadContent'
import {prisonerFixture} from './prisoner-fixture'

function setup(count=20){
 const d=prisonerFixture();d.p.equip.main=makeItem(d.w,'Item.Bow');const stack=makeItem(d.w,'Item.Arrow',count),tile=tileAt(d.w,d.target.pos);tile.items=[stack];d.s.rng.combat=[0,0,0,0]
 return{...d,stack,tile}
}

describe('실제 회수 탄약의 더미 상한과 상태',()=>{
 it('20발 더미는21발로 넘치지 않고 같은 칸의 새1발로 회수한다',()=>{const d=setup(),next=d.s.nextId;recoverArrow(d.w,d.p,d.target,false);expect(d.tile.items).toHaveLength(2);expect(d.stack.count).toBe(20);expect(d.tile.items[1]).toEqual({uid:next,def:'Item.Arrow',count:1,gearAgedAt:Math.floor(d.s.time/100)});expect(d.s.nextId).toBe(next+1)})
 it('19발 정상 더미는 같은 UID로20발이 되며 새 UID를 쓰지 않는다',()=>{const d=setup(19),next=d.s.nextId,uid=d.stack.uid;recoverArrow(d.w,d.p,d.target,false);expect(d.tile.items).toEqual([{...d.stack,uid,count:20}]);expect(d.s.nextId).toBe(next)})
 it('처음 더미가 가득 차면 뒤의 실제 빈 자리가 있는 더미로 합친다',()=>{const d=setup(),other=makeItem(d.w,'Item.Arrow',7);d.tile.items.push(other);const next=d.s.nextId;recoverArrow(d.w,d.p,d.target,false);expect(d.tile.items.map(i=>i.count)).toEqual([20,8]);expect(d.s.nextId).toBe(next)})
 it('품질/오염/신선도가 다른 바닥 더미를 정상 화살로 덮어 합치지 않는다',()=>{for(const kind of['quality','dirty','freshness']as const){const d=setup(3);if(kind==='quality')d.stack.quality=2;else if(kind==='dirty')d.stack.dirty=true;else d.stack.freshness=50;const before=structuredClone(d.stack);recoverArrow(d.w,d.p,d.target,false);expect(d.stack).toEqual(before);expect(d.tile.items).toHaveLength(2);expect(d.tile.items[1].count).toBe(1)}})
 it('현재 실제 콘텐츠의 쌓임 상한을 따르고20을 하드코딩하지 않는다',()=>{const d=setup(3),loaded=loadMods([...readPackages(),{manifest:{id:'arrow-stack-limit',name:'탄약 상한 검사',version:'1',dependencies:['core']},defs:[],patches:[{op:'replace',target:'Item.Arrow',path:'/maxStack',value:3}]}],['arrow-stack-limit']);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;recoverArrow(d.w,d.p,d.target,false);expect(d.tile.items.map(i=>i.count)).toEqual([3,1])})
 it('회수 실패는 바닥·UID·시간을 바꾸지 않으며 원래 combat 판정 한 번만 쓴다',()=>{const d=setup();d.s.rng.combat=[0xffffffff,0xffffffff,0,0xffffffff];const before=structuredClone(d.s),expected=new Rng(structuredClone(d.s.rng.combat));expect(expected.int(0,99)).toBeGreaterThanOrEqual(85);before.rng.combat=expected.s;recoverArrow(d.w,d.p,d.target,false);expect(d.s).toEqual(before)})
 it('회수 성공도 바닥의 실제 새1발/UID와 원래 판정 외의 전체 상태는 그대로다',()=>{const d=setup(),before=structuredClone(d.s),next=d.s.nextId,expected=new Rng(structuredClone(d.s.rng.combat));expected.int(0,99);before.rng.combat=expected.s;before.nextId++;before.map.tiles[d.target.pos.y*before.map.w+d.target.pos.x].items.push({uid:next,def:'Item.Arrow',count:1,gearAgedAt:Math.floor(d.s.time/100)});recoverArrow(d.w,d.p,d.target,false);expect(d.s).toEqual(before)})
 it('전체 저장 복원 양쪽에서 회수한 원래 더미·추가1발·난수는 같다',()=>{const d=setup(),copy={db:d.w.db,s:deserialize(serialize(d.s))};recoverArrow(d.w,d.p,d.target,false);recoverArrow(copy,copy.s.creatures.find(c=>c.id===d.p.id)!,copy.s.creatures.find(c=>c.id===d.target.id)!,false);expect(stateHash(copy.s)).toBe(stateHash(d.s))})
})
