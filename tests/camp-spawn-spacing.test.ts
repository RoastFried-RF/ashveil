import {describe,it,expect} from 'vitest'
import {newGame,playerAct,SAVE_VERSION} from '../src/core/game'
import {sourceLivingCount} from '../src/core/population-sources'
import {serialize,deserialize} from '../src/core/save'
import type {World} from '../src/core/ctx'
import {db} from './helpers'
const positionKeys=(w:World)=>w.s.creatures.filter(c=>c.alive&&(c.mapId===undefined||c.mapId===w.s.map.id)).map(c=>c.pos.x+','+c.pos.y)
describe('새 잿빛 수도원 야영지의 실제 시작 칸',()=>{
 it.each(Array.from({length:8},(_,i)=>'distinct-camp-'+i))('기존 실제 태생 인원/명단은 보존하며 서로 다른 통과 가능한 칸에서 시작한다 (%s)',seed=>{
  const w:World={db,s:newGame(db,{seed,background:'Bg.Hunter'})},keys=positionKeys(w),camp=w.s.sources!.find(s=>s.id==='reaverCamp')!,members=w.s.creatures.filter(c=>c.faction==='reavers')
  expect(new Set(keys).size).toBe(keys.length);expect(members).toHaveLength(6);expect(camp.members).toEqual(members.map(c=>c.id));expect(sourceLivingCount(w,camp,w.s.creatures)).toBe(6)
  for(const c of w.s.creatures){const tile=w.s.map.tiles[c.pos.y*w.s.map.w+c.pos.x]!;expect(db.terrain(tile.t).passable,c.id+' '+tile.t).toBe(true)}
 })
 it('실제20번의 대기 동안 각자의 이동/수면 차례에도 살아 있는 인물이 겹치지 않는다',()=>{
  const w:World={db,s:newGame(db,{seed:'distinct-camp-movement',background:'Bg.Hunter'})},ids=w.s.creatures.map(c=>c.id),next=w.s.nextId
  for(let i=0;i<20;i++){expect(playerAct(w,{type:'wait'})).toBeNull();const keys=positionKeys(w);expect(new Set(keys).size,'actual wait '+i).toBe(keys.length)}
  expect(w.s.creatures.map(c=>c.id)).toEqual(ids);expect(w.s.nextId).toBe(next)
 })
 it('151각인의 이미 살아온 인물 위치/물품/몸/난수를 임의로 옮기지 않는다',()=>{
  const w:World={db,s:newGame(db,{seed:'legacy-overlapping-camp'})},members=w.s.creatures.filter(c=>c.def==='Creature.Reaver'),last=members.at(-1)!,other=members[1]!;last.pos={...other.pos};const raw=JSON.parse(serialize(w.s));raw.version=151;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:151}).toEqual(raw)
 })
})
