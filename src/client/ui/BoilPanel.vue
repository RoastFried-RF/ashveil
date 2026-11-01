<script setup lang="ts">
import {computed} from 'vue'
import {isWaterVessel,drinkVolume,multiTurnFactor,player,waterBoilQuote,type World} from '../../core'
import {waterSafetyDef}from'../../core/water-state'
import {t,defText}from'../locale'
import {displayItemLabel as itemLabel}from'../locales/item'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{w,p,bottles:p.bag.filter(i=>isWaterVessel(w,i)&&(i.uses??0)>0).map(it=>({it,ml:drinkVolume(w,it),q:waterBoilQuote(w,p,it.uid,multiTurnFactor(w,p))}))}})
function issue(error:string|null|undefined){const w=world.value as World,tool=waterSafetyDef(w).treatments.boil.tool,def=tool&&w.db.item(tool);return def&&error===`${def.label}의 실제 물량에 맞는 잔량이 필요하다`?t('{0}의 실제 물량에 맞는 잔량이 필요하다',defText(def)):t(error??'')}
</script>
<template>
  <section v-if="d.bottles.length||d.p.boilJob" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="boil-panel">
    <p>{{ t('물 끓이기 · 실제 물 용기와 원래 열원으로 남은 시간을 이어 간다') }}</p>
    <div v-if="d.p.boilJob" data-testid="boil-progress" class="my-2 text-amber-200">
      {{ t('중단한 물 끓이기 · 남은 {0}/{1}턴',d.p.boilJob.remaining,d.p.boilJob.total) }}
      <button class="dbtn ml-1" data-boil-action="cancel" :disabled="simulating" @click="doAct({type:'cancelBoil'})">{{ t('물 끓이기 취소') }}</button>
    </div>
    <p class="text-ash-400">{{ t('끝까지 끓어야 병원체가 사라진다. 재와 소금은 남는다.') }}</p>
    <div v-for="b in d.bottles" :key="b.it.uid" :data-boil-uid="b.it.uid" class="my-2">
      <p>{{ t('{0} · 실제 {1}ml',itemLabel(d.w,b.it),b.ml) }}</p>
      <button class="dbtn my-1" data-boil-action="start" :disabled="simulating||!!b.q.error" :title="issue(b.q.error)" @click="doAct({type:'waterTreatment',uid:b.it.uid,method:'boil'})">{{ t(d.p.boilJob?.uid===b.it.uid?'물 끓이기 재개':'이 용기 끓이기') }} ({{ b.q.error?t('조건 확인'):t('{0}턴',b.q.turns) }})</button>
      <p v-if="!b.q.error && b.q.fuel" class="text-ash-300">{{ t('실제 연료 {0}개 · 마지막 완료 때만 사용',b.q.batches) }}</p>
      <p v-if="b.q.error" class="text-ash-400">{{ issue(b.q.error) }}</p>
    </div>
  </section>
</template>
