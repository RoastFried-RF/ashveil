// 클라이언트 상태: 코어 World를 감싸고, 행동마다 version을 올려 화면을 갱신한다.
// 코어 상태는 깊고 크므로 Vue 반응성 대신 shallowRef + version 카운터를 쓴다.

import { ref, shallowRef } from 'vue'
import {gameObservation} from './game-observation'
import {
  GAME_VERSION, DEF_SCHEMA_VERSION, contentChangeReview, sha256, initializeScriptState, deserialize, enableOverworld, initializeFieldDevices, initializeClimate, initializeSettlement, initializeWorldSimulation, updatePlayerVision, player, loadMods, newGame, playerAct, runUntilInput, serialize,
  type Action, type DefDatabase, type DeathReport, type LoadReport, type World,
} from '../core'

import {applyContentTransition} from '../core/content-transition'
import { imprintStorage } from './imprint'
import {encodeSeedShare,makeSeedShare,reviewSeedShare} from '../core/seed-share'

export const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
export const saveError = ref('')
let saveGeneration = 0
const CHRONICLE_KEY = 'ashveil.chronicle.v1'

import {packages,modInstallation} from './mod-catalog'
export {packages} from './mod-catalog'

export const world = shallowRef<World | null>(null)
export const version = ref(0)
export const simulating = ref(false)
export const starting=ref(false)
let startGeneration=0
export const loadReport = shallowRef<LoadReport | null>(null)
export const screen = ref<'title' | 'game'>('title')
export const pendingContentReview=shallowRef<(ReturnType<typeof contentChangeReview>&{token:string;selectedMods:string[]})|null>(null)
export function cancelContentReview(){pendingContentReview.value=null;startGeneration++}

type LiveContentReview=ReturnType<typeof contentChangeReview>&{token:string;selectedMods:string[]}
export const pendingLiveContentReview=shallowRef<LiveContentReview|null>(null)
export const contentReloading=ref(false)
let liveReview:{source:World;sourceDb:DefDatabase;raw:string;hash:string;mods:string[];token:string}|null=null
export function cancelLiveContentReview(){pendingLiveContentReview.value=null;liveReview=null}
function liveReloadError(){const w=world.value;return!w||screen.value!=='game'?'현재 플레이 중인 세계가 필요하다':w.s.over?'끝난 생애의 콘텐츠는 다시 적용할 수 없다':simulating.value||w.s.simulationPending||starting.value||contentAdopting.value?'진행 중인 계산/시작/저장을 마친 뒤 검토해야 한다':!w.s.loadHash?'먼저 현재 구성으로 기록을 시작해야 한다':null}
export function reviewLiveContent(mods:readonly string[]):string|null{
 if(contentReloading.value)return '진행 중인 콘텐츠 적용을 마친 뒤 검토해야 한다'
 cancelLiveContentReview();const error=liveReloadError();if(error)return error
 try{
  const source=world.value!,db=buildDb([...mods]),raw=serialize(source.s),review=contentChangeReview(source.s,db),token=sha256('live-content\n'+raw+'\n'+db.loadHash),selectedMods=db.loadedMods.filter(id=>id!=='core')
  liveReview={source,sourceDb:source.db,raw,hash:db.loadHash,mods:[...selectedMods],token};pendingLiveContentReview.value={...review,token,selectedMods,canContinue:review.canContinue||review.status==='same'&&review.recoveryErrors.length===0};return null
 }catch(error){return '현재 콘텐츠를 검토하지 못했다: '+(error as Error).message}
}
export async function applyLiveContent(token:string):Promise<string|null>{
 if(contentReloading.value)return '다른 콘텐츠 적용을 마쳐야 한다'
 const pending=liveReview,error=liveReloadError();if(error)return error
 if(!pending||pending.token!==token||world.value!==pending.source||pending.source.db!==pending.sourceDb)return '현재 검토 중인 플레이 세계가 아니다. 다시 검토해야 한다'
 if(serialize(pending.source.s)!==pending.raw){cancelLiveContentReview();return '검토 뒤 실제 세계가 바뀌었다. 다시 검토해야 한다'}
 contentReloading.value=true
 try{
  const db=await buildGameDb(pending.mods)
  const changedReadiness=liveReloadError();if(changedReadiness)return changedReadiness
  if(liveReview!==pending||world.value!==pending.source||pending.source.db!==pending.sourceDb||serialize(pending.source.s)!==pending.raw||db.loadHash!==pending.hash||buildDb(pending.mods).loadHash!==pending.hash){cancelLiveContentReview();return '검토 뒤 실제 세계 또는 콘텐츠가 바뀌었다. 다시 검토해야 한다'}
  const fresh=contentChangeReview(pending.source.s,db)
  if(fresh.status==='same'&&!fresh.recoveryErrors.length){cancelLiveContentReview();return null}
  if(!fresh.canContinue)return '현재 콘텐츠를 적용할 수 없다: '+[...fresh.recoveryErrors,...fresh.blocked.map(row=>row.id)].join('\n')
  const s=deserialize(pending.raw),candidate:World={db,s},transitionError=applyContentTransition(candidate);if(transitionError)return transitionError
  initializeScriptState(candidate);updatePlayerVision(candidate,player(candidate))
  // 비동기 저장 전까지 현재 세계에는 새 정의/후보의 어떤 부분도 노출하지 않는다.
  const list=chronicle();list.unshift({at:new Date().toISOString(),seed:s.seed,kind:'content',turn:Math.floor(s.time/100),from:pending.source.s.loadHash!,to:db.loadHash});safeSet(CHRONICLE_KEY,JSON.stringify(list.slice(0,50)))
  cancelLiveContentReview();cancelContentReview();cancelContentAdoption();world.value=candidate;version.value++
  await saveImprint();return saveStatus.value==='error'?'현재 콘텐츠는 적용했지만 각인을 저장하지 못했다: '+saveError.value:null
 }catch(error){return '현재 콘텐츠를 적용하지 못했다: '+(error as Error).message}finally{contentReloading.value=false}
}

