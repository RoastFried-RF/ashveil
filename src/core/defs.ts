import{GAME_VERSION,DEF_SCHEMA_VERSION}from'./content-version'
import {resolveDefinitionRenames}from'./definition-renames'
import {contentLoadHash,freezeDefinition} from './load-hash'
import {definitionSchemaIssues} from './definition-schema'
import {parseContentJson} from './content-json'
import {checkedModTextures,isModTexturePath} from './mod-textures'
import {originTree,originFields,type DefinitionOriginTree,type DefinitionFieldSource,type DefinitionFieldOrigin} from './definition-provenance'
import {HOOK_API_VERSION,supportsHookApi,versionInRange,validVersionRange} from './script-api'
import {hashString} from './rng'
import {SCRIPT_SOURCE_LIMIT,scriptBytes,type ScriptHost,type ScriptModule,type ScriptSource} from './script-contracts'
// Def 로더: 모드 정렬 → Def 수집 → 패치 → 상속 해석 → 검증
// 엔진 독립: 입력은 순수 JSON 객체, 파일 시스템/번들러에 의존하지 않음.

import type {
  PostureDef, ManeuverDef, ResidentCultivationDef, NpcCareDef, ExcavationContractDef, EscortContractDef, NpcIdentityDef, NpcSocialReportDef, NpcSocialDef, PatrolContractDef, PrisonerExchangeDef, RansomDef, NpcAbductionDef, RescueRemainsDef, RescueContractDef, RecoveryContractDef, SourceContractDef, CartographyDef, InteractionDef, NpcPsycheDef, FatigueDef, AbilityDef, AnyDef, BodyDef, CreatureDef, DefBase, EventDef, ItemDef, LootTableDef, PillEffectDef,
  SkillDef, TerrainDef, ThoughtDef, TraitDef, BackgroundDef, WoundDef, DiseaseDef, BreakDef, RecipeDef, MaterialDef, TraumaDef, GrowthDef, RecoveryDef, SurgeryDef, ProcedureDef, NutritionDef, FoodSafetyDef, WaterSafetyDef, ProstheticDef, WorldGenDef, BiomeDef, RegionSiteDef, SeasonDef, WeatherDef, ClimateDef, FactionDef, DiplomacyDef, EconomyDef, TraderStockDef, WorldSimulationDef, DrugDef, PharmacologyDef, KnowledgeDef, BestiaryDef, BestiaryEntryDef, ClinicDef, InnDef, HandHygieneDef, NpcRestDef, ResidentProvisionDef, ResidentWaterDef, ResidentPurificationDef, TeacherDef, ResidentWarmthDef, BeddingMoveDef, SupplyContractDef, BountyContractDef, InvestigationDef, FactionRelationsDef, ColdConfusionDef, CompanionDef, CompanionBondDef, PrisonerDef, PrisonerCareDef, PrisonerEscortDef, RecruitmentDef, RescueDef, NpcCustodyDef, BaseCampDef, BaseDefenseDef, BaseLogisticsDef, BaseWaterDef, BaseRestDef, CampfireDef, BeddingContactDef, GearWeatherDef, MaterialCraftingDef, RegionLayoutDef, KinshipDef, FieldDeviceDef, EvidenceDef, RetirementDef,
} from './types'

export{GAME_VERSION,DEF_SCHEMA_VERSION}from'./content-version'
export type ModDependency=string|{id:string;version?:string}
export function validModDependency(value:unknown):value is ModDependency{return typeof value==='string'?!!value.trim():isObj(value)&&typeof value.id==='string'&&!!value.id.trim()&&(value.version===undefined||validVersionRange(value.version))}
export function readModDependencies(value:unknown):{id:string;version?:string}[]{return Array.isArray(value)?value.filter(validModDependency).map(dep=>typeof dep==='string'?{id:dep}:{...dep}):[]}
/** 배포 검증용 필수 의존성 폐쇄. 실제 게임 선택을 자동 변경하는 데 쓰지 않는다. */
export function requiredModClosure(packages:readonly ModPackage[],selected:readonly string[]):string[]{
 const result:string[]=[],seen=new Set<string>(),byId=new Map(packages.map(pkg=>[pkg.manifest.id,pkg]))
 const visit=(id:string)=>{if(seen.has(id))return;seen.add(id);result.push(id);for(const dep of readModDependencies(byId.get(id)?.manifest.dependencies))visit(dep.id)}
 for(const id of selected)visit(id);return result
}
export interface ModManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  scripts?:{stage:0|1|2;entry?:string;api?:string}
  dependencies?: ModDependency[]
  optionalDependencies?: ModDependency[]
  gameVersion?:string
  defSchemaVersion?:number
  loadAfter?: string[]
  loadBefore?: string[]
  incompatibleWith?: string[]
}

export interface PatchOp {
  op: 'add' | 'replace' | 'remove' | 'merge'
  target: string
  path: string
  value?: unknown
  ifModLoaded?: string
  ifModNotLoaded?: string
  ifDefExists?: string
  position?: 'before' | 'after'
}

export interface ModPackage {
  manifest: ModManifest
  defs: DefBase[]
  patches: PatchOp[]
  scripts?:{file:string;source:string}[]
  renames?:Record<string,string>
  /** textures/ 아래16×16 정적 PNG. 정규 base64 원문을 콘텐츠 해시에 포함한다. */
  textures?:Record<string,string>
}

/** 개발 도구에서만 요청하는 읽기 전용 로드 결과. 게임 각인/모드 해시에 넣지 않는다. */
export interface DefinitionSource {modId:string;file?:string;entry:number}
export interface DefinitionPatchSource extends DefinitionSource {operation:PatchOp}
export interface DefinitionPatchAudit extends DefinitionPatchSource {status:'applied'|'skipped'|'failed';reason?:string;before?:Record<string,unknown>;after?:Record<string,unknown>}
export interface DefinitionSnapshot {raw:Record<string,Record<string,unknown>>;resolved:Record<string,Record<string,unknown>>;sources:Record<string,DefinitionSource>;patches:DefinitionPatchSource[];fields?:Record<string,DefinitionFieldOrigin[]>;audit?:DefinitionPatchAudit[]}
export interface DefinitionLoadOptions {audit?:boolean;provenance?:boolean;capture?:(snapshot:DefinitionSnapshot)=>void}
const packageErrors=new WeakMap<ModPackage,string[]>()
const packageLocations=new WeakMap<ModPackage,{defs:{file:string;entry:number}[];patches:{file:string;entry:number}[]}>()

export interface LoadReport {
  order: string[]
  errors: string[]
  warnings: string[]
  patched: number
}

/** 경로 → JSON 맵에서 모드 패키지 구성. 경로 예: <root>/<modId>/manifest.json, <root>/<modId>/defs/x.json */
export function packagesFromFiles(files: Record<string, unknown>): ModPackage[] {
  const byMod = new Map<string, ModPackage>()
  const get = (mod: string) => {
    let p = byMod.get(mod)
    if (!p) {
      p = { manifest: { id: mod, name: mod, version: '0.0.0' }, defs: [], patches: [] }
      byMod.set(mod, p)
      packageLocations.set(p,{defs:[],patches:[]});packageErrors.set(p,[])
    }
    return p
  }
  for (const [path, input] of Object.entries(files).sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    const norm = path.replace(/\\/g, '/')
    const m = norm.match(/([^/]+)\/(manifest\.json|defs\/.+\.json|patches\/.+\.json|scripts\/.+\.js|migrations\/rename\.json|textures\/.+\.png)$/)
    if (!m) continue
    const [, folder, rest] = m
    const pkg = get(folder)
    try{
      if(rest.startsWith('textures/')){
        if(!isModTexturePath(rest)||typeof input!=='string')throw Error('텍스처는 안전한 PNG 경로와 base64 원문이어야 한다')
        ;(pkg.textures??={})[rest]=input;continue
      }
      if(rest.startsWith('scripts/')){
        if(typeof input!=='string')throw Error('스크립트 원문은 문자열이어야 한다')
        ;(pkg.scripts??=[]).push({file:rest,source:input});continue
      }
      const json=typeof input==='string'?parseContentJson(input,path):input
      if(rest==='manifest.json'){
        if(!isObj(json)||typeof json.id!=='string'||!json.id.trim())throw Error('manifest에는 문자열 id가 필요하다')
        pkg.manifest=json as unknown as ModManifest
      }else if(rest==='migrations/rename.json'){
        if(!isObj(json)||Object.entries(json).some(([id,target])=>!id.trim()||typeof target!=='string'||!target.trim()))throw Error('rename은 원래 ID에서 새 ID로 가는 문자열 사전이어야 한다')
        pkg.renames=json as Record<string,string>
      }else{
        if(!Array.isArray(json)||json.some(row=>!isObj(row)))throw Error('Def/패치 파일은 객체의 JSON 배열이어야 한다')
        if(rest.startsWith('defs/')){pkg.defs.push(...json as DefBase[]);packageLocations.get(pkg)!.defs.push(...json.map((_,entry)=>({file:rest,entry})))}
        else{pkg.patches.push(...json as PatchOp[]);packageLocations.get(pkg)!.patches.push(...json.map((_,entry)=>({file:rest,entry})))}
      }
    }catch(error){const message=(error as Error).message;packageErrors.get(pkg)!.push(message.startsWith(path+':')?message:path+': '+message)}
  }
  // 폴더명 대신 manifest.id 로 정규화
  return [...byMod.values()].map(p=>{const out={...p};packageLocations.set(out,packageLocations.get(p)!);packageErrors.set(out,packageErrors.get(p)!);return out})
}

function topoSort(pkgs: ModPackage[], report: LoadReport,priority:readonly string[]=[]): ModPackage[] {
  const byId=new Map(pkgs.map(p=>[p.manifest.id,p])),edges=new Map([...byId.keys()].map(id=>[id,new Set<string>()])),degree=new Map([...byId.keys()].map(id=>[id,0])),rank=new Map<string,number>()
  for(const id of priority)if(!rank.has(id))rank.set(id,rank.size)
  const compare=(a:string,b:string)=>a===b?0:a==='core'?-1:b==='core'?1:(rank.get(a)??Infinity)-(rank.get(b)??Infinity)||(a<b?-1:a>b?1:0)
  const add=(from:string,to:string)=>{if(!byId.has(from)||!byId.has(to)||edges.get(from)!.has(to))return;edges.get(from)!.add(to);degree.set(to,degree.get(to)!+1)}
  const list=(value:unknown):string[]=>Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'):[]
  for(const p of pkgs){
    const id=p.manifest.id
    if(id!=='core')add('core',id)
    if(p.manifest.defSchemaVersion!==undefined&&p.manifest.defSchemaVersion!==DEF_SCHEMA_VERSION)report.errors.push(`${id}: 선언한 defSchemaVersion ${p.manifest.defSchemaVersion}은 현재 구현 계약 ${DEF_SCHEMA_VERSION}에서 지원하지 않는다`)
    if(p.manifest.gameVersion!==undefined&&!versionInRange(p.manifest.gameVersion,GAME_VERSION))report.errors.push(`${id}: gameVersion '${p.manifest.gameVersion}' 범위가 현재 게임 ${GAME_VERSION}과 맞지 않다`)
    for(const [deps,optional]of [[p.manifest.dependencies,false],[p.manifest.optionalDependencies,true]]as const)for(const dep of readModDependencies(deps)){
      const target=byId.get(dep.id)
      if(!target){if(!optional)report.errors.push(`${id}: 필수 의존 모드 없음 '${dep.id}'`);continue}
      add(dep.id,id)
      if(dep.version!==undefined&&!versionInRange(dep.version,target.manifest.version))report.errors.push(`${id}: ${optional?'선택':'필수'} 의존 모드 '${dep.id}' 버전 ${target.manifest.version}은 요구 범위 '${dep.version}'와 맞지 않다`)
    }
    for(const after of list(p.manifest.loadAfter))add(after,id)
    for(const before of list(p.manifest.loadBefore))add(id,before)
    for(const inc of list(p.manifest.incompatibleWith))if(byId.has(inc))report.errors.push(`${id} 와 ${inc} 는 호환되지 않음`)
  }
  const out:ModPackage[]=[],ready=[...degree].filter(([,n])=>n===0).map(([id])=>id).sort(compare)
  while(ready.length){const id=ready.shift()!;out.push(byId.get(id)!);for(const next of [...edges.get(id)!].sort(compare)){const n=degree.get(next)!-1;degree.set(next,n);if(n===0){ready.push(next);ready.sort(compare)}}}
  if(out.length!==byId.size){
    const remaining=new Set([...degree].filter(([,n])=>n>0).map(([id])=>id)),seen=new Set<string>(),active=new Set<string>();let cycle:string[]|undefined
    const visit=(id:string,path:string[])=>{if(cycle)return;if(active.has(id)){cycle=[...path.slice(path.indexOf(id)),id];return}if(seen.has(id))return;seen.add(id);active.add(id);for(const next of [...edges.get(id)!].filter(n=>remaining.has(n)).sort(compare))visit(next,[...path,id]);active.delete(id)}
    for(const id of [...remaining].sort(compare))visit(id,[])
    report.errors.push('순환 의존성: '+(cycle??[...remaining].sort(compare)).join(' → '))
    // 오류 DB도 나머지 정의 검증에 사용한다. 실행은 report.errors에 의해 차단한다.
    for(const id of [...remaining].sort(compare))out.push(byId.get(id)!)
  }
  return out
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function sameJson(a:unknown,b:unknown):boolean{
  if(a===b)return true
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>sameJson(v,b[i]))
  if(isObj(a)&&isObj(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameJson(a[k],b[k]))}
  return false
}

interface MergeOrigin {base?:DefinitionOriginTree;over:DefinitionOriginTree;result?:DefinitionOriginTree}
function deepMerge(base: unknown, over: unknown,trace?:MergeOrigin): unknown {
  if(isObj(over)&&['$append','$prepend','$remove'].some(k=>Object.hasOwn(over,k))){
    if(base!==undefined&&!Array.isArray(base))throw new Error('배열 병합 지시에는 원래 배열이 필요하다')
    if(Object.keys(over).some(k=>!['$append','$prepend','$remove'].includes(k)))throw new Error('배열 병합 지시와 다른 필드를 섞을 수 없다')
    for(const value of Object.values(over))if(!Array.isArray(value))throw new Error('$append/$prepend/$remove 값은 배열이어야 한다')
    const remove=(over.$remove??[])as unknown[],kept=((base??[])as unknown[]).filter(entry=>!remove.some(value=>isObj(value)&&Object.keys(value).length===1&&Object.hasOwn(value,'id')&&isObj(entry)?entry.id===value.id:sameJson(entry,value)))
    if(trace){
      const original=(base??[])as unknown[],keepIndices=original.flatMap((entry,i)=>remove.some(value=>isObj(value)&&Object.keys(value).length===1&&Object.hasOwn(value,'id')&&isObj(entry)?entry.id===value.id:sameJson(entry,value))?[]:[i])
      const prepend=Object.values(trace.over.children?.$prepend?.children??{}),append=Object.values(trace.over.children?.$append?.children??{})
      const children=[...prepend,...keepIndices.map(i=>trace.base?.children?.[i]),...append]
      if(children.some(child=>!child))throw Error('배열 병합 출처 누락')
      trace.result={source:trace.over.source,children:Object.fromEntries(children.map((child,i)=>[i,child!]))}
    }
    return clone([...(over.$prepend??[])as unknown[],...kept,...(over.$append??[])as unknown[]])
  }
  if (isObj(over)) {
    if(Object.hasOwn(over,'$inherit')&&over.$inherit!==false)throw new Error('$inherit는 false만 허용한다')
    const out: Record<string, unknown> = isObj(base)&&over.$inherit!==false?{ ...base }:{}
    const origins=trace?{source:trace.over.source,children:{...(isObj(base)&&over.$inherit!==false?trace.base?.children:{})}}:undefined
    for (const [k, v] of Object.entries(over)){
      if(k==='$inherit')continue
      if(['__proto__','prototype','constructor'].includes(k))throw new Error('허용하지 않는 병합 키: '+k)
      if(v===null){delete out[k];if(origins)delete origins.children[k]}
      else{
        const child:MergeOrigin|undefined=trace?{base:origins!.children[k],over:trace.over.children![k]}:undefined
        out[k]=deepMerge(Object.hasOwn(out,k)?out[k]:undefined,v,child)
        if(origins&&child)origins.children[k]=child.result!
      }
    }
    if(trace)trace.result=origins
    return out
  }
  if(trace)trace.result=trace.over
  return clone(over)
}

function parsePath(path: string): string[] {
  if (path === '') return []
  return path.replace(/^\//, '').split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
}

function arrayIndex(array:unknown[],key:string,path:string):number|string{
  const selector=key.match(/^\[([^=[\]]+)=([^\]]*)\]$/)
  if(selector){
    const field=selector[1],raw=selector[2]
    let value:unknown=raw
    try{value=JSON.parse(raw)}catch{/* 인용되지 않은 문자열 키도 허용한다. */}
    const found=array.flatMap((entry,i)=>isObj(entry)&&Object.hasOwn(entry,field)&&(entry[field]===value||entry[field]===raw)?[i]:[])
    if(found.length!==1)return `배열 선택자 ${found.length?'중복':'대상 없음'}: ${path}`
    return found[0]
  }
  if(!/^(0|[1-9][0-9]*)$/.test(key))return `배열 인덱스 오류: ${path}`
  const index=Number(key)
  return Number.isSafeInteger(index)?index:`배열 인덱스 오류: ${path}`
}

interface PatchOrigin {tree:DefinitionOriginTree;source:DefinitionFieldSource}
function applyPatchDraft(def: Record<string, unknown>, op: PatchOp,trace?:PatchOrigin): string | null {
  if(typeof op.path!=='string'||op.path!==''&&!op.path.startsWith('/')||/~(?![01])/.test(op.path))return `JSON Pointer 경로 오류: ${String(op.path)}`
  if(!['add','replace','remove','merge'].includes(op.op))return `알 수 없는 패치 연산: ${String(op.op)}`
  if(op.op!=='remove'&&op.value===undefined)return `패치 value 필요: ${op.path}`
  const keys = parsePath(op.path)
  if(op.position!==undefined&&(op.op!=='add'||!keys.at(-1)?.startsWith('[')))return `position은 선택자 add에만 가능: ${op.path}`
  if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))return `허용하지 않는 경로: ${op.path}`
  if (keys.length === 0) {
    if (op.op === 'merge' && isObj(op.value)) {
      const merge:MergeOrigin|undefined=trace?{base:trace.tree,over:originTree(op.value,trace.source)}:undefined
      Object.assign(def, deepMerge(def, op.value,merge))
      if(trace&&merge)trace.tree={source:merge.result!.source,children:{...trace.tree.children,...merge.result!.children}}
      return null
    }
    return '루트 경로에는 merge 만 가능'
  }
  let cur: unknown = def
  let origin=trace?.tree
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (Array.isArray(cur)) {const index=arrayIndex(cur,k,op.path);if(typeof index==='string')return index;cur=cur[index];origin=origin?.children?.[index]}
    else if (isObj(cur)) {
      if (!Object.hasOwn(cur,k) && (op.op === 'add' || op.op === 'merge')) {
        cur[k] = {}
        if(origin&&trace)(origin.children??={})[k]=originTree({},{...trace.source,sourcePath:'/path'})
      }
      cur = Object.hasOwn(cur,k)?cur[k]:undefined
      origin=origin?.children?.[k]
    } else return `경로 없음: ${op.path}`
    if (cur === undefined) return `경로 없음: ${op.path}`
  }
  const last = keys[keys.length - 1]
  if (Array.isArray(cur)) {
    if(last==='-'&&op.op!=='add')return `배열 끝 표시는 add에만 가능: ${op.path}`
    let idx = last === '-' ? cur.length : arrayIndex(cur,last,op.path)
    if(typeof idx==='string')return idx
    if(last.startsWith('[')&&op.op==='add'){
      if(!['before','after'].includes(op.position??''))return `선택자 삽입은 position before/after 필요: ${op.path}`
      if(op.position==='after')idx++
    }else if(op.position!==undefined)return `position은 선택자 add에만 가능: ${op.path}`
    if(idx>cur.length||op.op!=='add'&&idx>=cur.length)return `인덱스 범위 밖: ${op.path}`
    const origins=origin?Object.values(origin.children??{}):undefined
    const added=trace?originTree(op.value,trace.source):undefined
    const commitOrigins=()=>{if(origin&&origins)origin.children=Object.fromEntries(origins.map((child,i)=>[i,child]))}
    switch (op.op) {
      case 'add': cur.splice(idx, 0, clone(op.value)); if(origins){origins.splice(idx,0,added!);commitOrigins()} return null
      case 'replace': if (idx >= cur.length) return `인덱스 범위 밖: ${op.path}`; cur[idx] = clone(op.value);if(origins){origins[idx]=added!;commitOrigins()} return null
      case 'remove': if (idx >= cur.length) return `인덱스 범위 밖: ${op.path}`; cur.splice(idx, 1);if(origins){origins.splice(idx,1);commitOrigins()} return null
      case 'merge': {
        const merge:MergeOrigin|undefined=origins?{base:origins[idx],over:added!}:undefined
        cur[idx] = deepMerge(cur[idx], op.value,merge)
        if(origins&&merge){origins[idx]=merge.result!;commitOrigins()}
        return null
      }
    }
  }
  if (!isObj(cur)) return `경로 없음: ${op.path}`
  if(op.position!==undefined)return `position은 배열 선택자 add에만 가능: ${op.path}`
  switch (op.op) {
    case 'add':
    case 'replace':
      if (op.op === 'replace' && !(last in cur)) return `replace 대상 없음: ${op.path}`
      cur[last] = clone(op.value)
      if(origin&&trace)(origin.children??={})[last]=originTree(op.value,trace.source)
      return null
    case 'remove':
      if (!(last in cur)) return `remove 대상 없음: ${op.path}`
      delete cur[last]
      if(origin?.children)delete origin.children[last]
      return null
    case 'merge':
      if(op.value===null){delete cur[last];if(origin?.children)delete origin.children[last]}
      else {
        const merge:MergeOrigin|undefined=origin&&trace?{base:origin.children?.[last],over:originTree(op.value,trace.source)}:undefined
        cur[last] = deepMerge(Object.hasOwn(cur,last)?cur[last]:undefined,op.value,merge)
        if(origin&&merge)(origin.children??={})[last]=merge.result!
      }
      return null
  }
}

/** 실패한 패치가 새 중간 객체나 배열 변경을 남기지 않도록 성공한 사본만 반영한다. */
export function applyPatch(def:Record<string,unknown>,op:PatchOp,trace?:PatchOrigin):string|null{
  try{
    const draft=clone(def),draftOrigin=trace?structuredClone(trace):undefined,error=applyPatchDraft(draft,op,draftOrigin)
    if(error)return error
    for(const key of Object.keys(def))delete def[key]
    Object.assign(def,draft)
    if(trace&&draftOrigin)trace.tree=draftOrigin.tree
    return null
  }catch(error){return `패치 데이터 오류: ${(error as Error).message}`}
}

// defType 별 필수 필드
const REQUIRED: Record<string, string[]> = {
  Cartography:['label','noteReliability','noteError'],
  Interaction:['label','category','event','formula'],
  NpcPsyche:['label','thoughtScale','acuteMult','historyLimit','events'],
  Body: ['bloodMl', 'parts'],
  Wound: ['label', 'bleedPerSeverity', 'painPerSeverity', 'contamination', 'healPerDay'],
  Item: ['label', 'sprite', 'category', 'weight'],
  Creature: ['label', 'body', 'faction', 'moveTU', 'stats', 'skills', 'ai', 'morale', 'lightThreshold', 'sightRange'],
  Terrain: ['label', 'sprites', 'passable', 'opaque', 'moveMult'],
  LootTable: ['rolls', 'entries'],
  Trait: ['label', 'description'],
  Background: ['label', 'description', 'startItems'],
  Thought: ['label', 'mood', 'durationTurns'],
  Fatigue: ['label','debtAbove','stages'],
  Season: ['label', 'order', 'lengthDays', 'sunrise', 'sunset', 'phaseDay', 'phase'],
  Weather: ['label', 'weather', 'group', 'selectionWeight', 'temperature', 'diurnalMult', 'daylightBonus', 'nightLight', 'precipitation', 'wetPerTen', 'noise', 'scentMult', 'sightFlat', 'sightMult', 'windBonus', 'corrosionMult'],
  Climate: ['startDay', 'amplitude', 'veilAmplitude', 'eruptionAmount', 'eruptionDecay', 'sunTransitionDays', 'diurnal', 'weatherRows', 'snowPerHour', 'snowMeltPerDegreeHour', 'freezeBelow', 'snowIceAt', 'iceStumble', 'iceHoleTurns', 'breakIceTurns', 'snowCollectTurns'],
  WorldGen: ['width', 'height', 'cellKm', 'seaLevel', 'heightMax', 'smoothPasses', 'rainScale', 'towers', 'towerOutput', 'towerRadius', 'towerDormancy', 'roadHours', 'offRoadHours', 'travelBleedMax', 'settlementSpacing', 'settlementCount', 'startRegion'],
  Biome: ['label', 'priority', 'conditions', 'worldTravelMult', 'color', 'resources'],
  Faction: ['label', 'key', 'territorial', 'playerStart', 'relations'],
  Diplomacy: ['bands', 'attackLoss', 'murderLoss', 'witnessDaysPerCell', 'witnessMinDays', 'witnessMaxDays', 'background'],
  Economy: ['currency', 'sellMult', 'buyMult', 'guildRelicBuyMult', 'regionMin', 'regionMax', 'restockDays', 'haggleBase', 'haggleMax', 'haggleStep', 'irritationAt', 'irritationPrice', 'refusalAt', 'refusalTurns'],
  Clinic: ['label','doctor','fees','supplies','examination','doseTurns','prescriptions'],
  Inn: ['label','terrain','beds','fee','leaseTurns'],
  BeddingContact:['label','exchangePerHour'],
  MaterialCrafting:['label','fragment'],
  GearWeather:['label','intervalTurns','looseBody','dryPerTen','fireDryPerTen','fireRadius'],
  Campfire:['label','terrain','kit','fuel','fuelTurns','maxFuelTurns','igniteTurns','stokeTurns','wetAt','wetMultiplier','radius','workerTarget'],
  BaseRest:['label','assignTurns','prepareKcal','prepareWater','warmBelow','debtAt'],
  BaseWater:['label','unitMl','maxAsh','methods'],
  BaseLogistics:['label','pickupTurns','minFreshness'],
  BaseDefense:['label','faction','sourceWaypoint','firstDelayTurns','intervalTurns','planningTurns','timeoutTurns','chance','minMembers','maxMembers','sourceRadius','noticeRadius','lootStacks'],
  BaseCamp:['label','storeTerrain','claimTurns','radius','maxBatches'],
  NpcCustody:['label','roles','ropeRecipe','careBelowKcal','drinkAbove','minFreshness'],
  Rescue:['label','mercyTurns','restTurns','bond'],
  Recruitment:['label','conversationTurns','days','careKcal','careWater','minMorale','probationDays','inviteTurns'],
  PrisonerEscort:['label','escortTurns','holdTurns','leashRadius'],
  PrisonerCare: ['label','sleepAt','wakeAt','wakeTurns','awakeTurns','guardRadius','struggleTurns','escapeChance','ropeWear'],
  Prisoner: ['label','rope','bindTurns','releaseTurns','interrogateTurns','executeTurns','releaseReputation','executeReputation','mercyTurns','exaggerationChance','exaggerationMult','rumorLow','rumorHigh'],
  CompanionBond: ['label','initial','min','max','leaveAt','periodTurns','range','together','sharedTrait','positivePerDay','wage','arrears','betrayal','moraleDivisor','moraleCap','personalities','conflicts'],
  Companion: ['label','hireFee','dailyWage','maxMembers','minReputation','followDistance','joinRadius','arrivalRadius','defendRadius','eatBelow','drinkAbove','sleepAt','wakeAt'],
  ColdConfusion: ['label','temperature','consciousness','intervalTurns','chance','slots'],
  FactionRelations: ['label','returnPerDay','events'],
  Investigation: ['label','refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','threatPerDepth','wealthMult','reputation'],
  PrisonerExchange:['label','turns'],
  Ransom:['label','price','turns'],
  NpcAbduction:['label','roles','approachRange','homeRadius','minKcal','maxWaterDeficit','maxFatigue'],
  RescueRemains:['label','surveyTurns','minDurability'],
  RescueContract:['label','refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','threat','wealthMult','reputation'],
  RecoveryContract:['label','refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','wealthMult','reputation','minDurability','targets'],
  ExcavationContract:['label','refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','wealthMult','reputation','workTurns','tool','minDurability','targets'],
  EscortContract:['label','routeRules','refreshDays','deadlineDays','baseReward','reputation','followDistance','maxFollowDistance'],
  ResidentCultivation:['label','enabled','roles','homeRadius','doseMl','waterBelowMl','reserveWaterMl','minKcal','maxWaterDeficit','maxFatigue','minBodyTemp','maxBodyTemp'],
  Posture:['label','movementTurns','meleeHit','rangedTargetHit','noiseMult'],
  Maneuver:['noise','kind','label','energy','turns','base','min','max','differenceMultiplier','weaponBonus','shortBladeBonus','twoHandedBonus','quadrupedBalance'],
  NpcCare:['label','enabled','sourceRules','minBond','minMedicine','minBleed','minKcal','maxWaterDeficit','maxFatigue','minBodyTemp','maxBodyTemp','witnessRange','historyLimit'],
  NpcIdentity:['label','enabled','bodies','names','format'],
  NpcSocialReport:['label','sourceRules','positiveAt','negativeAt','maxPeople'],
  NpcSocial:['label','enabled','roles','intervalTurns','range','witnessRange','minKcal','maxWaterDeficit','maxFatigue','minBodyTemp','maxBodyTemp','baseDelta','sharedTraitBonus','gainPerDay','lossPerDay','min','max','minSpeakScore','personalityRules','historyLimit'],
  PatrolContract:['label','refreshDays','deadlineDays','baseReward','threatReward','wealthMult','reputation','routes'],
  SourceContract:['label','refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','wealthMult','reputation','targets'],
  BountyContract:['label','refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','wealthMult','reputation','targets'],
  SupplyContract: ['label','refreshDays','deadlineDays','baseReward','threatReward','wealthMult','freshness','durability','reputation','requests'],
  BeddingMove: ['label','items','defaultFloor','packTurns','coldAt','warmRadius','approachRadius','retryTurns'],
  ResidentWarmth: ['label','fireTerrain','seekAt','target','turns','retryTurns'],
  Teacher: ['label','days','lessonTurns','fee','literacyMin'],
  ResidentPurification: ['label','fireTerrain','fuelTarget','dailyFuelUnits','retryTurns'],
  ResidentWater: ['label','terrain','radius','thirstAt','handWash','retryTurns'],
  ResidentProvision: ['label','terrain','radius','food','minimumKcal','targetKcal','requestBelowKcal','dailyFoodUnits','retryTurns'],
  NpcRest: ['label','terrain','radius','sleepAt','debtAt','wakeAt','retryTurns'],
  HandHygiene: ['label','waterMl','washTurns','cleanTurns','washedBonus','dirtyPenalty','dirtyContam'],
  Bestiary: ['observeTurns','encounterCount','encounterGap','fightClearTurns','rangeWidth','perRange','keenRange','dissectTurns','dissectBase','dissectMastery','dissectPer','dissectMin','dissectMax','autoDissectAfter','failedYield','toolBonus','tabooThought','tabooLoss'],
  BestiaryEntry: ['label','creatures','kind','difficulty','silhouette','yields','facts'],
  Knowledge: ['examineTurns','tasteTurns','tasteFraction','tasteBonus','baseChance','chancePerPoint','minChance','maxChance','masteryScore','defaultDifficulty','noticeablePain','pageTurns','literacySpeed','misreadChance','literacyBooks'],
  Drug: ['label', 'durationTurns', 'pain', 'consciousness', 'breathing', 'sleep', 'fatigue', 'reaction', 'bleedMult', 'tolerance', 'addiction'],
  Pharmacology: ['families', 'withdrawalStageTurns', 'withdrawalMood', 'withdrawalPain', 'severeAnalgesicPain', 'withdrawalManipulation', 'withdrawalSleep', 'recoveryTurns', 'abstinentChance', 'overdoseAt', 'overdoseBreathing', 'overdoseCheckTurns', 'overdoseFaintChance', 'deliriumCheckTurns', 'deliriumFaintChance', 'nauseaTurns', 'constipationTurns'],
  WorldSimulation: ['referencePopulation', 'defaultPopulation', 'stock', 'stockTarget', 'production', 'consumption', 'items', 'disease'],
  TraderStock: ['label', 'money', 'bargaining', 'entries'],
  RegionSite: ['label', 'description', 'cell', 'kind'],
  Retirement:['label','dailyLivingCost','longLeaseDays','minHousingDays','youngAge','oldAge','youngYears','middleYears','oldYears','friendly','legendRenown','disabilityFactor','disabilityParts','resident','maxLegacy'],
  Evidence:['label','description','sourceFaction','reformFaction','unlock','books','hold','turns','radius','reformChance','traitChance','loyalLoss'],
  FieldDevice:['label','description','operations'],
  Kinship:['label','faction','underground','chiefs','sites','delayDays','killLoss','chiefLoss','peaceReward','torchLoss','trust','avoidRadius'],
  RegionLayout:['label','mapId','kind','depth','width','height','fill','ambient','start','exits','scatter','clear','buildings','objects','spawns','links'],
  Prosthetic: ['label', 'item', 'targets', 'efficiency', 'structureHp', 'installTurns', 'removeTurns', 'serviceTurns', 'medicine'],
  WaterSafety: ['sources', 'treatments', 'exposureMl', 'pathogenRisk', 'ashDivisor', 'ashDaily', 'nauseaAt', 'nauseaAbsorption', 'kidneyAt', 'kidneyDamage', 'kidneys', 'corpsePathogen', 'rainAcidity', 'snowCoolingPer100', 'riskBands', 'disease', 'dysenteryAbsorption'],
  FoodSafety: ['temperature', 'sealedMult', 'wetMult', 'leftoverMult', 'thawedMult', 'staleAt', 'spoiledAt', 'staleRisk', 'spoiledRisk', 'rottenRisk', 'staleMood', 'rottenScent', 'dirtyHandsAt', 'dirtyHandsRisk', 'filthyAt', 'dirtyWound', 'filthyWound', 'poisonHours', 'vomits', 'vomitWater', 'washWater', 'washTurns', 'washGain', 'bathCooling', 'liceRisk', 'liceSleepMult'],
  Nutrition: ['kcalPerDay', 'waterPerDay', 'activity', 'bulkPerPoint', 'coldKcal', 'shiveringKcal', 'woundKcalPerDay', 'feverKcalMult', 'hotThreshold', 'hotWaterPerDegreeDay', 'sweatThreshold', 'sweatWaterPerHour', 'feverWaterPerDay', 'dysenteryWaterPerDay', 'burnWaterPerSeverityDay', 'maxKcal', 'overfullTurns', 'maxDrink', 'excessDrinkMult', 'proteinDaily', 'proteinPerGram', 'lowProtein', 'criticalProtein', 'lowProteinMult', 'vitaminDaily', 'lowVitamin', 'lowVitaminRecovery', 'hygieneDaily', 'starvationRisk', 'scurvyDaily', 'scurvyRecovery', 'scurvyRisk', 'scurvyGumBloodDay', 'scurvyBleedMult', 'hunger', 'thirst'],
  Procedure: ['label', 'kind', 'turns', 'blade', 'toolBonus', 'painSpike'],
  Surgery: ['label', 'kind', 'mastery', 'turns', 'perSeverity', 'supply', 'count', 'toolTag', 'toolBonus', 'bleedMult', 'healMult', 'scarMult', 'tearBelowQ', 'tearChance'],
  Recovery: ['scarPainMult', 'largeScarFraction', 'largeScarCap', 'contractureCap', 'chronicChance', 'chronicPain', 'coldThreshold', 'coldBonus', 'rainBonus', 'wakeBonus', 'wakeTurns', 'nerveLossPerHour', 'nerveFrostbiteMult', 'tendonPermanentTurns', 'foreignPain', 'foreignContam', 'arrowBleedMult', 'arrowMovePain', 'brokenHeadChance', 'dislocationCap', 'dislocationPain', 'dislocationChance', 'dislocationSeverity', 'concussionEvery', 'concussionCap', 'forgetfulChance', 'forgetfulTrait'],
  Growth: ['yearDays', 'ageBands'],
  Trauma: ['label', 'kind', 'mood', 'stressPer10', 'hit', 'morale', 'overcome', 'positive'],
  PlaceEvent: ['label','cost','weight','category','origin','composition','traces'],
  PillEffect: ['label', 'description', 'effect', 'durationTurns'],
  Skill: ['label'],
  Ability: ['label', 'description', 'tree', 'tier', 'kind', 'icon'],
  Disease: ['label', 'incubationDays', 'perDay', 'fever'],
  Break: ['label', 'tier', 'kind', 'turns', 'weight'],
  Material: ['label', 'category', 'density', 'sharpness', 'hardness', 'toughness', 'insulation', 'wetLoss', 'corrosionResist', 'flammability', 'valuePerKg'],
  Recipe: ['label', 'category', 'primaryAttr', 'workTurns', 'inputs', 'output'],
}

