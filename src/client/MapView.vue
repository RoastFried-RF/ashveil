<script setup lang="ts">
// Pixi 렌더러: 타일 → 피 → 아이템 → 생물 → 어둠/시야 → 커서
import { Application, Assets, Container, Graphics, Sprite, Texture, TextureStyle } from 'pixi.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { isRaining, lightAt, player, type Pos } from '../core'
import { version, world } from './store'

const props = defineProps<{ target?: Pos | null; highlight?: Pos[] }>()
const emit = defineEmits<{ hover: [p: Pos | null]; click: [p: Pos, button: number] }>()

const TILE = 32
const host = ref<HTMLDivElement>()
let app: Application | null = null
const tex = new Map<string, Texture>()
let layers: { terrain: Container; blood: Container; items: Container; mobs: Container; fog: Graphics; fx: Container; ui: Graphics } | null = null
let cols = 0, rows = 0
let origin = { x: 0, y: 0 }
let resizeObs: ResizeObserver | null = null
let rainPhase = 0

const SPRITES = [
  'grass0', 'grass1', 'grass2', 'grassdirt0', 'grassdirt1', 'grassdirt2', 'dirt0', 'dirt1', 'dirt2', 'ash0', 'ash1', 'ash2', 'ash3',
  'concrete0', 'concrete1', 'concrete2', 'concrete3', 'mud0', 'mud1', 'mud2', 'mud3', 'rubble0', 'rubble1', 'rubble2',
  'water_shallow', 'water_deep', 'road0', 'road1', 'wallbrick0', 'wallbrick1', 'wallbrick2', 'wallbrick3', 'wallstone0', 'wallstone1', 'wallmetal',
  'tree0', 'tree1', 'tree2', 'tree3', 'door_closed', 'door_open', 'boulder', 'column', 'stump', 'crate_closed', 'crate_open',
  'locker', 'chest', 'bones', 'player', 'reaver0', 'reaver1', 'reaver2', 'ash_hound', 'ash_hound_alpha', 'burrow_rat',
  'knife', 'rusty_knife', 'machete', 'hatchet', 'pipe_club', 'rebar_spear', 'bow', 'arrow', 'leather_coat', 'padded_jacket',
  'rag_shirt', 'scrap_mail', 'hood', 'scrap_helmet', 'boots', 'gloves', 'oilcloth_cloak', 'buckler', 'jerky', 'raw_meat',
  'dried_apple', 'hardtack', 'canned_meat', 'water_bottle', 'moonshine', 'painkiller', 'pill_yellow', 'pill_blue', 'pill_white',
  'pill_black', 'pill_green', 'pill_magenta', 'bandage', 'cloth', 'tourniquet', 'splint', 'lantern', 'blood0', 'blood1',
  'blood2', 'blood3', 'blood_pool', 'flame0', 'rain0', 'rain1',
]

function t(name: string): Texture {
  return tex.get(name) ?? Texture.WHITE
}

async function init() {
  if (!host.value) return
  TextureStyle.defaultOptions.scaleMode = 'nearest'
  app = new Application()
  await app.init({ background: '#08080a', antialias: false, resizeTo: host.value, preference: 'webgl' })
  host.value.appendChild(app.canvas)
  const base = import.meta.env.BASE_URL
  const urls = SPRITES.map((s) => `${base}tiles/${s}.png`)
  const loaded = await Assets.load(urls)
  SPRITES.forEach((s, i) => tex.set(s, loaded[urls[i]] as Texture))
  layers = {
    terrain: new Container(), blood: new Container(), items: new Container(), mobs: new Container(),
    fog: new Graphics(), fx: new Container(), ui: new Graphics(),
  }
  const root = new Container()
  root.addChild(layers.terrain, layers.blood, layers.items, layers.mobs, layers.fx, layers.fog, layers.ui)
  app.stage.addChild(root)
  app.canvas.addEventListener('mousemove', onMove)
  app.canvas.addEventListener('mouseleave', () => emit('hover', null))
  app.canvas.addEventListener('mousedown', onDown)
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  app.ticker.add(() => {
    rainPhase += app!.ticker.deltaMS
    if (rainPhase > 260) { rainPhase = 0; drawFx() }
  })
  resizeObs = new ResizeObserver(() => render())
  resizeObs.observe(host.value)
  render()
}

