<script setup lang="ts">
import { computed } from 'vue'
import { aquaticRules, cheb, equippedBulk, hasLos, inDeepWater, player, waterRescueQuote, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
import{t}from'../locale'
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{p,deep:inDeepWater(w,p),bulk:equippedBulk(w,p),rules:aquaticRules(w),targets:w.s.creatures.filter(c=>c.id!==p.id&&c.alive&&c.aquatic?.submerged&&cheb(c.pos,p.pos)<=1&&hasLos(w,p.pos,c.pos)).map(c=>({c,q:waterRescueQuote(w,p,c.id)}))}})
</script>
<template>
  <section v-if="data.deep||data.p.aquatic||data.targets.length" class="my-3 border border-ash-600 p-2 text-xs" data-testid="aquatic-panel">
    <h3 class="mb-1 font-bold">{{ t('깊은 물과 구조') }}</h3>
    <p v-if="data.deep">{{ t('수영 한 칸2턴 · 착용 둔중 {0} / 위험 기준 {1} · 기력 {2}',data.bulk,data.rules.bulkThreshold,data.p.needs.energy.toFixed(0)) }}</p>
    <p v-if="data.p.aquatic" :class="data.p.aquatic.submerged?'text-blood-300':'text-amber-200'">{{ t('{0} · 남은 숨 {1}턴 · 산소 부족 {2}/{3}턴',t(data.p.aquatic.submerged?'물속에 잠겼다':'수면에서 숨을 쉰다'),Math.ceil(data.p.aquatic.air),data.p.aquatic.hypoxia,data.rules.hypoxiaFatalTurns) }}</p>
    <p v-if="data.deep" class="my-1 text-ash-300">{{ t('물가로 나가야 기력을 회복한다. 둔중한 장비를 벗고 기력이 남아 있어야 다시 뜰 수 있다.') }}</p>
    <div v-for="row in data.targets" :key="row.c.id" class="mt-2">
      <p><span data-original-person-name>{{ row.c.name }}</span> {{ t('· 남은 숨 {0}턴',Math.ceil(row.c.aquatic!.air)) }}</p>
      <button class="dbtn" :disabled="simulating||!!row.q.error" :title="t(row.q.error??'같은 사람과 장비를 실제 빈 물가로 옮긴다')" :data-water-rescue="row.c.id" @click="doAct({type:'rescueWater',target:row.c.id})">{{ t('실제 물가로 끌어내기 · {0}턴',row.q.turns) }}</button>
      <p v-if="row.q.error" class="text-ash-400">{{ t(row.q.error) }}</p>
    </div>
  </section>
</template>
