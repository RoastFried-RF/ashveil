<script setup lang="ts">
// 다크에이지 막대: 테두리 + 채움 (빨강 체력, 파랑 기력, 초록·금 등)
import { preferences } from '../preferences'
// cap: 회복 상한 (12 §2.1) — 상한 위쪽은 어두운 구간으로 표시
withDefaults(defineProps<{ value: number; max: number; color: 'red' | 'blue' | 'green' | 'gold'; label?: string; height?: number; ghost?: number; cap?: number }>(), { label: '', height: 16, ghost: 0, cap: undefined })
const FILL: Record<string, string> = { red: 'var(--ui-bar_red)', blue: 'var(--ui-bar_blue)', green: 'var(--ui-bar_green)', gold: 'linear-gradient(#e8c870,#a07a30)' }
</script>

<template>
  <div class="df df-bar relative w-full" :style="{ height: height + 'px' }">
    <div class="absolute inset-0 bg-black/60" />
    <div v-if="ghost > value" class="absolute inset-y-0 left-0 bg-[#f0d0a0]/40 transition-[width] duration-700" :style="{ width: Math.max(0, Math.min(100, (ghost / max) * 100)) + '%' }" />
    <div class="pix absolute inset-y-0 left-0 transition-[width] duration-200" :style="{ width: Math.max(0, Math.min(100, (value / max) * 100)) + '%', background: preferences.palette === 'standard' || color === 'gold' || color === 'green' ? FILL[color] : `linear-gradient(var(--state-${color === 'red' ? 'health' : 'energy'}), #302c28)`, backgroundSize: '100% 100%' }" />
    <div v-if="cap !== undefined && cap < max" class="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,rgba(0,0,0,.75)_0_2px,rgba(60,20,16,.75)_2px_4px)]" :style="{ width: Math.max(0, Math.min(100, ((max - cap) / max) * 100)) + '%' }" />
    <div v-if="label" class="absolute inset-0 flex items-center justify-center text-[11px] font-bold leading-none text-[#f4ead0] [text-shadow:0_1px_0_#000,0_0_3px_#000]">{{ label }}</div>
  </div>
</template>
