<script setup lang="ts">
import {computed} from 'vue'
import {creatureById,economyDef,isPatrolContract,patrolOffers,patrolReportQuote,player,turnOf,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!
 return{trader,offers:patrolOffers(w,p,trader),currency:economyDef(w).currency,records:(w.s.overworld?.contracts??[]).filter(isPatrolContract).filter(r=>r.site===trader.traderSite).slice(-8).reverse().map(r=>({r,quote:patrolReportQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}))}})
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="patrol-contract-panel">
    <summary class="cursor-pointer font-title text-amber-100">정착지 순찰 계약</summary>
    <p class="my-1 text-ash-400">의뢰인이 알려 준 지점을 순서대로 찾아가 일지에서 확인한 뒤 돌아와 보고한다. 보수는 장부에 예치한다.</p>
    <p v-if="!data.offers.length" class="text-ash-400">새로 맡을 순찰이 없다. 현재 장부와 진행 중인 계약을 확인하자.</p>
    <div v-for="o in data.offers" :key="o.id" class="my-2 border border-ash-700 p-2" data-testid="patrol-contract-offer">
      <p>{{ o.label }} · 보수 {{ o.reward }}{{ data.currency }} · 기한 약{{ Math.ceil(o.deadlineTurns/1200) }}시간</p>
      <p>{{ o.points.map(p=>`${p.label}(${p.pos.x},${p.pos.y})`).join(' → ') }}</p>
      <button class="dbtn mt-1" :disabled="simulating" data-testid="patrol-contract-accept" @click="doAct({type:'patrolContractAccept',target:data.trader.id,offer:o.id,expectedReward:o.reward})">순찰 수락 (1턴)</button>
    </div>
    <div v-for="row in data.records" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="patrol-contract-record">
      <p>{{ row.r.label }} · {{ {active:'진행 중',completed:'순찰 보고 완료',cancelled:'취소',expired:'기한 지남'}[row.r.status] }}</p>
      <p>확인 {{ row.r.visits.length }}/{{ row.r.points.length }} · 보수 {{ row.r.reward }}{{ data.currency }} · 예치 {{ row.r.escrow }}{{ data.currency }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약{{ row.hours }}시간</p><p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" data-testid="patrol-contract-report" @click="doAct({type:'patrolContractReport',target:data.trader.id,contract:row.r.id,expectedReward:row.r.reward})">순찰 보고 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating" data-testid="patrol-contract-cancel" @click="doAct({type:'contractCancel',target:data.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
