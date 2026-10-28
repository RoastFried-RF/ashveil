<script setup lang="ts">
import {computed} from 'vue'
import {collectRecoveryQuote,companionAccess,companionRecoveryQuote,creatureById,isCompanion,isRecoveryContract,player,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,c=creatureById(w,props.personId)!,p=player(w)
 if(!isCompanion(w,c)&&!(c.companion?.employer===p.id&&c.recoveryCargo))return
 const access=companionAccess(w,c,c.activity?.kind==='search'&&c.activity.recoveryContract===c.companionRecovery?.id?'search':undefined)
 return{c,access,collect:collectRecoveryQuote(w,c),records:(w.s.overworld?.contracts??[]).filter(isRecoveryContract).filter(r=>r.status==='active').map(r=>({r,quote:companionRecoveryQuote(w,c,r.id)}))}})
</script>
<template>
  <details v-if="data" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="companion-recovery-panel">
    <summary class="cursor-pointer font-title text-amber-100">동료에게 원본 회수 맡기기</summary>
    <p class="my-1 text-ash-400">같은 현장에서 직접 걸어가 원본을 들고 돌아온다. 동료의 급료·몸·식수·배낭 공간을 쓴다. 납품 보수는 의뢰인에게 직접 보고해야 한다.</p>
    <p v-if="data.access" class="text-amber-200">{{ data.access }}</p>
    <template v-else>
      <p v-if="data.c.companionRecovery" data-testid="companion-recovery-status">{{ {outbound:'맡긴 현장으로 가서 확인 중',returning:'원본을 들고 귀환 중',failed:'현장 확인 뒤 돌아와 보고 중'}[data.c.companionRecovery.phase] }}<span v-if="data.c.companionRecovery.reason"> · {{ data.c.companionRecovery.reason }}</span></p>
      <button v-if="data.c.companionRecovery" class="dbtn my-1" :disabled="simulating" data-testid="companion-recovery-stop" @click="doAct({type:'companionRecoveryStop',target:data.c.id})">회수 지시 중단 (1턴)</button>
      <template v-if="data.c.recoveryCargo"><p v-if="data.collect.error" class="text-amber-200">{{ data.collect.error }}</p><button class="dbtn my-1" :disabled="simulating||!!data.collect.error" data-testid="companion-recovery-collect" @click="doAct({type:'companionRecoveryCollect',target:data.c.id})">맡긴 원본 받기 (1턴)</button></template>
    </template>
    <div v-for="row in data.records" :key="row.r.id" class="my-1 border-t border-ash-700 pt-1"><p>{{ row.r.label }}</p><p v-if="row.quote.error" class="text-ash-400">{{ row.quote.error }}</p><button class="dbtn mt-1" :disabled="simulating||!!row.quote.error" data-testid="companion-recovery-assign" @click="doAct({type:'companionRecoveryAssign',target:data.c.id,contract:row.r.id})">이 원본 회수 부탁 (1턴)</button></div>
  </details>
</template>
