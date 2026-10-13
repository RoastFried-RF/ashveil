<script setup lang="ts">
// 지도 (M, 12 §2.3 · 14 §17): 층 탭, 본 칸, 발견한 방 이름, '정리됨 · N일 전'. 다시 찼는지는 가서 보기 전엔 모른다.
// 소문(쪽지)으로만 아는 방은 점선 — 아직 안 간 층도 탭이 생긴다 (06 §7.0)
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { player, rumoredRooms, turnOf, TURNS_PER_DAY, type MapState, type World } from '../../core'
import { version, world } from '../store'
import { wins } from '../ui'
import Win from './Win.vue'

const PX = 4
const tab = ref<string>('')
const cv = ref<HTMLCanvasElement>()

interface Floor { id: string; kind: 'surface' | 'dungeon'; depth: number; w: number; h: number; map?: MapState }
const floors = computed<Floor[]>(() => {
  void version.value
  const w = world.value as World
  const all: Floor[] = [w.s.map, ...Object.values(w.s.maps)].map((m) => ({ id: m.id, kind: m.kind, depth: m.depth, w: m.w, h: m.h, map: m }))
  for (const r of w.s.knowledge.rumors ?? []) {
    if (r.kind !== 'room' || !r.mapId || all.some((f) => f.id === r.mapId)) continue
    all.push({ id: r.mapId, kind: 'dungeon', depth: Number(r.mapId.replace('crypt', '')), w: r.mapW ?? 60, h: r.mapH ?? 40 })
  }
  const order = (m: Floor) => (m.kind === 'surface' ? 0 : m.depth)
  return all.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i).sort((a, b) => order(a) - order(b))
})
const cur = computed<Floor>(() => floors.value.find((m) => m.id === tab.value) ?? floors.value.find((m) => m.id === (world.value as World).s.map.id)!)
const label = (m: Floor) => (m.kind === 'surface' ? '지상' : `지하 ${m.depth}층`) + (m.map ? '' : ' (소문)')
const rumors = computed(() => { void version.value; return rumoredRooms(world.value as World, cur.value.id) })

const rooms = computed(() => {
  void version.value
  const w = world.value as World
  const now = turnOf(w)
  const seen = (cur.value.map?.rooms ?? []).filter((r) => r.discovered && r.type !== 'entry').map((r) => ({
    name: r.name,
    cleared: r.clearedAt !== undefined ? `정리됨 · ${Math.floor((now - r.clearedAt) / TURNS_PER_DAY)}일 전` : '',
  }))
  const heard = rumors.value.filter((r) => !cur.value.map?.rooms[r.roomIdx ?? -1]?.discovered).map((r) => ({ name: `${r.roomName ?? '방'}?`, cleared: '소문' }))
  return [...seen, ...heard]
})

function draw() {
  const c = cv.value
  const w = world.value as World | undefined
  if (!c || !w) return
  const f = cur.value
  c.width = f.w * PX
  c.height = f.h * PX
  const g = c.getContext('2d')!
  g.fillStyle = '#0b0a08'
  g.fillRect(0, 0, c.width, c.height)
  // 소문으로 아는 방: 점선 호박색
  g.setLineDash([3, 2])
  g.strokeStyle = '#c89a40'
  for (const r of rumors.value) if (r.rect && !f.map?.rooms[r.roomIdx ?? -1]?.discovered) g.strokeRect(r.rect.x * PX + 0.5, r.rect.y * PX + 0.5, r.rect.w * PX - 1, r.rect.h * PX - 1)
  g.setLineDash([])
  const m = f.map
  if (!m) return
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = m.tiles[y * m.w + x]
    if (!t.seen) continue
    const d = w.db.terrain(t.t)
    g.fillStyle = d.stairs ? '#e0c060' : d.water ? '#3a5a78' : d.door ? '#8a6a40' : d.container ? '#7a6a4a' : !d.passable ? '#2c2a24' : t.blood > 20 ? '#6a2a24' : '#5a564c'
    g.fillRect(x * PX, y * PX, PX, PX)
  }
  g.strokeStyle = '#a89870'
  g.lineWidth = 1
  for (const r of m.rooms) if (r.discovered && r.type !== 'entry') g.strokeRect(r.x * PX + 0.5, r.y * PX + 0.5, r.w * PX - 1, r.h * PX - 1)
  if (m.id === w.s.map.id) {
    const p = player(w).pos
    g.fillStyle = '#ffffff'
    g.fillRect(p.x * PX - 1, p.y * PX - 1, PX + 2, PX + 2)
  }
}

onMounted(() => { tab.value = (world.value as World).s.map.id; nextTick(draw) })
watch([version, tab], () => nextTick(draw))
</script>

<template>
  <Win title="지도" :x="260" :y="60" :width="Math.min(cur.w * PX + 40, 860)" testid="win-map" @close="wins.map = false">
    <div class="mb-2 flex gap-1">
      <button v-for="m in floors" :key="m.id" class="df px-2 text-xs" :class="cur.id === m.id ? 'df-tab-sel text-amber-100' : 'df-tab text-ash-300'" @click="tab = m.id">{{ label(m) }}</button>
    </div>
    <div class="overflow-auto"><canvas ref="cv" class="pix block" /></div>
    <div class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
      <span v-for="r in rooms" :key="r.name" class="text-ash-300">{{ r.name }}<span v-if="r.cleared" class="ml-1 text-ash-500">({{ r.cleared }})</span></span>
      <span v-if="!rooms.length" class="text-ash-500">아직 찾은 방이 없다.</span>
    </div>
  </Win>
</template>
