<script setup lang="ts">
import { computed } from 'vue'
import { localSettlementSupply, type World } from '../../core'
import { version, world } from '../store'
import ItemIcon from './ItemIcon.vue'
import{t}from'../locale'
const data = computed(() => {
  void version.value
  return localSettlementSupply(world.value as World)
})
const foodLine=computed(()=>data.value?.lastSupply?.commodities.Food)
const fmt=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:2})
const foodUnits=(value:number)=>fmt(value/data.value!.foodRate)
</script>
<template>
  <section v-if="data" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="resident-depot">
    <div class="flex items-center gap-2">
      <ItemIcon :name="'original_pantry_'+data.status" :size="32" />
      <div>
        <h3 class="font-bold text-amber-100">{{ t('주민 배급 창고') }}</h3>
        <p class="text-ash-300" data-testid="depot-food-status">{{ t(data.status==='empty'?'공동 식량이 비었다':data.foodSettlementDays===null?'공동 식량 있음 · 정착지 하루 기준 없음':data.status==='low'?'정착지 하루분 미만':'정착지 하루분 이상') }}</p>
      </div>
    </div>
    <div class="my-2 grid grid-cols-2 gap-2 rounded border border-ash-600 bg-black/20 p-2">
      <div v-if="data.foodPersonDays !== null">
        <p class="text-ash-400">{{ t('공동 식량') }}</p><p class="font-bold text-amber-100" data-testid="depot-food">{{ t('약 {0}인·일분',fmt(data.foodPersonDays)) }}</p>
        <p v-if="data.foodSettlementDays!==null" class="text-ash-300" data-testid="depot-food-days">{{ t('생존 주민 {0}명 기준 {1}일분',data.population,fmt(data.foodSettlementDays)) }}</p>
      </div>
      <div v-if="data.fuelPersonDays!==null">
        <p class="text-ash-400">{{ t('공동 연료') }}</p><p data-testid="depot-fuel">{{ t('약 {0}인·일분',fmt(data.fuelPersonDays)) }}</p>
      </div>
    </div>
    <p v-if="data.foodRate>0" class="text-ash-400" data-testid="depot-market-food">{{ t('마을 배급으로 환산되는 상점 식량 {0}인·일분은 창고 수량과 별도다. 다른 먹거리는 거래 목록을 확인하자.',foodUnits(data.marketRationFood)) }}</p>
    <div v-if="foodLine&&data.foodRate>0" class="mt-2 space-y-1 border-t border-ash-700 pt-2" data-testid="depot-supply-ledger">
      <p class="font-bold text-ash-200">{{ t('{0}일차 완료 장부 · 당시 생존 {1}명',data.lastSupply!.day+1,data.lastSupply!.population) }}</p>
      <p>{{ t('생산 {0}인·일분 · 공동 요청 {1}인·일분',foodUnits(foodLine.produced),foodUnits(foodLine.requested)) }}</p>
      <p>{{ t('실제 공동 소비 {0}인·일분 · 주민 직접 소비 {1}인·일분 별도 반영',foodUnits(foodLine.supplied),foodUnits(foodLine.residentUsed)) }}</p>
      <p v-if="foodLine.unmet>0" class="text-amber-200" data-testid="depot-food-unmet">{{ t('공동 소비 {0}인·일분을 충당하지 못했다.',foodUnits(foodLine.unmet)) }}</p>
      <p v-else class="text-moss-300" data-testid="depot-food-met">{{ t('기록된 공동 식량 요청을 모두 충당했다.') }}</p>
    </div>
    <p v-else class="mt-2 text-ash-400" data-testid="depot-supply-unrecorded">{{ t(data.foodRate>0?'아직 완료일의 식량 수급 기록이 없다.':'식량 소비 기준이 설정되어 있지 않다.') }}</p>
    <p class="mt-2 text-ash-300">{{ t('주민용 배급이다. 여행자는 상점에서 식량·연료를 살 수 있다.') }}</p>
  </section>
</template>
