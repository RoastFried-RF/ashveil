<script setup lang="ts">
import { computed } from 'vue'
import { contractAccess, creatureById, economyDef, investigationOffers, investigationReportQuote, isInvestigation, player, turnOf, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const props=defineProps<{traderId:number}>()
const d=computed(()=>{
  void version.value
  const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!
  return{w,p,trader,offers:investigationOffers(w,p,trader),error:contractAccess(w,p,trader),currency:economyDef(w).currency,records:(w.s.overworld?.contracts??[]).filter(isInvestigation).filter((r)=>r.site===trader.traderSite).slice(-8).reverse().map((r)=>({r,quote:investigationReportQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}))}
})
const status={active:'진행 중',completed:'보고 완료',cancelled:'취소',expired:'기한 지남'}
</script>
<template>
  <details class="my-2 border-b border-ash-600 pb-2 text-xs" data-testid="investigation-panel">
    <summary class="cursor-pointer font-title text-amber-100">현장 조사 계약 장부</summary>
    <p class="my-1 text-ash-400">이미 얻은 방 위치 소문을 확인한다. 표시 구역의 내부를 살핀 뒤 일지에서 현장 기록을 남기고 돌아와 보고하자.</p>
    <p v-if="d.error" class="text-red-300">{{ d.error }}</p>
    <p v-if="!d.error&&!d.offers.length" class="text-ash-400">새 조사 의뢰가 없다. 방 위치 소문·진행 중인 계약·장부 보수를 확인하자.</p>
    <div v-for="offer in d.offers" :key="offer.id" class="my-2 border border-ash-700 p-2" data-testid="investigation-offer">
      <p>{{ offer.label }} · {{ d.w.s.overworld!.sites.find((s)=>s.id===offer.region)?.label }} / {{ offer.mapId }}</p>
      <p>보수 {{ offer.reward }}{{ d.currency }} · 기한 약{{ Math.ceil(offer.deadlineTurns/1200) }}시간 · 세계 거리{{ offer.distance }}칸</p>
      <button class="dbtn mt-1" :disabled="simulating" data-testid="investigation-accept" @click="doAct({type:'investigationAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward})">조사 계약 수락 (1턴)</button>
    </div>
    <div v-for="row in d.records" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="investigation-record">
      <p>{{ row.r.label }} · {{ status[row.r.status] }} · 보수 {{ row.r.reward }}{{ d.currency }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약{{ row.hours }}시간 · 예치{{ row.r.escrow }}{{ d.currency }}</p>
        <p>{{ row.r.proof ? (row.r.proof.result==='confirmed'?'현장에서 위치 확인':'현장에서 소문과 다름 확인') : '현장 조사 기록 없음' }}</p>
        <p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" data-testid="investigation-report" @click="doAct({type:'investigationReport',target:d.trader.id,contract:row.r.id,expectedReward:row.r.reward})">조사 결과 보고 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating||!!d.error" data-testid="investigation-cancel" @click="doAct({type:'contractCancel',target:d.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