function tileFromEvent(e: MouseEvent): Pos | null {
  if (!app) return null
  const rect = app.canvas.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) / TILE) + origin.x
  const y = Math.floor((e.clientY - rect.top) / TILE) + origin.y
  const w = world.value
  if (!w || x < 0 || y < 0 || x >= w.s.map.w || y >= w.s.map.h) return null
  return { x, y }
}

function onMove(e: MouseEvent) { emit('hover', tileFromEvent(e)) }
function onDown(e: MouseEvent) {
  const p = tileFromEvent(e)
  if (p) emit('click', p, e.button)
}

function render() {
  const w = world.value
  if (!app || !layers || !w) return
  const W = app.renderer.width / app.renderer.resolution
  const H = app.renderer.height / app.renderer.resolution
  cols = Math.ceil(W / TILE)
  rows = Math.ceil(H / TILE)
  const pl = player(w)
  const map = w.s.map
  origin = {
    x: Math.max(0, Math.min(map.w - cols, pl.pos.x - Math.floor(cols / 2))),
    y: Math.max(0, Math.min(map.h - rows, pl.pos.y - Math.floor(rows / 2))),
  }
  if (map.w < cols) origin.x = -Math.floor((cols - map.w) / 2)
  if (map.h < rows) origin.y = -Math.floor((rows - map.h) / 2)
  const vis = new Set(w.s.visible)
  for (const L of [layers.terrain, layers.blood, layers.items, layers.mobs]) L.removeChildren().forEach((c) => c.destroy())
  layers.fog.clear()
  for (let vy = 0; vy < rows; vy++) {
    for (let vx = 0; vx < cols; vx++) {
      const mx = vx + origin.x, my = vy + origin.y
      const px = vx * TILE, py = vy * TILE
      if (mx < 0 || my < 0 || mx >= map.w || my >= map.h) continue
      const i = my * map.w + mx
      const tile = map.tiles[i]
      if (!tile.seen && !vis.has(i)) {
        layers.fog.rect(px, py, TILE, TILE).fill({ color: 0x050506, alpha: 1 })
        continue
      }
      const terr = w.db.terrain(tile.t)
      const isFloorish = terr.passable || terr.container || terr.door || terr.water
      // 문·용기·나무 등은 바닥 위에 그린다
      if (!isFloorish || terr.container || terr.door || terr.id === 'Terrain.Tree' || terr.id === 'Terrain.Boulder' || terr.id === 'Terrain.Column') {
        if (terr.id !== 'Terrain.BrickWall' && terr.id !== 'Terrain.StoneWall' && terr.id !== 'Terrain.MetalWall') {
          const under = new Sprite(t(tile.roof ? 'concrete0' : 'grass' + (tile.v % 3)))
          under.position.set(px, py)
          layers.terrain.addChild(under)
        }
      }
      const s = new Sprite(t(terr.sprites[tile.v % terr.sprites.length]))
      s.position.set(px, py)
      layers.terrain.addChild(s)
      if (tile.blood > 4) {
        const b = new Sprite(t(tile.blood > 120 ? 'blood_pool' : 'blood' + ((mx * 7 + my * 3) % 4)))
        b.position.set(px, py)
        b.alpha = Math.min(0.9, 0.35 + tile.blood / 200)
        layers.blood.addChild(b)
      }
      if (vis.has(i) && tile.items.length) {
        const it = w.db.item(tile.items[tile.items.length - 1].def)
        const is = new Sprite(t(it.sprite))
        is.position.set(px + 4, py + 4)
        is.scale.set(0.75)
        layers.items.addChild(is)
      }
      if (vis.has(i)) {
        const l = lightAt(w, { x: mx, y: my })
        const a = Math.max(0, Math.min(0.62, 0.66 - l * 0.8))
        if (a > 0.02) layers.fog.rect(px, py, TILE, TILE).fill({ color: 0x0a0a14, alpha: a })
      } else {
        layers.fog.rect(px, py, TILE, TILE).fill({ color: 0x050508, alpha: 0.72 })
      }
    }
  }
  // 생물 (시체 먼저)
  const mobs = [...w.s.creatures].sort((a, b) => Number(a.alive) - Number(b.alive))
  for (const c of mobs) {
    const i = c.pos.y * map.w + c.pos.x
    if (!vis.has(i)) continue
    if (!c.alive && c.deathCause === 'escaped') continue
    const vx = c.pos.x - origin.x, vy = c.pos.y - origin.y
    if (vx < 0 || vy < 0 || vx >= cols || vy >= rows) continue
    const s = new Sprite(t(c.sprite))
    s.anchor.set(0.5)
    s.position.set(vx * TILE + TILE / 2, vy * TILE + TILE / 2)
    const facingLeft = c.facing >= 5 && c.facing <= 7
    s.scale.x = facingLeft ? -1 : 1
    if (!c.alive) { s.rotation = Math.PI / 2; s.tint = 0x7a4a4a; s.alpha = 0.85 }
    else if (c.unconscious) { s.rotation = Math.PI / 2; s.tint = 0xbbbbbb }
    else if (c.ai.mode === 'surrender') s.tint = 0xc8c8a0
    layers.mobs.addChild(s)
    if (c.alive && c.faction !== 'player') {
      // 방향 표시 (작은 점)
      const g = new Graphics()
      const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
      const [dx, dy] = dirs[c.facing]
      g.circle(vx * TILE + TILE / 2 + dx * 13, vy * TILE + TILE / 2 + dy * 13, 2).fill({ color: c.ai.mode === 'flee' ? 0xd0d050 : 0xd04040 })
      layers.mobs.addChild(g)
    }
  }
  drawFx()
  drawUi()
}

