<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { fmtClock } from '../core'
import { KIND_CLASS } from './format'
import { version, world } from './store'

const box = ref<HTMLDivElement>()
const open = ref<Set<number>>(new Set())
const entries = computed(() => {
  void version.value
  const log = world.value?.s.log ?? []
  return log.slice(-120).map((e, i) => ({ ...e, key: log.length - 120 + i }))
})

watch(version, async () => {
  await nextTick()
  if (box.value) box.value.scrollTop = box.value.scrollHeight
})

function toggle(k: number) {
  const s = new Set(open.value)
  if (s.has(k)) s.delete(k)
  else s.add(k)
  open.value = s
}
</script>

<template>
  <div ref="box" class="h-full overflow-y-auto px-2 py-1 font-mono text-[12px] leading-5" data-testid="log">
    <div v-for="e in entries" :key="e.key">
      <div :class="[KIND_CLASS[e.kind], e.detail ? 'cursor-pointer hover:bg-ash-800' : '']" @click="e.detail && toggle(e.key)">
        <span class="text-ash-600">{{ fmtClock(e.turn).slice(-5) }}</span>
        {{ e.text }}
        <span v-if="e.detail" class="text-ash-600">{{ open.has(e.key) ? '▾' : '▸' }}</span>
      </div>
      <div v-if="e.detail && open.has(e.key)" class="mb-1 ml-12 border-l border-ash-700 pl-2 text-[11px] text-ash-400">
        <div v-for="(l, i) in e.detail" :key="i">{{ l }}</div>
      </div>
    </div>
  </div>
</template>
