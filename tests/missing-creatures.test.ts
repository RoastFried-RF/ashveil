import {describe,it,expect} from 'vitest'
import {missingCreaturesFixture,missingCreatureId} from './missing-creatures-fixture'
import {missingCreaturePlan,applyMissingCreatures} from '../src/core/missing-creatures'
import {contentChangeReview} from '../src/core/content-compatibility'
import {serialize,deserialize} from '../src/core/save'
import {sourceContains,sourceDefinitionsAvailable,sourceLivingCount} from '../src/core/population-sources'
import {settleReentry,playerAct,runUntilInput} from '../src/core/game'
import {generateDungeon} from '../src/core/mapgen'
import {addWound} from '../src/core/body'
import type {PopSource} from '../src/core/types'

describe('모드에서 사라진 층 생물의 승인된 제거',()=>{
 it('검토는 원본을 보존하고 승인 제거는 사망/전리품/경험치/난수 없이 개체와 한 로그만 바꾼다',()=>{
  const{w,creature,current}=missingCreaturesFixture(),before=serialize(w.s),review=contentChangeReview(w.s,current);expect(review.canContinue).toBe(true);expect(review.removedCreatures).toEqual({actors:1,residents:0,targets:0});expect(serialize(w.s)).toBe(before)
  const copy={db:current,s:deserialize(before)};expect(applyMissingCreatures(copy)).toBeNull();const actual=JSON.parse(serialize(copy.s)),expected=JSON.parse(before);expected.creatures=expected.creatures.filter((c:{id:number})=>c.id!==creature.id);const entry=actual.log.pop();expect(entry.kind).toBe('info')
  expect(entry.text).toContain('생물을 층에서 제거');expect(actual).toEqual(expected);expect(entry.turn).toBe(Math.floor(expected.time/100))
 })
 it('현재/정지된 층의 원래 기록만 제거하고 방 배치와 원래 대상 AI를 정리한다',()=>{
  const{w,creature,current}=missingCreaturesFixture();w.s.creatures.splice(w.s.creatures.indexOf(creature),1);w.s.offCreatures.crypt1=[creature];w.s.map.rooms[0].residents=[missingCreatureId,'Creature.BurrowRat'];const watcher=w.s.creatures[1];watcher.ai.target=creature.id;watcher.ai.mode='hunt';watcher.ai.path=[{...creature.pos}];const plan=missingCreaturePlan(w.s,current);expect(plan.errors).toEqual([]);expect(plan.counts).toEqual({actors:1,residents:1,targets:1});expect(applyMissingCreatures({s:w.s,db:current})).toBeNull();expect(w.s.offCreatures.crypt1).toEqual([]);expect(w.s.map.rooms[0].residents).toEqual(['Creature.BurrowRat']);expect(watcher.ai.target).toBeUndefined();expect(watcher.ai.path).toBeUndefined();expect(watcher.ai.mode).toBe('idle')
 })
 it('공급원 원래 인원/명단/재생 시계를 그대로 두고 없는 종의 정산/재점거를 멈춘다',()=>{
  const{w,creature,current}=missingCreaturesFixture(),source:PopSource={id:'removed-source',label:'원래 공급원',species:missingCreatureId,count:1,cap:9,regenDays:1,floors:['surface'],lastRegenDay:0,deployed:true,members:[creature.id]},original=structuredClone(source);w.s.sources!.push(source);expect(applyMissingCreatures({s:w.s,db:current})).toBeNull();const loaded={s:w.s,db:current};expect(sourceDefinitionsAvailable(loaded,source)).toBe(false);expect(sourceLivingCount(loaded,source,w.s.creatures)).toBe(1);expect(sourceContains(loaded,source,w.s.creatures[0])).toBe(false);expect(playerAct(loaded,{type:'wait'})).toBeNull();runUntilInput(loaded);expect(source).toEqual(original);expect(w.s.creatures.some(c=>c.def===missingCreatureId)).toBe(false)
 })
 it('없는 종은 정지 층의 하루 경계를 지나도 복제/재생/차감하지 않는다',()=>{
  const{w,current}=missingCreaturesFixture(),source:PopSource={id:'removed-source',label:'원래 공급원',species:missingCreatureId,count:7,cap:9,regenDays:1,floors:['crypt1'],lastRegenDay:0};w.s.sources!.push(source);const generated=generateDungeon(w,1),map=generated.map,residents:typeof w.s.creatures=[];w.s.maps[map.id]=map;const before=structuredClone(source);expect(applyMissingCreatures({s:w.s,db:current})).toBeNull();settleReentry({s:w.s,db:current},map,residents,Math.floor(w.s.time/100)-28800);expect(source).toEqual(before);expect(residents.some(c=>c.def===missingCreatureId)).toBe(false)
 })
 it('플레이어 정의/동료/구금 관계의 제거를 원자적으로 거절한다',()=>{
  const f=missingCreaturesFixture();f.w.s.playerId=f.creature.id;const before=serialize(f.w.s);expect(applyMissingCreatures({s:f.w.s,db:f.current})).toContain('플레이어');expect(serialize(f.w.s)).toBe(before)
  const g=missingCreaturesFixture();g.creature.companion={employer:g.p.id,originMap:g.w.s.map.id,status:'employed',order:'follow',hiredAt:21600,paidUntil:22000,lastLeader:{...g.p.pos},anchor:{...g.p.pos}};expect(missingCreaturePlan(g.w.s,g.current).errors.join()).toContain('동료')
 })
 it('진행 중인 다른 인물의 실제 활동 참조/임의 스크립트 ID는 승인으로 우회하지 못한다',()=>{
  const{w,creature,current}=missingCreaturesFixture();w.s.creatures[1].activity={kind:'waterRescue',remaining:100,label:'대상 작업',waterRescue:{target:creature.id,from:{...creature.pos},to:{...creature.pos},provider:{...w.s.creatures[1].pos}}};const before=serialize(w.s);expect(applyMissingCreatures({s:w.s,db:current})).toContain('진행 중 관계');expect(serialize(w.s)).toBe(before);delete w.s.creatures[1].activity;w.s.scriptState={hashes:{},mods:{test:{target:creature.id}},disabled:[],errors:[]};expect(missingCreaturePlan(w.s,current).errors.join()).toContain('스크립트')
 })
 it('동일 해시/원래 구성 미기록/종류 변경은 복구 근거로 쓰지 않는다',()=>{
  const{w,current}=missingCreaturesFixture();delete w.s.loadHash;expect(missingCreaturePlan(w.s,current).errors.join()).toContain('서로 다른');w.s.loadHash=current.loadHash;expect(missingCreaturePlan(w.s,current).errors.join()).toContain('서로 다른');w.s.contentDefinitions![missingCreatureId]='Item';expect(missingCreaturePlan(w.s,current).removed).toEqual([])
 })
 it('지원하지 않는 현재 종별 공포 참조는 원래 정의를 복원하도록 차단한다',()=>{
  const{w,current}=missingCreaturesFixture();w.s.creatures[1].fearlessAgainst=[missingCreatureId];const before=serialize(w.s);expect(missingCreaturePlan(w.s,current).errors.join()).toContain('현재 참조');expect(applyMissingCreatures({s:w.s,db:current})).toContain('현재 참조');expect(serialize(w.s)).toBe(before)
 })
 it('개인/상처의 과거 원인은 원래 문자열로 남기고 제거를 사망 사건으로 꾸미지 않는다',()=>{
  const{w,p,current}=missingCreaturesFixture();p.lastAttacker=missingCreatureId;const part=w.db.body(p.body.def).parts.find(part=>!part.internal)!.id;addWound(w,p,{def:'Wound.Cut',part,severity:1,source:missingCreatureId});const wound=structuredClone(p.body.wounds),history=structuredClone(p.history),beforeLog=w.s.log.length
  expect(applyMissingCreatures({s:w.s,db:current})).toBeNull();expect(p.lastAttacker).toBe(missingCreatureId);expect(p.body.wounds).toEqual(wound);expect(p.history).toEqual(history);expect(w.s.log.length).toBe(beforeLog+1)
 })
 it('임의 스크립트의 개체 숫자 키/정의 키는 의미를 추정해 지우지 않는다',()=>{
  const{w,creature,current}=missingCreaturesFixture();w.s.scriptState={hashes:{},mods:{test:{[String(creature.id)]:{value:true},[missingCreatureId]:{value:true}}},disabled:[],errors:[]};const raw=serialize(w.s);expect(applyMissingCreatures({s:w.s,db:current})).toContain('개체 키');expect(serialize(w.s)).toBe(raw)
 })
})
