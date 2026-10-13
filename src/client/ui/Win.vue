<script setup lang="ts">
// 다크에이지 켈트 테두리 창. 제목줄을 끌어 옮길 수 있다.
import { onBeforeUnmount, ref } from 'vue'
import { nextZ } from '../ui'

const props = withDefaults(defineProps<{ title: string; x?: number; y?: number; width?: number; testid?: string }>(), { x: 80, y: 60, width: 420, testid: undefined })
const emit = defineEmits<{ close: [] }>()
const pos = ref({ x: Math.min(props.x, Math.max(0, window.innerWidth - props.width - 8)), y: props.y })
let drag: { dx: number; dy: number } | null = null
const z = ref(nextZ())

function down(e: PointerEvent) {
  drag = { dx: e.clientX - pos.value.x, dy: e.clientY - pos.value.y }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
function move(e: PointerEvent) {
  if (!drag) return
  pos.value = { x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - drag.dx)), y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - drag.dy)) }
}
function up() {
  drag = null
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', up)
}
onBeforeUnmount(up)
</script>

<template>
  <div class="df df-celtic fixed max-h-[calc(100vh-150px)] max-w-[calc(100vw-8px)] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,.7)]" :style="{ left: pos.x + 'px', top: pos.y + 'px', width: width + 'px', zIndex: z }" :data-testid="testid" @pointerdown.stop="z = nextZ()">
    <div class="-mx-1 -mt-1 mb-1 flex cursor-move select-none items-center justify-between border-b border-[#4a4436] pb-1" @pointerdown="down">
      <span class="font-title text-[15px] font-bold tracking-wider text-[#e8d7a8]">{{ title }}</span>
      <button class="pix h-6 w-6 opacity-80 hover:opacity-100" :style="{ background: 'var(--ui-xmark) center/contain no-repeat' }" title="닫기 (Esc)" @click="emit('close')" />
    </div>
    <div class="max-h-[calc(100vh-210px)] overflow-y-auto pr-1">
      <slot />
    </div>
  </div>
</template>
