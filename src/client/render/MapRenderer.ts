import {camouflageActive} from '../../core/camouflage'
import {SwarmView} from './swarm-view'
import {validSwarmRule} from '../../core/swarm-state'
import {RigOwner} from './rig-owner'
import {CrawlerView,type CrawlerPartState} from './crawler-view'
import {crawlerPartIds} from './crawler-spec'
import {CullerView,type CullerPartState} from './culler-view'
import {cullerPartIds} from './culler-spec'
import {mapAppearance,displayTile} from '../map-memory'
import {creatureSprite} from './creature-sprite'
import {groundObjectArt,isGroundCrop} from './terrain-art'
import {treeArt} from './forest-art'
import {livingTreeArt} from './living-art'
import {cropArt} from './crop-art'
import {forageArt} from './forage-art'
import {projectVisibleFog} from './projected-fog'
import {advanceWalk,createWalkMotion,observeWalk,resetWalk,walkPosition,walking,type WalkMotion} from './walk-motion'
import {spritePixelHit} from './sprite-hit'
import {advancePose,clearPoses,createPoseClock,motionDurations,poseDuration,poseFrame,posePriority,requestPose,type MotionName,type PoseClock,type PoseCue} from './character-motion'
import {attackBodyPhase,attackDuration,attackStyle,actionStage,equipmentSpec,equipmentTipReach,heldPose,supportHand,type HeldEquipment,type EquipmentAction} from './equipment-motion'
import {activityMotion,takeActionPresentations} from './action-presentation'
import {isMedicalActivity,medicalPresentation,medicalPropAngle,type MedicalPresentation} from './medical-presentation'
import medicalGripData from './medical-grips.json'
import heldGripData from './held-grips.json'
import {medicalGripPosition} from './medical-motion'
// 다크 판타지 맵 렌더러 (Pixi 8)
// 층: 바닥 → 장식·피 → 벽 → [물체·생물 y정렬] → 빛(가산) → 어둠(부드러운 시야) → 커서·대상 → 떠오르는 글자
// 코어 상태는 읽기만 한다. 연출은 w.s.fx 이벤트를 소비해서 만든다.

import {
  AnimatedSprite, Application, Container, Graphics, Sprite, Text, Texture, TextureStyle, type TextStyleOptions,
} from 'pixi.js'
import {
  hostile,crouched, beddingScorch,bestiaryEntry, bestiaryStage, bloodLoss, hpMax, isRaining, weatherDef, lightAt, lightSource, hasLos, itemDef, player, regionState, sightRange, totalBleed, turnOf, hasEffect,
  meleeWield,wield,isMissing,partDamage,partEff,cullerCooling,type Creature, type FxEvent, type Pos, type World,
} from '../../core'
import { paletteColor, preferences } from '../preferences'
import {cullerArt,crawlerArt,swarmArt, atlasStats,animFrames, chars, hasFrame, icon, sub, tex, type CharDef, type Dir } from './atlas'

