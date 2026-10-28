<script setup lang="ts">
import {computed} from 'vue'
import {creatureById,economyDef,escortOffers,escortReportQuote,isEscortContract,player,turnOf,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!
 return{trader,offers:escortOffers(w,p,trader),currency:economyDef(w).currency,records:(w.s.overworld?.contracts??[]).filter(isEscortContract).filter(r=>r.site===trader.traderSite&&r.passenger===trader.id).slice(-8).reverse().map(r=>({r,quote:escortReportQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}))}})
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="escort-contract-panel">
    <summary class="cursor-pointer font-title text-amber-100">의뢰인 동행 호송</summary>
    <p class="my-1 text-ash-400">의뢰인이 직접 보고 따라올 수 있게 가까이 안내한다. 두 사람이 지점 곁에 함께 도착하면 일지에서 확인하고, 모두 마친 뒤 의뢰인에게 보고한다. 위험·갈증·휴식이 먼저다.</p>
    <p v-if="!data.offers.length" class="text-ash-400">지금 새로 맡을 동행 호송이 없다.</p>
    <div v-for="o in data.offers" :key="o.id" class="my-2 border border-ash-700 p-2" data-testid="escort-contract-offer">
      <p>{{ o.label }} · {{ o.passengerName }} · 보수 {{ o.reward }}{{ data.currency }} · 기한 약{{ Math.ceil(o.deadlineTurns/1200) }}시간</p>
      <p>{{ o.points.map(p=>`${p.label}(${p.pos.x},${p.pos.y})`).join(' → ') }}</p>
      <button class="dbtn mt-1" :disabled="simulating" data-testid="escort-contract-accept" @click="doAct({type:'escortContractAccept',target:data.trader.id,offer:o.id,expectedReward:o.reward})">함께 출발 (1턴)</button>
    </div>
    <div v-for="row in data.records" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="escort-contract-record">
      <p>{{ row.r.label }} · {{ {active:'동행 중',completed:'호송 완료',cancelled:'취소',expired:'기한 지남'}[row.r.status] }}</p>
      <p>함께 확인 {{ row.r.visits.length }}/{{ row.r.points.length }} · 보수 {{ row.r.reward }}{{ data.currency }} · 예치 {{ row.r.escrow }}{{ data.currency }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약{{ row.hours }}시간</p><p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" data-testid="escort-contract-report" @click="doAct({type:'escortContractReport',target:data.trader.id,contract:row.r.id,expectedReward:row.r.reward})">호송 보고 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating" data-testid="escort-contract-cancel" @click="doAct({type:'contractCancel',target:data.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
