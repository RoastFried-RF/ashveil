<script setup lang="ts">
import {computed} from 'vue'
import {player,terrainAt,type World} from '../../core'
import {t,defText,fieldIssueText}from'../locale'
import {nearbyTerrainFires} from '../../core/terrain-fire'
import {version,world,simulating} from '../store'
import {doAct} from '../ui'
const fires=computed(()=>{void version.value;const w=world.value as World;return nearbyTerrainFires(w,player(w))})
const label=(pos:{x:number;y:number})=>defText(terrainAt(world.value as World,pos))
</script>
<template>
  <div v-if="fires.length" class="my-2 border border-ash-600 p-2 text-xs" data-testid="terrain-fire-panel">
    <p class="text-amber-200">{{ t('주변 화재 · 가까이 있으면 화상을 입을 수 있다.') }}</p>
    <div v-for="f in fires" :key="f.pos.x+':'+f.pos.y" class="my-1">
      <p>{{ label(f.pos) }} · ({{ f.pos.x }},{{ f.pos.y }})</p>
      <button class="dbtn" :disabled="simulating||!!f.quote.error" :title="f.quote.error?fieldIssueText(f.quote.error,{waterMl:f.quote.waterMl}):t('같은 물병에서 실제 물을 쓴다.')" :data-testid="'put-out-terrain-'+f.pos.x+'-'+f.pos.y" @click="doAct({type:'putOutTerrainFire',pos:f.pos})">{{ t('물 {0}ml로 불 끄기 (1턴)',f.quote.waterMl) }}</button>
      <p v-if="f.quote.error" class="text-ash-400">{{ fieldIssueText(f.quote.error,{waterMl:f.quote.waterMl}) }}</p>
    </div>
  </div>
</template>

<style scoped>
.dbtn{white-space:normal;max-width:100%;overflow-wrap:anywhere}
</style>
