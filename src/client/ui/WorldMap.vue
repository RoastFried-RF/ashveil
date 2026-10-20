<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { eq, observedCaravans, observedRoadRaids, player, settlementEntryError, seaRoute, worldIndex, worldRoute, type BiomeDef, type Pos, type RegionSiteDef, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct, hint } from '../ui'
import {worldObservation,worldSurveyError} from '../../core/world-observations'
import {fmtClock} from '../../core'
import {knownWorldMapDocuments,worldMapClaims,worldWithKnownTerrain} from '../../core/world-cartography'
import WorldMapWritingPanel from './WorldMapWritingPanel.vue'
const PX = 5
const cv = ref<HTMLCanvasElement>()
const selected = ref<Pos>()
const w = computed(() => { void version.value; return world.value as World })
const m = computed(() => { void version.value; return { ...w.value.s.overworld! } })
const seen = computed(() => new Set(m.value.seen))
const known = computed(() => m.value.sites.filter((s) => !!w.value.db.tryGet<RegionSiteDef>(s.id) || seen.value.has(worldIndex(m.value, s.cell))))
const site = computed(() => known.value.find((s) => selected.value && eq(s.cell, selected.value)))
const route = computed(() => selected.value ? (w.value.s.map.vessel?seaRoute(w.value,m.value.position,selected.value):worldRoute(worldWithKnownTerrain(w.value), m.value.position, selected.value)) : null)
const here = computed(() => m.value.sites.find((s) => eq(s.cell, m.value.position)))
const gateError = computed(() => { void version.value; return here.value ? settlementEntryError(w.value, here.value.id) : null })
const atExit = computed(() => { void version.value; return w.value.s.map.exits.some((p) => eq(p, player(w.value).pos)) })
const observation = computed(() => selected.value ?worldObservation(w.value,worldIndex(m.value,selected.value)):undefined)
const cell = computed(() => observation.value?.cell)
const surveyError=computed(()=>{void version.value;return worldSurveyError(w.value)})
const paperMaps=computed(()=>{void version.value;return knownWorldMapDocuments(w.value)})
const paperClaims=computed(()=>{void version.value;return worldMapClaims(w.value)})
const selectedClaims=computed(()=>{const pos=selected.value;return pos?paperClaims.value.filter(o=>o.index===worldIndex(m.value,pos)):[]})
const hours = (n: number) => { const minutes = Math.ceil(n * 60); return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` }
function choose(p: Pos) { selected.value = { ...p } }
function pick(e: MouseEvent) {
  const rect = cv.value!.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) * m.value.w / rect.width), y = m.value.h - 1 - Math.floor((e.clientY - rect.top) * m.value.h / rect.height)
  if (x >= 0 && y >= 0 && x < m.value.w && y < m.value.h) choose({ x, y })
}
function travel() { if (selected.value) doAct({ type: 'travel', target: selected.value }) }
function draw() {
  const c = cv.value
  if (!c) return
  const map = m.value, g = c.getContext('2d')!
  c.width = map.w * PX; c.height = map.h * PX
  g.fillStyle = '#12120f'; g.fillRect(0, 0, c.width, c.height)
  for(const claim of paperClaims.value){if(worldObservation(w.value,claim.index))continue;g.fillStyle=claim.conflict?'#a65e58':claim.origin==='rumor'?'#b59058':'#54738a';g.fillRect(claim.x*PX,(map.h-1-claim.y)*PX,PX,PX)}
  map.cells.forEach((_, i) => {
    if (!seen.value.has(i)) return
    const cell=worldObservation(w.value,i)?.cell
    if(!cell){if(!paperClaims.value.some(c=>c.index===i)){g.fillStyle='#403f38';g.fillRect((i%map.w)*PX,(map.h-1-Math.floor(i/map.w))*PX,PX,PX)}return}
    g.fillStyle = cell.sea ? '#253f51' : w.value.db.get<BiomeDef>(cell.biome).color
    const x = i % map.w * PX, y = (map.h - 1 - Math.floor(i / map.w)) * PX
    g.fillRect(x, y, PX, PX)
    if (cell.river || cell.lake) { g.fillStyle = '#628492'; g.fillRect(x, y + 2, PX, 2) }
    if (cell.road) { g.fillStyle = '#c6b588'; g.fillRect(x + 2, y + 2, 2, 2) }
  })
  g.strokeStyle = '#e4bb65'; g.lineWidth = 2; g.beginPath()
  for (const [i, p] of [map.position, ...(route.value?.cells ?? [])].entries()) { const x = (p.x + .5) * PX, y = (map.h - p.y - .5) * PX; if (!i) g.moveTo(x, y); else g.lineTo(x, y) }
  g.stroke()
  for (const s of known.value) { g.fillStyle = map.visited.includes(s.id) ? '#dfcf9b' : '#93856c'; g.fillRect(s.cell.x * PX - 1, (map.h - 1 - s.cell.y) * PX - 1, PX + 2, PX + 2) }
  for(const convoy of observedCaravans(w.value)){g.fillStyle='#dd9a52';g.beginPath();g.arc((convoy.position.x+.5)*PX,(map.h-convoy.position.y-.5)*PX,3,0,2*Math.PI);g.fill()}
  g.fillStyle = '#fff'; g.beginPath(); g.arc((map.position.x + .5) * PX, (map.h - map.position.y - .5) * PX, 4, 0, 2 * Math.PI); g.fill()
  if (selected.value) { g.strokeStyle = '#ffd779'; g.strokeRect(selected.value.x * PX - 2, (map.h - 1 - selected.value.y) * PX - 2, PX + 4, PX + 4) }
}
onMounted(() => { selected.value = { ...m.value.position }; nextTick(draw) })
watch([version, selected], () => nextTick(draw))
</script>

<template>
  <div class="space-y-2 text-xs" data-testid="world-map">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-amber-100">{{ w.s.map.vessel?'배 위':m.currentRegion ? here?.label : '바깥길' }} · ({{ m.position.x }}, {{ m.position.y }})</span>
      <button v-if="m.currentRegion" class="dbtn" :disabled="!atExit || simulating" data-testid="depart-region" @click="doAct({ type: 'leave' })">바깥길로 나가기</button>
      <button v-else-if="here" class="dbtn-gold" :disabled="simulating || !!gateError" data-testid="enter-region" @click="doAct({ type: 'enterRegion' })">{{ w.s.map.vessel?here.label+' 부두에 내리기':here.label+'에 들어가기' }}</button>
      <span v-if="m.currentRegion && !atExit" class="text-ash-400">지상 출입구에서 떠날 수 있다.</span>
    </div>
    <p v-if="gateError && !m.currentRegion" class="text-red-300" data-testid="settlement-quarantine">{{ gateError }}</p>
    <div class="flex flex-wrap gap-1"><button v-for="s in known" :key="s.id" class="dbtn" :class="site?.id === s.id ? 'text-amber-100' : 'text-ash-300'" :data-site="s.id" @click="choose(s.cell)">{{ s.label }}</button></div>
    <div v-if="selected" class="df df-tab space-y-1 p-2" data-testid="world-route">
      <p class="text-amber-100">{{ site?.label ?? '미지의 길목' }} ({{ selected.x }}, {{ selected.y }})</p>
      <p v-if="site" class="text-ash-300">{{ site.description }}</p>
      <p v-if="cell" class="text-ash-300" data-testid="world-observation">{{ w.db.get<BiomeDef>(cell.biome).label }} · 고도{{ cell.altitude }}m · 당시 기저 장막{{ cell.veil }} · 당시 연평균{{ cell.temperature }}°C · {{ observation!.source==='initial'?'처음 지니고 있던 지리 기록':observation!.source==='arrival'?'도착 때 살펴본 지형':'직접 살펴본 지형' }} · 기록 {{ fmtClock(observation!.at) }}</p>
      <p v-else class="text-ash-400" data-testid="world-unrecorded">지형과 관찰 시각이 남아 있지 않다. 직접 살펴보거나 여행해서 기록하자.</p>
      <p v-for="claim in selectedClaims" :key="claim.claimId" :class="claim.status==='contradicted'||claim.conflict?'text-red-300':claim.origin==='rumor'?'text-amber-200':'text-sky-300'" data-testid="world-map-claim" :data-origin="claim.origin">{{ claim.title }} · {{ w.db.get<BiomeDef>(claim.cell.biome).label }} · 당시 장막{{ claim.cell.veil }}/기온{{ claim.cell.temperature }}°C · 관찰 {{ fmtClock(claim.seenAt) }} · {{ claim.origin==='document'?'작성':'보고 원기록' }} {{ fmtClock(claim.writtenAt) }} · {{ claim.source }}<span v-if="claim.origin==='document'"> · 신뢰도{{ claim.reliability }}/오차±{{ claim.error }}</span> · {{ claim.status==='verified'?'직접 본 기록과 일치':claim.status==='contradicted'?'직접 본 기록과 다름':'미확인 주장' }}{{ claim.conflict?' · 기록끼리 충돌':'' }}</p>
      <p v-if="route">{{ route.cells.length * 2 }}km · 예상{{ hours(route.hours) }} {{ w.s.map.vessel?'(노 젓기·날씨에 따른 바닷길)':'(당시 관찰/종이 지도 기록으로 예상)' }}</p>
      <p v-else class="text-ash-400">{{ w.s.map.vessel?'배로 갈 바닷길과 부두를 확인하자.':'기록된 지형만으로 경로를 예상할 수 없다. 실제로 여행하며 확인할 수 있다.' }}</p>
      <button v-if="!m.currentRegion && selected && !eq(selected,m.position)" class="dbtn-gold" :disabled="simulating" data-testid="world-travel" @click="travel">{{ w.s.map.vessel?'이곳으로 배 젓기':'이곳으로 걷기' }}</button>
      <button v-if="!m.currentRegion && m.travel && !player(w).activity" class="dbtn" :disabled="simulating" data-testid="resume-world-travel" @click="doAct({ type: 'travel', target: m.travel.destination })">가던 길 계속 ({{ hours(m.travel.totalRemaining / 1200) }})</button>
    </div>
    <button v-if="player(w).activity?.kind === 'travel'" class="dbtn" data-testid="stop-world-travel" @click="doAct({ type: 'stopActivity' })">{{ w.s.map.vessel?'노 젓기 멈추기':'걸음 멈추기' }}</button>
    <p v-if="m.travel" class="text-amber-200">다음 칸까지{{ hours(m.travel.segmentRemaining / 1200) }} · 허기·갈증·추위가 심해지면 멈춘다. 다른 행동으로 쉬어도 이동 진척은 남는다.</p>
    <p v-if="hint" class="text-red-300">{{ hint }}</p>
    <div class="max-h-[46vh] overflow-auto"><canvas ref="cv" class="pix block cursor-crosshair" aria-label="세계 지도. 아래 지명 버튼으로도 목적지를 고를 수 있다." @click="pick" /></div>
    <p v-if="observedCaravans(w).length" class="text-amber-200" data-testid="world-caravans">지금 보이는 실제 교역 무리 {{ observedCaravans(w).length }}개 · 같은 월드 칸의 바깥길에서 만난다.</p>
    <p v-if="observedRoadRaids(w).length" class="text-amber-200" data-testid="world-road-raids">지금 시야에 들어온 길목 무리 {{ observedRoadRaids(w).length }}개</p>
    <div><button class="dbtn" data-testid="survey-world" :disabled="simulating||!!surveyError" @click="doAct({type:'surveyWorld'})">주변 월드 지형 기록 갱신 (1턴)</button><p v-if="surveyError" class="text-ash-400">{{ surveyError }}</p></div>
    <p class="text-ash-400">북쪽 ↑ · 한 칸 2km · 밝은 점: 도로 · 지형은 여행하며 기록된다.</p>
    <p v-for="doc in paperMaps" :key="doc.id" class="text-sky-300" data-testid="world-map-document">{{ doc.document.title }} · {{ doc.source }} · 작성 {{ fmtClock(doc.document.writtenAt) }} · {{ doc.document.cells.length }}칸 · 신뢰도{{ doc.document.reliability }}/오차±{{ doc.document.error }}</p>
    <WorldMapWritingPanel />
  </div>
</template>
