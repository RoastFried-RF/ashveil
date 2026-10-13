// 클라이언트 상태: 코어 World를 감싸고, 행동마다 version을 올려 화면을 갱신한다.
// 코어 상태는 깊고 크므로 Vue 반응성 대신 shallowRef + version 카운터를 쓴다.

import { ref, shallowRef } from 'vue'
import {
  deserialize, loadMods, newGame, packagesFromFiles, playerAct, runUntilInput, serialize,
  type Action, type DefDatabase, type DeathReport, type LoadReport, type ModPackage, type World,
} from '../core'

const IMPRINT_KEY = 'ashveil.imprint.v1'
const CHRONICLE_KEY = 'ashveil.chronicle.v1'

const coreFiles = import.meta.glob('../content/**/*.json', { eager: true, import: 'default' })
const modFiles = import.meta.glob('../../mods/**/*.json', { eager: true, import: 'default' })

export const packages: ModPackage[] = packagesFromFiles({ ...coreFiles, ...modFiles })

export const world = shallowRef<World | null>(null)
export const version = ref(0)
export const loadReport = shallowRef<LoadReport | null>(null)
export const screen = ref<'title' | 'game'>('title')

export interface ChronicleEntry { at: string; seed: string; report: DeathReport; kind: 'death' | 'escape' }

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* 저장 불가 환경 */ }
}
function safeDel(key: string) {
  try { localStorage.removeItem(key) } catch { /* 무시 */ }
}

export function buildDb(mods: string[]): DefDatabase {
  const { db, report } = loadMods(packages, mods)
  loadReport.value = report
  if (report.errors.length) console.warn('[mods]', report.errors)
  return db
}

export function hasImprint(): boolean {
  return !!safeGet(IMPRINT_KEY)
}

export function startNew(seed: string, background: string | undefined, mods: string[]) {
  const db = buildDb(mods)
  const s = newGame(db, { seed, background, mods: db.loadedMods })
  const w = { db, s }
  runUntilInput(w)
  world.value = w
  version.value++
  screen.value = 'game'
  saveImprint()
}

export function continueImprint(): string | null {
  const raw = safeGet(IMPRINT_KEY)
  if (!raw) return '각인이 없다'
  try {
    const s = deserialize(raw)
    const db = buildDb(s.mods.filter((m) => m !== 'core'))
    world.value = { db, s }
    version.value++
    screen.value = 'game'
    return null
  } catch (e) {
    safeDel(IMPRINT_KEY)
    return `각인을 읽지 못했다: ${(e as Error).message}`
  }
}

export function saveImprint() {
  const w = world.value
  if (!w) return
  if (w.s.over) {
    safeDel(IMPRINT_KEY)
    return
  }
  safeSet(IMPRINT_KEY, serialize(w.s))
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

export function act(a: Action): string | null {
  const w = world.value
  if (!w || w.s.over) return null
  const err = playerAct(w, a)
  version.value++
  if (w.s.over) {
    recordChronicle(w)
    safeDel(IMPRINT_KEY)
  } else {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveImprint, 300)
  }
  return err
}

function recordChronicle(w: World) {
  if (!w.s.over) return
  const list = chronicle()
  list.unshift({ at: new Date().toISOString(), seed: w.s.seed, report: w.s.over.report, kind: w.s.over.kind })
  safeSet(CHRONICLE_KEY, JSON.stringify(list.slice(0, 50)))
}

export function chronicle(): ChronicleEntry[] {
  try { return JSON.parse(safeGet(CHRONICLE_KEY) ?? '[]') as ChronicleEntry[] } catch { return [] }
}

export function abandonToTitle() {
  saveImprint()
  screen.value = 'title'
}

export function randomSeed(): string {
  const words = ['재', '장막', '고원', '회색', '침묵', '정원', '폐허', '늑대', '비', '겨울', '등불', '길']
  const a = words[Math.floor(Math.random() * words.length)]
  const b = words[Math.floor(Math.random() * words.length)]
  return `${a}-${b}-${Math.floor(Math.random() * 9000 + 1000)}`
}

// 디버그/E2E 훅: ?debug 일 때만 노출
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
  void import('../core/bot').then(({ botDecide }) => {
    ;(window as unknown as Record<string, unknown>).__ashveil = {
      world: () => world.value,
      botSteps(n: number) {
        for (let i = 0; i < n; i++) {
          const w = world.value
          if (!w || w.s.over) break
          const err = act(botDecide(w))
          if (err) act({ type: 'wait' })
        }
        return world.value?.s.over ? 'over' : 'running'
      },
    }
  })
}
