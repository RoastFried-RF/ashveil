import { normalizeBindings, type Command, type KeyBindings } from './keybindings'
// 화면 설정은 각인과 분리한다. 손상되거나 구버전인 설정은 필드별 기본값으로 읽는다.
import { reactive, ref, watch } from 'vue'

export interface Preferences {
  mapZoom: 'auto' | 'vision' | 1 | 2 | 3 | 4
  speechEnabled:boolean
  speechRate:number
  keyRepeatMode:'system'|'limited'|'once'
  keyRepeatDelay:number
  keyRepeatInterval:number
  keyBindings: KeyBindings
  logFontSize: number
  animationSpeed: 0 | 0.5 | 1 | 2
  screenShake: boolean
  torchFlicker: boolean
  hitFlash: boolean
  warningPulse: boolean
  floaters: 'normal' | 'large' | 'off'
  palette: 'standard' | 'redgreen' | 'blueyellow'
}
export const PREFERENCES_KEY = 'ashveil.preferences.v1'
export const DEFAULT_PREFERENCES: Preferences = { mapZoom:'auto', speechEnabled:false, speechRate:1, keyRepeatMode:'system', keyRepeatDelay:500, keyRepeatInterval:125, keyBindings: {}, logFontSize: 12, animationSpeed: 1, screenShake: true, torchFlicker: true, hitFlash: true, warningPulse: true, floaters: 'normal', palette: 'standard' }
export function normalizePreferences(raw: unknown): Preferences {
  const p = { ...DEFAULT_PREFERENCES, keyBindings:{} as KeyBindings }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return p
  const r = raw as Record<string, unknown>
  if (['auto', 'vision', 1, 2, 3, 4].includes(r.mapZoom as Preferences['mapZoom'])) p.mapZoom = r.mapZoom as Preferences['mapZoom']
  p.keyBindings=normalizeBindings(r.keyBindings)
  if(typeof r.speechEnabled==='boolean')p.speechEnabled=r.speechEnabled
  if(typeof r.speechRate==='number'&&Number.isFinite(r.speechRate))p.speechRate=Math.round(Math.max(.5,Math.min(2,r.speechRate))*10)/10
  if(['system','limited','once'].includes(r.keyRepeatMode as string))p.keyRepeatMode=r.keyRepeatMode as Preferences['keyRepeatMode']
  for(const [key,min,max]of [['keyRepeatDelay',0,2000],['keyRepeatInterval',50,1000]]as const)if(typeof r[key]==='number'&&Number.isFinite(r[key]))p[key]=Math.max(min,Math.min(max,Math.round(r[key]as number)))
  if (typeof r.logFontSize === 'number' && Number.isFinite(r.logFontSize)) p.logFontSize = Math.max(12, Math.min(24, Math.round(r.logFontSize)))
  if ([0, .5, 1, 2].includes(r.animationSpeed as number)) p.animationSpeed = r.animationSpeed as Preferences['animationSpeed']
  for (const k of ['screenShake', 'torchFlicker', 'hitFlash', 'warningPulse'] as const) if (typeof r[k] === 'boolean') p[k] = r[k]
  if (['normal', 'large', 'off'].includes(r.floaters as string)) p.floaters = r.floaters as Preferences['floaters']
  if (['standard', 'redgreen', 'blueyellow'].includes(r.palette as string)) p.palette = r.palette as Preferences['palette']
  return p
}
function load(): Preferences {
  try {
    const saved = localStorage.getItem(PREFERENCES_KEY)
    if (saved) return normalizePreferences(JSON.parse(saved))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return { ...DEFAULT_PREFERENCES, animationSpeed: 0, screenShake: false, torchFlicker: false, hitFlash: false, warningPulse: false }
  } catch { /* 저장소 미지원 환경에서도 기본 설정으로 실행한다. */ }
  return { ...DEFAULT_PREFERENCES, keyBindings:{} }
}
export const preferences = reactive(load())
export const preferencesOpen = ref(false)
export const bindingCapture=ref<Command|null>(null)
watch(preferences, (p) => { try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(p)) } catch { /* 저장 공간이 없으면 현재 실행에만 적용한다. */ } })
export function resetPreferences() { Object.assign(preferences, DEFAULT_PREFERENCES, {keyBindings:{}}) }
export const PALETTE = {
  standard: { health: '#b83a2a', energy: '#62788a', warn: '#d9a040', danger: '#d8402e' },
  redgreen: { health: '#568ed1', energy: '#dd9b40', warn: '#e8c46a', danger: '#e89b4a' },
  blueyellow: { health: '#c96d9a', energy: '#76ab88', warn: '#d797ba', danger: '#e786a9' },
} as const
export const paletteColor = (key: keyof typeof PALETTE.standard) => PALETTE[preferences.palette][key]
