<script setup lang="ts">
import {computed} from 'vue'
import {player,type World} from '../../core'
import {nearbyTerrainFires} from '../../core/terrain-fire'
import {version,world,simulating} from '../store'
import {doAct} from '../ui'
const fires=computed(()=>{void version.value;const w=world.value as World;return nearbyTerrainFires(w,player(w))})
</script>
<template>
  <div v-if="fires.length" class="my-2 border border-ash-600 p-2 text-xs" data-testid="terrain-fire-panel">
    <p class="text-amber-200">주변 화재 · 가까이 있으면 화상을 입을 수 있다.</p>
    <div v-for="f in fires" :key="f.pos.x+':'+f.pos.y" class="my-1">
      <p>{{ f.label }} · ({{ f.pos.x }},{{ f.pos.y }})</p>
      <button class="dbtn" :disabled="simulating||!!f.quote.error" :title="f.quote.error??'같은 물병에서 실제 물을 쓴다.'" :data-testid="'put-out-terrain-'+f.pos.x+'-'+f.pos.y" @click="doAct({type:'putOutTerrainFire',pos:f.pos})">물 {{ f.quote.waterMl }}ml로 불 끄기 (1턴)</button>
      <p v-if="f.quote.error" class="text-ash-400">{{ f.quote.error }}</p>
    </div>
  </div>
</template>