export const pendingContentAdoption=shallowRef<{token:string;turn:number;hash:string;mods:{id:string;version:string;hash:string}[]}|null>(null)
export const contentAdopting=ref(false)
let adoptionWorld:World|null=null
export function cancelContentAdoption(){pendingContentAdoption.value=null;adoptionWorld=null}
export function reviewCurrentContent():string|null{
 const w=world.value;if(!w||screen.value!=='game')return '먼저 각인을 불러와야 한다'
 if(w.s.loadHash!==undefined)return '이미 구성 기록이 있는 각인이다. 구성 변경 검토를 이용해야 한다'
 if(w.s.simulationPending||simulating.value||contentAdopting.value)return '진행 중인 계산이나 저장을 마친 뒤 현재 구성을 확인해야 한다'
 const mods=w.db.modManifest();if(!mods)return '실제 패키지 기록이 없어 현재 구성을 확인할 수 없다'
 pendingContentAdoption.value={token:sha256('record-current\n'+serialize(w.s)+'\n'+w.db.loadHash),turn:Math.floor(w.s.time/100),hash:w.db.loadHash,mods};adoptionWorld=w;return null
}
/** 과거 구성을 추정하지 않고, 확인한 실제 현재 구성을 처음 기록한다. */
export async function adoptCurrentContent(token:string):Promise<string|null>{
 const pending=pendingContentAdoption.value,w=world.value
 if(!pending||pending.token!==token||!w||w!==adoptionWorld||screen.value!=='game')return '현재 검토 중인 구성 기록 시작이 아니다. 다시 확인해야 한다'
 if(w.s.loadHash!==undefined)return '이미 구성 기록이 있어 다시 시작할 수 없다'
 if(w.s.simulationPending||simulating.value||contentAdopting.value)return '진행 중인 계산이나 저장을 마친 뒤 다시 확인해야 한다'
 if(token!==sha256('record-current\n'+serialize(w.s)+'\n'+w.db.loadHash)){reviewCurrentContent();return '검토 뒤 세계 또는 콘텐츠가 바뀌었다. 현재 구성을 다시 확인해야 한다'}
 const mods=w.db.modManifest();if(!mods)return '실제 패키지 기록을 확인할 수 없다'
 contentAdopting.value=true
 try{
  Object.assign(w.s,{loadHash:w.db.loadHash,gameVersion:GAME_VERSION,defSchemaVersion:DEF_SCHEMA_VERSION,contentMods:mods,contentDefinitions:w.db.definitionManifest(),contentItemShapes:w.db.itemShapeManifest(),mods:[...w.db.loadedMods],contentAdoptedAt:{turn:Math.floor(w.s.time/100),hash:w.db.loadHash},achievementsDisabled:true})
  const list=chronicle();list.unshift({at:new Date().toISOString(),seed:w.s.seed,kind:'content',turn:Math.floor(w.s.time/100),from:'이전 구성 기록 없음',to:w.db.loadHash});safeSet(CHRONICLE_KEY,JSON.stringify(list.slice(0,50)))
  cancelContentAdoption();version.value++;await saveImprint();return saveStatus.value==='error'?'현재 구성은 기록했지만 각인을 저장하지 못했다: '+saveError.value:null
 }finally{contentAdopting.value=false}
}

