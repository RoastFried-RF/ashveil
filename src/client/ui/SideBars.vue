<script setup lang="ts">
// 좌측 상태 막대 7개 (12 §2.2): 배고픔·갈증·피로·통증·정신력·체온·혈액. 단계에 따라 회색 → 호박 → 빨강
import { computed } from 'vue'
import { bloodLoss, hungerBand, hungerStage, nutritionDef, nutritionProgress, metabolicSize, thirstBand, thirstStage, mood, painTotal, player, type World } from '../../core'
import { version, world } from '../store'
import { paletteColor } from '../preferences'
import { hideTip, showTip } from '../ui'
import { temperatureTip } from '../info'

interface BarSpec { key: string; label: string; value: string; frac: number; level: 0 | 1 | 2; ticks: number[]; tip: string[]; mark?: number; center?: boolean }

const TONE: Record<string, string> = { hunger: '#b09b73', thirst: '#7da3ad', fatigue: '#9b93ac', pain: '#b18c75', mind: '#9aac90', temp: '#c0ad84', blood: '#b98275' }
const color = (b: BarSpec) => b.level === 2 ? paletteColor('danger') : b.level === 1 ? paletteColor('warn') : TONE[b.key]

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
    { key: 'hunger', label: '배고픔', value: hungerBand(w, pl).label, frac: nutritionProgress(w, pl, 'hunger'), level: lvl(hunger, 1, 2), ticks: d.hunger.slice(1).map((_, i) => (i + 1) / (d.hunger.length - 1)), tip: [`칼로리 균형 ${n.kcal.toFixed(0)} kcal · ${hungerBand(w, pl).label}`, ...d.hunger.slice(1).map((b) => `${b.label}: −${Math.round(b.deficit * metabolicSize(w, pl))} kcal`)] },
    { key: 'thirst', label: '갈증', value: thirstBand(w, pl).label, frac: nutritionProgress(w, pl, 'thirst'), level: lvl(thirst, 1, 2), ticks: d.thirst.slice(1).map((_, i) => (i + 1) / (d.thirst.length - 1)), tip: [`수분 결손 ${n.waterDeficit.toFixed(0)} ml · ${thirstBand(w, pl).label}`, ...d.thirst.slice(1).map((b) => `${b.label}: ${b.deficit} ml`)] },
    { key: 'fatigue', label: '피로', value: `${n.fatigue.toFixed(0)}%`, frac: n.fatigue / 100, level: lvl(n.fatigue, 60, 90), ticks: [0.6, 0.75, 0.9], tip: [`피로 ${n.fatigue.toFixed(0)}`, '60 피곤 · 75 지침 · 90 탈진'] },
    { key: 'pain', label: '통증', value: pain.toFixed(0), frac: Math.min(1, pain / 150), level: pain >= 70 ? 2 : pain >= 30 ? 1 : 0, ticks: [15, 30, 50, 70, 90].map((x) => x / 150), mark: thr / 150, tip: [`통증 ${pain.toFixed(0)}`, '경미 15 · 중간 30 · 심각 50 · 극심 70 · 극한 90', `통증 기절 임계 ${thr}`] },
    { key: 'mind', label: '정신력', value: `${m.toFixed(0)}/100`, frac: Math.max(0, Math.min(1, m / 100)), level: m < 15 ? 2 : m < 30 ? 1 : 0, ticks: [0.15, 0.3], tip: [`기분 ${m.toFixed(0)}`, '15 미만 붕괴 위험'] },
    { key: 'temp', label: '체온', value: `${t.toFixed(1)}°C`, frac: Math.max(0, Math.min(1, (t - 30) / 14)), level: t < 32 || t > 41 - heatShift ? 2 : t < 35 || t > 39.5 - heatShift ? 1 : 0, center: true, ticks: [32, 35, 37, 39.5 - heatShift, 41 - heatShift].map((x) => (x - 30) / 14), tip: temperatureTip(w, pl) },
    { key: 'blood', label: '혈액', value: `${Math.round((1 - loss) * 100)}%`, frac: 1 - loss, level: loss >= 0.3 ? 2 : loss >= 0.15 ? 1 : 0, ticks: [0.85, 0.7, 0.6, 0.5], tip: [`혈액 ${Math.round(pl.body.blood)} / ${pl.body.bloodMax} ml (손실 ${Math.round(loss * 100)}%)`, '15% 어지러움 · 30% 쇼크 위험 · 40% 기절 · 50% 사망'] },
  ]
})
</script>

<template>
  <div class="df df-olive needs-panel pointer-events-auto" data-testid="sidebars" aria-label="생존 상태">
    <div v-for="b in bars" :key="b.key" class="needs-row" :data-testid="`need-${b.key}`" :data-level="b.level" :aria-label="`${b.label}: ${b.value}`" @mouseenter="showTip($event, b.label, b.tip)" @mousemove="showTip($event, b.label, b.tip)" @mouseleave="hideTip">
      <span class="needs-label">{{ b.label }}</span>
      <span class="needs-value" :style="b.level ? { color: color(b) } : undefined">{{ b.value }}</span>
      <div class="needs-meter" aria-hidden="true">
        <div class="needs-fill" :style="{ width: Math.max(0, Math.min(1, b.frac)) * 100 + '%', background: color(b) }" />
        <div v-for="(t, i) in b.ticks" :key="i" class="needs-tick" :style="{ left: t * 100 + '%' }" />
        <div v-if="b.center" class="needs-center" :style="{ left: ((37 - 30) / 14) * 100 + '%' }" />
        <div v-if="b.mark !== undefined" class="needs-limit" :style="{ left: Math.min(1, b.mark) * 100 + '%', background: paletteColor('danger') }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.needs-panel[data-testid="sidebars"] { display: grid; width: 158px; gap: 0; padding: 6px 9px; }
.needs-row { display: grid; grid-template-columns: 34px 47px minmax(0, 1fr); align-items: center; min-height: 22px; gap: 5px; border-bottom: 1px solid #a08b641c; cursor: help; }
.needs-row:last-child { border-bottom: 0; }
.needs-label { color: #c7baa0; font-size: 10px; line-height: 1.2; white-space: nowrap; }
.needs-value { overflow: hidden; color: #e1decb; font-size: 10px; line-height: 1.2; text-align: right; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.needs-row[data-level="2"] .needs-label::after { color: #e6c991; content: "!"; }
.needs-meter { position: relative; height: 5px; overflow: hidden; border: 1px solid #9a805447; border-radius: 1px; background: #100f11; }
.needs-fill { position: absolute; inset: 0 auto 0 0; transition: width .3s; }
.needs-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: #080d0c9c; }
.needs-center { position: absolute; top: 0; bottom: 0; width: 1px; background: #d8d8bfc7; }
.needs-limit { position: absolute; top: 0; bottom: 0; width: 2px; }
</style>
