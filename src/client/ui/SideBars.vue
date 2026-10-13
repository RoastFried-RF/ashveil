<script setup lang="ts">
// 좌측 상태 막대 7개 (12 §2.2): 배고픔·갈증·피로·통증·정신력·체온·혈액. 단계에 따라 회색 → 호박 → 빨강
import { computed } from 'vue'
import { bloodLoss, mood, painTotal, player, type World } from '../../core'
import { version, world } from '../store'
import { hideTip, showTip } from '../ui'

interface BarSpec { key: string; label: string; frac: number; level: 0 | 1 | 2; ticks: number[]; tip: string[]; mark?: number; center?: boolean }

const COLORS = ['#8a857a', '#d9a040', '#d8402e']

const bars = computed<BarSpec[]>(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const n = pl.needs
  const pain = painTotal(w, pl)
  const thr = 80 + (pl.stats.wil - 10) * 2
  const loss = bloodLoss(pl)
  const m = mood(w, pl)
  const t = n.bodyTemp
  const lvl = (v: number, a: number, b: number): 0 | 1 | 2 => (v >= b ? 2 : v >= a ? 1 : 0)
  return [
    { key: 'hunger', label: '배고픔', frac: Math.min(1, Math.max(0, 1 - n.kcal / 3000)), level: n.kcal < 0 ? 2 : n.kcal < 900 ? 1 : 0, ticks: [0.7], tip: [`열량 ${Math.round(n.kcal)} kcal`, '900 미만 배고픔 · 0 미만 굶주림'] },
    { key: 'thirst', label: '갈증', frac: Math.min(1, Math.max(0, 1 - n.water / 3000)), level: n.water < 0 ? 2 : n.water < 900 ? 1 : 0, ticks: [0.7], tip: [`수분 ${Math.round(n.water)} ml`, '900 미만 갈증 · 0 미만 탈수'] },
    { key: 'fatigue', label: '피로', frac: n.fatigue / 100, level: lvl(n.fatigue, 60, 90), ticks: [0.6, 0.75, 0.9], tip: [`피로 ${n.fatigue.toFixed(0)}`, '60 피곤 · 75 지침 · 90 탈진'] },
    { key: 'pain', label: '통증', frac: Math.min(1, pain / 150), level: pain >= 70 ? 2 : pain >= 30 ? 1 : 0, ticks: [15, 30, 50, 70, 90].map((x) => x / 150), mark: thr / 150, tip: [`통증 ${pain.toFixed(0)}`, '경미 15 · 중간 30 · 심각 50 · 극심 70 · 극한 90', `통증 기절 임계 ${thr}`] },
    { key: 'mind', label: '정신력', frac: Math.max(0, Math.min(1, m / 100)), level: m < 15 ? 2 : m < 30 ? 1 : 0, ticks: [0.15, 0.3], tip: [`기분 ${m.toFixed(0)}`, '15 미만 붕괴 위험'] },
    { key: 'temp', label: '체온', frac: Math.max(0, Math.min(1, (t - 30) / 14)), level: t < 32 || t > 41 ? 2 : t < 35 || t > 39.5 ? 1 : 0, center: true, ticks: [32, 35, 37, 39.5, 41].map((x) => (x - 30) / 14), tip: [`체온 ${t.toFixed(1)}°C`, '35.0 저체온 · 32.0 위험 · 39.5 고열'] },
    { key: 'blood', label: '혈액', frac: 1 - loss, level: loss >= 0.3 ? 2 : loss >= 0.15 ? 1 : 0, ticks: [0.85, 0.7, 0.6, 0.5], tip: [`혈액 ${Math.round(pl.body.blood)} / ${pl.body.bloodMax} ml (손실 ${Math.round(loss * 100)}%)`, '15% 어지러움 · 30% 쇼크 위험 · 40% 기절 · 50% 사망'] },
  ]
})
</script>

<template>
  <div class="df df-olive pointer-events-auto flex !border-[8px] gap-1.5" data-testid="sidebars">
    <div v-for="b in bars" :key="b.key" class="flex flex-col items-center gap-0.5" @mouseenter="showTip($event, b.label, b.tip)" @mousemove="showTip($event, b.label, b.tip)" @mouseleave="hideTip">
      <div class="relative h-[86px] w-[9px] overflow-hidden bg-black/70 ring-1 ring-[#3a352a]">
        <div class="absolute inset-x-0 bottom-0 transition-[height] duration-300" :style="{ height: b.frac * 100 + '%', background: COLORS[b.level] }" />
        <div v-for="(t, i) in b.ticks" :key="i" class="absolute inset-x-0 h-px bg-black/80" :style="{ bottom: t * 100 + '%' }" />
        <div v-if="b.mark !== undefined" class="absolute inset-x-0 h-[2px] bg-[#ff5040]" :style="{ bottom: Math.min(1, b.mark) * 100 + '%' }" />
      </div>
      <span class="text-[9px] leading-none" :class="b.level === 2 ? 'text-blood-300' : b.level === 1 ? 'text-amber-300' : 'text-ash-400'">{{ b.label.slice(0, 2) }}</span>
    </div>
  </div>
</template>
