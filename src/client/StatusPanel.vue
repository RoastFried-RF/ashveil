<script setup lang="ts">
import { computed } from 'vue'
import {
  activeThoughts, ambientTemp, carriedWeight, carryCapacity, comfortMin, fmtClock, insulation, mood, player, skillLevel,
  turnOf, WEATHER_LABEL, daylight, type World,
} from '../core'
import { barClass, pct } from './format'
import { version, world } from './store'

const EFFECT_LABEL: Record<string, string> = {
  painkiller: '진통제', analgesic: '마취제', alcohol: '취기', stimulant: '각성', antibiotic: '항생', sedative: '진정',
  dysentery: '이질', foodPoisoning: '식중독', withdrawal: '금단', shock: '쇼크', stunned: '기절', panic: '공황', drankRecently: '',
}

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const n = pl.needs
  const turn = turnOf(w)
  return {
    pl, n,
    clock: fmtClock(turn),
    weather: WEATHER_LABEL[w.s.weather],
    light: daylight(w),
    amb: ambientTemp(w, pl.pos),
    ins: insulation(w, pl),
    cmin: comfortMin(w, pl),
    weight: carriedWeight(w, pl),
    cap: carryCapacity(pl),
    mood: mood(w, pl),
    thoughts: activeThoughts(w, pl).sort((a, b) => a.mood - b.mood),
    effects: pl.effects.filter((e) => e.untilTurn > turn && EFFECT_LABEL[e.kind]).map((e) => ({ label: EFFECT_LABEL[e.kind] ?? e.kind, min: Math.ceil(((e.untilTurn - turn) * 3) / 60) })),
    bg: pl.background ? w.db.background(pl.background).label : '',
    traits: pl.traits.map((t) => w.db.trait(t)),
    skills: Object.keys(pl.skills).filter((k) => w.db.has(k)).map((k) => ({ label: w.db.skill(k).label, lv: skillLevel(pl, k), passion: pl.passions[k] ?? 0 })).sort((a, b) => b.lv - a.lv),
    stats: pl.stats,
  }
})

const needs = computed(() => {
  const n = d.value.n
  return [
    { k: '열량', v: n.kcal / 3000, t: `${Math.round(n.kcal)} kcal` },
    { k: '수분', v: n.water / 3000, t: `${Math.round(n.water)} ml` },
    { k: '비타민', v: n.vitamin / 100, t: n.vitamin.toFixed(0) },
    { k: '기력', v: n.stamina / 100, t: n.stamina.toFixed(0) },
    { k: '피로', v: 1 - n.fatigue / 100, t: n.fatigue.toFixed(0) },
    { k: '스트레스', v: 1 - n.stress / 100, t: n.stress.toFixed(0) },
  ]
})
</script>

<template>
  <div class="space-y-3 text-xs" data-testid="status-panel">
    <div>
      <div class="text-sm text-ash-100">{{ d.pl.name }} <span class="text-ash-400">· {{ d.bg }}</span></div>
      <div class="mt-0.5 flex flex-wrap gap-1">
        <span v-for="t in d.traits" :key="t.id" class="rounded bg-ash-800 px-1 text-amber-200" :title="t.description">{{ t.label }}</span>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-ash-300">
      <span>{{ d.clock }}</span><span>{{ d.weather }} · 밝기 {{ pct(d.light) }}</span>
      <span>기온 {{ d.amb.toFixed(1) }}°C</span>
      <span>체온 <b :class="d.n.bodyTemp < 35.5 ? 'text-blood-300' : d.n.bodyTemp > 37.8 ? 'text-amber-300' : 'text-ash-100'">{{ d.n.bodyTemp.toFixed(1) }}°C</b></span>
      <span>단열 {{ d.ins }} (쾌적 ≥{{ d.cmin.toFixed(0) }}°C)</span>
      <span>젖음 <b :class="d.n.wetness > 60 ? 'text-amber-300' : ''">{{ d.n.wetness.toFixed(0) }}%</b></span>
      <span>무게 <b :class="d.weight > d.cap ? 'text-blood-300' : ''">{{ d.weight }}</b> / {{ d.cap }} kg</span>
    </div>
    <div class="space-y-1">
      <div v-for="x in needs" :key="x.k" class="flex items-center gap-2">
        <span class="w-14 text-ash-400">{{ x.k }}</span>
        <div class="h-1.5 flex-1 rounded bg-ash-800"><div class="h-1.5 rounded" :class="barClass(x.v)" :style="{ width: pct(Math.max(0, Math.min(1, x.v))) }" /></div>
        <span class="w-16 text-right font-mono text-ash-300">{{ x.t }}</span>
      </div>
    </div>
    <div v-if="d.effects.length" class="flex flex-wrap gap-1">
      <span v-for="e in d.effects" :key="e.label" class="rounded bg-ash-800 px-1 text-ash-200">{{ e.label }} {{ e.min }}분</span>
    </div>
    <div>
      <div class="mb-1 text-ash-400">기분 <b :class="d.mood < 30 ? 'text-blood-300' : d.mood > 55 ? 'text-moss-300' : 'text-ash-100'">{{ d.mood.toFixed(0) }}</b></div>
      <ul class="space-y-0.5">
        <li v-for="t in d.thoughts" :key="t.def" class="flex justify-between">
          <span class="text-ash-300">{{ t.label }}</span>
          <span class="font-mono" :class="t.mood < 0 ? 'text-blood-300' : 'text-moss-300'">{{ t.mood > 0 ? '+' : '' }}{{ t.mood }}</span>
        </li>
      </ul>
    </div>
    <div>
      <div class="mb-1 text-ash-400">능력치</div>
      <div class="grid grid-cols-5 gap-1 text-center">
        <div v-for="(v, k) in { 근력: d.stats.str, 민첩: d.stats.agi, 지각: d.stats.per, 활력: d.stats.vit, 의지: d.stats.wil }" :key="k" class="rounded bg-ash-800 p-1">
          <div class="text-[10px] text-ash-400">{{ k }}</div><div class="font-mono">{{ v }}</div>
        </div>
      </div>
    </div>
    <div>
      <div class="mb-1 text-ash-400">숙련 (쓰면 오른다)</div>
      <div class="grid grid-cols-2 gap-x-3">
        <div v-for="s in d.skills" :key="s.label" class="flex justify-between">
          <span class="text-ash-300">{{ s.label }}<span v-if="s.passion" class="text-amber-400">{{ s.passion === 2 ? ' ★★' : ' ★' }}</span></span>
          <span class="font-mono">{{ s.lv }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
