<script setup lang="ts">
// Pixi 맵 렌더러를 감싼다. 행동마다(version) 동기화, 커서·대상 표시는 props 로.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ItemDef, Pos, AbilityDef } from '../core'
import { loadAtlas } from './render/atlas'
import { MapRenderer, type RenderOpts } from './render/MapRenderer'
import { preferences } from './preferences'
import { version, world } from './store'

const props = defineProps<{ opts: RenderOpts }>()
const emit = defineEmits<{ hover: [p: Pos | null]; click: [p: Pos, button: number] }>()
const host = ref<HTMLDivElement>()
const loading = ref(true)
let r: MapRenderer | null = null

const GROUND = ['grass0', 'grass1', 'grass2', 'grassdirt0', 'grassdirt1', 'grassdirt2', 'dirt0', 'dirt1', 'dirt2', 'ash0', 'ash1', 'ash2', 'ash3', 'water_shallow', 'water_deep', 'blood0', 'blood1', 'blood2', 'blood3', 'blood_pool', 'murk_leech']

onMounted(async () => {
  const w = world.value
  if (!host.value || !w) return
  const icons = [...GROUND, ...w.db.all<ItemDef>('Item').map((i) => i.sprite), ...w.db.all<AbilityDef>('Ability').map((a) => a.icon)]
  await loadAtlas(icons)
  r = new MapRenderer(host.value)
  r.onHover = (p) => emit('hover', p)
  r.onClick = (p, b) => emit('click', p, b)
  await r.init()
  r.setOpts(props.opts)
  if (world.value) r.sync(world.value)
  loading.value = false
})

watch(preferences, () => { if (r && world.value) r.sync(world.value) })
watch(version, () => { if (r && world.value) r.sync(world.value) })
watch(() => props.opts, (o) => r?.setOpts(o), { deep: true })

onBeforeUnmount(() => { r?.destroy(); r = null })
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-[#070707]">
    <div ref="host" class="h-full w-full" data-testid="map" />
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center font-title text-ash-400">그림자를 불러오는 중…</div>
  </div>
</template>
