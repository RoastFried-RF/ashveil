<script setup lang="ts">
import {computed} from 'vue'
import {contractAccess,creatureById,economyDef,isRecoveryContract,itemLabel,player,recoveryOffers,recoveryQuote,turnOf,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!,records=(w.s.overworld?.contracts??[]).filter(isRecoveryContract).filter(r=>r.site===trader.traderSite).slice(-8).reverse().map(r=>({r,quote:recoveryQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}));return{w,trader,offers:recoveryOffers(w,p,trader),records,error:contractAccess(w,p,trader),currency:economyDef(w).currency}})
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="recovery-panel">
    <summary class="cursor-pointer font-title text-amber-100">원본 회수 의뢰</summary>
    <p class="my-1 text-ash-400">직접 열어 확인했던 그 물품을 가져온다. 마지막 확인 뒤의 실제 위치는 달라질 수 있다. 같은 종류의 다른 물품으로 대신할 수 없다.</p>
    <p v-if="data.error" class="text-red-300">{{ data.error }}</p>
    <p v-if="!data.error&&!data.offers.length" class="text-ash-400">새로 맡을 원본 회수 의뢰가 없다. 직접 확인한 물품과 진행 중인 의뢰·보수를 확인하자.</p>
    <div v-for="o in data.offers" :key="o.id" class="my-2 border border-ash-700 p-2" data-testid="recovery-offer">
      <p>{{ o.label }} · 보수 {{ o.reward }}{{ data.currency }} · 기한 약{{ Math.ceil(o.deadlineTurns/1200) }}시간</p>
      <button class="dbtn mt-1" :disabled="simulating" data-testid="recovery-accept" @click="doAct({type:'recoveryAccept',target:data.trader.id,offer:o.id,expectedReward:o.reward})">원본 회수 수락 (1턴)</button>
    </div>
    <div v-for="row in data.records" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="recovery-record">
      <p>{{ row.r.label }} · {{ {active:'진행 중',completed:'원본 납품 완료',cancelled:'취소',expired:'기한 지남'}[row.r.status] }}</p>
      <p>보수 {{ row.r.reward }}{{ data.currency }} · 예치 {{ row.r.escrow }}{{ data.currency }} · 보존 상태{{ row.r.minDurability }}% 이상</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약{{ row.hours }}시간</p><p v-if="row.quote.item">배낭의 원본: {{ itemLabel(data.w,row.quote.item) }}</p><p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" data-testid="recovery-deliver" @click="doAct({type:'recoveryDeliver',target:data.trader.id,contract:row.r.id,expectedReward:row.r.reward})">같은 원본 납품 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating||!!data.error" @click="doAct({type:'contractCancel',target:data.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
