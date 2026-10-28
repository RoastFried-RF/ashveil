import {describe,it,expect} from 'vitest'
import {npcAbductionFixture} from './npc-abduction-fixture'
import {npcAbductionAction,planNpcAbduction,finishNpcAbduction,observeAbductionTarget,rememberAbductionBind} from '../src/core/npc-abduction'
import {aiDecide} from '../src/core/ai'
import {perform} from '../src/core/actions'
import {capacity} from '../src/core/body'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {cheb} from '../src/core/geom'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import type {World} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
describe('현지 NPC가 실제 본 같은 인물의 포획과 호송',()=>{
 it('실제 원래 경비의 고용을 공개 종료하고 원래 인물/밧줄/소지품만 준비한다',()=>{
  const d=npcAbductionFixture();expect(d.victim.id).toBe(85);expect(d.captor.id).toBe(46);expect(d.victim.companion!.status).toBe('dismissed');expect(d.victim.captivity).toBeUndefined();expect(d.captor.bag.some(i=>i.uid===d.proof.originalRopeUid)).toBe(true);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('계획 견적은 현재 보이는 저항 불능의 적만 고르며 조회는 불변이다',()=>{
  const d=npcAbductionFixture(),before=stateHash(d.s);expect(npcAbductionAction(d.w,d.captor,[])).toEqual({type:'npcAbductionPlan',target:d.victim.id});expect(stateHash(d.s)).toBe(before)
 })
 it('실제 NPC 계획1턴은 자기 거처/같은 대상/원래 밧줄과 마지막 목격 사본만 남긴다',()=>{
  const d=npcAbductionFixture('planned');expect(d.proof.actualWaitTurns).toBe(1);expect(d.captor.abduction).toMatchObject({target:85,ropeUid:d.proof.originalRopeUid,home:{x:18,y:20},lastSeen:{x:24,y:20},region:'Region.GreyCloister',mapId:'surface'});expect(d.victim.captivity).toBeUndefined();expect(d.captor.abduction!.home).not.toBe(d.captor.home);expect(d.captor.abduction!.lastSeen).not.toBe(d.victim.pos)
 })
 it.each(['copy','player','noRope','noHome','far','awakeEnemy','asleep','unconscious','hungry','thirsty','tired','wrongMap','ally']as const)('자기 현장/몸/식량/목격/실물 조건이 맞지 않으면 계획을 만들지 않는다 (%s)',mode=>{
  const d=npcAbductionFixture();if(mode==='noRope')d.captor.bag=[];if(mode==='noHome')d.captor.home=undefined;if(mode==='far')d.victim.pos={x:40,y:35};if(mode==='awakeEnemy')d.victim.ai.mode='guard';if(mode==='asleep')d.captor.asleep=true;if(mode==='unconscious')d.captor.unconscious=true;if(mode==='hungry')d.captor.needs.kcal=0;if(mode==='thirsty')d.captor.needs.waterDeficit=500;if(mode==='tired')d.captor.needs.fatigue=80;if(mode==='wrongMap')d.captor.mapId='other';if(mode==='ally')d.victim.faction=d.captor.faction;const actor=mode==='copy'?structuredClone(d.captor):mode==='player'?d.p:d.captor,before=stateHash(d.s);expect(planNpcAbduction(d.w,actor,d.victim.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('깨어 저항하는 실제 위협을 만나면 포획보다 기존 전투가 먼저다',()=>{
  const d=npcAbductionFixture('planned'),before=stateHash(d.s);expect(npcAbductionAction(d.w,d.captor,[{...d.victim,ai:{...d.victim.ai,mode:'guard'},unconscious:false,asleep:false}])).toBeNull();expect(stateHash(d.s)).toBe(before)
 })
 it('실제 경로 접근과2턴 포박은 같은 원래 밧줄/인물을 보존한다',()=>{
  const d=npcAbductionFixture('bound');expect(d.proof.actualWaitTurns).toBeGreaterThan(2);expect(d.captor.pos).not.toEqual({x:20,y:20});expect(d.victim.captivity).toMatchObject({captor:46,faction:'reavers',rope:{uid:d.proof.originalRopeUid,count:1}});expect(d.captor.bag.some(i=>i.uid===d.proof.originalRopeUid)).toBe(false);expect(d.captor.abduction!.boundRopeUid).toBe(d.proof.originalRopeUid);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('정해진 밧줄·대상과 실제 포박 완료만 연결하고 복사 배우/다른UID를 거부한다',()=>{
  const d=npcAbductionFixture('bound');delete d.captor.abduction!.boundRopeUid;const before=stateHash(d.s);rememberAbductionBind(d.w,structuredClone(d.captor),d.victim,d.proof.originalRopeUid,d.proof.originalRopeUid);rememberAbductionBind(d.w,d.captor,d.victim,d.proof.originalRopeUid+1,d.proof.originalRopeUid);expect(stateHash(d.s)).toBe(before)
 })
 it('실제2턴 호송 준비 뒤 원래 손/밧줄/발목과 피호송자 자신의 이동을 쓴다',()=>{
  const d=npcAbductionFixture('escorting');expect(d.victim.captivity!.escort).toBe(true);expect(d.captor.leading).toMatchObject({target:85,uid:d.proof.originalRopeUid,hand:'Left'});expect(capacity(d.w,d.victim,'moving')).toBeGreaterThan(0);const before={...d.victim.pos};for(let i=0;i<20&&cheb(before,d.victim.pos)===0;i++)d.act({type:'wait'});expect(d.victim.pos).not.toEqual(before)
 })
 it('같은 두 사람이 실제 거처 곁까지 걸은 뒤 발목을 다시 묶고 임무를 끝낸다',()=>{
  const d=npcAbductionFixture('home');expect(cheb(d.captor.pos,{x:18,y:20})).toBeLessThanOrEqual(1);expect(cheb(d.victim.pos,{x:18,y:20})).toBeLessThanOrEqual(1);expect(d.victim.pos).not.toEqual({x:24,y:20});expect(d.victim.captivity!.rope.uid).toBe(d.proof.originalRopeUid);expect(d.victim.captivity!.anklesFree).toBeFalsy();expect(d.captor.leading).toBeUndefined();expect(d.captor.abduction).toBeUndefined();expect(d.p.money).toBe(960);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('실신자는 발목을 풀어도 직접 걷지 못하므로 순간 이동시키지 않는다',()=>{
  const d=npcAbductionFixture('bound');d.victim.unconscious=true;d.captor.pos={x:23,y:19};const before=stateHash(d.s);expect(npcAbductionAction(d.w,d.captor,[])).toEqual({type:'wait'});expect(stateHash(d.s)).toBe(before)
 })
 it('보이지 않는 실제 이동은 기억 위치를 고치지 않고 마지막 목격으로 접근한다',()=>{
  const d=npcAbductionFixture('planned'),last=structuredClone(d.captor.abduction!.lastSeen);d.victim.pos={x:40,y:35};const before=stateHash(d.s),action=npcAbductionAction(d.w,d.captor,[]);expect(action?.type).toBe('move');expect(d.captor.abduction!.lastSeen).toEqual(last);expect(observeAbductionTarget(d.w,d.captor,d.victim.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('실제로 다시 본 새 위치는 관찰1턴 명령을 통해서만 기억한다',()=>{
  const d=npcAbductionFixture('planned');d.victim.pos={x:24,y:21};const before=stateHash(d.s);expect(npcAbductionAction(d.w,d.captor,[])).toEqual({type:'npcAbductionObserve',target:d.victim.id});expect(stateHash(d.s)).toBe(before);const result=perform(d.w,d.captor,{type:'npcAbductionObserve',target:d.victim.id});expect(result).toMatchObject({ok:true,tu:100});expect(d.captor.abduction!.lastSeen).toEqual(d.victim.pos);expect(d.captor.abduction!.lastSeen).not.toBe(d.victim.pos)
 })
 it('다른 지도나 눈앞의 다른 포박자가 잡은 사람은 임무를 끝낼 뿐 빼앗지 않는다',()=>{
  const d=npcAbductionFixture('planned');d.captor.abduction!.mapId='other';expect(npcAbductionAction(d.w,d.captor,[])).toEqual({type:'npcAbductionEnd'});const e=npcAbductionFixture('bound');e.victim.captivity!.captor=e.p.id;expect(npcAbductionAction(e.w,e.captor,[])).toEqual({type:'npcAbductionEnd'})
 })
 it('임무를 끝낼 때 같은 호송 연결만 놓고 실물 밧줄/포박은 남긴다',()=>{
  const d=npcAbductionFixture('escorting');expect(finishNpcAbduction(d.w,d.captor)).toBeNull();expect(d.captor.abduction).toBeUndefined();expect(d.captor.leading).toBeUndefined();expect(d.victim.captivity!.rope.uid).toBe(d.proof.originalRopeUid);expect(d.victim.captivity!.escort).toBeFalsy();expect(d.victim.captivity!.anklesFree).toBe(true)
 })
 it('고용된 사람에게 기존 포획 지휘를 임의로 시작시키지 않는다',()=>{
  const d=npcAbductionFixture();d.captor.companion={...d.victim.companion!,status:'employed',employer:d.p.id};const before=stateHash(d.s);expect(npcAbductionAction(d.w,d.captor,[])).toBeNull();expect(planNpcAbduction(d.w,d.captor,d.victim.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('진행 중40턴의 같은 두 사람/실제 포박/호송/몸/난수와 목격이 전체 복원 뒤 같다',()=>{
  const d=npcAbductionFixture('pending'),w:World={db:d.w.db,s:deserialize(serialize(d.s))};expect(d.s.simulationPending).toBe(true);runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.victim.captivity!.rope.uid).toBe(d.proof.originalRopeUid);expect(d.captor.abduction).toBeUndefined()
 })
 it('146각인에 과거 NPC 포획 임무를 소급하지 않는다',()=>{
  const d=npcAbductionFixture(),raw=JSON.parse(serialize(d.s));raw.version=146;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:146}).toEqual(raw)
 })
 it('NPC의 실제 판단에서 시작하되 플레이어의 명령 위조로 시작하지 못한다',()=>{
  const d=npcAbductionFixture();expect(aiDecide(d.w,d.captor)).toEqual({type:'npcAbductionPlan',target:85});const before=stateHash(d.s);expect(perform(d.w,d.p,{type:'npcAbductionPlan',target:85}).ok).toBe(false);expect(stateHash(d.s)).toBe(before)
 })
 it('플레이어 시야 밖의 포획 판단만으로 플레이어 구조 단서를 만들지 않는다',()=>{
  const d=npcAbductionFixture();d.p.pos={x:3,y:3};invalidateLights(d.w);updatePlayerVision(d.w,d.p);for(let i=0;i<10;i++)d.act({type:'wait'});expect(d.victim.captivity).toBeDefined();expect(d.s.knowledge.prisonerSightings).toBeUndefined()
 })
 it.each([['/approachRange',0],['/homeRadius',4],['/maxFatigue',101],['/roles',['merchant']]]as const)('잘못된 포획 Def를 거부한다 (%s)',(path,value)=>{
  const{report}=loadMods([...readPackages(),{manifest:{id:'bad-abduction',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'NpcAbduction.Hearth',path,value}]}],['bad-abduction']);expect(report.errors.some(e=>e.includes('NpcAbduction.Hearth'))).toBe(true)
 })
})
