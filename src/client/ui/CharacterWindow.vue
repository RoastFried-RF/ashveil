<script setup lang="ts">
// 캐릭터: 초상·배경·특성 / 능력치(+포인트) / 파생치 / 숙달
import { computed } from 'vue'
import {
  attackScore, currentAttack, energyMax, evasion, hpMax, insulation, mood, player, sightRange, skillLevel, xpToNext,
  STAT_LABEL, type Stats, type World,
} from '../../core'
import { frameCss } from '../render/atlas'
import { modLines } from '../info'
import { version, world } from '../store'
import { doAct, hideTip, showTip, wins } from '../ui'
import Bar from './Bar.vue'
import Win from './Win.vue'

const STAT_TIP: Record<keyof Stats, string> = {
  str: '근접 피해, 넘어뜨리기·밀치기',
  agi: '공격치 +1.5/점, 회피치 +2/점, 받아넘기기',
  per: '공격치 +1/점, 시야, 기척',
  vit: '최대 체력 +5/점, 출혈·감염 저항',
  wil: '최대 기력 +5/점, 통증·스트레스 저항',
}

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const atk = currentAttack(w, pl)
  const prev = pl.level > 1 ? xpToNext(pl.level - 1) : 0
  return {
    pl,
    bg: pl.background ? w.db.background(pl.background) : null,
    traits: pl.traits.map((t) => w.db.trait(t)),
    stats: (Object.keys(STAT_LABEL) as (keyof Stats)[]).map((k) => ({ k, label: STAT_LABEL[k], v: pl.stats[k] })),
    derived: [
      ['최대 체력', hpMax(w, pl)], ['최대 기력', energyMax(w, pl)],
      ['공격치', atk ? attackScore(w, pl, atk).toFixed(1) : '-'], ['회피치', evasion(w, pl).toFixed(1)],
      ['시야', sightRange(w, pl)], ['단열', insulation(w, pl)], ['기분', mood(w, pl).toFixed(0)],
      ['무기', atk ? `${atk.label} ${atk.damage}` : '맨손'],
    ] as [string, string | number][],
    skills: Object.keys(pl.skills).filter((k) => w.db.has(k)).map((k) => ({ label: w.db.skill(k).label, lv: skillLevel(pl, k) })),
    xp: pl.xp - prev, xpMax: xpToNext(pl.level) - prev,
  }
})
</script>

<template>
  <Win title="캐릭터" :x="16" :y="80" :width="430" testid="win-char" @close="wins.char = false">
    <div class="flex gap-3">
      <div class="df df-slot-sel flex h-[112px] w-[84px] shrink-0 items-end justify-center overflow-hidden bg-[#1a1712]">
        <div class="pix origin-bottom scale-[3]" :style="frameCss('hero_w_down1', 1)" />
      </div>
      <div class="min-w-0 flex-1 space-y-1">
        <div class="font-title text-lg font-bold text-[#e8d7a8]">{{ d.pl.name }} <span class="text-sm text-ash-400">레벨 {{ d.pl.level }}</span></div>
        <div class="text-xs text-ash-300" :title="d.bg?.description">{{ d.bg?.label }}</div>
        <Bar :value="d.xp" :max="d.xpMax" color="gold" :height="14" :label="`경험치 ${d.xp} / ${d.xpMax}`" />
        <div class="flex flex-wrap gap-1 pt-0.5">
          <span v-for="t in d.traits" :key="t.id" class="df df-tab cursor-help px-1 text-[11px] text-amber-200" @mouseenter="showTip($event, t.label, [t.description ?? '', ...modLines(t.mods)])" @mouseleave="hideTip">{{ t.label }}</span>
        </div>
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between font-title text-sm text-[#e8d7a8]">
      <span>능력치</span>
      <span v-if="d.pl.statPoints" class="pulse-gold text-xs text-amber-300">남은 포인트 {{ d.pl.statPoints }}</span>
    </div>
    <div class="mt-1 grid grid-cols-5 gap-1" data-testid="stats">
      <div v-for="s in d.stats" :key="s.k" class="df df-slot relative px-0 py-1 text-center" @mouseenter="showTip($event, s.label, [STAT_TIP[s.k]])" @mouseleave="hideTip">
        <div class="text-[11px] text-ash-400">{{ s.label }}</div>
        <div class="font-title text-lg font-bold text-ash-50">{{ s.v }}</div>
        <button v-if="d.pl.statPoints" class="dbtn-gold absolute -right-1.5 -top-1.5 !px-0.5 !text-[11px]" :data-testid="`stat-${s.k}`" @click="doAct({ type: 'spendStat', stat: s.k })">+</button>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
      <div v-for="[k, v] in d.derived" :key="k" class="flex justify-between border-b border-[#2e2a22] py-0.5"><span class="text-ash-400">{{ k }}</span><span class="font-mono text-ash-100">{{ v }}</span></div>
    </div>
    <div v-if="d.skills.length" class="mt-3 text-xs">
      <div class="mb-1 font-title text-sm text-[#e8d7a8]">숙달 (쓰면 오른다)</div>
      <div class="grid grid-cols-2 gap-x-4">
        <div v-for="s in d.skills" :key="s.label" class="flex justify-between"><span class="text-ash-300">{{ s.label }}</span><span class="font-mono">{{ s.lv }}</span></div>
      </div>
    </div>
  </Win>
</template>
