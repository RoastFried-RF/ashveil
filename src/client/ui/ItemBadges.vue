<script setup lang="ts">
// 품질 테두리·점(색약 대응)과 내구 막대 (13 §10). 아이콘 칸 위에 겹쳐 그린다
import { computed } from 'vue'
import { durabilityBand, hasQuality, qualityOf, QUALITY, type ItemInst, type World } from '../../core'

const props = defineProps<{ w: World; it: ItemInst }>()
const q = computed(() => (hasQuality(props.w.db.item(props.it.def)) ? qualityOf(props.it) : -1))
const dur = computed(() => props.it.durability)
</script>

<template>
  <span v-if="q >= 0" class="pointer-events-none absolute inset-0 ring-1 ring-inset" :style="{ '--tw-ring-color': QUALITY[q].color }" :data-quality="q" />
  <span v-if="q >= 0" class="pointer-events-none absolute left-0.5 top-0.5 flex gap-[1px]">
    <span v-for="i in q" :key="i" class="h-[3px] w-[3px] rounded-full" :style="{ background: QUALITY[q].color }" />
    <span v-if="q === 5" class="-mt-[3px] text-[8px] leading-none" :style="{ color: QUALITY[q].color }">★</span>
  </span>
  <span v-if="dur !== undefined && dur < 100" class="pointer-events-none absolute inset-x-1 bottom-0.5 h-[2px] bg-black/70">
    <span class="block h-full" :style="{ width: Math.max(dur, 0) + '%', background: durabilityBand(dur).color }" />
    <span v-if="dur <= 0" class="absolute -top-2 right-0 text-[9px] font-bold leading-none text-blood-300">×</span>
  </span>
</template>
