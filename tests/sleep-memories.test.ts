import {describe,expect,it} from 'vitest'
import {sleepMemoryFixture as setup,sleepMemoryNativeFixture} from './sleep-memories-fixture'
import {sleepQuality} from '../src/core/conditions'
import {needsTick} from '../src/core/needs'
import {observeSleep,finishSleepMemories} from '../src/core/sleep-memories'
import {wakeAfterSleep} from '../src/core/sleep-state'
import {wake,killCreature} from '../src/core/combat'
import {faint} from '../src/core/body'
import {perform} from '../src/core/actions'
import {runUntilInput,stopActivity,SAVE_VERSION} from '../src/core/game'
import {activeThoughts} from '../src/core/thoughts'
import {emitNoise} from '../src/core/perception'
import {administerDrug,pharmacologyTick} from '../src/core/pharmacology'
import {tileAt,type World} from '../src/core/ctx'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const memories=(d:ReturnType<typeof setup>)=>activeThoughts(d.w,d.p).filter(t=>['Thought.SleptWell','Thought.SleptRough','Thought.GroundSleep'].includes(t.def))
const start=(d:ReturnType<typeof setup>)=>expect(perform(d.w,d.p,{type:'sleep'}).ok).toBe(true)
const tick=(d:ReturnType<typeof setup>)=>{d.s.time+=100;needsTick(d.w,d.p,true)}
describe('실제 수면 턴의 기억',()=>{
 it('조회와0턴 수면 시작/취소는 수면 이력이나 기억을 만들지 않는다',()=>{const d=setup(),hash=stateHash(d.s);sleepQuality(d.w,d.p);memories(d);expect(stateHash(d.s)).toBe(hash);start(d);expect(d.p.sleepObservation).toBeUndefined();stopActivity(d.w,d.p);expect(d.p.sleepObservation).toBeUndefined();expect(memories(d)).toEqual([])})
 it('실제 편안한 침대의 수면 품질과 회복이 같은 한 턴을 기록하고 기상 때만+4/8h를 남긴다',()=>{const d=setup(),q=sleepQuality(d.w,d.p),fatigue=d.p.needs.fatigue;expect(q).toBe(1);start(d);tick(d);expect(d.p.sleepObservation).toEqual({turns:1,qualityMicros:1000000,ground:false,maxInnerWetness:0});expect(d.p.needs.fatigue).toBeCloseTo(fatigue-12.5/1200,10);expect(memories(d)).toEqual([]);stopActivity(d.w,d.p);expect(memories(d)).toMatchObject([{def:'Thought.SleptWell',mood:4,remaining:9600}]);expect(d.p.sleepObservation).toBeUndefined()})
 it('맨땅은 남은 피로가20미만이어도 잘 잤다를 주지 않고−3/8h를 남긴다',()=>{const d=setup(false);d.p.needs.fatigue=15.01;start(d);tick(d);stopActivity(d.w,d.p);expect(d.p.needs.fatigue).toBeLessThan(20);expect(memories(d)).toMatchObject([{def:'Thought.GroundSleep',mood:-3,remaining:9600}])})
 it('지붕 아래 비가 없어도 실제 젖은 내의로 잔 뒤−6/10h 선형 기억을 남긴다',()=>{const d=setup();d.wet(60);start(d);tick(d);stopActivity(d.w,d.p);expect(memories(d)).toMatchObject([{def:'Thought.SleptRough',mood:-6,remaining:12000}]);d.s.time+=6000*100;expect(memories(d)[0]?.mood).toBe(-3)})
 it('잘 잔8시간 기억은 정확한 만료 시각에 사라진다',()=>{const d=setup();start(d);tick(d);stopActivity(d.w,d.p);d.s.time+=9599*100;expect(memories(d)[0]?.remaining).toBe(1);d.s.time+=100;expect(memories(d)).toEqual([])})
 it('실제 수면 도중 최댓값을 기억하여 깰 때 내의가 말라도 젖은 수면을 잊지 않는다',()=>{const d=setup();d.wet(60);start(d);tick(d);d.wet(0);tick(d);stopActivity(d.w,d.p);expect(memories(d).some(t=>t.def==='Thought.SleptRough')).toBe(true)})
 it('현재 기상 위치가 침대여도 실제 맨땅에서 잔 턴을 잊지 않는다',()=>{const d=setup(false);start(d);tick(d);tileAt(d.w,d.p.pos).t='Terrain.Bed';stopActivity(d.w,d.p);expect(memories(d).some(t=>t.def==='Thought.GroundSleep')).toBe(true)})
 it.each([[.899999,false],[.9,true],[1.2,true]]as const)('실제 품질 평균 임계 %s에서 잘 잤다=%s',(q,well)=>{const d=setup();start(d);for(let i=0;i<400;i++)observeSleep(d.w,d.p,q);wakeAfterSleep(d.w,d.p);expect(memories(d).some(t=>t.def==='Thought.SleptWell')).toBe(well)})
 it('한 턴의 좋은 품질로 나쁜 수면 전체를 덮지 않고 평균을 사용한다',()=>{const d=setup();start(d);observeSleep(d.w,d.p,.7);observeSleep(d.w,d.p,1);wakeAfterSleep(d.w,d.p);expect(memories(d)).toEqual([])})
 it.each([[49.999,false],[50,true]]as const)('실제 내의 젖음 %s 경계에서 젖은 수면=%s',(wet,rough)=>{const d=setup();d.wet(wet);start(d);observeSleep(d.w,d.p,.5);wakeAfterSleep(d.w,d.p);expect(memories(d).some(t=>t.def==='Thought.SleptRough')).toBe(rough)})
 it.each(['noise','hit','faint','cancel','natural']as const)('%s 기상은 실제 수면 관찰을 한 번만 소비한다',mode=>{const d=setup();start(d);tick(d);if(mode==='noise'){emitNoise(d.w,d.p.pos,40,-1);expect(d.p.activity?.wokeBy).toContain('소리');stopActivity(d.w,d.p);}if(mode==='hit')wake(d.w,d.p,'실제 충격');if(mode==='faint')faint(d.w,d.p,'수면 중');if(mode==='cancel')stopActivity(d.w,d.p);if(mode==='natural')wakeAfterSleep(d.w,d.p);expect(memories(d)).toMatchObject([{def:'Thought.SleptWell',mood:4,count:1}]);expect(d.p.sleepObservation).toBeUndefined();const old=structuredClone(d.p.thoughts);d.s.time+=100;wakeAfterSleep(d.w,d.p);expect(d.p.thoughts).toEqual(old)})
 it('죽으면 관찰을 지우고 사후 수면 기분을 만들지 않는다',()=>{const d=setup();start(d);tick(d);killCreature(d.w,d.p,'검사');expect(d.p.sleepObservation).toBeUndefined();expect(memories(d).some(t=>t.def==='Thought.SleptWell')).toBe(false)})
 it('일반NPC/휴식/실신/미세수면만으로 플레이어용 실제 수면 기억이 생기지 않는다',()=>{for(const mode of['npc','rest','unconscious','micro']){const d=setup();if(mode==='npc'){d.p.faction='coalition';start(d)}if(mode==='rest')perform(d.w,d.p,{type:'rest',turns:20});if(mode==='unconscious')d.p.unconscious=true;if(mode==='micro')d.p.asleep=true;tick(d);finishSleepMemories(d.w,d.p);expect(d.p.sleepObservation).toBeUndefined();expect(memories(d)).toEqual([])}})
 it('약물 수면도 실제 턴을 관찰하고 실제 약효 만료 때 한 번 기억한다',()=>{const d=setup();expect(administerDrug(d.w,d.p,'Drug.SleepPill')).toBeNull();tick(d);expect(d.p.sleepObservation?.turns).toBe(1);d.s.time+=2400*100;pharmacologyTick(d.w,d.p);expect(d.p.asleep).toBe(false);expect(memories(d).some(t=>t.def==='Thought.SleptWell')).toBe(true);expect(d.p.sleepObservation).toBeUndefined()})
 it('미완료 수면 각인의 실제 관찰·몸·기상·기억 전체가 순수 엔진과 같다',()=>{const d=sleepMemoryNativeFixture('pending');expect(d.s.simulationPending).toBe(true);expect(d.p.sleepObservation!.turns).toBe(1);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(copy);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.p.asleep).toBe(false);expect(d.p.sleepObservation).toBeUndefined();expect(memories(d).some(t=>t.def==='Thought.SleptWell')).toBe(true)})
 it('구형93에 관찰이 없으면 과거 수면 품질을 지어내지 않는다',()=>{const d=setup();start(d);const old=JSON.parse(serialize(d.s));old.version=93;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:93}).toEqual(old);const restored={...d,w:{db:d.w.db,s:copy},s:copy,p:copy.creatures.find(c=>c.id===copy.playerId)!};stopActivity(restored.w,restored.p);expect(memories(restored)).toEqual([])})
 it('새 수면은 이전 수면 관찰을 이어 붙이지 않는다',()=>{const d=setup();start(d);tick(d);stopActivity(d.w,d.p);d.p.thoughts=[];start(d);expect(d.p.sleepObservation).toBeUndefined();stopActivity(d.w,d.p);expect(memories(d)).toEqual([])})
 it('실제 모드의 품질 임계를 따르고 조회로 관찰/난수/시간/UID를 바꾸지 않는다',()=>{const d=setup(),id='sleep-quality-mod',loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Thought.SleptWell',path:'/minSleepQuality',value:1.1}]}],[id]);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;start(d);tick(d);const hash=stateHash(d.s);memories(d);sleepQuality(d.w,d.p);expect(stateHash(d.s)).toBe(hash);stopActivity(d.w,d.p);expect(memories(d)).toEqual([])})
 it.each([['/sleepEvent','unknown'],['/durationTurns',0],['/minSleepQuality',-.1],['/minSleepQuality',1.21],['/minSleepWetness',50],['/lifeEvent','talk'],['/condition',{any:[[{metric:'rest',min:10}]]}]]as const)('잘못된 실제 수면 메타데이터는 거절한다: %s %j',(path,value)=>{const id='bad-sleep',loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'add',target:'Thought.SleptWell',path,value}]}],[id]);expect(loaded.report.errors.length).toBeGreaterThan(0)})
})
