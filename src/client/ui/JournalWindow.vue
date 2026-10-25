<script setup lang="ts">
// 일지: 기록(전체 로그) · 도감 · 약 · 생존 상태
import { computed, ref } from 'vue'
import {contractPlace} from '../contract-place'
import {interactionRows} from '../../core/interactions'
import {
  excavationDef, excavationWorkQuote, escortVisitQuote, patrolVisitQuote, factionDef,anatomicalMissing, infectionAt, infectionSystemic, nutritionDef, fatigueBand, channelTurns,prisonerSightings,rescueRemainsQuote,sourceSurveyQuote,bountyEvidenceQuote,investigationSurveyQuote, economyDef, bestiaryKnown, bestiaryEntry, bestiaryStage, bestiaryDetails, bestiaryBody, pillBelief, drugLines, nearbyIce, nearbySnow, calendar, veilConcentration, sunTimes, washSupply, foodSafetyDef, handHygieneDef, handState, washHandsError, hasEffect, beddingAt, hungerBand, nutritionLines, nutritionProgress, thirstBand, activeThoughts, fmtClock, mood, player, sleepQuality, sleepRecoveryPerHour, turnOf, TURNS_PER_DAY,
  residentWarmthDef, warmthError, towerGardenAlert, towerSoilFertility, shutdownProgress, type CreatureDef, type ItemDef, type World,
} from '../../core'
import { KIND_CLASS } from '../format'
import { temperatureTip } from '../info'
import { act, simulating, version, world } from '../store'
import {journalSection as tab,trackedContract,wins} from '../ui'
import Bar from './Bar.vue'
import Win from './Win.vue'
import NpcRelationsPanel from './NpcRelationsPanel.vue'
import StoryDirectorPanel from './StoryDirectorPanel.vue'
import ExpeditionEndingsPanel from './ExpeditionEndingsPanel.vue'
import ResearchPanel from './ResearchPanel.vue'
import CarePlanOverview from './CarePlanOverview.vue'

