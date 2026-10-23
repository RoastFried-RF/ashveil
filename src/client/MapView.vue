<script setup lang="ts">
// Pixi 맵 렌더러를 감싼다. 행동마다(version) 동기화, 커서·대상 표시는 props 로.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ItemDef, Pos, AbilityDef, CreatureDef } from '../core'
import { loadAtlas } from './render/atlas'
import { mapIconKeys } from './render/terrain-art'
import { MapRenderer, type RenderOpts } from './render/MapRenderer'
import { preferences } from './preferences'
import {startActionObservation} from '../core/action-observations'
import { version, world } from './store'

const props = defineProps<{ opts: RenderOpts }>()
const emit = defineEmits<{ hover: [p: Pos | null]; click: [p: Pos, button: number, ctrl: boolean]; motion:[moving:boolean] }>()
const host = ref<HTMLDivElement>()
const loading = ref(true)
let r: MapRenderer | null = null
let disposed=false
let resizeObserver:ResizeObserver|undefined
let stopObserving:(()=>void)|undefined
const debugWindow=window as unknown as {render_game_presentation?:()=>ReturnType<MapRenderer['presentation']>|null}
const observePresentation=()=>r?.presentation()??null

onMounted(async () => {
  const w = world.value
  if (!host.value || !w) return
  stopObserving=startActionObservation(w)
  const creatureIcons=w.db.all<CreatureDef>('Creature').filter(c=>!c.char).flatMap(c=>Array.isArray(c.sprite)?c.sprite:c.sprite?[c.sprite]:[])
  const icons = [...mapIconKeys, ...creatureIcons, ...w.db.all<ItemDef>('Item').map((i) => i.sprite), ...w.db.all<AbilityDef>('Ability').map((a) => a.icon)]
  if(!await loadAtlas(icons)||disposed)return
  const renderer = new MapRenderer(host.value)
  renderer.onPlayerMotion=moving=>emit('motion',moving)
  renderer.onHover = (p) => emit('hover', p)
  renderer.onClick = (p, b, ctrl) => emit('click', p, b, ctrl)
  await renderer.init()
  if(disposed){renderer.destroy();return}
  r=renderer
  if(new URLSearchParams(window.location.search).has('debug'))debugWindow.render_game_presentation=observePresentation
  r.setOpts(props.opts)
  if (world.value) r.sync(world.value)
  resizeObserver=new ResizeObserver(()=>{if(r&&world.value)r.sync(world.value)})
  resizeObserver.observe(host.value)
  loading.value = false
})

watch(preferences, () => { if (r && world.value) r.sync(world.value) })
watch(version, () => { if (r && world.value) r.sync(world.value) })
watch(() => props.opts, (o) => r?.setOpts(o), { deep: true })

onBeforeUnmount(() => { disposed=true;stopObserving?.();emit('motion',false);resizeObserver?.disconnect();r?.destroy(); r = null;if(debugWindow.render_game_presentation===observePresentation)delete debugWindow.render_game_presentation })
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-[#070707]">
    <div ref="host" class="h-full w-full outline-none" tabindex="0" aria-label="게임 지도" data-testid="map" :data-ready="!loading" @pointerdown="host?.focus({preventScroll:true})" />
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center font-title text-ash-400">그림자를 불러오는 중…</div>
  </div>
</template>
