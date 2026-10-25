<script setup lang="ts">
// 마우스를 따라다니는 다크에이지 툴팁 (화면 밖으로 나가지 않게)
import { computed,nextTick,onMounted,onBeforeUnmount,ref,watch } from 'vue'
import { tooltip } from '../ui'

const root=ref<HTMLElement|null>(null),size=ref({w:280,h:200}),viewport=ref({w:window.innerWidth,h:window.innerHeight})
let observer:ResizeObserver|undefined
function measure(){if(root.value)size.value={w:root.value.offsetWidth,h:root.value.offsetHeight}}
function resize(){viewport.value={w:window.innerWidth,h:window.innerHeight};measure()}
watch(tooltip,async()=>{await nextTick();observer?.disconnect();if(root.value)observer?.observe(root.value);measure()})
onMounted(()=>{observer=new ResizeObserver(measure);if(root.value)observer.observe(root.value);measure();window.addEventListener('resize',resize)})
onBeforeUnmount(()=>{observer?.disconnect();window.removeEventListener('resize',resize)})
const style = computed(() => {
  const t = tooltip.value
  if (!t) return {}
  const {w,h}=viewport.value
  const left=Math.max(8,Math.min(t.x+size.value.w+16>w?t.x-size.value.w-10:t.x+16,w-size.value.w-8))
  const top=Math.max(8,Math.min(t.y+size.value.h+16>h?t.y-size.value.h-10:t.y+16,h-size.value.h-8))
  return { left: left + 'px', top: top + 'px' }
})
</script>

<template>
  <div v-if="tooltip" id="game-tooltip" ref="root" role="tooltip" class="df df-celtic fixed z-[9999] max-w-[min(280px,calc(100vw-16px))] max-h-[calc(100dvh-16px)] overflow-y-auto text-xs" :style="style" data-testid="tooltip">
    <div class="font-title text-sm font-bold" :style="{ color: tooltip.color ?? '#e8d7a8' }">{{ tooltip.title }}</div>
    <div v-for="(l, i) in tooltip.lines" :key="i" class="text-ash-300" :class="i === tooltip.lines.length - 1 && l.length > 30 ? 'mt-1 italic text-ash-400' : ''">{{ l }}</div>
  </div>
</template>
