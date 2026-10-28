import {SAVE_VERSION} from '../src/core/game'
import {describe,it,expect} from 'vitest'
import {storyDirectorFixture} from './story-director-fixture'
import {storyFameNativeFixture} from './story-fame-fixture'
import {storyFameTick,recordStoryVictory} from '../src/core/story-fame'
import {storyScaleHundred} from '../src/core/story-director'
import {createCreature} from '../src/core/creatures'
import {killCreature} from '../src/core/combat'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {newGame,runUntilInput} from '../src/core/game'
import {turnOf,type World} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const target=(d:ReturnType<typeof storyDirectorFixture>,def='Creature.ReaverChief')=>{const c=createCreature(d.w,def,{x:22,y:20});c.asleep=false;c.unconscious=false;d.s.creatures.push(c);return c}
describe('실제 승리의 명성과 사건 규모',()=>{
 it('선택한 새 게임은 명성0이며 고정 규칙에는 명성 상태를 만들지 않는다',()=>{const d=storyDirectorFixture();expect(d.director.fame).toEqual({value:0,lastDecayAt:turnOf(d.w),credited:[]});const s=newGame(d.w.db,{seed:'classic-no-fame'});expect(s.storyteller.director).toBeUndefined()})
 it('실제 두목 처치 한 번은10명성과 규모10을 올리고 같은 시체 재처치는 중복 계산하지 않는다',()=>{const d=storyDirectorFixture(),c=target(d);expect(storyScaleHundred(d.w)).toBe(60);killCreature(d.w,c,'실제 검증',{killerId:d.p.id});expect(d.director.fame!.value).toBe(10);expect(storyScaleHundred(d.w)).toBe(70);const before=stateHash(d.s);recordStoryVictory(d.w,c,[],true);expect(stateHash(d.s)).toBe(before);killCreature(d.w,c,'같은 사망',{killerId:d.p.id});expect(stateHash(d.s)).toBe(before)})
 it('살아 있는 두목/남이 죽인 두목은 명성을 만들지 않는다',()=>{const d=storyDirectorFixture(),c=target(d);recordStoryVictory(d.w,c,[],true);expect(d.director.fame!.value).toBe(0);const other=createCreature(d.w,'Creature.SettlementGuard',{x:23,y:20});d.s.creatures.push(other);killCreature(d.w,c,'NPC의 실제 처치',{killerId:other.id});expect(d.director.fame!.value).toBe(0)})
 it('실제 융합체 처치는20이며 일반 약탈자는 두목 보상을 받지 않는다',()=>{const d=storyDirectorFixture(),ordinary=target(d,'Creature.Reaver');killCreature(d.w,ordinary,'일반 처치',{killerId:d.p.id});expect(d.director.fame!.value).toBe(0);const boss=target(d,'Creature.Amalgam');killCreature(d.w,boss,'보스 처치',{killerId:d.p.id});expect(d.director.fame!.value).toBe(20)})
 it('현재 실제 공급원의 마지막 원래 인원에서만 고갈15를 한 번 받는다',()=>{
  const d=storyDirectorFixture(),source=d.s.sources!.find(s=>s.id==='reaverCamp')!,a=target(d,'Creature.Reaver'),b=target(d,'Creature.Reaver')
  source.deployed=true;source.count=2;source.floors=['surface'];source.members=[a.id,b.id]
  killCreature(d.w,a,'첫 인원',{killerId:d.p.id});expect(source.count).toBe(1);expect(d.director.fame!.value).toBe(0)
  killCreature(d.w,b,'마지막 인원',{killerId:d.p.id});expect(source.count).toBe(0);expect(d.director.fame!.value).toBe(15)
  const c=target(d,'Creature.Reaver');source.members.push(c.id);source.count=1;killCreature(d.w,c,'재점거 인원',{killerId:d.p.id});expect(d.director.fame!.value).toBe(15)
 })
 it('남의 공급원 고갈/현재 층과 다른 공급원은 플레이어 명성으로 돌리지 않는다',()=>{for(const mode of ['other','wrongFloor']){const d=storyDirectorFixture(),source=d.s.sources!.find(s=>s.id==='reaverCamp')!;source.deployed=true;source.count=1;source.floors=mode==='wrongFloor'?['elsewhere']:['surface'];const c=target(d,'Creature.Reaver');source.members=[c.id];killCreature(d.w,c,'현장 처치',mode==='other'?{}:{killerId:d.p.id});expect(d.director.fame!.value).toBe(0)}})
 it('보상은100에서 멈추고 일주일마다2 감소하며 같은 시각을 두 번 정산하지 않는다',()=>{const d=storyDirectorFixture();for(let i=0;i<11;i++)killCreature(d.w,target(d),'각각 실제 두목',{killerId:d.p.id});expect(d.director.fame!.value).toBe(100);d.s.time+=7*28800*100;storyFameTick(d.w);expect(d.director.fame!.value).toBe(98);const before=serialize(d.s);storyFameTick(d.w);expect(serialize(d.s)).toBe(before);d.s.time+=100*7*28800*100;storyFameTick(d.w);expect(d.director.fame!.value).toBe(0)})
 it('기존133의 과거 사망/고갈에서 명성을 추정해 채우지 않고 새 실제 처치부터 기록한다',()=>{const d=storyDirectorFixture();killCreature(d.w,target(d),'옛 승리',{killerId:d.p.id});delete d.director.fame;const raw=JSON.parse(serialize(d.s));raw.version=133;const restored=deserialize(JSON.stringify(raw));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:133}).toEqual(raw);expect(restored.storyteller.director!.fame).toBeUndefined();const w:World={db:d.w.db,s:restored},c=createCreature(w,'Creature.ReaverChief',{x:22,y:20});w.s.creatures.push(c);killCreature(w,c,'복원 뒤 새 실제 승리',{killerId:w.s.playerId});expect(w.s.storyteller.director!.fame!.value).toBe(10)})
 it('승리 뒤 미완료 예산/명성 감소/몸/난수의 저장 복원 전체가 같다',()=>{const d=storyDirectorFixture();killCreature(d.w,target(d),'실제 승리',{killerId:d.p.id});d.act({type:'rest',turns:20},1);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(copy);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))})
 it('실제 네 번의 기본 공격 입력과 사망/현재 공급원 고갈에서만25명성을 받는다',()=>{const d=storyFameNativeFixture('before'),at=d.s.time;for(let i=0;i<3;i++){d.act({type:'move',dir:2});expect(d.target.alive).toBe(true);expect(d.s.storyteller.director!.fame!.value).toBe(0)}d.act({type:'move',dir:2});expect(d.s.time-at).toBe(400);expect(d.target.alive).toBe(false);expect(d.s.sources!.find(s=>s.id==='reaverCamp')!.count).toBe(0);expect(d.s.storyteller.director!.fame!.value).toBe(25);expect(storyScaleHundred(d.w)).toBe(85)})
 it('수치/실제 생물 참조가 틀린 명성 규칙은 로드 때 거절한다',()=>{const id='bad-fame',m=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Event.ReaverPatrol',path:'/director/fame/awards/0/amount',value:-1}]}],[id]);expect(m.report.errors.length).toBeGreaterThan(0)})
})