export class DefDatabase {
  private map = new Map<string, AnyDef>()
  private byType = new Map<string, AnyDef[]>()
  private packageRecords?:readonly {id:string;version:string;hash:string}[]
  readonly definitionRenames:Readonly<Record<string,string>>
  readonly loadHash:string
  readonly loadedMods:string[]
  readonly scriptSources:ScriptSource[]
  readonly modTextures:Readonly<Record<string,string>>
  scriptHost?:ScriptHost
  scriptModules:ScriptModule[]=[]
  constructor(defs: AnyDef[],loadedMods:string[],scriptSources:ScriptSource[]=[],identity?:unknown,renames:Record<string,string>={},packages?:readonly ModPackage[]) {
    this.loadHash=contentLoadHash(identity??{defs,loadedMods,scriptSources,...(Object.keys(renames).length?{renames}:{})})
    if(packages)this.packageRecords=freezeDefinition(packages.map(pkg=>({id:pkg.manifest.id,version:pkg.manifest.version,hash:contentLoadHash(pkg)})))
    this.definitionRenames=freezeDefinition({...renames});Object.defineProperty(this,'definitionRenames',{writable:false,configurable:false})
    this.modTextures=freezeDefinition(Object.assign({},...(packages??[]).map(pkg=>{try{return checkedModTextures(pkg.manifest.id,pkg.textures)}catch{return{}}})))
    this.loadedMods=freezeDefinition([...loadedMods]);this.scriptSources=freezeDefinition(structuredClone(scriptSources))
    for(const key of ['loadHash','loadedMods','scriptSources','packageRecords','modTextures'])Object.defineProperty(this,key,{writable:false,configurable:false})
    for (const original of defs) {
      const d=freezeDefinition(structuredClone(original))
      this.map.set(d.id, d)
      const list = this.byType.get(d.defType) ?? []
      list.push(d)
      this.byType.set(d.defType, list)
    }
  }
  modManifest():{id:string;version:string;hash:string}[]|undefined{return this.packageRecords?this.packageRecords.map(row=>({...row})):undefined}
  has(id: string): boolean { return this.map.has(id) }
  definitionManifest():Record<string,string>{return Object.fromEntries([...this.map].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,d])=>[id,d.defType]))}
  itemShapeManifest():Record<string,{size:[number,number];maxStack:number;label:string;storage?:[number,number]}>{return Object.fromEntries(this.all<ItemDef>('Item').sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(d=>[d.id,{size:[...d.size] as[number,number],maxStack:d.stackable?d.maxStack??5:1,label:d.label,...((d.storage??d.pocket??d.quiver?.size)?{storage:[...(d.storage??d.pocket??d.quiver?.size)!] as[number,number]}:{})}]))}
  get<T extends AnyDef = AnyDef>(id: string): T {
    const d = this.map.get(id)
    if (!d) throw new Error(`Def 없음: ${id}`)
    return d as T
  }
  tryGet<T extends AnyDef = AnyDef>(id: string): T | undefined {
    return this.map.get(id) as T | undefined
  }
  all<T extends AnyDef = AnyDef>(defType: string): T[] {
    return [...(this.byType.get(defType) ?? [])] as T[]
  }
  body(id: string) { return this.get<BodyDef>(id) }
  wound(id: string) { return this.get<WoundDef>(id) }
  item(id: string) { return this.get<ItemDef>(id) }
  creature(id: string) { return this.get<CreatureDef>(id) }
  terrain(id: string) { return this.get<TerrainDef>(id) }
  loot(id: string) { return this.get<LootTableDef>(id) }
  trait(id: string) { return this.get<TraitDef>(id) }
  background(id: string) { return this.get<BackgroundDef>(id) }
  thought(id: string) { return this.get<ThoughtDef>(id) }
  event(id: string) { return this.get<EventDef>(id) }
  pill(id: string) { return this.get<PillEffectDef>(id) }
  skill(id: string) { return this.get<SkillDef>(id) }
  ability(id: string) { return this.get<AbilityDef>(id) }
}

export function loadMods(pkgs: ModPackage[], enabled?: string[],options?:DefinitionLoadOptions): { db: DefDatabase; report: LoadReport } {
  const report: LoadReport = { order: [], errors: [], warnings: [], patched: 0 }
  for(const id of new Set(enabled??[]))if(!pkgs.some(p=>p.manifest.id===id))report.errors.push(`선택한 모드 없음 '${id}'`)
  const active = pkgs.filter((p) => p.manifest.id === 'core' || !enabled || enabled.includes(p.manifest.id))
  for(const p of active){report.errors.push(...packageErrors.get(p)??[]);for(const field of ['dependencies','optionalDependencies','loadAfter','loadBefore','incompatibleWith']as const){const value=p.manifest[field],dependency=field==='dependencies'||field==='optionalDependencies';if(value!==undefined&&(!Array.isArray(value)||value.some(id=>dependency?!validModDependency(id):typeof id!=='string'||!id.trim())))report.errors.push(p.manifest.id+': manifest.'+field+'의 ID/버전 목록 형식이 올바르지 않다')}if(p.manifest.gameVersion!==undefined&&!validVersionRange(p.manifest.gameVersion))report.errors.push(p.manifest.id+': manifest.gameVersion은 버전 범위 문자열이어야 한다')}
  const manifestIds=new Set<string>()
  for(const p of active){if(manifestIds.has(p.manifest.id))report.errors.push(`모드 ID 중복 '${p.manifest.id}'`);manifestIds.add(p.manifest.id)}
  const ordered = topoSort(active, report,enabled)
  for(const pkg of ordered)try{checkedModTextures(pkg.manifest.id,pkg.textures)}catch(error){report.errors.push(pkg.manifest.id+': '+(error as Error).message)}
  report.order = ordered.map((p) => p.manifest.id)
  const loadedIds = new Set(report.order)
  const scriptSources:ScriptSource[]=[]
  for(const pkg of ordered){
    const spec=pkg.manifest.scripts,files=pkg.scripts??[]
    if(spec!==undefined&&(!isObj(spec)||![0,1,2].includes(spec.stage)||Object.keys(spec).some(k=>!['stage','entry','api'].includes(k)))){report.errors.push(pkg.manifest.id+': 지원하지 않는 scripts 선언');continue}
    if(!spec||spec.stage===0){if(files.length||spec?.entry!==undefined||spec?.api!==undefined)report.errors.push(pkg.manifest.id+': 스크립트 파일에는 단계1 또는 단계2 선언이 필요하다');continue}
    if(spec.api!==undefined&&!supportsHookApi(spec.api)){report.errors.push(pkg.manifest.id+': scripts.api 범위가 현재 훅 API '+HOOK_API_VERSION+'과 맞지 않거나 지원하지 않는 형식이다');continue}
    if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(pkg.manifest.id)||['__proto__','constructor','prototype'].includes(pkg.manifest.id)){report.errors.push(pkg.manifest.id+': 스크립트 모드 ID는 안전한 영문·숫자·점·밑줄·하이픈이어야 한다');continue}
    if(typeof spec.entry!=='string'||!/^scripts\/[A-Za-z0-9][A-Za-z0-9._/-]{0,120}\.js$/.test(spec.entry)||spec.entry.split('/').some(p=>!p||p==='.'||p==='..')||files.length!==1||files[0]?.file!==spec.entry||typeof files[0]?.source!=='string'||!files[0].source||scriptBytes(files[0].source)>SCRIPT_SOURCE_LIMIT){report.errors.push(pkg.manifest.id+': 실제 단일 scripts 진입 파일과64KiB 한도가 필요하다');continue}
    const source=files[0].source,hash=(spec.stage===2?'qjs32-api2-':'qjs32-api1-')+hashString(pkg.manifest.id+'@'+pkg.manifest.version+':'+spec.entry+'\n'+source+(spec.api===undefined?'':'\napi:'+spec.api)).toString(16)
    scriptSources.push({modId:pkg.manifest.id,file:spec.entry,source,hash,...(spec.stage===2?{stage:2 as const}:{})})
  }


  const raw = new Map<string, Record<string, unknown>>()
  const owners=new Map<string,string>()
  const inspection=options?.capture?{sources:new Map<string,DefinitionSource>(),patches:[] as DefinitionPatchSource[],...(options.audit?{audit:[] as DefinitionPatchAudit[]}:{})}:undefined
  const rawOrigins=inspection&&options?.provenance?new Map<string,DefinitionOriginTree>():undefined
  const resolvedOrigins=inspection&&options?.provenance?new Map<string,DefinitionOriginTree>():undefined
  for (const pkg of ordered) {
    for (const [definitionIndex,d] of pkg.defs.entries()) {
      if (!d.id || !d.defType) {
        report.errors.push(`${pkg.manifest.id}: id/defType 없는 Def`)
        continue
      }
      for(const issue of definitionSchemaIssues(d as unknown as Record<string,unknown>,'raw'))report.errors.push(`${pkg.manifest.id}: ${d.id} 원본 스키마 ${issue.path||'/'}: ${issue.message}`)
      if(raw.has(d.id)){
        if(d.override!==true){report.errors.push(`${pkg.manifest.id}: Def ID 중복 '${d.id}' — 전체 교체에는 override: true 필요`);continue}
        report.warnings.push(`${pkg.manifest.id}: '${d.id}' 를 override로 전체 교체함`)
      }
      raw.set(d.id, { ...clone(d), _mod: pkg.manifest.id })
      owners.set(d.id,pkg.manifest.id)
      if(inspection){const location=packageLocations.get(pkg)?.defs[definitionIndex],source={modId:pkg.manifest.id,...(location??{entry:definitionIndex})};inspection.sources.set(d.id,source);rawOrigins?.set(d.id,originTree(raw.get(d.id)!,{...source,kind:'definition',definitionId:d.id,sourcePath:''}))}
    }
  }
  // 뒤에 로드되는 모드의 원본까지 모두 수집한 뒤 확정된 모드 순서로 패치한다.
  for(const pkg of ordered){
    for (const [patchIndex,op] of pkg.patches.entries()) {
      const audit=inspection?.audit
      const auditSource=audit?{modId:pkg.manifest.id,...(packageLocations.get(pkg)?.patches[patchIndex]??{entry:patchIndex}),operation:structuredClone(op)}:undefined
      if (op.ifModLoaded && !loadedIds.has(op.ifModLoaded)) {if(audit)audit.push({...auditSource!,status:'skipped',reason:'필요한 모드가 로드되지 않음: '+op.ifModLoaded});continue}
      if (op.ifModNotLoaded && loadedIds.has(op.ifModNotLoaded)) {if(audit)audit.push({...auditSource!,status:'skipped',reason:'제외 조건 모드가 로드됨: '+op.ifModNotLoaded});continue}
      if(op.ifDefExists&&!raw.has(op.ifDefExists)){if(audit)audit.push({...auditSource!,status:'skipped',reason:'조건 정의 없음: '+op.ifDefExists});continue}
      const target = raw.get(op.target)
      if (!target) {
        report.errors.push(`${pkg.manifest.id}: 패치 대상 없음 '${op.target}'`)
        if(audit)audit.push({...auditSource!,status:'failed',reason:'패치 대상 없음'})
        continue
      }
      const patchLocation=inspection?packageLocations.get(pkg)?.patches[patchIndex]:undefined
      const trace:PatchOrigin|undefined=rawOrigins?{tree:rawOrigins.get(op.target)!,source:{modId:pkg.manifest.id,...(patchLocation??{entry:patchIndex}),kind:'patch',definitionId:op.target,sourcePath:'/value',operation:structuredClone(op)}}:undefined
      const before=audit?structuredClone(target):undefined
      const err = applyPatch(target, op,trace)
      if(!err&&trace)rawOrigins!.set(op.target,trace.tree)
      if(audit)audit.push({...auditSource!,status:err?'failed':'applied',...(err?{reason:err}:{}),before,after:structuredClone(target)})
      if (err) report.errors.push(`${pkg.manifest.id}: ${op.target} ${err}`)
      else {
        target._mod = pkg.manifest.id
        report.patched++
        if(inspection){const location=packageLocations.get(pkg)?.patches[patchIndex];inspection.patches.push({modId:pkg.manifest.id,...(location??{entry:patchIndex}),operation:structuredClone(op)})}
      }
    }
  }

  // 상속 해석
  const resolved = new Map<string, Record<string, unknown>>()
  const failed=new Set<string>()
  const resolve = (id: string, stack: string[]): Record<string, unknown> | undefined => {
    if(failed.has(id))return undefined
    const done = resolved.get(id)
    if (done) return done
    const d = raw.get(id)
    if (!d) return undefined
    if (stack.includes(id)) {
      report.errors.push(`순환 상속: ${[...stack, id].join(' → ')}`)
      return d
    }
    let out = d
    let outOrigin=rawOrigins?.get(id)
    if (typeof d.parent === 'string') {
      const p = resolve(d.parent, [...stack, id])
      if (!p) {report.errors.push(`'${id}' 의 부모 '${d.parent}' 없음`);failed.add(id);return undefined}
      else {
        if(p.defType!==d.defType)report.errors.push(`'${id}': 부모 '${d.parent}' 와 defType이 다름`)
        const owner=owners.get(id),source=owners.get(d.parent)
        if(source&&source!=='core'&&source!==owner&&!readModDependencies(ordered.find(pkg=>pkg.manifest.id===owner)?.manifest.dependencies).some(dep=>dep.id===source))report.errors.push(`'${id}': 부모 모드 '${source}' 를 dependencies에 선언해야 함`)
        const { abstract: _a, id: _i, ...inherit } = p
        try{
          const parentOrigin=resolvedOrigins?.get(d.parent)??rawOrigins?.get(d.parent),baseOrigin=parentOrigin?structuredClone(parentOrigin):undefined
          if(baseOrigin?.children){delete baseOrigin.children.abstract;delete baseOrigin.children.id}
          const merge:MergeOrigin|undefined=outOrigin?{base:baseOrigin,over:outOrigin}:undefined
          out = deepMerge(inherit, d,merge) as Record<string, unknown>
          if(merge)outOrigin=merge.result
        }
        catch(error){report.errors.push(`'${id}': 상속 병합 오류 — ${(error as Error).message}`);failed.add(id);return undefined}
        if (!('abstract' in d)) {delete out.abstract;if(outOrigin?.children)delete outOrigin.children.abstract}
      }
    }
    resolved.set(id, out)
    if(outOrigin)resolvedOrigins?.set(id,outOrigin)
    return out
  }
  for (const id of raw.keys()) resolve(id, [])

  const final: AnyDef[] = []
  for (const d of resolved.values()) {
    if (d.abstract) continue
    for(const issue of definitionSchemaIssues(d,'resolved'))report.errors.push(`${String(d.id)} 해석 스키마 ${issue.path||'/'}: ${issue.message}`)
    if(d.defType==='Event'||d.defType==='EventDef'){report.errors.push(String(d.id)+': 폐지된 Event 형식이다. PlaceEvent의 origin/fromPopulation/흔적을 정의해야 한다.');continue}
    const req = REQUIRED[d.defType as string]
    if (!req) report.errors.push(`알 수 없는 defType '${String(d.defType)}' (${String(d.id)})`)
    else for (const f of req) if (!(f in d)) report.errors.push(`${String(d.id)}: 필수 필드 '${f}' 없음`)
    if (d.defType === 'Creature' && !('sprite' in d) && !('char' in d)) report.errors.push(`${String(d.id)}: 'sprite' 또는 'char' 필요`)
    final.push(d as unknown as AnyDef)
  }
  const db = new DefDatabase(final, report.order,scriptSources,ordered,resolveDefinitionRenames(ordered,final,report.errors),ordered)
  validateRefs(db, report)
  for(const d of final){const value=d.defType==='Item'?(d as ItemDef).sprite:d.defType==='Ability'?(d as AbilityDef).icon:undefined;if(typeof value==='string'&&value.startsWith('mod:')&&!Object.hasOwn(db.modTextures,value))report.errors.push(d.id+': 활성 모드 텍스처 없음 '+value)}
  if(inspection)options!.capture!(structuredClone({raw:Object.fromEntries(raw),resolved:Object.fromEntries(resolved),sources:Object.fromEntries(inspection.sources),patches:inspection.patches,...(inspection.audit?{audit:inspection.audit}:{}),...(resolvedOrigins?{fields:Object.fromEntries([...resolvedOrigins].map(([id,tree])=>[id,originFields(resolved.get(id)!,tree)]))}:{})}))
  return { db, report }
}

