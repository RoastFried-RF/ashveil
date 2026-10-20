<script setup lang="ts">
// 재빛 석판 창. 제목줄을 끌어도 닫기 버튼과 제목이 화면 안에 남는다.
import { onBeforeUnmount, ref } from 'vue'
import { nextZ } from '../ui'

const props = withDefaults(defineProps<{ title: string; x?: number; y?: number; width?: number; testid?: string }>(), { x: 80, y: 60, width: 420, testid: undefined })
const emit = defineEmits<{ close: [] }>()
const pos = ref({ x: Math.max(8, Math.min(props.x, window.innerWidth - props.width - 8)), y: Math.max(8, props.y) })
let drag: { dx: number; dy: number } | null = null
const z = ref(nextZ())

function down(e: PointerEvent) {
  if (e.button !== 0) return
  drag = { dx: e.clientX - pos.value.x, dy: e.clientY - pos.value.y }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
function move(e: PointerEvent) {
  if (!drag) return
  pos.value = { x: Math.max(8, Math.min(Math.max(8, window.innerWidth - Math.min(props.width, window.innerWidth - 16) - 8), e.clientX - drag.dx)), y: Math.max(8, Math.min(window.innerHeight - 80, e.clientY - drag.dy)) }
}
function up() {
  drag = null
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', up)
}
onBeforeUnmount(up)
</script>

<template>
  <div class="df df-celtic window-shell fixed" :style="{ left: pos.x + 'px', top: pos.y + 'px', width: width + 'px', maxHeight: `calc(100dvh - ${pos.y + 8}px)`, zIndex: z }" :data-testid="testid" role="dialog" :aria-label="title" @pointerdown.stop="z = nextZ()">
    <div class="window-heading" @pointerdown="down">
      <span class="font-title window-title">{{ title }}</span>
      <button class="window-close" title="닫기 (Esc)" aria-label="닫기 (Esc)" @pointerdown.stop @click="emit('close')">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" /></svg>
      </button>
    </div>
    <div class="window-content" :style="{ maxHeight: `calc(100dvh - ${pos.y + 54}px)` }">
      <slot />
    </div>
  </div>
</template>
