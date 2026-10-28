<script setup lang="ts">
// 얇은 금속 막대. 색약 팔레트와 상처에 묶인 회복 상한을 함께 표시한다.
import { preferences } from '../preferences'
// cap: 회복 상한 (12 §2.1) — 상한 위쪽은 어두운 구간으로 표시
withDefaults(defineProps<{ value: number; max: number; color: 'red' | 'blue' | 'green' | 'gold'; label?: string; height?: number; ghost?: number; cap?: number }>(), { label: '', height: 16, ghost: 0, cap: undefined })
const FILL: Record<string, string> = { red: 'linear-gradient(180deg, #b75d4d, #8d3d35)', blue: 'linear-gradient(180deg, #638f9c, #3f6978)', green: 'linear-gradient(180deg, #8aa079, #566e4c)', gold: 'linear-gradient(180deg, #c1a16a, #897348)' }
</script>

<template>
  <div class="df df-bar relative w-full" :style="{ height: height + 'px' }" role="meter" :aria-label="label || undefined" :aria-valuemin="0" :aria-valuemax="max" :aria-valuenow="Math.max(0, Math.min(max, value))">
    <div class="absolute inset-0 bg-black/60" />
    <div v-if="ghost > value" class="absolute inset-y-0 left-0 bg-[#f0d0a0]/40 transition-[width] duration-700" :style="{ width: Math.max(0, Math.min(100, (ghost / Math.max(1, max)) * 100)) + '%' }" />
    <div class="absolute inset-y-0 left-0 border-t border-white/15 transition-[width] duration-200" :style="{ width: Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100)) + '%', background: preferences.palette === 'standard' || color === 'gold' || color === 'green' ? FILL[color] : `linear-gradient(var(--state-${color === 'red' ? 'health' : 'energy'}), #302c28)`, backgroundSize: '100% 100%' }" />
    <div v-if="cap !== undefined && cap < max" class="absolute inset-y-0 right-0 border-l border-[#dca783]/50 bg-[repeating-linear-gradient(135deg,rgba(0,0,0,.8)_0_2px,rgba(70,48,37,.85)_2px_4px)]" :style="{ width: Math.max(0, Math.min(100, ((max - cap) / Math.max(1, max)) * 100)) + '%' }" />
    <div v-if="label" class="absolute inset-0 z-[1] flex items-center justify-center text-[11px] font-semibold leading-none text-[#f6f0de] [text-shadow:0_1px_2px_#000,0_0_3px_#000]">{{ label }}</div>
  </div>
</template>
