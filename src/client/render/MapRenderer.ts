import {mapAppearance,displayTile} from '../map-memory'
import {creatureSprite} from './creature-sprite'
import {groundObjectArt,isGroundCrop} from './terrain-art'
// 다크 판타지 맵 렌더러 (Pixi 8)
// 층: 바닥 → 장식·피 → 벽 → [물체·생물 y정렬] → 빛(가산) → 어둠(부드러운 시야) → 커서·대상 → 떠오르는 글자
// 코어 상태는 읽기만 한다. 연출은 w.s.fx 이벤트를 소비해서 만든다.

import {
  AnimatedSprite, Application, Container, Graphics, Sprite, Text, Texture, TextureStyle, type TextStyleOptions,
} from 'pixi.js'
import {
  crouched, beddingScorch,bestiaryEntry, bestiaryStage, bloodLoss, hpMax, isRaining, weatherDef, lightAt, player, regionState, totalBleed, turnOf, hasEffect,
  type Creature, type FxEvent, type Pos, type World,
} from '../../core'
import { paletteColor, preferences } from '../preferences'
import { animFrames, chars, hasFrame, icon, sub, tex, type CharDef, type Dir } from './atlas'

export const T = 16
const MOVE_MS = 150
const ATTACK_MS = 280

const FONT: TextStyleOptions = {
  fontFamily: '"Gowun Batang", "Noto Serif KR", serif',
  fontWeight: '700',
  fill: '#ffffff',
  stroke: { color: '#120c08', width: 3 },
}

interface CView {
  id: number
  selectedSprite: string
  root: Container
  body: Sprite
  shadow: Graphics
  bar: Graphics
  marks: Graphics
  char?: CharDef
  anim?: Texture[]
  from: Pos
  to: Pos
  t: number
  dir: Dir
  attackT: number
  attackVec: Pos
  flashT: number
  deadT: number
  alive: boolean
  mechanical: boolean
  crouched:boolean
  unknown: boolean
  scale: number
  zzT: number
  /** 다리 중상 이상: 걷기 절뚝임 (12 §2.5) */
  limp: boolean
}

interface PropAnimation { s: Sprite; frames: Texture[]; fps: number; phase: number; flame?: boolean }

interface Floater { t: Text; vy: number; life: number; max: number }

export interface RenderOpts {
  hover?: Pos | null
  targets?: Pos[]
  selected?: Pos | null
  path?: Pos[]
}

const DIR_OF_FACING: Dir[] = ['up', 'right', 'right', 'right', 'down', 'left', 'left', 'left']

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return (h ^ (h >>> 16)) >>> 0
}

export class MapRenderer {
  app = new Application()
  private host: HTMLElement
  private world = new Container()
  private ground = new Container()
  private deco = new Container()
  private walls = new Container()
  private dyn = new Container()
  private objs = new Container()
  private glow!: Sprite
  private dark!: Sprite
  private overlay = new Graphics()
  private floatLayer = new Container()
  private rain = new Graphics()
  private darkCanvas = document.createElement('canvas')
  private glowCanvas = document.createElement('canvas')
  private views = new Map<number, CView>()
  private floaters: Floater[] = []
  private animated: PropAnimation[] = []
  private dynamicAnimated: PropAnimation[] = []
  private flames: { s: Sprite; base: number; phase: number }[] = []
  private renderedMap: World['s']['map'] | null = null
  private renderedTerrain: (string|undefined)[] = []
  private displayVisible:ReadonlySet<number>=new Set()
  private cam = { x: 0, y: 0 }
  private camInit = false
  private zoom = 3
  private time = 0
  private w: World | null = null
  private opts: RenderOpts = {}
  private shake = 0
  private ready = false
  onHover: (p: Pos | null) => void = () => {}
  onClick: (p: Pos, button: number) => void = () => {}

  constructor(host: HTMLElement) {
    this.host = host
  }

