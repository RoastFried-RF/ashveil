<script setup lang="ts">
import {computed} from 'vue'
import {evidenceDefs,evidenceQuote,player,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>()
const rows=computed(()=>{void version.value;const w=world.value as World,p=player(w),person=w.s.creatures.find(c=>c.id===props.personId);return evidenceDefs(w).filter(rule=>person?.faction===rule.sourceFaction||person?.evidenceHeard?.[rule.id]).map(rule=>({rule,quote:evidenceQuote(w,p,props.personId,rule.id),heard:person?.evidenceHeard?.[rule.id],held:rule.hold.map(id=>w.db.item(id).label).join(' · ')}))})
</script>
<template>
  <section v-for="row in rows" :key="row.rule.id" class="my-3 border border-ash-600 p-2 text-xs" :data-evidence-rule="row.rule.id">
    <h3 class="font-bold">{{ row.rule.label }}</h3>
    <p class="my-1 text-ash-300">{{ row.rule.description }}</p>
    <p v-if="row.heard" class="my-1 text-amber-200" data-evidence-response>{{ row.heard.choice==='reform'?'원본 기록을 확인하고 기존 규정에 따르지 않기로 했다.':'원본 기록을 확인했지만 지금의 규정을 지키기로 했다.' }}</p>
    <template v-else>
      <p class="my-1">원본 소지: {{ row.held }}</p>
      <button class="dbtn" :disabled="simulating||!!row.quote.error" :title="row.quote.error??row.rule.description" data-evidence-disclose @click="doAct({type:'discloseEvidence',target:personId,rule:row.rule.id})">원본 보여 주고 읽기 ({{ row.quote.turns }}턴)</button>
      <p v-if="row.quote.error" class="my-1 text-ash-400">{{ row.quote.error }}</p>
    </template>
  </section>
</template>
