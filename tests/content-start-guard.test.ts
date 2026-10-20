import{afterEach,describe,it,expect,vi}from'vitest'
import{packages,world,screen,version,continueImprint}from'../src/client/store'
import{imprintStorage}from'../src/client/imprint'
import{loadDb}from'../tools/loadContent'
import{newGame,SAVE_VERSION}from'../src/core/game'
import{serialize}from'../src/core/save'
const count=packages.length
afterEach(()=>{packages.splice(count);world.value=null;screen.value='title';vi.restoreAllMocks()})
describe('기록한 콘텐츠와 다른 각인을 자동 실행하지 않는다',()=>{
 it('같은 모드ID여도 실제 Def 값이 달라지면 현재 세계·각인·화면을 보존한다',async()=>{const{db}=loadDb(),saved=newGame(db,{seed:'saved-core-content'}),original={db,s:newGame(db,{seed:'running-content'})},raw=serialize(saved);world.value=original;screen.value='game';const before=serialize(original.s),v=version.value,core=packages.find(p=>p.manifest.id==='core')!,changed=structuredClone(core),index=packages.indexOf(core);changed.patches.push({op:'replace',target:'Terrain.KtFloor',path:'/label',value:'바뀐 바닥'});packages[index]=changed;try{vi.spyOn(imprintStorage,'read').mockResolvedValue(raw);const write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined),error=await continueImprint();expect(error).toContain('콘텐츠 구성과 현재 구성이 다르다');expect(world.value).toBe(original);expect(serialize(original.s)).toBe(before);expect(screen.value).toBe('game');expect(version.value).toBe(v);expect(write).not.toHaveBeenCalled()}finally{packages[index]=core}})
 it('같은 실제 해시인 각인은 전체 상태를 유지해 정상 불러온다',async()=>{const{db}=loadDb(),s=newGame(db,{seed:'same-content-load',overworld:true}),raw=serialize(s);vi.spyOn(imprintStorage,'read').mockResolvedValue(raw);const write=vi.spyOn(imprintStorage,'write').mockResolvedValue(undefined);expect(await continueImprint()).toBeNull();expect(screen.value).toBe('game');expect(serialize(world.value!.s)).toBe(raw);expect(write).not.toHaveBeenCalled()})
 it('구형 기록 없음은 원래 동작으로 불러오되 현재 해시를 과거 값으로 채우지 않는다',async()=>{const{db}=loadDb(),s=newGame(db,{seed:'legacy-unknown-load',overworld:true});delete s.loadHash;delete s.contentDefinitions;delete s.contentItemShapes;delete s.gameVersion;delete s.defSchemaVersion;delete s.contentMods;s.version=177;vi.spyOn(imprintStorage,'read').mockResolvedValue(serialize(s));expect(await continueImprint()).toBeNull();expect(world.value!.s.version).toBe(SAVE_VERSION);expect(world.value!.s).not.toHaveProperty('loadHash')})
})