  async init() {
    TextureStyle.defaultOptions.scaleMode = 'nearest'
    await this.app.init({ background: '#070707', antialias: false, resizeTo: this.host, preference: 'webgl', resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
    this.host.appendChild(this.app.canvas)
    this.objs.sortableChildren = true
    this.glow = new Sprite(Texture.from(this.glowCanvas))
    this.glow.blendMode = 'add'
    this.dark = new Sprite(Texture.from(this.darkCanvas))
    this.world.addChild(this.ground, this.deco, this.walls, this.dyn, this.objs, this.glow, this.dark, this.overlay, this.floatLayer)
    this.app.stage.addChild(this.world, this.rain)
    const cv = this.app.canvas
    cv.addEventListener('pointermove', (e) => this.onHover(this.tileAt(e)))
    cv.addEventListener('pointerleave', () => this.onHover(null))
    cv.addEventListener('pointerdown', (e) => { const p = this.tileAt(e); if (p) this.onClick(p, e.button) })
    cv.addEventListener('contextmenu', (e) => e.preventDefault())
    this.app.ticker.add((tk) => this.tick(tk.deltaMS))
    this.ready = true
    if (this.w) this.sync(this.w)
  }

  destroy() {
    this.ready = false
    this.app.destroy(true, { children: true })
  }

  private tileAt(e: PointerEvent): Pos | null {
    const r = this.app.canvas.getBoundingClientRect()
    const sx = e.clientX - r.left, sy = e.clientY - r.top
    const x = Math.floor((sx - this.world.x) / (T * this.zoom))
    const y = Math.floor((sy - this.world.y) / (T * this.zoom))
    const w = this.w
    if (!w || x < 0 || y < 0 || x >= w.s.map.w || y >= w.s.map.h) return null
    return { x, y }
  }

  setOpts(o: RenderOpts) {
    this.opts = o
    this.drawOverlay()
  }

  /** 행동 후 호출: 정적 층(필요 시)·동적 층·빛·생물·연출 갱신 */
  sync(w: World) {
    this.w = w
    if (!this.ready) return
    // 정수 배율 = floor(세로 / 360) → 16:9에서 늘 40 × 22.5칸 (12 §2.4)
    const H = this.app.renderer.height / this.app.renderer.resolution
    this.zoom = Math.max(1, Math.floor(H / 360))
    this.world.scale.set(this.zoom)
    const mapChanged = w.s.map !== this.renderedMap
    const appearance=mapAppearance(w)
    this.displayVisible=appearance.visible
    const terrainChanged = mapChanged || appearance.terrain.some((id,i)=>id!==this.renderedTerrain[i])
    if (mapChanged) {
      for (const v of this.views.values()) v.root.destroy({ children: true })
      this.views.clear()
      this.camInit = false
      w.s.fx.length = 0
    }
    if (terrainChanged) {
      this.renderedMap = w.s.map
      this.renderedTerrain = appearance.terrain
      this.buildStatic(w)
    }
    this.buildDynamic(w)
    this.updateLight(w)
    this.consumeFx(w)
    this.syncCreatures(w)
    this.drawOverlay()
  }

  // ── 정적: 바닥·벽·장식·고정 물체 ─────────────────────────

  private clear(c: Container) {
    for (const ch of c.removeChildren()) ch.destroy({ children: true })
  }

  private buildStatic(w: World) {
    this.clear(this.ground); this.clear(this.deco); this.clear(this.walls)
    const creatureRoots = new Set([...this.views.values()].map(v => v.root))
    for (const child of [...this.objs.children]) if (!creatureRoots.has(child as Container)) {
      this.objs.removeChild(child); child.destroy({ children: true })
    }
    this.animated = []; this.flames = []
    const map = w.s.map
    const surface = map.kind === 'surface'
    const isWall = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true
      const id=this.renderedTerrain[y*map.w+x]
      return id?!!w.db.terrain(id).wall:true
    }
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i=y*map.w+x,id=this.renderedTerrain[i]
      if(!id)continue
      const tile=displayTile(map.tiles[i],id,this.displayVisible.has(i))
      const terr = w.db.terrain(id)
      const h = hash(x, y)
      const px = x * T, py = y * T
      // 바닥
      if (!terr.wall) {
        const g = this.floorSprite(w, tile.t, x, y, h, surface)
        g.position.set(px, py)
        this.ground.addChild(g)
      }
      // 이끼·책·해골 장식
      if (tile.deco && !terr.wall) {
        const d = new Sprite(tex(tile.deco))
        d.position.set(px, py)
        if (tile.deco.startsWith('moss')) d.alpha = 0.85
        if (tile.deco === 'skull') { d.alpha = 0.7; d.tint = 0xb0a890 }
        this.deco.addChild(d)
      }
      // 벽: 아래가 트였으면 앞면, 아니면 윗면 + 가장자리 선
      if (terr.wall) {
        const faceDown = !isWall(x, y + 1)
        const ruin = tile.t === 'Terrain.RuinWall'
        if (faceDown) {
          const name = tile.t === 'Terrain.Shelf' ? `shelf${h % 24}` : `wall_face${h % 8}`
          const s = new Sprite(tex(name))
          s.position.set(px, py)
          if (ruin) s.tint = 0xa89c88
          this.walls.addChild(s)
        } else {
          const s = new Sprite(tex('wall_top'))
          s.position.set(px, py)
          if (ruin) s.tint = 0x8a8070
          this.walls.addChild(s)
        }
        for (const [dx, dy, e] of [[0, -1, 'N'], [1, 0, 'E'], [-1, 0, 'W']] as const) {
          if (!isWall(x + dx, y + dy) && !(faceDown && e !== 'N')) {
            const s = new Sprite(tex(`wall_edge_${e}`))
            s.position.set(px, py)
            this.walls.addChild(s)
          }
        }
        if (!faceDown && !isWall(x, y + 1)) {
          const s = new Sprite(tex('wall_edge_S'))
          s.position.set(px, py)
          this.walls.addChild(s)
        }
        continue
      }
      // 고정 물체
      this.staticObject(w, tile.t, x, y, h)
    }
    // 다칸 소품
    for (const p of map.props) {
      if(!this.renderedTerrain[p.y*map.w+p.x])continue
      const k = p.kind
      if (k === 'statue' || k === 'sarcophagus') {
        const s = new Sprite(tex(k))
        s.anchor.set(0.5, 1)
        if (p.scale) s.scale.set(p.scale)
        s.position.set((p.x + p.w / 2) * T, (p.y + p.h) * T)
        s.zIndex = (p.y + p.h) * T - 1
        this.objs.addChild(s)
      } else if (k === 'chain0') {
        const s = new Sprite(tex(k))
        s.position.set(p.x * T, p.y * T)
        s.zIndex = (p.y + 1) * T
        this.objs.addChild(s)
      } else if (k === 'cd_veina1' || k === 'cd_littleeyes') {
        const frames = animFrames(k)
        const s = new Sprite(frames[0])
        s.position.set(p.x * T, p.y * T)
        this.deco.addChild(s)
        this.animated.push({ s, frames, fps: 6, phase: hash(p.x, p.y) % 24 })
      }
    }
  }

  private floorSprite(w: World, t: string, x: number, y: number, h: number, surface: boolean): Container {
    const terrain=w.db.terrain(t)
    if(terrain.id==='Terrain.BoatFrame')return new Sprite(icon('water_shallow'))
    if(terrain.floor==='deck')return new Sprite(tex(`deck${h%3}`))
    if (t === 'Terrain.CdFloor') {
      const s = new Sprite(tex(`cd_floor${h % 20}`))
      return s
    }
    if ((surface||terrain.water||terrain.floor==='earth') && t !== 'Terrain.KtFloor' && t !== 'Terrain.Rubble' && !terrain.stairs) {
      let name: string
      if (terrain.water) name = terrain.water==='deep'?'water_deep':'water_shallow'
      else if (t === 'Terrain.Mud'||t==='Terrain.BogMud'||t==='Terrain.CoastalMud') name = `mud${h%4}`
      else if (t === 'Terrain.Path') name = `dirt${h % 3}`
      else if (!surface) name = `dirt${h%3}`
      else name = h % 9 === 0 ? `grassdirt${(h>>>4)%3}` : `grass${(h>>>3)%3}`
      const s = new Sprite(icon(name))
      s.width = T; s.height = T
      // 같은 결의 풀을 미세한 명도 차로만 흩뜨려 바둑판 무늬를 피한다
      const k = 0xf4 + (h % 10)
      s.tint = terrain.water || name.startsWith('mud') ? 0xffffff : (k << 16) | ((k + 2) << 8) | (k - 3)
      return s
    }
    // KT 석판: 8×8칸 블록마다 사분면을 고르고 그 안을 16px로 샘플링 → 이음매 없는 큰 무늬
    const q = hash(x >> 3, y >> 3) % 4
    const s = new Sprite(sub(`kt_floor_q${q}`, (x & 7) * 16, (y & 7) * 16, 16, 16))
    if (t === 'Terrain.Rubble') s.tint = 0x9a9080
    return s
  }