export type ChronicleEntry = { at: string; seed: string; report: DeathReport; kind: 'death' | 'escape' | 'retire';retirement?:import('../core').RetirementRecord }|{at:string;seed:string;kind:'content';turn:number;from:string;to:string}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* 저장 불가 환경 */ }
}

export function inspectDb(mods: string[]) {
  const result = loadMods(packages, mods)
  loadReport.value = result.report
  return result
}

export function buildDb(mods: string[]): DefDatabase {
  const {db,report}=inspectDb(mods)
  if(report.errors.length)throw new Error('모드 구성을 불러올 수 없다:\n'+report.errors.join('\n'))
  return db
}

async function buildGameDb(mods:string[]){
 if(typeof indexedDB!=='undefined')await modInstallation.initialize()
 const db=buildDb(mods)
 if(db.scriptSources.length){const{attachQuickJSScripts}=await import('../scripting/attach');await attachQuickJSScripts(db)}
 return db
}

export async function hasImprint(): Promise<boolean> {
  try { return !!await imprintStorage.read() } catch (e) { saveStatus.value = 'error'; saveError.value = (e as Error).message; return false }
}

export async function startNew(seed: string, background: string | undefined, mods: string[], characterRoll: 0 | 1 = 0,storyteller?:string) {
 const ticket=++startGeneration;starting.value=true
 try{
  const db=await buildGameDb(mods);if(ticket!==startGeneration)return
  const legacyResidents=chronicle().flatMap(entry=>entry.seed===seed&&entry.kind==='retire'&&entry.retirement?.legacy?[entry.retirement.legacy]:[])
  const s=newGame(db,{seed,background,mods:db.loadedMods,characterRoll,storyteller,overworld:true,legacyResidents}),w={db,s}
  runUntilInput(w);pendingContentReview.value=null;cancelContentAdoption();world.value=w;version.value++;screen.value='game';void saveImprint()
 }finally{if(ticket===startGeneration)starting.value=false}
}

/** 공유 문자열에는 생성 당시 선택과 실제로 허용된 정보 전용 은퇴 인물만 넣는다. */
export function createSeedCode(seed:string,background:string|undefined,mods:string[],characterRoll:0|1,storyteller?:string):string{
 const db=buildDb(mods),legacyResidents=chronicle().flatMap(entry=>entry.seed===seed&&entry.kind==='retire'&&entry.retirement?.legacy?[entry.retirement.legacy]:[])
 const preview=newGame(db,{scriptPreview:true,seed,background,characterRoll,storyteller,overworld:true,legacyResidents})
 return encodeSeedShare(makeSeedShare(db,{seed,background,characterRoll,storyteller,legacyResidents:preview.overworld?.legacyResidents??[]}))
}
export async function startSharedSeed(code:string){
 const ticket=++startGeneration;starting.value=true
 try{
  if(typeof indexedDB!=='undefined')await modInstallation.initialize()
  if(ticket!==startGeneration)return
  const review=reviewSeedShare(code,packages);if(review.errors.length)throw Error('공유한 세계를 시작할 수 없다:\n'+review.errors.join('\n'))
  const shared=review.shared,db=await buildGameDb(shared.mods.map(mod=>mod.id));if(ticket!==startGeneration)return
  if(db.loadHash!==shared.loadHash)throw Error('공유 검토 뒤 콘텐츠가 바뀌었다. 다시 확인해야 한다')
  const s=newGame(db,{seed:shared.seed,background:shared.background,mods:db.loadedMods,characterRoll:shared.characterRoll,storyteller:shared.storyteller,overworld:true,legacyResidents:shared.legacyResidents}),w={db,s}
  runUntilInput(w);pendingContentReview.value=null;cancelContentAdoption();world.value=w;version.value++;screen.value='game';void saveImprint()
 }finally{if(ticket===startGeneration)starting.value=false}
}

