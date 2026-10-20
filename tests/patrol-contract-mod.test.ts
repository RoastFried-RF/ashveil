import {describe,it,expect} from 'vitest'
import {patrolContractModFixture} from './patrol-contract-mod-fixture'
import {db} from './helpers'
import {loadDb} from '../tools/loadContent'
import {patrolContractDef} from '../src/core/patrol-contracts'
import {serialize,deserialize} from '../src/core/save'
import {TURNS_PER_DAY} from '../src/core/ctx'
import type {PatrolContractDef} from '../src/core/types'
describe('선택한 실제 순찰 장부 모드',()=>{
 it('선택한 보수/기한/경로 이름만 바꾸고 기본Def/물품/인원을 덮어쓰지 않는다',()=>{
  const d=patrolContractModFixture();expect(patrolContractDef(d.w)).toMatchObject({baseReward:30,deadlineDays:2});expect(d.offer.reward).toBe(30);expect(d.offer.label).toBe('양치기 골 여유로운 시장길 순찰');expect(d.offer.points.map(p=>p.pos)).toEqual([{x:30,y:20},{x:35,y:20},{x:32,y:18}]);expect(db.get<PatrolContractDef>('PatrolContract.Hearth').baseReward).toBe(20);expect(d.w.db.all('Item')).toHaveLength(db.all('Item').length);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActors)
 })
 it('같은 원래 시장의 실제 순찰/보고는30만 이전하고 선택 모드와 전체 증거를 복원한다',()=>{
  const d=patrolContractModFixture('completed'),r=d.record!;expect(r.deadline-r.accepted).toBe(2*TURNS_PER_DAY);expect(r.visits).toHaveLength(3);expect(r.status).toBe('completed');expect(r.escrow).toBe(0);expect(d.p.money).toBe(30);expect(d.market.money).toBe(970);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActors);const copy=deserialize(serialize(d.s));expect(copy).toEqual(d.s);expect(copy.mods).toEqual(['core','sample-patrol-contract']);expect(loadDb(copy.mods.filter(id=>id!=='core')).db.get<PatrolContractDef>('PatrolContract.Hearth').baseReward).toBe(30)
 })
})
