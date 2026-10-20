<script setup lang="ts">
// 지도 (M, 12 §2.3 · 14 §17): 층 탭, 본 칸, 발견한 방 이름, '정리됨 · N일 전'. 다시 찼는지는 가서 보기 전엔 모른다.
// 소문(쪽지)으로만 아는 방은 점선 — 아직 안 간 층도 탭이 생긴다 (06 §7.0)
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {knownMapDocuments,mapClaims} from '../../core/cartography'
import {stairClaims} from '../../core/stair-claims'
import {mapLandmarkClaims} from '../../core/map-landmarks'
import {fieldMapRegion} from '../../core/npc-map-memory'
import {mapAppearance,terrainAppearance,mapVisibility,displayTile,knownLocalMaps} from '../map-memory'
import {fmtClock, player, turnOf, TURNS_PER_DAY, type MapState, type World } from '../../core'
import { version, world } from '../store'
import { wins } from '../ui'
import Win from './Win.vue'
import MapWritingPanel from './MapWritingPanel.vue'
import WorldMap from './WorldMap.vue'
const worldTab = ref(false)

const PX = 4
const tab = ref<string>('')
const cv = ref<HTMLCanvasElement>()
const pointed=ref<number>()

interface Floor { id: string; kind: 'surface' | 'dungeon'; depth: number; w: number; h: number; map?: MapState }
const floors = computed<Floor[]>(() => {
  void version.value
  const w = world.value as World
  const all: Floor[] = knownLocalMaps(w).map((m) => ({ id: m.id, kind: m.kind, depth: m.depth, w: m.w, h: m.h, map: m }))
  for(const {document:d}of knownMapDocuments(w))if(!all.some(f=>f.id===d.mapId))all.push({id:d.mapId,kind:d.kind,depth:d.depth,w:d.w,h:d.h})
  for (const r of w.s.knowledge.rumors ?? []) {
    if (w.s.overworld && (r.regionId ?? 'Region.GreyCloister') !== fieldMapRegion(w)) continue
    if (!['room','stairs'].includes(r.kind) || !r.mapId || all.some((f) => f.id === r.mapId)) continue
    const legacy=/^crypt(\d+)$/.exec(r.mapId),depth=r.mapDepth??(r.mapId==='surface'?0:legacy?Number(legacy[1]):undefined)
    if(depth===undefined||!Number.isInteger(depth)||depth<0||depth>100)continue
    all.push({ id: r.mapId, kind: depth===0?'surface':'dungeon', depth, w: r.mapW ?? 60, h: r.mapH ?? 40 })
  }
  const order = (m: Floor) => (m.kind === 'surface' ? 0 : m.depth)
  return all.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i).sort((a, b) => order(a) - order(b))
})
const cur = computed<Floor>(() => floors.value.find((m) => m.id === tab.value) ?? floors.value.find((m) => m.id === (world.value as World).s.map.id)!)
const pointedInfo=computed(()=>{
 void version.value
 const w=world.value as World,map=cur.value.map,i=pointed.value
 if(!map||i===undefined)return ''
 const visible=mapVisibility(w,map),id=terrainAppearance(w,i,visible,map)
 if(!id)return '미탐색'
 const tile=map.tiles[i],label=w.db.terrain(id).label
 return label+(visible.has(i)?' · 지금 보임':tile.observed?' · 기억 · 관찰 '+fmtClock(tile.observed.at):' · 기억 · 관찰 시각 미기록')
})
function point(e:MouseEvent){const c=cv.value!,rect=c.getBoundingClientRect(),x=Math.floor((e.clientX-rect.left)*c.width/rect.width/PX),y=Math.floor((e.clientY-rect.top)*c.height/rect.height/PX);pointed.value=x>=0&&y>=0&&x<cur.value.w&&y<cur.value.h?y*cur.value.w+x:undefined}
const label = (m: Floor) => (m.kind === 'surface' ? '지상' : `지하 ${m.depth}층`) + (m.map ? '' : knownMapDocuments(world.value as World,m.id).length?' (지도)':' (소문)')
const documents=computed(()=>{void version.value;return knownMapDocuments(world.value as World,cur.value.id)})
const claims=computed(()=>{void version.value;return mapClaims(world.value as World,cur.value.id,cur.value.map)})
const stairLocations=computed(()=>{void version.value;return stairClaims(world.value as World,cur.value.id,cur.value.map)})
const landmarks=computed(()=>{void version.value;return mapLandmarkClaims(world.value as World,cur.value.id,cur.value.map)})

