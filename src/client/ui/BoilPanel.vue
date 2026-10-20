<script setup lang="ts">
import {computed} from 'vue'
import {isWaterVessel,drinkVolume,itemLabel,multiTurnFactor,player,waterBoilQuote,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{w,p,bottles:p.bag.filter(i=>isWaterVessel(w,i)&&(i.uses??0)>0).map(it=>({it,ml:drinkVolume(w,it),q:waterBoilQuote(w,p,it.uid,multiTurnFactor(w,p))}))}})
</script>
<template>
  <section v-if="d.bottles.length||d.p.boilJob" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="boil-panel">
    <p>물 끓이기 · 실제 물 용기와 원래 열원으로 남은 시간을 이어 간다</p>
    <div v-if="d.p.boilJob" data-testid="boil-progress" class="my-2 text-amber-200">
      중단한 물 끓이기 · 남은 {{ d.p.boilJob.remaining }}/{{ d.p.boilJob.total }}턴
      <button class="dbtn ml-1" data-boil-action="cancel" :disabled="simulating" @click="doAct({type:'cancelBoil'})">물 끓이기 취소</button>
    </div>
    <p class="text-ash-400">끝까지 끓어야 병원체가 사라진다. 재와 소금은 남는다.</p>
    <div v-for="b in d.bottles" :key="b.it.uid" :data-boil-uid="b.it.uid" class="my-2">
      <p>{{ itemLabel(d.w,b.it) }} · 실제 {{ b.ml }}ml</p>
      <button class="dbtn my-1" data-boil-action="start" :disabled="simulating||!!b.q.error" :title="b.q.error??''" @click="doAct({type:'waterTreatment',uid:b.it.uid,method:'boil'})">{{ d.p.boilJob?.uid===b.it.uid?'물 끓이기 재개':'이 용기 끓이기' }} ({{ b.q.error?'조건 확인':b.q.turns+'턴' }})</button>
      <p v-if="!b.q.error && b.q.fuel" class="text-ash-300">실제 연료 {{ b.q.batches }}개 · 마지막 완료 때만 사용</p>
      <p v-if="b.q.error" class="text-ash-400">{{ b.q.error }}</p>
    </div>
  </section>
</template>
