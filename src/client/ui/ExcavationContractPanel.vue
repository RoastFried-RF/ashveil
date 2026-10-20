<script setup lang="ts">
import {computed} from 'vue'
import {contractPlace} from '../contract-place'
import {creatureById,economyDef,excavationOffers,excavationDeliveryQuote,isExcavation,player,turnOf,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!
 return{place:(region:string,mapId:string)=>contractPlace(w,region,mapId),trader,offers:excavationOffers(w,p,trader),currency:economyDef(w).currency,records:(w.s.overworld?.contracts??[]).filter(isExcavation).filter(r=>r.site===trader.traderSite).slice(-8).reverse().map(r=>({r,quote:excavationDeliveryQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}))}})
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="excavation-contract-panel">
    <summary class="cursor-pointer font-title text-amber-100">봉인 보관함 발굴</summary>
    <p class="my-1 text-ash-400">직접 본 봉인 보관함에 실제 도구를 가져가 일지에서 작업한다. 나온 원본을 배낭에 챙겨 같은 장부에 납품한다.</p>
    <p v-if="!data.offers.length" class="text-ash-400">직접 관찰한 미개봉 현장의 새 발굴 의뢰가 없다.</p>
    <div v-for="o in data.offers" :key="o.id" class="my-2 border border-ash-700 p-2" data-testid="excavation-contract-offer">
      <p>{{ o.label }} · 보수 {{ o.reward }}{{ data.currency }} · 기한 약{{ Math.ceil(o.deadlineTurns/1200) }}시간</p>
      <p>{{ data.place(o.region,o.mapId) }} · ({{ o.pos.x }},{{ o.pos.y }}) · 납품할 원본 {{ world!.db.item(o.item).label }}</p>
      <button class="dbtn mt-1" :disabled="simulating" data-testid="excavation-contract-accept" @click="doAct({type:'excavationAccept',target:data.trader.id,offer:o.id,expectedReward:o.reward})">발굴 수락 (1턴)</button>
    </div>
    <div v-for="row in data.records" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="excavation-contract-record">
      <p>{{ row.r.label }} · {{ {active:'진행 중',completed:'원본 납품 완료',cancelled:'취소',expired:'기한 지남'}[row.r.status] }}</p>
      <p>보수 {{ row.r.reward }}{{ data.currency }} · 예치 {{ row.r.escrow }}{{ data.currency }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약{{ row.hours }}시간</p><p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" data-testid="excavation-contract-deliver" @click="doAct({type:'excavationDeliver',target:data.trader.id,contract:row.r.id,expectedReward:row.r.reward})">발굴 원본 납품 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating" data-testid="excavation-contract-cancel" @click="doAct({type:'contractCancel',target:data.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
