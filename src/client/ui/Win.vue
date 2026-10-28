<script setup lang="ts">
// Title, close control and contents stay reachable after drag and viewport resize.
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { raiseWin,winOrder,wins,type WinKey } from '../ui'
import {cycleFocus} from '../input-context'
import {t} from '../locale'

const props=withDefaults(defineProps<{title:string;x?:number;y?:number;width?:number;testid?:string}>(),{x:80,y:60,width:420,testid:undefined})
const emit=defineEmits<{close:[]}>()
const root=ref<HTMLElement|null>(null),pos=ref({x:props.x,y:props.y})
const z=computed(()=>30+Math.max(0,winOrder.indexOf(props.testid?.replace(/^win-/,'')as WinKey)))
const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null
let drag:{dx:number;dy:number}|null=null,restoreFocus=false
function clamp(){
 pos.value={x:Math.max(8,Math.min(pos.value.x,window.innerWidth-Math.min(props.width,window.innerWidth-16)-8)),y:Math.max(8,Math.min(pos.value.y,window.innerHeight-80))}
}
function raise(){
 const key=props.testid?.replace(/^win-/,'') as WinKey
 if(key in wins)raiseWin(key)
}
function down(e:PointerEvent){
 if(e.button!==0)return
 e.preventDefault();root.value?.focus({preventScroll:true})
 drag={dx:e.clientX-pos.value.x,dy:e.clientY-pos.value.y}
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('blur',up)
}
function move(e:PointerEvent){if(drag){pos.value={x:e.clientX-drag.dx,y:e.clientY-drag.dy};clamp()}}
function up(){drag=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',up)}
function key(e:KeyboardEvent){if(e.key==='Tab'&&root.value){cycleFocus(root.value,e);e.stopPropagation()}}
clamp();watch(()=>props.width,clamp)
onMounted(()=>{root.value?.focus({preventScroll:true});window.addEventListener('resize',clamp)})
onBeforeUnmount(()=>{restoreFocus=!!root.value?.contains(document.activeElement);up();window.removeEventListener('resize',clamp)})
onUnmounted(()=>{if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true})})
</script>

<template>
  <div ref="root" class="df df-celtic window-shell fixed" :style="{left:pos.x+'px',top:pos.y+'px',width:width+'px',maxHeight:`calc(100dvh - ${pos.y+8}px)`,zIndex:z}" :data-testid="testid" role="dialog" :aria-label="title" tabindex="-1" @pointerdown.stop="raise" @focusin="raise" @keydown="key">
    <div class="window-heading" @pointerdown="down">
      <span class="font-title window-title">{{ title }}</span>
      <button class="window-close" :title="t('닫기 (Esc)')" :aria-label="t('닫기 (Esc)')" @pointerdown.stop @click="emit('close')"><span class="window-close-mark" aria-hidden="true" /></button>
    </div>
    <div class="window-content"><slot /></div>
  </div>
</template>
