import {afterEach,describe,it,expect,vi} from 'vitest'
import {buildDb,inspectDb,packages,startNew,continueImprint,world,screen,version,loadReport} from '../src/client/store'
import {imprintStorage} from '../src/client/imprint'
import {loadDb} from '../tools/loadContent'
import {newGame} from '../src/core/game'
import type {ScriptState} from '../src/core/script-contracts'
import {serialize} from '../src/core/save'

const count=packages.length
afterEach(()=>{packages.splice(count);world.value=null;screen.value='title';vi.restoreAllMocks()})

describe('잘못된 모드 구성으로 세계나 각인을 바꾸지 않는다',()=>{
  it('검사용 로드는 오류 리포트를 반환하고 실행용 로드는 거절한다',()=>{
    const result=inspectDb(['missing.mod']);expect(result.report.errors.length).toBeGreaterThan(0)
    expect(loadReport.value).toEqual(result.report);expect(()=>buildDb(['missing.mod'])).toThrow('missing.mod')
  })
  it('실패한 새 게임은 기존 세계·화면·각인을 보존한다',async()=>{
    const {db}=loadDb(),original={db,s:newGame(db,{seed:'mod-guard'})};world.value=original;screen.value='game'
    const before=serialize(original.s),v=version.value,write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined)
    await expect(startNew('replacement',undefined,['missing.mod'])).rejects.toThrow('missing.mod')
    expect(world.value).toBe(original);expect(serialize(world.value!.s)).toBe(before);expect(screen.value).toBe('game');expect(version.value).toBe(v);expect(write).not.toHaveBeenCalled()
  })
  it('의미 오류가 있는 모드도 게임 생성 전에 차단한다',async()=>{
    packages.push({manifest:{id:'bad.event',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'Event.ReaverPatrol',path:'/composition/fromPopulation',value:false}]})
    const write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined)
    await expect(startNew('invalid',undefined,['bad.event'])).rejects.toThrow('fromPopulation')
    expect(world.value).toBeNull();expect(screen.value).toBe('title');expect(write).not.toHaveBeenCalled()
  })
  it('각인 소스가 달라 거절하면 기존 실행 세계와 화면/각인을 그대로 보존한다',async()=>{
    const id='saved.script',source='export default defineMod({hooks:{onDayStart(){return []}}})';packages.push({manifest:{id,name:id,version:'1',scripts:{stage:1,entry:'scripts/main.js'}},defs:[],patches:[],scripts:[{file:'scripts/main.js',source}]})
    const {db}=loadDb(),original={db,s:newGame(db,{seed:'original-script-world'})};world.value=original;screen.value='game';const beforeVersion=version.value,s=newGame(db,{seed:'changed-script-save'});s.mods=['core',id];delete s.loadHash;delete s.contentDefinitions;s.version=177;s.scriptState={hashes:{[id]:'previous-source'},mods:{},disabled:[],errors:[]}satisfies ScriptState
    vi.spyOn(imprintStorage,'read').mockResolvedValue(serialize(s));const write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined);expect(await continueImprint()).toContain('현재 소스가 다르다');expect(world.value).toBe(original);expect(screen.value).toBe('game');expect(version.value).toBe(beforeVersion);expect(write).not.toHaveBeenCalled()
  })
  it('늦게 도착한 이전 각인이 이후 실제 새 게임을 덮어쓰지 않는다',async()=>{
    const {db}=loadDb(),raw=serialize(newGame(db,{seed:'old-delayed-save'}));let finish!:(raw:string)=>void;vi.spyOn(imprintStorage,'read').mockImplementation(()=>new Promise(resolve=>{finish=resolve}));vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined)
    const pending=continueImprint();await startNew('newer-game',undefined,[]);const actual=world.value;finish(raw);expect(await pending).toContain('취소');expect(world.value).toBe(actual);expect(world.value!.s.seed).toBe('newer-game')
  })
  it('각인에서 빠진 모드는 core로 대체하지 않고 원래 파일을 보존한다',async()=>{
    const {db}=loadDb(),s=newGame(db,{seed:'missing-saved-mod'});s.mods=['core','missing.saved.mod'];const raw=serialize(s)
    vi.spyOn(imprintStorage,'read').mockResolvedValue(raw);const write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined)
    const error=await continueImprint();expect(error).toContain('missing.saved.mod');expect(world.value).toBeNull();expect(screen.value).toBe('title');expect(write).not.toHaveBeenCalled()
  })
})
