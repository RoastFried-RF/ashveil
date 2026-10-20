<script setup lang="ts">
// 좌측 상태 막대 7개 (12 §2.2): 배고픔·갈증·피로·통증·정신력·체온·혈액. 단계에 따라 회색 → 호박 → 빨강
import { computed } from 'vue'
import { bloodLoss, hungerBand, hungerStage, nutritionDef, nutritionProgress, metabolicSize, thirstBand, thirstStage, mood, painTotal, player, type World } from '../../core'
import { version, world } from '../store'
import { paletteColor } from '../preferences'
import { hideTip, showTip } from '../ui'
import { temperatureTip } from '../info'

interface BarSpec { key: string; label: string; frac: number; level: 0 | 1 | 2; ticks: number[]; tip: string[]; mark?: number; center?: boolean }

const color = (level: number) => level === 2 ? paletteColor('danger') : level === 1 ? paletteColor('warn') : '#8a857a'

const bars = computed<BarSpec[]>(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const n = pl.needs
  const pain = painTotal(w, pl)
  const thr = 80 + (pl.stats.wil - 10) * 2
  const loss = bloodLoss(pl)
  const m = mood(w, pl)
  const t = n.bodyTemp, heatShift = thirstBand(w, pl).heatShift
  const lvl = (v: number, a: number, b: number): 0 | 1 | 2 => (v >= b ? 2 : v >= a ? 1 : 0)
  const hunger = hungerStage(w, pl), thirst = thirstStage(w, pl), d = nutritionDef(w)
  return [
    { key: 'hunger', label: '배고픔', frac: nutritionProgress(w, pl, 'hunger'), level: lvl(hunger, 1, 2), ticks: d.hunger.slice(1).map((_, i) => (i + 1) / (d.hunger.length - 1)), tip: [`칼로리 균형 ${n.kcal.toFixed(0)} kcal · ${hungerBand(w, pl).label}`, ...d.hunger.slice(1).map((b) => `${b.label}: −${Math.round(b.deficit * metabolicSize(w, pl))} kcal`)] },
    { key: 'thirst', label: '갈증', frac: nutritionProgress(w, pl, 'thirst'), level: lvl(thirst, 1, 2), ticks: d.thirst.slice(1).map((_, i) => (i + 1) / (d.thirst.length - 1)), tip: [`수분 결손 ${n.waterDeficit.toFixed(0)} ml · ${thirstBand(w, pl).label}`, ...d.thirst.slice(1).map((b) => `${b.label}: ${b.deficit} ml`)] },
    { key: 'fatigue', label: '피로', frac: n.fatigue / 100, level: lvl(n.fatigue, 60, 90), ticks: [0.6, 0.75, 0.9], tip: [`피로 ${n.fatigue.toFixed(0)}`, '60 피곤 · 75 지침 · 90 탈진'] },
    { key: 'pain', label: '통증', frac: Math.min(1, pain / 150), level: pain >= 70 ? 2 : pain >= 30 ? 1 : 0, ticks: [15, 30, 50, 70, 90].map((x) => x / 150), mark: thr / 150, tip: [`통증 ${pain.toFixed(0)}`, '경미 15 · 중간 30 · 심각 50 · 극심 70 · 극한 90', `통증 기절 임계 ${thr}`] },
    { key: 'mind', label: '정신력', frac: Math.max(0, Math.min(1, m / 100)), level: m < 15 ? 2 : m < 30 ? 1 : 0, ticks: [0.15, 0.3], tip: [`기분 ${m.toFixed(0)}`, '15 미만 붕괴 위험'] },
    { key: 'temp', label: '체온', frac: Math.max(0, Math.min(1, (t - 30) / 14)), level: t < 32 || t > 41 - heatShift ? 2 : t < 35 || t > 39.5 - heatShift ? 1 : 0, center: true, ticks: [32, 35, 37, 39.5 - heatShift, 41 - heatShift].map((x) => (x - 30) / 14), tip: temperatureTip(w, pl) },
    { key: 'blood', label: '혈액', frac: 1 - loss, level: loss >= 0.3 ? 2 : loss >= 0.15 ? 1 : 0, ticks: [0.85, 0.7, 0.6, 0.5], tip: [`혈액 ${Math.round(pl.body.blood)} / ${pl.body.bloodMax} ml (손실 ${Math.round(loss * 100)}%)`, '15% 어지러움 · 30% 쇼크 위험 · 40% 기절 · 50% 사망'] },
  ]
})
</script>

<template>
  <div class="df df-olive pointer-events-auto flex gap-1.5" data-testid="sidebars">
    <div v-for="b in bars" :key="b.key" class="flex flex-col items-center gap-0.5" @mouseenter="showTip($event, b.label, b.tip)" @mousemove="showTip($event, b.label, b.tip)" @mouseleave="hideTip">
      <div class="relative h-[86px] w-[9px] overflow-hidden bg-black/70 ring-1 ring-[#3a352a]">
        <div class="absolute inset-x-0 bottom-0 transition-[height] duration-300" :style="{ height: b.frac * 100 + '%', background: color(b.level) }" />
        <div v-for="(t, i) in b.ticks" :key="i" class="absolute inset-x-0 h-px bg-black/80" :style="{ bottom: t * 100 + '%' }" />
        <div v-if="b.mark !== undefined" class="absolute inset-x-0 h-[2px] bg-[#ff5040]" :style="{ bottom: Math.min(1, b.mark) * 100 + '%' }" />
      </div>
      <span class="text-[9px] leading-none" :class="b.level === 2 ? 'text-blood-300' : b.level === 1 ? 'text-amber-300' : 'text-ash-400'">{{ b.label.slice(0, 2) }}</span>
    </div>
  </div>
</template>
