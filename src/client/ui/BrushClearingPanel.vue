<script setup lang="ts">
import {computed} from 'vue'
import {brushClearingQuote,nearbyBrushClearing,player,terrainAt,type World} from '../../core'
import {t,defText,fieldIssueText}from'../locale'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return nearbyBrushClearing(w,p).map(pos=>({pos,def:terrainAt(w,pos),tools:terrainAt(w,pos).clearing!.tools.map(id=>w.db.item(id)),quote:brushClearingQuote(w,p,pos)}))})
</script>
<template>
  <section v-if="d.length" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="brush-clearing">
    <h3 class="mb-1 font-bold">{{ t('덤불 베기') }}</h3>
    <p class="text-ash-300">{{ t('덤불을 영구 제거한다. 열매가 다시 자라지 않으며, 빈 흙에 다른 작물을 심을 수 있다.') }}</p>
    <p class="text-ash-400">{{ t('중단하면 처음부터 다시 벤다.') }}</p>
    <div v-for="row in d" :key="row.pos.x+','+row.pos.y" class="mt-2">
      {{ defText(row.def) }} · {{ row.pos.x }},{{ row.pos.y }}
      <button class="dbtn ml-2" :disabled="simulating||!!row.quote.error" :data-testid="`clear-brush-${row.pos.x}-${row.pos.y}`" @click="doAct({type:'clearBrush',pos:row.pos})">{{ t('베어 빈 땅 만들기') }}<span v-if="!row.quote.error"> ({{ t('{0}턴',row.quote.turns) }})</span></button>
      <p v-if="row.quote.error" class="mt-1 text-ash-400">{{ fieldIssueText(row.quote.error,{tools:row.tools}) }}</p>
    </div>
  </section>
</template>

<style scoped>
.dbtn{white-space:normal;max-width:100%;overflow-wrap:anywhere}
</style>
