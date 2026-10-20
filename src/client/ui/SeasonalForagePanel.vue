<script setup lang="ts">
import{computed}from'vue'
import{calendar,nearbySeasonalGather,seasonalGatherError,terrainAt,player,type World}from'../../core'
import{simulating,version,world}from'../store'
import{doAct}from'../ui'
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{season:calendar(w).season.label,rows:nearbySeasonalGather(w,p).map(pos=>({pos,def:terrainAt(w,pos),error:seasonalGatherError(w,pos)}))}})
</script>
<template>
  <section v-if="d.rows.length" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="seasonal-forage">
    <p>계절 채집 · 지금은 {{ d.season }}</p>
    <div v-for="g in d.rows" :key="g.pos.x+','+g.pos.y" class="my-1">
      <span>{{ g.def.label }} {{ g.pos.x }},{{ g.pos.y }}</span>
      <button class="dbtn m-1" :disabled="simulating||!!g.error" :title="g.error??''" data-forage-action="gather" @click="doAct({type:'gather',pos:g.pos})">열매 모으기</button>
      <p v-if="g.error" class="text-ash-400">{{ g.error }}</p>
    </div>
  </section>
</template>
