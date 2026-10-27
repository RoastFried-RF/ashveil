<script setup lang="ts">
// 우하단 전투·사건 기록. ▸ 를 누르면 판정 단계(명중 공식)가 펼쳐진다.
import { computed, nextTick, ref, watch } from 'vue'
import { fmtClock } from '../core'
import {speakText,stopSpeech} from './speech'
import { preferences } from './preferences'
import { KIND_CLASS } from './format'
import { version, world } from './store'
import { logBig as big, logLevel } from './ui'

const box = ref<HTMLDivElement>()
const open = ref<Set<number>>(new Set())
const mobileExpanded = ref(false)
watch(big, () => { mobileExpanded.value = true })
const entries = computed(() => {
  void version.value
  const log = world.value?.s.log ?? []
  const n = big.value ? 120 : 40
  // 상세도 3단계 (12 §5): 간략 = 전투·위험만 / 표준 / 상세 = 판정 단계까지 펼침
  const lv = logLevel.value
  return log.slice(-n).map((e, i) => ({ ...e, key: Math.max(0,log.length - n) + i }))
    .filter((e) => lv !== 'brief' || e.kind === 'combat' || e.kind === 'danger' || e.kind === 'warn')
})
watch([version, mobileExpanded, big], async () => { await nextTick(); if (box.value) box.value.scrollTop = box.value.scrollHeight })
function toggle(k: number) {
  const s = new Set(open.value)
  if (s.has(k)) s.delete(k)
  else s.add(k)
  open.value = s
}
</script>

<template>
  <div class="log-panel df df-olive pointer-events-auto w-[min(440px,94vw)] bg-black/30" :class="{'is-mobile-expanded': mobileExpanded}">
    <div class="log-toolbar mb-2 flex min-h-5 justify-end gap-3 border-b border-ash-700 pb-1 text-[10px] text-ash-300">
      <button class="mobile-log-toggle" data-testid="mobile-log-toggle" :aria-expanded="mobileExpanded" aria-controls="game-log-content" @click="mobileExpanded = !mobileExpanded">{{ mobileExpanded ? '기록 접기' : '기록 보기' }}</button>
      <button v-if="preferences.speechEnabled" data-testid="read-log" class="hover:text-amber-200" @click="speakText(entries.slice(-10).map(e=>e.text+(e.detail&&(open.has(e.key)||logLevel==='detail')?'\n'+e.detail.join('\n'):'')).join('\n'))">기록 읽기</button>
      <button v-if="preferences.speechEnabled" data-testid="stop-speech" class="hover:text-amber-200" @click="stopSpeech">읽기 멈춤</button>
      <button v-for="[k, l] in [['brief', '간략'], ['standard', '표준'], ['detail', '상세']]" :key="k" :aria-pressed="logLevel === k" :class="logLevel === k ? 'text-amber-200' : 'hover:text-amber-200'" @click="logLevel = k as typeof logLevel">{{ l }}</button>
      <button class="log-grow hover:text-amber-200" @click="big = !big">{{ big ? '▾ 줄이기' : '▴ 늘리기' }}</button>
    </div>
    <p v-if="entries.length" class="log-latest" data-testid="log-latest" :style="{fontSize: preferences.logFontSize + 'px'}" :class="KIND_CLASS[entries[entries.length - 1].kind]">{{ entries[entries.length - 1].text }}</p>
    <div id="game-log-content" ref="box" class="log-body overflow-y-auto pr-1" :style="{ fontSize: preferences.logFontSize + 'px', lineHeight: 1.5 }" :class="big ? 'max-h-[46vh]' : 'max-h-[118px]'" data-testid="log">
      <div v-for="e in entries" :key="e.key">
        <div :class="[KIND_CLASS[e.kind], e.detail ? 'cursor-pointer hover:bg-white/5' : '']" @click="e.detail && toggle(e.key)">
          <span class="font-mono text-[0.83em] text-ash-500">{{ fmtClock(e.turn).slice(-5) }}</span> {{ e.text }}
          <span v-if="e.detail" class="text-ash-600">{{ open.has(e.key) ? '▾' : '▸' }}</span>
        </div>
        <div v-if="e.detail && (open.has(e.key) || logLevel === 'detail')" class="mb-1 ml-10 border-l border-ash-700 pl-2 font-mono text-[0.92em] text-ash-400">
          <div v-for="(l, i) in e.detail" :key="i">{{ l }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-log-toggle,.log-latest{display:none}.log-toolbar{flex-wrap:wrap}
@media(max-width:999px){
 .mobile-log-toggle{display:inline-block;margin-right:auto;color:#d9c89e}
 .log-toolbar{margin-bottom:0;gap:8px}
 .log-grow{display:none}
 .log-latest{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.5}
 .log-panel.is-mobile-expanded .log-latest{display:none}
 .log-panel:not(.is-mobile-expanded) .log-body{display:none}
 .log-panel.is-mobile-expanded .log-body{margin-top:8px}
}
</style>
