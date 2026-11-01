<script setup lang="ts">
import{computed}from'vue'
import{calendar,nearbySeasonalGather,seasonalGatherError,terrainAt,player,type World,type SeasonDef}from'../../core'
import{t,defText,fieldIssueText}from'../locale'
import{simulating,version,world}from'../store'
import{doAct}from'../ui'
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{season:calendar(w).season,rows:nearbySeasonalGather(w,p).map(pos=>({pos,def:terrainAt(w,pos),seasons:terrainAt(w,pos).gather!.seasons!.map(id=>w.db.tryGet<SeasonDef>(id)??{id,label:id}),error:seasonalGatherError(w,pos)}))}})
</script>
<template>
  <section v-if="d.rows.length" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="seasonal-forage">
    <p>{{ t('계절 채집 · 지금은 {0}',defText(d.season)) }}</p>
    <div v-for="g in d.rows" :key="g.pos.x+','+g.pos.y" class="my-1">
      <span>{{ defText(g.def) }} {{ g.pos.x }},{{ g.pos.y }}</span>
      <button class="dbtn m-1" :disabled="simulating||!!g.error" :title="fieldIssueText(g.error,{seasons:g.seasons})" data-forage-action="gather" @click="doAct({type:'gather',pos:g.pos})">{{ t('열매 모으기') }}</button>
      <p v-if="g.error" class="text-ash-400">{{ fieldIssueText(g.error,{seasons:g.seasons}) }}</p>
    </div>
  </section>
</template>

<style scoped>
.dbtn{white-space:normal;max-width:100%;overflow-wrap:anywhere}
</style>
