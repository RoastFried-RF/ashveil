import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { forestArtFrames, treeArt } from '../src/client/render/forest-art'
import { loadDb } from '../tools/loadContent'

describe('수목 원화의 좌표 기반 표현 계약',()=>{
 it('실제 로드된 기본 지형의 원본 키가 네 새 고사목을 사용한다',()=>{
  const sprites=loadDb().db.terrain('Terrain.Tree').sprites,choices=Array.from({length:1024},(_,hash)=>treeArt(sprites,hash))
  expect(choices.every(row=>row.sprite!=='tree')).toBe(true)
  expect(new Set(choices.map(row=>row.sprite))).toEqual(new Set(forestArtFrames))
  for(const row of choices.filter(row=>row.worldHeight!==undefined)){expect(row.flip).toBe(false);expect(row.worldHeight).toBeGreaterThan(0);expect(row.anchor.every(v=>Number.isFinite(v)&&v>=0&&v<=1)).toBe(true)}
 })
 it('명시 원본이 없는 구형 폴백의 생목1/4는 유지한다',()=>{for(const sprites of [[],['tree_dead']])expect(Array.from({length:1024},(_,hash)=>treeArt(sprites,hash)).filter(row=>row.sprite==='tree')).toHaveLength(256)})
 it('콘텐츠 모드의 명시 나무 목록과 원래 크기/반전은 새 원화로 덮지 않는다',()=>{
  const sprites=Object.freeze(['mod.tree.a','mod.tree.b'])
  const choices=Array.from({length:32},(_,hash)=>treeArt(sprites,hash))
  expect(new Set(choices.map(row=>row.sprite))).toEqual(new Set(sprites))
  expect(choices.every(row=>row.scale===.42&&row.worldHeight===undefined)).toBe(true)
  expect(choices.filter(row=>row.flip)).toHaveLength(16)
 })
 it('기존 atlas 키/크기는 보존하고 새 동적 표시 키를 실제 atlas에 연결한다',()=>{
  const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8'))
  expect(forestArtFrames).toHaveLength(4);expect(new Set(forestArtFrames).size).toBe(4)
  for(const key of forestArtFrames){const f=manifest.frames[key];expect(f).toBeDefined();expect(manifest.sheets[f[0]]).toBe('sprites/original/direction-v307/forest-trees.png')}
  expect(manifest.frames.tree.slice(3)).toEqual([80,96]);expect(manifest.frames.tree_dead.slice(3)).toEqual([80,96])
 })
})
