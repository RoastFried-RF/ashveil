<script setup lang="ts">
import {computed} from 'vue'
import {bountyOffers,bountyReportQuote,contractAccess,creatureById,economyDef,factionDef,isBounty,player,turnOf,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const d=computed(()=>{
  void version.value
  const w=world.value as World,c=player(w),trader=creatureById(w,props.traderId)!
  const contracts=(w.s.overworld?.contracts??[]).filter(isBounty).filter(r=>r.site===trader.traderSite).slice(-8).reverse().map(r=>({r,quote:bountyReportQuote(w,c,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}))
  return{w,trader,offers:bountyOffers(w,c,trader),contracts,error:contractAccess(w,c,trader),currency:economyDef(w).currency}
})
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="bounty-panel">
    <summary class="cursor-pointer font-title text-amber-100">토벌 계약 장부</summary>
    <p class="my-1 text-ash-400">직접 살핀 장소나 만난 현지 인원을 대상으로 한다. 의뢰인의 주장은 당사자에게 확인할 수 있다. 보수는 수락할 때 맡긴다. 참여하지 않은 사망은 현장의 시신을 확인하고 보수를 장부로 돌려보낸다.</p>
    <p v-if="d.error" class="text-red-300">{{ d.error }}</p>
    <p v-if="!d.error&&!d.offers.length" class="text-ash-400">새로 맡을 토벌 계약이 없다. 살핀 장소와 진행 중인 계약·장부의 보수를 확인하자.</p>
    <div v-for="o in d.offers" :key="o.id" class="my-2 border border-ash-700 p-2" :data-testid="`bounty-offer-${o.template}`">
      <p v-if="o.claimedFaction" class="text-amber-200">의뢰인의 소속 주장: {{ factionDef(d.w,o.claimedFaction)?.label }} · 당사자 확인 필요</p>
      <p>{{ o.label }} · 보수 {{ o.reward }}{{ d.currency }} · 기한 약{{ Math.ceil(o.deadlineTurns/1200) }}시간</p>
      <button class="dbtn mt-1" :disabled="simulating" :data-testid="`bounty-accept-${o.template}`" @click="doAct({type:'bountyAccept',target:d.trader.id,offer:o.id,expectedReward:o.reward})">토벌 수락 (1턴)</button>
    </div>
    <div v-for="row in d.contracts" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="bounty-record">
      <p>{{ row.r.label }} · {{ {active:'진행 중',completed:'보고 완료',cancelled:row.r.outcome==='contradicted'?'설명 모순 보고·반환':row.r.outcome==='alreadyDead'?'다른 처치 확인·반환':'취소',expired:'기한 지남'}[row.r.status] }}</p>
      <p>처치 참여 기록 {{ row.r.evidence.filter(e=>e.kind==='kill'&&e.observed!==false).length }} · 현장 시신 확인 {{ row.r.evidence.filter(e=>e.kind==='foundDead'&&e.observed!==false).length }} · 보수 {{ row.r.reward }}{{ d.currency }} · 예치 {{ row.r.escrow }}{{ d.currency }}</p>
      <p v-if="row.r.testimony" data-testid="bounty-testimony-record">{{ row.r.testimony.name }}의 직접 증언: {{ factionDef(d.w,row.r.testimony.faction)?.label }}. {{ row.r.testimony.faction!==row.r.claimedFaction?'의뢰인의 설명과 다름':'설명과 같음' }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약{{ row.hours }}시간</p>
        <p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" data-testid="bounty-report" @click="doAct({type:'bountyReport',target:d.trader.id,contract:row.r.id,expectedReward:row.r.reward})">토벌 기록 보고 (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating||!!d.error" @click="doAct({type:'contractCancel',target:d.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
