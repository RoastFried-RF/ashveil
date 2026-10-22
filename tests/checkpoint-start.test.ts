import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { world, screen, simulating, packages, pendingCheckpoint, pendingContentReview, checkpointError, checkpointBusy, cancelCheckpoint, saveCheckpoint, beginCheckpointLoad, confirmCheckpoint, continueImprint, createSeedCode, act, chronicle, checkpointSummaries } from '../src/client/store'
import { checkpointStorage } from '../src/client/checkpoints'
import { imprintStorage } from '../src/client/imprint'
import { newGame, runUntilInput } from '../src/core/game'
import { serialize } from '../src/core/save'
import { loadMods } from '../src/core/defs'
import { decodeSeedShare } from '../src/core/seed-share'
import { readPackages } from '../tools/loadContent'
import { checkpointFixture } from './checkpoint-fixture'
const mode='SaveMode.Study'
const db=loadMods(packages,[]).db
function fixture(saveMode=mode){const w={db,s:newGame(db,{seed:'actual-manual-slot',saveMode,overworld:true})};runUntilInput(w);return w}
let values:Map<string,string>
beforeEach(()=>{values=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});simulating.value=false})
afterEach(()=>{cancelCheckpoint();world.value=null;screen.value='title';vi.restoreAllMocks();vi.unstubAllGlobals()})
function saved(raw=serialize(fixture().s)){
 const read=vi.spyOn(checkpointStorage(mode),'read').mockResolvedValue(raw),write=vi.spyOn(checkpointStorage(mode),'write').mockResolvedValue(),autosave=vi.spyOn(imprintStorage,'write').mockResolvedValue()
 return{read,write,autosave,raw}
}
describe('실제 클라이언트의 분리된 수동 저장/검토/복원',()=>{
 it('타이틀 목록은 없는 지점을 생략하고 기록 시점만 읽으며 슬롯/세계를 쓰지 않는다',async()=>{
  const{raw,read,write,autosave}=saved(),w=fixture();world.value=w;screen.value='game';const before=serialize(w.s),modes=[{id:mode,label:'탐구'}];expect(await checkpointSummaries(modes)).toEqual([{...modes[0],summary:`${w.s.creatures.find(c=>c.id===w.s.playerId)!.name} · ${w.s.seed} · ${Math.floor(w.s.time/100)}턴`}]);read.mockResolvedValue(null);expect(await checkpointSummaries(modes)).toEqual([]);read.mockResolvedValue('{broken');expect((await checkpointSummaries(modes))[0].summary).toContain('오류');expect(serialize(w.s)).toBe(before);expect(raw).toBe(before);expect(write).not.toHaveBeenCalled();expect(autosave).not.toHaveBeenCalled()
 })
 it.each(['SaveMode.Imprint','SaveMode.Study'])('실제 대기로 사망한%s는 현재 자동 기록만 삭제하고 모드가 표시된 연대기를 쓴다',async saveMode=>{
  const{w}=checkpointFixture(saveMode,true);world.value=w;screen.value='game';const{write,autosave}=saved();for(let i=0;!w.s.over&&i<3;i++)expect(act({type:'wait'},true)).toBeNull();expect(w.s.over?.kind).toBe('death');expect(autosave).toHaveBeenLastCalledWith(null);expect(write).not.toHaveBeenCalled();expect(chronicle()[0]).toMatchObject({kind:'death',saveMode,saveModeLabel:saveMode==='SaveMode.Study'?'탐구':'각인'})
 })
 it('수동 저장은 전체 원문을 별도 슬롯에 쓰며 턴·몸·난수/자동 각인을 바꾸지 않는다',async()=>{
  const w=fixture();world.value=w;screen.value='game';const{write,autosave}=saved(),before=serialize(w.s);expect(await saveCheckpoint()).toBeNull();expect(write).toHaveBeenCalledExactlyOnceWith(before);expect(autosave).not.toHaveBeenCalled();expect(serialize(w.s)).toBe(before);expect(checkpointStorage(mode)).not.toBe(checkpointStorage('SaveMode.Waymark'))
 })
 it('저장 실패는 현재 세계와 기존 복원 지점을 삭제하지 않는다',async()=>{
  const w=fixture();world.value=w;screen.value='game';const{write,autosave}=saved(),before=serialize(w.s);write.mockRejectedValue(Error('declared disk full'));expect(await saveCheckpoint()).toContain('disk full');expect(write).toHaveBeenCalledOnce();expect(autosave).not.toHaveBeenCalled();expect(serialize(w.s)).toBe(before);expect(checkpointBusy.value).toBe(false)
 })
 it('각인/표석의 불허 위치와 진행 중 계산은 저장을 거부한다',async()=>{
  const{write,autosave}=saved();for(const id of ['SaveMode.Imprint','SaveMode.Waymark']){const w=fixture(id);world.value=w;screen.value='game';w.s.map.lights=[];w.s.map.innBeds=[];expect(await saveCheckpoint()).not.toBeNull()};world.value=fixture();simulating.value=true;expect(await saveCheckpoint()).toContain('계산');simulating.value=false;expect(write).not.toHaveBeenCalled();expect(autosave).not.toHaveBeenCalled()
 })
 it('검토/취소는 현재 실행 세계·화면·자동 기록·복원 원문을 보존한다',async()=>{
  const running=fixture('SaveMode.Waymark');world.value=running;screen.value='game';const{write,autosave,raw}=saved(),before=serialize(running.s);await beginCheckpointLoad(mode);expect(pendingCheckpoint.value?.raw).toBe(raw);expect(pendingContentReview.value).toMatchObject({status:'same',canContinue:true});expect(world.value).toBe(running);expect(serialize(running.s)).toBe(before);expect(write).not.toHaveBeenCalled();expect(autosave).not.toHaveBeenCalled();const token=pendingContentReview.value!.token;cancelCheckpoint();await confirmCheckpoint(token);expect(world.value).toBe(running);expect(autosave).not.toHaveBeenCalled()
 })
 it('명시 복원은 같은 전체 세계/UID/난수로 돌아가고 자동 기록만 새로 쓴다',async()=>{
  const{raw,write,autosave}=saved();await beginCheckpointLoad(mode);const token=pendingContentReview.value!.token;expect(world.value).toBeNull();await confirmCheckpoint(token);expect(checkpointError.value).toBe('');expect(pendingCheckpoint.value).toBeNull();expect(screen.value).toBe('game');expect(serialize(world.value!.s)).toBe(raw);expect(autosave).toHaveBeenCalledExactlyOnceWith(raw);expect(write).not.toHaveBeenCalled()
 })
 it('검토 뒤 슬롯 원문 변경은 자동 승인하지 않으며 이전 실행 세계를 보존한다',async()=>{
  const w=fixture();world.value=w;screen.value='game';const{read,autosave}=saved();await beginCheckpointLoad(mode);const token=pendingContentReview.value!.token;read.mockResolvedValue(serialize({...w.s,time:w.s.time+100}));await confirmCheckpoint(token);expect(checkpointError.value).toContain('바뀌었다');expect(world.value).toBe(w);expect(autosave).not.toHaveBeenCalled();expect(pendingContentReview.value).toBeNull()
 })
 it('다른 방식 원문/사라진 Def는 현재 세계를 교체하지 않는다',async()=>{
  const{read,autosave}=saved(serialize(fixture('SaveMode.Waymark').s));await beginCheckpointLoad(mode);expect(checkpointError.value).toContain('선택한 방식');expect(pendingContentReview.value).toBeNull();expect(autosave).not.toHaveBeenCalled();cancelCheckpoint();read.mockResolvedValue(serialize(fixture('SaveMode.Study').s).replace('SaveMode.Study','SaveMode.Absent'));await beginCheckpointLoad(mode);expect(world.value).toBeNull();expect(autosave).not.toHaveBeenCalled()
 })
 it('불러오기 대기 중 취소는 늦은 결과를 게시하지 않는다',async()=>{
  const{read,autosave,raw}=saved();let resolve!:(s:string)=>void;read.mockReturnValue(new Promise(r=>resolve=r));const task=beginCheckpointLoad(mode);cancelCheckpoint();resolve(raw);await task;expect(world.value).toBeNull();expect(pendingCheckpoint.value).toBeNull();expect(pendingContentReview.value).toBeNull();expect(autosave).not.toHaveBeenCalled()
 })
 it('콘텐츠 변경도 같은 원문 검토를 거쳐야 하며 취소 후에는 어느 슬롯도 쓰지 않는다',async()=>{
  const pkgs=readPackages();pkgs.find(p=>p.manifest.id==='core')!.patches.push({op:'replace',target:'Terrain.KtFloor',path:'/label',value:'이전 표석 바닥'});const old=loadMods(pkgs,[]).db,w={db:old,s:newGame(old,{seed:'actual-manual-slot',saveMode:mode,overworld:true})};runUntilInput(w);const{raw,write,autosave}=saved(serialize(w.s));await beginCheckpointLoad(mode);expect(pendingContentReview.value).toMatchObject({status:'changed',canContinue:true});expect(world.value).toBeNull();expect(write).not.toHaveBeenCalled();expect(autosave).not.toHaveBeenCalled();cancelCheckpoint();await beginCheckpointLoad(mode);await confirmCheckpoint(pendingContentReview.value!.token);expect(world.value!.s.loadHash).toBe(db.loadHash);expect(world.value!.s.time).toBe(w.s.time);expect(world.value!.s.rng).toEqual(w.s.rng);expect(world.value!.s.contentChanges).toHaveLength(1);expect(write).not.toHaveBeenCalled();expect(autosave).toHaveBeenCalledOnce();expect(raw).toBe(serialize(w.s))
 })
 it('표석/탐구 자동 기록을 읽을 때 업적 차단을 누락한 원문도 활성화하지 않는다',async()=>{
  const w=fixture();delete w.s.achievementsDisabled;vi.spyOn(imprintStorage,'read').mockResolvedValue(serialize(w.s));expect(await continueImprint()).toBeNull();expect(world.value!.s.achievementsDisabled).toBe(true)
 })
 it('자동 기록의 저장 방식 Def가 없거나 다른 종류면 원문을 삭제하지 않고 거부한다',async()=>{
  const w=fixture(),read=vi.spyOn(imprintStorage,'read'),write=vi.spyOn(imprintStorage,'write').mockResolvedValue();for(const saveMode of ['SaveMode.Absent','Item.Stone']){read.mockResolvedValue(serialize({...w.s,saveMode}));expect(await continueImprint()).toContain('저장 방식');expect(world.value).toBeNull();expect(write).not.toHaveBeenCalled()}
 })
 it('은퇴 인물과 시드 공유는 원래 저장 방식을 구분한다',()=>{
  const w=fixture(),seed=w.s.seed,site=w.s.overworld!.sites.find(s=>s.kind==='settlement')!,legacy={key:'declared-study-retiree',seed,site:site.id,name:'탐구 인물',age:40,tales:['초기 메타 이야기']};values.set('ashveil.chronicle.v1',JSON.stringify([{kind:'retire',seed,saveMode:mode,retirement:{legacy}}]));const normal=decodeSeedShare(createSeedCode(seed,undefined,[],0)),study=decodeSeedShare(createSeedCode(seed,undefined,[],0,undefined,mode));expect(normal.saveMode).toBeUndefined();expect(normal.legacyResidents).toEqual([]);expect(study.saveMode).toBe(mode);expect(study.legacyResidents).toEqual([legacy])
 })
})
