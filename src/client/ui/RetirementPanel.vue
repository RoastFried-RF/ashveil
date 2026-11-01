<script setup lang="ts">
import {computed} from 'vue'
import {retirementQuote,retirementDef,player,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
import{t,retirementIssueText,retirementLabelText}from'../locale'
const props=defineProps<{keeperId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w),keeper=w.s.creatures.find(c=>c.id===props.keeperId)!;return retirementQuote(w,p,keeper)})
const issue=computed(()=>retirementIssueText(data.value.error,{minHousingDays:retirementDef(world.value as World).minHousingDays,savings:data.value.savings}))
const label=computed(()=>retirementLabelText(data.value.kind,data.value.label))
</script>
<template>
  <section class="my-3 border border-ash-600 p-2 text-xs" data-testid="retirement-panel">
    <h3 class="font-bold">{{ t('정착과 은퇴') }}</h3>
    <p class="my-1 text-ash-300">{{ t('은퇴하면 현재 원정을 마치고 이 정착지에 머문다. 거처와 앞으로의 생활비를 장부에 맡기며, 생애 기록은 연대기에 남는다.') }}</p>
    <p class="my-1">{{ t('{0} · {1}세 · 생활비 {2}년분 {3}전',label,data.age,data.years,data.savings) }}</p>
    <p class="my-1">{{ t(data.bed?'장기 거처 확보 · 우호 관계와 미해결 추적을 확인한다.':'장기 거처 필요 · 우호 관계와 미해결 추적을 확인한다.') }}</p>
    <p v-if="data.disabled" class="my-1 text-amber-200">{{ t('영구 장애로 필요한 저축 기준이 줄었다.') }}</p>
    <p v-if="data.error" class="my-1 text-ash-400" data-testid="retirement-reason">{{ issue }}</p>
    <button class="dbtn-gold" :disabled="simulating||!!data.error" :title="data.error?issue:label" data-testid="retire-confirm" @click="doAct({type:'retire',target:keeperId,expectedSavings:data.savings})">{{ t('생활비 맡기고 은퇴하기') }}</button>
  </section>
</template>
