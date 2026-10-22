import { describe, expect, it } from 'vitest'
import { loadDb } from '../tools/loadContent'
import { livingArtFrames, livingTreeArt } from '../src/client/render/living-art'

const {db}=loadDb()
describe('생목 원화와 명시 모드 시각 설정',()=>{
 it('실제 두 기본 종에서 네 원본을 선택하고 종별 목록을 섞지 않는다',()=>{
  const pine=new Set(Array.from({length:32},(_,h)=>livingTreeArt(db.terrain('Terrain.PineTree'),h)!.sprite))
  const black=new Set(Array.from({length:32},(_,h)=>livingTreeArt(db.terrain('Terrain.BlackwoodTree'),h)!.sprite))
  expect(pine.size).toBe(2);expect(black.size).toBe(2);expect(new Set([...pine,...black])).toEqual(new Set(livingArtFrames))
  for(const sprite of pine)expect(black.has(sprite)).toBe(false)
 })
 it('기본 고사목이나 모드의 별도 종을 생목 기본값으로 재해석하지 않는다',()=>{
  expect(livingTreeArt(db.terrain('Terrain.Tree'),0)).toBeUndefined()
  expect(livingTreeArt({...db.terrain('Terrain.PineTree'),id:'Terrain.ModPine'},0)).toBeUndefined()
 })
 it('기존 종의 sprite·크기·색을 바꾼 모드는 각각 원래 설정을 사용한다',()=>{
  const terrain=db.terrain('Terrain.PineTree')
  for(const change of [{sprite:'mod.pine'},{scale:.9},{tint:0xffffff}])expect(livingTreeArt({...terrain,visual:{...terrain.visual!,...change}},4)).toBeUndefined()
 })
 it('읽기 전용 Def로부터 같은 시각 선택을 반복하며 정의를 바꾸지 않는다',()=>{
  const terrain=structuredClone(db.terrain('Terrain.BlackwoodTree')),before=structuredClone(terrain)
  Object.freeze(terrain.visual);Object.freeze(terrain)
  const first=livingTreeArt(terrain,9001)!
  expect(livingTreeArt(terrain,9001)).toEqual(first);expect(terrain).toEqual(before)
  expect(first.worldHeight).toBeLessThanOrEqual(64);expect(first.anchor.every(a=>a>=0&&a<=1)).toBe(true)
 })
})
