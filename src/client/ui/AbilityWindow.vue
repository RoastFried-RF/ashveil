<script setup lang="ts">
// 능력 창 (15 §19 · 12): 6갈래 × 4단계. 배운 것은 금테, 배울 수 있으면 반짝임, 명시 선행은 오른쪽 연결선.
// 툴팁 L1 = 이름·유형·기력·대기·효과, Shift를 누르면 L2 = 바꾸는 공식 항. 클릭: 배우기 / 우클릭: 빠른 슬롯
import { computed } from 'vue'
import {
  abilitiesByTree, canLearn, masteryCount, masteryNext, masteryStage, MASTERY_LABEL, MASTERY_STEPS, player, TREES, xpToNext, xpTotalFor, type AbilityDef, type World,
} from '../../core'
import { abilityFormula, abilityTip } from '../info'
import { version, world } from '../store'
import { assignHotbar, doAct, hideTip, showTip, useAbility, wins } from '../ui'
import ItemIcon from './ItemIcon.vue'
import Win from './Win.vue'

/** 열 머리 높이 · 칸 높이(버튼 50 + 간격 8) */
const HEAD = 40
const ROW = 58

interface Cell { a: AbilityDef; learned: boolean; why: string | null }

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const by = abilitiesByTree(w)
  const lv = pl.level
  const base = xpTotalFor(lv), next = xpToNext(lv)
  return {
    w, pl,
    xp: { cur: pl.xp - base, need: next - base, total: pl.xp, next },
    mastery: (['medicine', 'survival'] as const).map((k) => {
      const n = masteryCount(pl, k), st = masteryStage(pl, k), nx = masteryNext(pl, k)
      const prev = st > 0 ? MASTERY_STEPS[st - 1] : 0
      return { label: MASTERY_LABEL[k], st, n, nx, frac: nx ? (n - prev) / (nx - prev) : 1 }
    }),
    trees: TREES.map((t) => {
      const list: Cell[] = (by[t.id] ?? []).map((a) => ({ a, learned: pl.abilities.includes(a.id), why: canLearn(w, pl, a.id) }))
      // 명시 선행 (15 §7): 같은 갈래 안 i행 → j행
      const links = list.flatMap((x, j) => (x.a.requires ?? []).map((r) => ({ i: list.findIndex((y) => y.a.id === r), j, on: x.learned || list.find((y) => y.a.id === r)?.learned })).filter((l) => l.i >= 0))
      return { ...t, count: list.filter((x) => x.learned).length, list, links }
    }),
  }
})

function tip(e: MouseEvent, x: Cell) {
  const w = d.value.w
  const t = abilityTip(w, x.a)
  const req = (x.a.requires ?? []).map((r) => `선행: ${w.db.ability(r).label}`)
  const extra = x.learned ? (x.a.kind === 'passive' ? ['배움 (항상 적용)'] : ['배움 · 클릭: 사용 · 우클릭: 빠른 슬롯']) : x.why ? [`배울 수 없음: ${x.why}`] : ['클릭: 배우기']
  const formula = e.shiftKey ? ['— 공식 (Shift)', ...abilityFormula(x.a)] : ['Shift: 공식 보기']
  showTip(e, t.title, [...t.lines, ...req, ...formula, ...extra], x.learned ? '#ffd870' : undefined)
}
function click(x: Cell) {
  if (!x.learned) { if (!x.why) doAct({ type: 'learn', id: x.a.id }); return }
  if (x.a.kind !== 'passive') useAbility(x.a.id)
}
const linkPath = (l: { i: number; j: number }) => {
  const y1 = HEAD + l.i * ROW + 25, y2 = HEAD + l.j * ROW + 25
  return `M0 ${y1} H9 V${y2} H2 M5 ${y2 - 3} L2 ${y2} L5 ${y2 + 3}`
}
</script>

<template>
  <Win title="능력" :x="120" :y="70" :width="600" testid="win-abil" @close="wins.abil = false">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span class="text-ash-300" data-testid="abil-xp">레벨 {{ d.pl.level }} · 경험치 {{ d.xp.cur }} / {{ d.xp.need }} <span class="text-ash-500">(누적 {{ d.xp.total }} / {{ d.xp.next }})</span></span>
      <span :class="d.pl.abilityPoints ? 'pulse-gold text-amber-300' : 'text-ash-500'">능력 포인트 {{ d.pl.abilityPoints }}</span>
    </div>
    <div class="mb-2 h-1 w-full bg-black/60"><div class="h-full bg-[#b89a50]" :style="{ width: Math.min(100, (d.xp.cur / Math.max(1, d.xp.need)) * 100) + '%' }" /></div>
    <div class="mb-1 text-[10px] text-ash-500">1·2단계는 바로, 3·4단계는 같은 갈래 능력을 하나 이상 배워야 열린다. 오른쪽 선은 명시 선행.</div>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
      <div v-for="t in d.trees" :key="t.id" class="inset relative flex flex-col items-center py-1" :style="{ height: HEAD + 4 * ROW + 'px' }">
        <div class="flex flex-col items-center" :style="{ height: HEAD + 'px' }">
          <div class="font-title text-sm font-bold text-[#e8d7a8]">{{ t.label }}</div>
          <div class="text-[10px] text-ash-500">{{ t.count }}/4</div>
        </div>
        <template v-for="(x, i) in t.list" :key="x.a.id">
          <div v-if="i > 0" class="h-2 w-0.5" :class="x.learned ? 'bg-amber-500' : 'bg-[#3a3428]'" />
          <button
            class="df relative flex h-[50px] w-[50px] shrink-0 items-center justify-center" :data-testid="`ab-${x.a.id}`"
            :class="[x.learned ? 'df-slot-sel' : 'df-slot', !x.learned && !x.why ? 'pulse-gold' : '']"
            @click="click(x)" @contextmenu.prevent="x.learned && x.a.kind !== 'passive' && assignHotbar({ kind: 'ability', id: x.a.id })"
            @mouseenter="tip($event, x)" @mousemove="tip($event, x)" @mouseleave="hideTip"
          >
            <ItemIcon :name="x.a.icon" :size="32" :dim="!x.learned" />
            <span class="absolute left-0.5 top-0 text-[9px] font-bold text-[#a89c80]">{{ x.a.tier }}</span>
            <span v-if="x.a.kind === 'passive'" class="absolute bottom-0 right-0.5 text-[9px] text-ash-400">P</span>
          </button>
        </template>
        <svg v-if="t.links.length" class="pointer-events-none absolute top-1 overflow-visible" :style="{ left: 'calc(50% + 26px)', width: '12px', height: HEAD + 4 * ROW + 'px' }" data-testid="ab-prereq">
          <path v-for="(l, k) in t.links" :key="k" :d="linkPath(l)" fill="none" :stroke="l.on ? '#d9a040' : '#5a5240'" stroke-width="1.5" />
        </svg>
      </div>
    </div>
    <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
      <div v-for="m in d.mastery" :key="m.label" class="flex items-center gap-2">
        <span class="text-ash-300">{{ m.label }} 숙달 {{ m.st }}단계</span>
        <span class="h-1 w-24 bg-black/60"><span class="block h-full bg-[#76864a]" :style="{ width: m.frac * 100 + '%' }" /></span>
        <span class="text-ash-500">{{ m.n }}/{{ m.nx ?? '최고' }}</span>
      </div>
    </div>
  </Win>
</template>
