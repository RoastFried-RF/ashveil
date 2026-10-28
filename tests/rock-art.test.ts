import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import layouts from '../src/client/render/rock-art.json'
import source from '../tools/art/direction-v397/rocks-source.json'
import registry from '../src/client/sprites.json'
import {rockArt} from '../src/client/render/rock-art'
import {rockFixture} from './rock-art-fixture'
import {playerAct} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {tileAt} from '../src/core/ctx'
describe('original boulders preserve their physical footprint and gatherable stone',()=>{
 it('ships the exact raw generated source, retaining the old saved/mod frame',()=>{
  expect(createHash('sha256').update(readFileSync(source.raw)).digest('hex')).toBe(source.sha256)
  expect(registry.frames.rock).toEqual(['dw_env',82,0,48,32]);expect(layouts).toHaveLength(6)
  for(const row of layouts)expect(row.scale*row.opaqueWidth).toBeCloseTo(21.6,10)
 })
 it('keeps explicit mod sprite requests and the legacy fallback addressable',()=>{
  expect(rockArt(['custom_stone'],4)).toEqual({sprite:'custom_stone',anchor:[.5,.9],scale:.45})
  expect(rockArt(undefined,0).sprite).toBe('rock')
 })
 it('does not alter World state while choosing display variants; collision and actual stone gathering retain their rules',()=>{
  const d=rockFixture(),before=serialize(d.s);for(let h=0;h<20;h++)rockArt(d.w.db.terrain('Terrain.Rock').sprites,h);expect(serialize(d.s)).toBe(before)
  expect(playerAct(d.w,{type:'move',dir:2})).toBeTruthy();expect(d.p.pos).toEqual({x:20,y:20});const at=d.s.time
  expect(playerAct(d.w,{type:'gather',pos:d.target})).toBeNull();expect(d.s.time-at).toBe(3000);expect(d.p.bag.filter(i=>i.def==='Item.Stone').reduce((n,i)=>n+i.count,0)).toBe(1)
  expect(tileAt(d.w,d.target).t).toBe('Terrain.Rock');expect(tileAt(d.w,d.target).gatherAt).toBeGreaterThan(d.s.time/100);expect(serialize(deserialize(serialize(d.s)))).toBe(serialize(d.s))
 })
})
