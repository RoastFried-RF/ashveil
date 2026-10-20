import {GAME_VERSION,DEF_SCHEMA_VERSION,loadMods,type ModPackage,type DefDatabase} from './defs'
import {canonicalContent,sha256} from './load-hash'
import {parseContentJson} from './content-json'
import type {LegacyResident} from './types'

export interface SeedShare {
 format:1;gameVersion:string;defSchemaVersion:number;seed:string;background?:string;characterRoll:0|1;storyteller?:string
 loadHash:string;mods:{id:string;version:string;hash:string}[];legacyResidents:LegacyResident[]
}
const PREFIX='ASHVEIL1.',MAX_CODE=512*1024,MAX_JSON=64*1024
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
function fail(message:string):never{throw Error('시드 공유: '+message)}
function fields(value:unknown,allowed:readonly string[]):asserts value is Record<string,unknown>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('지원하지 않는 필드 또는 객체 형식이다')}
function string(value:unknown,max:number):value is string{return typeof value==='string'&&value.length>0&&value.length<=max}
function validate(value:unknown):asserts value is SeedShare{
 fields(value,['format','gameVersion','defSchemaVersion','seed','background','characterRoll','storyteller','loadHash','mods','legacyResidents'])
 if(value.format!==1||!string(value.gameVersion,80)||!Number.isSafeInteger(value.defSchemaVersion)||!string(value.seed,2048)||![0,1].includes(value.characterRoll as number)||value.background!==undefined&&!string(value.background,256)||value.storyteller!==undefined&&!string(value.storyteller,128)||typeof value.loadHash!=='string'||!/^sha256-[0-9a-f]{64}$/.test(value.loadHash))fail('시드/버전/생성 선택/콘텐츠 해시 형식을 확인해야 한다')
 if(!Array.isArray(value.mods)||!value.mods.length||value.mods.length>512)fail('실제 모드 목록이 필요하다')
 const ids=new Set<string>()
 for(const mod of value.mods){fields(mod,['id','version','hash']);if(!string(mod.id,128)||!string(mod.version,80)||typeof mod.hash!=='string'||!/^sha256-[0-9a-f]{64}$/.test(mod.hash)||ids.has(mod.id))fail('모드 ID/버전/해시가 잘못되거나 겹친다');ids.add(mod.id)}
 if(value.mods[0].id!=='core')fail('원래 적용 순서의 첫 모드는 core여야 한다')
 if(!Array.isArray(value.legacyResidents)||value.legacyResidents.length>100)fail('은퇴 인물의 초기 기록 형식이 잘못되었다')
 const legacyKeys=new Set<string>()
 for(const row of value.legacyResidents){fields(row,['key','seed','site','name','age','tales']);if(!string(row.key,160)||row.seed!==value.seed||!string(row.site,256)||!string(row.name,80)||!Number.isSafeInteger(row.age)||(row.age as number)<10||(row.age as number)>120||!Array.isArray(row.tales)||!row.tales.length||row.tales.length>6||row.tales.some(text=>!string(text,600))||legacyKeys.has(row.key))fail('은퇴 인물의 초기 기록에 잘못된 값이 있다');legacyKeys.add(row.key)}
}
export function makeSeedShare(db:DefDatabase,options:{seed:string;background?:string;characterRoll:0|1;storyteller?:string;legacyResidents?:readonly LegacyResident[]}):SeedShare{
 const mods=db.modManifest();if(!mods)fail('실제 패키지 내용 기록이 필요하다')
 const value:SeedShare={format:1,gameVersion:GAME_VERSION,defSchemaVersion:DEF_SCHEMA_VERSION,seed:options.seed,...(options.background?{background:options.background}:{}),characterRoll:options.characterRoll,...(options.storyteller?{storyteller:options.storyteller}:{}),loadHash:db.loadHash,mods,legacyResidents:(options.legacyResidents??[]).map(({key,seed,site,name,age,tales})=>({key,seed,site,name,age,tales:[...tales]}))}
 validate(value);return value
}
export function encodeSeedShare(value:SeedShare):string{
 validate(value);const json=canonicalContent(value);if(json.length>MAX_JSON)fail('공유할 초기 기록이 너무 크다')
 let encoded:string;try{encoded=encodeURIComponent(json)}catch{fail('시드나 초기 기록에 잘못된 유니코드가 있다')}
 const code=PREFIX+encoded+'.'+sha256(json);if(code.length>MAX_CODE)fail('공유 문자열이 너무 크다');return code
}
export function decodeSeedShare(input:string):SeedShare{
 if(typeof input!=='string'||input.length>MAX_CODE)fail('공유 문자열 크기 제한을 넘었다')
 const code=input.trim();if(!code.startsWith(PREFIX))fail('ASHVEIL1 공유 문자열이 필요하다')
 const separator=code.lastIndexOf('.');if(separator<PREFIX.length)fail('공유 문자열 체크섬이 없다')
 let json:string;try{json=decodeURIComponent(code.slice(PREFIX.length,separator))}catch{fail('공유 문자열 인코딩이 손상되었다')}
 if(json.length>MAX_JSON||sha256(json)!==code.slice(separator+1))fail('공유 문자열이 손상되었거나 체크섬이 다르다')
 const value=parseContentJson(json,'시드 공유');validate(value);return value
}
/** 현재 설치된 원문/버전/순서를 실제 로더로 비교하며, 다른 콘텐츠로 대신 시작하지 않는다. */
export function reviewSeedShare(code:string,packages:ModPackage[]){
 const shared=decodeSeedShare(code),{db,report}=loadMods(packages,shared.mods.map(mod=>mod.id)),errors=[...report.errors]
 if(shared.gameVersion!==GAME_VERSION)errors.push('기록된 게임 '+shared.gameVersion+'과 현재 '+GAME_VERSION+' 버전이 다르다')
 if(shared.defSchemaVersion!==DEF_SCHEMA_VERSION)errors.push('기록된 정의 계약과 현재 계약이 다르다')
 const actual=db.modManifest()??[]
 for(const[at,mod]of shared.mods.entries()){const current=actual.find(row=>row.id===mod.id);if(!current)errors.push('설치되지 않은 공유 모드: '+mod.id);else if(current.version!==mod.version||current.hash!==mod.hash)errors.push(mod.id+': 공유한 버전/원문 내용과 현재 파일이 다르다');if(actual[at]?.id!==mod.id)errors.push('공유한 모드 적용 순서가 현재 로더 결과와 다르다')}
 if(actual.length!==shared.mods.length||db.loadHash!==shared.loadHash)errors.push('공유한 전체 콘텐츠 해시와 현재 구성이 다르다')
 if(shared.background&&db.tryGet(shared.background)?.defType!=='Background')errors.push('공유한 배경을 사용할 수 없다')
 if(shared.storyteller&&!db.tryGet<import('./types').PlaceEventDef>('Event.ReaverPatrol')?.director?.profiles.some(profile=>profile.key===shared.storyteller))errors.push('공유한 사건 흐름을 사용할 수 없다')
 return{shared,db,errors,warnings:[...report.warnings],canApply:errors.length===0}
}
