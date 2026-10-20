import{describe,it,expect}from'vitest'
import{contentCompatibility}from'../src/core/content-compatibility'
import{loadMods}from'../src/core/defs'
import{readPackages}from'../tools/loadContent'
import{newGame,playerAct,runUntilInput,SAVE_VERSION}from'../src/core/game'
import{serialize,deserialize}from'../src/core/save'
const packages=readPackages(),{db}=loadMods(packages,[])
describe('각인의 실제 콘텐츠 구성 식별',()=>{
 it('새 게임은 실제 로드된 불변 구성의 해시와 현재 버전을 기록한다',()=>{const s=newGame(db,{seed:'content-header'});expect(s.version).toBe(SAVE_VERSION);expect(s.loadHash).toBe(db.loadHash);expect(contentCompatibility(s,db).status).toBe('same')})
 it('같은 실제 구성을 따로 로드해도 동일한 각인으로 판정한다',()=>{const s=newGame(db,{seed:'same-content'});expect(contentCompatibility(s,loadMods(packages,[]).db)).toEqual({status:'same',recorded:db.loadHash,current:db.loadHash})})
 it('구성 변경은 원래 기록과 현재 구성을 구분하고 상태를 바꾸지 않는다',()=>{const s=newGame(db,{seed:'changed-content'}),before=serialize(s),other=loadMods(packages,['sample.grim']).db;expect(contentCompatibility(s,other)).toEqual({status:'changed',recorded:db.loadHash,current:other.loadHash});expect(serialize(s)).toBe(before)})
 it('기록이 없는 구형 각인은 현재 구성을 과거 해시로 채우지 않는다',()=>{const raw=JSON.parse(serialize(newGame(db,{seed:'legacy-content'})));raw.version=177;delete raw.loadHash;delete raw.contentDefinitions;const migrated=deserialize(JSON.stringify(raw));expect(migrated.version).toBe(SAVE_VERSION);expect(migrated).not.toHaveProperty('loadHash');expect(contentCompatibility(migrated,db).status).toBe('unknown');const expected={...raw,version:SAVE_VERSION};expect(JSON.parse(serialize(migrated))).toEqual(expected)})
 it('알려진 해시는 전체 저장·복원과 실제 행동 뒤에도 보존된다',()=>{const s=newGame(db,{seed:'recorded-content'}),before=serialize(s),restored=deserialize(before);expect(serialize(restored)).toBe(before);expect(playerAct({db,s:restored},{type:'wait'})).toBeNull();expect(restored.loadHash).toBe(db.loadHash)})
 it('실제 미완료 행동의 재개는 같은 구성에서 전체 상태까지 한 번만 일치한다',()=>{const s=newGame(db,{seed:'pending-content-header'}),w={db,s};expect(playerAct(w,{type:'rest',turns:20},1)).toBeNull();expect(s.simulationPending).toBe(true);const restored={db,s:deserialize(serialize(s))};runUntilInput(w);runUntilInput(restored);expect(serialize(restored.s)).toBe(serialize(w.s));expect(restored.s.loadHash).toBe(db.loadHash);const before=serialize(restored.s);runUntilInput(restored);expect(serialize(restored.s)).toBe(before)})
 it.each(['','sha256-x','sha256-'+'A'.repeat(64),'sha256-'+'a'.repeat(63),null,123])('기록된 잘못된 해시 형식은 조용히 구형으로 취급하지 않는다 (%j)',value=>{const raw=JSON.parse(serialize(newGame(db,{seed:'invalid-content-header'})));raw.loadHash=value;expect(()=>deserialize(JSON.stringify(raw))).toThrow('콘텐츠 로드 해시 형식')})
 it('구형177이 명시적으로 유효한 해시를 포함하면 그 기록은 그대로 보존한다',()=>{const raw=JSON.parse(serialize(newGame(db,{seed:'old-valid-header'})));raw.version=177;const restored=deserialize(JSON.stringify(raw));expect(restored.loadHash).toBe(db.loadHash);expect(restored.version).toBe(SAVE_VERSION)})
})