// 탭 (12 §2.3): 지식 · 도감 · 소문 · 사건 · 연대기 (+ 생존 상태 · 전체 기록)
type Tab = 'research' | 'endings' | 'prisoners' | 'interactions' | 'contracts' | 'log' | 'beast' | 'pill' | 'needs' | 'rumor' | 'events' | 'chron' | 'medical'
const contractQuery=ref('')
const contractStatus=ref<'active'|'all'|'closed'>('active')
const TABS: [Tab, string][] = [['needs', '생존'], ['contracts','계약'], ['prisoners','구조 단서'], ['pill', '지식'], ['interactions','상호작용'], ['beast', '도감'], ['medical', '진료'], ['rumor', '소문'], ['events', '사건'], ['research','실마리'], ['endings','갈림길'], ['chron', '연대기'], ['log', '기록']]
const EVENT_LABEL: Record<string, string> = { 'Event.ReaverPatrol': '약탈자 순찰', 'Event.ReaverSearch': '약탈자 수색대 출발', 'Event.StashRaided': '야영지 보관함 약탈', 'Event.Reoccupy': '던전 재점거' }

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const k = w.s.knowledge
  const n = pl.needs
  const parts=w.db.body(pl.body.def).parts
  const local=infectionAt(w,Math.max(0,...pl.body.wounds.filter(wd=>!wd.internal&&!parts.find(p=>p.id===wd.part)?.internal&&!anatomicalMissing(w,pl,wd.part)).map(wd=>wd.infection?.progress??0)))
  const systemic=infectionSystemic(w,pl),infection=systemic.metabolicFever?systemic:local
  return {
    place:(region:string,mapId:string)=>contractPlace(w,region,mapId),
    neighborSources:Object.values(w.s.knowledge.npcRelations??{}).sort((a,b)=>b.at-a.at).map(r=>r.source),
    rescueRemains:(id:string)=>rescueRemainsQuote(w,pl,id), interactions:interactionRows(w,pl), prisonerSightings:prisonerSightings(w),
    infection:infection.at>0?infection:undefined, infectionWater:infection.metabolicFever?nutritionDef(w).feverWaterPerDay:0,
    mapName:(region:string,id:string)=>{const m=w.s.overworld,scene=m?.currentRegion===region?w.s:m?.scenes[region];return(scene?.map.id===id?scene.map:scene?.maps[id])?.name??'알려진 현장'},
    excavationTools:w.db.all<ItemDef>('Item').filter(i=>i.toolTags?.includes(excavationDef(w).tool)).map(i=>i.label).join(' / '),
    excavation:(id:string)=>excavationWorkQuote(w,pl,id),
    escort:(id:string)=>escortVisitQuote(w,pl,id),
    patrol:(id:string)=>patrolVisitQuote(w,pl,id),
    sourceContract:(id:string)=>sourceSurveyQuote(w,pl,id),
    bounty: (id:string)=>bountyEvidenceQuote(w,pl,id),
    investigation: (id:string)=>investigationSurveyQuote(w,pl,id),
    contracts: [...(w.s.overworld?.contracts??[])].reverse(), currency:economyDef(w).currency,
    now:turnOf(w),
    log: w.s.log.slice(-200).reverse(),
    medical: [...(pl.medicalReports ?? [])].reverse(),
    fieldNotes:pl.fieldNotes??[],
    bookNotes:(pl.booksRead??[]).flatMap(id=>{const item=w.db.item(id);return item.book?.note&&(pl.literacyBooks??pl.booksRead??[]).includes(id)&&!pl.misreadBooks?.includes(id)?[{id,label:item.label,note:item.book.note}]:[]}),
    pills: w.db.all<ItemDef>('Item').filter((i) => i.unidentified === 'pill').map((i) => { const b = pillBelief(w,i.id); return { id: i.id, label: i.label, known: b?.belief ? w.db.pill(b.belief) : null, confidence: b?.confidence, excluded: (b?.ruledOut ?? []).map((id) => w.db.pill(id).label).join(', '), evidence: b?.evidence ?? [] } }),
    beasts: [...w.db.all<CreatureDef>('Creature'),...w.db.all<import('../../core/types').SwarmDef>('Swarm')].filter((c) => !c.abstract && !!bestiaryEntry(w,c.id) && bestiaryKnown(w,c.id)).map((c) => {
      const b=k.bestiary[c.id],stage=bestiaryStage(w,c.id)
      return {c,b,stage,lines:bestiaryDetails(w,c.id),body:bestiaryBody(w,c.id)}
    }),
    needs: [
      ['칼로리 균형', 1 - nutritionProgress(w, pl, 'hunger'), 1, `${n.kcal.toFixed(0)} kcal · ${hungerBand(w, pl).label}`], ['수분 결손', 1 - nutritionProgress(w, pl, 'thirst'), 1, `${n.waterDeficit.toFixed(0)} ml · ${thirstBand(w, pl).label}`],
      ['재 축적', 100 - (n.ash ?? 0), 100, `${(n.ash ?? 0).toFixed(1)}${(n.ash ?? 0) >= 60 ? ' · 신장 손상 위험' : (n.ash ?? 0) >= 30 ? ' · 재 체기' : ''}`],
      ['단백 상태', n.protein, 100, n.protein.toFixed(0)], ['위생', n.hygiene, 100, n.hygiene.toFixed(0)], ['괴혈 진행', 100 - n.scurvy, 100, n.scurvy.toFixed(0)],
      ['비타민', n.vitamin, 100, n.vitamin.toFixed(0)], ['피로', 100 - n.fatigue, 100, `${n.fatigue.toFixed(0)}`], ['스트레스', 100 - n.stress, 100, n.stress.toFixed(0)],
    ] as [string, number, number, string][],
    drugs: drugLines(w, pl),
    nutrition: nutritionLines(w, pl),
    climate: w.s.overworld ? { label: calendar(w).season.label, day: calendar(w).seasonDay, veil: veilConcentration(w), sunrise: sunTimes(w).sunrise, sunset: sunTimes(w).sunset,stops:pl.fieldNotes?.some(n=>n.key==='chimney-seven-stopped')?w.s.overworld.towers.filter(t=>t.shutdown).map(t=>({id:t.id,progress:Math.round(shutdownProgress(t,turnOf(w))*100),neighbors:t.shutdown!.neighborBoosts.length})):[],alert:towerGardenAlert(w),fertility:Math.round(towerSoilFertility(w)*100) } : undefined,
    ice: !!nearbyIce(w, pl), snow: !!nearbySnow(w, pl),
    hygieneEnabled: w.s.hygieneEnabled !== false,
    wash: washSupply(w, pl).available,
    handState: { washed: '씻음', normal: '보통', dirty: '피·흙 묻음' }[handState(w, pl)],
    handWashError: washHandsError(w, pl), handRule: handHygieneDef(w),
    washTurns: channelTurns(w,pl,foodSafetyDef(w).washTurns),
    poisoning: pl.needs.poisoning ? `식중독: 약${Math.ceil((pl.needs.poisoning.until - turnOf(w)) / 1200)}시간 남음 · 예정 구토${pl.needs.poisoning.vomitAt.length}회` : hasEffect(pl, 'foodPoisoning', turnOf(w)) ? '식중독 증상' : '',
    lice: hasEffect(pl, 'lice', turnOf(w)),
    temperature: temperatureTip(w, pl),
    warmth: residentWarmthDef(w), warmthError: warmthError(w,pl),
    fatigue:w.db.body(pl.body.def).kind==='mechanical'?undefined:fatigueBand(w,pl),
    rest:100-n.fatigue,
    sleep: `침구 ${beddingAt(w, pl.pos).label} (젖음 ${beddingAt(w, pl.pos).wetness.toFixed(0)}%) · 수면 질 ${sleepQuality(w, pl).toFixed(2)} · 시간당 피로 회복 ${sleepRecoveryPerHour(w, pl).toFixed(1)} · 수면 부채 ${(n.sleepDebt ?? 0).toFixed(1)}시간`,
    books: (pl.booksRead ?? []).map((id) => w.db.item(id).label),
    frost: Object.entries(pl.frostbite ?? {}).filter(([, f]) => f.grade > 0).map(([id, f]) => `${w.db.body(pl.body.def).parts.find((p) => p.id === id)?.label ?? id} ${f.grade}도 · 노출 ${f.exposure.toFixed(1)}${f.frozen ? '' : ' · 해동'}`),
    mood: mood(w, pl), thoughts: activeThoughts(w, pl).sort((a, b) => a.mood - b.mood),
    clock: fmtClock(turnOf(w)),
    events: w.s.storyteller.history.slice(-40).reverse().map((e) => ({ when: fmtClock(e.turn), label: EVENT_LABEL[e.event] ?? e.event })),
    chron: pl.history.slice(-80).reverse().map((h) => ({ when: fmtClock(h.turn), text: h.text })),
    // 소문 (06 §7.3): 출처 단계와 작성 시점만 보인다. 정확도 수치는 숨긴다
    rumors: (k.rumors ?? []).slice().reverse().map((r) => ({
      text: r.text, src: r.source, stage: r.hop === 0 ? '목격자' : r.hop === 1 ? '전해 들음' : '떠도는 말',
      written: `${Math.max(0, Math.round((turnOf(w) - r.writtenAt) / TURNS_PER_DAY))}일 전쯤 쓰임`, found: fmtClock(r.foundAt),
      suspected:r.relay?.suspected?({count:'인원수',place:'장소',faction:'세력',when:'시점'}[r.relay.suspected]+' 이야기가 의심스럽다.'):undefined,
    })),
  }
})
const contracts=computed(()=>d.value.contracts.filter(r=>(contractStatus.value==='all'||(contractStatus.value==='active'?r.status==='active':r.status!=='active'))&&(!contractQuery.value.trim()||(r.label+' '+r.issuer).normalize('NFKC').toLocaleLowerCase('ko').includes(contractQuery.value.trim().normalize('NFKC').toLocaleLowerCase('ko')))).sort((a,b)=>Number(b.id===trackedContract.value)-Number(a.id===trackedContract.value)||Number(a.status!=='active')-Number(b.status!=='active')||a.deadline-b.deadline))
</script>

