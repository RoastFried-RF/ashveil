<script setup lang="ts">
// 품질 테두리·점(색약 대응)과 내구 막대 (13 §10). 아이콘 칸 위에 겹쳐 그린다
import {t} from '../locale'
import {displayItemLabel} from '../locales/item'
import { computed } from 'vue'
import { durabilityBand, hasQuality, qualityOf, QUALITY, type ItemInst, type World } from '../../core'
import { version } from '../store'

const props = defineProps<{ w: World; it: ItemInst }>()
const q = computed(() => (hasQuality(props.w.db.item(props.it.def)) ? qualityOf(props.it) : -1))
const dur = computed(() => props.it.durability)
const firearm = computed(() => {
  void version.value
  const def = props.w.db.item(props.it.def), ranged = def.ranged
  if (!ranged?.firearm) return null
  return {
    label: displayItemLabel(props.w,props.it),
    loaded: ranged.magazine ? props.it.loadedCartridges?.length ?? 0 : props.it.loadedRound ? 1 : 0,
    capacity: ranged.magazine?.capacity ?? 1,
    jammed: !!props.it.firearmJammed,
  }
})
</script>

<template>
  <span v-if="q >= 0" class="pointer-events-none absolute inset-0 ring-1 ring-inset" :style="{ '--tw-ring-color': QUALITY[q].color }" :data-quality="q" />
  <span v-if="q >= 0" class="pointer-events-none absolute left-0.5 top-0.5 flex gap-[1px]">
    <span v-for="i in q" :key="i" class="h-[3px] w-[3px] rounded-full" :style="{ background: QUALITY[q].color }" />
    <span v-if="q === 5" class="-mt-[3px] text-[8px] leading-none" :style="{ color: QUALITY[q].color }">★</span>
  </span>
  <span v-if="it.fletchingDamaged" class="pointer-events-none absolute right-0.5 top-0.5 rounded bg-black/80 px-0.5 text-[9px] text-amber-200" data-testid="fletching-damaged">{{ t('깃') }}</span>
  <span v-if="firearm" class="item-firearm-ammo pointer-events-none absolute right-0.5 top-0.5" :class="{ 'is-empty': !firearm.loaded, 'is-jammed': firearm.jammed }" role="img" :aria-label="t('{0}: 장전 {1}/{2}발{3}',firearm.label,firearm.loaded,firearm.capacity,t(firearm.jammed ? ', 걸림' : !firearm.loaded ? ', 빈 총' : ''))" data-testid="item-firearm-ammo" :data-weapon-uid="it.uid" :data-loaded="firearm.loaded" :data-capacity="firearm.capacity" :data-jammed="firearm.jammed"><span v-if="firearm.jammed" aria-hidden="true">! </span>{{ firearm.loaded }}/{{ firearm.capacity }}</span>
  <span v-if="it.pillRemaining !== undefined" class="pointer-events-none absolute bottom-0 right-0.5 text-[10px] font-bold text-amber-200" data-testid="pill-fraction">{{ Math.round(it.pillRemaining * 100) }}%</span>
  <span v-if="dur !== undefined && dur < 100" class="pointer-events-none absolute inset-x-1 bottom-0.5 h-[2px] bg-black/70">
    <span class="block h-full" :style="{ width: Math.max(dur, 0) + '%', background: durabilityBand(dur).color }" />
    <span v-if="dur <= 0" class="absolute -top-2 right-0 text-[9px] font-bold leading-none text-blood-300">×</span>
  </span>
</template>

<style scoped>
.item-firearm-ammo { border: 1px solid #8a7755; border-radius: 0; background: #211b17ed; padding: 1px 3px; color: #e9dfbc; font: 600 9px var(--font-mono); line-height: 1.15; font-variant-numeric: tabular-nums; white-space: nowrap; }
.item-firearm-ammo.is-empty { border-color: var(--state-warn); color: #ebc68a; }
.item-firearm-ammo.is-jammed { border-color: var(--state-danger); background: #39251f; color: #ffdab0; }
</style>
