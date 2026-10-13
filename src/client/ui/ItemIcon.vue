<script setup lang="ts">
// DCSS 아이템 아이콘 (32px 원본, 정수배로 확대)
import { iconUrl } from '../render/atlas'

withDefaults(defineProps<{ name: string; size?: number; dim?: boolean }>(), { size: 32, dim: false })
</script>

<template>
  <img :src="iconUrl(name)" :width="size" :height="size" class="pix pointer-events-none select-none" :class="dim ? 'opacity-40 grayscale' : ''" draggable="false" alt="" />
</template>
