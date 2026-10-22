import {describe,it,expect} from 'vitest'
import {perform} from '../src/core/actions'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {createCreature,playerAct,makeItem,tileAt,serialize,updatePlayerVision,invalidateLights} from '../src/core'
function setup(){
 const d=clinicalDiseaseFixture('explicit-corpse-search',false),{w,s,p}=d;s.storyteller.budget=-1e9;s.map.ambient=1
 const first=createCreature(w,'Creature.BurrowRat',{x:20,y:19}),selected=createCreature(w,'Creature.BurrowRat',{x:21,y:20})
 for(const c of [first,selected]){c.alive=false;c.searched=true;c.bag=[makeItem(w,'Item.Wood',2)];s.creatures.push(c)}
 invalidateLights(w);updatePlayerVision(w,p)
 return {...d,first,selected}
}
describe('명시한 시체 수색 입력',()=>{
 it('방향 우선순위와 다른 클릭 대상의 원래 물품을 시간 없이 연다',()=>{const{w,s,first,selected}=setup(),at=s.time,bag=serialize({...s,loot:undefined});expect(playerAct(w,{type:'search',target:selected.id,includeEmpty:true})).toBeNull();expect(s.loot).toMatchObject({kind:'corpse',id:selected.id,pos:selected.pos});expect(s.time).toBe(at);expect(serialize({...s,loot:undefined})).toBe(bag);expect(first.bag[0].count).toBe(2);expect(selected.bag[0].count).toBe(2)})
 it('지정하지 않은 기존 수색 우선순위도 보존한다',()=>{const{w,s,first}=setup();expect(playerAct(w,{type:'search',includeEmpty:true})).toBeNull();expect(s.loot?.id).toBe(first.id)})
 it('처음 수색하는 지정 시체만 실제 두 턴 뒤 열고 다른 시체는 보존한다',()=>{const{w,s,first,selected}=setup();selected.searched=false;const at=s.time;expect(playerAct(w,{type:'search',target:selected.id,includeEmpty:true})).toBeNull();expect(selected.searched).toBe(true);expect(s.loot?.id).toBe(selected.id);expect(s.time-at).toBe(200);expect(first.searched).toBe(true)})
 for(const mode of ['absent','alive','far','blocked','mixed']as const)it(`${mode}: 잘못된 대상에서 이웃 시체로 바꾸거나 상태를 수정하지 않는다`,()=>{
  const{w,s,p,selected}=setup();let target=selected.id
  if(mode==='absent')target=999999
  if(mode==='alive')selected.alive=true
  if(mode==='far')selected.pos={x:25,y:20}
  if(mode==='blocked'){selected.pos={x:21,y:21};tileAt(w,{x:21,y:20}).t='Terrain.KtWall';tileAt(w,{x:20,y:21}).t='Terrain.KtWall';invalidateLights(w);updatePlayerVision(w,p)}
  const before=serialize(s);expect(perform(w,p,{type:'search',target,...(mode==='mixed'?{pos:{x:20,y:19}}:{})})).toEqual({ok:false,tu:0,msg:'보이는 시체 곁에서 수색해야 한다'});expect(serialize(s)).toBe(before)
 })
})
