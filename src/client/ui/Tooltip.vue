<script setup lang="ts">
// 마우스를 따라다니는 다크에이지 툴팁 (화면 밖으로 나가지 않게)
import { computed } from 'vue'
import { tooltip } from '../ui'

const style = computed(() => {
  const t = tooltip.value
  if (!t) return {}
  const left = t.x + 300 > window.innerWidth ? t.x - 290 : t.x + 16
  const top = t.y + 200 > window.innerHeight ? Math.max(8, t.y - 180) : t.y + 16
  return { left: left + 'px', top: top + 'px' }
})
</script>

<template>
  <div v-if="tooltip" class="df df-celtic pointer-events-none fixed z-[9999] max-w-[280px] text-xs" :style="style" data-testid="tooltip">
    <div class="font-title text-sm font-bold" :style="{ color: tooltip.color ?? '#e8d7a8' }">{{ tooltip.title }}</div>
    <div v-for="(l, i) in tooltip.lines" :key="i" class="text-ash-300" :class="i === tooltip.lines.length - 1 && l.length > 30 ? 'mt-1 italic text-ash-400' : ''">{{ l }}</div>
  </div>
</template>