  private staticObject(w: World, t: string, x: number, y: number, h: number) {
    const terr = w.db.terrain(t)
    const px = x * T, py = y * T
    const add = (s: Sprite, ax: number, ay: number, z = (y + 1) * T) => {
      s.anchor.set(ax, ay)
      s.zIndex = z
      this.objs.addChild(s)
      return s
    }
    if(terr.visual||groundObjectArt(terr))return // 밭·작업대·생활 물체는 동적 경로에서 그린다.
    if (terr.stairs) {
      const s = new Sprite(tex(terr.stairs === 'down' ? 'floor_stairs' : 'floor_ladder'))
      s.position.set(px, py)
      this.deco.addChild(s)
      return
    }
    switch (t) {
      case 'Terrain.Tree': {
        // 기존 기본 키의 혼합 표현은 보존하고, 콘텐츠가 지정한 별도 수목 원본은 실제로 읽는다.
        const chosen=terr.sprites?.[0],key=chosen&&chosen!=='tree_dead'?terr.sprites[h%terr.sprites.length]:(h%4===0?'tree':'tree_dead')
        const s = add(new Sprite(tex(key)), 0.5, 0.96)
        s.scale.set(h % 2 ? 0.42 : -0.42, 0.42)
        s.position.set(px + T / 2, py + T)
        s.tint = 0x9a9a92
        break
      }
      case 'Terrain.Rock': {
        const s = add(new Sprite(tex('rock')), 0.5, 0.9)
        s.scale.set(0.45)
        s.position.set(px + T / 2, py + T)
        break
      }
      case 'Terrain.Brazier': {
        const frames = animFrames('brazier')
        const s = add(new Sprite(frames[0]), 0.5, 0.95)
        s.scale.set(0.5)
        s.position.set(px + T / 2, py + T)
        this.animated.push({ s, frames, fps: 8, phase: h % 8, flame: true })
        break
      }
      case 'Terrain.Campfire': break // 설치·소진에 따라 동적으로 그린다.
      case 'Terrain.Statue': case 'Terrain.SarcoBlock': case 'Terrain.Sarcophagus':
        break // 다칸 소품이 그린다
      case 'Terrain.Barricade': {
        const s = add(new Sprite(tex('crate_closed')), 0.5, 1)
        s.width = T; s.height = T
        s.position.set(px + T / 2, py + T)
        s.tint = 0x8a7460
        break
      }
      case 'Terrain.Column': {
        const s = add(new Sprite(tex('broken_column')), 0.5, 1)
        s.scale.set(0.5)
        s.position.set(px + T / 2, py + T)
        break
      }
    }
  }

  // ── 동적: 문·용기·피·바닥 물건 ─────────────────────────

