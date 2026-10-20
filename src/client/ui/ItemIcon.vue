<script setup lang="ts">
import { computed } from 'vue'
import { iconFrame,iconUrl } from '../render/atlas'
const props=withDefaults(defineProps<{name:string;size?:number;dim?:boolean}>(),{size:32,dim:false})
const frame=computed(()=>iconFrame(props.name))
const scale=computed(()=>frame.value?props.size/Math.max(frame.value.w,frame.value.h):1)
</script>
<template>
  <span v-if="frame" class="pix pointer-events-none relative inline-block shrink-0 select-none" :class="dim?'opacity-40 grayscale':''" :style="{width:size+'px',height:size+'px'}" aria-hidden="true">
    <span class="absolute overflow-hidden" :style="{left:(size-frame.w*scale)/2+'px',top:(size-frame.h*scale)/2+'px',width:frame.w*scale+'px',height:frame.h*scale+'px'}">
      <img :src="frame.url" :style="{position:'absolute',left:-frame.x*scale+'px',top:-frame.y*scale+'px',width:'auto',height:'auto',maxWidth:'none',maxHeight:'none',transform:'scale('+scale+')',transformOrigin:'0 0'}" draggable="false" alt="" />
    </span>
  </span>
  <img v-else :src="iconUrl(name)" :width="size" :height="size" class="pix pointer-events-none select-none" :class="dim?'opacity-40 grayscale':''" draggable="false" alt="" />
</template>
