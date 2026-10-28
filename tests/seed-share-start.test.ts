import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {createSeedCode,startSharedSeed,world,screen,packages,cancelContentReview} from '../src/client/store'
import {imprintStorage} from '../src/client/imprint'
import {decodeSeedShare,makeSeedShare,encodeSeedShare} from '../src/core/seed-share'
import {loadMods} from '../src/core/defs'
import {newGame,runUntilInput} from '../src/core/game'
import {serialize} from '../src/core/save'
import {importedFixture} from './mod-archive-fixture'
let values:Map<string,string>;const count=packages.length
beforeEach(()=>{values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}})})
afterEach(()=>{packages.splice(count);cancelContentReview();world.value=null;screen.value='title';vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('타이틀의 실제 시드 공유 생성과 명시 시작',()=>{
 it('공유 만들기는 세계/각인을 쓰지 않고 원래 배경 추첨·재굴림1의 전체 새 세계를 실제 실행 API로 재현한다',async()=>{
  const db=loadMods(packages,[]).db,seed='share-start-whole',storyteller=db.event('Event.ReaverPatrol').director!.profiles[0].key,write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined),code=createSeedCode(seed,undefined,[],1,storyteller);expect(world.value).toBeNull();expect(write).not.toHaveBeenCalled();expect(decodeSeedShare(code).background).toBeUndefined();await startSharedSeed(code);const expected={db,s:newGame(db,{seed,overworld:true,mods:db.loadedMods,characterRoll:1,storyteller,legacyResidents:[]})};runUntilInput(expected);expect(serialize(world.value!.s)).toBe(serialize(expected.s));expect(screen.value).toBe('game');expect(write).toHaveBeenCalledTimes(1)
 })
 it('공유 문자열의 초기 인물 기록을 사용해 수신자의 다른 로컬 메타 기록이 새 세계를 바꾸지 않는다',async()=>{
  const db=loadMods(packages,[]).db,seed='share-context-exact',initial=newGame(db,{seed,overworld:true}),site=initial.overworld!.sites.find(site=>site.kind==='settlement')!,legacy={key:'declared-local-meta',seed,site:site.id,name:'로컬 초기 기록 인물',age:40,tales:['로컬에 선언된 초기 메타 이야기']};values.set('ashveil.chronicle.v1',JSON.stringify([{kind:'retire',seed,retirement:{legacy}}]));const fromLocal=createSeedCode(seed,undefined,[],0);expect(decodeSeedShare(fromLocal).legacyResidents).toEqual([legacy]);const code=encodeSeedShare(makeSeedShare(db,{seed,characterRoll:0}));vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined);await startSharedSeed(code);const expected={db,s:newGame(db,{seed,overworld:true,mods:db.loadedMods,characterRoll:0,legacyResidents:[]})};runUntilInput(expected);expect(serialize(world.value!.s)).toBe(serialize(expected.s));expect(world.value!.s.overworld!.legacyResidents).toBeUndefined()
 })
 it('공유 검토 뒤 같은 버전의 실제 모드 원문이 바뀌면 기존 세계/각인을 보존한다',async()=>{
  const pkg=importedFixture().package;packages.push(pkg);const code=createSeedCode('share-late-content',undefined,['local-floor'],0),db=loadMods(packages,[]).db,original={db,s:newGame(db,{seed:'keep-current-world'})};world.value=original;screen.value='game';const before=serialize(original.s),write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined);pkg.patches[0].value='검토 후 원문 변경';await expect(startSharedSeed(code)).rejects.toThrow('원문 내용');expect(world.value).toBe(original);expect(serialize(world.value!.s)).toBe(before);expect(screen.value).toBe('game');expect(write).not.toHaveBeenCalled()
 })
})