/** 기존 각인의 실제 목록을 조회한다. 현재 세계/저장을 바꾸지 않는다. */
export async function imprintMods():Promise<string[]>{
 const raw=await imprintStorage.read();if(!raw)return[]
 const s=deserialize(raw);if(!Array.isArray(s.mods)||s.mods.some(id=>typeof id!=='string'))throw Error('각인의 모드 목록 형식이 올바르지 않다')
 return s.mods.filter(id=>id!=='core')
}
/** 다른 모드 선택은 반드시 먼저 검토한다. 같은 구성도 검토만으로 진입하지 않는다. */
export const reviewImprintMods=(mods:readonly string[])=>continueImprint(undefined,mods,true)
export async function continueImprint(acceptedToken?:string,requestedMods?:readonly string[],reviewOnly=false): Promise<string | null> {
  if(acceptedToken&&acceptedToken!==pendingContentReview.value?.token)return '현재 검토 중인 콘텐츠 변경이 아니다. 다시 확인해야 한다.'
  const selected=requestedMods===undefined?(acceptedToken?[...pendingContentReview.value!.selectedMods]:undefined):[...requestedMods]
  if(selected?.some(id=>typeof id!=='string'))return '선택한 모드 목록 형식이 올바르지 않다'
  const ticket=++startGeneration;starting.value=false
  try {
    const raw = await imprintStorage.read()
    if(ticket!==startGeneration)return '다른 요청으로 각인 불러오기를 취소했다'
    if (!raw) return '각인이 없다'
    if(typeof indexedDB!=='undefined')await modInstallation.initialize()
    if(ticket!==startGeneration)return '다른 요청으로 각인 불러오기를 취소했다'
    // 세계 도입 전(v3 이하)의 각인만 확장한다. 현재 코어의 명시적인 던전 각인은 그대로 잇는다.
    const legacyDungeon = (JSON.parse(raw) as {version:number}).version <= 3
    const s = deserialize(raw)
    const db = buildDb((selected??s.mods).filter((m) => m !== 'core'))
    const compatibility=contentChangeReview(s,db),token=sha256(raw+'\n'+db.loadHash),review={...compatibility,token,selectedMods:[...db.loadedMods].filter(id=>id!=='core'),canContinue:compatibility.canContinue||compatibility.status==='same'&&compatibility.recoveryErrors.length===0}
    if(acceptedToken&&acceptedToken!==token){pendingContentReview.value=review;return '검토한 뒤 각인 또는 콘텐츠가 바뀌었다. 다시 확인해야 한다.'}
    const changed=compatibility.status==='changed'
    if(reviewOnly||(changed||acceptedToken!==undefined)&&(!acceptedToken||!review.canContinue)){
      pendingContentReview.value=review
      return compatibility.status==='same'?'선택한 모드는 각인의 현재 구성과 같다. 아래 검토 후 계속할 수 있다.':'각인에 기록된 콘텐츠 구성과 현재 구성이 다르다. 아래 차이를 확인해야 한다.'
    }
    if(compatibility.recoveryErrors.length)return '각인을 복구할 수 없다: '+compatibility.recoveryErrors.join('\n')
    const transitionError=applyContentTransition({s,db});if(transitionError)return transitionError
    if(db.scriptSources.length){const{attachQuickJSScripts}=await import('../scripting/attach');await attachQuickJSScripts(db)}
    if(ticket!==startGeneration)return '다른 요청으로 각인 불러오기를 취소했다'
    const candidate:World = { db, s }
    initializeScriptState(candidate)
    if(legacyDungeon)enableOverworld(candidate)
    initializeClimate(candidate)
    initializeWorldSimulation(candidate)
    initializeSettlement(candidate)
    initializeFieldDevices(candidate)
    updatePlayerVision(candidate, player(candidate))
    if(changed){const list=chronicle();list.unshift({at:new Date().toISOString(),seed:s.seed,kind:'content',turn:Math.floor(s.time/100),from:compatibility.recorded!,to:db.loadHash});safeSet(CHRONICLE_KEY,JSON.stringify(list.slice(0,50)))}
    pendingContentReview.value=null
    cancelContentAdoption()
    world.value = candidate
    version.value++
    screen.value = 'game'
    if (s.simulationPending) resumeSimulation(world.value)
    if(changed)void saveImprint()
    return null
  } catch (e) {
    return `각인을 읽지 못했다: ${(e as Error).message}`
  }
}

