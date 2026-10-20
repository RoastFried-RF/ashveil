<script setup lang="ts">
import { computed } from 'vue'
import { cheb, hasLos, player, tileAt, worldSimulationDef, type World } from '../../core'
import { version, world } from '../store'
const data = computed(() => {
  void version.value
  const w = world.value as World, depot = w.s.map.residentDepot, p = player(w)
  if (!depot || cheb(p.pos, depot.pos) > 1 || !hasLos(w, p.pos, depot.pos) || tileAt(w, depot.pos).t !== depot.terrain) return null
  const stock = w.s.overworld?.simulation?.settlements[depot.site], perDay = worldSimulationDef(w).consumption.Food ?? 0
  const fuelRate = worldSimulationDef(w).consumption.Fuel ?? 0
  return stock ? { days: perDay > 0 ? Math.max(0, (stock.reserve.Food ?? 0) / perDay).toFixed(1) : null, fuelDays: fuelRate > 0 ? Math.max(0, (stock.reserve.Fuel ?? 0) / fuelRate).toFixed(1) : null } : null
})
</script>
<template>
  <section v-if="data" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="resident-depot">
    <h3 class="font-bold">주민 배급 창고</h3>
    <p v-if="data.days !== null" data-testid="depot-food">공동 식량 약 {{ data.days }}인·일분</p>
    <p v-if="data.fuelDays !== null" data-testid="depot-fuel">공동 연료 약 {{ data.fuelDays }}인·일분</p>
    <p class="text-ash-300">주민용 배급이다. 여행자는 상점에서 식량·연료를 살 수 있다.</p>
  </section>
</template>
