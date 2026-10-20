<script setup lang="ts">
import {computed} from 'vue'
import {creatureById,economyDef,player,turnOf,type World} from '../../core'
import {worldMapSurveyOffers,worldMapSurveyDeliveryQuote,isWorldMapSurvey} from '../../core/world-map-commissions'
import {version,world,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!
 return{trader,offers:worldMapSurveyOffers(w,p,trader),currency:economyDef(w).currency,rows:(w.s.overworld?.contracts??[]).filter(isWorldMapSurvey).filter(r=>r.site===trader.traderSite).slice(-8).reverse().map(r=>({r,quote:worldMapSurveyDeliveryQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}))}
})
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="world-map-commission-panel">
    <summary class="cursor-pointer font-title text-amber-100">월드 정찰 지도 계약</summary>
    <p class="my-1 text-ash-400">맡은 뒤 출입구 곁이나 바깥길에서 실제로 주변을 살피고 월드 지도를 그려 원본1장을 가져온다. 보수는 상인의 실제 장부에 맡긴다.</p>
    <p v-if="!data.offers.length&&!data.rows.length" class="text-ash-400">새로 맡을 월드 정찰 지도 계약이 없다.</p>
    <div v-for="o in data.offers" :key="o.id" class="my-2 border border-ash-700 p-2" data-testid="world-map-survey-offer">
      <p>{{ o.label }} · 중심({{ o.worldSurvey.center.x }},{{ o.worldSurvey.center.y }}) 반경{{ o.worldSurvey.radius }}칸 · 새 관찰{{ o.minFeatures }}칸/신뢰도{{ o.minReliability }} 이상 · 보수{{ o.reward }}{{ data.currency }}</p>
      <button class="dbtn mt-1" data-testid="world-map-survey-accept" :disabled="simulating" @click="doAct({type:'worldMapSurveyAccept',target:data.trader.id,offer:o.id,expectedReward:o.reward})">월드 정찰 지도 수락 (1턴)</button>
    </div>
    <div v-for="row in data.rows" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="world-map-survey-record">
      <p>{{ row.r.label }} · {{ {active:'진행 중',completed:'원본 납품 완료',cancelled:'취소',expired:'기한 지남'}[row.r.status] }} · 보수{{ row.r.reward }}{{ data.currency }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 약{{ row.hours }}시간 · 예치{{ row.r.escrow }}{{ data.currency }} · 새 관찰{{ row.r.minFeatures }}칸/신뢰도{{ row.r.minReliability }} 이상</p>
        <p v-if="row.quote.error" class="text-ash-400">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" data-testid="world-map-survey-deliver" :disabled="simulating||!!row.quote.error" @click="doAct({type:'worldMapSurveyDeliver',target:data.trader.id,contract:row.r.id,paperUid:row.quote.paperUid!,expectedReward:row.r.reward})">월드 원본 지도 납품 (1턴)</button>
        <button class="dbtn ml-2" data-testid="world-map-survey-cancel" :disabled="simulating" @click="doAct({type:'contractCancel',target:data.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
