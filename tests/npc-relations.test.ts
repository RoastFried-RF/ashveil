import {actualNpcName} from '../src/core/npc-identity'
import {describe,it,expect} from 'vitest'
import {npcRelationsFixture} from './npc-relations-fixture'
import {hearNpcRelationships,heardNpcRelationships} from '../src/core/npc-relations'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {invalidateLights} from '../src/core/fov'
import {capacity} from '../src/core/body'
import {makeItem} from '../src/core/items'
import {turnOf,type World} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
describe('주민에게 직접 들은 이웃 관계',()=>{
 it('NPC끼리 실제 나눈 대화는 듣기 전 플레이어 보고서가 아니다',()=>{const d=npcRelationsFixture(),before=stateHash(d.s);expect(d.a.npcTies![d.b.id].name).toBe(actualNpcName(d.b));expect(heardNpcRelationships(d.w,d.a.id)).toBeUndefined();expect(d.s.knowledge.npcRelations).toBeUndefined();expect(stateHash(d.s)).toBe(before)})
 it('실제 곁에서 이야기1턴을 쓴 뒤 원래 과거 이름/시각/관계말만 전해 듣는다',()=>{const d=npcRelationsFixture(),at=d.s.time;d.act({type:'talk',target:d.a.id});const r=heardNpcRelationships(d.w,d.a.id)!;expect(d.s.time-at).toBe(100);expect(r).toMatchObject({source:d.a.id,fromName:d.a.name,at:at/100,people:[{person:d.b.id,name:actualNpcName(d.b),observedAt:d.proof.originalDirectNpcContactAt,attitude:'familiar',lastKind:'talk'}]});expect(r.people[0]).not.toHaveProperty('score');expect(r.people[0]).not.toHaveProperty('pos');expect(r.people[0]).not.toHaveProperty('alive');expect(d.b.met).not.toBe(true)})
 it('보지 못한 실제 대화도 원래 당사자가 말해준 과거 정보로만 받는다',()=>{const d=npcRelationsFixture('listen',true);expect(d.proof.actualPreparationWalkTurns).toBeGreaterThan(1);d.act({type:'talk',target:d.a.id});expect(heardNpcRelationships(d.w,d.a.id)!.people[0]).toMatchObject({person:d.b.id,name:d.a.npcTies![d.b.id].name,observedAt:d.proof.originalDirectNpcContactAt});expect(heardNpcRelationships(d.w,d.a.id)!.at).toBeGreaterThan(d.proof.originalDirectNpcContactAt)})
 it('조회는 사본이고 보이지 않은 당사자/개인 점수 변화가 기존 보고서를 바꾸지 않는다',()=>{const d=npcRelationsFixture('stale'),before=stateHash(d.s),r=heardNpcRelationships(d.w,d.a.id)!;expect(r.people[0].name).not.toBe(d.b.name);expect(r.people[0].attitude).toBe('familiar');r.people[0].name='외부 변경';r.people[0].attitude='strained';expect(heardNpcRelationships(d.w,d.a.id)!.people[0].name).not.toBe('외부 변경');expect(stateHash(d.s)).toBe(before)})
 it('다시 실제로 묻기 전까지는 옛 사본이고 원격 현재 이름은 새 답변에도 섞지 않는다',()=>{const d=npcRelationsFixture('stale'),old=heardNpcRelationships(d.w,d.a.id)!;d.act({type:'talk',target:d.a.id});const r=heardNpcRelationships(d.w,d.a.id)!;expect(r.at).toBeGreaterThan(old.at);expect(r.people[0].attitude).toBe('friendly');expect(r.people[0].name).toBe(old.people[0].name);expect(r.people[0].name).not.toBe(d.b.name)})
 it('실제 성향 충돌은 수치 대신 말투가 부딪친 마지막 대화로 전한다',()=>{const d=npcRelationsFixture('heard',false,true);expect(d.report!.people[0]).toMatchObject({lastKind:'clash',attitude:'familiar'});expect(d.report!.people[0]).not.toHaveProperty('score')})
 it.each(['copyPlayer','copySource','npcListener','far','map','sleep','deaf','sourceActivity','captive','hostile','dark','future']as const)('실제 전달 조건이 없으면 과거 사본/지식/전체 상태를 보존한다 (%s)',mode=>{
  const d=npcRelationsFixture();let a=d.p,s=d.a;if(mode==='copyPlayer')a=structuredClone(a);if(mode==='copySource')s=structuredClone(s);if(mode==='npcListener')a=d.b;if(mode==='far')a.pos={x:1,y:1};if(mode==='map')s.mapId='crypt1';if(mode==='sleep')s.asleep=true;if(mode==='deaf'){a.body.missing.push('LeftEar','RightEar');expect(capacity(d.w,a,'hearing')).toBeLessThan(.2)}if(mode==='sourceActivity')s.activity={kind:'rest',remaining:2,label:'휴식'};if(mode==='captive')s.captivity={captor:a.id,faction:a.faction,at:turnOf(d.w),rope:makeItem(d.w,'Item.Rope')};if(mode==='hostile')s.attackedBy=[a.id];if(mode==='future')s.npcTies![d.b.id].lastAt=turnOf(d.w)+1
  if(mode==='dark'){d.s.map.ambient=0;d.s.map.daylightMult=0;d.s.map.lights=[];for(const c of d.s.creatures)for(const i of Object.values(c.equip))if(i)i.lit=false;invalidateLights(d.w)}
  const before=stateHash(d.s);hearNpcRelationships(d.w,a,s);expect(d.s.knowledge.npcRelations).toBeUndefined();expect(stateHash(d.s)).toBe(before)
 })
 it('154각인은 과거 주민 대화를 플레이어 소식으로 소급하지 않는다',()=>{const d=npcRelationsFixture(),s=structuredClone(d.s);s.version=154;expect(deserialize(JSON.stringify(s))).toEqual({...s,version:SAVE_VERSION});expect(deserialize(JSON.stringify(s)).knowledge.npcRelations).toBeUndefined()})
 it('미완료20턴과 사적인 원래 관계를 이어도 실제 묻기 전 새 보고서를 만들지 않는다',()=>{const d=npcRelationsFixture('pending');expect(d.s.simulationPending).toBe(true);const w:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.s.knowledge.npcRelations).toBeUndefined()})
 it.each([['/positiveAt',-1],['/negativeAt',0],['/maxPeople',0],['/sourceRules','NpcSocial.Missing']])('잘못된 전달 규칙을 시작 전에 거절한다 (%s)',(path,value)=>{const{report}=loadMods([...readPackages(),{manifest:{id:'bad-neighbor-report',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'NpcSocialReport.Hearth',path,value}]}],['bad-neighbor-report']);expect(report.errors.some(e=>e.includes('NpcSocialReport.Hearth'))).toBe(true)})
 it('새로 말할 기억이 없거나 바빠도 플레이어가 이미 들은 기록을 지우지 않는다',()=>{const d=npcRelationsFixture('heard'),old=heardNpcRelationships(d.w,d.a.id)!;d.a.npcTies={};d.a.activity={kind:'rest',remaining:5,label:'휴식'};const before=stateHash(d.s);hearNpcRelationships(d.w,d.p,d.a);expect(heardNpcRelationships(d.w,d.a.id)).toEqual(old);expect(stateHash(d.s)).toBe(before);d.a.activity=undefined;hearNpcRelationships(d.w,d.p,d.a);expect(heardNpcRelationships(d.w,d.a.id)).toEqual(old)})

})
