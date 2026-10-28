import{describe,it,expect}from'vitest'
import{loadMods,requiredModClosure,GAME_VERSION,type ModManifest,type ModPackage}from'../src/core/defs'
import{versionInRange,supportsHookApi,HOOK_API_VERSION}from'../src/core/script-api'
import packageInfo from'../package.json'
import{readPackages}from'../tools/loadContent'
import type{TerrainDef}from'../src/core/types'
const terrain:TerrainDef={defType:'Terrain',id:'Terrain.VersionParent',label:'원형',passable:true,opaque:false,moveMult:1,sprites:['floor']}
const mod=(id:string,extra:Partial<ModManifest>={},defs:ModPackage['defs']=[]):ModPackage=>({manifest:{id,name:id,version:'1.2.3',...extra},defs,patches:[]})
const core=()=>mod('core',{version:GAME_VERSION},[structuredClone(terrain)])
const load=(mods:ModPackage[],enabled:string[]=mods.map(p=>p.manifest.id))=>loadMods(mods,enabled)
describe('실제 모드/게임 버전 범위와 선택 의존성',()=>{
 it('게임 버전 상수는 실제 배포 package.json과 같다',()=>{expect(GAME_VERSION).toBe(packageInfo.version)})
 it.each(['>=0.1.0 <0.2.0','^0.1.0','~0.1.0','0.1.0','*','0.0.9 || 0.1.0'])('선언한 실제 게임 지원 범위 %s를 검증한다',gameVersion=>{expect(load([core(),mod('a',{gameVersion})]).report.errors).toEqual([])})
 it.each(['>=0.2.0','<0.1.0','^1.0.0','이상함','0.1','>=0.1.0 ||',''])('현재 게임과 맞지 않거나 잘못된 범위 %j는 오류로 보고한다',gameVersion=>{expect(load([core(),mod('a',{gameVersion})]).report.errors.some(e=>e.includes('gameVersion'))).toBe(true)})
 it('필수 의존성의 객체 ID와 실제 범위에 따라 먼저 적용한다',()=>{const r=load([core(),mod('consumer',{dependencies:[{id:'dep',version:'>=1.2.0 <2.0.0'}]}),mod('dep')],['consumer','dep']);expect(r.report.errors).toEqual([]);expect(r.report.order).toEqual(['core','dep','consumer'])})
 it('문자열/객체 의존성을 혼합하고 같은 간선을 중복 선언할 수 있다',()=>{const r=load([core(),mod('consumer',{dependencies:['core',{id:'dep',version:'^1.0.0'},'dep']}),mod('dep')],['consumer','dep']);expect(r.report.errors).toEqual([]);expect(r.report.order).toEqual(['core','dep','consumer'])})
 it('설치돼 있어도 비활성인 필수 객체 의존성을 자동 켜지 않는다',()=>{const r=load([core(),mod('consumer',{dependencies:[{id:'dep',version:'*'}]}),mod('dep')],['consumer']);expect(r.report.errors).toContain("consumer: 필수 의존 모드 없음 'dep'");expect(r.report.order).toEqual(['core','consumer'])})
 it('필수 실제 버전 불일치는 요구/현재 버전을 함께 표시한다',()=>{const r=load([core(),mod('consumer',{dependencies:[{id:'dep',version:'>=2.0.0'}]}),mod('dep')]);expect(r.report.errors).toContain("consumer: 필수 의존 모드 'dep' 버전 1.2.3은 요구 범위 '>=2.0.0'와 맞지 않다")})
 it('부재 선택 의존성은 버전 검사/활성화 없이 무시한다',()=>{const r=load([core(),mod('consumer',{optionalDependencies:[{id:'missing',version:'>=9.0.0'}]})]);expect(r.report.errors).toEqual([]);expect(r.report.order).toEqual(['core','consumer'])})
 it('설치됐지만 비활성인 선택 의존성도 목록에 끼워 넣지 않는다',()=>{const r=load([core(),mod('consumer',{optionalDependencies:[{id:'dep',version:'>=9.0.0'}]}),mod('dep')],['consumer']);expect(r.report.errors).toEqual([]);expect(r.report.order).toEqual(['core','consumer'])})
 it('활성 선택 의존성은 실제 버전을 확인하고 소비자보다 먼저 적용한다',()=>{const r=load([core(),mod('consumer',{optionalDependencies:[{id:'dep',version:'~1.2.0'}]}),mod('dep')],['consumer','dep']);expect(r.report.errors).toEqual([]);expect(r.report.order).toEqual(['core','dep','consumer'])})
 it('활성 선택 의존성의 불일치도 묵인하지 않는다',()=>{const r=load([core(),mod('consumer',{optionalDependencies:[{id:'dep',version:'^2.0.0'}]}),mod('dep')]);expect(r.report.errors).toContain("consumer: 선택 의존 모드 'dep' 버전 1.2.3은 요구 범위 '^2.0.0'와 맞지 않다")})
 it('선택 의존성이 실제로 있으면 기존 before/after와 함께 순환을 검사한다',()=>{const r=load([core(),mod('a',{optionalDependencies:[{id:'b'}]}),mod('b',{loadAfter:['a']})]);expect(r.report.errors.some(e=>e.startsWith('순환 의존성:'))).toBe(true)})
 it('실제 외부 부모 Def의 객체 의존성 선언을 인정한다',()=>{const parent={...structuredClone(terrain),id:'Terrain.ParentFromDependency'},child={defType:'Terrain',id:'Terrain.ChildConsumer',parent:parent.id,label:'자식'},r=load([core(),mod('dep',{},[parent]),mod('consumer',{dependencies:[{id:'dep',version:'^1.0.0'}]},[child])]);expect(r.report.errors).toEqual([]);expect(r.db.terrain(child.id).sprites).toEqual(parent.sprites)})
 it.each(['dependencies','optionalDependencies']as const)('잘못된 %s 객체는 ID/버전 형태 오류로 보고한다',field=>{for(const value of[null,3,[null],[{}],[{id:3}],[{id:''}],[{id:'dep',version:3}],[{id:'dep',version:''}],[{id:'missing',version:'nonsense'}],[{id:'missing',version:'>=1'}]]){const bad=mod('a',{[field]:value}as unknown as Partial<ModManifest>),r=load([core(),bad]);expect(r.report.errors.some(e=>e.includes('manifest.'+field))).toBe(true)}})
 it('버전 범위를 쓰지 않은 기존 문자열 의존성의 버전 표기를 강제로 바꾸지 않는다',()=>{const r=load([core(),mod('a',{dependencies:['dep']}),mod('dep',{version:'1'})]);expect(r.report.errors).toEqual([])})
 it('범위가 있는 대상의 잘못된 실제 버전은 추측하지 않는다',()=>{const r=load([core(),mod('a',{dependencies:[{id:'dep',version:'*'}]}),mod('dep',{version:'1'})]);expect(r.report.errors.some(e=>e.includes('요구 범위'))).toBe(true)})
 it('배포용 폐쇄는 실제 필수 의존성만 수집하고 선택 의존성은 켜지 않는다',()=>{const p=[core(),mod('a',{dependencies:[{id:'dep',version:'^1.0.0'}],optionalDependencies:['optional']}),mod('dep',{dependencies:['core']}),mod('optional')],before=structuredClone(p);expect(requiredModClosure(p,['a'])).toEqual(['a','dep','core']);expect(p).toEqual(before);expect(requiredModClosure(p,['missing'])).toEqual(['missing'])})
 it('배포용 순환 의존성 폐쇄는 멈추며 실제 로더가 순환을 보고한다',()=>{const p=[core(),mod('a',{dependencies:['b']}),mod('b',{dependencies:['a']})],selected=requiredModClosure(p,['a']);expect(selected).toEqual(['a','b']);expect(loadMods(p,selected).report.errors.some(e=>e.includes('순환'))).toBe(true)})
 it('범위 조회/정렬/검사는 원래 패키지와 선택 목록을 바꾸지 않는다',()=>{const p=[core(),mod('a',{dependencies:[{id:'dep',version:'^1.0.0'}],optionalDependencies:['missing']}),mod('dep')],before=structuredClone(p),selected=['a','dep'];load(p,selected);expect(p).toEqual(before);expect(selected).toEqual(['a','dep'])})
 it('배포된 실제 버전 예제는 선택 의존성 부재/활성 모두 검사하고 최종48시간 패치를 적용한다',()=>{const packages=readPackages(),alone=loadMods(packages,['sample-versioned']),together=loadMods(packages,['sample-versioned','sample-selector']);expect(alone.report.errors).toEqual([]);expect(alone.db.loadedMods).toEqual(['core','sample-versioned']);expect(together.report.errors).toEqual([]);expect(together.db.loadedMods).toEqual(['core','sample-selector','sample-versioned']);expect(together.db.event('Event.ReaverPatrol').director!.profiles.find(p=>p.key==='quiet')!.restHours).toBe(48)})
 it('기존 훅 API는 같은 범위 계산으로 모든 기존 판정을 유지한다',()=>{for(const range of['1.4.0','>=1.0.0 <2.0.0','^1.0.0','~1.4.0','1.0.0 || 1.4.0','^2.0.0','*','',3])expect(supportsHookApi(range)).toBe(versionInRange(range,HOOK_API_VERSION))})
})
