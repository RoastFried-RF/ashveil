<script setup lang="ts">
import {computed} from 'vue'
import {contractAccess,creatureById,economyDef,player,turnOf,type World} from '../../core'
import {isMapSurvey,mapSurveyOffers,mapSurveyDeliveryQuote} from '../../core/map-commissions'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
import WorldMapCommissionPanel from './WorldMapCommissionPanel.vue'
const props=defineProps<{traderId:number}>()
const d=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!
 return{w,trader,error:contractAccess(w,p,trader),offers:mapSurveyOffers(w,p,trader),currency:economyDef(w).currency,records:(w.s.overworld?.contracts??[]).filter(isMapSurvey).filter(r=>r.site===trader.traderSite).slice(-8).reverse().map(r=>({r,quote:mapSurveyDeliveryQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}))}
})
const status={active:'진행 중',completed:'원본 납품 완료',cancelled:'취소',expired:'기한 지남'}
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="map-commission-panel">
    <summary class="cursor-pointer font-title text-amber-100">정찰 지도 계약</summary>
    <p class="my-1 text-ash-400">직접 탐험하거나 실제 읽은 지도로 알게 된 지역·층의 지도를 맡는다. 수락 뒤 해당 지역에서 직접 지도를 그리고 원본1장을 가져오면 장부에 예치한 보수를 받는다.</p>
    <p v-if="d.error" class="text-red-300">{{ d.error }}</p>
    <p v-if="!d.error&&!d.offers.length" class="text-ash-400">새로 맡을 정찰 지도 계약이 없다.</p>
    <div v-for="o in d.offers" :key="o.id" class="my-2 border border-ash-700 p-2" data-testid="map-survey-offer">
      <p>{{ o.label }} · 보수 {{ o.reward }}{{ d.currency }} · 신뢰도 {{ o.minReliability }} 이상 · 방/계단 {{ o.minFeatures }}곳 이상</p>
      <button class="dbtn mt-1" :disabled="simulating" data-testid="map-survey-accept" @click="doAct({type:'mapSurveyAccept',target:d.trader.id,offer:o.id,expectedReward:o.reward})">정찰 지도 수락 (1턴)</button>
    </div>
    <div v-for="row in d.records" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="map-survey-record">
      <p>{{ row.r.label }} · {{ status[row.r.status] }} · 보수 {{ row.r.reward }}{{ d.currency }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 약{{ row.hours }}시간 · 예치 {{ row.r.escrow }}{{ d.currency }}</p>
        <p v-if="row.quote.error" class="text-ash-400">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" data-testid="map-survey-deliver" :disabled="simulating||!!row.quote.error" @click="doAct({type:'mapSurveyDeliver',target:d.trader.id,contract:row.r.id,paperUid:row.quote.paperUid!,expectedReward:row.r.reward})">원본 지도 납품 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating||!!d.error" data-testid="map-survey-cancel" @click="doAct({type:'contractCancel',target:d.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
  <WorldMapCommissionPanel :trader-id="traderId" />
</template>
