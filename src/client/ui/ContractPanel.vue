<script setup lang="ts">
import { computed } from 'vue'
import { isSupplyContract, contractAccess, creatureById, economyDef, itemLabel, player, supplyDelivery, supplyOffers, supplyQuote, turnOf, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const props=defineProps<{traderId:number}>()
const d=computed(()=>{
  void version.value
  const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!
  const contracts=(w.s.overworld?.contracts??[]).filter(isSupplyContract).filter((r)=>r.site===trader.traderSite).slice(-8).reverse().map((r)=>{const lines=supplyDelivery(w,p,r);return{r,lines,quote:supplyQuote(w,p,trader,r.id,lines),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}})
  return{w,p,trader,offers:supplyOffers(w,p,trader),contracts,error:contractAccess(w,p,trader),currency:economyDef(w).currency}
})
const status={active:'진행 중',completed:'납품 완료',cancelled:'취소',expired:'기한 지남'}
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="contract-panel">
    <summary class="cursor-pointer font-title text-amber-100">조달 계약 장부</summary>
    <p class="my-1 text-ash-400">시장에 부족한 물품을 가져온다. 수락하면 보수를 장부에 맡기며, 납품할 때 지갑으로 받는다.</p>
    <p v-if="d.error" class="text-red-300">{{ d.error }}</p>
    <p v-if="!d.error&&!d.offers.length" class="my-1 text-ash-400">새로 맡을 조달 계약이 없다. 진행 중인 계약·시장 부족분·보수를 확인하자.</p>
    <div v-for="offer in d.offers" :key="offer.id" class="my-2 border border-ash-700 p-2" :data-testid="`contract-offer-${offer.template}`">
      <p>{{ offer.label }} · {{ d.w.db.item(offer.item).label }} {{ offer.count }}개 · 보수 {{ offer.reward }}{{ d.currency }} · {{ offer.deadlineTurns/28800 }}일</p>
      <p class="text-ash-400">음식 신선도 {{ offer.freshness }}% 이상 · 내구 {{ offer.durability }}% 이상</p>
      <button class="dbtn mt-1" :disabled="simulating" :data-testid="`contract-accept-${offer.template}`" @click="doAct({type:'contractAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward})">계약 수락 (1턴)</button>
    </div>
    <div v-for="row in d.contracts" :key="row.r.id" class="my-2 border border-ash-700 p-2" :data-testid="`contract-record-${row.r.template}`">
      <p>{{ row.r.label }} · {{ status[row.r.status] }} · {{ d.w.db.item(row.r.item).label }} {{ row.r.count }}개 · 보수 {{ row.r.reward }}{{ d.currency }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약 {{ row.hours }}시간 · 예치 {{ row.r.escrow }}{{ d.currency }}</p>
        <p class="text-ash-400">{{ row.lines.map((l)=>`${itemLabel(d.w,d.p.bag.find((it)=>it.uid===l.uid)!)} ${l.count}개`).join(', ')||'상태 기준을 충족하는 납품 물품이 없다' }}</p>
        <p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" :data-testid="`contract-deliver-${row.r.template}`" @click="doAct({type:'contractDeliver',target:d.trader.id,contract:row.r.id,lines:row.lines,expectedReward:row.r.reward})">선택 물품 납품 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating||!!d.error" :data-testid="`contract-cancel-${row.r.template}`" @click="doAct({type:'contractCancel',target:d.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