  private buildDynamic(w: World) {
    this.dynamicAnimated=[]
    this.clear(this.dyn)
    for (const ch of [...this.objs.children]) if (ch.label === 'dyn') { this.objs.removeChild(ch); ch.destroy() }
    const map = w.s.map
    const vis = this.displayVisible
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x
      const id=this.renderedTerrain[i]
      if(!id)continue
      const tile=displayTile(map.tiles[i],id,vis.has(i))
      const terr=w.db.terrain(id)
      const h = hash(x, y)
      const px = x * T, py = y * T
      if(terr.wallMark){
        const crack=new Sprite(tex(terr.wallMark==='sealedCrack'?'complete_wall_sealed':'complete_wall_crack'))
        crack.position.set(px,py)
        this.dyn.addChild(crack)
      }
      if (tile.icy || tile.snow) {
        const surface = new Graphics().rect(px, py, T, T).fill({ color: tile.icy && terr.water ? 0x8ca8b4 : 0xb5b8b5, alpha: tile.icy && terr.water ? .65 : Math.min(.7, (tile.snow ?? 0) / 140) })
        if (tile.icy && (tile.iceHoleUntil ?? 0) > turnOf(w)) surface.circle(px + 8, py + 8, 4).fill(0x273b48)
        this.dyn.addChild(surface)
      }
      if (tile.blood > 4) {
        const b = new Sprite(icon(tile.blood > 120 ? 'blood_pool' : `blood${h % 4}`))
        b.width = T; b.height = T
        b.position.set(px, py)
        b.tint = 0x8a1a14
        b.alpha = Math.min(0.85, 0.3 + tile.blood / 220)
        this.dyn.addChild(b)
      }
      // 포자 구름 (07 §11): 보이는 칸만, 농도만큼 진하게
      if (tile.spores && tile.spores.until > turnOf(w) && vis.has(i)) {
        const g = new Graphics().rect(px, py, T, T).fill({ color: 0x9aa878, alpha: Math.min(0.55, 0.12 + tile.spores.conc * 0.05) })
        this.dyn.addChild(g)
      }
      if(tile.t==='Terrain.Campfire'||terr.beacon){
        const coal=new Sprite(tex(terr.beacon?'complete_beacon':'complete_campfire_cold'))
        coal.position.set(px,py)
        this.dyn.addChild(coal)
        if(vis.has(i)&&map.lights.some((l)=>(l.kind==='campfire'||l.kind==='beacon')&&!l.off&&l.pos.x===x&&l.pos.y===y)){
          const frames=animFrames('complete_fire'),flame=new Sprite(frames[0]);flame.anchor.set(.5,1);flame.position.set(px+T/2,py+T);this.dyn.addChild(flame)
          this.dynamicAnimated.push({s:flame,frames,fps:7,phase:h%3,flame:true})
        }
      }
      if(tile.terrainFire&&vis.has(i)){const frames=animFrames('complete_fire'),flame=new Sprite(frames[0]);flame.anchor.set(.5,1);flame.position.set(px+T/2,py+T);flame.zIndex=py+T+.25;flame.label='dyn';this.objs.addChild(flame);this.dynamicAnimated.push({s:flame,frames,fps:7,phase:h%3,flame:true})}
      let s: Sprite | null = null
      const groundArt=groundObjectArt(terr,!!tile.searched)
      if (terr.bedding) {
        const bed = new Sprite(tex(groundArt!));bed.position.set(px,py)
        this.dyn.addChild(bed)
        const scorch=beddingScorch(tile)
        if(scorch){const charred=new Sprite(tex('complete_bed_scorched'));charred.position.set(px,py);charred.alpha=Math.min(.85,scorch/100);this.dyn.addChild(charred)}
        if(tile.beddingFire){
          const frames=animFrames('complete_fire'),flame=new Sprite(frames[0]);flame.anchor.set(.5,1);flame.position.set(px+T/2,py+T);this.dyn.addChild(flame)
          this.dynamicAnimated.push({s:flame,frames,fps:7,phase:h%3,flame:true})
        }
      }
      if (groundArt&&!terr.bedding) {
        s=new Sprite(tex(groundArt));s.anchor.set(.5,1);s.position.set(px+T/2,py+T)
        if(isGroundCrop(terr))s.scale.set(terr.gather&&(tile.cultivation?tile.cultivation.growth<terr.gather.regrowTurns:(tile.gatherAt??0)>turnOf(w))?.6:1)
      } else if (terr.visual) {
        s=new Sprite(tex(terr.visual.sprite));s.anchor.set(.5,.96);s.position.set(px+T/2,py+T)
        s.scale.set(terr.visual.scale*(terr.gather&&(tile.cultivation?tile.cultivation.growth<terr.gather.regrowTurns:(tile.gatherAt??0)>turnOf(w))?.6:1))
        if(terr.visual.tint!==undefined)s.tint=terr.visual.tint
      } else if (terr.station) {
        s = new Sprite(tex('crate_closed'))
        s.width = T; s.height = T
        s.position.set(px, py)
        if (terr.station.id === 'forge') s.tint = 0xa07050
      } else if (terr.door) {
        s = new Sprite(tex(terr.sprites?.[0]??(terr.door === 'open' ? 'door_open' : 'door_closed')))
        s.anchor.set(0, 1)
        s.position.set(px, py + T)
      } else if (terr.container && !terr.wall && tile.t !== 'Terrain.Sarcophagus') {
        const opened = !!tile.searched
        // 지형 Def의 첫 스프라이트를 쓰고, 열린 용기는 '…2' 프레임(열린 뚜껑)이 있으면 그것으로
        const base = terr.sprites?.[0] ?? 'crate0'
        let name = base === 'pot0' && !opened ? `pot${h % 2}` : base
        if (opened && hasFrame(base.replace(/0$/, '2'))) name = base.replace(/0$/, '2')
        s = new Sprite(tex(name))
        s.anchor.set(0.5, 1)
        s.position.set(px + T / 2, py + T)
        if (tile.t === 'Terrain.Fungus') { s.scale.set(0.3); s.tint = opened ? 0x6a6a60 : 0xb0b8a8 }
        else if (opened) s.tint = 0x8a8478
      } else if (tile.t === 'Terrain.Sarcophagus' && tile.searched) {
        // 열린 석관: 앞면에 어두운 틈
        const g = new Sprite(tex('complete_sarcophagus_open'));g.position.set(px,py)
        g.zIndex = py + T
        g.label = 'dyn'
        this.objs.addChild(g)
      }
      if (s) { s.zIndex = py + T - 0.5; s.label = 'dyn'; this.objs.addChild(s) }
      if (tile.items.length && vis.has(i)) {
        const it = tile.items[tile.items.length - 1]
        const ic = new Sprite(icon(w.db.item(it.def).sprite))
        ic.width = 12; ic.height = 12
        ic.position.set(px + 2, py + 3)
        const sh = new Graphics().ellipse(px + 8, py + 14, 5, 1.6).fill({ color: 0x000000, alpha: 0.4 })
        this.dyn.addChild(sh, ic)
        if (tile.items.length > 1) this.dyn.addChild(new Graphics().rect(px + 12, py + 2, 2, 2).fill(0xe8d080))
      }
    }
  }

  // ── 빛·어둠: 타일당 1px 캔버스를 선형 확대해서 부드럽게 ────

  private updateLight(w: World) {
    const map = w.s.map
    for (const cv of [this.darkCanvas, this.glowCanvas]) { cv.width = map.w; cv.height = map.h }
    const dctx = this.darkCanvas.getContext('2d')!
    const gctx = this.glowCanvas.getContext('2d')!
    const dimg = dctx.createImageData(map.w, map.h)
    const gimg = gctx.createImageData(map.w, map.h)
    const vis = this.displayVisible
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x
      const o = i * 4
      let a: number
      if (vis.has(i)) {
        const l = lightAt(w, { x, y })
        a = Math.max(0, Math.min(0.55, 0.6 - l * 1.0))
      } else if (map.tiles[i].seen) a = 0.74
      else a = 1
      dimg.data[o] = 4; dimg.data[o + 1] = 4; dimg.data[o + 2] = 8; dimg.data[o + 3] = Math.round(a * 255)
    }
    // 불빛: 보이는 광원 주변을 따뜻하게
    for (const L of map.lights) {
      if(L.off)continue
      if (!vis.has(L.pos.y * map.w + L.pos.x)) continue
      const col = L.kind === 'taint' ? [150, 40, 70] : [255, 140, 60]
      for (let dy = -L.radius; dy <= L.radius; dy++) for (let dx = -L.radius; dx <= L.radius; dx++) {
        const x = L.pos.x + dx, y = L.pos.y + dy
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > L.radius) continue
        const i = y * map.w + x
        if (!vis.has(i)) continue
        const k = (1 - d / L.radius) * 0.55
        const o = i * 4
        gimg.data[o] = Math.min(255, gimg.data[o] + col[0] * k)
        gimg.data[o + 1] = Math.min(255, gimg.data[o + 1] + col[1] * k)
        gimg.data[o + 2] = Math.min(255, gimg.data[o + 2] + col[2] * k)
        gimg.data[o + 3] = 255
      }
    }
    dctx.putImageData(dimg, 0, 0)
    gctx.putImageData(gimg, 0, 0)
    for (const [s, cv] of [[this.dark, this.darkCanvas], [this.glow, this.glowCanvas]] as const) {
      s.texture.destroy(false)
      const t = Texture.from(cv, true)
      t.source.scaleMode = 'linear'
      s.texture = t
      s.width = map.w * T
      s.height = map.h * T
    }
  }

  // ── 생물 ────────────────────────────────────────────

  private makeView(w: World, c: Creature): CView {
    const root = new Container()
    const shadow = new Graphics().ellipse(0, 0, 6, 2).fill({ color: 0x000000, alpha: 0.45 })
    const selectedSprite = creatureSprite(w,c)
    const ch = chars[selectedSprite]
    let body: Sprite
    let anim: Texture[] | undefined
    let scale = 1
    if (ch) {
      body = new Sprite(tex(ch.idle.down[0]))
      body.anchor.set(ch.anchor[0], ch.anchor[1])
      scale = ch.renderScale ?? 0.72
      if (ch.shadow) shadow.clear().ellipse(0, 0, ch.shadow[0], ch.shadow[1]).fill({ color: 0x000000, alpha: 0.5 })
    } else if (animFrames(selectedSprite).length) {
      anim = animFrames(selectedSprite)
      body = new AnimatedSprite(anim)
      ;(body as AnimatedSprite).animationSpeed = 0.1
      ;(body as AnimatedSprite).play()
      body.anchor.set(0.5, 0.92)
      scale = 0.75
      shadow.clear().ellipse(0, 0, 18, 4).fill({ color: 0x000000, alpha: 0.5 })
    } else {
      body = new Sprite(hasFrame(selectedSprite) ? tex(selectedSprite) : icon(selectedSprite))
      body.anchor.set(0.5, 0.9)
      if (!hasFrame(selectedSprite)) { body.width = T; body.height = T; scale = body.scale.x }
    }
    if (ch || anim) body.scale.set(scale)
    const bar = new Graphics()
    const marks = new Graphics()
    root.addChild(shadow, body, bar, marks)
    this.objs.addChild(root)
    const v: CView = {
      id: c.id, selectedSprite, root, body, shadow, bar, marks, char: ch, anim, from: { ...c.pos }, to: { ...c.pos }, t: 1,
      dir: DIR_OF_FACING[c.facing] ?? 'down', attackT: -1, attackVec: { x: 0, y: 0 }, flashT: 0, deadT: c.alive ? -1 : 1,
      alive: c.alive, mechanical:!!c.body.machine, crouched:crouched(w,c), unknown: false, scale, zzT: (c.id * 37) % 1000, limp: false,
    }
    void w
    return v
  }

  private syncCreatures(w: World) {
    const vis = this.displayVisible
    const seen = new Set<number>()
    const pl = player(w)
    for (const c of w.s.creatures) {
      if (!c.alive && c.deathCause === 'escaped') continue
      const i = c.pos.y * w.s.map.w + c.pos.x
      const shown = c.id === pl.id || vis.has(i)
      let v = this.views.get(c.id)
      if (v && v.selectedSprite !== creatureSprite(w,c)) { v.root.destroy({children:true});this.views.delete(c.id);v=undefined }
      if (!shown) {
        if (v && c.alive) { v.root.visible = false }
        if (v && !c.alive && !w.s.map.tiles[i].seen) v.root.visible = false
        if (!v) continue
      }
      if (!v) { v = this.makeView(w, c); this.views.set(c.id, v) }
      if(c.body.machine)v.char=chars[(!c.alive||c.unconscious?w.db.creature(c.def).dormantChar:undefined)??v.selectedSprite]
      seen.add(c.id)
      v.root.visible = shown || (!c.alive && !!w.s.map.tiles[i].seen)
      if (v.to.x !== c.pos.x || v.to.y !== c.pos.y) {
        const cur = this.viewPos(v)
        v.from = cur
        v.to = { ...c.pos }
        v.t = Math.abs(cur.x - c.pos.x) + Math.abs(cur.y - c.pos.y) > 2.5 ? 1 : 0
      }
      if (c.alive) v.dir = DIR_OF_FACING[c.facing] ?? v.dir
      v.unknown=c.id!==pl.id&&!c.met&&!!bestiaryEntry(w,c.def)&&bestiaryStage(w,c.def)===0
      v.crouched=crouched(w,c)
      v.mechanical=!!c.body.machine
      v.limp = c.alive && Math.max(regionState(w, c, 'lleg'), regionState(w, c, 'rleg')) >= 3
      if (v.alive && !c.alive) { v.alive = false; v.deadT = 0 }
      this.drawBar(w, c, v)
      this.drawMarks(w, c, v)
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { v.root.destroy({ children: true }); this.views.delete(id) }
  }

  private drawBar(w: World, c: Creature, v: CView) {
    const g = v.bar
    g.clear()
    if (!c.alive || c.faction === 'player') return
    const max = hpMax(w, c)
    const frac = Math.max(0, Math.min(1, c.hp / max))
    const top = this.headY(v)
    const bw = v.char?.healthBarWidth ?? (v.anim ? 24 : 14)
    g.rect(-bw / 2 - 1, top - 4, bw + 2, 3).fill({ color: 0x0a0806, alpha: 0.85 })
    g.rect(-bw / 2, top - 3, bw * frac, 1).fill(frac > 0.5 ? paletteColor('health') : frac > 0.25 ? paletteColor('danger') : paletteColor('warn'))
    // 출혈 중이면 아래에 가는 붉은 선
    if (totalBleed(w, c, true) > 1) g.rect(-bw / 2, top - 1.5, bw * Math.min(1, totalBleed(w, c, true) / 20), 0.5).fill(0xff3030)
  }

  private headY(v: CView): number {
    if (v.anim) return -44
    if (v.char) return -(v.char.headOffset ?? 22)*(v.crouched ? .78 : 1)
    return -15
  }

  /**
   * 머리 위 아이콘 (12 §2.5): 최대 3개.
   * 우선순위 기절 > 도주·항복 > 출혈(핏방울 1~3: <10 / <40 / ≥40 ml) > 잠듦(z/zz) > 조준 중 > 자세 · 추적·잠행
   */
  private drawMarks(w: World, c: Creature, v: CView) {
    const g = v.marks
    g.clear()
    if (!c.alive) return
    const turn = turnOf(w)
    const top = this.headY(v) - 7
    const icons: ((x: number) => void)[] = []
    const pl = player(w)
    if (hasEffect(c, 'stunned', turn) || c.unconscious) icons.push((x) => g.star(x + 2, top - 1, 5, 2.4, 1).fill(0xf0e060))
    if (c.ai.mode === 'flee') icons.push((x) => g.moveTo(x, top - 2).lineTo(x + 4, top - 4).lineTo(x + 4, top).closePath().fill(0xe0e0d0))
    else if (c.ai.mode === 'surrender') icons.push((x) => g.rect(x, top - 4, 0.8, 6).rect(x + 0.8, top - 4, 3.5, 2.5).fill(0xf0f0f0))
    const bl = totalBleed(w, c, true)
    if (bl > 0.5) {
      const n = bl >= 40 ? 3 : bl >= 10 ? 2 : 1
      icons.push((x) => { for (let i = 0; i < n; i++) g.circle(x + i * 1.6 + 0.8, top + (i % 2), 0.9).fill(0xd02020) })
    }
    if(c.breakdown&&w.db.body(c.body.def).kind==='humanoid')icons.push((x)=>g.star(x+2,top-1,4,3,1.3).fill(0xd080b0))
    if (c.asleep) icons.push((x) => { g.rect(x, top - 3, 3, 0.7).rect(x + 2, top - 2.3, 0.7, 1).rect(x + 1, top - 1.6, 0.7, 1).rect(x, top - 0.6, 3, 0.7).fill(0xb0c0e0); if (c.deepSleep) g.rect(x + 3.5, top - 4, 2, 0.5).rect(x + 4.5, top - 3.5, 0.5, 0.8).rect(x + 3.5, top - 2.7, 2, 0.5).fill(0xb0c0e0) })
    if (c.activity?.kind === 'aim') icons.push((x) => g.circle(x + 2, top - 1, 2).stroke({ color: 0xffd060, width: 0.7 }).circle(x + 2, top - 1, 0.6).fill(0xffd060))
    if (hasEffect(c, 'parryStance', turn) || hasEffect(c, 'spearWall', turn)) icons.push((x) => g.moveTo(x, top - 3).lineTo(x + 4, top - 3).lineTo(x + 4, top - 1).lineTo(x + 2, top + 1).lineTo(x, top - 1).closePath().fill(0x9fc0e0))
    if (c.ai.cornered) icons.push((x) => g.rect(x, top - 3, 4, 1).rect(x + 1.5, top - 3, 1, 4).fill(0xe07040))
    if (c.id !== pl.id) {
      if (c.ai.mode === 'hunt') icons.push((x) => g.rect(x, top - 4, 1.5, 4).rect(x, top + 1, 1.5, 1.5).fill(0xff4a3a))
      else if (c.ai.mode === 'investigate') icons.push((x) => g.rect(x, top - 4, 3, 1.2).rect(x + 2, top - 3, 1.2, 2).rect(x + 1, top - 1, 1.2, 1).rect(x + 1, top + 1, 1.2, 1.2).fill(0xf0c040))
    } else if (c.sneaking) icons.push((x) => g.ellipse(x + 2, top - 1, 2.5, 1.4).fill(0x9fb3c8).circle(x + 2, top - 1, 0.8).fill(0x20242a))
    if (hasEffect(c, 'knockedDown', turn)) icons.push((x) => g.rect(x, top - 1, 4, 1.2).fill(0xe0a050))
    const shown = icons.slice(0, 3)
    shown.forEach((f, k) => f(-shown.length * 2.5 + k * 5))
  }

  private viewPos(v: CView): Pos {
    const t = Math.min(1, v.t)
    return { x: v.from.x + (v.to.x - v.from.x) * t, y: v.from.y + (v.to.y - v.from.y) * t }
  }

  // ── 연출 이벤트 ─────────────────────────────────────

  private consumeFx(w: World) {
    const evs = w.s.fx.splice(0)
    const pl = player(w)
    const vis = this.displayVisible
    const stack = new Map<number, number>()
    // 한 번에 몰린 사건(봇·휴식 중)은 생물마다 마지막 6개만 띄운다
    const perId = new Map<number, number>()
    for (const e of evs) perId.set(e.id, (perId.get(e.id) ?? 0) + 1)
    const skip = new Map<number, number>()
    for (const [id, n] of perId) skip.set(id, Math.max(0, n - 6))
    for (const e of evs) {
      const sk = skip.get(e.id) ?? 0
      if (sk > 0 && e.k !== 'death') { skip.set(e.id, sk - 1); continue }
      const c = w.s.creatures.find((x) => x.id === e.id)
      if (!c) continue
      const seenIt = c.id === pl.id || vis.has(c.pos.y * w.s.map.w + c.pos.x)
      if (!seenIt) continue
      const k = stack.get(c.id) ?? 0
      stack.set(c.id, k + 1)
      this.handleFx(w, e, c, k)
    }
  }

  private handleFx(w: World, e: FxEvent, c: Creature, k: number) {
    const v = this.views.get(c.id) ?? (() => { const nv = this.makeView(w, c); this.views.set(c.id, nv); return nv })()
    const pl = player(w)
    switch (e.k) {
      case 'attack': {
        const t = w.s.creatures.find((x) => x.id === e.target)
        if (t) {
          v.attackVec = { x: Math.sign(t.pos.x - c.pos.x), y: Math.sign(t.pos.y - c.pos.y) }
          v.dir = v.attackVec.x > 0 ? 'right' : v.attackVec.x < 0 ? 'left' : v.attackVec.y < 0 ? 'up' : 'down'
        }
        v.attackT = 0
        break
      }
      case 'dmg': {
        v.flashT = preferences.hitFlash && preferences.animationSpeed > 0 ? 1 : 0
        if (c.id === pl.id && preferences.screenShake && preferences.animationSpeed > 0) this.shake = Math.min(6, 2 + e.v / 6)
        // 내가 준 피해 흰색, 받은 피해 주황 (12 §2.5)
        this.float(c, `${e.v}`, c.id === pl.id ? '#ff9a3a' : '#f2ece0', k, e.crit ? 10 : 8)
        this.spark(c, 0xc02018)
        break
      }
      case 'miss': this.float(c, '빗나감', '#a8a39a', k, 6); break
      case 'block': this.float(c, '막음', '#9fc0e0', k, 6); this.spark(c, 0xd0d8e0); break
      case 'parry': this.float(c, '받아넘김', '#e0d090', k, 6); this.spark(c, 0xf0e0a0); break
      case 'deflect': this.float(c, '튕겨냄', '#c0c8d0', k, 6); this.spark(c, 0xe0e8f0); break
      case 'status': this.float(c, e.text, e.color, k, 6); break
      case 'death': this.float(c, c.id === pl.id ? '사망' : '쓰러짐', '#c03028', k, 7); break
      case 'level': this.float(c, '레벨 업!', '#ffd870', k, 9); this.spark(c, 0xffe080, 14); break
      case 'xp': this.float(c, `+${e.v}`, '#a8a8a0', k, 6); break
      case 'move': break
    }
  }

  private float(c: Creature, text: string, color: string, k: number, size: number) {
    if (preferences.floaters === 'off') return
    size *= preferences.floaters === 'large' ? 1.5 : 1
    const v = this.views.get(c.id)
    const p = v ? this.viewPos(v) : c.pos
    const t = new Text({ text, style: { ...FONT, fontSize: size * 4, fill: color, stroke: { color: '#120c08', width: 6 } }, resolution: 1 })
    t.scale.set(0.25)
    t.anchor.set(0.5, 1)
    t.position.set(p.x * T + T / 2 + (k % 2 ? 4 : -4) * Math.min(1, k), p.y * T + (v ? this.headY(v) + 4 : -18) - (k % 5) * 6)
    this.floatLayer.addChild(t)
    this.floaters.push({ t, vy: -0.022, life: 0, max: 1100 + k * 120 })
  }

  private spark(c: Creature, color: number, n = 6) {
    if (preferences.animationSpeed === 0 || !preferences.hitFlash) return
    const v = this.views.get(c.id)
    const p = v ? this.viewPos(v) : c.pos
    for (let i = 0; i < n; i++) {
      const g = new Graphics().rect(0, 0, 1, 1).fill(color)
      g.position.set(p.x * T + T / 2, p.y * T + T / 2 - 4)
      const ang = (i / n) * Math.PI * 2 + Math.random()
      const sp = 0.03 + Math.random() * 0.04
      this.floatLayer.addChild(g)
      this.floaters.push({ t: g as unknown as Text, vy: Math.sin(ang) * sp - 0.02, life: 0, max: 380, ...{ vx: Math.cos(ang) * sp } } as Floater)
    }
  }

  // ── 커서·대상 ──────────────────────────────────────

  private drawOverlay() {
    const g = this.overlay
    g.clear()
    const corner = (p: Pos, color: number, a = 1) => {
      const x = p.x * T, y = p.y * T, L = 4
      g.moveTo(x, y + L).lineTo(x, y).lineTo(x + L, y)
        .moveTo(x + T - L, y).lineTo(x + T, y).lineTo(x + T, y + L)
        .moveTo(x + T, y + T - L).lineTo(x + T, y + T).lineTo(x + T - L, y + T)
        .moveTo(x + L, y + T).lineTo(x, y + T).lineTo(x, y + T - L)
        .stroke({ color, width: 1, alpha: a })
    }
    for (const p of this.opts.path ?? []) g.rect(p.x * T + 6, p.y * T + 6, 4, 4).fill({ color: 0xe8d8a0, alpha: 0.35 })
    for (const p of this.opts.targets ?? []) corner(p, 0xd04030, 0.8)
    if (this.opts.selected) corner(this.opts.selected, 0xffd060)
    if (this.opts.hover) corner(this.opts.hover, 0xf0e8d0, 0.55)
  }

  // ── 매 프레임 ───────────────────────────────────────

  private tick(dt: number) {
    if (!this.w) return
    const immediate = preferences.animationSpeed === 0
    this.time += dt * preferences.animationSpeed
    const w = this.w
    // 애니 소품
    for (const a of [...this.animated,...this.dynamicAnimated]) {
      const f = a.flame && !preferences.torchFlicker ? 0 : Math.floor((this.time / 1000) * a.fps + a.phase) % a.frames.length
      a.s.texture = a.frames[f]
    }
    // 빛 깜박임
    this.glow.alpha = !immediate && preferences.torchFlicker ? 0.55 + Math.sin(this.time / 140) * 0.04 + Math.sin(this.time / 53) * 0.03 : 0.55
    // 생물
    for (const v of this.views.values()) {
      if (!preferences.hitFlash || immediate) v.flashT = 0
      if (v.body instanceof AnimatedSprite) { v.body.animationSpeed = 0.1 * preferences.animationSpeed; if (immediate) v.body.stop(); else if (!v.body.playing) v.body.play() }
      this.animateView(v, dt * (preferences.animationSpeed || 1))
    }
    // 떠오르는 글자·불꽃
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i] as Floater & { vx?: number }
      f.life += dt
      if (!immediate) f.t.y += f.vy * dt
      if (f.vx && !immediate) { f.t.x += f.vx * dt; f.vy += 0.0002 * dt }
      else f.vy *= 0.985
      f.t.alpha = f.life > f.max * 0.6 ? Math.max(0, 1 - (f.life - f.max * 0.6) / (f.max * 0.4)) : 1
      if (f.life >= f.max) { f.t.destroy(); this.floaters.splice(i, 1) }
    }
    // 카메라
    const pv = this.views.get(w.s.playerId)
    const pp = pv ? this.viewPos(pv) : player(w).pos
    const Wpx = this.app.renderer.width / this.app.renderer.resolution
    const Hpx = this.app.renderer.height / this.app.renderer.resolution
    const s = T * this.zoom
    let tx = Wpx / 2 - (pp.x + 0.5) * s
    // 하단 HUD가 가리는 만큼 플레이어를 화면 세로 중앙보다 1칸 위에 둔다 (12 §2.4)
    let ty = Hpx / 2 - (pp.y + 0.5) * s - s
    const mw = w.s.map.w * s, mh = w.s.map.h * s
    tx = mw < Wpx ? (Wpx - mw) / 2 : Math.min(0, Math.max(Wpx - mw, tx))
    ty = mh < Hpx ? (Hpx - mh) / 2 : Math.min(0, Math.max(Hpx - mh, ty))
    if (!this.camInit) { this.cam = { x: tx, y: ty }; this.camInit = true }
    const k = immediate ? 1 : 1 - Math.pow(0.0001, dt * preferences.animationSpeed / 1000)
    this.cam.x += (tx - this.cam.x) * k
    this.cam.y += (ty - this.cam.y) * k
    let sx = 0, sy = 0
    if (!preferences.screenShake || immediate) this.shake = 0
    if (this.shake > 0.05) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake *= Math.pow(0.002, dt / 1000) }
    this.world.position.set(Math.round(this.cam.x + sx), Math.round(this.cam.y + sy))
    this.drawRain(w, dt)
  }

  private animateView(v: CView, dt: number) {
    if (preferences.animationSpeed === 0) { v.t = 1; v.attackT = -1; v.deadT = v.alive ? -1 : 1 }
    if (v.t < 1) v.t = Math.min(1, v.t + dt / MOVE_MS)
    const p = this.viewPos(v)
    const moving = v.t < 1
    let ox = 0, oy = 0
    // 공격: 캐릭터 시트에 공격 프레임이 있으면 재생, 없으면 대상 쪽으로 찌르듯 튀어나감
    if (v.attackT >= 0) {
      v.attackT += dt / ATTACK_MS
      const a = Math.min(1, v.attackT)
      const lunge = Math.sin(a * Math.PI) * 5
      ox += v.attackVec.x * lunge
      oy += v.attackVec.y * lunge
      if (v.attackT >= 1) v.attackT = -1
    }
    if (v.flashT > 0) {
      v.flashT = Math.max(0, v.flashT - dt / 220)
      ox += (Math.random() - 0.5) * 2 * v.flashT
    }
    const ch = v.char
    if (ch) {
      let frame: string
      if (v.attackT >= 0 && ch.attack) {
        const fr = ch.attack[v.dir]
        frame = fr[Math.min(fr.length - 1, Math.floor(v.attackT * fr.length))]
        v.body.anchor.set(ch.attackAnchor?.[0] ?? 0.5, ch.attackAnchor?.[1] ?? 0.78)
      } else if (moving) {
        const fr = ch.walk[v.dir]
        frame = fr[Math.floor(v.t * 3) % fr.length]
        v.body.anchor.set(ch.anchor[0], ch.anchor[1])
      } else {
        frame = ch.idle[v.dir][0]
        v.body.anchor.set(ch.anchor[0], ch.anchor[1])
      }
      v.body.texture = tex(frame)
    }
    // 절뚝임: 걸음 후반에 1px 주저앉는다
    const hop = moving ? -Math.sin(v.t * Math.PI) * 1.5 + (v.limp && v.t > 0.5 ? 1 : 0) : 0
    const breathe = preferences.animationSpeed > 0 && !moving && v.alive && !v.mechanical ? 1 + Math.sin((this.time + v.zzT) / 420) * 0.018 : 1
    v.root.position.set(p.x * T + T / 2 + ox, p.y * T + T - 2 + oy + hop)
    v.root.zIndex = (p.y + 1) * T + (v.alive ? 0.2 : -8)
    if (v.char || v.anim) v.body.scale.set(v.scale, v.scale * breathe*(v.crouched ? .78 : 1))
    // 피격 섬광 → 사망 → 시체
    if (!v.alive) {
      v.deadT = Math.min(1, v.deadT + dt / 380)
      v.body.rotation = (Math.PI / 2) * v.deadT * (v.id % 2 ? 1 : -1)
      v.body.tint = v.unknown ? 0x202028 : 0x705050
      v.body.alpha = 1 - v.deadT * 0.25
      v.shadow.alpha = 1 - v.deadT
      v.bar.visible = false
      v.marks.visible = false
    } else {
      v.body.tint = v.unknown ? 0x202028 : v.flashT > 0.5 ? 0xffffff : v.flashT > 0 ? 0xff7060 : 0xffffff
      if (!v.unknown && v.flashT > 0.5) v.body.tint = 0xffb0a0
    }
    // 잠든 적: Zz
    if (v.alive && this.w) {
      const c = this.w.s.creatures.find((x) => x.id === v.id)
      if (c?.asleep && v.root.visible) {
        v.zzT += dt
        if (v.zzT > 1400) {
          v.zzT = 0
          this.float(c, 'z', '#b8c4d8', 0, 6)
        }
      }
    }
  }

  private drawRain(w: World, _dt: number) {
    const g = this.rain
    g.clear()
    if(w.s.map.fog){const f=w.s.map.fog;g.rect(0,0,this.app.renderer.width/this.app.renderer.resolution,this.app.renderer.height/this.app.renderer.resolution).fill({color:f.color,alpha:f.opacity})}
    const snow = w.s.overworld && w.s.weather === 'ashsnow', gale = w.s.overworld && w.s.weather === 'ashgale'
    if (w.s.map.kind === 'surface' && w.s.overworld && w.s.weather === 'frostfog') { g.rect(0, 0, this.app.renderer.width / this.app.renderer.resolution, this.app.renderer.height / this.app.renderer.resolution).fill({ color: 0x8c9a9c, alpha: .12 }); return }
    if (w.s.map.kind !== 'surface' || !isRaining(w) && !snow && !gale) return
    const W = this.app.renderer.width / this.app.renderer.resolution
    const H = this.app.renderer.height / this.app.renderer.resolution
    const n = w.s.overworld && weatherDef(w).group === 'storm' ? 240 : 140
    for (let i = 0; i < n; i++) {
      const seed = hash(i, 7)
      const x = (seed % 2000) / 2000 * W
      const y = (((seed >>> 11) % 1000) / 1000 * H + this.time * (snow ? .06 + (seed % 7) / 200 : .5 + (seed % 7) / 20)) % H
      if (snow) g.rect(x, y, 2, 2)
      else if (gale) g.moveTo(x, y).lineTo(x + 18, y + 2)
      else g.moveTo(x - (y % 3), y).lineTo(x - 3 - (y % 3), y + 10)
    }
    if (snow) g.fill({ color: 0xbabfc4, alpha: .6 })
    else g.stroke({ color: gale ? 0xa89d86 : 0x9aa0a8, width: 1, alpha: gale ? .4 : .28 })
  }

  /** 디버그: 플레이어 HP 감소 비율 (화면 가장자리 붉은 기운용) */
  dangerLevel(w: World): number {
    const pl = player(w)
    return Math.max(1 - pl.hp / hpMax(w, pl), bloodLoss(pl) * 2)
  }
}
