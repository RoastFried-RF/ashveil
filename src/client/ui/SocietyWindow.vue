<script setup lang="ts">
import {itemTip} from '../info'
import {worldMapMarketValue} from '../../core/world-map-prices'
import {calendar} from '../../core/climate-state'
import {seasonalProductionMultiplier} from '../../core/world-simulation'
import { computed, ref } from 'vue'
import { factionAvailable, bargainChance, firstImpressionReply, clinicDef, isCompanion, economyDef, factionDef, itemDef, itemLabel, marketFor, nearbyPeople, player, reputation, reputationBand, tradeAccess, tradePrice, tradeQuote, turnOf, visiblePrisoners, type FactionDef, type TradeLine, type ItemInst, type World } from '../../core'
import { primaryBindingText } from '../keybindings'
import { preferences } from '../preferences'
import { simulating, version, world } from '../store'
import { doAct, socialTarget, wins,showTip,hideTip } from '../ui'
import Win from './Win.vue'
import NpcRelationsPanel from './NpcRelationsPanel.vue'
import NpcPsychePanel from './NpcPsychePanel.vue'
import AppraisalPanel from './AppraisalPanel.vue'
import ItemIcon from './ItemIcon.vue'
import ClinicPanel from './ClinicPanel.vue'
import PrisonerPanel from './PrisonerPanel.vue'
import CompanionPanel from './CompanionPanel.vue'
import CompanionRecoveryPanel from './CompanionRecoveryPanel.vue'
import TeachingPanel from './TeachingPanel.vue'
import InnPanel from './InnPanel.vue'
import ContractPanel from './ContractPanel.vue'
import BountyPanel from './BountyPanel.vue'
import PatrolContractPanel from './PatrolContractPanel.vue'
import EscortContractPanel from './EscortContractPanel.vue'
import ExcavationContractPanel from './ExcavationContractPanel.vue'
import SourceContractPanel from './SourceContractPanel.vue'
import RecoveryContractPanel from './RecoveryContractPanel.vue'
import RescueContractPanel from './RescueContractPanel.vue'
import BountyQuestionPanel from './BountyQuestionPanel.vue'
import InvestigationPanel from './InvestigationPanel.vue'
import MapCommissionPanel from './MapCommissionPanel.vue'
import ResidentDepotPanel from './ResidentDepotPanel.vue'
import ResidentWellPanel from './ResidentWellPanel.vue'
import ResidentHygienePanel from './ResidentHygienePanel.vue'
import EvidencePanel from './EvidencePanel.vue'
import RumorNetworkPanel from './RumorNetworkPanel.vue'
import NpcCartographyPanel from './NpcCartographyPanel.vue'
import ResidentCultivationPanel from './ResidentCultivationPanel.vue'
const services=ref<HTMLElement>(),trade=ref<HTMLElement>()
const tab = ref<'people' | 'factions'>('people')
const buy = ref<TradeLine[]>([]), sell = ref<TradeLine[]>([])
const data = computed(() => {
  void version.value
  const w = world.value as World, p = player(w), people = nearbyPeople(w)
  const selected = people.find((c) => c.id === socialTarget.value) ?? people[0]
  const market = selected && marketFor(w, selected)
  const foodMult=market&&!market.mobile?seasonalProductionMultiplier(w,w.s.overworld?.sites.find(site=>site.id===market.site)?.faction,'Food'):1
  return { w, p, people, prisoners:visiblePrisoners(w), selected, market, currency: economyDef(w).currency,
    seasonalFood:foodMult!==1?{season:calendar(w).season.label,mult:foodMult}:undefined,
    caravan:selected?.caravan?w.s.overworld?.caravans?.find(c=>c.id===selected.caravan):undefined,
    quote: selected ? tradeQuote(w, p, selected, buy.value, sell.value) : null,
    access: selected ? tradeAccess(w, p, selected) : null,
    firstReply: selected ? firstImpressionReply(w,selected,p) : undefined,
    chance: selected ? bargainChance(w, p, selected) : 0,
    factions: w.db.all<FactionDef>('Faction').filter(f=>factionAvailable(w,f)).map((f) => ({ f, value: reputation(w, f.key), band: reputationBand(w, f.key) })),
    relations:Object.entries(w.s.overworld?.society?.relationKnowledge??{}).flatMap(([from,record])=>Object.entries(record.values).map(([to,value])=>({from,to,value,day:record.day}))),
    disclosures:w.s.overworld?.society?.disclosures?.slice(-10).reverse()??[],
    events: w.s.overworld?.society?.events.filter(e=>(!e.kinKey&&!e.propertyKey&&!e.evidenceKey)||e.applied).slice(-20).reverse() ?? [],
  }
})
function tradeTip(e:MouseEvent,it:ItemInst,stock=false){hideTip();const d=data.value;if(stock&&d.access)return;const tip=itemTip(d.w,it);showTip(e,tip.title,tip.lines,tip.color)}
function choose(id: number) { socialTarget.value = id; buy.value = []; sell.value = [] }
function count(lines: TradeLine[], uid: number) { return lines.find((l) => l.uid === uid)?.count ?? 0 }
function change(lines: TradeLine[], uid: number, max: number, delta: number) {
  const row = lines.find((l) => l.uid === uid)
  if (row) { row.count = Math.max(0, Math.min(max, row.count + delta)); if (!row.count) lines.splice(lines.indexOf(row), 1) }
  else if (delta > 0) lines.push({ uid, count: Math.min(max, delta) })
}
function exchange() {
  const d = data.value
  if (!d.selected || !d.quote) return
  if (!doAct({ type: 'trade', target: d.selected.id, buy: buy.value.map((x) => ({ ...x })), sell: sell.value.map((x) => ({ ...x })), expectedBalance: d.quote.balance })) { buy.value = []; sell.value = [] }
}
</script>
<template>
  <Win :title="`주민과 세력 (${primaryBindingText(preferences.keyBindings,'society')})`" :width="650" :x="270" :y="65" testid="win-society" @close="wins.society = false">
    <div class="mb-2 flex gap-2"><button class="dbtn" @click="tab = 'people'">대화·거래</button><button class="dbtn" @click="tab = 'factions'">세력·소식</button></div>
    <template v-if="tab === 'people'">
      <p v-if="data.w.s.map.quarantine" class="mb-2 text-xs text-red-300">회색열 때문에 외부 출입을 막고 있다.</p>
      <p v-if="data.p.expulsion&&data.p.expulsion.site===data.w.s.overworld?.currentRegion&&data.p.expulsion.leftAt===undefined" class="mb-2 text-xs text-amber-200" data-testid="expulsion-order">이 마을에서 떠나라는 경비의 명령을 받았다.</p>
      <p class="mb-2 text-xs text-ash-300">소지금 {{ data.p.money ?? 0 }}{{ data.currency }} · 옆에 있는 주민과 대화할 수 있다.</p>
      <PrisonerPanel />
      <ResidentDepotPanel />
      <ResidentWellPanel />
      <p v-if="!data.people.length&&!data.prisoners.length" class="text-sm">곁에 대화할 사람이 없다. 정착지에서 주민에게 다가가자.</p>
      <div class="flex flex-wrap gap-1"><button v-for="c in data.people" :key="c.id" :data-person-id="c.id" class="dbtn" :class="{ 'df-btn-sel': data.selected?.id === c.id }" @click="choose(c.id)">{{ c.name }}</button></div>
      <template v-if="data.selected">
        <p class="my-2 text-xs"><span v-if="isCompanion(data.w,data.selected)">동료 · 원소속 </span>{{ factionDef(data.w, data.selected.faction)?.label }} · 국가 관계 {{ reputationBand(data.w, data.selected.faction).label }}</p>
        <p v-if="data.selected.age" class="my-1 text-xs text-ash-400" data-testid="resident-age">연령대 · {{ Math.floor(data.selected.age.years/10)*10 }}대</p>
        <p v-if="data.firstReply" class="my-2 text-xs text-ash-300" data-testid="first-impression">{{ data.firstReply }}</p>
        <button class="dbtn" :disabled="simulating" data-testid="talk-person" @click="doAct({ type: 'talk', target: data.selected.id })">이야기 나누기 (1턴)</button>
        <button class="dbtn ml-2" data-testid="resident-services-open" @click="services?.scrollIntoView({block:'start'})">도움·의뢰 보기</button>
        <p v-if="data.caravan" class="my-2 text-xs text-amber-200" data-testid="mobile-caravan">실제로 이동 중인 교역 상점 · 원래 화물과 유한 현금을 가지고 있다. 이동 상점은 재입고되지 않는다.<template v-if="data.caravan.stopUntil!==undefined"> {{ data.caravan.stopUntil>turnOf(data.w)?` 잠시 정차 중 · ${data.caravan.stopUntil-turnOf(data.w)}턴 뒤 출발한다.`:'길을 계속 걷고 있다. 가까이 있을 때 거래할 수 있다.' }}</template></p>
        <template v-if="data.market">
          <button class="dbtn ml-2" :disabled="!!data.access || simulating" data-testid="bargain" @click="doAct({ type: 'bargain', target: data.selected.id })">흥정 {{ data.chance }}% (1턴)</button>
          <p v-if="data.access" class="my-2 text-xs text-red-300">{{ data.access }}</p>
          <p v-if="data.seasonalFood&&!data.access" class="my-2 text-xs text-moss-300" data-testid="seasonal-food-production">{{ data.seasonalFood.season }} 촌락 식량 생산 ×{{ data.seasonalFood.mult }} · 저장고와 거래 가격에 반영됩니다.</p>
          <div ref="trade" class="my-2 grid grid-cols-2 gap-3">
            <div>
              <h3 class="mb-1 text-sm font-bold">상인 물품 <span class="ml-2 text-xs text-ash-400" data-testid="market-cash">금고 {{ data.market.money }}{{ data.currency }}</span></h3><div class="max-h-[35vh] overflow-y-auto" data-testid="trade-stock">
                <div v-for="it in data.market.items" :key="it.uid" class="my-1 flex items-center gap-1 border-b border-ash-700 pb-1 text-xs" :data-def="it.def" :data-trade-uid="it.uid" @mouseenter="tradeTip($event,it,true)" @mouseleave="hideTip">
                  <ItemIcon :name="itemDef(data.w, it).sprite" :size="24" /><span class="flex-1">{{ itemLabel(data.w, it) }}<br>{{ tradePrice(data.w, data.p, data.selected, it, true) }}{{ data.currency }}/개<span v-if="worldMapMarketValue(data.w,it)!==undefined" class="text-sky-300" title="표시된 신뢰도와 중복 없는 기록 칸 수로 정한 지도 기준가다. 당시 지도의 내용이며 지금의 지형을 보증하지 않는다." data-testid="world-map-trade-metadata"> · 월드 지도/신뢰도{{ it.note!.worldMapDocument!.reliability }} · 기록{{ it.note!.worldMapDocument!.cells.length }}칸 · 지도 기준가{{ worldMapMarketValue(data.w,it)!.toFixed(1) }}{{ data.currency }}</span> · <span :data-testid="'stock-count-'+it.uid">재고 {{ it.count }}</span></span>
                  <button class="dbtn" :aria-label="`${itemDef(data.w, it).label} 구매 줄이기`" @click="change(buy, it.uid, it.count, -1)">−</button><span>{{ count(buy, it.uid) }}</span><button class="dbtn" :aria-label="`${itemDef(data.w, it).label} 구매 늘리기`" @click="change(buy, it.uid, it.count, 1)">+</button>
                </div>
              </div>
            </div>
            <div>
              <h3 class="mb-1 text-sm font-bold">내 물품 · 판매</h3><div class="max-h-[35vh] overflow-y-auto" data-testid="trade-bag">
                <div v-for="it in data.p.bag" :key="it.uid" class="my-1 flex items-center gap-1 border-b border-ash-700 pb-1 text-xs" :data-def="it.def" :data-trade-uid="it.uid" @mouseenter="tradeTip($event,it)" @mouseleave="hideTip">
                  <ItemIcon :name="itemDef(data.w, it).sprite" :size="24" /><span class="flex-1">{{ itemLabel(data.w, it) }}<br>{{ tradePrice(data.w, data.p, data.selected, it, false) }}{{ data.currency }}/개<span v-if="worldMapMarketValue(data.w,it)!==undefined" class="text-sky-300" title="표시된 신뢰도와 중복 없는 기록 칸 수로 정한 지도 기준가다. 당시 지도의 내용이며 지금의 지형을 보증하지 않는다." data-testid="world-map-trade-metadata"> · 월드 지도/신뢰도{{ it.note!.worldMapDocument!.reliability }} · 기록{{ it.note!.worldMapDocument!.cells.length }}칸 · 지도 기준가{{ worldMapMarketValue(data.w,it)!.toFixed(1) }}{{ data.currency }}</span></span>
                  <button class="dbtn" :aria-label="`${itemDef(data.w, it).label} 판매 줄이기`" @click="change(sell, it.uid, it.count, -1)">−</button><span>{{ count(sell, it.uid) }}</span><button class="dbtn" :aria-label="`${itemDef(data.w, it).label} 판매 늘리기`" @click="change(sell, it.uid, it.count, 1)">+</button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="data.quote" class="border-t border-ash-600 pt-2 text-sm" data-testid="trade-total">
            구매 {{ data.quote.buy }} · 판매 {{ data.quote.sell }} · {{ data.quote.balance >= 0 ? '지불' : '받을 돈' }} {{ Math.abs(data.quote.balance) }}{{ data.currency }}
            <p v-if="data.quote.error" class="text-xs text-red-300">{{ data.quote.error }}</p>
            <button class="dbtn-gold mt-2" :disabled="simulating || !!data.quote.error || (!buy.length && !sell.length)" data-testid="trade-confirm" @click="exchange">거래 확정 (1턴)</button>
          </div>
        </template>
        <section ref="services" class="mt-4 border-t border-ash-600 pt-3" aria-label="주민의 도움과 의뢰" data-testid="resident-services">
          <div class="mb-2 flex items-center justify-between gap-2"><h3 class="font-title text-sm text-amber-100">도움과 의뢰</h3><button v-if="data.market" class="dbtn text-xs" data-testid="resident-trade-open" @click="trade?.scrollIntoView({block:'start'})">거래로 돌아가기</button></div>
          <EvidencePanel :person-id="data.selected.id" />
          <RumorNetworkPanel :person-id="data.selected.id" />
          <ResidentCultivationPanel :target="data.selected" />
          <NpcCartographyPanel :person-id="data.selected.id" />
          <BountyQuestionPanel :person-id="data.selected.id" />
          <CompanionPanel :person-id="data.selected.id" />
          <CompanionRecoveryPanel :person-id="data.selected.id" />
          <NpcRelationsPanel :person-id="data.selected.id" />
          <NpcPsychePanel :person-id="data.selected.id" />
          <ResidentHygienePanel :person-id="data.selected.id" />
          <TeachingPanel :teacher-id="data.selected.id" />
          <ClinicPanel v-if="clinicDef(data.w, data.selected)" :doctor-id="data.selected.id" />
          <template v-if="data.market">
            <AppraisalPanel :trader-id="data.selected.id" />
            <InnPanel v-if="!data.market.mobile" :keeper-id="data.selected.id" />
            <ContractPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <BountyPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <ExcavationContractPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <EscortContractPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <PatrolContractPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <SourceContractPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <RecoveryContractPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <RescueContractPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <InvestigationPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
            <MapCommissionPanel v-if="!data.market.mobile" :trader-id="data.selected.id" />
          </template>
        </section>
      </template>
    </template>
    <template v-else>
      <div v-for="row in data.factions" :key="row.f.id" class="my-2 flex justify-between text-sm"><span>{{ row.f.label }}</span><span>{{ row.f.territorial ? '영역 침입 시 적대 · 대화 불가' : `${row.band.label} · ${row.value}` }}</span></div>
      <section v-if="data.disclosures.length" class="my-3 border border-ash-600 p-2 text-xs" data-testid="evidence-disclosures">
        <h3 class="font-bold">직접 공개한 원본 기록</h3>
        <p v-for="(record,i) in data.disclosures" :key="`${record.rule}:${i}`" class="my-1">{{ record.witnesses.length }}명이 현장에서 확인 · {{ record.reformers.length }}명이 기존 규정 거부. 현장 밖 사람의 판단은 아직 모른다.</p>
      </section>
      <h3 class="mt-4 mb-2 text-sm font-bold">대화로 들은 세력 관계</h3>
      <p class="text-xs text-ash-400">주민과 이야기하면 그 세력의 당시 관계를 듣는다. 이후 변화는 다시 이야기해 확인한다. 위의 수치는 당신에 대한 평판이다.</p>
      <p v-if="!data.relations.length" class="my-2 text-xs">아직 세력 관계를 전해 듣지 못했다.</p>
      <p v-for="row in data.relations" :key="`${row.from}:${row.to}`" class="my-1 text-xs" data-testid="faction-relation" :data-from="row.from" :data-to="row.to">{{ factionDef(data.w,row.from)?.label }} → {{ factionDef(data.w,row.to)?.label }} · {{ row.value>=50?'동맹':row.value>=20?'우호':row.value>-20?'중립':row.value>-50?'경계':'적대' }} {{ row.value }} · {{ row.day+1 }}일차에 들음</p>
      <h3 class="mt-4 mb-2 text-sm font-bold">전해지는 소식</h3><p v-if="!data.events.length" class="text-xs text-ash-300">아직 전해지는 소식이 없다.</p>
      <p v-for="e in data.events" :key="e.id" :data-testid="e.kinKey ? 'kinship-news' : undefined" class="my-1 text-xs">{{ factionDef(data.w, e.faction)?.label }} · {{ e.reason }} {{ e.delta }} · {{ e.applied ? '전달됨' : '전달 중' }}</p>
    </template>
  </Win>
</template>
