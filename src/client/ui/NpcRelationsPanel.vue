<script setup lang="ts">
import {computed} from 'vue'
import {fmtClock,heardNpcRelationships,type World} from '../../core'
import {world,version} from '../store'
const props=defineProps<{personId:number}>()
const report=computed(()=>{void version.value;return heardNpcRelationships(world.value as World,props.personId)})
const attitude={friendly:'정이 든 사이',familiar:'인사를 나누는 이웃',strained:'사이가 껄끄럽다'}
</script>
<template>
  <details v-if="report" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="npc-relations-panel">
    <summary class="cursor-pointer font-title text-amber-100">{{ report.fromName }}에게 들은 이웃 이야기</summary>
    <p class="my-1 text-ash-400">{{ fmtClock(report.at) }}에 직접 들은 당시의 관계를 기록했다.</p>
    <div v-for="person in report.people" :key="person.person" class="my-1 border-b border-ash-700 py-1" data-testid="heard-npc-relation">
      <p>{{ person.name }} · {{ attitude[person.attitude] }}</p><p class="text-ash-400">{{ person.lastKind==='care'?'그가 기억한 돌봄':'그가 기억한 대화' }} {{ fmtClock(person.observedAt) }}<span v-if="person.lastKind==='clash'"> · 그때 말투가 부딪쳤다.</span><span v-else-if="person.lastKind==='care'"> · 실제 처치로 서로 도움을 주고받았다.</span></p>
    </div>
  </details>
</template>