export async function saveImprint() {
  const w = world.value
  if (!w) return
  const ticket = ++saveGeneration
  saveStatus.value = 'saving'
  saveError.value = ''
  try {
    await imprintStorage.write(w.s.over ? null : serialize(w.s))
    if (ticket === saveGeneration) saveStatus.value = 'saved'
  } catch (e) {
    if (ticket === saveGeneration) {
      saveStatus.value = 'error'
      saveError.value = `각인을 저장하지 못했다: ${(e as Error).message}`
    }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
let simulationTimer: ReturnType<typeof setTimeout> | undefined

function finishAction(w: World) {
  simulating.value = false
  if (w.s.over) { clearTimeout(saveTimer); recordChronicle(w); void saveImprint() }
  else { clearTimeout(saveTimer); saveTimer = setTimeout(saveImprint, 300) }
}

function resumeSimulation(w: World) {
  clearTimeout(simulationTimer)
  simulating.value = true
  simulationTimer = setTimeout(() => {
    if (world.value !== w || screen.value !== 'game') { simulating.value = false; return }
    runUntilInput(w, 200)
    version.value++
    if (w.s.simulationPending) resumeSimulation(w)
    else finishAction(w)
  }, 0)
}

export function act(a: Action, immediate = false): string | null {
  const w = world.value
  if (!w || w.s.over) return null
  if (w.s.simulationPending && a.type !== 'stopActivity') return '시간이 흐르는 중이다'
  if (a.type === 'stopActivity') clearTimeout(simulationTimer)
  const err = playerAct(w, a, immediate ? undefined : 200)
  version.value++
  if (w.s.simulationPending) resumeSimulation(w)
  else finishAction(w)
  return err
}

function recordChronicle(w: World) {
  if (!w.s.over) return
  const list = chronicle()
  list.unshift({ at: new Date().toISOString(), seed: w.s.seed, report: w.s.over.report, kind: w.s.over.kind,...(w.s.over.retirement?{retirement:w.s.over.retirement}:{}) })
  safeSet(CHRONICLE_KEY, JSON.stringify(list.slice(0, 50)))
}

export function chronicle(): ChronicleEntry[] {
  try { return JSON.parse(safeGet(CHRONICLE_KEY) ?? '[]') as ChronicleEntry[] } catch { return [] }
}

export async function abandonToTitle() {
  cancelContentAdoption()
  clearTimeout(saveTimer)
  await saveImprint()
  if (saveStatus.value === 'error') return
  screen.value = 'title'
  clearTimeout(simulationTimer)
  simulating.value = false
}

export function randomSeed(): string {
  const words = ['재', '장막', '고원', '회색', '침묵', '정원', '폐허', '늑대', '비', '겨울', '등불', '길']
  const a = words[Math.floor(Math.random() * words.length)]
  const b = words[Math.floor(Math.random() * words.length)]
  return `${a}-${b}-${Math.floor(Math.random() * 9000 + 1000)}`
}

// 디버그/E2E 훅: ?debug 일 때만 노출
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
  ;(window as unknown as Record<string, unknown>).render_game_to_text = () => JSON.stringify(gameObservation(world.value,screen.value))
  void import('../core/bot').then(({ botDecide }) => {
    ;(window as unknown as Record<string, unknown>).__ashveil = {
      world: () => world.value,
      // 실제 검사 장면을 다시 그린다. 시각·행동·난수·각인 내용은 바꾸지 않는다.
      refresh: () => { version.value++ },
      botSteps(n: number) {
        for (let i = 0; i < n; i++) {
          const w = world.value
          if (!w || w.s.over) break
          const err = act(botDecide(w), true)
          if (err) act({ type: 'wait' }, true)
        }
        return world.value?.s.over ? 'over' : 'running'
      },
    }
  })
}
