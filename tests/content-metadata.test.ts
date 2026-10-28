import{describe,it,expect}from'vitest'
import{createHash}from'node:crypto'
import{readPackages}from'../tools/loadContent'
import{loadMods,DefDatabase,GAME_VERSION,DEF_SCHEMA_VERSION}from'../src/core/defs'
import{canonicalContent}from'../src/core/load-hash'
import{newGame,SAVE_VERSION}from'../src/core/game'
import{serialize,deserialize}from'../src/core/save'
import{contentChangeReview}from'../src/core/content-compatibility'
import packageInfo from'../package.json'
const packages=readPackages(),{db}=loadMods(packages,[])
describe('실제 게임/계약/개별 모드 내용의 저장 헤더',()=>{
 it('실제 현재 게임 버전과 첫 구현 계약/현재 개별 모드를 새 게임에 기록한다',()=>{const s=newGame(db,{seed:'actual-per-mod-content'});expect(s.version).toBe(SAVE_VERSION);expect(s.gameVersion).toBe(packageInfo.version);expect(s.gameVersion).toBe(GAME_VERSION);expect(s.defSchemaVersion).toBe(DEF_SCHEMA_VERSION);expect(s.contentMods).toEqual(db.modManifest());expect(s.contentMods!.map(m=>m.id)).toEqual(db.loadedMods)})
 it('모드마다 실제 원문 전체의 정규화 해시를 독립 Node SHA로 확인한다',()=>{const loaded=loadMods(packages,['sample-versioned','sample-selector']);for(const row of loaded.db.modManifest()!){const pkg=packages.find(p=>p.manifest.id===row.id)!;expect(row.version).toBe(pkg.manifest.version);expect(row.hash).toBe('sha256-'+createHash('sha256').update(canonicalContent(pkg)).digest('hex'))}expect(loaded.db.modManifest()!.map(m=>m.id)).toEqual(['core','sample-selector','sample-versioned'])})
 it('소유 사본 변경은 실제 DB/다른 저장의 버전과 해시를 바꾸지 않는다',()=>{const a=db.modManifest()!,before=db.modManifest();a[0]!.version='fake';a.pop();expect(db.modManifest()).toEqual(before);const s=newGame(db,{seed:'owned-mod-metadata'});s.contentMods![0]!.hash='fake';expect(db.modManifest()).toEqual(before);expect(Reflect.set(db,'packageRecords',[])).toBe(false)})
 it('원문 없는 수동 DB에 패키지 버전/해시를 지어내지 않는다',()=>{const custom=new DefDatabase([],['core']);expect(custom.modManifest()).toBeUndefined()})
 it('구형180 마이그레이션은 없던 과거 헤더를 만들지 않는다',()=>{const raw=JSON.parse(serialize(newGame(db,{seed:'metadata-legacy180'})));raw.version=180;delete raw.gameVersion;delete raw.defSchemaVersion;delete raw.contentMods;const loaded=deserialize(JSON.stringify(raw));expect(loaded.version).toBe(SAVE_VERSION);expect(loaded).not.toHaveProperty('gameVersion');expect(loaded).not.toHaveProperty('defSchemaVersion');expect(loaded).not.toHaveProperty('contentMods')})
 it('정상 새 헤더는 전체 저장/복원에서 유지된다',()=>{const s=newGame(db,{seed:'metadata-roundtrip',overworld:true}),raw=serialize(s);expect(serialize(deserialize(raw))).toBe(raw)})
 it.each([null,[],[{id:'core',version:'1',hash:'bad'}],[{id:'core',version:'',hash:'sha256-'+'0'.repeat(64)}]])('잘못된 개별 내용 기록은 읽기 전에 거절한다 (%j)',value=>{const raw=JSON.parse(serialize(newGame(db,{seed:'bad-mod-record'})));raw.contentMods=value;expect(()=>deserialize(JSON.stringify(raw))).toThrow('개별 모드 내용 기록')})
 it('중복 모드 ID 기록을 거절한다',()=>{const raw=JSON.parse(serialize(newGame(db,{seed:'duplicate-mod-record'})));raw.contentMods.push(raw.contentMods[0]);expect(()=>deserialize(JSON.stringify(raw))).toThrow('개별 모드 내용 기록')})
 it('같은 전체 해시와 맞지 않는 개별 기록은 덮어쓰지 않고 오류로 보고한다',()=>{const s=newGame(db,{seed:'inconsistent-mod-record'});s.contentMods![0]!.version='other';const before=serialize(s);expect(contentChangeReview(s,db).recoveryErrors.join('\n')).toContain('개별 모드 내용 기록');expect(serialize(s)).toBe(before)})
 it('실제 값 변경의 모드 ID/이전·현재 버전/내용 해시를 정확히 보고한다',()=>{const p=structuredClone(packages),core=p.find(p=>p.manifest.id==='core')!;core.manifest.version='0.0.9';core.patches.push({op:'replace',target:'Terrain.KtFloor',path:'/label',value:'옛 바닥'});const old=loadMods(p,[]).db,s=newGame(old,{seed:'changed-mod-detail'}),review=contentChangeReview(s,db);expect(review.canContinue).toBe(true);expect(review.changedMods).toEqual([{id:'core',fromVersion:'0.0.9',toVersion:'0.1.0',fromHash:old.modManifest()![0]!.hash,toHash:db.modManifest()![0]!.hash}])})
 it('지원하지 않는 저장 계약은 현재와 같은 콘텐츠여도 자동 진입하지 않는다',()=>{const s=newGame(db,{seed:'future-schema-header'});s.defSchemaVersion=DEF_SCHEMA_VERSION+1;expect(contentChangeReview(s,db).recoveryErrors.join('\n')).toContain('정의 스키마 버전')})
 it('명시된 현재 계약만 로드하고 미래 계약/옛 계약을 추정 변환하지 않는다',()=>{for(const version of[0,DEF_SCHEMA_VERSION+1,'1']){const p=structuredClone(packages);p.find(p=>p.manifest.id==='core')!.manifest.defSchemaVersion=version as number;expect(loadMods(p,[]).report.errors.some(e=>e.includes('defSchemaVersion'))).toBe(true)}const p=structuredClone(packages);p.find(p=>p.manifest.id==='core')!.manifest.defSchemaVersion=DEF_SCHEMA_VERSION;expect(loadMods(p,[]).report.errors).toEqual([])})
})
