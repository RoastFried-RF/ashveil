<script setup lang="ts">
// Pixi 맵 렌더러를 감싼다. 행동마다(version) 동기화, 커서·대상 표시는 props 로.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Pos,World } from '../core'
import { atlasReady,atlasStats,loadAtlas,releaseAtlas } from './render/atlas'
import {worldAssets} from './render/world-assets'
import {setMapAssetsLoading} from './map-asset-state'
import { MapRenderer, type RenderOpts } from './render/MapRenderer'
import { preferences } from './preferences'
import {startActionObservation} from '../core/action-observations'
import { version, world } from './store'

const props = defineProps<{ opts: RenderOpts }>()
const emit = defineEmits<{ hover: [p: Pos | null]; click: [p: Pos, button: number, ctrl: boolean]; motion:[moving:boolean] }>()
const host = ref<HTMLDivElement>()
const loading = ref(true)
const loadError=ref(false)
const assetOwner={}
let r: MapRenderer | null = null
let disposed=false
let initializing=false,requestTicket=0,requestedKey:string|undefined,loadedKey:string|undefined
let observedWorld:World|null=null
let resizeObserver:ResizeObserver|undefined
let stopObserving:(()=>void)|undefined
const debugWindow=window as unknown as {render_game_presentation?:()=>ReturnType<MapRenderer['presentation']>|null;render_game_assets?:typeof atlasStats}
const observePresentation=()=>r?.presentation()??null
function refresh(force=false){
 const w=world.value;if(!r||!w||disposed)return
 if(observedWorld!==w){stopObserving?.();stopObserving=startActionObservation(w);observedWorld=w}
 const request=worldAssets(w)
 if(!force&&!requestedKey&&loadedKey===request.key&&atlasReady(request.icons,request.characters)){r.sync(w);return}
 if(!force&&requestedKey===request.key)return
 const ticket=++requestTicket;requestedKey=request.key;loading.value=true;loadError.value=false;setMapAssetsLoading(assetOwner,true)
 void loadAtlas(request.icons,request.characters,assetOwner,()=>{
  const current=world.value
  if(disposed||ticket!==requestTicket||!current||worldAssets(current).key!==request.key)return
  r?.setOpts(props.opts);r?.sync(current)
 }).then(ok=>{
  if(!ok||disposed||ticket!==requestTicket)return
  requestedKey=undefined;loadedKey=request.key;loading.value=false;setMapAssetsLoading(assetOwner,false)
 }).catch(()=>{if(!disposed&&ticket===requestTicket){requestedKey=undefined;loadError.value=true}})
}
async function initialize(){
 if(initializing||disposed||!host.value||!world.value)return
 if(r){refresh(true);return}
 initializing=true;loading.value=true;loadError.value=false;setMapAssetsLoading(assetOwner,true)
  const renderer = new MapRenderer(host.value)
  if(observedWorld!==world.value){stopObserving?.();stopObserving=startActionObservation(world.value);observedWorld=world.value}
  renderer.onPlayerMotion=moving=>emit('motion',moving)
  renderer.onHover = (p) => emit('hover', p)
  renderer.onClick = (p, b, ctrl) => emit('click', p, b, ctrl)
  try{
   await renderer.init()
   if(disposed){renderer.destroy();return}
   r=renderer
   if(new URLSearchParams(window.location.search).has('debug')){debugWindow.render_game_presentation=observePresentation;debugWindow.render_game_assets=atlasStats}
   resizeObserver=new ResizeObserver(()=>{if(!loading.value&&r&&world.value)r.sync(world.value)})
   resizeObserver.observe(host.value);refresh()
  }catch{loadError.value=true;try{renderer.destroy()}catch{/* no initialized context */}}
  finally{initializing=false}
}
onMounted(initialize)

watch(preferences, () => { if (!loading.value&&r&&world.value&&loadedKey===worldAssets(world.value).key)r.sync(world.value) })
watch([version,world],()=>refresh())
watch(() => props.opts, (o) => {if(!loading.value&&world.value&&loadedKey===worldAssets(world.value).key)r?.setOpts(o)}, { deep: true })

onBeforeUnmount(() => { disposed=true;++requestTicket;stopObserving?.();emit('motion',false);resizeObserver?.disconnect();r?.destroy();r=null;setMapAssetsLoading(assetOwner,false);void releaseAtlas(assetOwner);if(debugWindow.render_game_presentation===observePresentation)delete debugWindow.render_game_presentation })
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-[#070707]">
    <div ref="host" class="h-full w-full outline-none" tabindex="0" aria-label="게임 지도" data-testid="map" :data-ready="!loading" @pointerdown="host?.focus({preventScroll:true})" />
    <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070707] font-title text-ash-400" role="status" data-testid="map-loading" style="padding-bottom:var(--map-bottom-inset,0px)">
      <span>{{ loadError?'지도를 불러오지 못했습니다':'지도를 펼치는 중…' }}</span>
      <button v-if="loadError" class="dbtn" data-testid="map-retry" @click="initialize">다시 불러오기</button>
    </div>
  </div>
</template>
