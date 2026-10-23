<script setup lang="ts">
import {computed,useId} from 'vue'
import {chars,iconFrame} from '../render/atlas'
const props=withDefaults(defineProps<{name:string;width?:number;height?:number;fill?:boolean}>(),{width:64,height:80,fill:false})
const frame=computed(()=>{const key=chars[props.name]?.portrait??chars[props.name]?.idle.down[0];return key?iconFrame(key):undefined})
const clipId='portrait-'+useId()
</script>
<template>
  <span v-if="frame" class="inline-block shrink-0 overflow-hidden" :style="fill?{width:'100%',height:'100%'}:{width:width+'px',height:height+'px'}" aria-hidden="true">
    <svg class="pix block" width="100%" height="100%" :viewBox="`${frame.x} ${frame.y} ${frame.w} ${frame.h}`" preserveAspectRatio="xMidYMid meet"><defs><clipPath :id="clipId"><rect :x="frame.x" :y="frame.y" :width="frame.w" :height="frame.h" /></clipPath></defs><image :href="frame.url" :width="frame.sheetWidth" :height="frame.sheetHeight" :clip-path="`url(#${clipId})`" /></svg>
  </span>
</template>
