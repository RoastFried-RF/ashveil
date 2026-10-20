<script setup lang="ts">
import {computed} from 'vue'
import {contractAccess,creatureById,economyDef,isSourceContract,player,sourceOffers,sourceReportQuote,turnOf,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!
 const records=(w.s.overworld?.contracts??[]).filter(isSourceContract).filter(r=>r.site===trader.traderSite).slice(-8).reverse().map(r=>({r,quote:sourceReportQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}))
 return{trader,offers:sourceOffers(w,p,trader),records,error:contractAccess(w,p,trader),currency:economyDef(w).currency}})
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="source-contract-panel">
    <summary class="cursor-pointer font-title text-amber-100">관로 봉쇄 의뢰</summary>
    <p class="my-1 text-ash-400">직접 본 원래 기구에서 수락 뒤 완료한 작업을 보고한다. 보수는 기존 장부에 예치한다. 이미 끝난 봉쇄는 새 작업 보수로 받지 않는다.</p>
    <p v-if="data.error" class="text-red-300">{{ data.error }}</p>
    <p v-if="!data.error&&!data.offers.length" class="text-ash-400">새로 맡을 봉쇄 의뢰가 없다. 직접 본 현장과 진행 중인 의뢰·보수를 확인하자.</p>
    <div v-for="o in data.offers" :key="o.id" class="my-2 border border-ash-700 p-2" data-testid="source-contract-offer">
      <p>{{ o.label }} · 보수 {{ o.reward }}{{ data.currency }} · 기한 약{{ Math.ceil(o.deadlineTurns/1200) }}시간</p>
      <button class="dbtn mt-1" :disabled="simulating" data-testid="source-contract-accept" @click="doAct({type:'sourceContractAccept',target:data.trader.id,offer:o.id,expectedReward:o.reward})">봉쇄 의뢰 수락 (1턴)</button>
    </div>
    <div v-for="row in data.records" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="source-contract-record">
      <p>{{ row.r.label }} · {{ {active:'진행 중',completed:'직접 작업 보고 완료',cancelled:row.r.proof?.result==='alreadyClosed'?'이전 봉쇄 확인·반환':'취소',expired:'기한 지남'}[row.r.status] }}</p>
      <p>보수 {{ row.r.reward }}{{ data.currency }} · 예치 {{ row.r.escrow }}{{ data.currency }}</p>
      <p v-if="row.r.proof">{{ row.r.proof.result==='sealed'?'수락 뒤 직접 마친 봉쇄 기록':'수락 전이거나 다른 이가 끝낸 현장 확인' }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약{{ row.hours }}시간</p><p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" data-testid="source-contract-report" @click="doAct({type:'sourceContractReport',target:data.trader.id,contract:row.r.id,expectedReward:row.r.reward})">봉쇄 작업 보고 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating||!!data.error" @click="doAct({type:'contractCancel',target:data.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
