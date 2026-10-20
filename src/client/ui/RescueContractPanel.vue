<script setup lang="ts">
import {computed} from 'vue'
import {contractAccess,creatureById,economyDef,isRescueContract,player,rescueOffers,rescueReportQuote,turnOf,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w),trader=creatureById(w,props.traderId)!,records=(w.s.overworld?.contracts??[]).filter(isRescueContract).filter(r=>r.site===trader.traderSite).slice(-8).reverse().map(r=>({r,quote:rescueReportQuote(w,p,trader,r.id),hours:Math.max(0,Math.ceil((r.deadline-turnOf(w))/1200))}));return{w,trader,offers:rescueOffers(w,p,trader),records,error:contractAccess(w,p,trader),currency:economyDef(w).currency}})
</script>
<template>
  <details class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="rescue-contract-panel">
    <summary class="cursor-pointer font-title text-amber-100">구조 의뢰</summary>
    <p class="my-1 text-ash-400">알려진 마지막 목격의 같은 사람을 해방하고 이 장부 곁에서 귀환을 확인한다. 과거 목격은 현재 위치나 생존을 보장하지 않는다.</p>
    <p v-if="data.error" class="text-red-300">{{ data.error }}</p>
    <p v-if="!data.error&&!data.offers.length" class="text-ash-400">새로 맡을 구조 의뢰가 없다. 직접 봤거나 목격자에게 들은 같은 소속 포로와 진행 중인 의뢰·보수를 확인하자.</p>
    <div v-for="o in data.offers" :key="o.id" class="my-2 border border-ash-700 p-2" data-testid="rescue-contract-offer">
      <p v-if="o.witness" class="text-amber-200">{{ o.witness.fromName }}에게 {{ o.witness.kind==='interrogation'?'심문으로':'대화로' }} 전해 들은 목격. 그 뒤의 생존/위치는 현장에서 확인해야 한다.</p><p>{{ o.label }} · 보수 {{ o.reward }}{{ data.currency }} · 기한 약{{ Math.ceil(o.deadlineTurns/1200) }}시간</p>
      <button class="dbtn mt-1" :disabled="simulating" data-testid="rescue-contract-accept" @click="doAct({type:'rescueContractAccept',target:data.trader.id,offer:o.id,expectedReward:o.reward})">구조 수락 (1턴)</button>
    </div>
    <div v-for="row in data.records" :key="row.r.id" class="my-2 border border-ash-700 p-2" data-testid="rescue-contract-record">
      <p>{{ row.r.label }}<span v-if="row.r.relic"> · 원래 유품 회수</span> · {{ {active:'진행 중',completed:'귀환 확인 완료',cancelled:'취소',expired:'기한 지남'}[row.r.status] }}</p>
      <p>보수 {{ row.r.reward }}{{ data.currency }} · 예치 {{ row.r.escrow }}{{ data.currency }}</p>
      <template v-if="row.r.status==='active'">
        <p>남은 시간 약{{ row.hours }}시간</p><p>{{ row.r.mapName }} · 마지막 목격({{ row.r.pos.x }},{{ row.r.pos.y }}) · {{ row.r.name }}</p><p v-if="row.r.relic">시신에서 직접 식별한 같은 원래 유품을 가져와야 한다.</p><p v-else-if="row.r.proof">맡은 뒤 원래 포박을 직접 해방했다. 같은 사람의 실제 귀환을 확인해야 한다.</p><p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
        <button class="dbtn-gold mt-1" :disabled="simulating||!!row.quote.error" data-testid="rescue-contract-report" @click="doAct({type:'rescueContractReport',target:data.trader.id,contract:row.r.id,expectedReward:row.r.reward})">{{ row.r.relic?'같은 유품 납품':'실제 귀환 보고' }} (1턴)</button>
        <button class="dbtn ml-2" :disabled="simulating||!!data.error" @click="doAct({type:'contractCancel',target:data.trader.id,contract:row.r.id})">취소·보수 반환 (1턴)</button>
      </template>
    </div>
  </details>
</template>
