<script setup lang="ts">
// 우하단 전투·사건 기록. ▸ 를 누르면 판정 단계(명중 공식)가 펼쳐진다.
import { computed, nextTick, ref, watch } from 'vue'
import { fmtClock } from '../core'
import { KIND_CLASS } from './format'
import { version, world } from './store'
import { logBig as big, logLevel } from './ui'

const box = ref<HTMLDivElement>()
const open = ref<Set<number>>(new Set())
const entries = computed(() => {
  void version.value
  const log = world.value?.s.log ?? []
  const n = big.value ? 120 : 40
  // 상세도 3단계 (12 §5): 간략 = 전투·위험만 / 표준 / 상세 = 판정 단계까지 펼침
  const lv = logLevel.value
  return log.slice(-n).map((e, i) => ({ ...e, key: log.length - n + i }))
    .filter((e) => lv !== 'brief' || e.kind === 'combat' || e.kind === 'danger' || e.kind === 'warn')
})
watch(version, async () => { await nextTick(); if (box.value) box.value.scrollTop = box.value.scrollHeight })
function toggle(k: number) {
  const s = new Set(open.value)
  if (s.has(k)) s.delete(k)
  else s.add(k)
  open.value = s
}
</script>

<template>
  <div class="df df-olive pointer-events-auto !border-[10px] w-[min(440px,94vw)] bg-black/30">
    <div ref="box" class="overflow-y-auto pr-1 text-[12px] leading-[18px]" :class="big ? 'h-[46vh]' : 'h-[118px]'" data-testid="log">
      <div v-for="e in entries" :key="e.key">
        <div :class="[KIND_CLASS[e.kind], e.detail ? 'cursor-pointer hover:bg-white/5' : '']" @click="e.detail && toggle(e.key)">
          <span class="font-mono text-[10px] text-ash-600">{{ fmtClock(e.turn).slice(-5) }}</span> {{ e.text }}
          <span v-if="e.detail" class="text-ash-600">{{ open.has(e.key) ? '▾' : '▸' }}</span>
        </div>
        <div v-if="e.detail && (open.has(e.key) || logLevel === 'detail')" class="mb-1 ml-10 border-l border-ash-700 pl-2 font-mono text-[11px] text-ash-400">
          <div v-for="(l, i) in e.detail" :key="i">{{ l }}</div>
        </div>
      </div>
    </div>
    <div class="absolute -top-2 right-1 flex gap-2 text-[10px] text-ash-500">
      <button v-for="[k, l] in [['brief', '간략'], ['standard', '표준'], ['detail', '상세']]" :key="k" :class="logLevel === k ? 'text-amber-200' : 'hover:text-amber-200'" @click="logLevel = k as typeof logLevel">{{ l }}</button>
      <button class="hover:text-amber-200" @click="big = !big">{{ big ? '▾ 줄이기' : '▴ 늘리기' }}</button>
    </div>
  </div>
</template>