const rooms = computed(() => {
  void version.value
  const w = world.value as World
  const now = turnOf(w)
  const seen = (cur.value.map?.rooms ?? []).filter((r) => r.discovered && r.type !== 'entry').map((r) => ({
    name: r.name,
    cleared: r.clearedAt !== undefined ? `정리됨 · ${Math.floor((now - r.clearedAt) / TURNS_PER_DAY)}일 전` : '',
  }))
  return seen
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
  for(const r of claims.value)if(r.status==='unverified'){g.strokeStyle=r.conflict?'#ca6666':r.origin==='rumor'?'#c89a40':'#6ea6bd';g.strokeRect(r.x*PX+.5,r.y*PX+.5,r.w*PX-1,r.h*PX-1)}
  for(const s of stairLocations.value)if(s.status==='unverified'){g.strokeStyle=s.conflict?'#ca6666':s.origin==='rumor'?'#c89a40':'#6ea6bd';g.strokeRect(s.x*PX+.5,s.y*PX+.5,PX-1,PX-1)}
  for(const l of landmarks.value)if(l.status==='unverified'){g.strokeStyle=l.conflict?'#ca6666':'#6ea6bd';g.strokeRect(l.x*PX+.5,l.y*PX+.5,PX-1,PX-1)}
  g.setLineDash([])
  const m = f.map
  if (!m) return
  const appearance=mapAppearance(w,m)
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i=y*m.w+x,id=appearance.terrain[i]
    if(!id)continue
    const t=displayTile(m.tiles[i],id,appearance.visible.has(i)),d=w.db.terrain(id)
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

onMounted(() => { worldTab.value = !!world.value?.s.overworld && !world.value.s.overworld.currentRegion; tab.value = (world.value as World).s.map.id; nextTick(draw) })
watch([version, tab], () => nextTick(draw))
watch(tab,()=>{pointed.value=undefined})
</script>

<template>
  <Win title="지도" :x="260" :y="60" :width="worldTab ? 690 : Math.min(Math.max(cur.w * PX + 40, 440), 860)" testid="win-map" @close="wins.map = false">
    <div v-if="world?.s.overworld" class="mb-2 flex gap-2"><button class="dbtn" @click="worldTab = false">현재 지역</button><button class="dbtn" data-testid="world-tab" @click="worldTab = true">세계 지도</button></div>
    <WorldMap v-if="worldTab && world?.s.overworld" />
    <div v-show="!worldTab" class="mb-2 flex gap-1">
      <button v-for="m in floors" :key="m.id" class="df px-2 text-xs" :class="cur.id === m.id ? 'df-tab-sel text-amber-100' : 'df-tab text-ash-300'" @click="tab = m.id">{{ label(m) }}</button>
    </div>
    <div v-show="!worldTab" class="overflow-auto"><canvas ref="cv" class="pix block" data-testid="local-map-canvas" @mousemove="point" @mouseleave="pointed=undefined" /></div>
    <p v-if="!worldTab&&pointedInfo" class="mt-1 text-xs text-ash-300" data-testid="local-map-observation">{{ pointedInfo }}</p>
    <div v-show="!worldTab" class="mt-2 space-y-1 text-[11px]" data-testid="map-documents">
      <p v-if="documents.length||claims.length||stairLocations.length" class="text-ash-400">실선: 직접 본 방/계단 · 파란 점선: 지도 · 호박색 점선: 들은 위치 · 붉은 점선: 서로 다른 주장. 지도의 작성 뒤 변화는 반영되지 않는다.</p>
      <div v-for="d in documents" :key="d.id" class="border-t border-ash-600 pt-1" :data-testid="'map-document-'+d.id"><p>{{ d.document.title }} · 신뢰도 {{ d.document.reliability }} · {{ d.ageDays }}일 전 · 오차 ±{{ d.document.error }}칸</p><p class="text-ash-400">{{ d.source }} · 작성자 {{ d.document.author }}<span v-if="!d.document.rooms.length"> · 그려진 방이 없다</span></p></div>
      <p v-for="c in claims" :key="c.documentId+':'+c.index" :class="c.conflict?'text-blood-300':'text-ash-300'" data-testid="map-claim">{{ c.name }} · {{ c.status==='verified'?'직접 확인':c.status==='contradicted'?'직접 본 위치와 다름':c.origin==='rumor'?'전해 들은 위치 (미확인)':'지도 주장 (미확인)' }}<span v-if="c.conflict"> · 위치 기록끼리 충돌</span><span v-if="c.origin==='rumor'" class="block text-ash-400">{{ c.source }} · 기록 {{ fmtClock(c.writtenAt) }}</span></p>
      <p v-for="c in stairLocations" :key="'stairs:'+c.documentId+':'+c.index" :class="c.conflict?'text-blood-300':'text-ash-300'" data-testid="map-stair-claim">계단: {{ c.label }} · {{ c.status==='verified'?'직접 확인':c.status==='contradicted'?'직접 본 기록과 다름':c.origin==='rumor'?'전해 들은 위치 (미확인)':'지도 주장 (미확인)' }}<span v-if="c.conflict"> · 같은 자리의 계단 기록끼리 충돌</span><span class="block text-ash-400">{{ c.source }} · 기록 {{ fmtClock(c.writtenAt) }}</span></p>
      <p v-for="c in landmarks" :key="'landmark:'+c.documentId+':'+c.index" :class="c.conflict?'text-blood-300':'text-ash-300'" data-testid="map-water-claim">물 지형/시설: {{ c.label }} · {{ c.status==='verified'?'직접 본 기록과 일치':c.status==='contradicted'?'직접 본 기록과 다름':'지도 주장 (미확인)' }}<span v-if="c.conflict"> · 같은 자리의 기록끼리 충돌</span><span class="block text-ash-400">{{ c.source }} · 기록 {{ fmtClock(c.writtenAt) }} · 수질/현재 물량은 직접 확인해야 한다.</span></p>
    </div>
    <MapWritingPanel v-if="!worldTab" />
    <div v-show="!worldTab" class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
      <span v-for="r in rooms" :key="r.name" class="text-ash-300">{{ r.name }}<span v-if="r.cleared" class="ml-1 text-ash-500">({{ r.cleared }})</span></span>
      <span v-if="!rooms.length" class="text-ash-500">아직 직접 찾은 방이 없다.</span>
    </div>
  </Win>
</template>
