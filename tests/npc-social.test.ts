import {actualNpcName} from '../src/core/npc-identity'
import {describe,it,expect} from 'vitest'
import {npcSocialFixture} from './npc-social-fixture'
import {converseNpcs,npcConversationQuote,npcSocialAction,npcSocialDef} from '../src/core/npc-social'
import {perform} from '../src/core/actions'
import {stateHash,serialize,deserialize} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeItem} from '../src/core/items'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import type {World} from '../src/core/ctx'
const offDb=()=>loadMods([...readPackages(),{manifest:{id:'no-social-control',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'NpcSocial.Hearth',path:'/enabled',value:false}]}],['no-social-control']).db
describe('실제로 곁에서 나눈 NPC 대화와 사적인 관계',()=>{
 it('후보/견적은 개인 관계/기분/난수/시간/플레이어 지식을 만들지 않는다',()=>{const d=npcSocialFixture(),before=stateHash(d.s);expect(npcConversationQuote(d.w,d.a,d.b).error).toBeNull();expect(npcSocialAction(d.w,d.a)).toEqual({type:'npcSocialTalk',target:d.b.id});expect(d.a.npcTies).toBeUndefined();expect(stateHash(d.s)).toBe(before)})
 it('공개 대기 중 실제 자기 AI 차례의 짧은 대화만 두 사람의 기억을 만든다',()=>{
  const d=npcSocialFixture(),at=turnOf(d.w),actorIds=d.s.creatures.map(c=>c.id),nextId=d.s.nextId;d.act({type:'wait'});expect(turnOf(d.w)-at).toBe(1);expect(d.a.npcTies![d.b.id]).toMatchObject({score:2,since:at,lastAt:at,gained:2,lost:0});expect(d.b.npcTies![d.a.id]).toMatchObject({name:actualNpcName(d.a),score:2,since:at,lastAt:at,gained:2,lost:0});expect(d.a.npcTies![d.b.id].name).toBe(actualNpcName(d.b));expect(d.a.socialObservation!.lastTalk).toBe(at);expect(d.b.socialObservation!.lastTalk).toBe(at);expect(d.a.npcPsyche!.history.some(t=>t.thought==='Thought.Talked')).toBe(true);expect(d.p.npcTies).toBeUndefined();expect(d.s.creatures.map(c=>c.id)).toEqual(actorIds);expect(d.s.nextId).toBe(nextId)
 })
 it('플레이어가 보거나 듣지 못한 대화는 개인 기억으로만 남는다',()=>{const d=npcSocialFixture(true),oldLog=d.s.log.length,oldKnowledge=structuredClone(d.s.knowledge);d.act({type:'wait'});expect(d.a.npcTies![d.b.id].score).toBe(2);expect(d.s.log.slice(oldLog).some(e=>e.text.includes('이야기'))).toBe(false);expect(d.s.knowledge).toEqual(oldKnowledge);expect(d.b.met).not.toBe(true)})
 it('특성 충돌은 실제 대화의 다른 기분/관계로 남고 소문/적대/고용을 만들지 않는다',()=>{const d=npcSocialFixture(false,true),factions=[d.a.faction,d.b.faction],relations=structuredClone(d.m.society);expect(converseNpcs(d.w,d.a,d.b)).toBeNull();expect(d.a.npcTies![d.b.id]).toMatchObject({score:-2,lost:2});expect(d.a.npcTies![d.b.id].events[0].kind).toBe('clash');expect(d.a.thoughts.some(t=>t.def==='Thought.Talked')).toBe(false);expect([d.a.faction,d.b.faction]).toEqual(factions);expect(d.m.society).toEqual(relations);expect(d.a.attackedBy).toBeUndefined()})
 it('기존 쉬는 차례와 같은100TU이며 조회나 짝의 대기는 시간을 새로 만들지 않는다',()=>{const d=npcSocialFixture(),at=d.s.time;expect(perform(d.w,d.a,{type:'npcSocialTalk',target:d.b.id})).toEqual({ok:true,tu:100});expect(d.s.time).toBe(at);expect(d.a.rested).toBe(true);expect(d.a.activity).toBeUndefined();expect(d.b.activity).toBeUndefined()})
 it('바로 다시 대화하거나 다른 상대를 골라 간격을 우회하지 않는다',()=>{const d=npcSocialFixture();expect(converseNpcs(d.w,d.a,d.b)).toBeNull();const before=stateHash(d.s);expect(converseNpcs(d.w,d.b,d.a)).toBeTruthy();expect(npcSocialAction(d.w,d.a)).toBeNull();expect(stateHash(d.s)).toBe(before)})
 it('한 쌍의 하루 호감 상한과 다음날의 실제 새 대화를 구별한다',()=>{const d=npcSocialFixture(),rule=npcSocialDef(d.w);for(let i=0;i<4;i++){expect(converseNpcs(d.w,d.a,d.b)).toBeNull();d.s.time+=rule.intervalTurns*100}expect(d.a.npcTies![d.b.id]).toMatchObject({score:3,gained:3});d.s.time=TURNS_PER_DAY*100;expect(converseNpcs(d.w,d.a,d.b)).toBeNull();expect(d.a.npcTies![d.b.id]).toMatchObject({score:5,gained:2})})
 it('한 쌍의 하루 반감 상한과 오래된 사건 목록 제한을 지킨다',()=>{const d=npcSocialFixture(false,true),rule=npcSocialDef(d.w);for(let i=0;i<20;i++){expect(converseNpcs(d.w,d.a,d.b)).toBeNull();d.a.npcSocialAfter=undefined;d.b.npcSocialAfter=undefined}expect(d.a.npcTies![d.b.id]).toMatchObject({score:-6,lost:6});expect(d.a.npcTies![d.b.id].events).toHaveLength(rule.historyLimit)})
 it.each(['copyA','copyB','player','otherMap','far','asleep','unconscious','activity','captive','hungry','thirsty','fatigued','cold','dark','hostility','task','caravan','badTie']as const)('불가능한 실제 주체/몸/의사/상황은 전체 상태를 보존한다 (%s)',mode=>{
  const d=npcSocialFixture();let a=d.a,b=d.b
  if(mode==='copyA')a=structuredClone(a);if(mode==='copyB')b=structuredClone(b);if(mode==='player')a=d.p;if(mode==='otherMap')b.mapId='crypt1';if(mode==='far')b.pos={x:1,y:1};if(mode==='asleep')b.asleep=true;if(mode==='unconscious')b.unconscious=true;if(mode==='activity')b.activity={kind:'rest',remaining:5,label:'휴식'};if(mode==='captive')b.captivity={captor:a.id,faction:a.faction,at:turnOf(d.w),rope:makeItem(d.w,'Item.Rope')};if(mode==='hungry')a.needs.kcal=0;if(mode==='thirsty')a.needs.waterDeficit=500;if(mode==='fatigued')a.needs.fatigue=80;if(mode==='cold')a.needs.bodyTemp=31;if(mode==='hostility')a.attackedBy=[b.id];if(mode==='task')a.ai.task={kind:'search',pos:{...b.pos}};if(mode==='caravan')a.caravan='existing-work';if(mode==='badTie')a.npcTies={[b.id]:{name:d.b.name,score:-21,since:1,lastAt:1,day:0,gained:0,lost:0,events:[]}}
  if(mode==='dark'){d.s.map.ambient=0;d.s.map.daylightMult=0;d.s.map.lights=[];for(const c of d.s.creatures)for(const i of Object.values(c.equip))if(i)i.lit=false;invalidateLights(d.w)}const before=stateHash(d.s);expect(converseNpcs(d.w,a,b)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('규칙을 끈 대조는 기존 대기를 사용하고 사적인 관계를 만들지 않는다',()=>{const d=npcSocialFixture(),w:World={db:offDb(),s:structuredClone(d.s)},a=w.s.creatures.find(c=>c.id===d.a.id)!;expect(npcSocialAction(w,a)).toBeNull();expect(w.s.creatures.every(c=>!c.npcTies)).toBe(true)})
 it('실제 시작한20턴 대기를 복원하면 원래 사람/기억/몸/난수 전체가 같다',()=>{const d=npcSocialFixture();d.act({type:'rest',turns:20},1);expect(d.s.simulationPending).toBe(true);const w:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.a.npcTies![d.b.id].score).toBe(2)})
 it('153각인은 과거 만남/친구/대화를 생성하지 않고 버전만 올린다',()=>{const d=npcSocialFixture(),s=structuredClone(d.s);s.version=153;expect(deserialize(JSON.stringify(s))).toEqual({...s,version:SAVE_VERSION})})
 it('실제 숨은 다른 장소의 사람은 상대로 선택하지 않는다',()=>{const d=npcSocialFixture();d.b.mapId='crypt1';expect(npcSocialAction(d.w,d.a)).toBeNull();updatePlayerVision(d.w,d.p);expect(d.a.npcTies).toBeUndefined()})
 it.each([['/intervalTurns',0],['/roles',['player']],['/personalityRules','CompanionBond.Missing'],['/minBodyTemp',40],['/historyLimit',0]])('잘못된 대화 규칙을 시작 전에 거절한다 (%s)',(path,value)=>{const{report}=loadMods([...readPackages(),{manifest:{id:'bad-social',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'NpcSocial.Hearth',path,value}]}],['bad-social']);expect(report.errors.some(e=>e.includes('NpcSocial.Hearth'))).toBe(true)})
})
