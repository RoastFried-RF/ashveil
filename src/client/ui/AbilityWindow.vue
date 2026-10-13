<script setup lang="ts">
// 능력 나무 6갈래 × 4단계. 배운 것은 금테, 배울 수 있으면 반짝인다. 클릭: 배우기 / 우클릭: 빠른 슬롯
import { computed } from 'vue'
import { abilitiesByTree, canLearn, player, TREES, type AbilityDef, type World } from '../../core'
import { abilityTip } from '../info'
import { version, world } from '../store'
import { assignHotbar, doAct, hideTip, showTip, useAbility, wins } from '../ui'
import ItemIcon from './ItemIcon.vue'
import Win from './Win.vue'

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const by = abilitiesByTree(w)
  return {
    w, pl,
    trees: TREES.map((t) => ({
      ...t,
      count: pl.abilities.filter((a) => w.db.ability(a).tree === t.id).length,
      list: (by[t.id] ?? []).map((a) => ({ a, learned: pl.abilities.includes(a.id), why: canLearn(w, pl, a.id) })),
    })),
  }
})

function tip(e: MouseEvent, x: { a: AbilityDef; learned: boolean; why: string | null }) {
  const t = abilityTip(d.value.w, x.a)
  const extra = x.learned ? (x.a.kind === 'passive' ? ['배움 (항상 적용)'] : ['배움 · 클릭: 사용 · 우클릭: 빠른 슬롯']) : x.why ? [`배울 수 없음: ${x.why}`] : ['클릭: 배우기']
  showTip(e, t.title, [...t.lines, ...extra], x.learned ? '#ffd870' : undefined)
}
function click(x: { a: AbilityDef; learned: boolean; why: string | null }) {
  if (!x.learned) { if (!x.why) doAct({ type: 'learn', id: x.a.id }); return }
  if (x.a.kind !== 'passive') useAbility(x.a.id)
}
</script>

<template>
  <Win title="능력" :x="120" :y="70" :width="560" testid="win-abil" @close="wins.abil = false">
    <div class="mb-2 flex items-center justify-between text-xs">
      <span class="text-ash-400">같은 갈래를 (단계−1)개 이상 배워야 다음 단계가 열린다.</span>
      <span :class="d.pl.abilityPoints ? 'pulse-gold text-amber-300' : 'text-ash-500'">능력 포인트 {{ d.pl.abilityPoints }}</span>
    </div>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
      <div v-for="t in d.trees" :key="t.id" class="inset flex flex-col items-center gap-2 py-2">
        <div class="font-title text-sm font-bold text-[#e8d7a8]">{{ t.label }}</div>
        <div class="text-[10px] text-ash-500">{{ t.count }}/4</div>
        <template v-for="(x, i) in t.list" :key="x.a.id">
          <div v-if="i > 0" class="-my-1.5 h-2 w-0.5" :class="x.learned ? 'bg-amber-500' : 'bg-[#3a3428]'" />
          <button
            class="df relative flex h-[50px] w-[50px] items-center justify-center" :data-testid="`ab-${x.a.id}`"
            :class="[x.learned ? 'df-slot-sel' : 'df-slot', !x.learned && !x.why ? 'pulse-gold' : '']"
            @click="click(x)" @contextmenu.prevent="x.learned && x.a.kind !== 'passive' && assignHotbar({ kind: 'ability', id: x.a.id })"
            @mouseenter="tip($event, x)" @mousemove="tip($event, x)" @mouseleave="hideTip"
          >
            <ItemIcon :name="x.a.icon" :size="32" :dim="!x.learned" />
            <span class="absolute left-0.5 top-0 text-[9px] font-bold text-[#a89c80]">{{ x.a.tier }}</span>
            <span v-if="x.a.kind === 'passive'" class="absolute bottom-0 right-0.5 text-[9px] text-ash-400">P</span>
          </button>
        </template>
      </div>
    </div>
  </Win>
</template>
