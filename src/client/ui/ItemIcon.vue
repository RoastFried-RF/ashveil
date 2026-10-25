<script setup lang="ts">
import { computed } from 'vue'
import { iconFrame,iconUrl } from '../render/atlas'
import {inventoryIconLayout} from '../render/inventory-icon-layout'
const props=withDefaults(defineProps<{name:string;size?:number;width?:number;height?:number;dim?:boolean}>(),{size:32,width:undefined,height:undefined,dim:false})
const frame=computed(()=>iconFrame(props.name))
const box=computed(()=>({w:props.width??props.size,h:props.height??props.size}))
const scale=computed(()=>frame.value?Math.min(box.value.w/frame.value.w,box.value.h/frame.value.h):1)
const layout=computed(()=>inventoryIconLayout(props.name,props.width,props.height,frame.value))
</script>
<template>
  <span v-if="frame" class="pix pointer-events-none relative inline-block shrink-0 select-none" :class="[dim?'opacity-60 grayscale':'',{'overflow-hidden':!!layout}]" :style="{width:box.w+'px',height:box.h+'px'}" :data-icon-layout="layout?'glaive-long-axis':undefined" aria-hidden="true">
    <!-- Clip the original frame before rotation so no neighboring atlas item enters. -->
    <span v-if="layout" class="absolute overflow-hidden" :style="{left:0,top:0,width:frame.w+'px',height:frame.h+'px',transform:layout.transform,transformOrigin:'0 0'}">
      <img :src="frame.url" :style="{position:'absolute',left:-frame.x+'px',top:-frame.y+'px',width:'auto',height:'auto',maxWidth:'none',maxHeight:'none'}" draggable="false" alt="" />
    </span>
    <span v-else class="absolute overflow-hidden" :style="{left:(box.w-frame.w*scale)/2+'px',top:(box.h-frame.h*scale)/2+'px',width:frame.w*scale+'px',height:frame.h*scale+'px'}">
      <img :src="frame.url" :style="{position:'absolute',left:-frame.x*scale+'px',top:-frame.y*scale+'px',width:'auto',height:'auto',maxWidth:'none',maxHeight:'none',transform:'scale('+scale+')',transformOrigin:'0 0'}" draggable="false" alt="" />
    </span>
  </span>
  <img v-else :src="iconUrl(name)" :width="box.w" :height="box.h" class="pix pointer-events-none select-none object-contain" :class="dim?'opacity-60 grayscale':''" draggable="false" alt="" />
</template>