function drawFx() {
  const w = world.value
  if (!layers || !w) return
  layers.fx.removeChildren().forEach((c) => c.destroy())
  if (!isRaining(w)) return
  const vis = new Set(w.s.visible)
  const frame = Math.floor(performance.now() / 260) % 2
  for (let vy = 0; vy < rows; vy++) for (let vx = 0; vx < cols; vx++) {
    const mx = vx + origin.x, my = vy + origin.y
    if (mx < 0 || my < 0 || mx >= w.s.map.w || my >= w.s.map.h) continue
    const i = my * w.s.map.w + mx
    if (!vis.has(i) || w.s.map.tiles[i].roof) continue
    if ((mx * 5 + my * 3 + frame) % 4 !== 0) continue
    const s = new Sprite(t('rain' + frame))
    s.position.set(vx * TILE, vy * TILE)
    s.alpha = 0.35
    s.tint = 0x9a9a9a
    layers.fx.addChild(s)
  }
}

function drawUi() {
  if (!layers) return
  layers.ui.clear()
  for (const p of props.highlight ?? []) {
    layers.ui.rect((p.x - origin.x) * TILE + 1, (p.y - origin.y) * TILE + 1, TILE - 2, TILE - 2).stroke({ color: 0xe0b040, width: 1, alpha: 0.6 })
  }
  if (props.target) {
    const x = (props.target.x - origin.x) * TILE, y = (props.target.y - origin.y) * TILE
    layers.ui.rect(x + 1, y + 1, TILE - 2, TILE - 2).stroke({ color: 0xff5050, width: 2 })
  }
}

watch(version, () => render())
watch(() => [props.target, props.highlight], () => drawUi(), { deep: true })

onMounted(() => { void init() })
onBeforeUnmount(() => {
  resizeObs?.disconnect()
  app?.destroy(true, { children: true })
  app = null
})
</script>

<template>
  <div ref="host" class="h-full w-full overflow-hidden" data-testid="map" />
</template>
