<script setup lang="ts">
import {computed} from 'vue'
import {brushClearingQuote,nearbyBrushClearing,player,terrainAt,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return nearbyBrushClearing(w,p).map(pos=>({pos,label:terrainAt(w,pos).label,quote:brushClearingQuote(w,p,pos)}))})
</script>
<template>
  <section v-if="d.length" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="brush-clearing">
    <h3 class="mb-1 font-bold">덤불 베기</h3>
    <p class="text-ash-300">덤불을 영구 제거한다. 열매가 다시 자라지 않으며, 빈 흙에 다른 작물을 심을 수 있다.</p>
    <p class="text-ash-400">중단하면 처음부터 다시 벤다.</p>
    <div v-for="row in d" :key="row.pos.x+','+row.pos.y" class="mt-2">
      {{ row.label }} · {{ row.pos.x }},{{ row.pos.y }}
      <button class="dbtn ml-2" :disabled="simulating||!!row.quote.error" :data-testid="`clear-brush-${row.pos.x}-${row.pos.y}`" @click="doAct({type:'clearBrush',pos:row.pos})">베어 빈 땅 만들기<span v-if="!row.quote.error"> ({{ row.quote.turns }}턴)</span></button>
      <p v-if="row.quote.error" class="mt-1 text-ash-400">{{ row.quote.error }}</p>
    </div>
  </section>
</template>