<template>
  <Win title="일지" :x="200" :y="90" :width="620" testid="win-journal" @close="wins.journal = false">
    <StoryDirectorPanel v-if="tab==='events'" />
    <div class="mb-2 flex flex-wrap gap-1">
      <button v-for="[k, l] in TABS" :key="k" class="df shrink-0 whitespace-nowrap px-2 text-xs" :class="tab === k ? 'df-tab-sel text-amber-100' : 'df-tab text-ash-300'" @click="tab = k">{{ l }}</button>
    </div>
    <div class="text-xs">
      <template v-if="tab==='research'"><ResearchPanel /></template>
      <template v-else-if="tab==='endings'"><ExpeditionEndingsPanel /></template>
      <template v-else-if="tab === 'needs'">
        <div class="mb-2 text-ash-400">{{ d.clock }}</div>
        <div v-for="[k, v, m, t] in d.needs" :key="k" class="mb-1 flex items-center gap-2">
          <span class="w-20 shrink-0 text-ash-400">{{ k }}</span>
          <div class="flex-1"><Bar :value="Math.max(0, v)" :max="m" :color="v / m > 0.4 ? 'green' : 'red'" :height="12" /></div>
          <span class="w-44 shrink-0 text-right font-mono text-[11px] text-ash-300">{{ t }}</span>
        </div>
        <div v-if="d.climate" class="my-2 space-y-1 text-xs" data-testid="climate-status">
          <p>{{ d.climate.label }}{{ d.climate.day }}일 · 장막{{ d.climate.veil }} · 일출{{ d.climate.sunrise.toFixed(1) }}시 / 일몰{{ d.climate.sunset.toFixed(1) }}시</p>
          <p v-for="stop in d.climate.stops" :key="stop.id" data-testid="tower-stop-status">정지한 탑의 장막 변화 {{ stop.progress }}% · 주변 {{ stop.neighbors }}개 탑의 분출 증가</p>
          <p v-if="d.climate.stops?.length" data-testid="tower-soil-status">현재 지역 비옥도 {{ d.climate.fertility }}% · 정원 경계 {{ d.climate.alert }} · 살포가 멎은 토양은2년 뒤부터 고갈된다.</p>
          <button v-if="d.ice" class="dbtn" data-testid="break-ice" @click="act({ type: 'breakIce' })">주변 얼음 깨기</button>
          <button v-if="d.snow" class="dbtn" data-testid="eat-snow" @click="act({ type: 'eatSnow' })">눈 먹기 (100ml·체온−0.05°C)</button>
        </div>
        <div class="my-2 flex items-center justify-between gap-2" data-testid="hygiene-controls">
          <label class="flex items-center gap-1"><input type="checkbox" :checked="d.hygieneEnabled" @change="act({ type: 'hygiene', enabled: ($event.target as HTMLInputElement).checked })" />위생 관리</label>
          <button class="dbtn text-xs" :disabled="!d.wash || d.washTurns===null" title="물가 또는 물2L 필요. 찬물 목욕은 젖음100·체온−0.3°C." @click="act({ type: 'wash' })">몸 씻기 (물2L · {{ d.washTurns }}턴)</button>
        </div>
        <p v-if="d.poisoning" class="text-blood-300" data-testid="poisoning-detail">{{ d.poisoning }}</p>
        <div class="my-2 text-xs" data-testid="hand-hygiene">
          <p>손: {{ d.handState }} · 씻음 Q +{{ d.handRule.washedBonus }} / 피·흙 Q {{ d.handRule.dirtyPenalty }}·상처 오염 +{{ d.handRule.dirtyContam }}</p>
          <button class="dbtn mt-1" :disabled="!!d.handWashError" :title="d.handWashError ?? '장갑과 청결 습관은 별도로 반영한다. 씻은 손은 다음 오염 또는1시간까지 유지된다.'" data-testid="wash-hands" @click="act({ type: 'washHands' })">손 씻기 ({{ d.handRule.waterMl }}ml · {{ d.handRule.washTurns }}턴)</button>
        </div>
        <p v-if="d.lice" class="text-blood-300" data-testid="body-lice">이로 몸이 가렵다. 수면 질이 떨어진다. 몸과 사용한 침구를 따로 씻어야 한다.</p>
        <div v-if="d.drugs.length" class="mt-2 space-y-1 text-ash-300" data-testid="drug-detail"><p v-for="line in d.drugs" :key="line">{{ line }}</p></div>
        <div class="mt-2 space-y-1 text-ash-300" data-testid="nutrition-detail"><p v-for="line in d.nutrition" :key="line">{{ line }}</p></div>
        <div class="mt-2 space-y-1 text-ash-300" data-testid="temperature-detail">
          <p v-for="line in d.temperature" :key="line">{{ line }}</p>
          <button v-if="d.warmth" class="dbtn" :disabled="!!d.warmthError" :title="d.warmthError ?? '실제 불 곁에서 몸을 움직인다. 열량과 피로를 쓰며 현재 옷·젖음·날씨에 따라 몸이 데워진다.'" data-testid="warm-by-fire" @click="act({ type: 'warmByFire' })">불 곁에서 몸 풀기 ({{ Math.ceil(d.warmth.turns / 20) }}분)</button>
        </div>
        <p class="mt-2 text-ash-300" data-testid="sleep-detail">{{ d.sleep }}</p>
        <p v-if="d.fatigue" class="mt-1 text-ash-300" data-testid="fatigue-physics">{{ d.fatigue.label }} · 휴식 {{ d.rest.toFixed(1) }} · 행동 시간 ×{{ d.fatigue.multiTurn }} · 의식 벌점 {{ (d.fatigue.consciousness*100).toFixed(0) }}% · 각성 +{{ d.fatigue.wake }} · 깊은 잠 +{{ d.fatigue.deepMinutes }}분 · 비틀거림 +{{ d.fatigue.stumble }}%</p>
        <p v-if="d.infection" class="mt-1 text-ash-300" data-testid="infection-physics">{{ d.infection.label }} · 해당 상처 치유 {{ d.infection.healing?'가능':'정지' }} · 전신 의식 부담 {{ (d.infection.consciousness*100).toFixed(0) }}% · 수면 질 ×{{ d.infection.sleep }} · 발열 추가 수분 {{ d.infectionWater }}ml/일</p>
        <p v-for="f in d.frost" :key="f" class="text-blue-300">{{ f }}</p>
        <div class="mt-2 font-title text-sm text-[#e8d7a8]">기분 {{ d.mood.toFixed(0) }}</div>
        <div v-for="t in d.thoughts" :key="t.def" :data-testid="'thought-'+t.def" class="flex justify-between"><span class="text-ash-300">{{ t.label }}<span v-if="t.remaining !== undefined" class="ml-1 text-[10px] text-ash-500">({{ t.remaining >= 1200 ? `${Math.ceil(t.remaining / 1200)}시간` : `${Math.ceil(t.remaining / 20)}분` }} 남음)</span></span><span class="font-mono" :class="t.mood < 0 ? 'text-blood-300' : 'text-moss-300'">{{ t.mood > 0 ? '+' : '' }}{{ t.mood }}</span></div>
      </template>
      <template v-else-if="tab === 'prisoners'">
        <p class="mb-2 text-ash-400">직접 확인하거나 목격자에게 전해 들은 마지막 모습이다. 그 뒤의 위치·포박·생사는 새로 확인하기 전에는 모른다.</p>
        <p v-if="!d.prisonerSightings.length" data-testid="prisoner-memory-empty">확인하거나 전해 들은 포로의 기록이 없다.</p>
        <article v-for="r in d.prisonerSightings" :key="r.id" class="my-2 border-b border-ash-700 pb-2" data-testid="prisoner-memory">
          <p v-if="r.heard" class="text-amber-200">{{ r.heard.fromName }}에게 {{ fmtClock(r.heard.at) }} {{ r.heard.kind==='interrogation'?'실제 심문으로':'대화로' }} 전해 들은 목격이다.</p><p v-else class="text-ash-400">직접 식별한 모습이다.</p>
          <p>{{ r.name }} · {{ {bound:'포박된 모습',held:'내가 붙잡고 있던 모습',free:'포박이 풀린 모습',dead:'시신'}[r.state] }} 확인</p>
          <p>{{ r.regionLabel??'현지' }} / {{ r.mapName }} · 마지막 위치({{ r.pos.x }},{{ r.pos.y }})</p>
          <p class="text-ash-400">{{ fmtClock(r.at) }} 목격 · {{ Math.max(0,d.now-r.at) }}턴 전<span v-if="r.faction"> · {{ factionDef(world!,r.faction)?.label??'알려진 소속' }}</span></p>
        </article>
      </template>
      <template v-else-if="tab === 'contracts'">
        <p class="mb-2 text-ash-400">납품과 취소는 의뢰한 정착지의 상인 곁에서 N 장부로 처리한다. 진행 중인 보수는 시장 장부에 맡겨져 있다.</p>
        <div class="contract-tools"><input v-model="contractQuery" type="search" placeholder="계약·의뢰인 찾기" aria-label="계약 검색"><select v-model="contractStatus" aria-label="계약 상태"><option value="active">진행 중</option><option value="closed">마친 계약</option><option value="all">전체</option></select></div>
        <p v-if="!contracts.length" class="contract-empty">표시할 계약이 없다. 상태 필터와 검색어를 확인하자.</p>
        <div v-for="r in contracts" :key="r.id" class="my-2 border-b border-ash-700 pb-2" data-testid="journal-contract">
          <div class="contract-card-top"><span :class="{'contract-urgent':r.status==='active'&&r.deadline-d.now<28800}">{{ r.status==='active'?'남은 '+Math.max(0,Math.ceil((r.deadline-d.now)/1200))+'시간':'마친 기록' }}</span><button v-if="r.status==='active'" class="dbtn" :aria-pressed="trackedContract===r.id" :data-track-contract="r.id" @click="trackedContract=trackedContract===r.id?null:r.id">{{ trackedContract===r.id?'수첩에서 내리기':'수첩에 고정' }}</button></div>
          <p>{{ r.label }} · {{ r.issuer }} · {{ {active:'진행 중',completed:r.kind==='escort'||r.kind==='patrol'||r.kind==='investigate'||r.kind==='eliminate'||r.kind==='sealSource'||r.kind==='rescue'?'보고 완료':'납품 완료',cancelled:'취소',expired:'기한 지남'}[r.status] }}</p>
          <p v-if="r.kind!=='excavate'&&r.kind!=='escort'&&r.kind!=='patrol'&&r.kind!=='investigate'&&r.kind!=='surveyMap'&&r.kind!=='eliminate'&&r.kind!=='sealSource'&&r.kind!=='recover'&&r.kind!=='rescue'">{{ world!.db.item(r.item).label }} {{ r.count }}개 · 보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}</p>
          <template v-if="r.kind==='excavate'">
            <p>{{ d.place(r.region,r.mapId) }} · ({{ r.pos.x }},{{ r.pos.y }}) · 원본 {{ world!.db.item(r.item).label }} · 보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}</p>
            <p v-if="r.proof">{{ r.proof.result==='found'?'수락 뒤 직접 발굴한 원본을 확인했다. 같은 물품을 배낭에 챙겨 의뢰인에게 가져가자.':'해체한 보관함에 의뢰한 원본이 없었다.' }}</p>
            <template v-if="r.status==='active'&&!r.proof"><p>도구: {{ d.excavationTools }}. 중단한 작업은 같은 도구로 이어간다.</p><p v-if="r.work">해체 작업 {{ Math.floor(r.work.progress) }}/{{ r.work.total }} · 원래 도구 예약</p><p class="text-ash-400">{{ d.excavation(r.id).error??`남은 실제 작업 ${d.excavation(r.id).turns}턴` }}</p><button class="dbtn my-1" :disabled="simulating||!!d.excavation(r.id).error" data-testid="excavation-contract-work" @click="act({type:'excavationWork',contract:r.id})">봉인 해체·발굴</button></template>
          </template>
          <template v-if="r.kind==='escort'">
            <p>{{ r.passengerName }} · 함께 확인 {{ r.visits.length }}/{{ r.points.length }} · 보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}</p>
            <p v-for="(point,i) in r.points" :key="i" data-testid="journal-escort-point">{{ i+1 }}. {{ point.label }} ({{ point.pos.x }},{{ point.pos.y }}) · {{ i<r.visits.length?'함께 확인 완료':i===r.visits.length?'다음 지점':'앞 지점부터 확인' }}</p>
            <template v-if="r.status==='active'&&r.visits.length<r.points.length"><p class="text-ash-400">{{ d.escort(r.id).error??'두 사람이 다음 지점 곁에 함께 있다.' }}</p><button class="dbtn my-1" :disabled="simulating||!!d.escort(r.id).error" data-testid="escort-contract-visit" @click="act({type:'escortContractVisit',contract:r.id})">함께 도착 확인 (1턴)</button></template>
          </template>
          <template v-if="r.kind==='patrol'">
            <p>보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }} · 의뢰인이 알려 준 순서</p>
            <p v-for="(point,i) in r.points" :key="i" data-testid="journal-patrol-point">{{ i+1 }}. {{ point.label }} ({{ point.pos.x }},{{ point.pos.y }}) · {{ i<r.visits.length?'직접 확인 완료':i===r.visits.length?'다음 지점':'앞 지점부터 확인' }}</p>
            <template v-if="r.status==='active'&&r.visits.length<r.points.length"><p class="text-ash-400">{{ d.patrol(r.id).error??'곁의 다음 지점을 직접 확인할 수 있다.' }}</p><button class="dbtn my-1" :disabled="simulating||!!d.patrol(r.id).error" data-testid="patrol-contract-visit" @click="act({type:'patrolContractVisit',contract:r.id})">다음 순찰 지점 확인 (1턴)</button></template>
            <p v-else-if="r.status==='active'">모든 지점을 확인했다. 의뢰인에게 돌아가 보고하자.</p>
          </template>
          <template v-if="r.kind==='rescue'">
            <p v-if="r.witness" class="text-amber-200">{{ r.witness.fromName }}에게 {{ r.witness.kind==='interrogation'?'심문으로':'대화로' }} 전해 들은 목격으로 맡았다. 현재 상태는 현장에서 확인해야 한다.</p><p>{{ r.name }} · {{ r.mapName }} · 마지막 목격({{ r.pos.x }},{{ r.pos.y }}) · 보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}</p>
            <p v-if="r.relic">시신에서 직접 식별한 원래 유품: {{ world!.db.item(r.relic.def).label }}<span v-if="r.relicRecipient"> · 같은 원본 납품 완료</span></p><p v-else-if="r.returned">구조한 같은 사람의 귀환을 장부 곁에서 확인했다.</p><p v-else-if="r.proof">맡은 뒤 원래 포박을 해방했다. 살아서 같은 장부 곁에 돌아와야 보수를 받는다.</p><p v-else>마지막 목격 이후의 위치와 생사는 직접 확인해야 한다.</p>
            <template v-if="r.status==='active'&&!r.relic"><p class="text-ash-400">{{ d.rescueRemains(r.id).error??'현장에서 수색한 같은 시신의 원래 유품으로 전환할 수 있다.' }}</p><button class="dbtn my-1" :disabled="simulating||!!d.rescueRemains(r.id).error" data-testid="rescue-remains" @click="act({type:'rescueContractRemains',contract:r.id})">현장 유품 확인 ({{ d.rescueRemains(r.id).turns??'—' }}턴)</button></template>
          </template>
          <p v-if="r.kind==='surveyMap'">{{ r.worldSurvey?'주변 월드 정찰':d.place(r.region,r.mapId) }} · 새 직접 작성 지도1장 · 신뢰도 {{ r.minReliability }} 이상 · 보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}<span v-if="r.recipient||r.worldRecipient"> · 원본 납품 완료</span><span v-if="r.worldSurvey"> · 중심({{ r.worldSurvey.center.x }},{{ r.worldSurvey.center.y }}) 반경{{ r.worldSurvey.radius }}칸/새 관찰{{ r.minFeatures }}칸</span></p>
          <template v-if="r.kind==='recover'">
            <p>{{ world!.db.item(r.item).label }} · 확인했던 같은 원본1개 · 보존 상태{{ r.minDurability }}% 이상</p>
            <p>{{ world!.s.overworld!.sites.find(s=>s.id===r.region)?.label }} / {{ d.mapName(r.region,r.mapId) }} · 마지막 확인({{ r.pos.x }},{{ r.pos.y }}) · 보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}</p>
            <p v-if="r.recipient">확인했던 같은 원본을 넘겼다.</p><p v-else>그 뒤의 실제 위치는 가서 확인해야 한다. 같은 종류의 다른 물품으로 대신할 수 없다.</p>
          </template>
          <template v-if="r.kind==='sealSource'">
            <p>{{ world!.s.overworld!.sites.find(s=>s.id===r.region)?.label }} / {{ d.mapName(r.region,r.mapId) }} · 보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}</p>
            <p v-if="r.proof" data-testid="journal-source-proof">{{ r.proof.result==='sealed'?'수락 뒤 직접 완료한 작업':'이전/다른 이의 봉쇄 현장 확인' }}</p>
            <template v-if="r.status==='active'&&!r.proof"><p class="text-ash-400">{{ d.sourceContract(r.id).error??'원래 기구의 완료 기록을 확인할 수 있다.' }}</p><button class="dbtn my-1" :disabled="simulating||!!d.sourceContract(r.id).error" data-testid="source-contract-survey" @click="act({type:'sourceContractSurvey',contract:r.id})">완료된 봉쇄 현장 확인 (1턴)</button></template>
          </template>
          <template v-if="r.kind==='eliminate'">
            <p>처치 참여 기록 {{ r.evidence.filter(e=>e.kind==='kill'&&e.observed!==false).length }} · 현장 시신 확인 {{ r.evidence.filter(e=>e.kind==='foundDead'&&e.observed!==false).length }} · 보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}</p>
            <p v-if="r.testimony" data-testid="journal-bounty-testimony">{{ r.testimony.name }}의 직접 소속 증언: {{ factionDef(world!,r.testimony.faction)?.label??r.testimony.faction }}. {{ r.testimony.faction!==r.claimedFaction?'의뢰인의 주장과 다름. 처치 없이 이의를 보고할 수 있다.':'의뢰인의 주장과 같음.' }}</p>
            <p v-if="r.outcome==='contradicted'">의뢰 내용과 다른 직접 증언을 보고하고 보수를 장부로 반환했다.</p>
            <p v-if="r.outcome==='alreadyDead'">다른 이의 처치가 확인되어 보수를 장부로 반환했다.</p>
            <template v-if="r.status==='active'">
              <p class="text-ash-400">{{ d.bounty(r.id).error??'바로 곁의 시신을 확인할 수 있다.' }}</p>
              <button class="dbtn my-1" :disabled="simulating||!!d.bounty(r.id).error" data-testid="bounty-survey" @click="act({type:'bountySurvey',contract:r.id})">현장 시신 확인 (1턴)</button>
            </template>
          </template>
          <template v-if="r.kind==='investigate'">
            <p>{{ world!.s.overworld!.sites.find((s)=>s.id===r.region)?.label }} / {{ d.mapName(r.region,r.mapId) }} · 소문 구역({{ r.rect.x }},{{ r.rect.y }}) {{ r.rect.w }}×{{ r.rect.h }}</p>
            <p>보수 {{ r.reward }}{{ d.currency }} · 예치 {{ r.escrow }}{{ d.currency }}</p>
            <p v-if="r.proof">현장 기록: {{ r.proof.result==='confirmed'?'위치 확인':'소문과 다름' }}</p>
            <template v-if="r.status==='active'">
              <p>남은 시간 약{{ Math.max(0,Math.ceil((r.deadline-d.now)/1200)) }}시간</p>
              <p class="text-ash-400">{{ d.investigation(r.id).error??'구역 내부를 살폈다. 현장 기록을 남길 수 있다.' }}</p>
              <button class="dbtn my-1" :disabled="simulating||!!d.investigation(r.id).error" data-testid="investigation-survey" @click="act({type:'investigationSurvey',contract:r.id})">현장 조사 기록 (1턴)</button>
            </template>
          </template>
          <p v-if="r.kind!=='excavate'&&r.kind!=='escort'&&r.kind!=='patrol'&&r.kind!=='investigate'&&r.kind!=='surveyMap'&&r.kind!=='eliminate'&&r.kind!=='sealSource'&&r.kind!=='recover'&&r.kind!=='rescue'&&r.status==='active'">남은 시간 약 {{ Math.max(0,Math.ceil((r.deadline-d.now)/1200)) }}시간 · 음식 신선도{{ r.freshness }}%/내구{{ r.durability }}% 이상</p>
        </div>
      </template>
      <template v-else-if="tab === 'medical'">
        <CarePlanOverview />
        <p class="mb-2 text-xs text-ash-300">진찰 당시의 소견이다. 이후의 출혈·감염·새 상처는 다시 확인해야 한다.</p>
        <p v-if="!d.medical.length" class="text-sm text-ash-300">아직 진찰 기록이 없다. 정착지 의사에게 진찰을 부탁할 수 있다.</p>
        <article v-for="(report, index) in d.medical" :key="`${report.at}-${index}`" class="my-3 border-b border-ash-700 pb-2" data-testid="medical-report">
          <p class="mb-1 text-sm font-bold">{{ fmtClock(report.at) }} · {{ report.examiner }}</p><p class="mb-1 text-xs text-ash-300">의료 {{ report.mastery }}단계 · 검사 Q {{ report.quality }}</p>
          <p v-for="(finding, i) in report.findings" :key="i" class="my-1 text-sm">{{ finding }}</p>
        </article>
      </template>
      <template v-else-if="tab === 'beast'">
        <p v-if="!d.beasts.length" class="text-ash-500">아직 관찰한 생물이 없다.</p>
        <p class="mb-1 text-ash-400">관찰 → 전투 생존 → 해부 → 문헌으로 몸과 습성을 익힌다.</p>
        <div v-for="x in d.beasts" :key="x.c.id" class="df df-tab mb-1" :data-testid="`bestiary-${x.c.id}`">
          <div class="flex justify-between"><span :class="x.stage ? 'text-ash-100' : 'text-ash-500'">{{ x.stage ? x.c.label : '???' }}</span><span v-if="x.b" class="text-ash-500"><template v-if="x.c.defType==='Swarm'">환경 군체 · 표본 {{ x.b.dissected??0 }}회</template><template v-else>교전 공격 {{ x.b.fought }}회 · 처치 {{ x.b.killed }}</template></span></div>
          <p v-for="(line,i) in x.lines" :key="i" class="mt-0.5 text-ash-300">{{ line }}</p>
          <details v-if="x.body.length" class="mt-1 text-ash-300"><summary>{{ x.stage>=3?'해부한 몸 구조':'관찰한 외부 부위' }} (기록한 개체 기준)</summary><p v-for="line in x.body" :key="line">{{ line }}</p></details>
        </div>
      </template>
      <template v-else-if="tab === 'interactions'">
        <p class="mb-2 text-ash-400">직접 겪거나 목격하고, 온전히 읽거나 들은 반응을 기록한다. 알려지기 전에는 분류만 보인다.</p>
        <div v-for="row in d.interactions" :key="row.id" class="border-b border-ash-600 py-2" :data-testid="'interaction-'+row.id">
          <p><span class="text-ash-400">{{ row.category }}</span> · <span :class="row.record?'text-moss-300':'text-ash-500'">{{ row.label }}</span></p>
          <template v-if="row.record"><p>{{ row.formula }}</p><p class="text-ash-400">{{ row.record.source }} · {{ fmtClock(row.record.at) }}</p></template>
        </div>
      </template>
      <template v-else-if="tab === 'pill'">
        <p class="mb-1 text-ash-400">알약의 색과 효과는 시드마다 섞인다.</p>
        <div v-for="p in d.pills" :key="p.label" class="border-b border-[#2e2a22] py-1" :data-testid="`knowledge-${p.id}`">
          <div class="flex justify-between"><span>{{ p.label }}</span><span :class="p.confidence === 'likely' ? 'text-amber-300' : p.known ? 'text-moss-300' : 'text-ash-500'" :title="p.known?.description">{{ p.known ? p.known.label + (p.confidence === 'likely' ? ' (추정)' : ' (확정)') : '???' }}</span></div>
          <p v-if="p.excluded" class="text-ash-400">관찰로 배제: {{ p.excluded }}</p>
          <details v-if="p.evidence.length" class="text-ash-400"><summary>관찰 기록 {{ p.evidence.length }}개</summary><p v-for="(e,idx) in p.evidence" :key="idx">{{ e.text }}</p></details>
        </div>
        <p v-if="d.fieldNotes.length" class="mt-3 mb-1 text-ash-400">직접 점검한 기록</p>
        <div v-for="note in d.fieldNotes" :key="note.key" class="mt-2 border-t border-ash-600 pt-1" :data-testid="`field-note-${note.key}`"><p class="font-bold">{{ note.title }}</p><p>{{ note.text }}</p></div>
        <p class="mt-3 mb-1 text-ash-400">완독한 책</p>
        <p v-for="book in d.books" :key="book" class="text-ash-300">{{ book }}</p>
        <div v-for="book in d.bookNotes" :key="book.id" class="mt-2 border-t border-ash-600 pt-1" :data-testid="`book-note-${book.id}`"><p class="font-bold">{{ book.label }}</p><p>{{ book.note }}</p></div>
        <p v-if="!d.books.length" class="text-ash-500">아직 없다.</p>
      </template>
      <template v-else-if="tab === 'rumor'">
        <NpcRelationsPanel v-for="source in d.neighborSources" :key="source" :person-id="source" />
        <p v-if="!d.rumors.length&&!d.neighborSources.length" class="text-ash-400">서가·석관의 쪽지를 읽으면 소문이 여기에 모인다. 쪽지는 쓴 날 이후의 일을 모른다.</p>
        <div v-for="(r, i) in d.rumors" :key="i" class="mb-2 border-b border-[#2c2a22] pb-1" data-testid="rumor">
          <p class="text-ash-100">{{ r.text }}</p>
          <p class="text-[10px] text-ash-500">{{ r.stage }} · {{ r.src }} · {{ r.written }} · {{ r.found }}에 읽음</p>
          <p v-if="r.suspected" class="text-[10px] text-amber-200">{{ r.suspected }}</p>
        </div>
      </template>
      <template v-else-if="tab === 'events'">
        <p class="mb-1 text-ash-400">장소에서 일어난 일. 순찰은 매일 06:00, 흔적을 보면 수색대가 나온다.</p>
        <div v-for="(e, i) in d.events" :key="i" class="flex justify-between border-b border-[#2e2a22] py-0.5"><span class="font-mono text-ash-500">{{ e.when }}</span><span class="text-ash-200">{{ e.label }}</span></div>
        <p v-if="!d.events.length" class="text-ash-500">아직 없다.</p>
      </template>
      <template v-else-if="tab === 'chron'">
        <div v-for="(h, i) in d.chron" :key="i" class="font-mono text-[11px] leading-5"><span class="text-ash-400">{{ h.when }}</span> <span class="text-ash-200">{{ h.text }}</span></div>
        <p v-if="!d.chron.length" class="text-ash-500">아직 없다.</p>
      </template>
      <template v-else>
        <div v-for="(e, i) in d.log" :key="i" :class="KIND_CLASS[e.kind]" class="font-mono text-[11px] leading-5"><span class="text-ash-400">{{ fmtClock(e.turn).slice(-5) }}</span> {{ e.text }}</div>
      </template>
    </div>
  </Win>
</template>

<style scoped>
.contract-tools{display:flex;gap:8px;margin-block:12px}.contract-tools input{flex:1;min-width:0}.contract-tools input,.contract-tools select{border:1px solid #62553c;background:#1d1c17;color:#d6c9aa;padding:8px;font-size:11px}.contract-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;color:#9eac8a;font-size:10px}.contract-card-top .contract-urgent{color:#dba073}.contract-empty{border:1px dashed #62553c;color:#b2a68b;padding:20px;text-align:center}
</style>
