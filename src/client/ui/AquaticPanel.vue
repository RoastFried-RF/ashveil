<script setup lang="ts">
import { computed } from 'vue'
import { aquaticRules, cheb, equippedBulk, hasLos, inDeepWater, player, waterRescueQuote, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{p,deep:inDeepWater(w,p),bulk:equippedBulk(w,p),rules:aquaticRules(w),targets:w.s.creatures.filter(c=>c.id!==p.id&&c.alive&&c.aquatic?.submerged&&cheb(c.pos,p.pos)<=1&&hasLos(w,p.pos,c.pos)).map(c=>({c,q:waterRescueQuote(w,p,c.id)}))}})
</script>
<template>
  <section v-if="data.deep||data.p.aquatic||data.targets.length" class="my-3 border border-ash-600 p-2 text-xs" data-testid="aquatic-panel">
    <h3 class="mb-1 font-bold">깊은 물과 구조</h3>
    <p v-if="data.deep">수영 한 칸2턴 · 착용 둔중 {{ data.bulk }} / 위험 기준 {{ data.rules.bulkThreshold }} · 기력 {{ data.p.needs.energy.toFixed(0) }}</p>
    <p v-if="data.p.aquatic" :class="data.p.aquatic.submerged?'text-blood-300':'text-amber-200'">{{ data.p.aquatic.submerged?'물속에 잠겼다':'수면에서 숨을 쉰다' }} · 남은 숨 {{ Math.ceil(data.p.aquatic.air) }}턴 · 산소 부족 {{ data.p.aquatic.hypoxia }}/{{ data.rules.hypoxiaFatalTurns }}턴</p>
    <p v-if="data.deep" class="my-1 text-ash-300">물가로 나가야 기력을 회복한다. 둔중한 장비를 벗고 기력이 남아 있어야 다시 뜰 수 있다.</p>
    <div v-for="row in data.targets" :key="row.c.id" class="mt-2">
      <p>{{ row.c.name }} · 남은 숨 {{ Math.ceil(row.c.aquatic!.air) }}턴</p>
      <button class="dbtn" :disabled="simulating||!!row.q.error" :title="row.q.error??'같은 사람과 장비를 실제 빈 물가로 옮긴다'" :data-water-rescue="row.c.id" @click="doAct({type:'rescueWater',target:row.c.id})">실제 물가로 끌어내기 · {{ row.q.turns }}턴</button>
      <p v-if="row.q.error" class="text-ash-400">{{ row.q.error }}</p>
    </div>
  </section>
</template>
