import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {loadDb} from '../tools/loadContent'
import {mapIconKeys,terrainArtFrames} from '../src/client/render/terrain-art'
import {forestArtFrames} from '../src/client/render/forest-art'
import {livingArtFrames} from '../src/client/render/living-art'
import type {ItemDef,AbilityDef,CreatureDef,TerrainDef} from '../src/core/types'

const {db,report}=loadDb()
const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8')) as {sheets:Record<string,string>;frames:Record<string,[string,number,number,number,number]>;ui:Record<string,string>;chars:Record<string,unknown>}
const before=JSON.parse(readFileSync('tools/art/complete-catalog-v302-before.json','utf8')) as {registry:typeof manifest}
const original=(key:string)=>{const frame=manifest.frames[key];return !!frame&&manifest.sheets[frame[0]].includes('/original/')}

describe('전수 조사한 기본 게임 원본 리소스 연결',()=>{
 it('모든 실제 물품과 능력은 원본 프레임을 사용하며 옛 파일로 폴백하지 않는다',()=>{
  expect(report.errors).toEqual([])
  const missing=[...db.all<ItemDef>('Item').map(d=>[d.id,d.sprite]),...db.all<AbilityDef>('Ability').map(d=>[d.id,d.icon])].filter(([,key])=>!original(key))
  expect(missing).toEqual([])
 })
 it('기본 생물의 선택·역할·정지 모습을 모두 실제 캐릭터 등록에서 찾는다',()=>{
  const missing=db.all<CreatureDef>('Creature').flatMap(d=>{
   const selected=d.char??d.sprite??d.id
   return [...(Array.isArray(selected)?selected:[selected]),...Object.values(d.characterAliases??{}),...(d.dormantChar?[d.dormantChar]:[])].filter(key=>!manifest.chars[key]).map(key=>[d.id,key])
  })
  expect(missing).toEqual([])
 })
 it('지형 선언·지상 바닥·생활 물체·기본 행동 그림도 전부 원본으로 해석한다',()=>{
  const keys=[...mapIconKeys,...terrainArtFrames,...forestArtFrames,...livingArtFrames,...db.all<TerrainDef>('Terrain').flatMap(d=>[...d.sprites,...(d.visual?[d.visual.sprite]:[])]),'shove','trip','disarm','crouch']
  expect([...new Set(keys)].filter(key=>!original(key))).toEqual([])
  expect(Object.values(manifest.sheets).filter(url=>!url.includes('/original/'))).toEqual([])
  expect(Object.values(manifest.ui).filter(url=>!url.includes('/original/'))).toEqual([])
 })
 it('기존813개 논리 프레임 이름은 유지하고 원화 교체의 크기 변경은 검토한 명세와 같다',()=>{
  expect(Object.keys(before.registry.frames)).toHaveLength(813)
  expect(Object.keys(before.registry.frames).filter(key=>!manifest.frames[key])).toEqual([])
  const changed=Object.entries(before.registry.frames).filter(([key,frame])=>JSON.stringify(manifest.frames[key].slice(3))!==JSON.stringify(frame.slice(3))).map(([key,frame])=>({key,before:frame.slice(3),after:manifest.frames[key].slice(3)}))
  const reviewed=JSON.parse(readFileSync('tools/art/legacy-frame-migrations-v388.json','utf8'));expect(changed).toEqual(reviewed.rows)
 })
})
