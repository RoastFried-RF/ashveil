<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { allItems,itemDef,metabolicSize,nutritionDef,eq, observedCaravans, observedRoadRaids, player, settlementEntryError, seaRoute, worldIndex, worldRoute, type BiomeDef, type Pos, type RegionSiteDef, type World } from '../../core'
import {drinkVolume} from '../../core/wash-water'
import { simulating, version, world } from '../store'
import { doAct, hint } from '../ui'
import {worldObservation,worldSurveyError} from '../../core/world-observations'
import {fmtClock,type FactionDef} from '../../core'
import {knownWorldMapDocuments,worldMapClaims,worldWithKnownTerrain} from '../../core/world-cartography'
import WorldMapWritingPanel from './WorldMapWritingPanel.vue'
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
const territoryLabel=(key?:string)=>key?w.value.db.all<FactionDef>('Faction').find(f=>f.key===key)?.label??'알 수 없는 세력':undefined
const showTerritories=ref(false)
const nearby=ref(false)
const viewport=computed(()=>{const map=m.value,center=selected.value??map.position,width=nearby.value?Math.min(16,map.w):map.w,height=nearby.value?Math.min(12,map.h):map.h;return{x:nearby.value?Math.max(0,Math.min(map.w-width,center.x-Math.floor(width/2))):0,y:nearby.value?Math.max(0,Math.min(map.h-height,center.y-Math.floor(height/2))):0,w:width,h:height,px:nearby.value?40:5}})
const surveyError=computed(()=>{void version.value;return worldSurveyError(w.value)})
const paperMaps=computed(()=>{void version.value;return knownWorldMapDocuments(w.value)})
const paperClaims=computed(()=>{void version.value;return worldMapClaims(w.value)})
const selectedClaims=computed(()=>{const pos=selected.value;return pos?paperClaims.value.filter(o=>o.index===worldIndex(m.value,pos)):[]})
const hours = (n: number) => { const minutes = Math.ceil(n * 60); return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` }
const reserveHours=ref(6)
const provision=computed(()=>{
 void version.value
 if(!route.value||!selected.value||eq(selected.value,m.value.position))return
 const c=player(w.value),rule=nutritionDef(w.value),items=allItems(c),time=route.value.hours+reserveHours.value
 const kcal=items.reduce((n,i)=>n+(itemDef(w.value,i).food?.kcal??0)*i.count,0)
 const water=items.filter(i=>!itemDef(w.value,i).drink?.alcohol&&!i.waterFrozen).reduce((n,i)=>n+drinkVolume(w.value,i),0)
 return{time,kcal:Math.floor(kcal),water:Math.floor(water),needKcal:Math.ceil(rule.kcalPerDay*metabolicSize(w.value,c)*rule.activity.walk*time/24),needWater:Math.ceil(rule.waterPerDay*time/24)}
})
function choose(p: Pos) { selected.value = { ...p } }
function pick(e: MouseEvent) {
  const rect = cv.value!.getBoundingClientRect()
  const v=viewport.value,x=v.x+Math.floor((e.clientX-rect.left)*v.w/rect.width),y=v.y+v.h-1-Math.floor((e.clientY-rect.top)*v.h/rect.height)
  if (x >= 0 && y >= 0 && x < m.value.w && y < m.value.h) choose({ x, y })
}
function travel() { if (selected.value) doAct({ type: 'travel', target: selected.value }) }
function draw() {
  const c = cv.value
  if (!c) return
  const map = m.value, g = c.getContext('2d')!,v=viewport.value,PX=v.px
  const drawX=(x:number)=>(x-v.x)*PX,drawY=(y:number)=>(v.y+v.h-1-y)*PX
  c.width = v.w * PX; c.height = v.h * PX
  g.fillStyle = '#12120f'; g.fillRect(0, 0, c.width, c.height)
  for(const claim of paperClaims.value){if(worldObservation(w.value,claim.index))continue;g.fillStyle=claim.conflict?'#a65e58':claim.origin==='rumor'?'#b59058':'#54738a';g.fillRect(drawX(claim.x),drawY(claim.y),PX,PX)}
  map.cells.forEach((_, i) => {
    if (!seen.value.has(i)) return
    const cell=worldObservation(w.value,i)?.cell
    if(!cell){if(!paperClaims.value.some(c=>c.index===i)){g.fillStyle='#403f38';g.fillRect(drawX(i%map.w),drawY(Math.floor(i/map.w)),PX,PX)}return}
    g.fillStyle = cell.sea ? '#253f51' : w.value.db.get<BiomeDef>(cell.biome).color
    const x = drawX(i%map.w), y = drawY(Math.floor(i/map.w))
    g.fillRect(x, y, PX, PX)
    if(showTerritories.value&&cell.territory){
      // 원격 현재 소유권은 읽지 않는다. 관찰 기록 사이의 경계만 표시한다.
      g.strokeStyle='#cbb693';g.lineWidth=1;g.beginPath()
      for(const[dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
        const nx=i%map.w+dx,ny=Math.floor(i/map.w)+dy
        if(nx<0||ny<0||nx>=map.w||ny>=map.h)continue
        const other=worldObservation(w.value,ny*map.w+nx)?.cell
        if(!other?.territory||other.territory===cell.territory)continue
        if(dx<0){g.moveTo(x,y);g.lineTo(x,y+PX)}else if(dx>0){g.moveTo(x+PX,y);g.lineTo(x+PX,y+PX)}else if(dy<0){g.moveTo(x,y+PX);g.lineTo(x+PX,y+PX)}else{g.moveTo(x,y);g.lineTo(x+PX,y)}
      }
      g.stroke()
    }
    if (cell.river || cell.lake) { g.fillStyle = '#628492'; g.fillRect(x,y+Math.floor(PX*.4),PX,Math.max(2,Math.floor(PX*.3))) }
    if (cell.road) { g.fillStyle = '#c6b588'; g.fillRect(x+Math.floor(PX*.4),y+Math.floor(PX*.4),Math.max(2,Math.floor(PX*.2)),Math.max(2,Math.floor(PX*.2))) }
  })
  g.strokeStyle = '#e4bb65'; g.lineWidth = 2; g.beginPath()
  for (const [i, p] of [map.position, ...(route.value?.cells ?? [])].entries()) { const x = drawX(p.x)+PX/2, y = drawY(p.y)+PX/2; if (!i) g.moveTo(x, y); else g.lineTo(x, y) }
  g.stroke()
  for (const s of known.value) { g.fillStyle = map.visited.includes(s.id) ? '#dfcf9b' : '#93856c'; g.fillRect(drawX(s.cell.x)-1,drawY(s.cell.y)-1, PX + 2, PX + 2) }
  for(const convoy of observedCaravans(w.value)){g.fillStyle='#dd9a52';g.beginPath();g.arc(drawX(convoy.position.x)+PX/2,drawY(convoy.position.y)+PX/2,3,0,2*Math.PI);g.fill()}
  g.fillStyle = '#fff'; g.beginPath(); g.arc(drawX(map.position.x)+PX/2,drawY(map.position.y)+PX/2, 4, 0, 2 * Math.PI); g.fill()
  if (selected.value) { g.strokeStyle = '#ffd779'; g.strokeRect(drawX(selected.value.x)-2,drawY(selected.value.y)-2, PX + 4, PX + 4) }
}
onMounted(() => { selected.value = { ...m.value.position }; nextTick(draw) })
watch([version, selected,showTerritories,nearby], () => nextTick(draw))
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
      <p v-if="cell" class="text-ash-300" data-testid="world-territory">{{ cell.territory?'당시 영향권: '+territoryLabel(cell.territory):'당시 영향권 기록 없음' }}</p>
      <p v-else class="text-ash-400" data-testid="world-unrecorded">지형과 관찰 시각이 남아 있지 않다. 직접 살펴보거나 여행해서 기록하자.</p>
      <p v-for="claim in selectedClaims" :key="claim.claimId" :class="claim.status==='contradicted'||claim.conflict?'text-red-300':claim.origin==='rumor'?'text-amber-200':'text-sky-300'" data-testid="world-map-claim" :data-origin="claim.origin">{{ claim.title }} · {{ w.db.get<BiomeDef>(claim.cell.biome).label }} · 당시 장막{{ claim.cell.veil }}/기온{{ claim.cell.temperature }}°C · 관찰 {{ fmtClock(claim.seenAt) }} · {{ claim.origin==='document'?'작성':'보고 원기록' }} {{ fmtClock(claim.writtenAt) }} · {{ claim.source }}<span v-if="claim.origin==='document'"> · 신뢰도{{ claim.reliability }}/오차±{{ claim.error }}</span> · {{ claim.status==='verified'?'직접 본 기록과 일치':claim.status==='contradicted'?'직접 본 기록과 다름':'미확인 주장' }}{{ claim.conflict?' · 기록끼리 충돌':'' }}</p>
      <p v-if="route">{{ route.cells.length * 2 }}km · 예상{{ hours(route.hours) }} {{ w.s.map.vessel?'(노 젓기·날씨에 따른 바닷길)':'(당시 관찰/종이 지도 기록으로 예상)' }}</p>
      <section v-if="provision" class="route-provisions" aria-label="여행 보급 예상" data-testid="route-provisions">
        <div class="route-provisions-head"><strong>길을 떠나기 전에</strong><label>여유 <select v-model.number="reserveHours" aria-label="여행 여유 시간"><option :value="0">없음</option><option :value="6">6시간</option><option :value="12">12시간</option><option :value="24">하루</option></select></label></div>
        <div class="route-provision-grid"><div :class="{'is-short':provision.kcal<provision.needKcal}"><span>음식 열량</span><strong>{{ provision.kcal.toLocaleString() }} <small>kcal</small></strong><p>기본 필요 약 {{ provision.needKcal.toLocaleString() }}kcal</p></div><div :class="{'is-short':provision.water<provision.needWater}"><span>지닌 음료</span><strong>{{ provision.water.toLocaleString() }} <small>ml</small></strong><p>기본 필요 약 {{ provision.needWater.toLocaleString() }}ml</p></div></div>
        <p class="route-provision-note">예상 이동+여유 {{ hours(provision.time) }} 기준. 음식의 생식·부패, 물의 수질을 확인하자. 추위·더위·부상·질병은 소모를 늘린다.</p>
      </section>
      <p v-else class="text-ash-400">{{ w.s.map.vessel?'배로 갈 바닷길과 부두를 확인하자.':'기록된 지형만으로 경로를 예상할 수 없다. 실제로 여행하며 확인할 수 있다.' }}</p>
      <button v-if="!m.currentRegion && selected && !eq(selected,m.position)" class="dbtn-gold" :disabled="simulating" data-testid="world-travel" @click="travel">{{ w.s.map.vessel?'이곳으로 배 젓기':'이곳으로 걷기' }}</button>
      <button v-if="!m.currentRegion && m.travel && !player(w).activity" class="dbtn" :disabled="simulating" data-testid="resume-world-travel" @click="doAct({ type: 'travel', target: m.travel.destination })">가던 길 계속 ({{ hours(m.travel.totalRemaining / 1200) }})</button>
    </div>
    <button v-if="player(w).activity?.kind === 'travel'" class="dbtn" data-testid="stop-world-travel" @click="doAct({ type: 'stopActivity' })">{{ w.s.map.vessel?'노 젓기 멈추기':'걸음 멈추기' }}</button>
    <p v-if="m.travel" class="text-amber-200">다음 칸까지{{ hours(m.travel.segmentRemaining / 1200) }} · 허기·갈증·추위가 심해지면 멈춘다. 다른 행동으로 쉬어도 이동 진척은 남는다.</p>
    <p v-if="hint" class="text-red-300">{{ hint }}</p>
    <div class="flex flex-wrap items-center gap-2"><button class="dbtn" data-testid="world-map-nearby" :aria-pressed="nearby" @click="nearby=!nearby">{{ nearby?'전체 지도':'선택 지점 확대' }}</button><button class="dbtn" data-testid="world-map-current" @click="choose(m.position)">내 위치</button><span class="text-ash-400">{{ nearby?'확대 · 한 칸 2km':'전체 · 한 칸 2km' }}</span></div>
    <label class="flex items-center gap-2 text-ash-300"><input v-model="showTerritories" type="checkbox" data-testid="world-territory-toggle">기록된 영향권 경계 표시</label>
    <div class="max-h-[46vh] overflow-auto"><canvas ref="cv" :data-origin-x="viewport.x" :data-origin-y="viewport.y" :data-cells-w="viewport.w" :data-cells-h="viewport.h" class="pix block cursor-crosshair" aria-label="세계 지도. 아래 지명 버튼으로도 목적지를 고를 수 있다." @click="pick" /></div>
    <p v-if="observedCaravans(w).length" class="text-amber-200" data-testid="world-caravans">지금 보이는 실제 교역 무리 {{ observedCaravans(w).length }}개 · 같은 월드 칸의 바깥길에서 만난다.</p>
    <p v-if="observedRoadRaids(w).length" class="text-amber-200" data-testid="world-road-raids">지금 시야에 들어온 길목 무리 {{ observedRoadRaids(w).length }}개</p>
    <div><button class="dbtn" data-testid="survey-world" :disabled="simulating||!!surveyError" @click="doAct({type:'surveyWorld'})">주변 월드 지형 기록 갱신 (1턴)</button><p v-if="surveyError" class="text-ash-400">{{ surveyError }}</p></div>
    <p class="text-ash-400">북쪽 ↑ · 한 칸 2km · 밝은 점: 도로 · 지형은 여행하며 기록된다.</p>
    <p v-for="doc in paperMaps" :key="doc.id" class="text-sky-300" data-testid="world-map-document">{{ doc.document.title }} · {{ doc.source }} · 작성 {{ fmtClock(doc.document.writtenAt) }} · {{ doc.document.cells.length }}칸 · 신뢰도{{ doc.document.reliability }}/오차±{{ doc.document.error }}</p>
    <WorldMapWritingPanel />
  </div>
</template>

<style scoped>
.route-provisions{margin-block:10px;border:1px solid #5a503b;background:#1b1d17;padding:12px}.route-provisions-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.route-provisions-head strong{font-size:12px;font-weight:400;color:#d5c7a5}.route-provisions-head label{font-size:10px;color:#a79a7c}.route-provisions-head select{background:#24241c;border:1px solid #64573e;color:#d3c49f;padding:3px 6px;margin-left:5px}.route-provision-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.route-provision-grid>div{border-left:2px solid #6c805b;padding-left:9px}.route-provision-grid span{display:block;font-size:10px;color:#a5aa90}.route-provision-grid strong{display:block;font-size:18px;font-weight:400;color:#d9d1ae;margin-top:3px}.route-provision-grid small{font-size:10px}.route-provision-grid p{font-size:10px;color:#9b967f;margin-top:3px}.route-provision-grid .is-short{border-color:#bb8757}.route-provision-grid .is-short strong{color:#dcad7e}.route-provision-note{font-size:10px;line-height:1.7;color:#a49a80;margin-top:12px}
</style>