function validateRefs(db: DefDatabase, report: LoadReport) {
  const need = (owner: string, ref: string | undefined, type: string) => {
    if (!ref) return
    if(ref==='Item.MissingPlaceholder'&&owner!==ref){report.errors.push(owner+': 보관물은 콘텐츠의 생성/재료/거래 참조로 사용할 수 없다');return}
    const d = db.tryGet(ref)
    if (!d) report.errors.push(`${owner}: 참조 '${ref}' 없음`)
    else if (d.defType !== type) report.errors.push(`${owner}: '${ref}' 는 ${type} 가 아님 (${d.defType})`)
  }
  for (const c of db.all<CreatureDef>('Creature')) {
    need(c.id, c.body, 'Body')
    need(c.id, c.fearFamily, 'Creature')
    need(c.id, c.contactDisease?.id, 'Disease')
    need(c.id,c.biteDisease?.id,'Disease')
    for (const id of c.diseaseImmune ?? []) need(c.id, id, 'Disease')
    for (const s of c.loadout?.slots ?? []) for (const it of s.items) need(c.id, it, 'Item')
  }
  for (const l of db.all<LootTableDef>('LootTable')) for (const e of l.entries) need(l.id, e.item, 'Item')
  for (const t of db.all<TerrainDef>('Terrain')) need(t.id, t.container, 'LootTable')
  for (const b of db.all<BackgroundDef>('Background')) {
    for (const it of b.startItems) need(b.id, it, 'Item')
    for (const a of b.startAbilities ?? []) need(b.id, a, 'Ability')
    for (const d of b.immuneDiseases ?? []) need(b.id, d, 'Disease')
    need(b.id, b.startingMap, 'Item')
    if (b.startingMap && !b.startItems.includes(b.startingMap)) report.errors.push(`${b.id}: 시작 지도는 시작 소지품에 있어야 함`)
    for (const it of Object.keys(b.startQuality ?? {})) need(b.id, it, 'Item')
  }
  for (const a of db.all<AbilityDef>('Ability')) for (const r of a.requires ?? []) need(a.id, r, 'Ability')
  for(const config of db.all<import('./types').WorldGenDef>('WorldGen'))if(config.mapWorkers!==undefined){
    const workers=config.mapWorkers
    if(!workers||typeof workers!=='object'||Array.isArray(workers)||Object.entries(workers).some(([kind,ref])=>!['surface','dungeon'].includes(kind)||typeof ref!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(ref)||!db.scriptSources.some(s=>s.modId===ref.split(':')[0]&&s.stage===2)))report.errors.push(config.id+': 실제 단계2 지상/던전 mapWorkers 참조가 필요하다')
  }
  for(const layout of db.all<RegionLayoutDef>('RegionLayout'))if(layout.genWorker!==undefined){if(typeof layout.genWorker!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(layout.genWorker)||!db.scriptSources.some(s=>s.modId===layout.genWorker!.split(':')[0]&&s.stage===2))report.errors.push(layout.id+': 실제 단계2 genWorker 참조가 필요하다')}
  for(const item of db.all<ItemDef>('Item'))if(item.compWorker!==undefined){if(typeof item.compWorker!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(item.compWorker)||!db.scriptSources.some(s=>s.modId===item.compWorker!.split(':')[0]&&s.stage===2))report.errors.push(item.id+': 실제 단계2 compWorker 참조가 필요하다')}
  for(const item of db.all<ItemDef>('Item'))if(item.storage!==undefined){
    if(!Array.isArray(item.storage)||item.storage.length!==2||item.storage.some(n=>!Number.isSafeInteger(n)||n<1||n>20)||item.stackable||item.maxStack!==1||item.slot||item.food||item.drink||item.drug||item.medical||item.refuel||item.unidentified||item.light||item.place||item.rawMaterial||item.rawFragment||item.watercraft)report.errors.push(item.id+': 가방은 1~20칸의 내부 격자와 최대 개수1이 필요하며 장착/소모/설치/원재료로 겸용할 수 없다')
  }
  for(const item of db.all<ItemDef>('Item'))if(item.pocket!==undefined){if(!Array.isArray(item.pocket)||item.pocket.length!==2||item.pocket.some(n=>n!==2)||item.slot!=='belt'||!item.apparel||item.storage||item.stackable||item.maxStack!==1)report.errors.push(item.id+': 허리 주머니는 2×2/최대1개의 허리띠 장비여야 한다')}
  for(const item of db.all<ItemDef>('Item'))if(item.fletching&&(item.category!=='ammo'||!Number.isSafeInteger(item.fletching.hitPenalty)||item.fletching.hitPenalty<0||item.fletching.hitPenalty>95))report.errors.push(item.id+': 깃 손상은 실제 탄약의0~95 정수 명중 감점이어야 한다')
  for(const item of db.all<ItemDef>('Item'))if(item.quiver){const q=item.quiver;if(!Array.isArray(q.size)||q.size.length!==2||q.size[0]!==1||q.size[1]!==6||item.slot!=='back'||!item.apparel||item.storage||item.pocket||item.stackable||item.maxStack!==1||!Array.isArray(q.ammo)||!q.ammo.length||q.ammo.some(id=>db.tryGet<ItemDef>(id)?.defType!=='Item'||db.tryGet<ItemDef>(id)?.category!=='ammo'))report.errors.push(item.id+': 화살통은 실제 탄약 목록/1×6 격자/등 슬롯/최대1개 장비여야 한다')}
  for(const c of db.all<CreatureDef>('Creature'))if(c.considerationWorker!==undefined){if(typeof c.considerationWorker!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(c.considerationWorker)||!db.scriptSources.some(s=>s.modId===c.considerationWorker!.split(':')[0]&&s.stage===2))report.errors.push(c.id+': 실제 단계2 considerationWorker 참조가 필요하다')}
  for(const e of db.all<EventDef>('PlaceEvent'))if(e.worker!==undefined){if(typeof e.worker!=='string'||!/^[-A-Za-z0-9._]+:[A-Za-z][A-Za-z0-9_]{0,63}$/.test(e.worker)||!db.scriptSources.some(s=>s.modId===e.worker!.split(':')[0]&&s.stage===2)||!['Event.ReaverPatrol','Event.ReaverSearch'].includes(e.id)&&(e.origin?.kind!=='camp'||!Array.isArray(e.place?.route)||e.place.route.at(-1)!=='@home'))report.errors.push(e.id+': 실제 출발지/귀환 경로의 단계2 worker 참조가 필요하다')}
  for(const e of db.all<EventDef>('PlaceEvent'))if('spawn'in e)report.errors.push(e.id+': spawn은 폐지되었다. 실제 원래 인원을 사용하는 composition.fromPopulation을 정의해야 한다')


  const range = (owner: string, field: string, n: number | undefined, lo: number, hi = Infinity, integer = false) => {
    if (n !== undefined && (!Number.isFinite(n) || n < lo || n > hi || (integer && !Number.isInteger(n)))) report.errors.push(`${owner}: '${field}' 범위 오류 (${n})`)
  }
  for (const d of db.all<CreatureDef>('Creature')) if (d.characterAliases !== undefined) {
    if (!isObj(d.characterAliases) || Object.entries(d.characterAliases).some(([key,value]) => !key.trim() || typeof value !== 'string' || !value.trim())) report.errors.push(d.id + ': characterAliases는 비어 있지 않은 외형 키/표시 키 대응이어야 함')
  }
  for(const item of db.all<ItemDef>('Item')){
    if(item.powder!==undefined&&(typeof item.powder!=='boolean'||item.powder&&item.category!=='ammo'))report.errors.push(item.id+': 화약은 실제 탄약 회분이어야 한다')
    if(item.cartridge!==undefined){
      const a=item.cartridge,spent=isObj(a)?db.tryGet<ItemDef>(a.spent):undefined
      if(!isObj(a)||item.category!=='ammo'||item.powder||!item.stackable||!Number.isSafeInteger(a.misfire)||a.misfire<0||a.misfire>100||!Number.isSafeInteger(a.fouling)||a.fouling<1||a.fouling>100||spent?.defType!=='Item'||spent.cartridge||spent.powder||spent.id===item.id)report.errors.push(item.id+': 실제 실탄/불발/오염/빈 탄피 정의가 필요하다')
    }
    const rd=item.ranged,cfg=rd?.firearm
    if(rd?.magazine&&!cfg)report.errors.push(item.id+': 탄창에는 실제 화기 설정이 필요하다')
    if(!cfg)continue
    if(!isObj(cfg)){report.errors.push(item.id+': 화기 구조 오류');continue}
    const ball=db.tryGet<ItemDef>(rd!.ammo),powder=cfg.powder&&db.tryGet<ItemDef>(cfg.powder),oil=db.tryGet<ItemDef>(cfg.oil),mag=rd!.magazine
    if(!rd!.reloadTurns||item.stackable||item.maxStack!==1||item.attacks?.length!==1||item.attacks[0].damageType!=='gunshot'||ball?.category!=='ammo'||ball.powder||oil?.defType!=='Item')report.errors.push(item.id+': 화기/실제 탄약·기름 정의가 필요하다')
    if(mag){
      if(!isObj(mag)||!Number.isSafeInteger(mag.capacity)||mag.capacity<1||mag.capacity>20||!['round','clip'].includes(mag.mode)||!Array.isArray(mag.alternatives)||new Set(mag.alternatives).size!==mag.alternatives.length||mag.alternatives.includes(rd!.ammo)||cfg.powder!==undefined||!ball?.cartridge||mag.alternatives.some(id=>!db.tryGet<ItemDef>(id)?.cartridge))report.errors.push(item.id+': 탄창 용량/장전 방식/실제 호환 실탄 정의가 필요하다')
    }else if(!item.twoHanded||!powder||!powder.powder||ball?.cartridge||cfg.powder===rd!.ammo)report.errors.push(item.id+': 단발 양손 화기/실제 탄두·화약·기름 정의가 필요하다')
    for(const key of ['misfire','foulingPerShot','jamThreshold','jamPerPoint','wetThreshold','wetMultiplier','cleanTurns','unjamTurns','moraleShock']as const)if(!Number.isFinite(cfg[key])||cfg[key]<0||cfg[key]>100||(key!=='jamPerPoint'&&!Number.isSafeInteger(cfg[key])))report.errors.push(item.id+': firearm.'+key+' 수치 오류')
    if(cfg.foulingPerShot<1||cfg.wetMultiplier<1||cfg.cleanTurns<1||cfg.unjamTurns<1)report.errors.push(item.id+': 화기 작업/오염/젖음 배율은 양수여야 한다')
  }
  for(const r of db.all<RecipeDef>('Recipe'))if(r.cartridgeReload!==undefined){
    const cfg=r.cartridgeReload,ammo=db.tryGet<ItemDef>(r.output.item)
    if(!isObj(cfg)||!ammo?.cartridge||r.output.count!==1||r.passiveTurns||r.preservation||ammo.cartridge.spent!==cfg.case||!db.tryGet<ItemDef>(cfg.powder)?.powder||r.inputs.filter(i=>i.item===cfg.case&&i.count===1).length!==1||r.inputs.filter(i=>i.item===cfg.powder&&i.count===1).length!==1)report.errors.push(r.id+': 실제 탄피 한 개/화약 한 회분의 실탄 재장전 정의가 필요하다')
  }
  for (const item of db.all<ItemDef>('Item')) if (item.throwable !== undefined) {
    const td = item.throwable
    if (!isObj(td) || !isObj(td.attack)) { report.errors.push(item.id + ': throwable 실제 공격/거리 구조가 필요하다'); continue }
    for (const key of ['range', 'effective'] as const) if (!Number.isSafeInteger(td[key]) || td[key] < 1 || td[key] > 30) report.errors.push(item.id + ': throwable.' + key + '는1~30 정수여야 한다')
    if (td.effective > td.range) report.errors.push(item.id + ': 투척 유효 사거리가 최대 사거리보다 크다')
    const a = td.attack
    if (!a.id || !a.label || !a.family || !['cut', 'stab', 'blunt', 'bite', 'burn'].includes(a.damageType)) report.errors.push(item.id + ': 투척 공격 이름/계열/피해 유형이 필요하다')
    for (const [key, lo, hi] of [['damage', 1, 1000], ['pen', 0, 100], ['accuracy', -100, 100], ['energy', 0, 1000], ['noise', 0, 100]] as const) if (!Number.isSafeInteger(a[key]) || (a[key] ?? -Infinity) < lo || (a[key] ?? Infinity) > hi) report.errors.push(item.id + ': throwable.attack.' + key + ' 수치가 잘못되었다')
    if (item.storage || item.pocket || item.quiver) report.errors.push(item.id + ': 내부 격자를 가진 물품은 공격용 투척물로 사용할 수 없다')
  }
  for(const terrain of db.all<TerrainDef>('Terrain'))if(terrain.lock){const d=terrain.lock;if((!terrain.container&&(terrain.door!=='closed'||terrain.sealed||terrain.keyItem))||!Number.isSafeInteger(d.turns)||d.turns<1||d.turns>1200||!Number.isFinite(d.wear)||d.wear<1||d.wear>100||!Number.isSafeInteger(d.noise)||d.noise<0||d.noise>30||!Array.isArray(d.tools)||!d.tools.length||d.tools.some(tag=>!db.all<ItemDef>('Item').some(it=>it.toolTags?.includes(tag))))report.errors.push(terrain.id+': 실제 상자/도구와 유한한 잠금 작업 수치가 필요하다')}
  for(const terrain of db.all<TerrainDef>('Terrain'))if(terrain.lock?.picking!==undefined){
    const rule=terrain.lock.picking
    if(!isObj(rule)){report.errors.push(terrain.id+': 정밀 잠금 작업 구조가 필요하다');continue}
    for(const key of ['turns','wear','noise','base','min','max','agility','quality']as const)if(!Number.isSafeInteger(rule[key]))report.errors.push(terrain.id+': 정밀 잠금 '+key+'는 유한 정수여야 한다')
    if(rule.turns<1||rule.turns>1200||rule.wear<1||rule.wear>100||rule.noise<0||rule.noise>30||rule.min<5||rule.max>95||rule.max<rule.min||rule.base<rule.min||rule.base>rule.max||rule.agility<0||rule.agility>20||rule.quality<0||rule.quality>20||typeof rule.toolTag!=='string'||!db.all<ItemDef>('Item').some(item=>item.toolTags?.includes(rule.toolTag)))report.errors.push(terrain.id+': 실제 도구와 유한한 정밀 잠금 수치가 필요하다')
  }
  for(const item of db.all<ItemDef>('Item'))if(item.fragile!==undefined){
    const f=item.fragile
    if(!isObj(f))report.errors.push(item.id+': fragile 구조 오류')
    else{
      need(item.id,f.result,'Item');const result=db.tryGet<ItemDef>(f.result)
      if(!f.result||f.result===item.id||!result||JSON.stringify(item.size)!==JSON.stringify(result.size)||(result.maxStack??1)<(item.maxStack??1))report.errors.push(item.id+': fragile 원래 칸/수량 보존 결과 필요')
      if(!Number.isFinite(f.dropChance))report.errors.push(item.id+': fragile.dropChance 필요');else range(item.id,'fragile.dropChance',f.dropChance,0,1)
      for(const key of ['waterMult','beddingMult']as const)range(item.id,'fragile.'+key,f[key],0,1)
      range(item.id,'fragile.noise',f.noise,0,20,true)
      if(item.food&&(!result?.food||['kcal','protein','vitamin','water'].some(key=>(item.food![key as keyof typeof item.food]??0)!==(result.food![key as keyof typeof result.food]??0))))report.errors.push(item.id+': fragile 실제 원래 음식 내용물/영양 보존 필요')
      if((item.food?.freshHours||item.drink?.freshHours)&&!(result?.food?.freshHours||result?.drink?.freshHours))report.errors.push(item.id+': fragile 부패하는 원래 내용물 보존 필요')
    }
  }
  for(const item of db.all<ItemDef>('Item'))if(item.openFoodLabel!==undefined&&(typeof item.openFoodLabel!=='string'||!item.openFoodLabel.trim()||!item.openFood))report.errors.push(item.id+': openFoodLabel 실제 개봉 안내 문구 필요')
  for(const c of db.all<CreatureDef>('Creature'))if(c.meatDrop!==undefined){
    const m=c.meatDrop
    if(!isObj(m))report.errors.push(c.id+': meatDrop 구조 오류')
    else{need(c.id,m.item,'Item');if(!db.tryGet<ItemDef>(m.item)?.food)report.errors.push(c.id+': meatDrop 실제 음식 필요');if(!Number.isFinite(m.count))report.errors.push(c.id+': meatDrop.count 필요');else range(c.id,'meatDrop.count',m.count,0,100,true)}
  }
  for(const item of db.all<ItemDef>('Item'))if(item.food?.plainThought!==undefined){need(item.id,item.food.plainThought,'Thought');if(typeof item.food.plainThought!=='string'||!item.food.plainThought.length||!(db.tryGet<ThoughtDef>(item.food.plainThought)?.durationTurns))report.errors.push(item.id+': food.plainThought 실제 유한 사고 필요')}
  for(const item of db.all<ItemDef>('Item'))if(item.food?.rawDisease!==undefined){
    const risk=item.food.rawDisease
    if(!isObj(risk))report.errors.push(item.id+': food.rawDisease 구조 오류')
    else{need(item.id,risk.def,'Disease');if(!risk.def||!item.food.raw||item.food.cooked)report.errors.push(item.id+': food.rawDisease 실제 생식/질병 참조 필요');if(!Number.isFinite(risk.chance))report.errors.push(item.id+': food.rawDisease.chance 필요');else range(item.id,'food.rawDisease.chance',risk.chance,0,1)}
  }
  for(const terrain of db.all<TerrainDef>('Terrain'))if(terrain.gather?.seasons!==undefined){
    const list=terrain.gather.seasons
    if(!Array.isArray(list)||!list.length||list.some(id=>typeof id!=='string')||new Set(list).size!==list.length)report.errors.push(terrain.id+': gather.seasons 실제 서로 다른 계절 목록 필요')
    else for(const id of list)need(terrain.id,id,'Season')
  }
  for(const item of db.all<ItemDef>('Item'))if(item.food?.sprouts!==undefined){
    const sprout=item.food.sprouts
    if(!isObj(sprout))report.errors.push(item.id+': food.sprouts 구조 오류')
    else{for(const key of ['at','risk']as const){if(!Number.isFinite(sprout[key]))report.errors.push(item.id+': food.sprouts.'+key+' 필요');else range(item.id,'food.sprouts.'+key,sprout[key],0,100)}if(!item.food.raw)report.errors.push(item.id+': food.sprouts는 실제 생식 재료여야 함')}
  }
  for(const world of db.all<WorldGenDef>('WorldGen'))if(world.forage!==undefined){
    const f=world.forage
    if(!isObj(f))report.errors.push(world.id+': forage 구조 오류')
    else{need(world.id,f.sourceTerrain,'Terrain');need(world.id,f.terrain,'Terrain');const source=db.tryGet<TerrainDef>(f.sourceTerrain),target=db.tryGet<TerrainDef>(f.terrain);if(!target?.gather?.seasons?.length||f.sourceTerrain===f.terrain)report.errors.push(world.id+': forage 실제 별도 계절 채집 지형 필요');if(source&&target&&(source.passable!==target.passable||source.opaque!==target.opaque||source.moveMult!==target.moveMult||source.noiseMult!==target.noiseMult))report.errors.push(world.id+': forage 원래 지형 기하/이동/소음 보존 필요');if(!Number.isFinite(f.chance))report.errors.push(world.id+': forage.chance 필요');else range(world.id,'forage.chance',f.chance,0,1)}
  }
  for(const r of db.all<RecipeDef>('Recipe'))if(r.boiledMeal!==undefined){
    const spec=r.boiledMeal
    if(!isObj(spec))report.errors.push(r.id+': boiledMeal 구조 오류')
    else{
      need(r.id,spec.vessel,'Item');const vessel=db.tryGet<ItemDef>(spec.vessel),out=db.tryGet<ItemDef>(r.output.item)
      if(!vessel||vessel.food||vessel.drink||vessel.stackable||!out?.food||out.food.servings!==1||out.food.emptyVessel!==spec.vessel||r.output.count!==1||r.inputs.filter(i=>i.item===spec.vessel).reduce((n,i)=>n+i.count,0)!==1)report.errors.push(r.id+': boiledMeal 원래 그릇/한 회분 필요')
      if(spec.unheated!==undefined){
        need(r.id,spec.unheated,'Item');const raw=db.tryGet<ItemDef>(spec.unheated)
        if(!raw?.food?.raw||raw.food.cooked||raw.food.servings!==1||raw.food.emptyVessel!==spec.vessel||raw.food.water!==spec.waterMl||raw.food.warm||raw.stackable||raw.maxStack!==1||JSON.stringify(raw.size)!==JSON.stringify(vessel?.size)||raw.cooking?.result!==r.output.item||raw.cooking.turns!==r.workTurns||['protein','vitamin'].some(k=>(raw.food![k as keyof typeof raw.food]??0)!==(out?.food?.[k as keyof NonNullable<typeof out.food>]??0)))report.errors.push(r.id+': boiledMeal.unheated 원래 그릇/물/내용물과 실제 끓임 필요')
      }
      if(!Number.isFinite(spec.waterMl))report.errors.push(r.id+': boiledMeal.waterMl 필요');else range(r.id,'boiledMeal.waterMl',spec.waterMl,1,1000,true)
      if(out?.food?.water!==spec.waterMl||!out.food.cooked||r.passiveTurns||r.preservation||r.evaporation||r.waterTreatment||!r.stations?.includes('campfire'))report.errors.push(r.id+': boiledMeal 실제 물/끓임 작업 규칙 오류')
    }
  }
  for(const item of db.all<ItemDef>('Item'))if(item.food?.warm!==undefined){
    const h=item.food.warm
    if(!isObj(h))report.errors.push(item.id+': food.warm 구조 오류')
    else{for(const key of ['gain','coolTurns','maxBodyTemp']as const){if(!Number.isFinite(h[key]))report.errors.push(item.id+': food.warm.'+key+' 필요');else range(item.id,'food.warm.'+key,h[key],Number.MIN_VALUE,key==='gain'?1:key==='maxBodyTemp'?45:100000,key==='coolTurns')}}
  }
  for(const it of db.all<ItemDef>('Item')){
    if(it.brew!==undefined){
      const b=it.brew
      if(!isObj(b)||!Array.isArray(b.bottles)||!b.bottles.length)report.errors.push(it.id+': brew 구조 오류')
      else{
        need(it.id,b.result,'Item');const result=db.tryGet<ItemDef>(b.result)
        if(!result?.drink?.freshHours||!result.drink.emptyVessel)report.errors.push(it.id+': brew.result 실제 신선 음료/빈 용기 필요')
        for(const id of b.bottles){if(typeof id!=='string'){report.errors.push(it.id+': brew.bottles 참조 오류');continue}need(it.id,id,'Item');const bottle=db.tryGet<ItemDef>(id);if(!bottle?.drink||bottle.drink.alcohol||bottle.stackable)report.errors.push(it.id+': brew.bottles 실제 개별 물병 필요');if(result?.drink&&(!Number.isFinite((result.uses??1)*result.drink.water)||(result.uses??1)*result.drink.water<=0))report.errors.push(it.id+': brew 결과의 실제 용량 필요')}
        for(const key of ['mlPerLeaf','turns']as const){if(!Number.isFinite(b[key]))report.errors.push(it.id+': brew.'+key+' 수치 필요');else range(it.id,'brew.'+key,b[key],1,100000,true)}
      }
    }
    if(it.drink?.freshHours!==undefined){range(it.id,'drink.freshHours',it.drink.freshHours,Number.MIN_VALUE);if(!it.drink.emptyVessel||!Number.isFinite(it.drink.water)||it.drink.water<=0)report.errors.push(it.id+': 신선 음료의 실제 용기/양 필요')}
    if(it.drink?.emptyVessel!==undefined){need(it.id,it.drink.emptyVessel,'Item');const empty=db.tryGet<ItemDef>(it.drink.emptyVessel);if(it.stackable||empty?.stackable||!empty?.drink||empty.drink.alcohol)report.errors.push(it.id+': drink.emptyVessel 실제 재사용 물병 필요')}
  }
  for(const terrain of db.all<TerrainDef>('Terrain'))if(terrain.needles!==undefined){
    const b=terrain.needles
    if(!isObj(b))report.errors.push(terrain.id+': needles 구조 오류')
    else{need(terrain.id,b.item,'Item');if(!db.tryGet<ItemDef>(b.item)?.brew)report.errors.push(terrain.id+': needles.item 실제 차 재료 필요');for(const key of ['count','turns','regrowTurns']as const){if(!Number.isFinite(b[key]))report.errors.push(terrain.id+': needles.'+key+' 수치 필요');else range(terrain.id,'needles.'+key,b[key],1,1000000,true)}}
  }
  for(const world of db.all<WorldGenDef>('WorldGen'))if(world.pines!==undefined){
    const p=world.pines
    if(!isObj(p))report.errors.push(world.id+': pines 구조 오류')
    else{need(world.id,p.sourceTerrain,'Terrain');need(world.id,p.terrain,'Terrain');if(!db.tryGet<TerrainDef>(p.terrain)?.needles||p.sourceTerrain===p.terrain)report.errors.push(world.id+': pines 실제 별도 솔잎 나무 필요');if(!Number.isFinite(p.chance))report.errors.push(world.id+': pines.chance 필요');else range(world.id,'pines.chance',p.chance,0,1)}
  }
  for(const it of db.all<ItemDef>('Item')){
   range(it.id,'saltGrams',it.saltGrams,Number.MIN_VALUE)
   if(it.watercraft){
    const d=it.watercraft
    if(!isObj(d)||!Array.isArray(d.deck)||!Array.isArray(d.anchor)||!Array.isArray(d.cargoPos)||!isObj(d.repair)||!isObj(d.weather))report.errors.push(`${it.id}: watercraft 구조 오류`)
    else{
     for(const key of ['seats','turnsPerCell','launchTurns','minDurability','wearPerHour']as const){if(typeof d[key]!=='number')report.errors.push(`${it.id}: watercraft.${key} 수치 필요`);else range(it.id,`watercraft.${key}`,d[key],key==='wearPerHour'?0:1,key==='seats'?12:key==='minDurability'||key==='wearPerHour'?100:100000,key!=='wearPerHour')}
     for(const key of ['deckTerrain','waterTerrain','cargoTerrain']as const)need(it.id,d[key],'Terrain')
     need(it.id,d.repair.item,'Item')
     for(const key of ['count','turns','restore']as const){if(typeof d.repair[key]!=='number')report.errors.push(`${it.id}: watercraft.repair.${key} 수치 필요`);else range(it.id,`watercraft.repair.${key}`,d.repair[key],1,key==='restore'?100:100000,true)}
     if(!db.tryGet<TerrainDef>(d.deckTerrain)?.passable||db.tryGet<TerrainDef>(d.waterTerrain)?.water!=='deep'||!db.tryGet<TerrainDef>(d.cargoTerrain)?.lootGrid)report.errors.push(`${it.id}: 배의 실제 갑판/바다/화물 지형 오류`)
     for(const[key,value]of Object.entries(d.weather))if(!['clear','overcast','deepOvercast','ashrain','ashstorm','ashgale','ashsnow','frostfog'].includes(key)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>10)report.errors.push(`${it.id}: watercraft.weather 오류`)
     if(d.deck.length!==4||d.deck.some(n=>!Number.isSafeInteger(n)||n<0)||d.deck[0]+d.deck[2]>16||d.deck[1]+d.deck[3]>12||d.deck[2]*d.deck[3]<d.seats+1)report.errors.push(`${it.id}: 갑판 크기 오류`)
     for(const key of ['anchor','cargoPos']as const){const p=d[key];if(p.length!==2||p.some(n=>!Number.isSafeInteger(n))||p[0]<d.deck[0]||p[1]<d.deck[1]||p[0]>=d.deck[0]+d.deck[2]||p[1]>=d.deck[1]+d.deck[3])report.errors.push(`${it.id}: watercraft.${key}는 실제 갑판 안이어야 함`)}
     if(d.anchor[0]===d.cargoPos[0]&&d.anchor[1]===d.cargoPos[1])report.errors.push(`${it.id}: 화물함과 조종 자리가 겹침`)
     if(d.sinking!==undefined){const f=d.sinking;if(!isObj(f)||!isObj(f.stormWear)||!Array.isArray(f.frames))report.errors.push(`${it.id}: watercraft.sinking 구조 오류`)
      else{need(it.id,f.frameTerrain,'Terrain');const frame=db.tryGet<TerrainDef>(f.frameTerrain);if(!frame?.passable||frame.water!=='shallow'||frame.waterSource!==db.tryGet<TerrainDef>(d.waterTerrain)?.waterSource)report.errors.push(`${it.id}: sinking.frameTerrain 실제 얕은 물 지지대 필요`);if(!Number.isFinite(f.leakWear))report.errors.push(`${it.id}: sinking.leakWear 수치 필요`);else range(it.id,'sinking.leakWear',f.leakWear,0,100);for(const[key,value]of Object.entries(f.stormWear))if(!['clear','overcast','deepOvercast','ashrain','ashstorm','ashgale','ashsnow','frostfog'].includes(key)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)report.errors.push(`${it.id}: sinking.stormWear 오류`);if(!f.frames.length||f.frames.length>d.seats)report.errors.push(`${it.id}: sinking.frames 실제 정원 한도 오류`);const cells=new Set<string>();for(const p of f.frames){if(!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isSafeInteger(n))){report.errors.push(`${it.id}: sinking.frames 좌표 오류`);continue}const x=d.anchor[0]+p[0],y=d.anchor[1]+p[1],key=`${x},${y}`;if(cells.has(key)||x<d.deck[0]||y<d.deck[1]||x>=d.deck[0]+d.deck[2]||y>=d.deck[1]+d.deck[3])report.errors.push(`${it.id}: sinking.frames는 원래 갑판의 서로 다른 칸이어야 함`);cells.add(key)}}
     }

    }
   }

   if(it.slot==='lining')report.errors.push(`${it.id}: 안감은 몸 의복의 apparel.liner로 정의해야 함`)
   for(const key of ['liningHost','liner']as const)if(it.apparel?.[key]!==undefined){if(typeof it.apparel[key]!=='boolean')report.errors.push(`${it.id}: apparel.${key}는 boolean이어야 함`);if(it.slot!=='chest'||it.stackable)report.errors.push(`${it.id}: apparel.${key}는 몸 의복에만 적용할 수 있음`)}
  }
  for (const it of db.all<ItemDef>('Item')) { range(it.id, 'food.freshHours', it.food?.freshHours, Number.MIN_VALUE); range(it.id, 'food.poison', it.food?.poison, 0, 100) }
  for (const c of db.all<CreatureDef>('Creature')) { range(c.id, 'metabolicScale', c.metabolicScale, Number.MIN_VALUE); range(c.id, 'weightKg', c.weightKg, Number.MIN_VALUE) }
  for(const d of db.all<EconomyDef>('Economy'))if(d.socialReplies!==undefined){const s=d.socialReplies;if(!isObj(s))report.errors.push(d.id+': socialReplies 구조 오류');else{for(const key of ['welcomeAt','expelAt']as const){if(!Number.isFinite(s[key]))report.errors.push(d.id+': socialReplies.'+key+' 필요');else range(d.id,'socialReplies.'+key,s[key],-100,100)}if(s.expelAt>=s.welcomeAt)report.errors.push(d.id+': socialReplies 환대/퇴거 문턱 순서 오류')}}
  const factions = db.all<FactionDef>('Faction'), keys = new Set<string>()
  for (const f of factions) {
    if(f.unlock!==undefined&&(typeof f.unlock!=='string'||!f.unlock||!db.all<EvidenceDef>('Evidence').some(d=>d.unlock===f.unlock&&d.reformFaction===f.key)))report.errors.push(`${f.id}: unlock 공개 증거 참조 오류`)
    if (keys.has(f.key)) report.errors.push(`${f.id}: 중복 세력 key '${f.key}'`)
    keys.add(f.key)
    range(f.id, 'playerStart', f.playerStart, -100, 100)
    for (const [key, value] of Object.entries(f.relations ?? {})) {
      if (!factions.some((x) => x.key === key)) report.errors.push(`${f.id}: 알 수 없는 세력 '${key}'`)
      range(f.id, `relations.${key}`, value, -100, 100)
    }
    if (f.trader) need(f.id, f.trader, 'TraderStock')
    if (f.guard) need(f.id, f.guard, 'Creature')
    if (f.resident) need(f.id, f.resident, 'Creature')
    if(f.merchant)need(f.id,f.merchant,'Creature')
    if(f.healer)need(f.id,f.healer,'Creature')
  }
  for (const d of db.all<DiplomacyDef>('Diplomacy')) {
    if (!d.bands?.length || d.bands[0].min !== -100) report.errors.push(`${d.id}: 평판 구간은 -100부터 시작해야 함`)
    for (const [i, b] of (d.bands ?? []).entries()) {
      range(d.id, 'bands.min', b.min, -100, 100); range(d.id, 'bands.price', b.price, Number.MIN_VALUE)
      if (i && d.bands[i - 1].min >= b.min) report.errors.push(`${d.id}: 평판 구간은 중복 없이 증가해야 함`)
    }
    range(d.id, 'attackLoss', d.attackLoss, -100, 0); range(d.id, 'murderLoss', d.murderLoss, -100, 0)
    range(d.id, 'witnessDaysPerCell', d.witnessDaysPerCell, 0); range(d.id, 'witnessMinDays', d.witnessMinDays, 0)
    range(d.id, 'witnessMaxDays', d.witnessMaxDays, d.witnessMinDays)
    for (const [bg, values] of Object.entries(d.background ?? {})) {
      need(d.id, bg, 'Background')
      for (const [f, v] of Object.entries(values)) { if (!keys.has(f)) report.errors.push(`${d.id}: 알 수 없는 세력 '${f}'`); range(d.id, 'background reputation', v, -100, 100) }
    }
  }
  for (const e of db.all<EconomyDef>('Economy')) {
    for (const key of ['sellMult', 'buyMult', 'guildRelicBuyMult', 'regionMin', 'regionMax', 'irritationPrice'] as const) range(e.id, key, e[key], Number.MIN_VALUE)
    for (const key of ['restockDays', 'haggleMax', 'irritationAt', 'refusalAt', 'refusalTurns'] as const) range(e.id, key, e[key], 1, Infinity, true)
    range(e.id, 'haggleBase', e.haggleBase, 0, 100); range(e.id, 'haggleStep', e.haggleStep, 0, 1 / Math.max(1, e.haggleMax))
    if(e.firstImpressions!==undefined){
      const d=e.firstImpressions
      if(!isObj(d))report.errors.push(e.id+': firstImpressions 규정 오류')
      else{
        for(const key of ['filthyBelow','filthyPenalty','faceScarPenalty','hagglePerPoint','warmAt','waryBelow']as const){
          if(!Number.isFinite(d[key]))report.errors.push(e.id+': firstImpressions.'+key+' 필요')
          else range(e.id,'firstImpressions.'+key,d[key],key==='filthyPenalty'||key==='faceScarPenalty'||key==='warmAt'||key==='waryBelow'?-100:0,key==='filthyPenalty'||key==='faceScarPenalty'?0:key==='hagglePerPoint'?10:100)
        }
        if(d.warmAt<=d.waryBelow)report.errors.push(e.id+': 첫 인상 태도 문턱 역전')
        if(!Array.isArray(d.villagerFactions)||!d.villagerFactions.length||d.villagerFactions.some(f=>!keys.has(f)))report.errors.push(e.id+': firstImpressions.villagerFactions 참조 오류')
        const groups=new Set(db.all<BodyDef>('Body').flatMap(b=>b.parts.flatMap(p=>p.groups)))
        if(!Array.isArray(d.faceGroups)||!d.faceGroups.length||d.faceGroups.some(g=>!groups.has(g)))report.errors.push(e.id+': firstImpressions.faceGroups 참조 오류')
      }
    }
    if (e.regionMax < e.regionMin || e.buyMult > e.sellMult || e.guildRelicBuyMult > e.sellMult) report.errors.push(`${e.id}: 가격 범위/매입·판매 배율 오류`)
  }
  for (const stock of db.all<TraderStockDef>('TraderStock')) {
    range(stock.id, 'money', stock.money, 0, Infinity, true); range(stock.id, 'bargaining', stock.bargaining, 0)
    const seen = new Set<string>()
    for (const e of stock.entries ?? []) {
      need(stock.id, e.item, 'Item'); if (seen.has(e.item)) report.errors.push(`${stock.id}: 중복 재고 '${e.item}'`); seen.add(e.item)
      range(stock.id, 'target', e.target, 1, Infinity, true)
      range(stock.id, 'dailyProduction', e.dailyProduction, 0, Infinity, true); range(stock.id, 'dailyConsumption', e.dailyConsumption, 0, Infinity, true)
    }
  }
  for (const d of db.all<DiseaseDef>('Disease')) if (d.population) {
    for (const key of ['beta', 'gamma', 'mu'] as const) {
      if (d.population[key] === undefined) report.errors.push(`${d.id}: population.${key} 없음`)
      range(d.id, `population.${key}`, d.population[key], 0, 1000, true)
    }
    if (d.population.gamma + d.population.mu > 1000) report.errors.push(`${d.id}: 회복/사망 합이1000을 넘음`)
  }
  for (const d of db.all<WorldSimulationDef>('WorldSimulation')) {
    if(d.nutritionKcalPerFoodUnit!==undefined&&(!Number.isFinite(d.nutritionKcalPerFoodUnit)||d.nutritionKcalPerFoodUnit<1||d.nutritionKcalPerFoodUnit>100000))report.errors.push(d.id+': nutritionKcalPerFoodUnit 오류')
    if(d.seasonalProduction!==undefined){
      const rule=d.seasonalProduction
      if(!isObj(rule)||!Array.isArray(rule.factions)||!rule.factions.length||rule.factions.some(f=>typeof f!=='string'||!keys.has(f))||new Set(rule.factions).size!==rule.factions.length||!isObj(rule.seasons)||!Object.keys(rule.seasons).length)report.errors.push(d.id+': seasonalProduction의 실제 세력/계절 사전이 필요하다')
      else for(const[season,values]of Object.entries(rule.seasons)){
        need(d.id,season,'Season')
        if(!isObj(values)||!Object.keys(values).length){report.errors.push(d.id+': seasonalProduction.'+season+' 물자 계수가 필요하다');continue}
        for(const[commodity,value]of Object.entries(values))if(!['Food','Fuel','Metal','Medicine','Ammo','Salt'].includes(commodity)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>10)report.errors.push(d.id+': seasonalProduction.'+season+'.'+commodity+'는0~10의 물자 생산 배율이어야 한다')
      }
    }
    if(d.rumors!==undefined){
      const r=d.rumors
      if(!isObj(r))report.errors.push(`${d.id}: rumors 규정 오류`)
      else{
        if(r.publicOutbreaks!==undefined&&typeof r.publicOutbreaks!=='boolean')report.errors.push(`${d.id}: rumors.publicOutbreaks 참/거짓 필요`)
        if(r.publicFoodSupply!==undefined&&typeof r.publicFoodSupply!=='boolean')report.errors.push(`${d.id}: rumors.publicFoodSupply 참/거짓 필요`)
        if(r.publicNames!==undefined&&typeof r.publicNames!=='boolean')report.errors.push(`${d.id}: rumors.publicNames 참/거짓 필요`)
        if(r.landRoutes!==undefined&&typeof r.landRoutes!=='boolean')report.errors.push(`${d.id}: rumors.landRoutes 참/거짓 필요`)
        if(r.firstImpressionCap!==undefined){if(typeof r.firstImpressionCap!=='number')report.errors.push(`${d.id}: rumors.firstImpressionCap 숫자 필요`);else range(d.id,'rumors.firstImpressionCap',r.firstImpressionCap,0,100,true)}
        for(const k of ['cellsPerDay','minAccuracy','maxAgeDays','neighbors','countMultiplier','suspicionPerPer']as const){if(!Number.isFinite(r[k]))report.errors.push(`${d.id}: rumors.${k} 필요`);else range(d.id,`rumors.${k}`,r[k],k==='suspicionPerPer'?0:Number.MIN_VALUE,k==='suspicionPerPer'?1:k==='minAccuracy'?100:k==='neighbors'?20:1000,k==='neighbors')}
        for(const k of ['chatterDays','accuracyLoss']as const)if(!Array.isArray(r[k])||r[k].length!==2||r[k].some(n=>!Number.isFinite(n)||n<0)||r[k][0]>r[k][1]||k==='chatterDays'&&r[k][0]<=0||k==='accuracyLoss'&&r[k].some(n=>!Number.isSafeInteger(n)||n>100))report.errors.push(`${d.id}: rumors.${k} 범위 오류`)
        if(!Array.isArray(r.distortionWeights)||r.distortionWeights.length!==5||r.distortionWeights.some(n=>!Number.isFinite(n)||n<0)||!r.distortionWeights.some(n=>n>0))report.errors.push(`${d.id}: rumors.distortionWeights 오류`)
        if(!Array.isArray(r.factions)||!r.factions.length||r.factions.some(f=>!keys.has(f)))report.errors.push(`${d.id}: rumors.factions 참조 오류`)
      }
    }
    if(!isObj(d.caravans))report.errors.push(`${d.id}: caravans 규정 필요`)
    else{const c=d.caravans;for(const key of ['intervalDays','feePerCell','wallet','maxGuards','maxUnits','encounterStopTurns']as const){if(!Number.isFinite(c[key]))report.errors.push(`${d.id}: caravans.${key} 필요`);else range(d.id,`caravans.${key}`,c[key],key==='maxGuards'?0:1,key==='maxGuards'?4:10000,true)}if(!Array.isArray(c.grid)||c.grid.length!==2||c.grid.some(n=>!Number.isSafeInteger(n)||n<1||n>10))report.errors.push(`${d.id}: caravans.grid 범위 오류`);if(!Array.isArray(c.items)||!c.items.length)report.errors.push(`${d.id}: caravans.items 필요`);else for(const id of c.items){need(d.id,id,'Item');if(!d.items[id])report.errors.push(`${d.id}: caravans.items는 실제 생산/소비 품목이어야 함`)}}

    if(!isObj(d.roadRaids))report.errors.push(`${d.id}: roadRaids 규정 필요`)
    else{const r=d.roadRaids;need(d.id,r.source,'RegionSite');need(d.id,r.containerTerrain,'Terrain');if(!keys.has(r.faction))report.errors.push(`${d.id}: roadRaids.faction 참조 오류`);if(typeof r.waypoint!=='string'||!r.waypoint.length)report.errors.push(`${d.id}: roadRaids.waypoint 필요`);if(!db.tryGet<TerrainDef>(r.containerTerrain)?.container)report.errors.push(`${d.id}: roadRaids.containerTerrain 실제 상자 필요`);for(const key of ['sourceRadius','territoryCells','firstDay','minMembers','maxMembers']as const){if(!Number.isFinite(r[key]))report.errors.push(`${d.id}: roadRaids.${key} 필요`);else range(d.id,`roadRaids.${key}`,r[key],1,key==='territoryCells'?8:key==='sourceRadius'?32:key==='minMembers'||key==='maxMembers'?6:10000,true)}if(r.minMembers>r.maxMembers)report.errors.push(`${d.id}: roadRaids 인원 한도 역전`);for(const key of ['chancePerMember','guardReduction']as const){if(!Number.isFinite(r[key]))report.errors.push(`${d.id}: roadRaids.${key} 필요`);else range(d.id,`roadRaids.${key}`,r[key],0,1)}if(!Number.isFinite(r.hostileAt))report.errors.push(`${d.id}: roadRaids.hostileAt 필요`);else range(d.id,'roadRaids.hostileAt',r.hostileAt,-100,0,true)}

    range(d.id, 'referencePopulation', d.referencePopulation, 1, Infinity, true)
    for (const [k, v] of Object.entries(d.defaultPopulation ?? {})) { if (!keys.has(k)) report.errors.push(`${d.id}: 알 수 없는 세력 '${k}'`); range(d.id, `defaultPopulation.${k}`, v, 1, Infinity, true) }
    for (const field of ['stock', 'stockTarget', 'production', 'consumption'] as const) for (const [k, v] of Object.entries(d[field] ?? {})) { if (!['Food','Fuel','Metal','Medicine','Ammo','Salt'].includes(k)) report.errors.push(`${d.id}: 알 수 없는 물자 '${k}'`); range(d.id, `${field}.${k}`, v, 0) }
    for (const [item, unit] of Object.entries(d.items ?? {})) { need(d.id, item, 'Item'); range(d.id, `items.${item}.units`, unit.units, Number.MIN_VALUE); if (!['Food','Fuel','Metal','Medicine','Ammo','Salt'].includes(unit.commodity)) report.errors.push(`${d.id}: 알 수 없는 물자 '${unit.commodity}'`) }
    for (const field of ['factionStock', 'factionProduction'] as const) for (const [faction, values] of Object.entries(d[field] ?? {})) {
      if (!keys.has(faction)) report.errors.push(`${d.id}: 알 수 없는 세력 '${faction}'`)
      for (const [commodity, value] of Object.entries(values)) { if (!['Food','Fuel','Metal','Medicine','Ammo','Salt'].includes(commodity)) report.errors.push(`${d.id}: 알 수 없는 물자 '${commodity}'`); range(d.id, `${field}.${faction}.${commodity}`, value, 0) }
    }
    if (d.disease) {
      need(d.id, d.disease.def, 'Disease')
      for (const key of ['quarantineAt','travelMult','transmission'] as const) range(d.id, `disease.${key}`, d.disease[key], 0, 1)
      range(d.id, 'disease.contacts', d.disease.contacts, 0); range(d.id, 'disease.medicineMult', d.disease.medicineMult, 1)
      if (!db.tryGet<DiseaseDef>(d.disease.def)?.population) report.errors.push(`${d.id}: 참조 질병에 인구 전파 계수가 없음`)
    }
  }
  for (const d of db.all<ClinicDef>('Clinic')) {
    need(d.id,d.doctor,'Creature')
    if (d.restock !== undefined) {
      if (!Number.isFinite(d.restock?.retryTurns) || !Array.isArray(d.restock?.targets)) report.errors.push(`${d.id}: restock retryTurns/targets가 필요함`)
      else {
        range(d.id,'restock.retryTurns',d.restock.retryTurns,1,100000,true)
        for (const target of d.restock.targets) {
          need(d.id,target.item,'Item'); for (const id of target.equivalents ?? []) need(d.id,id,'Item')
          if (![target.minimum,target.target,target.maxPrice].every(Number.isFinite)) report.errors.push(`${d.id}: restock minimum/target/maxPrice가 필요함`)
          range(d.id,'restock.minimum',target.minimum,1,100,true); range(d.id,'restock.target',target.target,1,100,true); range(d.id,'restock.maxPrice',target.maxPrice,1,100000,true)
          if (target.minimum > target.target) report.errors.push(`${d.id}: restock minimum/target 순서 오류`)
        }
      }
    }
    range(d.id,'doseTurns',d.doseTurns,1,10000,true)
    const seen = new Set<string>()
    if (!Array.isArray(d.prescriptions)) report.errors.push(`${d.id}: prescriptions가 필요함`)
    for (const prescription of Array.isArray(d.prescriptions) ? d.prescriptions : []) {
      need(d.id,prescription.item,'Item')
      const item = db.tryGet<ItemDef>(prescription.item), drug = item?.drug?.def && db.tryGet<DrugDef>(item.drug.def)
      if (!drug || item?.unidentified || item?.food || item?.drink) report.errors.push(`${d.id}: prescriptions.item은 알려진 약물이어야 함 (${prescription.item})`)
      if (seen.has(prescription.item)) report.errors.push(`${d.id}: prescriptions.item 중복 (${prescription.item})`)
      seen.add(prescription.item)
      if (!Number.isFinite(prescription.mastery) || !Number.isFinite(prescription.fee)) report.errors.push(`${d.id}: prescriptions.mastery/fee가 필요함`)
      range(d.id,'prescriptions.mastery',prescription.mastery,0,5,true); range(d.id,'prescriptions.fee',prescription.fee,0,100000,true)
    }
    for (const kind of ['diagnose','bandage','disinfect','tourniquet','splint','suture','ligate','tendon','amputate','extract','reduce'] as const) {
      if (!Number.isFinite(d.fees?.[kind])) report.errors.push(`${d.id}: fees.${kind}가 필요함`)
      else range(d.id,`fees.${kind}`,d.fees[kind],0,100000,true)
    }
    for (const [key, max] of [['turns', 10000], ['mastery', 5], ['quality', 100], ['pulseMastery', 5], ['abdomenMastery', 5], ['reportLimit', 100]] as const) {
      if (!Number.isFinite(d.examination?.[key])) report.errors.push(`${d.id}: examination.${key}가 필요함`)
      else range(d.id,`examination.${key}`,d.examination[key],key === 'mastery' ? 0 : 1,max,true)
    }
    if (!Array.isArray(d.supplies) || !d.supplies.length) report.errors.push(`${d.id}: supplies가 필요함`)
    else for (const supply of d.supplies) { need(d.id,supply.item,'Item'); range(d.id,'supplies.count',supply.count,1,1000,true); range(d.id,'supplies.appraisal',supply.appraisal,0,2,true) }
  }
  for (const d of db.all<CreatureDef>('Creature')) {
    if(d.temperatureLimits){const t=d.temperatureLimits;for(const key of ['min','max','dormantBelow']as const)if(!Number.isFinite(t[key]))report.errors.push(`${d.id}: temperatureLimits.${key} 필요`);if(t.min>=t.max||t.dormantBelow<t.min||t.dormantBelow>=t.max)report.errors.push(`${d.id}: temperatureLimits 순서 오류`);if(d.fixedBodyTemp!==undefined)report.errors.push(`${d.id}: temperatureLimits와 fixedBodyTemp 중복`)}
    if(d.parasite){
      const r=d.parasite
      if(!isObj(r))report.errors.push(`${d.id}: parasite 구조 오류`)
      else{
        for(const key of ['attachChance','diseaseChance']as const){if(!Number.isFinite(r[key]))report.errors.push(`${d.id}: parasite.${key} 필요`);else range(d.id,`parasite.${key}`,r[key],0,1)}
        for(const key of ['mlPerTurn','maxFedMl','maxOnHost','saltCount','saltTurns','manualTurns','severity']as const){if(!Number.isFinite(r[key]))report.errors.push(`${d.id}: parasite.${key} 필요`);else range(d.id,`parasite.${key}`,r[key],key==='mlPerTurn'?Number.MIN_VALUE:1,10000,!['mlPerTurn','maxFedMl'].includes(key))}
        need(d.id,r.saltItem,'Item');if(!((db.tryGet<ItemDef>(r.saltItem)?.saltGrams??0)>0))report.errors.push(`${d.id}: parasite.saltItem은 실제 소금이어야 함`)
        need(d.id,r.wound,'Wound');need(d.id,r.disease,'Disease')
        if(!Array.isArray(r.hostKinds)||!r.hostKinds.length||r.hostKinds.some(k=>!['humanoid','quadruped','amalgam','invertebrate'].includes(k)))report.errors.push(`${d.id}: parasite.hostKinds 오류`)
        if(!Array.isArray(r.parts)||!r.parts.length||r.parts.some(id=>!db.all<BodyDef>('Body').some(b=>Array.isArray(r.hostKinds)&&r.hostKinds.includes(b.kind!)&&b.parts.some(p=>p.id===id&&!p.internal))))report.errors.push(`${d.id}: parasite.parts 신체 참조 오류`)
      }
    }
    if(d.clinic) need(d.id,d.clinic,'Clinic')
    if(d.inn) need(d.id,d.inn,'Inn')
    for(const id of d.traits ?? []) need(d.id,id,'Trait')
  }
  for (const d of db.all<HandHygieneDef>('HandHygiene')) {
    for (const [key,min,max] of [['waterMl',1,10000],['washTurns',1,10000],['cleanTurns',1,1000000],['washedBonus',0,100],['dirtyPenalty',-100,0],['dirtyContam',0,100]] as const) {
      if (!Number.isFinite(d[key])) report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,true)
    }
  }
  for(const d of db.all<BeddingMoveDef>('BeddingMove')){
    need(d.id,d.defaultFloor,'Terrain')
    const floor=db.tryGet<TerrainDef>(d.defaultFloor)
    if(!floor?.passable||floor.bedding||floor.water||floor.station||floor.container||floor.stairs)report.errors.push(`${d.id}: defaultFloor는 빈 바닥이어야 함`)
    if(!Array.isArray(d.items)||!d.items.length)report.errors.push(`${d.id}: items가 필요함`)
    for(const id of Array.isArray(d.items)?d.items:[]){need(d.id,id,'Item');const item=db.tryGet<ItemDef>(id),terrain=item?.place&&db.tryGet<TerrainDef>(item.place);if(!terrain||!terrain.bedding||terrain.bedding.portable||item?.stackable)report.errors.push(`${d.id}: items는 고정 침구를 설치하는 실제 물품이어야 함`)}
    for(const [key,min,max,integer] of [['packTurns',1,28800,true],['coldAt',28,38,false],['warmRadius',1,6,true],['approachRadius',1,10,true],['retryTurns',1,100000,true]] as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,integer)}
    if(d.approachRadius<d.warmRadius)report.errors.push(`${d.id}: approachRadius는 warmRadius 이상이어야 함`)
  }
  const cleanBottle=db.tryGet<ItemDef>('Item.WaterBottle'),dirtyBottle=db.tryGet<ItemDef>('Item.DirtyWaterBottle')
  if(cleanBottle&&dirtyBottle&&(cleanBottle.uses!==dirtyBottle.uses||cleanBottle.drink?.water!==dirtyBottle.drink?.water))report.errors.push('물병 급수 전후 용량과 한 모금 단위가 같아야 함')
  for(const d of db.all<WaterSafetyDef>('WaterSafety'))if(d.batchMl!==undefined)range(d.id,'batchMl',d.batchMl,1,100000,true)
  for(const d of db.all<WaterSafetyDef>('WaterSafety'))if(d.snowDepthPerL!==undefined)range(d.id,'snowDepthPerL',d.snowDepthPerL,1,1000,true)
  for(const d of db.all<ItemDef>('Item'))if(d.waterVessel){
   const v=d.waterVessel,unit=d.drink?.water??0,capacityOf=(i:ItemDef)=>['Item.WaterBottle','Item.DirtyWaterBottle'].includes(i.id)?(i.uses??5)*(i.drink?.water??200):i.waterVessel?.capacityMl,ml=capacityOf(d)!
   range(d.id,'waterVessel.capacityMl',ml,1,100000,true)
   if(!d.drink||d.drink.alcohol||!Number.isFinite(unit)||unit<=0||ml%unit!==0||d.stackable||!Number.isFinite(d.uses)||d.uses!<0||d.uses!>ml/unit)report.errors.push(`${d.id}: waterVessel의 실제 개별 용량/한 회분/초기 잔량 오류`)
   for(const id of[v.clean,v.dirty]){
    need(d.id,id,'Item');const form=db.tryGet<ItemDef>(id)
    if(!form?.drink||form.drink.alcohol||form.drink.water!==unit||capacityOf(form)!==ml||form.stackable||JSON.stringify(form.size)!==JSON.stringify(d.size))report.errors.push(`${d.id}: waterVessel 형태의 실제 용량/칸/음수 단위가 달라짐`)
   }
  }
  for(const d of db.all<MaterialCraftingDef>('MaterialCrafting')){need(d.id,d.fragment,'Item');if(!db.tryGet<ItemDef>(d.fragment)?.rawFragment)report.errors.push(`${d.id}: fragment는 실제 rawFragment 물품이어야 함`)}
  for(const d of db.all<GearWeatherDef>('GearWeather')){need(d.id,d.looseBody,'Body');for(const[key,min,max,integer]of[['intervalTurns',1,1200,true],['dryPerTen',0,100,false],['fireDryPerTen',0,100,false],['fireRadius',0,6,true]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,integer)}}
  for(const d of db.all<BeddingContactDef>('BeddingContact')){
   if(!Number.isFinite(d.exchangePerHour))report.errors.push(`${d.id}: exchangePerHour가 필요함`);else range(d.id,'exchangePerHour',d.exchangePerHour,0,10,false)
   const lice=d.lice
   if(lice){
    if(!Array.isArray(lice.hostBodies)||!lice.hostBodies.length)report.errors.push(`${d.id}: lice.hostBodies가 필요함`)
    else for(const id of lice.hostBodies)need(d.id,id,'Body')
    for(const[key,min,max,integer]of[['checkTurns',1,28800,true],['contactChance',0,1,false],['surviveTurns',1,864000,true],['washTurns',1,28800,true],['washWaterMl',1,10000,true]]as const){if(!Number.isFinite(lice[key]))report.errors.push(`${d.id}: lice.${key}가 필요함`);else range(d.id,`lice.${key}`,lice[key],min,max,integer)}
   }
   const f=d.fire;if(!f)continue
   need(d.id,f.defaultFloor,'Terrain')
   for(const[key,min,max,integer]of[['checkTurns',1,28800,true],['sparkChance',0,1,false],['flammabilityDivisor',.1,100,false],['dryBelow',1,100,false],['burnTurns',1,28800,true],['damageEvery',1,1200,true],['damage',1,100,true],['waterMl',1,10000,true],['light',1,12,true]]as const){if(!Number.isFinite(f[key]))report.errors.push(`${d.id}: fire.${key}가 필요함`);else range(d.id,`fire.${key}`,f[key],min,max,integer)}
   for(const[terrain,material]of Object.entries(f.materials??{})){need(d.id,terrain,'Terrain');need(d.id,material,'Material');if(!db.tryGet<TerrainDef>(terrain)?.bedding)report.errors.push(`${d.id}: fire.materials는 실제 침구 지형이어야 함`)}
   for(const[material,mult]of Object.entries(f.burnMultipliers??{})){need(d.id,material,'Material');range(d.id,`fire.burnMultipliers.${material}`,mult,.1,10,false)}
  }
  for(const d of db.all<TerrainDef>('Terrain'))if(d.combustion){const b=d.combustion;need(d.id,b.burnedAs,'Terrain');range(d.id,'combustion.burnTurns',b.burnTurns,1,86400,true);if(typeof b.family!=='string'||!b.family)report.errors.push(d.id+': 연소 재료 식별이 필요함');if(b.burnedAs===d.id)report.errors.push(d.id+': 소진된 지형이 같을 수 없음')}
  for(const d of db.all<CampfireDef>('Campfire')){
   need(d.id,d.terrain,'Terrain');need(d.id,d.kit,'Item');need(d.id,d.fuel,'Item')
   const f=d.wildfire;if(f){for(const k of ['checkTurns','damageEvery','waterProtectionTurns']as const)range(d.id,'wildfire.'+k,f[k],1,28800,true);for(const k of ['sparkChance','rainExtinguishChance']as const)range(d.id,'wildfire.'+k,f[k],0,1);range(d.id,'wildfire.spreadRadius',f.spreadRadius,1,3,true);range(d.id,'wildfire.damageRadius',f.damageRadius,0,1,true);range(d.id,'wildfire.damage',f.damage,1,100);range(d.id,'wildfire.waterMl',f.waterMl,1,10000,true);range(d.id,'wildfire.light',f.light,1,12,true)}
   if(db.tryGet<ItemDef>(d.kit)?.place!==d.terrain)report.errors.push(`${d.id}: kit는 실제 모닥불 terrain을 설치해야 함`)
   for(const[key,min,max]of[['fuelTurns',1,28800],['maxFuelTurns',1,86400],['igniteTurns',1,1200],['stokeTurns',1,100],['wetAt',1,100],['wetMultiplier',1,10],['radius',1,12],['workerTarget',1,86400]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
   if(d.maxFuelTurns<d.fuelTurns||d.workerTarget>d.maxFuelTurns-d.fuelTurns||d.workerTarget<d.fuelTurns)report.errors.push(`${d.id}: 연료 용량/작업 목표 범위가 잘못됨`)
  }
  for(const d of db.all<BaseRestDef>('BaseRest')){
   for(const[key,min,max]of[['assignTurns',1,20],['prepareKcal',0,2500],['prepareWater',0,1000],['warmBelow',35,37],['debtAt',1,100]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,key!=='warmBelow')}
  }
  for(const d of db.all<BaseWaterDef>('BaseWater')){
   for(const[key,min,max]of[['unitMl',100,5000],['maxAsh',0,100]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
   if(!Array.isArray(d.methods)||!d.methods.length||new Set(d.methods).size!==d.methods.length||d.methods.some((m)=>!['boil','cloth','charcoal','pill'].includes(m)))report.errors.push(`${d.id}: 실제 능동 정수 methods가 필요함`)
  }
  for(const e of db.all<EventDef>('PlaceEvent'))if(e.director!==undefined){const d=e.director;if(!d||typeof d!=='object'||Array.isArray(d)){report.errors.push(e.id+': director 객체 필요');continue;}for(const key of ['incomePerHour','capHours','graceHours','gracePercent','enhanceCost','chanceBoost']as const){if(!Number.isFinite(d[key]))report.errors.push(e.id+': director.'+key+' 필요');else range(e.id,'director.'+key,d[key],key==='graceHours'?0:1,key==='chanceBoost'?50:10000,true)}if(!Array.isArray(d.profiles)||!d.profiles.length||d.profiles.some(p=>!p||typeof p!=='object'||Array.isArray(p))||new Set(d.profiles.map(p=>p.key)).size!==d.profiles.length)report.errors.push(e.id+': director 실제 서로 다른 성향 필요');else for(const p of d.profiles){if(typeof p.key!=='string'||!p.key||typeof p.label!=='string'||!p.label||typeof p.description!=='string'||!p.description||!['hold','ignore','press'].includes(p.recovery))report.errors.push(e.id+': director 성향 오류');for(const key of ['incomePercent','restHours']as const)if(!Number.isSafeInteger(p[key])||p[key]<(key==='restHours'?0:1)||p[key]>1000)report.errors.push(e.id+': director.'+key+' 오류');if(!Array.isArray(p.spendPercent)||p.spendPercent.length!==2||p.spendPercent.some(n=>!Number.isSafeInteger(n)||n<1||n>200)||p.spendPercent[0]>p.spendPercent[1])report.errors.push(e.id+': director 사용 비율 오류');if(!Array.isArray(p.target)||p.target.length<2||p.target[0]?.[0]!==0||p.target.some((v,i)=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||v[1]<0||v[1]>100||i>0&&v[0]<=p.target[i-1][0]))report.errors.push(e.id+': director 목표 곡선 오류')}}
  for(const e of db.all<EventDef>('PlaceEvent'))if(e.director?.fame!==undefined){const r=e.director.fame;if(!r||typeof r!=='object'||Array.isArray(r)){report.errors.push(e.id+': fame 객체 필요');continue}if(!Number.isSafeInteger(r.weeklyDecay)||r.weeklyDecay<0||r.weeklyDecay>100)report.errors.push(e.id+': fame 주간 감소 오류');if(!Array.isArray(r.awards)||!r.awards.length||r.awards.some(a=>!a||typeof a!=='object'||typeof a.key!=='string'||!a.key||!Number.isSafeInteger(a.amount)||a.amount<=0||a.amount>100||a.source!==undefined&&typeof a.source!=='boolean'||a.creatures!==undefined&&(!Array.isArray(a.creatures)||a.creatures.some(id=>typeof id!=='string'))||!a.source&&!a.creatures?.length))report.errors.push(e.id+': fame 실제 승리 보상 필요');else{if(new Set(r.awards.map(a=>a.key)).size!==r.awards.length)report.errors.push(e.id+': fame 서로 다른 보상 필요');for(const a of r.awards)for(const id of a.creatures??[])need(e.id,id,'Creature')}}
  for(const e of db.all<EventDef>('PlaceEvent'))if(e.director?.tension!==undefined){const r=e.director.tension;if(!r||typeof r!=='object'||Array.isArray(r))report.errors.push(e.id+': tension 객체 필요');else for(const key of ['calmPerHour','safeSleepPerHour','recentThreatTurns','campRadius','maxRoomCells']as const)if(!Number.isSafeInteger(r[key])||r[key]<1||r[key]>(key==='maxRoomCells'?4096:key==='campRadius'?20:28800))report.errors.push(e.id+': tension.'+key+' 오류')}
  for(const e of db.all<EventDef>('PlaceEvent'))if(e.director?.unitCosts!==undefined){const r=e.director.unitCosts;if(!r||typeof r!=='object'||Array.isArray(r))report.errors.push(e.id+': unitCosts 객체 필요');else for(const[id,cost]of Object.entries(r)){need(e.id,id,'Creature');if(!Number.isSafeInteger(cost)||cost<1||cost>10000)report.errors.push(e.id+': unitCosts 실제 단가 오류')}}
  for(const e of db.all<EventDef>('PlaceEvent'))if(e.director?.search!==undefined){const r=e.director.search;if(!r||typeof r!=='object'||Array.isArray(r))report.errors.push(e.id+': search 강화 객체 필요');else for(const key of ['maxMembers','sourceRadius']as const)if(!Number.isSafeInteger(r[key])||r[key]<2||r[key]>20)report.errors.push(e.id+': search.'+key+' 오류')}
  for(const e of db.all<EventDef>('PlaceEvent')){
    if(!['Threat','Consequence'].includes(e.category??'')||!e.origin||typeof e.origin!=='object'||Array.isArray(e.origin)){report.errors.push(e.id+': 실제 장소 사건의 category/origin 필요');continue}
    const o=e.origin
    if(o.kind==='camp'){if(!db.all<FactionDef>('Faction').some(f=>f.key===o.faction)||typeof o.waypoint!=='string'||!o.waypoint||!Number.isSafeInteger(o.minMembers)||o.minMembers<1)report.errors.push(e.id+': 실제 야영지 출발지 오류')}
    else if(o.kind==='population'){if(o.source!=='@roomPopulation')report.errors.push(e.id+': 실제 방 공급원 출발지 필요')}
    else if(o.kind==='party'){if(typeof o.event!=='string'||!o.event||o.event===e.id)report.errors.push(e.id+': 실제 다른 원래 파견 사건 필요');else need(e.id,o.event,'PlaceEvent')}
    else report.errors.push(e.id+': 실제 출발지 종류 오류')
    if(!e.composition||typeof e.composition!=='object'||Array.isArray(e.composition)||e.composition.fromPopulation!==true)report.errors.push(e.id+': composition.fromPopulation은 true여야 한다')
    if(!Array.isArray(e.traces)||!e.traces.length||e.traces.some(t=>typeof t!=='string'||!t))report.errors.push(e.id+': 실제 흔적 필요')
    if(e.place!==undefined){const r=e.place,count=e.composition?.count;if(!r||typeof r!=='object'||Array.isArray(r)){report.errors.push(e.id+': place 객체 필요');continue}if(!['patrol','search'].includes(r.kind)||o.kind!=='camp')report.errors.push(e.id+': 실제 장소 행동/야영지 출발지 필요');if(!Array.isArray(count)||count.length!==2||count.some(n=>!Number.isSafeInteger(n)||n<1||n>20)||count[0]>count[1])report.errors.push(e.id+': 실제 편성 범위 오류');for(const key of ['chance','leaderChance']as const)if(!Number.isFinite(r[key])||r[key]<0||r[key]>1)report.errors.push(e.id+': place.'+key+' 오류');if(typeof r.leader!=='string'||!r.leader)report.errors.push(e.id+': 실제 두목 Creature 필요');else need(e.id,r.leader,'Creature');if(!Array.isArray(r.route)||!r.route.length||r.route.some(key=>typeof key!=='string'||!key||key.startsWith('@')&&!['@home','@trace','@stash'].includes(key)))report.errors.push(e.id+': 실제 경유 경로 필요');if(!Number.isSafeInteger(r.waitTurns)||r.waitTurns<0||r.waitTurns>28800)report.errors.push(e.id+': place 대기 시간 오류')}
  }
  for(const d of db.all<BaseLogisticsDef>('BaseLogistics')){if(d.cultivation){for(const k of ['doseMl','waterBelowMl','reserveWaterMl']as const){if(!Number.isFinite(d.cultivation[k]))report.errors.push(d.id+': cultivation.'+k+' 필요');else range(d.id,'cultivation.'+k,d.cultivation[k],1,100000,true)}}for(const[key,min,max]of[['pickupTurns',1,20],['minFreshness',1,100]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}}
  for(const d of db.all<BaseDefenseDef>('BaseDefense')){
   if(typeof d.sourceWaypoint!=='string'||!d.sourceWaypoint.trim())report.errors.push(`${d.id}: sourceWaypoint가 필요함`)
   if(!db.all<FactionDef>('Faction').some((f)=>f.key===d.faction))report.errors.push(`${d.id}: 실제 세력 faction이 필요함`)
   for(const[key,min,max]of[['firstDelayTurns',1,201600],['intervalTurns',1,201600],['planningTurns',1,28800],['timeoutTurns',20,28800],['minMembers',1,6],['maxMembers',1,6],['sourceRadius',1,20],['noticeRadius',1,20],['lootStacks',1,5]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
   if(!Number.isFinite(d.chance))report.errors.push(`${d.id}: chance가 필요함`);else range(d.id,'chance',d.chance,0,1,false)
   if(d.minMembers>d.maxMembers)report.errors.push(`${d.id}: 병력 범위 순서가 잘못됨`)
  }
  for(const d of db.all<BaseCampDef>('BaseCamp')){
   need(d.id,d.storeTerrain,'Terrain');const terrain=db.tryGet<TerrainDef>(d.storeTerrain)
   if(terrain&&(!terrain.container||terrain.container!=='Loot.Empty'||!terrain.lootGrid))report.errors.push(`${d.id}: 실제 빈 저장고 지형이어야 함`)
   for(const[key,min,max]of[['claimTurns',1,28800],['radius',1,12],['maxBatches',1,99]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
  }
  for(const d of db.all<NpcCustodyDef>('NpcCustody')){
   need(d.id,d.ropeRecipe,'Recipe')
   const recipe=db.tryGet<RecipeDef>(d.ropeRecipe)
   if(recipe&&(recipe.output.item!==db.tryGet<PrisonerDef>('Prisoner.Hearth')?.rope||recipe.passiveTurns))report.errors.push(`${d.id}: 실제 밧줄을 바로 만드는 제작법이어야 함`)
   const roles=['guard','raider','civilian','boss','packHunter','skittish']
   if(!Array.isArray(d.roles)||!d.roles.length||new Set(d.roles).size!==d.roles.length||d.roles.some((r)=>!roles.includes(r)))report.errors.push(`${d.id}: roles가 잘못됨`)
   for(const[key,min,max]of[['careBelowKcal',0,2500],['drinkAbove',1,1500],['minFreshness',1,100]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
  }
  for(const d of db.all<RescueDef>('Rescue')){
   for(const[key,min,max]of[['mercyTurns',1200,201600],['restTurns',1,1200],['bond',0,20]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
  }
  for(const d of db.all<RecruitmentDef>('Recruitment')){
   for(const[key,min,max]of[['conversationTurns',1,28800],['days',1,30],['careKcal',1,2500],['careWater',1,1000],['minMorale',0,100],['probationDays',1,3],['inviteTurns',1,20]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
  }
  for(const d of db.all<PrisonerEscortDef>('PrisonerEscort')){
   for(const[key,min,max]of[['escortTurns',1,28800],['holdTurns',1,28800],['leashRadius',1,3]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
  }
  for(const d of db.all<PrisonerCareDef>('PrisonerCare')){
   for(const[key,min,max]of[['sleepAt',1,100],['wakeAt',0,99],['wakeTurns',1,20],['awakeTurns',1,200],['guardRadius',1,8],['struggleTurns',1,28800],['ropeWear',1,100]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
   if(!Number.isFinite(d.escapeChance))report.errors.push(`${d.id}: escapeChance가 필요함`);else range(d.id,'escapeChance',d.escapeChance,0,1,false);if(d.wakeAt>=d.sleepAt)report.errors.push(`${d.id}: 수면 임계 순서가 잘못됨`)
  }
  for(const d of db.all<PrisonerDef>('Prisoner')){
    need(d.id,d.rope,'Item')
    for(const key of ['bindTurns','releaseTurns','interrogateTurns','executeTurns','mercyTurns']as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],1,28800,true)}
    range(d.id,'releaseReputation',d.releaseReputation,0,10,true);range(d.id,'executeReputation',d.executeReputation,-20,0,true)
    for(const[key,min,max]of[['exaggerationChance',0,1],['exaggerationMult',1,2],['rumorLow',.1,1],['rumorHigh',1,2]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,false)}
  }
  for(const d of db.all<CompanionBondDef>('CompanionBond')){
    for(const key of ['initial','min','max','leaveAt','together','sharedTrait','wage','arrears','betrayal']as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],-100,100,true)}
    for(const[key,min,max]of[['periodTurns',1,28800],['range',1,12],['positivePerDay',0,100],['moraleDivisor',1,100],['moraleCap',0,20]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
    if(!(d.min<d.leaveAt&&d.leaveAt<d.initial&&d.initial<=d.max))report.errors.push(`${d.id}: 관계 범위/종료 임계가 잘못됨`)
    if(!Array.isArray(d.personalities)||!d.personalities.length||new Set(d.personalities).size!==d.personalities.length)report.errors.push(`${d.id}: personalities가 필요하며 중복할 수 없음`)
    for(const id of d.personalities??[])need(d.id,id,'Trait')
    if(!Array.isArray(d.conflicts))report.errors.push(`${d.id}: conflicts가 필요함`)
    const pairs=new Set<string>()
    for(const pair of d.conflicts??[]){need(d.id,pair.a,'Trait');need(d.id,pair.b,'Trait');const key=[pair.a,pair.b].sort().join('|');if(pairs.has(key)||pair.a===pair.b||!Number.isInteger(pair.delta)||pair.delta>=0||pair.delta<-100)report.errors.push(`${d.id}: conflicts의 중복 없는 서로 다른 특성/음수 정수 delta가 필요함`);pairs.add(key)}
  }
  for(const d of db.all<CompanionDef>('Companion')){
    for(const[key,min,max]of[['hireFee',1,100000],['dailyWage',1,100000],['maxMembers',1,8],['minReputation',-100,100],['followDistance',1,4],['arrivalRadius',1,6],['defendRadius',1,12],['eatBelow',0,2500],['drinkAbove',0,2000],['sleepAt',1,100],['wakeAt',0,99]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,true)}
    if(d.joinRadius<d.followDistance||d.sleepAt<=d.wakeAt)report.errors.push(`${d.id}: 동행 거리/수면 임계 순서가 잘못됨`)
  }
  for(const d of db.all<ColdConfusionDef>('ColdConfusion')){
    for(const[key,min,max,integer]of[['temperature',28,36,false],['consciousness',0,1,false],['intervalTurns',1,28800,true],['chance',0,1,false]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`);else range(d.id,key,d[key],min,max,integer)}
    if(!Array.isArray(d.slots)||!d.slots.length||d.slots.some((s)=>!['back','chest'].includes(s))||new Set(d.slots).size!==d.slots.length)report.errors.push(`${d.id}: slots는 중복 없는 외투 칸이어야 함`)
  }
  for(const d of db.all<FactionRelationsDef>('FactionRelations')){
    range(d.id,'returnPerDay',d.returnPerDay,0,100,true)
    for(const kind of ['raid','caravan','commonEnemy','release','execution','grudge'] as const){
      const event=d.events?.[kind]
      if(!event){report.errors.push(`${d.id}: events.${kind}가 필요함`);continue}
      for(const key of ['delta','baseline'] as const){if(!Number.isFinite(event[key]))report.errors.push(`${d.id}: events.${kind}.${key}가 필요함`);else range(d.id,`events.${kind}.${key}`,event[key],-100,100,true)}
    }
  }
  for(const d of db.all<InvestigationDef>('Investigation')){
    for(const [key,min,max,integer] of [['refreshDays',1,365,true],['deadlineBufferDays',1,365,true],['baseReward',1,100000,true],['distanceReward',0,1000,true],['threatReward',0,100,false],['threatPerDepth',0,1000,true],['wealthMult',.7,1.5,false],['reputation',0,10,true]] as const){
      if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,integer)
    }
  }
  for(const d of db.all<PrisonerExchangeDef>('PrisonerExchange'))if(!Number.isSafeInteger(d.turns)||d.turns<1||d.turns>28800)report.errors.push(d.id+': prisonerExchange.turns 오류')
  for(const d of db.all<RansomDef>('Ransom'))for(const key of ['price','turns']as const)if(!Number.isSafeInteger(d[key])||d[key]<1||d[key]>(key==='price'?1000000000:28800))report.errors.push(d.id+': ransom.'+key+' 오류')
  for(const d of db.all<NpcAbductionDef>('NpcAbduction')){if(!Array.isArray(d.roles)||!d.roles.length||d.roles.some(r=>!['raider','guard'].includes(r)))report.errors.push(d.id+': npcAbduction.roles 오류');for(const key of ['approachRange','homeRadius','minKcal','maxWaterDeficit','maxFatigue']as const)if(!Number.isSafeInteger(d[key])||d[key]<(key==='homeRadius'||key==='minKcal'?0:1)||d[key]>(key==='approachRange'?30:key==='homeRadius'?3:key==='maxFatigue'?100:10000))report.errors.push(d.id+': npcAbduction.'+key+' 오류')}
  for(const d of db.all<RescueRemainsDef>('RescueRemains'))for(const key of ['surveyTurns','minDurability']as const)if(!Number.isSafeInteger(d[key])||d[key]<(key==='surveyTurns'?1:0)||d[key]>(key==='surveyTurns'?100000:100))report.errors.push(d.id+': rescueRemains.'+key+' 오류')
  for(const d of db.all<RescueContractDef>('RescueContract'))for(const key of ['refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','threat','wealthMult','reputation']as const)if(!Number.isFinite(d[key])||d[key]<(key==='wealthMult'?.7:['distanceReward','threatReward','threat','reputation'].includes(key)?0:1)||d[key]>(key==='wealthMult'?1.5:100000)||['refreshDays','deadlineBufferDays','reputation'].includes(key)&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': rescueContract.'+key+' 오류')
  for(const d of db.all<RecoveryContractDef>('RecoveryContract')){
    for(const key of ['refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','wealthMult','reputation','minDurability']as const)if(!Number.isFinite(d[key])||d[key]<(key==='wealthMult'?.7:key==='distanceReward'||key==='threatReward'||key==='reputation'||key==='minDurability'?0:1)||d[key]>(key==='wealthMult'?1.5:key==='minDurability'?100:100000)||['refreshDays','deadlineBufferDays','reputation','minDurability'].includes(key)&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': recoveryContract.'+key+' 오류')
    if(!Array.isArray(d.targets)||!d.targets.length||d.targets.some(t=>!isObj(t)||(['key','label','region','mapId','terrain','item']as const).some(k=>typeof t[k]!=='string'||!t[k])||!Array.isArray(t.pos)||t.pos.length!==2||t.pos.some(v=>!Number.isSafeInteger(v)||v<0||v>=128)||!Number.isFinite(t.threat)||t.threat<0)||new Set(d.targets.map(t=>t?.key)).size!==d.targets.length){report.errors.push(d.id+': recoveryContract 실제 장소/물품 주소 오류');continue}
    for(const target of d.targets){need(d.id,target.region,'RegionSite');need(d.id,target.terrain,'Terrain');need(d.id,target.item,'Item');const item=db.tryGet<ItemDef>(target.item);if(item?.stackable||item?.unidentified||!db.tryGet<TerrainDef>(target.terrain)?.container)report.errors.push(d.id+': recoveryContract 개별 식별 물품/용기 필요')}
  }
  for(const d of db.all<ResidentCultivationDef>('ResidentCultivation')){
    if(d.preparation!==undefined){const q=d.preparation;if(!q||typeof q!=='object'||Array.isArray(q))report.errors.push(d.id+': residentCultivation.preparation 객체 필요');else{if(!Array.isArray(q.factions)||!q.factions.length||q.factions.some(f=>!db.all<FactionDef>('Faction').some(x=>x.key===f))||new Set(q.factions).size!==q.factions.length)report.errors.push(d.id+': preparation.factions 오류');need(d.id,q.recipe,'Recipe');const recipe=db.tryGet<RecipeDef>(q.recipe),out=recipe&&db.tryGet<ItemDef>(recipe.output.item);if(!recipe||!recipe.basic||recipe.output.count!==1||recipe.passiveTurns||recipe.materialInputs?.length||recipe.waterTreatment||recipe.boiledMeal||recipe.evaporation||recipe.preservation||recipe.tools?.length||recipe.stations?.some(s=>s!=='hand')||!out?.place||!db.tryGet<TerrainDef>(out.place)?.cultivation||recipe.workTurns>2000)report.errors.push(d.id+': 실제 단일 배지의 기본 손 제작법 필요');for(const[key,lo,hi]of[['reserveMoney',0,100000],['maxUnitPrice',1,100000],['retryTurns',1,28800]]as const)if(!Number.isSafeInteger(q[key])||q[key]<lo||q[key]>hi)report.errors.push(d.id+': preparation.'+key+' 오류')}}
    if(d.surplus!==undefined){if(!d.surplus||typeof d.surplus!=='object'||Array.isArray(d.surplus))report.errors.push(d.id+': residentCultivation.surplus 객체 필요');else for(const[key,lo,hi]of[['reserveKcal',0,10000],['retryTurns',1,28800],['maxUnits',1,10]]as const)if(!Number.isSafeInteger(d.surplus[key])||d.surplus[key]<lo||d.surplus[key]>hi)report.errors.push(d.id+': residentCultivation.surplus.'+key+' 오류')}
    if(typeof d.enabled!=='boolean'||!Array.isArray(d.roles)||!d.roles.length||d.roles.some(r=>!['civilian','guard'].includes(r))||new Set(d.roles).size!==d.roles.length)report.errors.push(d.id+': residentCultivation 활성화/주민 역할 오류')
    for(const[key,lo,hi]of[['homeRadius',1,8],['doseMl',1,1000],['waterBelowMl',1,1000],['reserveWaterMl',0,5000],['minKcal',0,2500],['maxWaterDeficit',1,2000],['maxFatigue',1,100],['minBodyTemp',25,42],['maxBodyTemp',26,43]]as const)if(!Number.isFinite(d[key])||d[key]<lo||d[key]>hi||!['minBodyTemp','maxBodyTemp'].includes(key)&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': residentCultivation.'+key+' 오류')
    if(d.minBodyTemp>=d.maxBodyTemp)report.errors.push(d.id+': residentCultivation 체온 순서 오류')
  }
  for(const d of db.all<PostureDef>('Posture')){
    for(const key of ['movementTurns','meleeHit','rangedTargetHit','noiseMult']as const)if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}는 유한한 수여야 한다`)
    range(d.id,'movementTurns',d.movementTurns,1,100,true);range(d.id,'noiseMult',d.noiseMult,0,1);range(d.id,'meleeHit',d.meleeHit,-95,95,true);range(d.id,'rangedTargetHit',d.rangedTargetHit,-95,95,true)
  }
  for(const d of db.all<ManeuverDef>('Maneuver')){
    if(!['trip','disarm'].includes(d.kind))report.errors.push(`${d.id}: 알 수 없는 기본 전투 행동`)
    for(const key of ['noise','energy','turns','base','min','max','differenceMultiplier','shortBladeBonus','twoHandedBonus','quadrupedBalance']as const)if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}는 유한한 수여야 한다`)
    range(d.id,'noise',d.noise,0);range(d.id,'energy',d.energy,0);range(d.id,'turns',d.turns,1);range(d.id,'min',d.min,0,100);range(d.id,'max',d.max,d.min,100)
    if(!Number.isSafeInteger(d.turns))report.errors.push(`${d.id}: turns는 정수여야 한다`)
    if(!d.weaponBonus||typeof d.weaponBonus!=='object'||Array.isArray(d.weaponBonus)||Object.values(d.weaponBonus).some(v=>typeof v!=='number'||!Number.isFinite(v)))report.errors.push(`${d.id}: 무기 보정은 유한한 수여야 한다`)
  }
  for(const d of db.all<NpcCareDef>('NpcCare')){
    if(typeof d.enabled!=='boolean')report.errors.push(d.id+': npcCare.enabled 오류')
    need(d.id,d.sourceRules,'NpcSocial')
    if(d.bondBonus!==undefined&&(!Number.isSafeInteger(d.bondBonus)||d.bondBonus<0||d.bondBonus>10))report.errors.push(d.id+': npcCare.bondBonus 오류')
    for(const[key,lo,hi]of[['minBond',1,100],['minMedicine',0,5],['minBleed',.001,100],['minKcal',0,2500],['maxWaterDeficit',1,2000],['maxFatigue',1,100],['minBodyTemp',25,42],['maxBodyTemp',26,43],['witnessRange',1,8],['historyLimit',1,30]]as const)if(!Number.isFinite(d[key])||d[key]<lo||d[key]>hi||!['minBleed','minBodyTemp','maxBodyTemp'].includes(key)&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': npcCare.'+key+' 오류')
    if(d.minBodyTemp>=d.maxBodyTemp)report.errors.push(d.id+': npcCare 체온 순서 오류')
  }
  for(const d of db.all<NpcIdentityDef>('NpcIdentity')){
    if(typeof d.enabled!=='boolean'||!Array.isArray(d.bodies)||!d.bodies.length||d.bodies.some(b=>typeof b!=='string')||new Set(d.bodies).size!==d.bodies.length)report.errors.push(d.id+': npcIdentity 몸/활성화 오류')
    else for(const b of d.bodies){need(d.id,b,'Body');if(db.tryGet<BodyDef>(b)?.kind!=='humanoid')report.errors.push(d.id+': npcIdentity 인간 몸 필요')}
    if(!Array.isArray(d.names)||!d.names.length||d.names.length>256||d.names.some(n=>typeof n!=='string'||!n.trim()||n!==n.trim()||n.length>24)||new Set(d.names).size!==d.names.length)report.errors.push(d.id+': npcIdentity 중복 없는 이름 목록 필요')
    if(typeof d.format!=='string'||d.format.length>160||d.format.split('{name}').length!==2||d.format.split('{role}').length!==2||/[{}]/.test(d.format.replace('{name}','').replace('{role}','')))report.errors.push(d.id+': npcIdentity 이름/역할 표시 형식 오류')
  }
  for(const d of db.all<NpcSocialReportDef>('NpcSocialReport')){
    need(d.id,d.sourceRules,'NpcSocial')
    if(!Number.isSafeInteger(d.positiveAt)||d.positiveAt<0||d.positiveAt>100||!Number.isSafeInteger(d.negativeAt)||d.negativeAt>=0||d.negativeAt< -100||!Number.isSafeInteger(d.maxPeople)||d.maxPeople<1||d.maxPeople>10)report.errors.push(d.id+': npcSocialReport 임계/인원 오류')
    const source=db.tryGet<NpcSocialDef>(d.sourceRules);if(source&&(d.negativeAt<source.min||d.positiveAt>source.max))report.errors.push(d.id+': npcSocialReport 관계 범위 불일치')
  }
  for(const d of db.all<NpcSocialDef>('NpcSocial')){
    if(typeof d.enabled!=='boolean'||!Array.isArray(d.roles)||!d.roles.length||d.roles.some(r=>!['guard','civilian','raider','boss'].includes(r))||new Set(d.roles).size!==d.roles.length)report.errors.push(d.id+': npcSocial enabled/roles 오류')
    for(const[key,lo,hi,integer]of[['intervalTurns',1,28800,true],['range',1,1,true],['witnessRange',1,8,true],['minKcal',0,2500,true],['maxWaterDeficit',1,2000,true],['maxFatigue',1,100,true],['minBodyTemp',25,42,false],['maxBodyTemp',26,43,false],['baseDelta',-10,10,true],['sharedTraitBonus',0,10,true],['gainPerDay',1,100,true],['lossPerDay',1,100,true],['min',-100,-1,true],['max',1,100,true],['minSpeakScore',-100,100,true],['historyLimit',1,30,true]]as const)if(!Number.isFinite(d[key])||d[key]<lo||d[key]>hi||integer&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': npcSocial.'+key+' 오류')
    if(d.minBodyTemp>=d.maxBodyTemp||d.minSpeakScore<d.min||d.minSpeakScore>d.max)report.errors.push(d.id+': npcSocial 임계 순서 오류')
    need(d.id,d.personalityRules,'CompanionBond')
  }
  for(const d of db.all<ExcavationContractDef>('ExcavationContract')){
    for(const[key,lo,hi]of[['refreshDays',1,30],['deadlineBufferDays',1,30],['baseReward',1,100000],['distanceReward',0,1000],['threatReward',0,1000],['wealthMult',.7,1.5],['reputation',0,100],['workTurns',1,1200],['minDurability',0,100]]as const)if(!Number.isFinite(d[key])||d[key]<lo||d[key]>hi||!['distanceReward','threatReward','wealthMult'].includes(key)&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': excavationContract.'+key+' 오류')
    if(typeof d.tool!=='string'||!d.tool||!db.all<ItemDef>('Item').some(i=>i.toolTags?.includes(d.tool)))report.errors.push(d.id+': excavationContract 실제 도구 태그 필요')
    if(!Array.isArray(d.targets)||!d.targets.length||d.targets.some(t=>!isObj(t)||(['key','label','region','mapId','layout','terrain','item']as const).some(k=>typeof t[k]!=='string'||!t[k])||!Array.isArray(t.pos)||t.pos.length!==2||t.pos.some(v=>!Number.isSafeInteger(v)||v<0||v>=128)||!Number.isFinite(t.threat)||t.threat<0)||new Set(d.targets.map(t=>t?.key)).size!==d.targets.length){report.errors.push(d.id+': excavationContract 실제 현장 주소 오류');continue}
    for(const t of d.targets){need(d.id,t.region,'RegionSite');need(d.id,t.terrain,'Terrain');need(d.id,t.item,'Item');need(d.id,t.layout,'RegionLayout');const layout=db.tryGet<RegionLayoutDef>(t.layout),object=layout?.objects.find(o=>o.pos[0]===t.pos[0]&&o.pos[1]===t.pos[1]);if(!layout||layout.mapId!==t.mapId||object?.terrain!==t.terrain||!object.items?.some(i=>i.item===t.item&&i.count===1))report.errors.push(d.id+': excavationContract 최초 배치된 원본 보관함 필요')}
  }
  for(const d of db.all<EscortContractDef>('EscortContract')){
    need(d.id,d.routeRules,'PatrolContract')
    for(const[key,lo,hi]of[['refreshDays',1,30],['deadlineDays',1,30],['baseReward',1,100000],['reputation',0,100],['followDistance',1,2],['maxFollowDistance',2,16]]as const)if(!Number.isSafeInteger(d[key])||d[key]<lo||d[key]>hi)report.errors.push(d.id+': escortContract.'+key+' 오류')
    if(d.followDistance>=d.maxFollowDistance)report.errors.push(d.id+': escortContract 따라갈 거리 순서 오류')
  }
  for(const d of db.all<PatrolContractDef>('PatrolContract')){
    for(const key of ['refreshDays','deadlineDays','baseReward','threatReward','wealthMult','reputation']as const)if(!Number.isFinite(d[key])||d[key]<(key==='wealthMult'?.7:key==='threatReward'||key==='reputation'?0:1)||d[key]>(key==='wealthMult'?1.5:100000)||['refreshDays','deadlineDays','reputation'].includes(key)&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': patrolContract.'+key+' 오류')
    const pos=(p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isSafeInteger(v)&&v>=0&&v<128)
    if(!Array.isArray(d.routes)||!d.routes.length||d.routes.some(r=>!isObj(r)||(['key','label','region','mapId']as const).some(k=>typeof r[k]!=='string'||!r[k])||!isObj(r.anchor)||!pos(r.anchor.pos)||typeof r.anchor.terrain!=='string'||!Number.isFinite(r.threat)||r.threat<0||!Array.isArray(r.points)||r.points.length<2||r.points.length>16||r.points.some(p=>!isObj(p)||typeof p.label!=='string'||!p.label||!pos(p.pos))||new Set(r.points.map(p=>p.pos.join(','))).size!==r.points.length)||new Set(d.routes.map(r=>r?.key)).size!==d.routes.length){report.errors.push(d.id+': patrolContract 실제 경로 주소 오류');continue}
    for(const r of d.routes){need(d.id,r.region,'RegionSite');need(d.id,r.anchor.terrain,'Terrain');if(db.tryGet<RegionSiteDef>(r.region)?.kind!=='settlement')report.errors.push(d.id+': patrolContract 정착지 경로 필요')}
  }
  for(const d of db.all<SourceContractDef>('SourceContract')){
    for(const key of ['refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','wealthMult','reputation']as const)if(!Number.isFinite(d[key])||d[key]<(key==='wealthMult'?.7:key==='distanceReward'||key==='threatReward'||key==='reputation'?0:1)||d[key]>(key==='wealthMult'?1.5:100000)||['refreshDays','deadlineBufferDays','reputation'].includes(key)&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': sourceContract.'+key+' 오류')
    if(!Array.isArray(d.targets)||!d.targets.length||d.targets.some(t=>!isObj(t)||(['key','label','region','mapId','source','waypoint','device','operation']as const).some(k=>typeof t[k]!=='string'||!t[k])||!Number.isFinite(t.threat)||t.threat<0)||new Set(d.targets.map(t=>t?.key)).size!==d.targets.length){report.errors.push(d.id+': sourceContract 실제 현장 주소 오류');continue}
    for(const target of d.targets){need(d.id,target.region,'RegionSite');need(d.id,target.device,'FieldDevice');const op=db.tryGet<FieldDeviceDef>(target.device)?.operations.find(o=>o.id===target.operation),placement=db.tryGet<FieldDeviceDef>(target.device)?.placement;if(!op?.effect?.sealSource||op.effect.sealSource.source!==target.source||op.effect.sealSource.region!==target.region||placement?.mapId!==target.mapId||placement.source!==target.source||placement.waypoint!==target.waypoint)report.errors.push(d.id+': sourceContract 연결 기구/작업/공급원 불일치')}
  }
  for(const d of db.all<BountyContractDef>('BountyContract')){
    for(const key of ['refreshDays','deadlineBufferDays','baseReward','distanceReward','threatReward','wealthMult','reputation']as const)if(!Number.isFinite(d[key])||d[key]<(key==='wealthMult'?.7:key==='distanceReward'||key==='threatReward'||key==='reputation'?0:1)||d[key]>(key==='wealthMult'?1.5:100000)||['refreshDays','deadlineBufferDays','reputation'].includes(key)&&!Number.isSafeInteger(d[key]))report.errors.push(d.id+': bounty.'+key+' 오류')
    if(!Array.isArray(d.targets)||!d.targets.length||d.targets.some(t=>!isObj(t)||(['key','label','region','mapId','source','waypoint']as const).some(k=>typeof t[k]!=='string'||!t[k])||!Number.isFinite(t.threat)||t.threat<0)||new Set(d.targets.map(t=>t?.key)).size!==d.targets.length)report.errors.push(d.id+': bounty 실제 출발지/명단 주소 필요')
    for(const t of Array.isArray(d.targets)?d.targets:[])if(t?.allegation!==undefined&&(!isObj(t.allegation)||!Number.isFinite(t.allegation.chance)||t.allegation.chance<0||t.allegation.chance>1||!db.all<FactionDef>('Faction').some(f=>f.key===t.allegation!.faction)))report.errors.push(d.id+': bounty.allegation 세력/확률 오류')
  }
  for (const d of db.all<SupplyContractDef>('SupplyContract')) {
    for(const [key,min,max,integer] of [['refreshDays',1,365,true],['deadlineDays',1,365,true],['baseReward',1,100000,true],['threatReward',0,100,false],['wealthMult',.7,1.5,false],['freshness',1,100,true],['durability',0,100,true],['reputation',0,10,true]] as const){
      if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,integer)
    }
    const keys=new Set<string>()
    if(!Array.isArray(d.requests)||!d.requests.length)report.errors.push(`${d.id}: requests가 필요함`)
    for(const req of d.requests??[]){
      need(d.id,req.item,'Item');const item=db.tryGet<ItemDef>(req.item)
      if(!req.key||keys.has(req.key))report.errors.push(`${d.id}: requests key 중복/누락`)
      keys.add(req.key)
      if(!item?.stackable||item.unidentified||item.drink||item.uses)report.errors.push(`${d.id}: requests는 감별/잔량 없는 쌓는 물품이어야 함`)
      range(d.id,'requests.count',req.count,1,99,true);range(d.id,'requests.threat',req.threat,0,10000,true)
    }
  }
  for (const d of db.all<ResidentWarmthDef>('ResidentWarmth')) {
    need(d.id,d.fireTerrain,'Terrain')
    for(const [key,min,max,integer] of [['seekAt',28,38,false],['target',28,38,false],['turns',1,28800,true],['retryTurns',1,100000,true]] as const){
      if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,integer)
    }
    if(d.target<=d.seekAt)report.errors.push(`${d.id}: target은 seekAt보다 높아야 함`)
  }
  for (const d of db.all<TeacherDef>('Teacher')) {
    for (const [key,min,max] of [['days',1,365],['lessonTurns',1,28800],['fee',0,100000],['literacyMin',1,3]] as const) {
      if (!Number.isFinite(d[key])) report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,true)
    }
  }
  for (const d of db.all<CreatureDef>('Creature')) {
    if (d.teacher) need(d.id,d.teacher,'Teacher')
    if (d.literacy !== undefined) range(d.id,'literacy',d.literacy,0,3,true)
    if (d.teacher && (d.literacy ?? 0) < (db.tryGet<TeacherDef>(d.teacher)?.literacyMin ?? 1)) report.errors.push(`${d.id}: 교사의 초기 literacy가 부족함`)
  }
  for (const d of db.all<ResidentPurificationDef>('ResidentPurification')) {
    need(d.id,d.fireTerrain,'Terrain')
    const fuel = db.tryGet<WaterSafetyDef>('WaterSafety.Human')?.treatments.boil.fuel
    const unit = fuel && db.tryGet<WorldSimulationDef>('WorldSimulation.Hearth')?.items[fuel]
    if (!fuel || !unit || unit.commodity !== 'Fuel' || !(unit.units > 0) || !db.tryGet<ItemDef>(fuel)?.stackable) report.errors.push(`${d.id}: 끓이기 연료는 Fuel 저장고와 연결된 쌓을 수 있는 물품이어야 함`)
    for (const [key,min,max,integer] of [['fuelTarget',1,99,true],['dailyFuelUnits',.001,100,false],['retryTurns',1,100000,true]] as const) {
      if (!Number.isFinite(d[key])) report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,integer)
    }
    if (unit && d.dailyFuelUnits < unit.units) report.errors.push(`${d.id}: 하루 한도는 연료1개 이상이어야 함`)
  }
  for (const d of db.all<ResidentWaterDef>('ResidentWater')) {
    need(d.id,d.terrain,'Terrain')
    const terrain = db.tryGet<TerrainDef>(d.terrain), sources = db.tryGet<WaterSafetyDef>('WaterSafety.Human')?.sources
    if (!terrain?.water || !terrain.residentWell || !terrain.waterSource || !sources?.[terrain.waterSource]) report.errors.push(`${d.id}: terrain은 수원이 정의된 주민 우물이어야 함`)
    for (const [key,min,max] of [['radius',1,10],['thirstAt',1,10000],['retryTurns',1,100000]] as const) {
      if (!Number.isFinite(d[key])) report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,true)
    }
    if (typeof d.handWash !== 'boolean') report.errors.push(`${d.id}: handWash는 참/거짓이어야 함`)
    if(d.hygiene!==undefined){
      if(!isObj(d.hygiene))report.errors.push(`${d.id}: hygiene 구조 오류`)
      else{
        for(const key of ['washAt','minBodyTemp']as const)if(!Number.isFinite(d.hygiene[key]))report.errors.push(`${d.id}: hygiene.${key}가 필요함`)
        range(d.id,'hygiene.washAt',d.hygiene.washAt,1,100);range(d.id,'hygiene.minBodyTemp',d.hygiene.minBodyTemp,32,38)
        range(d.id,'hygiene.vesselMaxPrice',d.hygiene.vesselMaxPrice,1,100000,true)
        if(typeof d.hygiene.bedding!=='boolean')report.errors.push(`${d.id}: hygiene.bedding은 참/거짓이어야 함`)
      }
    }
  }
  for (const d of db.all<ResidentProvisionDef>('ResidentProvision')) {
    if(d.cooking!==undefined){const q=d.cooking;if(!q||typeof q!=='object'||Array.isArray(q))report.errors.push(d.id+': cooking 객체 필요');else{
      if(!Array.isArray(q.recipes)||!q.recipes.length||new Set(q.recipes).size!==q.recipes.length)report.errors.push(d.id+': cooking.recipes 오류')
      else for(const id of q.recipes){need(d.id,id,'Recipe');const r=db.tryGet<RecipeDef>(id);if(!r?.basic||!r.boiledMeal?.unheated||r.output.count!==1||r.inputs.filter(i=>i.item!==r.boiledMeal?.vessel).length===0||r.workTurns>7200)report.errors.push(d.id+': cooking 실제 기본 그릇 조리법 필요')}
      if(!Array.isArray(q.roles)||!q.roles.length||new Set(q.roles).size!==q.roles.length||q.roles.some(role=>!['civilian','guard'].includes(role)))report.errors.push(d.id+': cooking.roles 오류')
      for(const[key,lo,hi]of[['homeRadius',1,6],['prepareBelowKcal',-1000,2500],['reserveWaterMl',0,2000],['reserveMoney',0,100000],['maxUnitPrice',1,100000],['retryTurns',1,28800]]as const)if(!Number.isSafeInteger(q[key])||q[key]<lo||q[key]>hi)report.errors.push(d.id+': cooking.'+key+' 오류')
    }}
    need(d.id,d.terrain,'Terrain'); need(d.id,d.food,'Item')
    if (!db.tryGet<TerrainDef>(d.terrain)?.residentDepot) report.errors.push(`${d.id}: terrain은 주민 배급 창고여야 함`)
    const food = db.tryGet<ItemDef>(d.food), unit = db.tryGet<WorldSimulationDef>('WorldSimulation.Hearth')?.items[d.food]
    if (!food?.food || food.food.kcal <= 0 || !food.stackable || food.unidentified || unit?.commodity !== 'Food' || !(unit.units > 0)) report.errors.push(`${d.id}: food는 Food 저장고와 연결된 실제 음식이어야 함`)
    for (const [key,min,max,integer] of [['radius',1,10,true],['minimumKcal',1,10000,true],['targetKcal',1,25000,true],['requestBelowKcal',-10000,10000,true],['dailyFoodUnits',.001,10,false],['retryTurns',1,100000,true]] as const) {
      if (!Number.isFinite(d[key])) report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,integer)
    }
    if (d.minimumKcal > d.targetKcal) report.errors.push(`${d.id}: minimumKcal/targetKcal 순서 오류`)
  }
  for (const d of db.all<NpcRestDef>('NpcRest')) {
    if(d.prepareKcal!==undefined)range(d.id,'prepareKcal',d.prepareKcal,0,5000,true)
    if(d.prepareWaterDeficit!==undefined)range(d.id,'prepareWaterDeficit',d.prepareWaterDeficit,0,1000,true)
    need(d.id,d.terrain,'Terrain')
    const terrain = db.tryGet<TerrainDef>(d.terrain)
    if (!terrain?.passable || !terrain.bedding || terrain.bedding.portable) report.errors.push(`${d.id}: terrain은 이동 가능한 고정 침대여야 함`)
    for (const [key,min,max] of [['radius',1,10],['sleepAt',15,100],['debtAt',1,100],['wakeAt',0,99],['retryTurns',1,100000]] as const) {
      if (!Number.isFinite(d[key])) report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,true)
    }
    if (d.wakeAt >= d.sleepAt) report.errors.push(`${d.id}: wakeAt은 sleepAt보다 작아야 함`)
  }
  for (const d of db.all<InnDef>('Inn')) {
    need(d.id,d.terrain,'Terrain')
    const terrain = db.tryGet<TerrainDef>(d.terrain)
    if (!terrain?.passable || !terrain.bedding || terrain.bedding.portable) report.errors.push(`${d.id}: terrain은 이동 가능한 고정 침대여야 함`)
    for (const [key,min,max] of [['beds',1,20],['fee',1,100000],['leaseTurns',1,1000000]] as const) {
      if (!Number.isFinite(d[key])) report.errors.push(`${d.id}: ${key}가 필요함`)
      else range(d.id,key,d[key],min,max,true)
    }
  }
  for (const d of db.all<BestiaryDef>('Bestiary')) {
    for (const key of ['observeTurns','encounterCount','encounterGap','fightClearTurns','dissectTurns','autoDissectAfter'] as const) range(d.id,key,d[key],1,Infinity,true)
    for (const key of ['perRange','keenRange','failedYield'] as const) range(d.id,key,d[key],0,1)
    for (const key of ['dissectBase','dissectMastery','dissectPer','dissectMin','dissectMax'] as const) range(d.id,key,d[key],0,100)
    if(d.dissectMin>d.dissectMax)report.errors.push(`${d.id}: 해부 확률 구간 뒤집힘`)
    if(d.rangeWidth.length!==2)report.errors.push(`${d.id}: rangeWidth는2개여야 함`)
    for(const n of d.rangeWidth)range(d.id,'rangeWidth',n,0,1)
    if(d.toolBonus.length!==6)report.errors.push(`${d.id}: toolBonus는6개여야 함`)
    for(const n of d.toolBonus)range(d.id,'toolBonus',n,-100,100)
    need(d.id,d.tabooThought,'Thought');range(d.id,'tabooLoss',d.tabooLoss,-100,0)
  }
  const species=new Set<string>()
  for(const d of db.all<BestiaryEntryDef>('BestiaryEntry')){
    if(!['animal','human','unavailable','machine'].includes(d.kind))report.errors.push(`${d.id}: 알 수 없는 해부 kind`)
    if(!d.creatures.length)report.errors.push(`${d.id}: 도감 종 참조 없음`)
    for(const id of d.creatures){need(d.id,id,'Creature');if(species.has(id))report.errors.push(`${d.id}: 도감 종 중복 '${id}'`);species.add(id)}
    range(d.id,'difficulty',d.difficulty,0,100)
    for(const y of d.yields){need(d.id,y.item,'Item');range(d.id,'yields.count',y.count,1,Infinity,true)}
  }
  for (const d of db.all<KnowledgeDef>('Knowledge')) {
    if (d.pillAging !== undefined) {
      const a = d.pillAging
      if (!isObj(a)) report.errors.push(d.id + ': pillAging 구조 오류')
      else {
        for (const key of ['minPotency', 'maxPotency', 'noticePer', 'spoilChance', 'spoiledAmount'] as const) {
          if (!Number.isFinite(a[key])) report.errors.push(d.id + ': pillAging.' + key + ' 유한값 필요')
          else range(d.id, 'pillAging.' + key, a[key], key === 'spoilChance' ? 0 : Number.MIN_VALUE, key === 'spoilChance' || key === 'spoiledAmount' ? 1 : 100, key === 'minPotency' || key === 'maxPotency' || key === 'noticePer')
        }
        if (a.minPotency > a.maxPotency) report.errors.push(d.id + ': pillAging 효력 구간 뒤집힘')
        need(d.id, a.spoiledEffect, 'PillEffect')
        const spoiled = db.tryGet<PillEffectDef>(a.spoiledEffect)
        if (spoiled?.effect !== 'toxin' || spoiled.drug) report.errors.push(d.id + ': pillAging 변질 효과는 약물 투여가 없는 독이어야 함')
      }
    }
    if(d.appraisal!==undefined){const a=d.appraisal;if(!isObj(a))report.errors.push(d.id+': appraisal 구조 오류');else{for(const key of ['feeRate','honesty','relationPerPoint']as const){if(!Number.isFinite(a[key]))report.errors.push(d.id+': appraisal.'+key+' 필요');else range(d.id,'appraisal.'+key,a[key],key==='feeRate'?.01:0,key==='relationPerPoint'?.01:1)}if(!isObj(a.factionHonesty))report.errors.push(d.id+': appraisal.factionHonesty 필요');else for(const [f,v]of Object.entries(a.factionHonesty)){if(!db.all<FactionDef>('Faction').some(d=>d.key===f))report.errors.push(d.id+': appraisal 없는 세력 '+f);range(d.id,'appraisal.factionHonesty.'+f,v,0,1)}}}
    for (const key of ['examineTurns','tasteTurns','pageTurns','literacyBooks'] as const) range(d.id,key,d[key],1,Infinity,true)
    for (const key of ['tasteBonus','baseChance','chancePerPoint','minChance','maxChance','masteryScore','defaultDifficulty','noticeablePain'] as const) range(d.id,key,d[key],0,100)
    range(d.id,'tasteFraction',d.tasteFraction,Number.MIN_VALUE,1);range(d.id,'misreadChance',d.misreadChance,0,1)
    if (d.minChance>d.maxChance) report.errors.push(`${d.id}: 감별 확률 구간 뒤집힘`)
    if (!Array.isArray(d.literacySpeed)||d.literacySpeed.length!==4) report.errors.push(`${d.id}: literacySpeed는4개여야 함`)
    else for (const n of d.literacySpeed) range(d.id,'literacySpeed',n,Number.MIN_VALUE)
  }
  for (const d of db.all<PillEffectDef>('PillEffect')) {
    range(d.id,'identifyDifficulty',d.identifyDifficulty,0,100)
    if (d.noticeable && !['always','pain','infection','never'].includes(d.noticeable)) report.errors.push(`${d.id}: 알 수 없는 noticeable`)
  }
  for (const d of db.all<DrugDef>('Drug')) {
    if(d.thought!==undefined){need(d.id,d.thought,'Thought');if(db.tryGet<ThoughtDef>(d.thought)?.durationTurns!==0)report.errors.push(d.id+': 복용 중 사고는 조건 지속0이어야 함')}
    range(d.id, 'durationTurns', d.durationTurns, 1, Infinity, true)
    for (const key of ['pain', 'fatigue', 'tolerance'] as const) range(d.id, key, d[key], 0, key === 'pain' ? 150 : 100)
    for (const key of ['consciousness','breathing','addiction','antibiotic','emptyNausea','dysenteryRisk'] as const) range(d.id, key, d[key], 0, 1)
    range(d.id, 'sleep', d.sleep, -1, 1); range(d.id, 'reaction', d.reaction, -100, 100); range(d.id, 'bleedMult', d.bleedMult, 0)
    for (const key of ['febrileCooling', 'coldAwareness', 'reboundFatigue', 'irritation', 'water', 'stress', 'wakeThreshold'] as const) range(d.id, key, d[key], 0)
    range(d.id, 'heatLossMult', d.heatLossMult, Number.MIN_VALUE)
    if (d.family && !['analgesic','alcohol','stimulant'].includes(d.family)) report.errors.push(`${d.id}: 알 수 없는 약물 계열 '${d.family}'`)
    if (d.external && !d.applyTurns) report.errors.push(`${d.id}: 외용약 applyTurns 없음`)
    range(d.id, 'applyTurns', d.applyTurns, 1, Infinity, true)
  }
  for (const p of db.all<PharmacologyDef>('Pharmacology')) {
    for(const key of ['alcoholMoods','withdrawalMoods']as const){
      const values=p[key]
      if(values!==undefined){
        if(!Array.isArray(values)||values.length!==3)report.errors.push(p.id+': '+key+'는 세 단계여야 함')
        else for(const value of values)range(p.id,key,value,-100,key==='withdrawalMoods'?0:100)
      }
    }
    for (const family of ['analgesic','alcohol','stimulant'] as const) {
      const f = p.families?.[family]
      if (!f) report.errors.push(`${p.id}: '${family}' 약물 계열 설정 없음`)
      else { range(p.id, `${family}.decay`, f.decay, 0); range(p.id, `${family}.withdrawalTurns`, f.withdrawalTurns, 1, Infinity, true) }
    }
    for (const key of ['withdrawalStageTurns','recoveryTurns','overdoseCheckTurns','deliriumCheckTurns','nauseaTurns','constipationTurns'] as const) range(p.id, key, p[key], 1, Infinity, true)
    for (const key of ['abstinentChance','overdoseAt','overdoseBreathing','overdoseFaintChance','deliriumFaintChance','withdrawalManipulation'] as const) range(p.id, key, p[key], 0, 1)
    range(p.id,'withdrawalMood',p.withdrawalMood,-100,0); range(p.id,'withdrawalSleep',p.withdrawalSleep,-1,0)
    range(p.id,'withdrawalPain',p.withdrawalPain,0,150); range(p.id,'severeAnalgesicPain',p.severeAnalgesicPain,0,150)
  }
  for (const it of db.all<ItemDef>('Item')) if (it.drug?.def) {
    need(it.id,it.drug.def,'Drug')
    if (it.drink?.alcohol && db.tryGet<DrugDef>(it.drug.def)?.external) report.errors.push(`${it.id}: 술에 외용 약물을 연결할 수 없음`)
  }
  for (const pill of db.all<PillEffectDef>('PillEffect')) if (pill.drug) {
    need(pill.id,pill.drug,'Drug')
    if (db.tryGet<DrugDef>(pill.drug)?.external) report.errors.push(`${pill.id}: 정제에 외용약을 연결할 수 없음`)
  }
  const seasonOrders = new Set<number>()
  for (const d of db.all<SeasonDef>('Season')) {
    range(d.id, 'lengthDays', d.lengthDays, 1, 365, true); range(d.id, 'order', d.order, 1, 12, true)
    range(d.id, 'sunrise', d.sunrise, 0, 12); range(d.id, 'sunset', d.sunset, 12, 24); range(d.id, 'phaseDay', d.phaseDay, 1, d.lengthDays); range(d.id, 'phase', d.phase, -1, 1)
    if (seasonOrders.has(d.order)) report.errors.push(`${d.id}: 계절 순서 중복`); seasonOrders.add(d.order)
  }
  const weatherKeys = new Set<string>()
  for (const d of db.all<WeatherDef>('Weather')) {
    need(d.id, d.thought, 'Thought')
    if (!['clear','overcast','deepOvercast','ashrain','ashstorm','ashsnow','ashgale','frostfog'].includes(d.weather)) report.errors.push(`${d.id}: 알 수 없는 날씨 키`)
    if (!['clear','cloud','rain','storm','snow'].includes(d.group)) report.errors.push(`${d.id}: 알 수 없는 날씨 그룹`)
    if (weatherKeys.has(d.weather)) report.errors.push(`${d.id}: 날씨 키 중복`); weatherKeys.add(d.weather)
    for (const key of ['selectionWeight', 'wetPerTen', 'noise', 'windBonus', 'corrosionMult'] as const) range(d.id, key, d[key], 0)
    for (const key of ['diurnalMult', 'scentMult', 'eyeSightMult'] as const) range(d.id, key, d[key], 0, 1)
    range(d.id, 'sightMult', d.sightMult, 0, 2); range(d.id, 'nightLight', d.nightLight, 0, 100)
  }
  for (const d of db.all<ClimateDef>('Climate')) {
    if(d.towerStop){const stop=d.towerStop;for(const key of ['radiusKm','neighborRadiusKm','soilDelayYears','soilCollapseYears']as const)if(!Number.isFinite(stop[key])||stop[key]<=0)report.errors.push(`${d.id}: towerStop.${key} 오류`);for(const key of ['veilTarget','sunBonus','neighborBoost']as const)if(!Number.isFinite(stop[key])||stop[key]<0||stop[key]>100)report.errors.push(`${d.id}: towerStop.${key} 오류`);if(!Array.isArray(stop.soilCommodities)||stop.soilCommodities.some(key=>!['Food','Fuel','Metal','Medicine','Ammo','Salt'].includes(key)))report.errors.push(`${d.id}: towerStop.soilCommodities 오류`);if(!db.all<FactionDef>('Faction').some(f=>f.key===stop.hostileFaction&&!f.territorial))report.errors.push(`${d.id}: towerStop.hostileFaction 참조 오류`)}
    const year = db.all<SeasonDef>('Season').reduce((n, s) => n + s.lengthDays, 0)
    range(d.id, 'startDay', d.startDay, 1, year, true)
    for (const key of ['amplitude', 'veilAmplitude', 'eruptionAmount', 'eruptionDecay', 'sunTransitionDays', 'snowPerHour', 'snowMeltPerDegreeHour'] as const) range(d.id, key, d[key], 0)
    for (const key of ['iceHoleTurns', 'breakIceTurns', 'snowCollectTurns'] as const) range(d.id, key, d[key], 1, Infinity, true)
    range(d.id, 'snowIceAt', d.snowIceAt, 0, 100); range(d.id, 'iceStumble', d.iceStumble, 0, 100)
    if (!d.diurnal?.length || d.diurnal.some(([hour, value], i) => !Number.isFinite(value) || hour < 0 || hour > 24 || i > 0 && hour <= d.diurnal[i - 1][0])) report.errors.push(`${d.id}: 일교차 테이블 오류`)
    for (const group of ['clear','cloud','rain','storm','snow']) { const choices = db.all<WeatherDef>('Weather').filter((v) => v.group === group); if (!d.weatherRows[group as keyof typeof d.weatherRows] || !choices.some((v) => v.selectionWeight > 0)) report.errors.push(`${d.id}: 날씨 그룹 ${group} 누락/가중치 없음`) }
    for (const [group, row] of Object.entries(d.weatherRows)) { for (const [key, value] of Object.entries(row)) range(d.id, `${group}.${key}`, value, 0); if (Object.values(row).reduce((n, v) => n + v, 0) <= 0) report.errors.push(`${d.id}: 날씨 행 가중치 오류`) }
  }
  for (const d of db.all<WorldGenDef>('WorldGen')) {
    if(d.territory!==undefined){if(!d.territory||typeof d.territory!=='object'||Array.isArray(d.territory))report.errors.push(d.id+': territory 객체가 필요하다');else{for(const key of ['maxCost','roadCost','landCost','riseMetersPerCost']as const)range(d.id,'territory.'+key,d.territory[key],1,key==='maxCost'?2000:10000,true);range(d.id,'territory.riverCost',d.territory.riverCost,0,10000,true)}}
    if(d.cropIrrigationTransfer!==undefined){if(!d.cropIrrigationTransfer||typeof d.cropIrrigationTransfer!=='object'||Array.isArray(d.cropIrrigationTransfer))report.errors.push(d.id+': cropIrrigationTransfer 객체가 필요하다');else for(const key of ['pathogenFraction','ashFraction']as const){const v=d.cropIrrigationTransfer[key];if(!Number.isFinite(v)||v<0||v>1)report.errors.push(d.id+': cropIrrigationTransfer.'+key+'는0~1이어야 한다')}}
    if(d.cropEvaporationMlPerHour!==undefined&&(!Number.isSafeInteger(d.cropEvaporationMlPerHour)||d.cropEvaporationMlPerHour<0||d.cropEvaporationMlPerHour>1000))report.errors.push(d.id+': cropEvaporationMlPerHour는0~1000의 정수여야 한다')
    if(d.cropSoilDiffusion!==undefined){const q=d.cropSoilDiffusion;if(!q||typeof q!=='object'||Array.isArray(q)||!Number.isSafeInteger(q.everyTurns)||q.everyTurns<1||q.everyTurns>28800||!Number.isSafeInteger(q.maxMlPerEdge)||q.maxMlPerEdge<0||q.maxMlPerEdge>1000)report.errors.push(d.id+': cropSoilDiffusion은 everyTurns1~28800/maxMlPerEdge0~1000 정수여야 한다')}
    need(d.id, d.startRegion, 'RegionSite')
    for (const key of ['width', 'height'] as const) range(d.id, key, d[key], 8, 256, true)
    for (const key of ['cellKm', 'heightMax', 'rainScale', 'roadHours', 'offRoadHours', 'settlementSpacing', 'settlementCount'] as const) range(d.id, key, d[key], Number.MIN_VALUE)
    range(d.id, 'travelBleedMax', d.travelBleedMax, 0)
    range(d.id, 'smoothPasses', d.smoothPasses, 0, 10, true); range(d.id, 'seaLevel', d.seaLevel, 0, d.heightMax); range(d.id, 'towerDormancy', d.towerDormancy, 0, 1)
    for (const key of ['towers', 'towerOutput', 'towerRadius'] as const) if (!Array.isArray(d[key]) || d[key].length !== 2 || d[key][0] <= 0 || d[key][1] < d[key][0]) report.errors.push(`${d.id}: ${key} 범위 오류`)
    const occupied = new Set<string>()
    for (const site of db.all<RegionSiteDef>('RegionSite')) {
      if (!Array.isArray(site.cell) || site.cell.length !== 2 || site.cell.some((v, i) => !Number.isInteger(v) || v < 0 || v >= (i ? d.height : d.width))) report.errors.push(`${site.id}: 월드 좌표 오류`)
      const cell = site.cell?.join(','); if (occupied.has(cell)) report.errors.push(`${site.id}: 지역 좌표 중복`); occupied.add(cell)
      for (const g of site.guards ?? []) { need(site.id, g.def, 'Creature'); range(site.id, 'guards.count', g.count, 1, 20, true) }
      range(site.id, 'altitude', site.altitude, 0, d.heightMax)
      if (site.tower) { range(site.id, 'tower.output', site.tower.output, 0, 100); range(site.id, 'tower.radius', site.tower.radius, 1) }
    }
  }
  for (const d of db.all<BiomeDef>('Biome')) {
    range(d.id, 'worldTravelMult', d.worldTravelMult, Number.MIN_VALUE)
    if (!/^#[0-9a-f]{6}$/i.test(d.color)) report.errors.push(`${d.id}: 지도 색상 오류`)
    for (const [key, value] of Object.entries(d.resources)) range(d.id, `resources.${key}`, value, 0, 100)
    for (const key of ['altitude', 'temperature', 'rain', 'veil'] as const) { const v = d.conditions[key]; if (v && (v.length !== 2 || !v.every(Number.isFinite) || v[1] < v[0])) report.errors.push(`${d.id}: ${key} 범위 오류`) }
  }
  for (const d of db.all<ProstheticDef>('Prosthetic')) {
    need(d.id, d.item, 'Item'); need(d.id, d.maintenanceItem, 'Item'); need(d.id, d.powerItem, 'Item'); need(d.id, d.whispers?.thought, 'Thought')
    if (!d.targets?.length || d.targets.some((id) => !db.all<BodyDef>('Body').some((b) => b.parts.some((p) => p.id === id)))) report.errors.push(`${d.id}: 의수족 targets 오류`)
    range(d.id, 'efficiency', d.efficiency, 0, 1.2); range(d.id, 'structureHp', d.structureHp, 1)
    for (const field of ['installTurns', 'removeTurns', 'serviceTurns', 'maintenanceTurns', 'powerTurns'] as const) range(d.id, field, d[field], 1, Infinity, true)
    range(d.id, 'medicine', d.medicine, 0, 5, true)
    for (const field of ['overdueMult', 'coldMult', 'twoHandSupport'] as const) range(d.id, field, d[field], 0, 1)
    if (d.maintenanceTurns && !d.maintenanceItem) report.errors.push(`${d.id}: 정비 재료 없음`)
    if (d.powerTurns && !d.powerItem) report.errors.push(`${d.id}: 전원셀 없음`)
    if (d.whispers) range(d.id, 'whispers.everyTurns', d.whispers.everyTurns, 1, Infinity, true)
    if (db.tryGet<ItemDef>(d.item)?.prosthetic !== d.id) report.errors.push(`${d.id}: 아이템의 prosthetic 참조가 일치하지 않음`)
  }
  for (const d of db.all<WaterSafetyDef>('WaterSafety')) {
    if(!isObj(d.aquatic))report.errors.push(`${d.id}: aquatic 규정 필요`)
    else{const a=d.aquatic;for(const key of ['bulkThreshold','checkTurns','energyPerTurn','breathTurns','hypoxiaFatalTurns','recoverPerTurn','rescueTurns','criticalAir']as const){if(!Number.isFinite(a[key]))report.errors.push(`${d.id}: aquatic.${key} 필요`);else range(d.id,`aquatic.${key}`,a[key],1,10000,true)}for(const key of ['sinkChance','minMoving','minBreathing']as const){if(!Number.isFinite(a[key]))report.errors.push(`${d.id}: aquatic.${key} 필요`);else range(d.id,`aquatic.${key}`,a[key],Number.MIN_VALUE,1)}if(a.criticalAir>=a.breathTurns)report.errors.push(`${d.id}: aquatic.criticalAir는 breathTurns보다 작아야 함`)}

    for(const field of ['saltFlushMlPerGram','maxDrinkingSalinity'] as const){if(typeof d[field]!=='number')report.errors.push(`${d.id}: ${field} 수치가 필요함`);else range(d.id,field,d[field],0)}
    need(d.id, d.disease, 'Disease')
    for (const [field, v] of Object.entries(d)) if (typeof v === 'number') range(d.id, field, v, 0)
    for (const field of ['exposureMl', 'ashDivisor'] as const) range(d.id, field, d[field], Number.MIN_VALUE)
    for (const field of ['nauseaAbsorption', 'dysenteryAbsorption', 'pathogenRisk'] as const) range(d.id, field, d[field], 0, 1)
    for (const [key, q] of Object.entries(d.sources ?? {})) { range(d.id, `sources.${key}.pathogen`, q.pathogen, 0, 100); range(d.id, `sources.${key}.ash`, q.ash, 0); if(q.salinity!==undefined)range(d.id, `sources.${key}.salinity`, q.salinity, 0, 400) }
    for (const [key, t] of Object.entries(d.treatments ?? {})) { range(d.id, `treatments.${key}.turns`, t.turns, 1, Infinity, true); range(d.id, `treatments.${key}.pathogenMult`, t.pathogenMult, 0, 1); range(d.id, `treatments.${key}.ashMult`, t.ashMult, 0); need(d.id, t.tool, 'Item'); need(d.id, t.fuel, 'Item') }
    if (!d.riskBands?.length || d.riskBands.some((b, i) => b.at < 0 || !b.label || (i > 0 && b.at <= d.riskBands[i - 1].at))) report.errors.push(`${d.id}: riskBands 구간 오류`)
  }
  for (const d of db.all<FoodSafetyDef>('FoodSafety')) {
    if(d.cooking!==undefined){
      const c=d.cooking
      if(!isObj(c))report.errors.push(d.id+': cooking 구조 오류')
      else{
        if(!Number.isFinite(c.temperature))report.errors.push(d.id+': cooking.temperature 필요');else range(d.id,'cooking.temperature',c.temperature,1,100)
        for(const key of['neglectTurns','capacity']as const){if(!Number.isFinite(c[key]))report.errors.push(d.id+': cooking.'+key+' 필요');else range(d.id,'cooking.'+key,c[key],1,10000,true)}
        for(const key of['burnChance','masteryReduction','burnKcal']as const){if(!Number.isFinite(c[key]))report.errors.push(d.id+': cooking.'+key+' 필요');else range(d.id,'cooking.'+key,c[key],0,1)}
        if(!Number.isFinite(c.burnMood))report.errors.push(d.id+': cooking.burnMood 필요');else range(d.id,'cooking.burnMood',c.burnMood,-100,0)
        need(d.id,c.thought,'Thought');if(!c.thought)report.errors.push(d.id+': cooking.thought 필요')
      }
    }
    for (const [field, v] of Object.entries(d)) if (typeof v === 'number' && field !== 'staleMood') range(d.id, field, v, 0)
    range(d.id, 'staleMood', d.staleMood, -100, 0)
    for (const field of ['washWater', 'washTurns', 'vomitWater'] as const) range(d.id, field, d[field], 1, Infinity, true)
    range(d.id, 'liceRisk', d.liceRisk, 0, 1); range(d.id, 'liceSleepMult', d.liceSleepMult, 0, 1)
    for (const field of ['poisonHours', 'vomits'] as const) {
      for (const v of d[field] ?? []) range(d.id, field, v, 1, Infinity, true)
      if (d[field]?.length !== 2 || d[field][0] > d[field][1]) report.errors.push(`${d.id}: ${field} 최솟값/최댓값 오류`)
    }
    if (!d.temperature?.length || d.temperature.some((t, i) => !Number.isFinite(t.max) || !Number.isFinite(t.mult) || t.mult < 0 || (i > 0 && t.max <= d.temperature[i - 1].max))) report.errors.push(`${d.id}: temperature 구간 오류`)
    if (d.spoiledAt >= d.staleAt || d.staleAt > 100) report.errors.push(`${d.id}: freshness 구간 오류`)
  }
  for (const n of db.all<NutritionDef>('Nutrition')) {
    for (const [field, value] of Object.entries(n)) if (typeof value === 'number') range(n.id, field, value, 0)
    for (const field of ['starvationRisk', 'scurvyRisk', 'excessDrinkMult', 'lowProteinMult', 'lowVitaminRecovery'] as const) range(n.id, field, n[field], 0, 1)
    for (const [kind, value] of Object.entries(n.activity ?? {})) range(n.id, `activity.${kind}`, value, Number.MIN_VALUE)
    for (const kind of ['hunger', 'thirst'] as const) {
      const bands = n[kind]
      if (!bands || bands.length !== 6 || bands[0].deficit !== 0) report.errors.push(`${n.id}: ${kind}는0에서 시작하는6개 구간이어야 함`)
      for (const [i, band] of (bands ?? []).entries()) {
        range(n.id, `${kind}.deficit`, band.deficit, 0)
        if (i && band.deficit <= bands[i - 1].deficit) report.errors.push(`${n.id}: ${kind} 구간은 중복 없이 증가해야 함`)
        for (const key of ['energy', 'immunity', 'healing', 'consciousness'] as const) range(n.id, `${kind}.${key}`, band[key], 0, 1)
        range(n.id, `${kind}.turns`, band.turns, Number.MIN_VALUE)
        range(n.id, `${kind}.stumble`, band.stumble, 0, 60)
        range(n.id, `${kind}.heatShift`, band.heatShift, 0, 5)
        need(n.id, band.thought, 'Thought')
      }
    }
  }
  for (const p of db.all<ProcedureDef>('Procedure')) {
    if (!['amputate', 'extract', 'reduce'].includes(p.kind)) report.errors.push(`${p.id}: 알 수 없는 의료 처치`)
    const fields = p.kind === 'amputate' ? ['stumpFraction', 'prostheticThreshold', 'prostheticBonus'] : p.kind === 'extract' ? ['bloodPerSeverity', 'failureSeverity'] : []
    for (const field of fields) if ((p as unknown as Record<string, unknown>)[field] === undefined) report.errors.push(`${p.id}: 필수 필드 '${field}' 없음`)
    range(p.id, 'turns', p.turns, 1, Infinity, true)
    range(p.id, 'painSpike', p.painSpike, 0, 150)
    for (const key of ['stumpFraction', 'prostheticBonus'] as const) range(p.id, key, p[key], 0, 1)
    range(p.id, 'prostheticThreshold', p.prostheticThreshold, 0, 100)
    range(p.id, 'bloodPerSeverity', p.bloodPerSeverity, 0)
    range(p.id, 'failureSeverity', p.failureSeverity, 0)
  }
  for (const s of db.all<SurgeryDef>('Surgery')) {
    need(s.id, s.supply, 'Item')
    if (!['suture', 'ligate', 'tendon'].includes(s.kind)) report.errors.push(`${s.id}: 알 수 없는 외과 처치`)
    range(s.id, 'mastery', s.mastery, 0, 5, true)
    range(s.id, 'turns', s.turns, 1, Infinity, true)
    range(s.id, 'count', s.count, 1, Infinity, true)
    range(s.id, 'perSeverity', s.perSeverity, 0)
    for (const key of ['bleedMult', 'scarMult', 'tearChance'] as const) range(s.id, key, s[key], 0, 1)
    range(s.id, 'healMult', s.healMult, 0, 5)
    range(s.id, 'tearBelowQ', s.tearBelowQ, 0, 100)
  }
  for (const r of db.all<RecoveryDef>('Recovery')) {
    if(r.id==='Recovery.Wounds'&&r.infectionStages===undefined)report.errors.push(r.id+': 감염 단계가 필요함')
    const stages=r.infectionStages
    if(stages!==undefined){
      if(!Array.isArray(stages)||!stages.length||stages.length>16||stages[0]?.at!==0)report.errors.push(r.id+': 감염 단계는0부터 시작해야 함')
      else for(let i=0;i<stages.length;i++){
        const b=stages[i]
        if(!isObj(b)||typeof b.label!=='string'||!b.label||['at','pain','targetTemp','consciousness','sleep','healing','metabolicFever'].some(k=>!(k in b))){report.errors.push(r.id+': 감염 단계 구조 오류');continue}
        range(r.id,'infection.at',b.at,0,100);range(r.id,'infection.pain',b.pain,0,100);range(r.id,'infection.targetTemp',b.targetTemp,35,43);range(r.id,'infection.consciousness',b.consciousness,0,1);range(r.id,'infection.sleep',b.sleep,0,1)
        if(typeof b.healing!=='boolean'||typeof b.metabolicFever!=='boolean')report.errors.push(r.id+': 감염 치유/대사 여부는 논리값이어야 함')
        if(i&&isObj(stages[i-1])&&b.at<=stages[i-1]!.at)report.errors.push(r.id+': 감염 진행 경계는 오름차순이어야 함')
      }
    }
    need(r.id, r.forgetfulTrait, 'Trait')
    for (const field of ['dislocationChance', 'dislocationSeverity', 'concussionCap', 'forgetfulChance'] as const) range(r.id, field, r[field], 0, 1)
    range(r.id, 'concussionEvery', r.concussionEvery, 1, Infinity, true)
    for (const key of ['scarPainMult', 'largeScarFraction', 'largeScarCap', 'contractureCap', 'chronicChance', 'nerveLossPerHour', 'arrowBleedMult', 'brokenHeadChance', 'dislocationCap'] as const) range(r.id, key, r[key], 0, 1)
    for (const key of ['chronicPain', 'coldBonus', 'rainBonus', 'wakeBonus', 'wakeTurns', 'nerveFrostbiteMult', 'tendonPermanentTurns', 'foreignPain', 'foreignContam', 'arrowMovePain', 'dislocationPain'] as const) range(r.id, key, r[key], 0)
  }
  for (const wound of db.all<WoundDef>('Wound')) range(wound.id, 'scarChance', wound.scarChance, 0, 1)
  for (const g of db.all<GrowthDef>('Growth')) {
    if(g.permanentLoss){
      const loss=g.permanentLoss,h=loss.starvation
      if(loss.brain){range(g.id,'brain.maxInjuryHp',loss.brain.maxInjuryHp,.01,1);if(!Array.isArray(loss.brain.stats)||!loss.brain.stats.length||new Set(loss.brain.stats).size!==loss.brain.stats.length||loss.brain.stats.some(s=>!['str','agi','vit','per','wil'].includes(s)))report.errors.push(g.id+': 뇌 회복 능력치 후보 오류')}
      if(!isObj(h)||!isObj(h.rule)||!isObj(loss.diseases))report.errors.push(g.id+': 영구 능력치 변화 규칙 구조 오류')
      else{
        range(g.id,'starvation.stage',h.stage,1,5,true);range(g.id,'starvation.turns',h.turns,1,Number.MAX_SAFE_INTEGER,true)
        for(const [cause,rule]of [['starvation',h.rule],...Object.entries(loss.diseases)]as [string,import('./types').PermanentLossRule][]){
          if(!isObj(rule)){report.errors.push(g.id+': 영구 변화 규칙 오류');continue}
          if(!['str','agi','vit','per','wil'].includes(rule.stat))report.errors.push(g.id+': 능력치 참조 오류')
          range(g.id,'permanentLoss.chance',rule.chance,0,1)
          if(cause!=='starvation')need(g.id,cause,'Disease')
        }
      }
    }

    range(g.id, 'yearDays', g.yearDays, 1, 1000, true)
    if (!g.ageBands?.length || !g.ageBands.some((b) => b.min === 0)) report.errors.push(`${g.id}: 0세부터 시작하는 나이 구간이 필요함`)
    for (const b of g.ageBands ?? []) {
      range(g.id, 'ageBands.min', b.min, 0, 200, true)
      range(g.id, 'ageBands.masteryMult', b.masteryMult, .1, 2)
      for (const key of ['statLoss', 'jointPain', 'senses'] as const) range(g.id, `ageBands.${key}`, b[key], 0, 1)
    }
  }
  for(const c of db.all<CreatureDef>('Creature'))if(c.ageRange){
    if(!Array.isArray(c.ageRange)||c.ageRange.length!==2||c.ageRange[0]>c.ageRange[1])report.errors.push(c.id+': 생물 나이 범위 오류')
    else for(const n of c.ageRange)range(c.id,'ageRange',n,0,120,true)
    if(db.body(c.body).kind!=='humanoid')report.errors.push(c.id+': 인간형 생물만 인간 노화 범위를 사용함')
  }
  for(const d of db.all<CartographyDef>('Cartography')){
    if(d.worldScouting!==undefined){const r=d.worldScouting;if(!isObj(r))report.errors.push(d.id+': worldScouting 규정 오류');else{for(const k of ['radius','maxCells']as const)if(!Number.isFinite(r[k]))report.errors.push(d.id+': worldScouting.'+k+' 필요');range(d.id,'worldScouting.radius',r.radius,0,3,true);range(d.id,'worldScouting.maxCells',r.maxCells,49,256,true)}}
    if(d.worldPrices!==undefined){const r=d.worldPrices;if(!isObj(r))report.errors.push(d.id+': worldPrices 규정 오류');else{for(const k of ['basePrice','pricePerCell']as const){if(!Number.isFinite(r[k]))report.errors.push(d.id+': worldPrices.'+k+' 필요');else range(d.id,'worldPrices.'+k,r[k],0,10000)}}}
    if(d.worldCommission!==undefined){const r=d.worldCommission;if(!isObj(r))report.errors.push(d.id+': worldCommission 규정 오류');else{for(const k of ['radius','minCells','reward']as const)if(!Number.isFinite(r[k]))report.errors.push(d.id+': worldCommission.'+k+' 필요');range(d.id,'worldCommission.radius',r.radius,1,8,true);range(d.id,'worldCommission.minCells',r.minCells,1,256,true);range(d.id,'worldCommission.reward',r.reward,1,100000,true);if(r.minCells>(2*r.radius+1)*(2*r.radius+1))report.errors.push(d.id+': 월드 정찰 범위보다 요구 칸이 많음')}}
    if(d.worldWriting!==undefined){const r=d.worldWriting;if(!isObj(r))report.errors.push(d.id+': worldWriting 규정 오류');else{for(const k of ['maxCells','maxError']as const)if(!Number.isFinite(r[k]))report.errors.push(d.id+': worldWriting.'+k+' 필요');range(d.id,'worldWriting.maxCells',r.maxCells,1,256,true);range(d.id,'worldWriting.maxError',r.maxError,0,2,true)}}
    if(d.fraud!==undefined){const f=d.fraud;if(!isObj(f))report.errors.push(d.id+': fraud 규정 오류');else{if(!Array.isArray(f.factions)||!f.factions.length||f.factions.some(k=>!keys.has(k)))report.errors.push(d.id+': fraud.factions 참조 오류');for(const k of ['chance','reliability']as const){if(!Number.isFinite(f[k]))report.errors.push(d.id+': fraud.'+k+' 필요');else range(d.id,'fraud.'+k,f[k],0,k==='chance'?1:100)}if(!Array.isArray(f.facilityCount)||f.facilityCount.length!==2||f.facilityCount.some(n=>!Number.isInteger(n)||n<1||n>8)||f.facilityCount[0]>f.facilityCount[1])report.errors.push(d.id+': fraud.facilityCount 범위 오류');if(!Array.isArray(f.labels)||!f.labels.length||f.labels.some(s=>typeof s!=='string'||!s.trim()||s.length>60))report.errors.push(d.id+': fraud.labels 필요')}}
    if(d.independent?.worldMaps!==undefined&&typeof d.independent.worldMaps!=='boolean')report.errors.push(d.id+': independent.worldMaps 참/거짓 필요')
    if(d.independent?.readMarketMaps!==undefined&&typeof d.independent.readMarketMaps!=='boolean')report.errors.push(d.id+': independent.readMarketMaps 참/거짓 필요')
    if(d.independent?.shopSupplies!==undefined&&typeof d.independent.shopSupplies!=='boolean')report.errors.push(d.id+': independent.shopSupplies 참/거짓 필요')
    if(d.independent!==undefined){const n=d.independent;if(!isObj(n))report.errors.push(d.id+': independent 규정 오류');else for(const k of ['minFeatures','basePrice','pricePerFeature']as const){if(!Number.isFinite(n[k]))report.errors.push(d.id+': independent.'+k+' 필요');else range(d.id,'independent.'+k,n[k],k==='pricePerFeature'?0:1,k==='minFeatures'?256:100000,true)}}
    range(d.id,'noteReliability',d.noteReliability,0,100);range(d.id,'noteError',d.noteError,0,5,true)
    const c=d.commission;if(c){if(c.depthReward!==undefined)range(d.id,'commission.depthReward',c.depthReward,0,10000);range(d.id,'commission.refreshDays',c.refreshDays,1,365,true);range(d.id,'commission.deadlineBufferDays',c.deadlineBufferDays,1,365);range(d.id,'commission.baseReward',c.baseReward,1,100000,true);range(d.id,'commission.distanceReward',c.distanceReward,0,10000);range(d.id,'commission.minReliability',c.minReliability,0,100);range(d.id,'commission.minFeatures',c.minFeatures,1,128,true);range(d.id,'commission.reputation',c.reputation,0,100,true)}
    const r=d.writing;if(r){need(d.id,r.paper,'Item');need(d.id,r.ink,'Item');range(d.id,'writing.turns',r.turns,1,10000,true);range(d.id,'writing.minLiteracy',r.minLiteracy,1,5,true);range(d.id,'writing.baseReliability',r.baseReliability,0,100);range(d.id,'writing.perMastery',r.perMastery,0,20);range(d.id,'writing.baseError',r.baseError,0,5,true);range(d.id,'writing.errorEvery',r.errorEvery,1,5,true);range(d.id,'writing.minManipulation',r.minManipulation,.1,1);if(r.paper===r.ink)report.errors.push(d.id+': 종이와 잉크는 달라야 함')}
  }
  for(const d of db.all<InteractionDef>('Interaction')){
    if(!['waterBoil','waterCloth','waterCharcoal','waterSettle','waterPill','beddingIgnites','beddingExtinguished','foodSalted','foodSmoked','foodDried','foodFermented'].includes(d.event))report.errors.push(d.id+': 알 수 없는 상호작용 사건')
    for(const key of ['label','category','formula']as const)if(typeof d[key]!=='string'||!d[key].trim()||d[key].length>2000)report.errors.push(d.id+': 상호작용 글이 필요함')
    if(d.waterTreatment!==undefined&&!['boil','cloth','charcoal','settle','pill'].includes(d.waterTreatment))report.errors.push(d.id+': 알 수 없는 정수 방식')
  }
  for(const d of db.all<ItemDef>('Item'))for(const id of d.book?.interactions??[])need(d.id,id,'Interaction')
  for(const d of db.all<RecipeDef>('Recipe'))if(d.interaction&&!db.all<InteractionDef>('Interaction').some(i=>i.event===d.interaction))report.errors.push(d.id+': 상호작용 사건의 Def가 필요함')
  for (const t of db.all<TraitDef>('Trait')) {
    range(t.id,'overeatAt',t.mods?.overeatAt,0,Number.MAX_SAFE_INTEGER)
    range(t.id,'aloneRadius',t.mods?.aloneRadius,0,20,true);range(t.id,'neatEdgeThreshold',t.mods?.neatEdgeThreshold,0,100)
    range(t.id, 'weight', t.weight, 0)
    for (const id of t.conflicts ?? []) need(t.id, id, 'Trait')
  }
  for(const d of db.all<FatigueDef>('Fatigue')){
    range(d.id,'debtAbove',d.debtAbove,0,240)
    if(!Array.isArray(d.stages)||d.stages.length!==4||d.stages[3]?.minRest!==0){report.errors.push(d.id+': 휴식0까지의 네 피로 단계가 필요함');continue}
    for(let i=0;i<d.stages.length;i++){
      const b=d.stages[i]
      if(!isObj(b)||typeof b.label!=='string'||!b.label||['minRest','multiTurn','consciousness','wake','deepMinutes','stumble'].some(k=>!(k in b))){report.errors.push(d.id+': 피로 단계 구조 오류');continue}
      range(d.id,'stages.minRest',b.minRest,0,100);range(d.id,'stages.multiTurn',b.multiTurn,1,4);range(d.id,'stages.consciousness',b.consciousness,0,1);range(d.id,'stages.wake',b.wake,0,20);range(d.id,'stages.deepMinutes',b.deepMinutes,0,120);range(d.id,'stages.stumble',b.stumble,0,100)
      if(i&&isObj(d.stages[i-1])&&b.minRest>=d.stages[i-1]!.minRest)report.errors.push(d.id+': 피로 단계의 휴식 경계는 내림차순이어야 함')
    }
  }
  for(const c of db.all<CreatureDef>('Creature')){
    const fear=c.fireFear
    if(fear!==undefined){
      if(!isObj(fear)||['radius','torchPenalty','memoryPenalty','memoryTurns','avoidRadius','packRadius','maxMemories'].some(k=>!(k in fear)))report.errors.push(c.id+': 실제 불 공포 정책 구조 오류')
      if(['humanoid','mechanical'].includes(db.tryGet<BodyDef>(c.body)?.kind??''))report.errors.push(c.id+': 횃불 학습은 동물형 정책이어야 함')
      for(const key of ['radius','avoidRadius','packRadius']as const)range(c.id,'fireFear.'+key,fear?.[key],1,32,true)
      for(const key of ['torchPenalty','memoryPenalty']as const)range(c.id,'fireFear.'+key,fear?.[key],0,100)
      range(c.id,'fireFear.memoryTurns',fear?.memoryTurns,1,2880000,true);range(c.id,'fireFear.maxMemories',fear?.maxMemories,1,32,true)
    }
  }
  for(const d of db.all<NpcPsycheDef>('NpcPsyche')){
    range(d.id,'thoughtScale',d.thoughtScale,0,10);range(d.id,'acuteMult',d.acuteMult,1,5);range(d.id,'historyLimit',d.historyLimit,1,64,true)
    if(!isObj(d.events)||['hurt','nearDeath','allyDeath','leaderDeath','killedHuman','treated'].some(k=>!(k in d.events)))report.errors.push(d.id+': NPC 사건별 스트레스 표가 필요함')
    else for(const [key,value]of Object.entries(d.events))range(d.id,'events.'+key,value,-100,100)
  }
  for (const t of db.all<ThoughtDef>('Thought')) {
    if(t.sleepEvent!==undefined&&(!['quality','ground','wet'].includes(t.sleepEvent)||t.durationTurns<=0||t.lifeEvent!==undefined||t.condition!==undefined))report.errors.push(t.id+': 수면 사건은 양의 지속 시간과 독립 사건이어야 함')
    for(const key of ['minSleepQuality','minSleepWetness']as const){
      const event=key==='minSleepQuality'?'quality':'wet'
      if(t.sleepEvent===event&&t[key]===undefined||t[key]!==undefined&&t.sleepEvent!==event)report.errors.push(t.id+': 수면 임계는 해당 수면 사건에 필요함')
      if(t[key]!==undefined)range(t.id,key,t[key],0,key==='minSleepQuality'?1.2:100)
    }
    if(t.lifeEvent!==undefined&&(!['wash','warmMeal','talk','innSleep','treatment','relicRepair','companionDeath','plagueNews','corpseSearch','discovery','goodTrade','victory','seenBlood','limbLoss','fingerLoss','scar','overeat','hangover','tradeDeception','welcome','insult','expelled','ownRumor','interaction'].includes(t.lifeEvent)||t.durationTurns<=0))report.errors.push(`${t.id}: 실제 생활 사건과 양의 지속 시간이 필요함`)
    if(t.minEventQuality!==undefined){if(!t.lifeEvent)report.errors.push(t.id+': 사건 품질은 생활 사건에만 사용함');range(t.id,'minEventQuality',t.minEventQuality,0,100)}
    if(t.eventBackground!==undefined){if(!t.lifeEvent)report.errors.push(t.id+': 사건 배경은 생활 사건에만 사용함');need(t.id,t.eventBackground,'Background')}
    if(t.homeLandscape!==undefined&&(typeof t.homeLandscape!=='boolean'||t.durationTurns!==0||t.lifeEvent!==undefined||t.condition!==undefined||t.corpseOdor!==undefined||t.heardSound!==undefined||t.sleepEvent!==undefined||t.isolation!==undefined))report.errors.push(t.id+': 고향 풍경은 독립 조건이어야 함')
    if(t.eventRoomTypes!==undefined&&(!t.lifeEvent||!Array.isArray(t.eventRoomTypes)||!t.eventRoomTypes.length||t.eventRoomTypes.length>32||t.eventRoomTypes.some(x=>typeof x!=='string'||!x.length||x.length>80)))report.errors.push(t.id+': 발견 구역 종류는 생활 사건의 비어 있지 않은 목록이어야 함')
    if(t.minEventThreatRatio!==undefined){if(!t.lifeEvent)report.errors.push(t.id+': 교전 전력 조건은 생활 사건에만 사용함');range(t.id,'minEventThreatRatio',t.minEventThreatRatio,.01,100)}
    if(t.minEventTradeGain!==undefined){if(!t.lifeEvent)report.errors.push(t.id+': 거래 이득 조건은 생활 사건에만 사용함');range(t.id,'minEventTradeGain',t.minEventTradeGain,1,Number.MAX_SAFE_INTEGER,true)}
    if(t.eventDisease!==undefined){if(!t.lifeEvent)report.errors.push(t.id+': 사건 질병은 생활 사건에만 사용함');need(t.id,t.eventDisease,'Disease')}
    if(t.eventOpinion!==undefined&&(typeof t.eventOpinion!=='boolean'||!t.lifeEvent||t.mood<=0))report.errors.push(t.id+': 사건 평판 부호는 양의 생활 사건 기본값에만 사용함')
    if(t.faceEvent!==undefined){const f=t.faceEvent;if(t.lifeEvent!=='scar'||!isObj(f)||!Array.isArray(f.groups)||!f.groups.length||f.groups.length>32||f.groups.some(x=>typeof x!=='string'||!x.length||x.length>80)||typeof f.mood!=='number'||!Number.isFinite(f.mood)||f.mood < -100||f.mood>100||f.traitMoodKey!==undefined&&(typeof f.traitMoodKey!=='string'||!f.traitMoodKey.length||f.traitMoodKey.length>80))report.errors.push(t.id+': 얼굴 흉터 사건 설정이 잘못됨')}
    if(t.traitMoodKey!==undefined&&(!t.lifeEvent||typeof t.traitMoodKey!=='string'||!t.traitMoodKey.length||t.traitMoodKey.length>80))report.errors.push(`${t.id}: traitMoodKey는 생활 사건의 수정치 이름이어야 함`)

    if(t.conditionMoodKey!==undefined&&(!t.condition||typeof t.conditionMoodKey!=='string'||!t.conditionMoodKey.length||t.conditionMoodKey.length>80))report.errors.push(t.id+': conditionMoodKey는 조건 사고의 수정치 이름이어야 함')
    const corpse=t.corpseOdor
    if(corpse!==undefined){
      if(!isObj(corpse)||corpse.radius===undefined||corpse.minAgeTurns===undefined||t.durationTurns!==0||t.condition!==undefined||t.lifeEvent!==undefined||t.sleepEvent!==undefined||t.heardSound!==undefined||t.isolation!==undefined)report.errors.push(t.id+': 시체 냄새는 독립 조건과 반경/실제 경과 시간이 필요함')
      range(t.id,'corpseOdor.radius',corpse?.radius,1,20,true);range(t.id,'corpseOdor.minAgeTurns',corpse?.minAgeTurns,0,144000,true)
      if(corpse?.traitMoodKey!==undefined&&(typeof corpse.traitMoodKey!=='string'||!corpse.traitMoodKey.length||corpse.traitMoodKey.length>80))report.errors.push(t.id+': 시체 냄새 특성 수정치 오류')
    }
    const sound=t.heardSound
    if(sound!==undefined){
      if(!isObj(sound)||typeof sound.faction!=='string'||!sound.faction.length||!['humanoid','quadruped','amalgam','mechanical','invertebrate'].includes(sound.bodyKind)||sound.recentTurns===undefined||t.durationTurns!==0||t.lifeEvent!==undefined||t.condition!==undefined||t.sleepEvent!==undefined||t.isolation!==undefined)report.errors.push(t.id+': 청각 사고는 독립 조건과 실제 소리 출처/유한 시간이 필요함')
      range(t.id,'heardSound.recentTurns',sound?.recentTurns,1,1200,true)
      if(sound?.faction!==undefined&&!db.all<CreatureDef>('Creature').some(c=>c.faction===sound.faction))report.errors.push(t.id+': 청각 사고의 세력 출처 없음')
      if(sound?.traitMoodKey!==undefined&&(typeof sound.traitMoodKey!=='string'||!sound.traitMoodKey.length||sound.traitMoodKey.length>80))report.errors.push(t.id+': 청각 사고 특성 수정치 오류')
    }
    const isolation=t.isolation
    if(isolation!==undefined){
      if(!isObj(isolation)||['graceTurns','stepTurns','maxSteps'].some(k=>!(k in isolation))||t.durationTurns!==0||t.mood>=0||t.condition!==undefined||t.lifeEvent!==undefined||t.sleepEvent!==undefined)report.errors.push(t.id+': 무대화 사고는 독립 조건과 음수 기분/관찰 간격이 필요함')
      range(t.id,'isolation.graceTurns',isolation?.graceTurns,1,2880000,true);range(t.id,'isolation.stepTurns',isolation?.stepTurns,1,2880000,true);range(t.id,'isolation.maxSteps',isolation?.maxSteps,1,100,true)
      if(isolation?.traitMultiplier!==undefined&&(typeof isolation.traitMultiplier!=='string'||!isolation.traitMultiplier.length||isolation.traitMultiplier.length>80))report.errors.push(t.id+': 무대화 특성 수정치 이름 오류')
    }
    const condition=t.condition
    if(condition!==undefined){
      if(!isObj(condition)||!Array.isArray(condition.any)||!condition.any.length||condition.any.length>16||t.durationTurns!==0||t.lifeEvent!==undefined)report.errors.push(t.id+': 조건 사고는 비어 있지 않은 대안과 지속0이 필요함')
      else for(const all of condition.any){
        if(!Array.isArray(all)||!all.length||all.length>16){report.errors.push(t.id+': 조건 대안의 범위가 비었거나 너무 많음');continue}
        for(const band of all){
          if(!isObj(band)||!['bodyTemp','innerWetness','painStage','rest','sleepDebt','hygiene','bloodLoss','knownInfection','woundInfection','fever','tourniquetHours','frostbiteGrade','restFireDistance','ashExposure','lightLevel','adjacentThreats','latentBiteAche'].includes(band.metric)){report.errors.push(t.id+': 알 수 없는 조건 지표');continue}
          const limits:Record<string,[number,number]>={bodyTemp:[0,60],innerWetness:[0,100],painStage:[0,5],rest:[0,100],sleepDebt:[0,10000],hygiene:[0,100],bloodLoss:[0,1],knownInfection:[0,100],woundInfection:[0,100],fever:[0,60],tourniquetHours:[0,10000],frostbiteGrade:[0,4],restFireDistance:[0,100],ashExposure:[0,1],lightLevel:[0,3],adjacentThreats:[0,100],latentBiteAche:[0,100]}
          const [low,high]=limits[band.metric]!
          if(band.min===undefined&&band.max===undefined)report.errors.push(t.id+': 조건 범위의 경계가 필요함')
          for(const key of ['min','max']as const)if(band[key]!==undefined)range(t.id,'condition.'+key,band[key],low,high)
          if(band.min!==undefined&&band.max!==undefined&&band.min>=band.max)report.errors.push(t.id+': 조건 범위의 순서가 잘못됨')
          for(const key of ['minExclusive','maxInclusive']as const)if(band[key]!==undefined&&typeof band[key]!=='boolean')report.errors.push(t.id+': 조건 경계 포함 여부는 논리값이어야 함')
          if(band.minExclusive!==undefined&&band.min===undefined||band.maxInclusive!==undefined&&band.max===undefined)report.errors.push(t.id+': 포함 여부에 대응하는 경계가 필요함')
        }
      }
    }
    const h=t.hallucination
    if(h!==undefined){
     if(!isObj(h)||['debtHours','checkTurns','chance','range','lifetimeTurns'].some(k=>!(k in h)))report.errors.push(t.id+': hallucination 구조 오류')
     range(t.id,'hallucination.debtHours',h?.debtHours,1,240);range(t.id,'hallucination.checkTurns',h?.checkTurns,1,28800,true);range(t.id,'hallucination.chance',h?.chance,0,1);range(t.id,'hallucination.range',h?.range,1,20,true);range(t.id,'hallucination.lifetimeTurns',h?.lifetimeTurns,1,28800,true)
    }
    range(t.id, 'durationTurns', t.durationTurns, 0, Infinity, true)
    range(t.id, 'stack', t.stack, 1, 100, true)
    range(t.id, 'stackMult', t.stackMult, 0, 1)
    if (t.decay && !['constant', 'linear', 'step'].includes(t.decay)) report.errors.push(`${t.id}: 알 수 없는 사고 감쇠`)
    if (t.decay === 'step' && !t.steps?.length) report.errors.push(`${t.id}: 단계 감쇠 표가 비어 있음`)
    for (const step of t.steps ?? []) { range(t.id, 'steps.afterTurns', step.afterTurns, 0, Math.max(0, t.durationTurns - 1), true); range(t.id, 'steps.mult', step.mult, 0, 1) }
    if (new Set(t.steps?.map((s) => s.afterTurns)).size !== (t.steps?.length ?? 0)) report.errors.push(`${t.id}: 단계 감쇠 시각 중복`)
  }
  for (const t of db.all<TraumaDef>('Trauma')) {
    if (!['species', 'fire', 'water', 'dark', 'blood'].includes(t.kind)) report.errors.push(`${t.id}: 알 수 없는 트라우마 종류`)
    need(t.id, t.positive?.trait, 'Trait')
    range(t.id, 'stressPer10', t.stressPer10, 0)
    for (const key of ['mood', 'hit', 'morale'] as const) range(t.id, key, t[key], -100, 100)
    for (const [key, v] of Object.entries(t.overcome ?? {})) range(t.id, `overcome.${key}`, v, ['flee', 'breakdown'].includes(key) ? -100 : 0, ['flee', 'breakdown'].includes(key) ? 0 : 100)
    for (const key of ['hit', 'morale'] as const) range(t.id, `positive.${key}`, t.positive?.[key], 0, 100)
    range(t.id, 'positive.yieldMult', t.positive?.yieldMult, 1)
  }
  for (const i of db.all<ItemDef>('Item')) {
    if(i.light?.openFlame!==undefined&&typeof i.light.openFlame!=='boolean')report.errors.push(i.id+': openFlame은 논리값이어야 함')
    need(i.id, i.material, 'Material')
    if(i.rawMaterial){need(i.id,i.rawMaterial.material,'Material');if(!i.rawMaterial.material||!Number.isSafeInteger(i.rawMaterial.grams)||i.rawMaterial.grams<=0)report.errors.push(`${i.id}: rawMaterial은 실제 재질과 양의 정수 grams가 필요함`)}
    if(i.rawFragment!==undefined&&typeof i.rawFragment!=='boolean')report.errors.push(`${i.id}: rawFragment는 boolean이어야 함`)
    if(i.rawFragment&&i.rawMaterial)report.errors.push(`${i.id}: rawFragment와 고정 rawMaterial을 함께 쓰지 않음`)
    need(i.id, i.prosthetic, 'Prosthetic')
    if (i.drink?.quality) { range(i.id, 'drink.quality.pathogen', i.drink.quality.pathogen, 0, 100); range(i.id, 'drink.quality.ash', i.drink.quality.ash, 0) }
    if (i.stuffSlots?.length && (new Set(i.stuffSlots.map((s) => s.id)).size !== i.stuffSlots.length || i.stuffSlots.filter((s) => s.primary).length !== 1)) report.errors.push(`${i.id}: 재질 슬롯 이름은 고유하고 주재료는 하나여야 함`)
    for (const slot of i.stuffSlots ?? []) {
      need(i.id, slot.ref, 'Material')
      range(i.id, `stuffSlots.${slot.id}.volumeCm3`, slot.volumeCm3, Number.MIN_VALUE)
      const ref = db.tryGet<MaterialDef>(slot.ref)
      if (ref && !slot.accepts.includes(ref.category)) report.errors.push(`${i.id}: 기준 재질은 슬롯 '${slot.id}'에 들어가지 않음`)
    }
    for (const [slot, stuff] of Object.entries(i.stuffDefaults ?? {})) {
      const shape = i.stuffSlots?.find((s) => s.id === slot)
      if (!shape) report.errors.push(`${i.id}: 재질 슬롯 '${slot}' 없음`)
      if (Array.isArray(stuff) && stuff.length === 0) report.errors.push(`${i.id}: 재질 슬롯 '${slot}'의 혼합 재료가 비어 있음`)
      for (const part of typeof stuff === 'string' ? [{ material: stuff, massG: 1 }] : stuff) {
        need(i.id, part.material, 'Material')
        range(i.id, `stuffDefaults.${slot}.massG`, part.massG, Number.MIN_VALUE)
        const m = db.tryGet<MaterialDef>(part.material)
        if (m && shape && !shape.accepts.includes(m.category)) report.errors.push(`${i.id}: '${part.material}'은 슬롯 '${slot}'에 들어가지 않음`)
      }
    }
    need(i.id, i.ranged?.ammo, 'Item')
    need(i.id, i.ranged?.firearm?.powder, 'Item')
    need(i.id, i.ranged?.firearm?.oil, 'Item')
    need(i.id, i.cartridge?.spent, 'Item')
    for(const ammo of i.ranged?.magazine?.alternatives??[])need(i.id,ammo,'Item')
    need(i.id, i.cooking?.result, 'Item')
    need(i.id, i.repair?.material, 'Item')
    need(i.id, i.salvage?.material, 'Item')
    need(i.id, i.place, 'Terrain')
    range(i.id, 'cooking.turns', i.cooking?.turns, 1, Infinity, true)
    if(i.repair?.appraisalRequired!==undefined&&typeof i.repair.appraisalRequired!=='boolean')report.errors.push(i.id+': appraisalRequired는 논리값이어야 함')
    if(i.repair?.station&&!db.all<TerrainDef>('Terrain').some(t=>t.station?.id===i.repair!.station))report.errors.push(i.id+': 수리 작업장 없음')
    const risk=i.repair?.relicRisk
    if(risk!==undefined){
      if(!i.relic||!i.repair?.appraisalRequired||!i.repair?.station||!isObj(risk)||['base','min','max'].some(k=>!(k in risk)))report.errors.push(i.id+': 유물 수리 위험은 감정/작업장과 완전한 확률 정책이 필요함')
      for(const key of ['base','min','max']as const)range(i.id,'relicRisk.'+key,risk?.[key],0,100)
      if(risk&&risk.min>risk.max)report.errors.push(i.id+': 수리 위험 범위 뒤집힘')
    }
    range(i.id, 'repair.turns', i.repair?.turns, 1, Infinity, true)
    range(i.id, 'repair.unitsPer10', i.repair?.unitsPer10, Number.MIN_VALUE)
    range(i.id, 'salvage.turns', i.salvage?.turns, 1, Infinity, true)
    range(i.id, 'salvage.count', i.salvage?.count, 1, Infinity, true)
    if (i.book) {
      range(i.id, 'book.pages', i.book.pages, 1, Infinity, true)
      for (const id of i.book.unlocks ?? []) need(i.id, id, 'Recipe')
      for (const id of i.book.bestiary ?? []) need(i.id,id,'BestiaryEntry')
      for (const id of i.book.identify ?? []) need(i.id,id,'PillEffect')
      range(i.id,'book.literacyMin',i.book.literacyMin,0,3,true);range(i.id,'book.literacyTo',i.book.literacyTo,1,3,true)
      range(i.id, 'book.amount', i.book.amount, 0)
      if (!['medicine', 'survival'].includes(i.book.mastery)) report.errors.push(`${i.id}: 알 수 없는 책 숙달 '${i.book.mastery}'`)
    }
    range(i.id, 'apparel.wetLoss', i.apparel?.wetLoss, 0, 100)
    range(i.id, 'apparel.waterproofPct', i.apparel?.waterproofPct, 0, 100)
    range(i.id, 'apparel.windproof', i.apparel?.windproof, 0, 1)
  }
  for(const i of db.all<ItemDef>('Item'))if(i.respirator!==undefined){
   const q=i.respirator
   if(!isObj(q)){report.errors.push(i.id+': respirator 구조 오류');continue}
   if(!isObj(q)||['filter','chargeTurns','protection','wetAbove','wetProtection','refillTurns'].some(k=>!(k in q)))report.errors.push(i.id+': respirator 구조 오류')
   for(const key of ['chargeTurns','protection','wetAbove','wetProtection','refillTurns']as const)if(!Number.isFinite(q[key]))report.errors.push(i.id+': respirator.'+key+' 수치 필요')
   need(i.id,q.filter,'Item');const filter=db.tryGet<ItemDef>(q.filter)
   if(!filter?.uses||filter.uses<=0)report.errors.push(i.id+': respirator.filter는 새 여과 횟수가 있는 실제 물품이어야 함')
   if(!i.slot||!i.apparel||i.uses!==q.chargeTurns)report.errors.push(i.id+': respirator는 실제 착용 의복과 초기 여과 시간 필요')
   range(i.id,'respirator.chargeTurns',q.chargeTurns,1,1000000,true);range(i.id,'respirator.protection',q.protection,0,1);range(i.id,'respirator.wetAbove',q.wetAbove,0,100);range(i.id,'respirator.wetProtection',q.wetProtection,0,1);range(i.id,'respirator.refillTurns',q.refillTurns,1,10000,true)
  }
  for(const d of db.all<WaterSafetyDef>('WaterSafety'))if(d.inhalation!==undefined){
   const q=d.inhalation
   if(!isObj(q)){report.errors.push(d.id+': inhalation 구조 오류');continue}
   if(!isObj(q)||typeof q.label!=='string'||!q.label||!isObj(q.weather)||!Array.isArray(q.caps)||!q.caps.length)report.errors.push(d.id+': inhalation 구조 오류')
   if(isObj(q.weather))for(const [weather,n]of Object.entries(q.weather)){if(!['clear','overcast','ashrain','deepOvercast','ashstorm','ashsnow','ashgale','frostfog'].includes(weather))report.errors.push(d.id+': inhalation.weather 알 수 없는 날씨');range(d.id,'inhalation.weather',n as number,0,100)}
   if(Array.isArray(q.caps))for(let i=0;i<q.caps.length;i++){const row=q.caps[i];if(!isObj(row)||!('dose' in row)||!('cap' in row)){report.errors.push(d.id+': inhalation.caps 구조 오류');continue}range(d.id,'inhalation.caps.dose',row.dose as number,Number.MIN_VALUE,1e9);range(d.id,'inhalation.caps.cap',row.cap as number,0,1);if(i&&((q.caps[i-1]?.dose??0)>=row.dose||(q.caps[i-1]?.cap??1)<=row.cap))report.errors.push(d.id+': inhalation.caps는 흡입량 증가/상한 감소 순서여야 함')}
   range(d.id,'inhalation.coughTurns',q.coughTurns,1,28800,true);range(d.id,'inhalation.coughNoise',q.coughNoise,0,100)
  }
  for(const d of db.all<NutritionDef>('Nutrition')){
   const q=d.leanDiet
   if(q!==undefined){
    if(!isObj(q)||['windowTurns','proteinKcalPerGram','proteinFraction','absorption','waterPerDay'].some(k=>!(k in q)))report.errors.push(d.id+': leanDiet 구조 오류')
    range(d.id,'leanDiet.windowTurns',q?.windowTurns,1,288000,true);range(d.id,'leanDiet.proteinKcalPerGram',q?.proteinKcalPerGram,1,10);range(d.id,'leanDiet.proteinFraction',q?.proteinFraction,0,1);range(d.id,'leanDiet.absorption',q?.absorption,0,1);range(d.id,'leanDiet.waterPerDay',q?.waterPerDay,0,10000)
   }
  }
  for (const d of db.all<DiseaseDef>('Disease')) {
    if (!Array.isArray(d.incubationDays) || d.incubationDays.length !== 2 || d.incubationDays[0] > d.incubationDays[1]) report.errors.push(`${d.id}: 잠복기 범위 오류`)
    else for (const n of d.incubationDays) range(d.id, 'incubationDays', n, 0)
    range(d.id,'fatalAfterTurns',d.fatalAfterTurns,1,Infinity,true)
    range(d.id,'latentScarPain',d.latentScarPain,0,100)
    range(d.id, 'perDay', d.perDay, 0)
    if (d.fever !== 0) range(d.id, 'fever', d.fever, 20, 44)
    if(d.gradualFever!==undefined&&typeof d.gradualFever!=='boolean')report.errors.push(d.id+': gradualFever는 불리언이어야 함')
    range(d.id,'immunePerDay',d.immunePerDay,0,100)
    range(d.id,'antibioticResponse',d.antibioticResponse,0,1)
    for(const [field,required] of [['clinical',[]],['coldExposure',['below','chance']],['lyingExposure',['part','turns','chance']],['woundExposure',['wounds','contamination','severityFraction','terrain','addedContamination','checkTurns','chance']]] as const){
     const value=d[field];if(value!==undefined&&(!isObj(value)||required.some(key=>!(key in value))))report.errors.push(d.id+': '+field+' 구조 오류')
    }
    if(d.clinical?.seizure!==undefined&&(!isObj(d.clinical.seizure)||['hourChance','stunTurns','fractureChance','severity'].some(key=>!(key in d.clinical!.seizure!))))report.errors.push(d.id+': clinical.seizure 구조 오류')
    const clinical=d.clinical
    range(d.id,'clinical.pain',clinical?.pain,0,150);range(d.id,'clinical.manipulation',clinical?.manipulation,0,1);range(d.id,'clinical.eatingMult',clinical?.eatingMult,1,10);range(d.id,'clinical.breathingPerProgress',clinical?.breathingPerProgress,0,.01)
    if(clinical?.seizure){const q=clinical.seizure;range(d.id,'seizure.hourChance',q.hourChance,0,1);range(d.id,'seizure.stunTurns',q.stunTurns,1,1200,true);range(d.id,'seizure.fractureChance',q.fractureChance,0,1);range(d.id,'seizure.severity',q.severity,1,100)}
    if(d.coldExposure){range(d.id,'coldExposure.below',d.coldExposure.below,28,37);range(d.id,'coldExposure.chance',d.coldExposure.chance,0,1)}
    if(d.lyingExposure){if(!db.all<BodyDef>('Body').some(b=>b.parts.some(p=>p.id===d.lyingExposure!.part)))report.errors.push(d.id+': 눕기 노출의 부위가 없음');range(d.id,'lyingExposure.turns',d.lyingExposure.turns,1,Infinity,true);range(d.id,'lyingExposure.chance',d.lyingExposure.chance,0,1)}
    if(d.woundExposure){const q=d.woundExposure;if(!Array.isArray(q.wounds)||!q.wounds.length||!Array.isArray(q.terrain))report.errors.push(d.id+': 상처 노출 목록 오류');else{for(const id of q.wounds)need(d.id,id,'Wound');for(const id of q.terrain)need(d.id,id,'Terrain')}range(d.id,'woundExposure.contamination',q.contamination,0,100);range(d.id,'woundExposure.severityFraction',q.severityFraction,0,1);range(d.id,'woundExposure.addedContamination',q.addedContamination,0,100);range(d.id,'woundExposure.checkTurns',q.checkTurns,1,Infinity,true);range(d.id,'woundExposure.chance',q.chance,0,1)}
    range(d.id, 'sporeChance', d.sporeChance, 0, 1)
  }
  for(const c of db.all<CreatureDef>('Creature')){if(c.biteDisease!==undefined&&(!isObj(c.biteDisease)||!('id' in c.biteDisease)||!('chance' in c.biteDisease)))report.errors.push(c.id+': biteDisease 구조 오류');range(c.id,'biteDisease.chance',c.biteDisease?.chance,0,1)
   const q=c.biteDisease
   if(q?.prevention!==undefined){if(!isObj(q.prevention)||!('turns'in q.prevention)||!('chanceMult'in q.prevention))report.errors.push(c.id+': biteDisease.prevention 구조 오류');range(c.id,'biteDisease.prevention.turns',q.prevention?.turns,1,Infinity,true);range(c.id,'biteDisease.prevention.chanceMult',q.prevention?.chanceMult,0,1)}
   if(q?.carrier!==undefined){if(!isObj(q.carrier)||typeof q.carrier.label!=='string'||!q.carrier.label||!('chance'in q.carrier)||!('transmission'in q.carrier))report.errors.push(c.id+': biteDisease.carrier 구조 오류');range(c.id,'biteDisease.carrier.chance',q.carrier?.chance,0,1);range(c.id,'biteDisease.carrier.transmission',q.carrier?.transmission,0,1)}
  }
  for(const d of db.all<DrugDef>('Drug'))need(d.id,d.curesDisease,'Disease')
  for (const b of db.all<BreakDef>('Break')) {
    if (!['minor', 'moderate', 'extreme'].includes(b.tier)) report.errors.push(`${b.id}: 알 수 없는 붕괴 단계 '${b.tier}'`)
    if (!Array.isArray(b.turns) || b.turns.length !== 2 || b.turns[0] > b.turns[1]) report.errors.push(`${b.id}: 붕괴 지속 범위 오류`)
    else for (const n of b.turns) range(b.id, 'turns', n, 1, Infinity, true)
    if (!['irritable', 'binge', 'mutter', 'cry', 'drink', 'lie', 'flee', 'wander', 'organize', 'drop', 'drugs', 'fast', 'berserk', 'catatonia', 'selfharm', 'breakgear', 'despair', 'voices'].includes(b.kind)) report.errors.push(`${b.id}: 알 수 없는 붕괴 종류 '${b.kind}'`)
    range(b.id, 'weight', b.weight, 0)
    for (const id of Object.keys(b.traitWeights ?? {})) need(b.id, id, 'Trait')
  }
  for (const b of db.all<BackgroundDef>('Background')) {
    const home=b.homeland
    if(home!==undefined){
      if(!isObj(home)||home.biomes===undefined&&home.river===undefined||home.biomes!==undefined&&(!Array.isArray(home.biomes)||!home.biomes.length||home.biomes.length>32)||home.river!==undefined&&typeof home.river!=='boolean')report.errors.push(b.id+': 고향 풍경에는 실제 바이옴/강 조건이 필요함')
      if(Array.isArray(home?.biomes))for(const id of home.biomes)need(b.id,id,'Biome')
    }
    range(b.id, 'startMoney', b.startMoney, 0, Infinity, true)
    range(b.id, 'literacy', b.literacy, 0, 3, true)
    range(b.id, 'startingRumors', b.startingRumors, 0, 3, true)
    for (const [id, q] of Object.entries(b.startQuality ?? {})) { range(b.id, 'startQuality', q, 0, 5, true); if (!b.startItems.includes(id)) report.errors.push(`${b.id}: 시작 품질 '${id}'은 시작 소지품에 있어야 함`) }
    for (const category of b.recipeCategories ?? []) if (!['medical', 'cooking', 'woodwork', 'smithing', 'textile', 'survival'].includes(category)) report.errors.push(`${b.id}: 시작 제작 분류 '${category}' 오류`)
    for (const scar of b.startScars ?? []) {
      if (!db.tryGet<BodyDef>(db.tryGet<CreatureDef>('Creature.Drifter')?.body ?? '')?.parts.some((p) => p.id === scar.part)) report.errors.push(`${b.id}: 시작 흉터 부위 '${scar.part}' 없음`)
      range(b.id, 'startScars.severity', scar.severity, 1)
    }
    if (b.statMode && !['absolute', 'delta'].includes(b.statMode)) report.errors.push(`${b.id}: 알 수 없는 능력치 보정 방식`)
    for (const [key, n] of Object.entries(b.stats ?? {})) {
      if (!['str', 'agi', 'per', 'vit', 'wil'].includes(key)) report.errors.push(`${b.id}: 알 수 없는 능력치 '${key}'`)
      range(b.id, `stats.${key}`, n, b.statMode === 'delta' ? -2 : 1, b.statMode === 'delta' ? 2 : 20, true)
    }
    if (b.ageRange) {
      if (b.ageRange.length !== 2 || b.ageRange[0] > b.ageRange[1]) report.errors.push(`${b.id}: 나이 범위 오류`)
      for (const n of b.ageRange) range(b.id, 'ageRange', n, 16, 120, true)
    }
    if (b.statMode === 'delta' && Object.values(b.stats ?? {}).reduce((n, v) => n + v, 0) !== 0) report.errors.push(`${b.id}: 배경 능력치 보정 합은0이어야 함`)
  }
  for (const it of db.all<ItemDef>('Item')) if (it.ranged?.reloadTurns !== undefined) range(it.id, 'ranged.reloadTurns', it.ranged.reloadTurns, 1, 100, true)
  for (const m of db.all<MaterialDef>('Material')) {
    if(m.recoveryItem){need(m.id,m.recoveryItem,'Item');if(db.tryGet<ItemDef>(m.recoveryItem)?.rawMaterial?.material!==m.id)report.errors.push(`${m.id}: recoveryItem은 같은 재질의 실제 원재료여야 함`)}
    range(m.id, 'density', m.density, Number.MIN_VALUE)
    for (const key of ['sharpness', 'hardness', 'toughness', 'wetLoss', 'corrosionResist'] as const) range(m.id, key, m[key], key === 'toughness' ? 1 : 0, 100)
    range(m.id, 'insulation', m.insulation, 0)
    range(m.id, 'flammability', m.flammability, 0)
    range(m.id, 'valuePerKg', m.valuePerKg, 0)
  }
  for(const d of db.all<ItemDef>('Item'))if(d.openFood!==undefined){
    const rule=d.openFood
    if(!isObj(rule))report.errors.push(d.id+': openFood 구조 오류')
    else{
      need(d.id,rule.result,'Item');const result=db.tryGet<ItemDef>(rule.result)
      if(!d.food||!result?.food||result.openFood||!result.food.servings||d.id===rule.result||JSON.stringify(d.size)!==JSON.stringify(result.size))report.errors.push(d.id+': openFood 실제 음식/용기 결과 오류')
      if(!Number.isSafeInteger(rule.turns)||rule.turns<1||rule.turns>1000)report.errors.push(d.id+': openFood.turns 범위 오류')
      if(!Array.isArray(rule.tools)||!rule.tools.length)report.errors.push(d.id+': openFood.tools 필요')
      else for(const id of rule.tools)need(d.id,id,'Item')
    }
  }
  for(const d of db.all<ItemDef>('Item')){
    const f=d.food
    if(f&&(f.servings!==undefined||f.emptyVessel!==undefined)){
      if(!Number.isSafeInteger(f.servings)||!f.servings||f.servings<1||f.servings>100)report.errors.push(d.id+': food.servings 범위 오류')
      need(d.id,f.emptyVessel,'Item')
      const empty=f.emptyVessel&&db.tryGet<ItemDef>(f.emptyVessel)
      if(!empty||empty.food||d.stackable||d.maxStack!==1||JSON.stringify(empty.size)!==JSON.stringify(d.size)||d.uses!==f.servings)report.errors.push(d.id+': food.emptyVessel 원래 용기/칸/회분 오류')
    }
  }
  for(const d of db.all<ItemDef>('Item'))if(d.food?.scentRadius!==undefined)range(d.id,'food.scentRadius',d.food.scentRadius,0,10)
  for (const r of db.all<RecipeDef>('Recipe')) {
    const output = db.tryGet<ItemDef>(r.output?.item)
    for (const stuff of Object.values(output?.stuffDefaults ?? {})) for (const part of typeof stuff === 'string' ? [{ material: stuff }] : stuff) {
      const m = db.tryGet<MaterialDef>(part.material)
      if (m?.craftable === false) report.errors.push(`${r.id}: '${part.material}' 재질은 제작 불가`)
      if (m?.station && !r.stations?.includes(m.station)) report.errors.push(`${r.id}: '${part.material}' 가공에 '${m.station}' 작업장이 필요함`)
    }
    need(r.id, r.output?.item, 'Item')
    if(r.evaporation){const spec=r.evaporation;if(typeof spec!=='object'||!Number.isSafeInteger(spec.ml)||spec.ml<=0||!Number.isFinite(spec.salinity)||spec.salinity<=0)report.errors.push(`${r.id}: evaporation의 실제 물량/염도 구조 오류`);range(r.id,'evaporation.ml',spec.ml,1,100000,true);range(r.id,'evaporation.salinity',spec.salinity,Number.MIN_VALUE,400);if(!output?.saltGrams||Math.abs(output.saltGrams*r.output.count-spec.ml*spec.salinity/1000)>1e-9)report.errors.push(`${r.id}: 증발 소금 질량 불일치`);if(r.waterTreatment||r.passiveTurns||r.materialInputs?.length||r.inputs.some(i=>db.tryGet<ItemDef>(i.item)?.drink))report.errors.push(`${r.id}: 증발의 실제 물은 별도 예약하고 즉시 결과로 처리해야 함`)}
    range(r.id, 'workTurns', r.workTurns, 1, Infinity, true)
    if(r.preservation!==undefined){
      const d=r.preservation
      if(!isObj(d)||!['smoke','dry','ferment'].includes(d.method))report.errors.push(r.id+': preservation 구조 오류')
      else{
        if(!Number.isSafeInteger(r.passiveTurns)||!r.passiveTurns||r.passiveTurns<1)report.errors.push(r.id+': preservation 실제 가공 기간 필요')
        for(const key of ['fastWind','fastRate']as const){if(!Number.isFinite(d[key]))report.errors.push(r.id+': preservation.'+key+' 필요');else range(r.id,'preservation.'+key,d[key],1,4,true)}
        if(d.vessel!==undefined){
          need(r.id,d.vessel,'Item')
          const base=db.tryGet<ItemDef>(d.vessel),food=output?.food
          if(d.method!=='ferment'||!food?.servings||food.emptyVessel!==d.vessel||r.output.count!==1||base?.food||r.inputs.filter(i=>i.item===d.vessel).reduce((n,i)=>n+i.count,0)!==1)report.errors.push(r.id+': preservation 원래 용기/회분 규칙 오류')
        }else if(d.method==='ferment')report.errors.push(r.id+': preservation 발효에는 실제 원래 용기가 필요함')
        if(!output?.food||!r.inputs.some(i=>db.tryGet<ItemDef>(i.item)?.food))report.errors.push(r.id+': preservation 실제 음식 입력/결과 필요')
      }
    }
    range(r.id, 'passiveTurns', r.passiveTurns, 1, Infinity, true)
    range(r.id, 'noise', r.noise, 0)
    range(r.id, 'smell', r.smell, 0)
    if (!r.inputs?.length&&!r.materialInputs?.length) report.errors.push(`${r.id}: 제작 재료가 비어 있음`)
    const materialSlots=new Set<string>()
    for(const input of r.materialInputs??[]){
      const slot=output?.stuffSlots?.find(s=>s.id===input.slot)
      if(!slot||materialSlots.has(input.slot))report.errors.push(`${r.id}: materialInputs 슬롯이 없거나 중복됨`)
      materialSlots.add(input.slot)
      if(!Number.isSafeInteger(input.grams)||input.grams<=0)report.errors.push(`${r.id}: materialInputs.grams는 양의 정수여야 함`)
      if(input.accepts&&(!input.accepts.length||input.accepts.some(category=>!slot?.accepts.includes(category))))report.errors.push(`${r.id}: materialInputs.accepts는 실제 슬롯의 재질 범위여야 함`)
      for(const material of input.materials??[]){need(r.id,material,'Material');const m=db.tryGet<MaterialDef>(material);if(m&&(!slot?.accepts.includes(m.category)||input.accepts&&!input.accepts.includes(m.category)||m.craftable===false||m.station&&!r.stations?.includes(m.station)))report.errors.push(`${r.id}: materialInputs.materials에 제작할 수 없는 재질이 있음`)}
    }
    if(r.materialInputs?.length&&(output?.stuffSlots??[]).some(slot=>!materialSlots.has(slot.id)))report.errors.push(`${r.id}: materialInputs는 결과의 실제 재질 슬롯 전체를 지정해야 함`)
    if (!['str', 'agi', 'per', 'vit', 'wil'].includes(r.primaryAttr)) report.errors.push(`${r.id}: 알 수 없는 제작 능력치 '${r.primaryAttr}'`)
    for (const [key, n] of Object.entries(r.minAttr ?? {})) {
      if (!['str', 'agi', 'per', 'vit', 'wil'].includes(key)) report.errors.push(`${r.id}: 알 수 없는 필요 능력치 '${key}'`)
      range(r.id, `minAttr.${key}`, n, 1, 20, true)
    }
    range(r.id, 'output.count', r.output?.count, 1, Infinity, true)
    for (const i of r.inputs ?? []) { need(r.id, i.item, 'Item'); range(r.id, 'inputs.count', i.count, 1, Infinity, true) }
    for (const station of r.stations ?? []) if (!['hand', 'campfire'].includes(station) && !db.all<TerrainDef>('Terrain').some((t) => t.station?.id === station)) report.errors.push(`${r.id}: 작업장 '${station}' 없음`)
  }
  for (const t of db.all<TerrainDef>('Terrain')) {
    range(t.id, 'bedding.quality', t.bedding?.quality, 0.2, 1.2)
    range(t.id, 'bedding.insulation', t.bedding?.insulation, 0, 20)
    range(t.id, 'station.bonus', t.station?.bonus, -10, 10)
    if(t.cultivation){const r=t.cultivation;if(!t.gather)report.errors.push(t.id+': cultivation 실제 채집 작물 필요');for(const k of ['minLight','minTemp','maxTemp','waterMl','maxSalinity','rainMlPerHour']as const)if(!Number.isFinite(r[k]))report.errors.push(t.id+': cultivation.'+k+' 오류');range(t.id,'cultivation.minLight',r.minLight,0,1);range(t.id,'cultivation.waterMl',r.waterMl,1,100000,true);range(t.id,'cultivation.maxSalinity',r.maxSalinity,0,400);range(t.id,'cultivation.rainMlPerHour',r.rainMlPerHour,0,10000);if(t.gather&&!Number.isSafeInteger(r.waterMl*t.gather.regrowTurns))report.errors.push(t.id+': cultivation 관수 정수 범위 오류');if(r.minTemp>=r.maxTemp)report.errors.push(t.id+': cultivation 온도 범위 오류')}
    if(t.cultivation){const r=t.cultivation;if(r.maxLight!==undefined){range(t.id,'cultivation.maxLight',r.maxLight,r.minLight,1);if(!Number.isFinite(r.maxLight))report.errors.push(t.id+': cultivation.maxLight 오류')}if(r.needsSoil!==undefined&&typeof r.needsSoil!=='boolean')report.errors.push(t.id+': cultivation.needsSoil 오류');if(r.substrate!==undefined){const q=r.substrate;if(!q||typeof q!=='object'||Array.isArray(q))report.errors.push(t.id+': cultivation.substrate 오류');else{need(t.id,q.item,'Item');range(t.id,'substrate.cycles',q.cycles,1,100,true);range(t.id,'substrate.turns',q.turns,1,100,true);if(!Number.isSafeInteger(q.cycles)||!Number.isSafeInteger(q.turns))report.errors.push(t.id+': cultivation.substrate 정수 오류')}}}
    if(t.clearing){
      const q=t.clearing,target=typeof q.result==='string'?db.tryGet<TerrainDef>(q.result):undefined
      if(!t.gather||t.cultivation||t.container||t.device||t.water||!target||target.defType!=='Terrain'||target.id===t.id||target.gather||target.clearing||target.container||target.device||target.water||target.bedding||target.station||target.stairs||target.residentWell||target.residentDepot||!target.soil||!target.passable)report.errors.push(t.id+': clearing 실제 야생 채집 덤불과 별도 빈 땅 필요')
      if(!Array.isArray(q.tools)||!q.tools.length||new Set(q.tools).size!==q.tools.length||q.tools.some(id=>typeof id!=='string'||!db.tryGet<ItemDef>(id)?.attacks?.some(a=>a.damageType==='cut')))report.errors.push(t.id+': clearing.tools 실제 서로 다른 베는 도구 필요')
      for(const [key,min,max]of[['turns',1,1200],['edgeLoss',0,100],['noise',0,30]]as const)if(!Number.isFinite(q[key])||q[key]<min||q[key]>max||key!=='edgeLoss'&&!Number.isSafeInteger(q[key]))report.errors.push(t.id+': clearing.'+key+' 범위 오류')
    }
    if (t.gather) {
      need(t.id, t.gather.item, 'Item')
      range(t.id, 'gather.turns', t.gather.turns, 1, Infinity, true)
      range(t.id, 'gather.count', t.gather.count, 1, Infinity, true)
      range(t.id, 'gather.regrowTurns', t.gather.regrowTurns, 1, Infinity, true)
      if(t.gather.soilDependent!==undefined&&typeof t.gather.soilDependent!=='boolean')report.errors.push(`${t.id}: gather.soilDependent 오류`)
    }
  }
  for(const d of db.all<RetirementDef>('Retirement')){
    for(const key of ['dailyLivingCost','longLeaseDays','minHousingDays','youngAge','oldAge','youngYears','middleYears','oldYears','maxLegacy']as const)if(!Number.isSafeInteger(d[key])||d[key]<1||d[key]>(key==='dailyLivingCost'?1000000:key==='maxLegacy'?5:3650))report.errors.push(`${d.id}: ${key} 오류`)
    if(d.minHousingDays>d.longLeaseDays||d.youngAge>=d.oldAge||d.oldAge>120||d.youngYears<d.middleYears||d.middleYears<d.oldYears)report.errors.push(`${d.id}: 은퇴 기간/나이 구간 오류`)
    for(const key of ['friendly','legendRenown']as const)if(!Number.isFinite(d[key])||d[key]< -100||d[key]>100)report.errors.push(`${d.id}: ${key} 오류`)
    if(d.legendRenown<d.friendly||!Number.isFinite(d.disabilityFactor)||d.disabilityFactor<=0||d.disabilityFactor>1)report.errors.push(`${d.id}: disabilityFactor/legendRenown 오류`)
    need(d.id,d.resident,'Creature')
    if(!Array.isArray(d.disabilityParts)||!d.disabilityParts.length)report.errors.push(`${d.id}: disabilityParts 배열 필요`)
    else for(const part of d.disabilityParts)if(!db.tryGet<BodyDef>('Body.Humanoid')?.parts.some(p=>p.id===part))report.errors.push(`${d.id}: disabilityParts 신체 참조 오류`)
  }
  for(const d of db.all<EvidenceDef>('Evidence')){
    const source=factions.find(f=>f.key===d.sourceFaction),reform=factions.find(f=>f.key===d.reformFaction)
    if(!source||source.territorial||!reform||reform.territorial||source===reform||reform.unlock!==d.unlock||!d.unlock)report.errors.push(`${d.id}: 증거 공개 세력/unlock 참조 오류`)
    for(const [key,max]of [['turns',28800],['radius',8]]as const)if(!Number.isSafeInteger(d[key])||d[key]<1||d[key]>max)report.errors.push(`${d.id}: ${key} 오류`)
    if(!Number.isFinite(d.reformChance)||d.reformChance<0||d.reformChance>100||!Number.isFinite(d.loyalLoss)||d.loyalLoss>=0||d.loyalLoss< -100)report.errors.push(`${d.id}: reformChance/loyalLoss 오류`)
    for(const key of ['books','hold']as const){if(!Array.isArray(d[key])||!d[key].length){report.errors.push(`${d.id}: ${key} 배열 필요`);continue}for(const id of d[key]){need(d.id,id,'Item');if(key==='books'&&!db.tryGet<ItemDef>(id)?.book)report.errors.push(`${d.id}: books 책 참조 오류`)}if(new Set(d[key]).size!==d[key].length)report.errors.push(`${d.id}: ${key} 중복`)}
    if(!d.traitChance||typeof d.traitChance!=='object'||Array.isArray(d.traitChance))report.errors.push(`${d.id}: traitChance 사전 필요`)
    else for(const [id,chance]of Object.entries(d.traitChance)){need(d.id,id,'Trait');if(!Number.isFinite(chance)||chance< -100||chance>100)report.errors.push(`${d.id}: traitChance 수치 오류`)}
  }
  for(const d of db.all<FieldDeviceDef>('FieldDevice')){
    if(d.placement){const p=d.placement;need(d.id,p.region,'RegionSite');for(const id of [p.wall,p.floor,p.terrain])need(d.id,id,'Terrain');if(!p.mapId||!p.source||!p.waypoint||db.tryGet<TerrainDef>(p.terrain)?.device!==d.id||db.tryGet<TerrainDef>(p.wall)?.passable||!db.tryGet<TerrainDef>(p.floor)?.passable)report.errors.push(d.id+': placement 실제 벽/바닥/기구 주소 오류')}
    if(!Array.isArray(d.operations)||!d.operations.length){report.errors.push(`${d.id}: operations 필요`);continue}
    const ids=new Set(d.operations.map(o=>o.id)),tools=new Set(db.all<ItemDef>('Item').flatMap(i=>i.toolTags??[]))
    if(ids.size!==d.operations.length||ids.has(''))report.errors.push(`${d.id}: operation id 중복/빈 값`)
    for(const op of d.operations){
      if(!op.label||!Number.isSafeInteger(op.turns)||op.turns<1||op.turns>28800)report.errors.push(`${d.id}: operation.label/turns 오류`)
      if(!Array.isArray(op.requires)||op.requires.some(id=>!ids.has(id)||id===op.id))report.errors.push(`${d.id}: requires 참조 오류`)
      if(!Array.isArray(op.materials))report.errors.push(`${d.id}: materials 필요`)
      for(const row of op.materials??[]){need(d.id,row.item,'Item');range(d.id,'materials.count',row.count,1,100,true);if(!Number.isSafeInteger(row.count))report.errors.push(`${d.id}: materials.count 필요`)}
      if(op.tool&&!tools.has(op.tool))report.errors.push(`${d.id}: tool 태그 참조 오류`)
      range(d.id,'waterMl',op.waterMl,1,10000,true)
      for(const id of op.books??[]){need(d.id,id,'Item');if(!db.tryGet<ItemDef>(id)?.book)report.errors.push(`${d.id}: books는 책이어야 함`)}
      if(op.hold!==undefined&&!Array.isArray(op.hold))report.errors.push(`${d.id}: hold 배열 필요`)
      for(const id of Array.isArray(op.hold)?op.hold:[]){need(d.id,id,'Item');if(op.materials?.some(row=>row.item===id))report.errors.push(`${d.id}: hold는 소모 부품과 겹칠 수 없다`)}
      if(Array.isArray(op.hold)&&new Set(op.hold).size!==op.hold.length)report.errors.push(`${d.id}: hold 중복`)
      if(op.devices!==undefined&&!Array.isArray(op.devices))report.errors.push(`${d.id}: devices 배열 필요`)
      for(const row of Array.isArray(op.devices)?op.devices:[]){need(d.id,row.def,'FieldDevice');if(!db.tryGet<FieldDeviceDef>(row.def)?.operations.some(o=>o.id===row.operation)||!db.all<RegionLayoutDef>('RegionLayout').some(map=>map.mapId===row.map)||row.def===d.id&&row.operation===op.id)report.errors.push(`${d.id}: devices 선행 설비/지도/작업 참조 오류`)}
      if(op.outdoorsCalm!==undefined&&typeof op.outdoorsCalm!=='boolean')report.errors.push(`${d.id}: outdoorsCalm 오류`)
      for(const [key,value]of [['energyCost',op.energyCost],['energy',op.effect?.energy]]as const)if(value!==undefined&&(!Number.isSafeInteger(value)||value<1||value>10000))report.errors.push(`${d.id}: ${key} 오류`)
      if(op.effect?.sealSource){const e=op.effect.sealSource;need(d.id,e.region,'RegionSite');if(typeof e.source!=='string'||!e.source)report.errors.push(d.id+': sealSource.source 필요')}
      if(op.effect?.selfTerrain){need(d.id,op.effect.selfTerrain,'Terrain');if(db.tryGet<TerrainDef>(op.effect.selfTerrain)?.device!==d.id)report.errors.push(d.id+': selfTerrain 동일 기구 필요')}
      if(op.effect?.stopTower){need(d.id,op.effect.stopTower,'RegionSite');if(!db.tryGet<RegionSiteDef>(op.effect.stopTower)?.tower||!db.get<ClimateDef>('Climate.Hearth').towerStop)report.errors.push(`${d.id}: stopTower 정지 규정/탑 참조 오류`)}
      if(op.effect?.towerOutput){const e=op.effect.towerOutput;need(d.id,e.tower,'RegionSite');if(!db.tryGet<RegionSiteDef>(e.tower)?.tower)report.errors.push(`${d.id}: 연결한 탑에 tower 정의 필요`);range(d.id,'towerOutput.value',e.value,0,100);if(!Number.isFinite(e.value))report.errors.push(`${d.id}: towerOutput.value 필요`)}
      if(op.noise)for(const key of ['radius','intervalTurns']as const){const value=op.noise[key];if(!Number.isSafeInteger(value)||value<1||value>(key==='radius'?30:1200))report.errors.push(`${d.id}: noise.${key} 오류`)}
      if(op.crime){if(!db.all<FactionDef>('Faction').some(f=>f.key===op.crime!.faction&&!f.territorial))report.errors.push(`${d.id}: crime.faction 참조 오류`);if(!Number.isFinite(op.crime.delta)||op.crime.delta>=0||op.crime.delta< -100||!op.crime.reason)report.errors.push(`${d.id}: crime.delta/reason 오류`);if(op.crime.provoke!==undefined&&typeof op.crime.provoke!=='boolean')report.errors.push(`${d.id}: crime.provoke 오류`)}
      const positions=new Set<string>()
      if(op.effect?.tiles!==undefined&&!Array.isArray(op.effect.tiles))report.errors.push(`${d.id}: effect.tiles 배열 필요`)
      for(const tile of Array.isArray(op.effect?.tiles)?op.effect.tiles:[]){if(!Array.isArray(tile.pos)||tile.pos.length!==2||tile.pos.some(v=>!Number.isSafeInteger(v)||v<0||v>=128))report.errors.push(`${d.id}: effect.tiles.pos 오류`);const key=String(tile.pos);if(positions.has(key))report.errors.push(`${d.id}: effect.tiles.pos 중복`);positions.add(key);need(d.id,tile.from,'Terrain');need(d.id,tile.to,'Terrain');if(!tile.from||!tile.to||tile.from===tile.to)report.errors.push(`${d.id}: effect.tiles.from/to 오류`)}
      if(op.effect?.note&&(!op.effect.note.key||!op.effect.note.title||!op.effect.note.text))report.errors.push(`${d.id}: note.key/title/text 필요`)
    }
    const active=new Set<string>(),done=new Set<string>()
    const visit=(id:string):boolean=>{if(active.has(id))return false;if(done.has(id))return true;active.add(id);for(const ref of (Array.isArray(d.operations.find(o=>o.id===id)?.requires)?d.operations.find(o=>o.id===id)!.requires:[]))if(ids.has(ref)&&!visit(ref))return false;active.delete(id);done.add(id);return true}
    if(d.operations.some(op=>!visit(op.id)))report.errors.push(`${d.id}: requires 순환`)
  }
  const deviceEdges=new Map<string,readonly string[]>(db.all<FieldDeviceDef>('FieldDevice').flatMap(d=>(Array.isArray(d.operations)?d.operations:[]).map(op=>[`${d.id}#${op.id}`,[...(Array.isArray(op.requires)?op.requires:[]).map(id=>`${d.id}#${id}`),...(Array.isArray(op.devices)?op.devices:[]).map(row=>`${row.def}#${row.operation}`)]]as const))),deviceActive=new Set<string>(),deviceDone=new Set<string>()
  const deviceVisit=(key:string):boolean=>{if(deviceActive.has(key))return false;if(deviceDone.has(key))return true;deviceActive.add(key);for(const next of deviceEdges.get(key)??[])if(deviceEdges.has(next)&&!deviceVisit(next))return false;deviceActive.delete(key);deviceDone.add(key);return true}
  if([...deviceEdges.keys()].some(key=>!deviceVisit(key)))report.errors.push('FieldDevice: 설비 사이 선행 작업 순환')
  for(const t of db.all<TerrainDef>('Terrain')){if(t.device)need(t.id,t.device,'FieldDevice');if(t.lootCrime){const c=t.lootCrime;if(!db.all<FactionDef>('Faction').some(f=>f.key===c.faction&&!f.territorial)||!Number.isFinite(c.delta)||c.delta>=0||c.delta< -100||!c.reason||c.provoke!==undefined&&typeof c.provoke!=='boolean')report.errors.push(`${t.id}: lootCrime 세력/수치 오류`)}if(t.sealed!==undefined&&typeof t.sealed!=='boolean'||t.sealed&&t.door!=='closed')report.errors.push(`${t.id}: sealed는 닫힌 문에만 쓸 수 있다`)}
  for(const d of db.all<KinshipDef>('Kinship')){
    if(!db.all<FactionDef>('Faction').some(f=>f.key===d.faction))report.errors.push(`${d.id}: faction 참조 오류`)
    for(const key of ['underground','chiefs','sites']as const){if(!Array.isArray(d[key])||!d[key].length){report.errors.push(`${d.id}: ${key} 필요`);continue}for(const id of d[key])need(d.id,id,key==='sites'?'RegionSite':'Creature')}
    if(d.chiefs?.some(id=>!d.underground?.includes(id)))report.errors.push(`${d.id}: chiefs는 underground의 일부여야 함`)
    for(const[key,min,max]of[['delayDays',1,90],['killLoss',-100,-1],['chiefLoss',-100,-1],['peaceReward',1,20],['torchLoss',-100,-1],['trust',0,100],['avoidRadius',1,12]]as const){if(!Number.isFinite(d[key]))report.errors.push(`${d.id}: ${key} 필요`);else range(d.id,key,d[key],min,max,true)}
  }
  for(const site of db.all<RegionSiteDef>('RegionSite')){if(site.layout)need(site.id,site.layout,'RegionLayout');if(site.extension){need(site.id,site.extension.biome,'Biome');range(site.id,'extension.generation',site.extension.generation,1,10000,true);for(const key of ['coast','footAccess']as const)if(site.extension[key]!==undefined&&typeof site.extension[key]!=='boolean')report.errors.push(`${site.id}: extension.${key}는 boolean이어야 함`);if(!site.extension.biome)report.errors.push(`${site.id}: extension.biome 필요`);if(site.extension.near){const n=site.extension.near;need(site.id,n.site,'RegionSite');if(n.site===site.id||!Number.isSafeInteger(n.maxCells)||n.maxCells<1||n.maxCells>128)report.errors.push(`${site.id}: extension.near 범위 오류`);const target=db.tryGet<RegionSiteDef>(n.site);if(target?.extension&&(target.extension.generation??0)>=(site.extension.generation??0))report.errors.push(`${site.id}: extension.near는 먼저 생긴 지역이어야 함`)};if(site.extension.population!==undefined)range(site.id,'extension.population',site.extension.population,1,10000,true);if(site.extension.altitude){const a=site.extension.altitude;if(!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||a[0]<0||a[0]>a[1])report.errors.push(`${site.id}: extension.altitude 범위 오류`)}}}
  for(const terrain of db.all<TerrainDef>('Terrain')){
    if(terrain.beacon){const d=terrain.beacon;if(!isObj(d))report.errors.push(`${terrain.id}: beacon 구조 오류`);else{
      need(terrain.id,d.fuel,'Item');const material=db.tryGet<ItemDef>(d.fuel)?.rawMaterial?.material;if(!material||!(db.tryGet<MaterialDef>(material)?.flammability??0))report.errors.push(`${terrain.id}: beacon.fuel은 실제 가연성 원료여야 함`);if(!d.network||typeof d.network!=='string')report.errors.push(`${terrain.id}: beacon.network 필요`)
      for(const key of ['literacyMin','fuelTurns','maxFuelTurns','igniteTurns','sendTurns','turnsPerCell','speed','rangeCells','height','radius']as const){if(!Number.isFinite(d[key]))report.errors.push(`${terrain.id}: beacon.${key} 필요`);else range(terrain.id,`beacon.${key}`,d[key],1,key==='literacyMin'?3:key==='radius'?20:key==='rangeCells'?128:key==='speed'?10:100000,true)}
      if(d.fuelTurns>d.maxFuelTurns)report.errors.push(`${terrain.id}: beacon 연료 한도 오류`)
      if(terrain.passable||terrain.water||terrain.container||terrain.device)report.errors.push(`${terrain.id}: beacon은 별도 고정 구조물이어야 함`)
    }}
    if(terrain.visual){if(!terrain.visual.sprite||!Number.isFinite(terrain.visual.scale)||terrain.visual.scale<=0||terrain.visual.scale>4)report.errors.push(`${terrain.id}: visual sprite/scale 오류`);range(terrain.id,'visual.tint',terrain.visual.tint,0,0xffffff,true)}if(terrain.keyItem){need(terrain.id,terrain.keyItem,'Item');if(terrain.door!=='closed')report.errors.push(`${terrain.id}: keyItem은 닫힌 문에만 적용`)}if(terrain.openAs)need(terrain.id,terrain.openAs,'Terrain');if(terrain.closeAs)need(terrain.id,terrain.closeAs,'Terrain')}
  for(const d of db.all<RegionLayoutDef>('RegionLayout')){
    range(d.id,'width',d.width,4,128,true);range(d.id,'height',d.height,4,128,true);range(d.id,'ambient',d.ambient,0,1);range(d.id,'daylightMult',d.daylightMult,0,1);range(d.id,'depth',d.depth,0,100,true);need(d.id,d.fill,'Terrain')
    const pos=(p:readonly number[],name:string)=>{if(!Array.isArray(p)||p.length!==2||!Number.isInteger(p[0])||!Number.isInteger(p[1])||p[0]<0||p[1]<0||p[0]>=d.width||p[1]>=d.height)report.errors.push(`${d.id}: ${name} 지도 좌표 오류`)}
    const rect=(r:{x:number;y:number;w:number;h:number},name:string)=>{pos([r.x,r.y],name);if(!Number.isInteger(r.w)||!Number.isInteger(r.h)||r.w<1||r.h<1||r.x+r.w>d.width||r.y+r.h>d.height)report.errors.push(`${d.id}: ${name} 직사각형 오류`)}
    if(d.residentRest!==undefined&&typeof d.residentRest!=='boolean')report.errors.push(`${d.id}: residentRest 오류`)
    const legacyKeys=new Set<string>();for(const row of d.legacyObjects??[]){pos(row.pos,'legacy');need(d.id,row.terrain,'Terrain');if(!row.key||legacyKeys.has(row.key))report.errors.push(`${d.id}: legacy.key 중복/누락`);legacyKeys.add(row.key);if(!row.from?.length)report.errors.push(`${d.id}: legacy.from 필요`);for(const id of row.from??[])need(d.id,id,'Terrain')}
    for(const light of d.lights??[]){pos(light.pos,'light');range(d.id,'light.radius',light.radius,1,24,true);if(!light.kind)report.errors.push(`${d.id}: light.kind 필요`)}
    if(d.fog){for(const key of ['sightMult','opacity','color']as const)if(!Number.isFinite(d.fog[key]))report.errors.push(`${d.id}: fog.${key} 필요`);range(d.id,'fog.sightMult',d.fog.sightMult,Number.MIN_VALUE,1);range(d.id,'fog.opacity',d.fog.opacity,0,1);range(d.id,'fog.color',d.fog.color,0,0xffffff,true)}
    if(d.dock)pos(d.dock,'dock');pos(d.start,'start');for(const p of d.exits??[])pos(p,'exit')
    for(const row of d.scatter??[]){need(d.id,row.terrain,'Terrain');range(d.id,'scatter.chance',row.chance,0,1)}
    for(const row of d.clear??[]){rect(row,'clear');need(d.id,row.terrain,'Terrain')}
    for(const b of d.buildings??[]){rect(b,'building');pos(b.door,'door');for(const id of [b.wall,b.floor,b.doorTerrain])need(d.id,id,'Terrain')}
    for(const row of d.objects??[]){pos(row.pos,'object');need(d.id,row.terrain,'Terrain');for(const item of row.items??[]){need(d.id,item.item,'Item');range(d.id,'object.count',item.count,1,99,true)}}
    for(const row of d.spawns??[]){if(row.settlementResident!==undefined&&typeof row.settlementResident!=='boolean')report.errors.push(`${d.id}: settlementResident 오류`);need(d.id,row.creature,'Creature');pos(row.pos,'spawn');pos(row.home,'home')}
    for(const row of d.links??[]){pos(row.pos,'link');const targets=db.all<RegionLayoutDef>('RegionLayout').filter(t=>t.mapId===row.to);if(!row.to||!targets.length&&!['surface','crypt1','crypt2','crypt3'].includes(row.to))report.errors.push(`${d.id}: link.to 참조 오류`);if(!Array.isArray(row.at)||row.at.length!==2||row.at.some(n=>!Number.isSafeInteger(n)||n<0)||targets.length&&!targets.some(t=>row.at[0]<t.width&&row.at[1]<t.height))report.errors.push(`${d.id}: link.at 도착 좌표 오류`)}
    const subIds=new Set<string>();for(const row of d.submaps??[]){need(d.id,row.layout,'RegionLayout');if(!row.mapId||subIds.has(row.mapId)||db.tryGet<RegionLayoutDef>(row.layout)?.mapId!==row.mapId)report.errors.push(`${d.id}: submap.mapId 참조/중복 오류`);subIds.add(row.mapId)}
  }
  for (const b of db.all<BodyDef>('Body')) {
    if(b.waterBreathing!==undefined&&typeof b.waterBreathing!=='boolean')report.errors.push(`${b.id}: waterBreathing은 boolean이어야 함`)
    const ids = new Set(b.parts.map((p) => p.id))
    if(b.kind==='mechanical'){
      const d=b.mechanical
      if(!d)report.errors.push(`${b.id}: mechanical 규칙이 필요함`)
      else{
        if(b.bloodMl!==0)report.errors.push(`${b.id}: 기계형 bloodMl은 0이어야 함`)
        for(const key of ['core','powerCell','coolingLoop','chassis','toolHead']as const)if(!ids.has(d[key]))report.errors.push(`${b.id}: mechanical.${key} 부위가 없음`)
        for(const key of ['coolantMl','leakPerSeverity','cooling','ambientDivisor','protectiveHeat','shutdownHeat','coreDamage','moveHeat','attackHeat','weldHeat','actionPower','idlePower','retreatPower']as const){if(!Number.isFinite(d[key])||d[key]<=0)report.errors.push(`${b.id}: mechanical.${key}는 양수여야 함`)}
        for(const key of ['shortChance','shutdownChance']as const){if(!Number.isFinite(d[key]))report.errors.push(`${b.id}: mechanical.${key} 필요`);else range(b.id,`mechanical.${key}`,d[key],0,1)}
        if(!Number.isFinite(d.ambientThreshold))report.errors.push(`${b.id}: mechanical.ambientThreshold 오류`)
        if(d.protectiveHeat>=d.shutdownHeat||d.shutdownHeat>100)report.errors.push(`${b.id}: mechanical 과열 임계 순서 오류`)
        if(!Array.isArray(d.shutdownTurns)||d.shutdownTurns.length!==2||d.shutdownTurns.some(n=>!Number.isInteger(n)||n<1)||d.shutdownTurns[1]<d.shutdownTurns[0])report.errors.push(`${b.id}: mechanical.shutdownTurns 오류`)
        for(const key of ['patch','coolant','repair','cell']as const){need(b.id,d[key]?.item,'Item');if(!d[key]?.item)report.errors.push(`${b.id}: mechanical.${key}.item 필요`);if(!Number.isInteger(d[key]?.turns)||d[key].turns<1)report.errors.push(`${b.id}: mechanical.${key}.turns 오류`)}
        for(const[key,n]of[['coolant.ml',d.coolant?.ml],['repair.severity',d.repair?.severity],['cell.power',d.cell?.power]]as const)if(!Number.isFinite(n)||n<=0)report.errors.push(`${b.id}: mechanical.${key}는 양수여야 함`)
        if(!d.repair?.tool)report.errors.push(`${b.id}: mechanical.repair.tool 필요`)
        if(!d.errorLoop)report.errors.push(`${b.id}: mechanical.errorLoop 필요`)
        else{for(const key of ['damage','chance']as const){if(!Number.isFinite(d.errorLoop[key]))report.errors.push(`${b.id}: errorLoop.${key} 필요`);else range(b.id,`errorLoop.${key}`,d.errorLoop[key],0,1)}for(const key of ['checkTurns','turns']as const)if(!Number.isInteger(d.errorLoop[key])||d.errorLoop[key]<1)report.errors.push(`${b.id}: errorLoop.${key} 오류`)}
        if(!Array.isArray(d.salvage))report.errors.push(`${b.id}: mechanical.salvage 필요`)
        else for(const row of d.salvage){need(b.id,row.item,'Item');if(!row.item)report.errors.push(`${b.id}: salvage.item 필요`);if(!Number.isFinite(row.count)||!Number.isFinite(row.chance))report.errors.push(`${b.id}: salvage.count/chance 필요`);range(b.id,'salvage.count',row.count,1,5,true);range(b.id,'salvage.chance',row.chance,0,1)}
      }
    }
    for (const p of b.parts) if (p.parent && !ids.has(p.parent)) report.errors.push(`${b.id}: 부위 '${p.id}' 의 부모 '${p.parent}' 없음`)
    for (const p of b.parts) if (p.stumpParent && (!ids.has(p.stumpParent) || p.stumpParent === p.id)) report.errors.push(`${b.id}: 부위 '${p.id}' 의 절단면 '${p.stumpParent}' 오류`)
    // 외부 부위 커버리지(‰) 합은 1000 (07 §2.3), 내부 부위는 부모가 있어야 한다
    const ext = b.parts.filter((p) => !p.internal).reduce((n, p) => n + (p.coverage ?? 0), 0)
    if (ext !== 1000) report.errors.push(`${b.id}: 외부 커버리지 합 ${ext} ≠ 1000`)
    for (const p of b.parts) if (p.internal && !p.parent) report.errors.push(`${b.id}: 내부 부위 '${p.id}' 에 부모가 없음`)
  }
}
