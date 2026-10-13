<script setup lang="ts">
// 경고 띠 (12 §6): P0 치명 · P1 위험 · P2 주의. 최대 3개, P0 > P1 > P2, 같은 등급은 남은 턴이 짧은 순
import { computed } from 'vue'
import type { World } from '../../core'
import { version, world } from '../store'
import { computeBanners } from '../warnings'

const list = computed(() => {
  void version.value
  return computeBanners(world.value as World)
})
const STYLE = ['bg-[#5a0e0a]/90 text-[#ffd8d0] ring-1 ring-[#ff5040] animate-pulse', 'bg-[#4a3a0a]/90 text-amber-100 ring-1 ring-amber-500/70', 'bg-black/60 text-ash-200 ring-1 ring-ash-600']
</script>

<template>
  <div class="pointer-events-none flex flex-col items-end gap-1" data-testid="banners">
    <div v-for="(b, i) in list" :key="i" class="rounded-sm px-2 py-0.5 text-xs font-bold" :class="STYLE[b.p]">{{ b.p === 0 ? '⚠ ' : '' }}{{ b.text }}</div>
  </div>
</template>
