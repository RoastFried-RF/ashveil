// 스프라이트 아틀라스: sprites.json(시트·프레임·애니·캐릭터) + DCSS 아이템 아이콘(tiles/*.png)

import { Assets, Rectangle, Texture } from 'pixi.js'
import manifest from '../sprites.json'
import {modTextureUrl} from '../mod-texture-display'

export interface CharDef {
  walk: Record<Dir, string[]>
  idle: Record<Dir, string[]>
  attack?: Record<Dir, string[]>
  anchor: [number, number]
  /** 공격 시트의 지면 기준. 걷기와 다른 크기의 프레임도 발 위치를 유지한다. */
  attackAnchor?: [number, number]
  /** 원본 픽셀을 월드에 표시하는 배율. 미지정 캐릭터는 기존 0.72를 유지한다. */
  renderScale?: number
  /** 지면부터 머리 위 상태 표시까지의 월드 픽셀 높이. */
  headOffset?: number
  /** 방향형 대형 생물도 원래 몸 크기의 그림자·체력 막대를 유지한다. */
  shadow?: [number, number]
  healthBarWidth?: number
}
export type Dir = 'down' | 'left' | 'right' | 'up'

const M = manifest as unknown as {
  sheets: Record<string, string>
  frames: Record<string, [string, number, number, number, number]>
  anims: Record<string, { frames: string[]; fps: number }>
  chars: Record<string, CharDef>
  ui: Record<string, string>
}

export const anims = M.anims
export const chars = M.chars
export const uiUrls = M.ui

const sheets = new Map<string, Texture>()
const cache = new Map<string, Texture>()
const icons = new Map<string, Texture>()
let atlasGeneration=0

export function base(): string {
  return import.meta.env.BASE_URL
}

export async function loadAtlas(iconNames: string[]) {
  const ticket=++atlasGeneration
  const b = base()
  const sheetUrls = Object.entries(M.sheets).map(([k, v]) => [k, b + v] as const)
  const iconUrls = [...new Set(iconNames)].filter(n=>!M.frames[n]).map((n) => [n, iconUrl(n)] as const)
  const all = await Assets.load([...sheetUrls.map((x) => x[1]), ...iconUrls.map((x) => x[1])])
  if(ticket!==atlasGeneration)return false
  for (const [k, u] of sheetUrls) sheets.set(k, all[u] as Texture)
  icons.clear()
  for (const [k, u] of iconUrls) if (all[u]) icons.set(k, all[u] as Texture)
  return true
}

/** sprites.json 프레임 이름 → 텍스처 */
export function tex(name: string): Texture {
  const hit = cache.get(name)
  if (hit) return hit
  const f = M.frames[name]
  if (!f) return icons.get(name) ?? Texture.EMPTY
  const sheet = sheets.get(f[0])
  if (!sheet) return Texture.EMPTY
  const t = new Texture({ source: sheet.source, frame: new Rectangle(f[1], f[2], f[3], f[4]) })
  cache.set(name, t)
  return t
}

/** 시트 일부 잘라내기 (KT 바닥 128px 사분면을 16px 단위로 샘플링) */
export function sub(name: string, x: number, y: number, w: number, h: number): Texture {
  const key = `${name}@${x},${y},${w},${h}`
  const hit = cache.get(key)
  if (hit) return hit
  const f = M.frames[name]
  const sheet = f && sheets.get(f[0])
  if (!f || !sheet) return Texture.EMPTY
  const t = new Texture({ source: sheet.source, frame: new Rectangle(f[1] + x, f[2] + y, w, h) })
  cache.set(key, t)
  return t
}

export function icon(name: string): Texture {
  return icons.get(name) ?? tex(name)
}

export function hasFrame(name: string): boolean {
  return !!M.frames[name]
}

export function animFrames(name: string): Texture[] {
  return (M.anims[name]?.frames ?? []).map(tex)
}

/** 아이템·능력 아이콘 URL (Vue UI용) */
export function iconUrl(name: string): string {
  return modTextureUrl(name)??`${base()}tiles/${name}.png`
}

/** sprites.json 프레임을 CSS 배경으로 (Vue 초상화 등) */
export function frameCss(name: string, scale: number): Record<string, string> {
  const f = M.frames[name]
  if (!f) return {}
  return {
    width: `${f[3] * scale}px`,
    height: `${f[4] * scale}px`,
    backgroundImage: `url(${base()}${M.sheets[f[0]]})`,
    backgroundPosition: `-${f[1] * scale}px -${f[2] * scale}px`,
    backgroundSize: 'auto',
    imageRendering: 'pixelated',
  }
}


/** Vue 아이콘도 실제 제공된 시트의 같은 영역을 읽는다. */
export function iconFrame(name:string){
  const f=M.frames[name]
  return f?{url:base()+M.sheets[f[0]],x:f[1],y:f[2],w:f[3],h:f[4]}:undefined
}
