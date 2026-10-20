import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {world,screen,continueImprint,reviewImprintMods,pendingContentReview,cancelContentReview} from '../src/client/store'
import {imprintStorage} from '../src/client/imprint'
import {missingCreaturesFixture} from './missing-creatures-fixture'
import {serialize} from '../src/core/save'
beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}})})
afterEach(()=>{cancelContentReview();world.value=null;screen.value='title';vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('사라진 생물 모드를 각인 구성에서 명시 제거',()=>{
 it('선택 검토/취소는 원문을 보존하고 실제 승인만 층 개체/로그/현재 메타데이터를 바꾸어 한 번 저장한다',async()=>{
  const{w,creature}=missingCreaturesFixture(),raw=serialize(w.s);vi.spyOn(imprintStorage,'read').mockResolvedValue(raw);const write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined)
  expect(await continueImprint()).toContain('removed-creature');await reviewImprintMods([]);expect(pendingContentReview.value!.canContinue).toBe(true);expect(pendingContentReview.value!.removedCreatures.actors).toBe(1);expect(world.value).toBeNull();expect(write).not.toHaveBeenCalled();expect(serialize(w.s)).toBe(raw);cancelContentReview();expect(world.value).toBeNull();await reviewImprintMods([])
  expect(await continueImprint(pendingContentReview.value!.token)).toBeNull();const current=world.value!,actual=JSON.parse(serialize(current.s)),expected=JSON.parse(raw);expected.creatures=expected.creatures.filter((c:{id:number})=>c.id!==creature.id);const entry=actual.log.pop();expect(entry.text).toContain('생물을 층에서 제거');Object.assign(expected,{loadHash:current.db.loadHash,contentMods:current.db.modManifest(),contentDefinitions:current.db.definitionManifest(),contentItemShapes:current.db.itemShapeManifest(),mods:[...current.db.loadedMods],contentChanges:[{turn:entry.turn,from:w.db.loadHash,to:current.db.loadHash}],achievementsDisabled:true});expect(actual).toEqual(expected);expect(write).toHaveBeenCalledTimes(1)
 })
 it('플레이어나 실제 진행 중인 대상 관계는 토큰으로도 제거/저장하지 않는다',async()=>{
  const{w,creature}=missingCreaturesFixture();w.s.creatures[1].leading={target:creature.id,uid:123,hand:'Left'};const raw=serialize(w.s);vi.spyOn(imprintStorage,'read').mockResolvedValue(raw);const write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined);await reviewImprintMods([]);expect(pendingContentReview.value!.canContinue).toBe(false);expect(pendingContentReview.value!.recoveryErrors.join()).toContain('진행 중 관계');expect(await continueImprint(pendingContentReview.value!.token)).toContain('차이를 확인');expect(world.value).toBeNull();expect(write).not.toHaveBeenCalled();expect(serialize(w.s)).toBe(raw)
 })
 it('검토 뒤 실제 몸/시간/난수가 달라지면 이전 제거 승인을 재사용하지 않는다',async()=>{
  const{w,creature}=missingCreaturesFixture(),read=vi.spyOn(imprintStorage,'read').mockResolvedValue(serialize(w.s)),write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined);await reviewImprintMods([]);const token=pendingContentReview.value!.token;creature.hp--;read.mockResolvedValue(serialize(w.s));expect(await continueImprint(token)).toContain('각인 또는 콘텐츠가 바뀌었다');expect(world.value).toBeNull();expect(write).not.toHaveBeenCalled()
 })
})
