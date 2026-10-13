<script setup lang="ts">
import { computed } from 'vue'
import type { CreatureDef, ItemDef, World } from '../core'
import { version, world } from './store'

const d = computed(() => {
  void version.value
  const w = world.value as World
  const k = w.s.knowledge
  const pills = w.db.all<ItemDef>('Item').filter((i) => i.unidentified === 'pill').map((i) => ({
    label: i.label,
    known: k.pillKnown[i.id] ? w.db.pill(k.pillKnown[i.id]) : null,
  }))
  const beasts = w.db.all<CreatureDef>('Creature').filter((c) => !c.abstract && c.faction !== 'player').map((c) => {
    const b = k.bestiary[c.id]
    const stage = !b ? 0 : b.killed > 0 ? 3 : b.fought > 0 ? 2 : 1
    return { c, b, stage, lines: (c.bestiary ?? []).slice(0, stage) }
  })
  return { pills, beasts }
})
</script>

<template>
  <div class="space-y-3 text-xs" data-testid="knowledge-panel">
    <div>
      <div class="mb-1 text-ash-400">알약 (시드마다 색과 효과가 섞인다)</div>
      <div v-for="p in d.pills" :key="p.label" class="flex justify-between border-b border-ash-800 py-0.5">
        <span>{{ p.label }}</span>
        <span :class="p.known ? 'text-moss-300' : 'text-ash-500'" :title="p.known?.description">{{ p.known ? p.known.label : '???' }}</span>
      </div>
    </div>
    <div>
      <div class="mb-1 text-ash-400">도감 (보고 → 싸우고 → 잡아야 더 알게 된다)</div>
      <div v-for="x in d.beasts" :key="x.c.id" class="mb-2 rounded border border-ash-700 p-1.5">
        <div class="flex justify-between">
          <span :class="x.stage ? 'text-ash-100' : 'text-ash-500'">{{ x.stage ? x.c.label : '???' }}</span>
          <span v-if="x.b" class="text-ash-500">교전 {{ x.b.fought }} · 처치 {{ x.b.killed }}</span>
        </div>
        <p v-for="(l, i) in x.lines" :key="i" class="mt-0.5 text-ash-300">{{ ['관찰', '전투', '처치'][i] }}: {{ l }}</p>
      </div>
    </div>
  </div>
</template>