export const T = 16
type MedicalGrip={point:number[];color:number}
const medicalGrips=medicalGripData.frames as Record<string,{main:MedicalGrip|null;off:MedicalGrip|null}>
const heldGrips=heldGripData.frames as Record<string,{main:MedicalGrip|null;off:MedicalGrip|null}>
const sceneKey=(w:World)=>(w.s.overworld?.currentRegion??'local')+':'+w.s.map.id

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
  rig:RigOwner|null
  crawler:CrawlerView|null
  crawlerParts:Record<string,CrawlerPartState>
  crawlerMode:'floor'|'ceiling'
  crawlerHeading:number
  culler:CullerView|null
  cullerParts:Record<string,CullerPartState>
  cullerCooling:boolean
  rigMix:number
  rigWasActive:boolean
  body: Sprite
  previousBody:Sprite
  actionItem:Sprite
  medicalItems:[Sprite,Sprite]
  medical:MedicalPresentation|null
  pose:PoseClock
  arrivingPose:{cue:PoseCue;pos:Pos;map:string;direction:Dir;continuous:boolean}|null
  poseName:MotionName
  poseFrame:string
  poseDirection:Dir
  transition:number
  flightHeight:number
  flightLift:number
  asleep:boolean
  prone:boolean
  groundT:number
  activity:MotionName|null
  activityTime:number
  held:[boolean,boolean]
  equipment:[HeldEquipment|null,HeldEquipment|null]
  handsBusy:boolean
  equipmentAge:[number,number]
  gearEffects:Graphics
  gripCovers:Graphics
  guarding:boolean
  annotationHead:number
  poseWasCue:boolean
  hands:[Sprite,Sprite]
  shadow: Graphics
  bar: Graphics
  marks: Graphics
  char?: CharDef
  anim?: Texture[]
  motion:WalkMotion
  lightPos:Pos
  dir: Dir
  attackT: number
  attackVec: Pos
  attackDistance:number
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
  hudHeight?: number
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
  private swarmLayer=new Container()
  private swarmViews=new Map<number,SwarmView>()
  private glow!: Sprite
  private dark!: Sprite
  private overlay = new Graphics()
  private floatLayer = new Container()
  private rain = new Graphics()
  private darkCanvas = document.createElement('canvas')
  private shadeCanvas = document.createElement('canvas')
  private glowCanvas = document.createElement('canvas')
  private views = new Map<number, CView>()
  private floaters: Floater[] = []
  private animated: PropAnimation[] = []
  private dynamicAnimated: PropAnimation[] = []
  private flames: { s: Sprite; base: number; phase: number }[] = []
  private renderedMap: World['s']['map'] | null = null
  private renderedTerrain: (string|undefined)[] = []
  private displayVisible:ReadonlySet<number>=new Set()
  private staticFogProps:{index:number;sprite:Sprite}[]=[]
  private dynamicFogProps:{index:number;sprite:Sprite}[]=[]
  private forageViews:{pos:Pos;terrain:string;frame:string;state:string;variant:number;scale:number;visible:boolean;observedAt?:number}[]=[]
  private fixedLevels=new Float32Array()
  private fixedGlow=new Uint8ClampedArray()
  private lightMasks=new Map<string,Uint8Array>()
  private lightKey=''
  private cam = { x: 0, y: 0 }
  private camInit = false
  private zoom = 3
  private time = 0
  private w: World | null = null
  private opts: RenderOpts = {}
  private shake = 0
  private ready = false
  onPlayerMotion: (moving:boolean) => void = () => {}
  private playerMoving=false
  onHover: (p: Pos | null) => void = () => {}
  onClick: (p: Pos, button: number, ctrl: boolean) => void = () => {}

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
    this.world.addChild(this.ground, this.deco, this.walls, this.dyn, this.objs, this.swarmLayer, this.glow, this.dark, this.overlay, this.floatLayer)
    this.app.stage.addChild(this.world, this.rain)
    const cv = this.app.canvas
    cv.addEventListener('pointermove', (e) => this.onHover(this.creatureAtPointer(e)??this.tileAt(e)))
    cv.addEventListener('pointerleave', () => this.onHover(null))
    cv.addEventListener('pointerdown', (e) => { const p = this.creatureAtPointer(e)??this.tileAt(e); if (p) this.onClick(p, e.button, e.ctrlKey || e.metaKey) })
    cv.addEventListener('contextmenu', (e) => e.preventDefault())
    this.app.ticker.add((tk) => this.tick(tk.deltaMS))
    this.ready = true
    if (this.w) this.sync(this.w)
  }

  destroy() {
    this.ready = false
    for(const v of this.views.values())this.destroyView(v)
    this.views.clear()
    this.app.destroy(true, { children: true })
  }

  private destroyView(v:CView){v.culler?.destroy();v.crawler?.destroy();v.rig?.destroy();v.root.destroy({children:true})}

  private tileAt(e: PointerEvent): Pos | null {
    const r = this.app.canvas.getBoundingClientRect()
    const sx = e.clientX - r.left, sy = e.clientY - r.top
    const x = Math.floor((sx - this.world.x) / (T * this.zoom))
    const y = Math.floor((sy - this.world.y) / (T * this.zoom))
    const w = this.w
    if (!w || x < 0 || y < 0 || x >= w.s.map.w || y >= w.s.map.h) return null
    return { x, y }
  }

  private creatureAtPointer(e:PointerEvent):Pos|null{
    const w=this.w;if(!w)return null
    const rect=this.app.canvas.getBoundingClientRect(),point={x:e.clientX-rect.left,y:e.clientY-rect.top}
    const visible=[...this.views.values()].filter(view=>view.root.visible).sort((a,b)=>b.root.zIndex-a.root.zIndex)
    for(const view of visible){
      const actor=w.s.creatures.find(actor=>actor.id===view.id)
      if(!actor||actor.id!==w.s.playerId&&!this.displayVisible.has(actor.pos.y*w.s.map.w+actor.pos.x))continue
      if(!view.culler?.hit(point)&&!view.crawler?.hit(point)&&!view.rig?.hit(point)&&![view.body,...view.hands].some(sprite=>spritePixelHit(sprite,point)))continue
      // An opaque prop drawn in front still owns its visible pixels.
      if(this.objs.children.some(child=>child instanceof Sprite&&child.zIndex>view.root.zIndex&&child.visible&&child.alpha>=.95&&spritePixelHit(child,point)))return null
      return{...actor.pos}
    }
    return null
  }

  setOpts(o: RenderOpts) {
    const hudChanged = this.opts.hudHeight !== o.hudHeight
    const previousHover=this.opts.hover
    this.opts = o
    if (hudChanged && preferences.mapZoom === 'vision' && this.w && this.ready) this.sync(this.w)
    this.drawOverlay()
    if(this.w&&(previousHover?.x!==o.hover?.x||previousHover?.y!==o.hover?.y))for(const c of this.w.s.creatures)if(c.pos.x===previousHover?.x&&c.pos.y===previousHover?.y||c.pos.x===o.hover?.x&&c.pos.y===o.hover?.y){const view=this.views.get(c.id);if(view?.root.visible)this.drawBar(this.w,c,view)}
  }

  /** 행동 후 호출: 정적 층(필요 시)·동적 층·빛·생물·연출 갱신 */
  sync(w: World) {
    this.w = w
    if (!this.ready) return
    // 기본 배율은 유지한다. 전체 시야 맞춤/수동 배율도 항상 정수 픽셀을 사용한다.
    const H = this.app.renderer.height / this.app.renderer.resolution
    const W = this.app.renderer.width / this.app.renderer.resolution
    const usable = H - (this.opts.hudHeight ? Math.min(H * .45, this.opts.hudHeight) + 24 : 0)
    const p = player(w), diameter = 2 * Math.max(w.db.creature(p.def).sightRange, sightRange(w, p)) + 1
    const mode = preferences.mapZoom
    const zoom = mode === 'auto' ? Math.max(1, Math.floor(H / 360)) : mode === 'vision' ? Math.max(1, Math.min(4, Math.floor(Math.min(W, usable) / (T * diameter)))) : mode
    if (zoom !== this.zoom) this.camInit = false
    this.zoom = zoom
    this.world.scale.set(this.zoom)
    const mapChanged = w.s.map !== this.renderedMap
    const appearance=mapAppearance(w)
    this.displayVisible=appearance.visible
    const terrainChanged = mapChanged || appearance.terrain.some((id,i)=>id!==this.renderedTerrain[i])
    if (mapChanged) {
      for(const view of this.swarmViews.values())view.destroy();this.swarmViews.clear()
      for (const v of this.views.values()) this.destroyView(v)
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
    this.syncCreatures(w)
    const colonyIds=new Set<number>()
    for(const colony of w.s.map.swarms??[]){const d=validSwarmRule(w,colony);if(!d)continue;colonyIds.add(colony.uid);let view=this.swarmViews.get(colony.uid);if(!view){view=new SwarmView(colony,swarmArt(d.sprite));this.swarmLayer.addChild(view.root);this.swarmViews.set(colony.uid,view)}view.sync(w,colony,this.displayVisible,w.s.fx.filter(e=>e.k==='move'&&e.id===colony.uid) as {from:Pos;to:Pos}[])}
    for(const [id,view]of this.swarmViews)if(!colonyIds.has(id)){view.destroy();this.swarmViews.delete(id)}
    this.updateLight(w)
    const resolvedAttacks=new Set(w.s.fx.filter(event=>event.k==='attack').map(event=>event.id))
    this.consumeFx(w)
    for(const cue of takeActionPresentations(w,resolvedAttacks)){
      const view=this.views.get(cue.actor)
      if(!view?.root.visible||!view.alive||view.prone)continue
      if(cue.kind==='use'&&resolvedAttacks.has(cue.actor)&&view.pose.current?.kind==='use'&&view.pose.current.prop&&view.pose.current.equipment?.weapon)continue
      if(cue.direction)view.dir=cue.direction
      if(cue.kind==='throw'&&resolvedAttacks.has(cue.actor)&&view.pose.current?.kind==='throw'){view.pose.current.prop=cue.prop;continue}
      const duration=view.char?.motionDurations?.[cue.kind]
      if(preferences.animationSpeed!==0&&walking(view.motion)&&['work','use','interact','wallow'].includes(cue.kind)){
        if(view.pose.current&&posePriority(cue.kind)<posePriority(view.pose.current.kind))continue
        const actor=w.s.creatures.find(c=>c.id===cue.actor)!
        view.arrivingPose={cue:{kind:cue.kind,elapsed:0,prop:cue.prop,duration,machineTask:cue.machineTask},pos:{...actor.pos},map:sceneKey(w),direction:cue.direction??DIR_OF_FACING[actor.facing]??view.dir,continuous:cue.kind==='work'&&activityMotion(actor.activity)==='work'}
      }else requestPose(view.pose,cue.kind,cue.prop,{duration,machineTask:cue.machineTask})
    }
    this.notifyPlayerMotion()
    this.drawOverlay()
  }

  // ── 정적: 바닥·벽·장식·고정 물체 ─────────────────────────

  private clear(c: Container) {
    for (const ch of c.removeChildren()) ch.destroy({ children: true })
  }

  private buildStatic(w: World) {
    this.staticFogProps=[]
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
          s.width=T;s.height=T
          s.position.set(px, py)
          if (ruin) s.tint = 0xa89c88
          this.walls.addChild(s)
        } else {
          const s = new Sprite(tex('wall_top'))
          s.width=T;s.height=T
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
    if(terrain.id==='Terrain.BoatFrame'){
      const texture=tex('water_shallow'),cell=texture.width>=256?texture.width/8:0
      const s=new Sprite(cell?sub('water_shallow',(x&7)*cell,(y&7)*cell,cell,cell):icon('water_shallow'))
      s.width=T;s.height=T;if(cell)s.tint=0xabb9bd
      return s
    }
    if(terrain.floor==='deck')return new Sprite(tex(`deck${h%3}`))
    if (t === 'Terrain.CdFloor') {
      const s = new Sprite(tex(`cd_floor${h % 20}`))
      s.width=T;s.height=T
      if(s.texture.width>16)s.tint=0x969ba0
      return s
    }
    if ((surface||terrain.water||terrain.floor==='earth') && t !== 'Terrain.KtFloor' && t !== 'Terrain.Rubble' && !terrain.stairs) {
      let name: string
      if (terrain.water) name = terrain.water==='deep'?'water_deep':'water_shallow'
      else if (t === 'Terrain.Mud'||t==='Terrain.BogMud'||t==='Terrain.CoastalMud') name = `mud${h%4}`
      else if (t === 'Terrain.Path') name = `dirt${h % 3}`
      else if (!surface) name = `dirt${h%3}`
      else name = h % 9 === 0 ? `grassdirt${(h>>>4)%3}` : `grass${(h>>>3)%3}`
      const texture=tex(name)
      const cell=texture.width>=256?texture.width/8:0
      const s = new Sprite(cell?sub(name,(x&7)*cell,(y&7)*cell,cell,cell):icon(name))
      s.width = T; s.height = T
      // 같은 결의 풀을 미세한 명도 차로만 흩뜨려 바둑판 무늬를 피한다
      const k = 0xf4 + (h % 10)
      s.tint = terrain.water || name.startsWith('mud') ? 0xffffff : (k << 16) | ((k + 2) << 8) | (k - 3)
      if(cell)s.tint=terrain.water?0xabb9bd:0xb5b6ad
      if(terrain.water&&cell){
        // Only known displayed neighbors shape the bank; unseen terrain stays private.
        const land=(dx:number,dy:number)=>{
          const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w.s.map.w||ny>=w.s.map.h)return false
          const id=this.renderedTerrain[ny*w.s.map.w+nx];return !!id&&!w.db.terrain(id).water
        }
        const north=land(0,-1),east=land(1,0),south=land(0,1),west=land(-1,0)
        if(north||east||south||west){
          const box=new Container(),mud=tex('mud0'),unit=mud.width>=256?mud.width/8:0
          const bank=new Sprite(unit?sub('mud0',(x&7)*unit,(y&7)*unit,unit,unit):mud);bank.width=T;bank.height=T;bank.tint=0xaaa69b
          const l=west?1.6:0,r=east?T-1.6:T,t=north?1.6:0,b=south?T-1.6:T
          const nw=north&&west?1.5:0,ne=north&&east?1.5:0,se=south&&east?1.5:0,sw=south&&west?1.5:0
          const mask=new Graphics().poly([l+nw,t,(l+r)/2,t+(north?(h&1)*.4:0),r-ne,t,r,t+ne,r,(t+b)/2,r,b-se,r-se,b,(l+r)/2,b-(south?((h>>>1)&1)*.4:0),l+sw,b,l,b-sw,l,(t+b)/2,l,t+nw]).fill(0xffffff)
          box.addChild(bank,s,mask);s.mask=mask;return box
        }
      }
      return s
    }
    // KT 석판: 8×8칸 블록마다 사분면을 고르고 그 안을 16px로 샘플링 → 이음매 없는 큰 무늬
    const q = hash(x >> 3, y >> 3) % 4
    const key=`kt_floor_q${q}`,cell=tex(key).width/8
    const s = new Sprite(sub(key,(x&7)*cell,(y&7)*cell,cell,cell))
    s.width=T;s.height=T
    if(cell>16)s.tint=0x969ba0
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
      if(terr.opaque)this.staticFogProps.push({index:y*w.s.map.w+x,sprite:s})
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
        const art=treeArt(terr.sprites,h),texture=tex(art.sprite)
        const s = add(new Sprite(texture), art.anchor[0], art.anchor[1])
        const scale=art.scale??art.worldHeight!/texture.height
        s.scale.set(art.flip?-scale:scale,scale)
        s.position.set(px + T / 2, py + T)
        s.tint = art.tint
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
    this.dynamicFogProps=[]
    this.forageViews=[]
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
      if(tile.cropResidue&&vis.has(i)){const residue=new Sprite(tex('av_soil_residue_v315'));residue.width=T;residue.height=T;residue.position.set(px,py);this.dyn.addChild(residue)}
      let s: Sprite | null = null
      const forage=forageArt(terr,tile),crop=cropArt(terr,tile,vis.has(i),turnOf(w))
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
      if(forage){
        s=new Sprite(tex(forage.sprite));s.anchor.set(...forage.anchor);s.position.set(px+T/2,py+T);s.scale.set(forage.scale)
        this.forageViews.push({pos:{x,y},terrain:terr.id,frame:forage.sprite,state:forage.state,variant:forage.variant,scale:forage.scale,visible:vis.has(i),observedAt:tile.observed?.terrain===terr.id?tile.observed.at:undefined})
      }else if(crop){
        const texture=tex(crop.sprite);s=new Sprite(texture);s.anchor.set(.5,1);s.position.set(px+T/2,py+T);s.scale.set(crop.worldHeight/texture.height)
      } else if (groundArt&&!terr.bedding) {
        s=new Sprite(tex(groundArt));s.anchor.set(.5,1);s.position.set(px+T/2,py+T)
        if(isGroundCrop(terr))s.scale.set(terr.gather&&(tile.cultivation?tile.cultivation.growth<terr.gather.regrowTurns:(tile.gatherAt??0)>turnOf(w))?.6:1)
      } else if (terr.visual) {
        const art=livingTreeArt(terr,h),texture=tex(art?.sprite??terr.visual.sprite)
        s=new Sprite(texture);s.anchor.set(...(art?.anchor??[.5,.96] as [number,number]));s.position.set(px+T/2,py+T)
        s.scale.set((art?art.worldHeight/texture.height:terr.visual.scale)*(terr.gather&&(tile.cultivation?tile.cultivation.growth<terr.gather.regrowTurns:(tile.gatherAt??0)>turnOf(w))?.6:1))
        if(!art&&terr.visual.tint!==undefined)s.tint=terr.visual.tint
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
      if (s) { s.zIndex = py + T - 0.5; s.label = 'dyn'; this.objs.addChild(s);if(terr.opaque)this.dynamicFogProps.push({index:i,sprite:s}) }
      if (tile.items.length && vis.has(i)) {
        const it = tile.items[tile.items.length - 1]
        const ic = new Sprite(icon(w.db.item(it.def).sprite))
        ic.scale.set(12/Math.max(ic.texture.width,ic.texture.height))
        ic.position.set(px+(T-ic.width)/2,py+T-2-ic.height)
        const sh = new Graphics().ellipse(px + 8, py + 14, 5, 1.6).fill({ color: 0x000000, alpha: 0.4 })
        this.dyn.addChild(sh, ic)
        if (tile.items.length > 1) this.dyn.addChild(new Graphics().rect(px + 12, py + 2, 2, 2).fill(0xe8d080))
      }
    }
  }

  // ── 빛·어둠: 타일당 1px 캔버스를 선형 확대해서 부드럽게 ────

  private updateLight(w: World) {
    const map=w.s.map,visible=this.displayVisible
    // Fixed lighting is sampled through a read-only context; original actors stay untouched.
    const fixed:World={db:w.db,s:{...w.s,creatures:[]}}
    this.fixedLevels=new Float32Array(map.w*map.h)
    this.fixedGlow=new Uint8ClampedArray(map.w*map.h*4)
    this.lightMasks.clear();this.lightKey=''
    for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)if(visible.has(y*map.w+x))this.fixedLevels[y*map.w+x]=lightAt(fixed,{x,y})
    for(const source of map.lights){
      if(source.off||!visible.has(source.pos.y*map.w+source.pos.x))continue
      const color=source.kind==='taint'?[150,40,70]:[255,140,60]
      for(let y=Math.max(0,source.pos.y-source.radius);y<=Math.min(map.h-1,source.pos.y+source.radius);y++)for(let x=Math.max(0,source.pos.x-source.radius);x<=Math.min(map.w-1,source.pos.x+source.radius);x++){
        const i=y*map.w+x,d=Math.hypot(x-source.pos.x,y-source.pos.y)
        if(d>source.radius||!visible.has(i)||!hasLos(w,source.pos,{x,y}))continue
        const k=(1-d/source.radius)*.55,o=i*4
        for(let c=0;c<3;c++)this.fixedGlow[o+c]=Math.min(255,this.fixedGlow[o+c]+color[c]*k)
        this.fixedGlow[o+3]=255
      }
    }
    this.drawLight(w,true)
  }

  /** Carried light, feet and camera sample the same presentation position each frame. */
  private drawLight(w:World,force=false){
    const map=w.s.map,vis=this.displayVisible
    const carriers=w.s.creatures.flatMap(c=>{
      if(!c.alive)return[]
      const light=lightSource(w,c);if(!light)return[]
      const view=this.views.get(c.id),shown=!!view?.root.visible
      const position=shown?view!.lightPos:c.pos
      const from=shown?view!.motion.from:c.pos,to=shown?view!.motion.to:c.pos
      return[{id:c.id,logical:c.pos,position,from,to,radius:light.radius,shown}]
    })
    const key=carriers.map(c=>`${c.id}:${c.position.x.toFixed(4)},${c.position.y.toFixed(4)}:${c.radius}`).join('|')
    if(!force&&key===this.lightKey)return
    this.lightKey=key
    for(const cv of [this.shadeCanvas,this.glowCanvas])if(cv.width!==map.w||cv.height!==map.h){cv.width=map.w;cv.height=map.h}
    const dc=this.shadeCanvas.getContext('2d')!,gc=this.glowCanvas.getContext('2d')!,dimg=dc.createImageData(map.w,map.h),gimg=gc.createImageData(map.w,map.h)
    const levels=this.fixedLevels.slice();gimg.data.set(this.fixedGlow)
    for(const source of carriers){
      const {position,radius,from,to,logical}=source
      const maskKey=`${source.id}:${from.x},${from.y}:${to.x},${to.y}:${logical.x},${logical.y}:${radius}`
      let mask=this.lightMasks.get(maskKey)
      if(!mask){
        mask=new Uint8Array(map.w*map.h)
        const left=Math.max(0,Math.floor(Math.min(from.x,to.x)-radius-1)),right=Math.min(map.w-1,Math.ceil(Math.max(from.x,to.x)+radius+1))
        const top=Math.max(0,Math.floor(Math.min(from.y,to.y)-radius-1)),bottom=Math.min(map.h-1,Math.ceil(Math.max(from.y,to.y)+radius+1))
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
          const i=y*map.w+x,p={x,y}
          if(vis.has(i)&&hasLos(w,logical,p)&&hasLos(w,from,p)&&hasLos(w,to,p))mask[i]=1
        }
        this.lightMasks.set(maskKey,mask)
      }
      for(let y=Math.max(0,Math.floor(position.y-radius-1));y<=Math.min(map.h-1,Math.ceil(position.y+radius+1));y++)for(let x=Math.max(0,Math.floor(position.x-radius-1));x<=Math.min(map.w-1,Math.ceil(position.x+radius+1));x++){
        const i=y*map.w+x;if(!mask[i])continue
        const d=Math.hypot(x-position.x,y-position.y);if(d>radius+1)continue
        levels[i]=Math.max(levels[i],d<=radius?.7+.3*(1-d/(radius+1)):.55)
        if(source.shown&&d<radius){const k=(1-d/radius)*.30,o=i*4;for(const[c,color]of [255,153,76].entries())gimg.data[o+c]=Math.min(255,gimg.data[o+c]+color*k);gimg.data[o+3]=255}
      }
    }
    for(let i=0;i<map.tiles.length;i++){
      const alpha=vis.has(i)?Math.max(0,Math.min(.55,.6-levels[i])):map.tiles[i].seen?.74:1,o=i*4
      dimg.data[o]=4;dimg.data[o+1]=4;dimg.data[o+2]=8;dimg.data[o+3]=Math.round(alpha*255)
    }
    dc.putImageData(dimg,0,0);gc.putImageData(gimg,0,0)
    const projected=[...this.staticFogProps,...this.dynamicFogProps].filter(row=>vis.has(row.index)&&row.sprite.height>T).sort((a,b)=>a.sprite.zIndex-b.sprite.zIndex)
    const width=map.w*(projected.length?T:1),height=map.h*(projected.length?T:1)
    if(this.darkCanvas.width!==width||this.darkCanvas.height!==height){this.darkCanvas.width=width;this.darkCanvas.height=height}
    const full=this.darkCanvas.getContext('2d')!;full.clearRect(0,0,width,height)
    if(!projected.length)full.putImageData(dimg,0,0)
    else{full.imageSmoothingEnabled=true;full.drawImage(this.shadeCanvas,0,0,width,height);for(const row of projected)projectVisibleFog(full,row.sprite,dimg.data[row.index*4+3]/255)}
    for(const[sprite,canvas]of [[this.dark,this.darkCanvas],[this.glow,this.glowCanvas]]as const){
      if(sprite.texture.source.pixelWidth!==canvas.width||sprite.texture.source.pixelHeight!==canvas.height){sprite.texture.destroy(true);sprite.texture=Texture.from(canvas,true);sprite.texture.source.scaleMode='linear'}
      else sprite.texture.source.update()
      sprite.width=map.w*T;sprite.height=map.h*T
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
      const transform=ch.frameTransforms?.[ch.idle.down[0]]
      body.anchor.set(...(transform?.anchor??ch.anchor))
      scale = transform?.scale??ch.renderScale??0.72
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
    const hands:[Sprite,Sprite]=[new Sprite(Texture.EMPTY),new Sprite(Texture.EMPTY)]
    for(const hand of hands){hand.anchor.set(.5,.78);hand.visible=false}
    const previousBody=new Sprite(Texture.EMPTY),actionItem=new Sprite(Texture.EMPTY),medicalItems:[Sprite,Sprite]=[new Sprite(Texture.EMPTY),new Sprite(Texture.EMPTY)]
    for(const item of medicalItems)item.visible=false
    const gearEffects=new Graphics(),gripCovers=new Graphics()
    previousBody.visible=false;actionItem.visible=false;actionItem.anchor.set(.5,.65)
    root.sortableChildren=true;shadow.zIndex=-5;previousBody.zIndex=0;body.zIndex=1;gearEffects.zIndex=2;gripCovers.zIndex=5;actionItem.zIndex=6;bar.zIndex=8;marks.zIndex=9
    root.addChild(shadow,previousBody,body,gearEffects,...hands,...medicalItems,gripCovers,actionItem,bar,marks)
    this.objs.addChild(root)
    const initiallyStanding=!!ch?.rig&&c.alive&&!c.asleep&&!c.unconscious&&!hasEffect(c,'knockedDown',turnOf(w))
    const v: CView = {
      id: c.id, selectedSprite, root, rig:ch?.rig?new RigOwner(ch.rig):null,crawler:ch?.crawler?new CrawlerView(crawlerArt(ch.crawler)):null,crawlerParts:{},culler:ch?.culler?new CullerView(cullerArt(ch.culler)):null,cullerParts:{},cullerCooling:false,crawlerMode:c.crawlerState?.mode??'floor',crawlerHeading:c.facing*Math.PI/4-Math.PI/2,rigMix:initiallyStanding?1:0,rigWasActive:initiallyStanding,body,previousBody,actionItem,medicalItems,medical:null,pose:createPoseClock(),arrivingPose:null,poseName:'idle',poseFrame:'',poseDirection:'down',transition:0,flightHeight:c.flight?(w.db.creature(c.def).flight?.height??0)*T:0,flightLift:c.flight?(w.db.creature(c.def).flight?.height??0)*T:0,asleep:!!c.asleep,prone:!!(c.asleep||c.unconscious||hasEffect(c,'knockedDown',turnOf(w))),groundT:1,activity:activityMotion(c.activity),activityTime:0,held:[false,false],equipment:[null,null],equipmentAge:[0,0],handsBusy:false,gearEffects,gripCovers,guarding:false,annotationHead:0,poseWasCue:false,hands, shadow, bar, marks, char: ch, anim, motion:createWalkMotion(c.pos),lightPos:{...c.pos},
      dir: DIR_OF_FACING[c.facing] ?? 'down', attackT: -1, attackVec: { x: 0, y: 0 },attackDistance:1, flashT: 0, deadT: c.alive ? -1 : 1,
      alive: c.alive, mechanical:!!c.body.machine, crouched:crouched(w,c), unknown: false, scale, zzT: (c.id * 37) % 1000, limp: false,
    }
    if(v.rig){v.rig.root.zIndex=1;root.addChild(v.rig.root);v.rig.update(v.dir,{x:c.pos.x*T,y:c.pos.y*T},null,0,true);v.rig.root.visible=initiallyStanding;body.visible=!initiallyStanding}
    if(v.crawler){v.crawler.root.zIndex=1;root.addChild(v.crawler.root);body.visible=false;shadow.visible=false}
    if(v.culler){v.culler.root.zIndex=1;root.addChild(v.culler.root);body.visible=false;shadow.visible=false}
    root.position.set(c.pos.x*T+T/2,c.pos.y*T+T-2)
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
      const wasShown = !!v?.root.visible
      if (!shown) {
        // 시체를 포함한 동적 개체는 현재 관찰 범위에서만 그린다. 숨은 개체의
        // 사망/이동/장비·표식 변화로 이전에 만든 뷰를 갱신하지 않는다.
        if (v) { v.root.visible = false; seen.add(c.id) }
        continue
      }
      if (v && v.selectedSprite !== creatureSprite(w,c)) { this.destroyView(v);this.views.delete(c.id);v=undefined }
      if (!v) { v = this.makeView(w, c); this.views.set(c.id, v) }
      if(c.body.machine){const active=chars[v.selectedSprite];v.char=active?.motions?.fall||active?.culler?active:chars[(!c.alive||c.unconscious?w.db.creature(c.def).dormantChar:undefined)??v.selectedSprite]}
      seen.add(c.id)
      v.root.visible = true
      const moves=w.s.fx.filter((e):e is Extract<FxEvent,{k:'move'}>=>e.k==='move'&&e.id===c.id)
      if(v.arrivingPose&&(!c.alive||c.asleep||c.unconscious||sceneKey(w)!==v.arrivingPose.map||c.pos.x!==v.arrivingPose.pos.x||c.pos.y!==v.arrivingPose.pos.y))v.arrivingPose=null
      const altitude=c.alive&&c.flight?(w.db.creature(c.def).flight?.height??0)*T:0
      if(altitude&&!v.flightHeight){clearPoses(v.pose);v.arrivingPose=null}
      v.flightHeight=altitude
      if(!wasShown){v.rig?.reset();v.crawler?.reset();v.culler?.reset();resetWalk(v.motion,c.pos);v.lightPos={...c.pos};clearPoses(v.pose);v.arrivingPose=null;v.transition=0}
      else if(c.id!==pl.id&&moves.some(move=>![move.from,move.to].every(p=>vis.has(p.y*w.s.map.w+p.x)))){v.rig?.reset();v.crawler?.reset();v.culler?.reset();resetWalk(v.motion,c.pos);v.lightPos={...c.pos}}
      else observeWalk(v.motion,c.pos,moves)
      if(v.crawler){v.crawlerMode=c.crawlerState?.mode??'floor';v.crawlerHeading=c.facing*Math.PI/4-Math.PI/2;v.crawlerParts=Object.fromEntries(crawlerPartIds.map(id=>[id,{missing:isMissing(w,c,id),damage:Math.max(0,Math.min(1,partDamage(c,id)/Math.max(1,c.body.maxHp[id]??1))),mobility:id.endsWith('Leg')?partEff(w,c,id):undefined}]))}
      if(v.culler){v.cullerCooling=cullerCooling(w,c);v.cullerParts=Object.fromEntries(cullerPartIds.map(id=>[id,{missing:isMissing(w,c,id),damage:Math.max(0,Math.min(1,partDamage(c,id)/Math.max(1,c.body.maxHp[id]??1))),efficiency:partEff(w,c,id)}]))}
      if (c.alive&&v.pose.current?.kind!=='wallow') v.dir = DIR_OF_FACING[c.facing] ?? v.dir
      v.unknown=c.id!==pl.id&&!c.met&&!!bestiaryEntry(w,c.def)&&bestiaryStage(w,c.def)===0
      // New bodies contain no invented weapons. Display only the visible actor's real held items.
      for(const [index,slot]of (['main','off']as const).entries()){
        const hand=v.hands[index],held=c.equip[slot]
        hand.visible=!!v.char?.heldItems&&c.alive&&!v.unknown&&!!held&&!held.half&&!held.missingItem
        v.held[index]=!!v.char?.heldItems&&!v.unknown&&!!held&&!held.half&&!held.missingItem
        if(v.equipment[index]?.uid!==held?.uid)v.equipmentAge[index]=0
        v.equipment[index]=held?equipmentSpec(itemDef(w,held),held.uid,!!held.lit&&(held.fuel??0)>0):null
      }
      const medical=medicalPresentation(w,c);if(medical?.key!==v.medical?.key){v.activityTime=0;if(v.medical&&v.pose.current?.kind==='work')clearPoses(v.pose)}v.medical=medical
      v.handsBusy=c.activity?.kind==='rescueDrag'||isMedicalActivity(c.activity)
      const low=crouched(w,c)
      if(low!==v.crouched&&!v.prone&&c.alive&&wasShown)requestPose(v.pose,low?'crouchDown':'stand')
      v.crouched=low
      const prone=!!(c.asleep||c.unconscious||hasEffect(c,'knockedDown',turnOf(w)))
      if(prone&&!v.prone){v.groundT=wasShown?0:1;clearPoses(v.pose)}
      if(!prone&&v.prone&&c.alive&&wasShown)requestPose(v.pose,'rise',undefined,{duration:v.char?.motionDurations?.rise})
      v.prone=prone;v.asleep=!!c.asleep
      const activity=activityMotion(c.activity)
      if(activity!==v.activity){v.activityTime=0;if(v.activity==='work'&&!activity&&v.pose.current?.kind==='work')clearPoses(v.pose)}
      v.activity=activity
      v.guarding=c.ai.mode==='surrender'||!!hasEffect(c,'parryStance',turnOf(w))||!!hasEffect(c,'spearWall',turnOf(w))
      v.mechanical=!!c.body.machine
      v.limp = c.alive && Math.max(regionState(w, c, 'lleg'), regionState(w, c, 'rleg')) >= 3
      if (v.alive && !c.alive) { v.alive = false; v.deadT = wasShown && c.deathTurn === turnOf(w) ? 0 : 1 }
      this.drawBar(w, c, v)
      this.drawMarks(w, c, v)
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { this.destroyView(v); this.views.delete(id) }
  }

  private drawBar(w: World, c: Creature, v: CView) {
    const g = v.bar
    v.annotationHead=this.headY(v);v.bar.y=0;v.marks.y=0
    g.clear()
    if (!c.alive || c.faction === 'player') return
    const max = hpMax(w, c)
    if(w.db.creature(c.def).wildlife&&c.hp>=max&&!hostile(w,player(w),c)&&!(this.opts.hover?.x===c.pos.x&&this.opts.hover.y===c.pos.y))return
    const frac = Math.max(0, Math.min(1, c.hp / max))
    const top = this.headY(v)
    const bw = v.char?.healthBarWidth ?? (v.anim ? 24 : 14)
    g.rect(-bw / 2 - 1, top - 4, bw + 2, 3).fill({ color: 0x0a0806, alpha: 0.85 })
    g.rect(-bw / 2, top - 3, bw * frac, 1).fill(frac > 0.5 ? paletteColor('health') : frac > 0.25 ? paletteColor('danger') : paletteColor('warn'))
    // 출혈 중이면 아래에 가는 붉은 선
    if (totalBleed(w, c, true) > 1) g.rect(-bw / 2, top - 1.5, bw * Math.min(1, totalBleed(w, c, true) / 20), 0.5).fill(0xff3030)
  }

  private headY(v: CView): number {
    if(v.culler)return Math.min(-(v.char?.headOffset??62),v.culler.headY())
    if(v.crawler)return Math.min(-(v.char?.headOffset??12),v.crawler.headY())
    if(v.rig&&v.rigMix>.5)return Math.min(-(v.char?.headOffset??50),v.rig.headY()-2)
    if (v.anim) return -44
    if (v.char) return -Math.max((v.char.headOffset ?? 22)*(v.prone ? .3 : v.crouched ? .78 : 1),v.body.anchor.y*v.body.texture.height*Math.abs(v.body.scale.y)-v.body.y+2)
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
    return walkPosition(v.motion)
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
    if(['attack','dmg','death','block','parry','deflect'].includes(e.k))v.arrivingPose=null
    const pl = player(w)
    switch (e.k) {
      case 'attack': {
        const t = w.s.creatures.find((x) => x.id === e.target)
        if (t) {
          const dx=t.pos.x-c.pos.x,dy=t.pos.y-c.pos.y,length=Math.hypot(dx,dy)||1
          v.attackVec = { x:dx/length,y:dy/length }
          v.attackDistance=length
          v.dir = v.attackVec.x > 0 ? 'right' : v.attackVec.x < 0 ? 'left' : v.attackVec.y < 0 ? 'up' : 'down'
        }
        const prop=e.prop?equipmentSpec(w.db.item(e.prop.def),e.prop.uid,false):undefined
        const mode=prop?'use':e.throwing?'throw':e.ranged?'shoot':'attack'
        const used=prop?undefined:e.ranged?wield(w,c,e.mode):meleeWield(w,c,e.mode),item=used?.item
        const weapon=prop??(item&&!e.throwing?equipmentSpec(itemDef(w,item),item.uid,!!item.lit&&(item.fuel??0)>0):undefined)
        const equipment:EquipmentAction={naturalMode:e.mode,style:prop?'unarmed':attackStyle(used?.atk.family,used?.atk.damageType,weapon,!!e.ranged,!!e.throwing),slot:prop?0:weapon?(used?.arm==='larm'?1:0):null,weapon,direction:v.dir,vector:{...v.attackVec}}
        v.attackT = mode==='attack'?0:-1
        requestPose(v.pose,mode,prop?.sprite,{duration:v.char?.motionDurations?.[mode]??(prop?motionDurations.use:attackDuration(equipment.style,weapon)),equipment})
        break
      }
      case 'dmg': {
        if(v.alive&&!v.prone&&v.pose.current?.kind!=='rise')requestPose(v.pose,'hurt',undefined,{duration:v.char?.motionDurations?.hurt})
        v.flashT = preferences.hitFlash && preferences.animationSpeed > 0 ? 1 : 0
        if (c.id === pl.id && preferences.screenShake && preferences.animationSpeed > 0) this.shake = Math.min(6, 2 + e.v / 6)
        // 내가 준 피해 흰색, 받은 피해 주황 (12 §2.5)
        this.float(c, `${e.v}`, c.id === pl.id ? '#ff9a3a' : '#f2ece0', k, e.crit ? 10 : 8)
        this.spark(c, 0xc02018)
        break
      }
      case 'miss': this.float(c, '빗나감', '#a8a39a', k, 6); break
      case 'block': requestPose(v.pose,'block');this.float(c, '막음', '#9fc0e0', k, 6); this.spark(c, 0xd0d8e0); break
      case 'parry': requestPose(v.pose,'block');this.float(c, '받아넘김', '#e0d090', k, 6); this.spark(c, 0xf0e0a0); break
      case 'deflect': requestPose(v.pose,'block');this.float(c, '튕겨냄', '#c0c8d0', k, 6); this.spark(c, 0xe0e8f0); break
      case 'status': this.float(c, e.text, e.color, k, 6); break
      case 'death': v.alive=false;v.deadT=0;clearPoses(v.pose);this.float(c, c.id === pl.id ? '사망' : '쓰러짐', '#c03028', k, 7); break
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
      this.animateView(v, Math.min(48,dt) * (preferences.animationSpeed || 1))
    }
    for(const view of this.swarmViews.values())view.update(w,Math.min(48,dt)*(preferences.animationSpeed||1),this.displayVisible,immediate)
    this.drawLight(w)
    this.notifyPlayerMotion()
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
    // At a map's south edge the old clamp could push the player under the HUD.
    // Reserve the measured client overlay only; game visibility remains unchanged.
    const usableHeight = Hpx - (this.opts.hudHeight ? Math.min(Hpx * .45, this.opts.hudHeight) + 24 : 0)
    if (preferences.mapZoom !== 'auto') ty = usableHeight / 2 - (pp.y + .5) * s
    const mw = w.s.map.w * s, mh = w.s.map.h * s
    tx = mw < Wpx ? (Wpx - mw) / 2 : Math.min(0, Math.max(Wpx - mw, tx))
    ty = mh < usableHeight ? (usableHeight - mh) / 2 : Math.min(0, Math.max(usableHeight - mh, ty))
    if (!this.camInit) { this.cam = { x: tx, y: ty }; this.camInit = true }
    // Walking is already interpolated. A second camera tween creates visible trailing.
    this.cam.x=tx;this.cam.y=ty
    let sx = 0, sy = 0
    if (!preferences.screenShake || immediate) this.shake = 0
    if (this.shake > 0.05) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake *= Math.pow(0.002, dt / 1000) }
    this.world.position.set(Math.round(this.cam.x + sx), Math.round(this.cam.y + sy))
    this.drawRain(w, dt)
  }

  private notifyPlayerMotion(){
    const view=this.w&&this.views.get(this.w.s.playerId),busy=!!view&&(walking(view.motion)||!!view.pose.current&&['attack','shoot','throw'].includes(view.pose.current.kind))&&preferences.animationSpeed!==0
    if(busy!==this.playerMoving){this.playerMoving=busy;this.onPlayerMotion(busy)}
  }

  /** Local ?debug presentation; actors are limited to visible, identified bodies. */
  presentation(){
    if(!this.w)return null
    const p=player(this.w),v=this.views.get(p.id)
    if(!v)return null
    const logicalScreen=this.world.toGlobal({x:p.pos.x*T+T/2,y:p.pos.y*T+T-2})
    const feetScreen=v.root.getGlobalPosition()
    const knownVisible=new Set(this.w.s.creatures.filter(c=>this.w!.s.visible.includes(c.pos.y*this.w!.s.map.w+c.pos.x)).map(c=>c.id))
    const actors=[...this.views.values()].filter(view=>view.root.visible&&!view.unknown&&knownVisible.has(view.id)).map(view=>({actor:view.id,frame:view.culler?view.culler.sourceFrame:view.crawler?view.crawler.sourceFrame:view.rig&&view.rigMix>.5?view.rig.frame:view.poseFrame,mode:view.poseName,direction:view.dir,moving:walking(view.motion),airborne:!!view.flightHeight,altitude:view.flightHeight/T,lift:view.flightLift,feet:this.viewPos(view),workCycle:view.char?.motionDurations?.work??motionDurations.work,rig:view.rig?.inspect(),crawler:view.crawler?.inspect(),culler:view.culler?.inspect()}))
    const medical=[...this.views.values()].filter(view=>view.root.visible&&!view.unknown&&view.medical&&this.w!.s.creatures.some(c=>c.id===view.id&&this.w!.s.visible.includes(c.pos.y*this.w!.s.map.w+c.pos.x))).map(view=>({actor:view.id,kind:view.medical!.kind,frame:view.poseFrame,direction:view.dir,tools:view.medicalItems.flatMap((sprite,i)=>sprite.visible?[{sprite:view.medical!.props[i].sprite,arm:view.medical!.props[i].arm,x:sprite.x,y:sprite.y,rotation:sprite.rotation}]:[])}))
    return{assets:atlasStats(),actors,medical,swarms:[...this.swarmViews.values()].map(v=>v.inspect()).filter(s=>s.visible),forage:this.forageViews.map(row=>({...row,pos:{...row.pos}})),logical:{...p.pos},feet:this.viewPos(v),light:lightSource(this.w,p)?{...v.lightPos}:null,camera:{...this.cam},zoom:this.zoom,moving:walking(v.motion),stride:v.motion.stride,gait:v.char?.gait??{walk:motionDurations.walk,crouchWalk:motionDurations.crouchWalk},segment:{from:{...v.motion.from},to:{...v.motion.to},t:v.motion.t},queued:v.motion.queue.map(pos=>({...pos})),frame:v.char?{direction:v.dir,sourceWidth:v.body.texture.width,scale:v.body.scale.x,key:v.poseFrame,mode:v.poseName}:null,action:v.pose.current?{kind:v.pose.current.kind,duration:poseDuration(v.pose.current),stage:actionStage(v.pose.current.elapsed/poseDuration(v.pose.current)),style:v.pose.current.equipment?.style,prop:v.pose.current.prop,propUid:v.pose.current.prop?v.pose.current.equipment?.weapon?.uid:undefined,propDef:v.pose.current.prop?v.pose.current.equipment?.weapon?.id:undefined}:null,equipment:v.hands.map((hand,index)=>({id:v.equipment[index]?.id,visible:hand.visible,alpha:hand.alpha,x:hand.x,y:hand.y,rotation:hand.rotation,grip:{x:hand.anchor.x,y:hand.anchor.y},behind:hand.zIndex<1})),screen:{logical:{x:logicalScreen.x,y:logicalScreen.y},feet:{x:feetScreen.x,y:feetScreen.y}}}
  }

  private animateView(v: CView, dt: number) {
    if((v.crawler||v.culler)&&!v.root.visible)return
    const instant=preferences.animationSpeed===0
    if (instant) { advanceWalk(v.motion,0,true);v.arrivingPose=null;v.deadT=v.alive?-1:1;v.groundT=1;v.transition=0 }
    advancePose(v.pose,dt,instant)
    v.activityTime=instant?0:v.activityTime+dt
    advanceWalk(v.motion,dt,false,(v.crouched?v.char?.gait?.crouchWalk??motionDurations.crouchWalk:v.char?.gait?.walk??motionDurations.walk)/2)
    const p = this.viewPos(v)
    const moving = walking(v.motion)
    v.flightLift=instant?v.flightHeight:v.flightLift+Math.sign(v.flightHeight-v.flightLift)*Math.min(Math.abs(v.flightHeight-v.flightLift),dt*T/200)
    if(v.arrivingPose&&!moving){
      const pending=v.arrivingPose,actor=this.w?.s.creatures.find(c=>c.id===v.id);v.arrivingPose=null
      if(v.alive&&!v.prone&&actor&&this.w&&sceneKey(this.w)===pending.map&&actor.pos.x===pending.pos.x&&actor.pos.y===pending.pos.y&&(!pending.continuous||activityMotion(actor.activity)==='work')){
        v.dir=pending.direction;if(pending.continuous)v.activityTime=0
        requestPose(v.pose,pending.cue.kind,pending.cue.prop,{duration:pending.cue.duration,machineTask:pending.cue.machineTask})
      }
    }
    if(!v.alive){clearPoses(v.pose);v.deadT=Math.min(1,v.deadT+dt/(v.char?.motionDurations?.fall??motionDurations.fall))}
    if(v.prone){clearPoses(v.pose);v.groundT=Math.min(1,v.groundT+dt/(v.char?.motionDurations?.fall??motionDurations.fall))}
    if(moving&&v.pose.current&&['work','wallow','use','interact','rise','stand','crouchDown'].includes(v.pose.current.kind))clearPoses(v.pose)
    const continuousWork=v.activity==='work'&&v.pose.current?.kind==='work'
    if(!v.pose.current||continuousWork){if(moving){const dx=v.motion.to.x-v.motion.from.x,dy=v.motion.to.y-v.motion.from.y;v.dir=dx>0?'right':dx<0?'left':dy<0?'up':'down'}else{const actor=this.w?.s.creatures.find(c=>c.id===v.id);if(actor&&v.root.visible)v.dir=DIR_OF_FACING[actor.facing]??v.dir}}
    if(v.pose.current?.equipment){v.dir=v.pose.current.equipment.direction;v.attackVec=v.pose.current.equipment.vector}
    v.attackT=v.pose.current?.kind==='attack'?v.pose.current.elapsed/poseDuration(v.pose.current):-1
    let ox = 0, oy = 0
    // 공격: 캐릭터 시트에 공격 프레임이 있으면 재생, 없으면 대상 쪽으로 찌르듯 튀어나감
    if (v.attackT >= 0) {
      const a = Math.min(1, v.attackT)
      const lunge = Math.sin(a * Math.PI) * (v.char?.motions?1.25:5)
      ox += v.attackVec.x * lunge
      oy += v.attackVec.y * lunge
    }
    if (v.flashT > 0) {
      v.flashT = Math.max(0, v.flashT - dt / 220)
      ox += (Math.random() - 0.5) * (v.char?.motions?.hurt?.6:2) * v.flashT
    }
    // The crawler head/chain follow the exact walk root; attack/hurt stay inside its display owner.
    if(v.crawler||v.culler){ox=0;oy=0}
    const ch = v.char
    let bodyScale=v.scale
    let mode:MotionName='idle',phase=0,loop=false
    if (ch) {
      if(!v.alive){mode='fall';phase=v.deadT}
      else if(v.prone){mode=v.asleep&&v.groundT>=1?'sleep':'fall';loop=mode==='sleep';phase=loop?this.time/(ch.motionDurations?.sleep??motionDurations.sleep):v.groundT}
      else if(v.pose.current&&!continuousWork){mode=v.pose.current.kind;phase=v.pose.current.elapsed/poseDuration(v.pose.current)}
      else if(v.flightHeight){mode='flight';phase=this.time/(ch.motionDurations?.flight??motionDurations.flight);loop=true}
      else if(moving){mode=v.crouched?'crouchWalk':'walk';phase=v.motion.stride/2;loop=true}
      else if(v.activity&&v.activity!=='walk'&&v.activity!=='idle'&&v.activity!=='sleep'){mode=v.activity;phase=mode==='shoot'?.34:v.activityTime/(v.medical?.cycle??ch.motionDurations?.[mode]??motionDurations[mode]);loop=mode!=='shoot'}
      else if(v.guarding){mode='block';phase=.34}
      else if(v.crouched){mode='crouchWalk';phase=0}
      else{phase=instant?0:(this.time+(v.id*37)%1000)/motionDurations.idle;loop=true}
      if(instant){phase=!v.alive||v.prone&&!v.asleep?1:0;loop=false}
      const clip=(name:MotionName)=>name==='idle'?ch.idle[v.dir]:name==='walk'?ch.walk[v.dir]:name==='attack'?(ch.attackVariants?.[v.pose.current?.equipment?.naturalMode??'']?.[v.dir]??ch.attack?.[v.dir]):ch.motions?.[name]?.[v.dir]
      const frames=clip(mode)??(mode==='crouchWalk'?clip('walk'):['shoot','throw'].includes(mode)?clip('attack'):undefined)??ch.idle[v.dir]
      const frame=frames[poseFrame(frames.length,mode==='attack'?attackBodyPhase(phase):phase,loop)]
      // Blend only a state/facing transition. Each gait pose stays crisp and singular.
      const hasCue=!!v.pose.current&&!continuousWork
      if(!instant&&v.poseFrame&&(v.poseName!==mode||v.poseDirection!==v.dir||v.poseWasCue!==hasCue)){
        v.previousBody.texture=v.body.texture;v.previousBody.anchor.copyFrom(v.body.anchor);v.previousBody.scale.copyFrom(v.body.scale);v.previousBody.position.copyFrom(v.body.position);v.previousBody.rotation=v.body.rotation;v.transition=120
      }
      v.poseName=mode;v.poseDirection=v.dir;v.poseFrame=frame;v.poseWasCue=hasCue
      v.body.texture = tex(frame)
      v.body.anchor.set(...(mode==='attack'&&ch.attackAnchor?ch.attackAnchor:ch.anchor))
      const transform=ch.frameTransforms?.[frame]
      if(transform){v.body.anchor.set(...transform.anchor);bodyScale=transform.scale}
    }
    // 절뚝임: 걸음 후반에 1px 주저앉는다
    const hop = moving&&v.limp ? Math.max(0,Math.sin(v.motion.stride*Math.PI))*.65 : 0
    v.root.position.set(p.x * T + T / 2 + ox, p.y * T + T - 2 + oy)
    v.lightPos={x:p.x+ox/T,y:p.y+oy/T}
    const flightChest=mode==='flight'?(ch?.headOffset??10)*.45:0
    v.body.y=hop-v.flightLift-flightChest
    this.animateEquipment(v,mode,phase,moving,hop,dt)
    this.animateMedical(v,mode,phase,moving,hop)
    const cue=v.pose.current
    v.actionItem.visible=!v.char?.rig&&!v.crawler&&!v.culler&&!v.medical&&!!cue?.prop&&!v.unknown&&v.alive&&!v.prone&&!(mode==='throw'&&phase>=.5)&&!(mode==='use'&&phase>=.85)&&!v.hands.some(hand=>hand.visible&&hand.texture===tex(cue!.prop!))
    if(v.actionItem.visible&&cue?.prop){v.actionItem.texture=tex(cue.prop);v.actionItem.scale.set(10/Math.max(v.actionItem.texture.width,v.actionItem.texture.height));v.actionItem.position.set(v.dir==='left'?-5:v.dir==='right'?5:0,mode==='use'?-22:-15);v.actionItem.rotation=mode==='use'&&cue.equipment?.weapon?Math.sin(Math.min(1,phase)*Math.PI)*.45*(v.dir==='left'?-1:1):0}
    // Equal ground depth must keep the player readable beside a wide body.
    v.root.zIndex = (p.y + 1) * T + (v.alive ? v.id===this.w?.s.playerId ? 0.3 : 0.2 : -8)+(v.crawler&&v.alive&&v.crawlerMode==='ceiling'?T/2:0)
    if (v.char || v.anim) v.body.scale.set(bodyScale*(ch?.frameTransforms?.[v.poseFrame]?.flipX?-1:1),bodyScale*(v.crouched&&!['crouchWalk','crouchDown','stand'].includes(mode)&&!v.prone ? .78 : 1))
    // headY already includes the projected body's actual lift and chest anchor.
    v.bar.y=this.headY(v)-v.annotationHead-(v.flightHeight?6:0);v.marks.y=v.bar.y
    // 피격 섬광 → 사망 → 시체
    if (!v.alive) {
      v.body.rotation = ch?.motions?.fall?0:(Math.PI / 2) * v.deadT * (v.id % 2 ? 1 : -1)
      v.body.tint = v.unknown ? 0x202028 : 0x705050
      v.body.alpha = 1 - v.deadT * 0.25
      v.shadow.alpha = 1 - v.deadT
      v.bar.visible = false
      v.marks.visible = false
    } else {
      const actor=this.w?.s.creatures.find(c=>c.id===v.id),neutralTint=actor&&this.w&&camouflageActive(this.w,actor)?actor.camouflage!.tint:0xffffff
      const tilt=mode==='hurt'?.035*(v.dir==='left'?1:-1):mode==='work'&&!v.medical?.024*Math.cos(phase*Math.PI):mode==='throw'?.025*(v.dir==='left'?-1:1):0
      v.body.rotation=Math.sin(phase*Math.PI)*tilt;v.body.alpha=1
      v.body.tint = v.unknown ? 0x202028 : v.flashT > 0.5 ? 0xffffff : v.flashT > 0 ? 0xff7060 : neutralTint
      if (!v.unknown && v.flashT > 0.5) v.body.tint = 0xffb0a0
    }
    v.transition=instant?0:Math.max(0,v.transition-dt)
    v.previousBody.visible=v.transition>0
    if(v.previousBody.visible){const amount=v.transition/120;v.previousBody.alpha=amount;v.previousBody.tint=v.body.tint;v.body.alpha*=1-amount}
    if(v.rig){
      const active=v.alive&&!v.prone&&['idle','walk','crouchWalk','work','use','interact','block'].includes(mode)
      if(active&&!v.rigWasActive)v.rig.reset()
      v.rigMix=instant?Number(active):Math.max(0,Math.min(1,v.rigMix+(active?1:-1)*dt/120));v.rigWasActive=active
      if(active||v.rigMix>0){const work=mode==='work'&&['sow','spray'].includes(v.pose.current?.machineTask??'')?phase:null;v.rig.update(v.dir,{x:p.x*T,y:p.y*T},work,dt,instant);v.rig.setTint(v.body.tint)}
      v.rig.root.visible=v.rigMix>0;v.rig.root.alpha=v.rigMix;v.body.visible=v.rigMix<1;v.body.alpha*=1-v.rigMix
      if(v.previousBody.visible)v.previousBody.alpha*=1-v.rigMix
    }
    if(v.crawler&&this.w){
      const point={x:p.x*T+T/2,y:p.y*T+T-2},dx=v.motion.to.x-v.motion.from.x,dy=v.motion.to.y-v.motion.from.y
      const heading=mode==='attack'?Math.atan2(v.attackVec.y,v.attackVec.x):moving?Math.atan2(dy,dx):v.crawlerHeading
      v.crawler.update(point,{heading,mode:v.crawlerMode,alive:v.alive,prone:v.prone,action:mode,phase,attack:v.attackVec,flash:v.flashT,tint:v.unknown?0x202028:0xffffff,parts:v.crawlerParts},dt,instant)
      const map=this.w.s.map,rects=[],radius=v.crawler.clipRadius()
      for(let y=Math.max(0,Math.floor((point.y-radius)/T));y<=Math.min(map.h-1,Math.floor((point.y+radius)/T));y++)for(let x=Math.max(0,Math.floor((point.x-radius)/T));x<=Math.min(map.w-1,Math.floor((point.x+radius)/T));x++){const index=y*map.w+x;if(this.displayVisible.has(index)&&!this.w.db.terrain(map.tiles[index].t).wall)rects.push({x:x*T-point.x,y:y*T-point.y,w:T,h:T})}
      v.crawler.setClip(rects);v.body.visible=false;v.previousBody.visible=false;v.shadow.visible=false;v.poseFrame=v.crawler.sourceFrame
    }
    if(v.culler&&this.w){
      const point={x:p.x*T+T/2,y:p.y*T+T-2}
      v.culler.update(point,{direction:v.dir,alive:v.alive,prone:v.prone,cooling:v.cullerCooling,action:mode,phase,attackMode:v.pose.current?.equipment?.naturalMode,attackVector:v.attackVec,attackDistance:v.attackDistance,flash:v.flashT,tint:v.unknown?0x202028:0xffffff,parts:v.cullerParts},dt,instant)
      const map=this.w.s.map,rects=[],radius=v.culler.clipRadius()
      for(let y=Math.max(0,Math.floor((point.y-radius)/T));y<=Math.min(map.h-1,Math.floor((point.y+radius)/T));y++)for(let x=Math.max(0,Math.floor((point.x-radius)/T));x<=Math.min(map.w-1,Math.floor((point.x+radius)/T));x++){const index=y*map.w+x;if(this.displayVisible.has(index)&&!this.w.db.terrain(map.tiles[index].t).wall)rects.push({x:x*T-point.x,y:y*T-point.y,w:T,h:T})}
      v.culler.setClip(rects);v.body.visible=false;v.previousBody.visible=false;v.shadow.visible=false;v.poseFrame=v.culler.sourceFrame
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

  private animateMedical(v:CView,mode:MotionName,phase:number,moving:boolean,hop:number){
    for(const sprite of v.medicalItems)sprite.visible=false
    if(!v.medical||!v.char?.heldItems||mode!=='work'||moving||!v.alive||v.prone||v.unknown)return
    const grips=medicalGrips[v.poseFrame],transform=v.char.frameTransforms?.[v.poseFrame];if(!grips||!transform)return
    v.gripCovers.zIndex=v.dir==='up'?.8:5
    const points:{x:number;y:number}[]=[],ratio=(v.char.headOffset??35)/35
    for(const[propIndex,prop]of v.medical.props.entries()){
      const grip=grips[prop.arm],sprite=v.medicalItems[propIndex];if(!grip||!sprite)continue
      const texture=tex(prop.sprite);if(texture===Texture.EMPTY)continue
      const position=medicalGripPosition(grip.point,{width:v.body.texture.width,height:v.body.texture.height,anchor:[v.body.anchor.x,v.body.anchor.y],scale:transform.scale,flipX:transform.flipX},v.crouched),x=position.x,y=position.y+hop
      sprite.texture=texture;sprite.anchor.set(...prop.grip);sprite.scale.set(prop.length*ratio/Math.max(texture.width,texture.height));sprite.position.set(x,y)
      sprite.rotation=medicalPropAngle(v.medical.kind,v.dir,phase)-prop.axis;sprite.alpha=(v.dir==='up'?.85:1)*(preferences.animationSpeed===0?1:Math.min(1,v.activityTime/140));sprite.zIndex=v.dir==='up'?.7+propIndex*.01:4+propIndex*.1;sprite.visible=true;points.push({x,y})
      v.gripCovers.ellipse(x,y,.8*ratio,.65*ratio).fill({color:grip.color,alpha:sprite.alpha})
    }
    if(v.medical.kind==='needle'&&points.length===2){
      const[a,b]=points,looseness=1.5+Math.sin(phase*Math.PI*2)*.5
      v.gearEffects.moveTo(a.x,a.y).quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+looseness,b.x,b.y).stroke({color:0xb6a68a,width:.45,alpha:.85})
    }
  }

  private animateEquipment(v:CView,mode:MotionName,phase:number,moving:boolean,hop:number,dt:number){
    const effects=v.gearEffects,covers=v.gripCovers;effects.clear();covers.clear()
    const action=v.pose.current?.equipment,transform=v.char?.frameTransforms?.[v.poseFrame],bodyRatio=(v.char?.headOffset??35)/35,utility=!!v.pose.current?.prop&&['use','work'].includes(mode),fall=!v.alive?v.deadT:v.prone?v.groundT:0
    effects.zIndex=v.dir==='up'?.5:2;covers.zIndex=v.dir==='up'?.8:5
    let supporting=false
    for(const index of[0,1]as const){
      const hand=v.hands[index],item=action?.slot===index?action.weapon??v.equipment[index]:v.equipment[index]
      v.equipmentAge[index]=preferences.animationSpeed===0?180:Math.min(180,v.equipmentAge[index]+dt)
      hand.visible=!!item&&v.held[index]&&!v.handsBusy&&!utility&&(v.alive&&!v.prone||fall>0&&fall<.8)&&!(index===1&&supporting)
      if(!hand.visible||!item)continue
      const registered=heldGrips[v.poseFrame],grip=registered?.[index===0?'main':'off']
      if(registered&&!grip){hand.visible=false;continue}
      const source=grip&&transform?medicalGripPosition(grip.point,{width:v.body.texture.width,height:v.body.texture.height,anchor:[v.body.anchor.x,v.body.anchor.y],scale:transform.scale,flipX:transform.flipX},v.crouched):undefined
      const legacy=index===0?transform?.mainHand:undefined,wrist:readonly[number,number]|undefined=source?[source.x,source.y]:legacy?[legacy[0]*(transform?.flipX?-1:1),legacy[1]*(v.crouched?.78:1)]:undefined
      const pose=heldPose({item,slot:index,direction:v.dir,mode,phase,stride:v.motion.stride,moving,crouched:v.crouched,action,wrist,sourceGrip:!!source})
      hand.visible=pose.visible;if(!pose.visible)continue
      hand.texture=tex(item.sprite);hand.anchor.set(...item.grip);hand.scale.set(item.length*bodyRatio/Math.max(hand.texture.width,hand.texture.height));hand.position.set(pose.x*(wrist?1:bodyRatio),pose.y*(wrist?1:bodyRatio)+hop+fall*15+(1-v.equipmentAge[index]/180)*3)
      hand.rotation=pose.angle-item.axis;hand.alpha=pose.alpha*(1-fall)*Math.min(1,v.equipmentAge[index]/120);hand.zIndex=pose.behind?.7:3+index*.1
      // A small cuff occludes the handle at the actual grip; the source body's arm stays intact.
      covers.ellipse(hand.x,hand.y,(grip?.8:1.2)*bodyRatio,(grip?.65:.9)*bodyRatio).fill({color:grip?.color??0x807261,alpha:hand.alpha})
      if(index===0&&item.twoHanded&&['attack','shoot','block','work'].includes(mode)&&(!action||action.slot===0)){
        supporting=true;v.hands[1].visible=false
        if(!registered){
          const support=supportHand({...pose,x:hand.x,y:hand.y},item)
          covers.moveTo(support.x-1,support.y+1).lineTo(support.x+1,support.y-1).stroke({color:0x504638,width:2.4*bodyRatio,alpha:hand.alpha})
          covers.ellipse(support.x,support.y,1.3*bodyRatio,bodyRatio).fill({color:0x95816a,alpha:hand.alpha})
        }else if(registered.off&&transform){
          const support=medicalGripPosition(registered.off.point,{width:v.body.texture.width,height:v.body.texture.height,anchor:[v.body.anchor.x,v.body.anchor.y],scale:transform.scale,flipX:transform.flipX},v.crouched)
          covers.ellipse(support.x,support.y+hop,.8*bodyRatio,.65*bodyRatio).fill({color:registered.off.color,alpha:hand.alpha})
        }
      }
      const length=item.length*bodyRatio
      // Source profile can place the impact end below the grip (a hanging weight).
      const reach=equipmentTipReach(item)*bodyRatio,end={x:hand.x+Math.cos(pose.angle)*reach,y:hand.y+Math.sin(pose.angle)*reach}
      if(mode==='attack'&&action?.slot===index&&phase>.31&&phase<.68&&action.style!=='thrust'){
        const arc=action.style==='chop'||action.style==='smash'?.48:.65,sign=action.vector.x<0?-1:1
        for(let n=0;n<7;n++){
          const a=pose.angle-sign*arc*(1-n/7),b=pose.angle-sign*arc*(1-(n+1)/7),radius=reach
          effects.moveTo(hand.x+Math.cos(a)*radius,hand.y+Math.sin(a)*radius).lineTo(hand.x+Math.cos(b)*radius,hand.y+Math.sin(b)*radius).stroke({color:0xc1b69d,width:.7,alpha:(n+1)/7*.22})
        }
      }
      if(mode==='attack'&&action?.slot===index&&action.style==='thrust'&&phase>.37&&phase<.62)effects.moveTo(end.x-Math.cos(pose.angle)*4,end.y-Math.sin(pose.angle)*4).lineTo(end.x,end.y).stroke({color:0xc1b69d,width:.6,alpha:.25})
      if(mode==='shoot'&&index===0&&item.kind==='bow'){
        const pull=phase<.44?Math.sin(phase/.44*Math.PI/2)*3:0
        const c=Math.cos(pose.angle),s=Math.sin(pose.angle),span=10*bodyRatio
        effects.moveTo(hand.x-c+s*span,hand.y-s-c*span).lineTo(hand.x-c*pull,hand.y-s*pull).lineTo(hand.x+c-s*span,hand.y+s+c*span).stroke({color:0xbab095,width:.5,alpha:.6})
      }
      if(mode==='shoot'&&phase>.39&&phase<.52&&index===0&&['rifle','pistol'].includes(item.kind))effects.star(end.x,end.y,5,2.6,1.1,pose.angle).fill({color:0xe7b875,alpha:.75})
      if(item.lit&&item.kind==='torch'){
        const flicker=preferences.torchFlicker?Math.sin(this.time/90)*.3:0
        effects.poly([end.x-1,end.y+1,end.x-1.4,end.y-1,end.x+flicker,end.y-3.4,end.x+1.4,end.y-.4,end.x+1,end.y+1]).fill({color:0xd9a352,alpha:.9})
      }else if(item.lit&&item.kind==='lantern'){
        const drop=length*(.65-item.grip[1])
        effects.circle(hand.x-Math.cos(pose.angle)*drop,hand.y-Math.sin(pose.angle)*drop,1.1).fill({color:0xe3b063,alpha:.8})
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
