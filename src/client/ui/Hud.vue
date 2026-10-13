<script setup lang="ts">
// 하단 중앙 HUD: 초상 · 체력/기력/경험치 · 빠른 슬롯 1~0 · 창 버튼
import { computed, ref, watch } from 'vue'
import { abilityReady, energyMax, hpMax, player, turnOf, xpToNext, xpTotalFor, type World } from '../../core'
import { frameCss } from '../render/atlas'
import { abilityTip, itemTip } from '../info'
import { version, world } from '../store'
import { doAct, hideTip, showTip, toggleWin, useHotbar, wins, type WinKey } from '../ui'
import Bar from './Bar.vue'
import ItemIcon from './ItemIcon.vue'

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const turn = turnOf(w)
  const slots = pl.hotbar.map((ref, i) => {
    if (!ref) return { i, empty: true as const }
    if (ref.kind === 'ability') {
      const a = w.db.ability(ref.id)
      const cd = Math.max(0, (pl.cooldowns[ref.id] ?? 0) - turn)
      const err = abilityReady(w, pl, ref.id)
      return { i, empty: false as const, icon: a.icon, label: a.label, cd, cdMax: a.cooldown ?? 1, ok: !err, count: null as number | null, on: a.kind === 'toggle' && pl.sneaking, ref }
    }
    const count = pl.bag.filter((it) => it.def === ref.def).reduce((s, it) => s + it.count, 0)
    const def = w.db.item(ref.def)
    return { i, empty: false as const, icon: def.sprite, label: def.label, cd: 0, cdMax: 1, ok: count > 0, count, on: false, ref }
  })
  return {
    pl, hp: Math.max(0, pl.hp), hpMax: hpMax(w, pl), en: pl.needs.stamina, enMax: energyMax(w, pl),
    xp: pl.xp - xpTotalFor(pl.level), xpNext: xpToNext(pl.level) - xpTotalFor(pl.level), level: pl.level, slots,
    points: pl.statPoints, apoints: pl.abilityPoints, wounds: pl.body.wounds.length,
  }
})

// 체력이 깎이면 잠시 옅은 잔상 막대를 남긴다
const ghost = ref(0)
let ghostTimer: ReturnType<typeof setTimeout> | undefined
watch(() => d.value.hp, (now, before) => {
  if (before !== undefined && now < before) {
    ghost.value = Math.max(ghost.value, before)
    clearTimeout(ghostTimer)
    ghostTimer = setTimeout(() => { ghost.value = 0 }, 650)
  }
})

function tipSlot(e: MouseEvent, s: (typeof d.value.slots)[number]) {
  if (s.empty) return showTip(e, `빈 칸 ${s.i === 9 ? 0 : s.i + 1}`, ['능력 창(K)이나 소지품(I)에서 등록한다'])
  const w = world.value as World
  if (s.ref.kind === 'ability') { const t = abilityTip(w, w.db.ability(s.ref.id)); showTip(e, t.title, [...t.lines, '우클릭: 칸 비우기']) }
  else { const t = itemTip(w, null, s.ref.def); showTip(e, t.title, [...t.lines, '우클릭: 칸 비우기'], t.color) }
}

const BTNS: [WinKey, string, string][] = [['char', '캐릭터', 'C'], ['inv', '소지품', 'I'], ['abil', '능력', 'K'], ['body', '신체', 'B'], ['journal', '일지', 'J']]
</script>

<template>
  <div class="pointer-events-auto flex items-end gap-2" data-testid="hud">
    <!-- 초상 + 막대 -->
    <div class="df df-olive flex w-[250px] items-center gap-2">
      <div class="df df-slot-sel relative flex h-[60px] w-[52px] shrink-0 items-end justify-center overflow-hidden bg-[#1a1712]">
        <div class="pix origin-bottom scale-[1.8]" :style="frameCss('hero_w_down1', 1)" />
        <span class="absolute bottom-0 right-0 rounded-sm bg-black/70 px-1 text-[10px] font-bold text-amber-200">{{ d.level }}</span>
      </div>
      <div class="flex-1 space-y-1">
        <Bar :value="d.hp" :max="d.hpMax" :ghost="ghost" color="red" :label="`체력 ${Math.ceil(d.hp)} / ${d.hpMax}`" data-testid="hp-bar" />
        <Bar :value="d.en" :max="d.enMax" color="blue" :label="`기력 ${Math.floor(d.en)} / ${d.enMax}`" />
        <Bar :value="d.xp" :max="d.xpNext" color="gold" :height="10" :label="''" :title="`경험치 ${d.xp} / ${d.xpNext}`" />
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <!-- 창 버튼 -->
      <div class="flex justify-center gap-1">
        <button v-for="[k, l, key] in BTNS" :key="k" :class="wins[k] ? 'dbtn-gold' : 'dbtn'" class="relative whitespace-nowrap !text-[11px]" :data-testid="`btn-${k}`" @click="toggleWin(k)">
          {{ l }}<span class="ml-0.5 text-[9px] text-ash-400">{{ key }}</span>
          <span v-if="(k === 'char' && d.points) || (k === 'abil' && d.apoints)" class="pulse-gold absolute -right-1 -top-1 h-2.5 w-2.5 rotate-45 bg-amber-400" />
        </button>
      </div>
      <!-- 빠른 슬롯 -->
      <div class="df df-celtic !border-[12px] flex gap-[3px]" data-testid="hotbar">
        <button
          v-for="s in d.slots" :key="s.i" class="df relative flex h-[46px] w-[46px] items-center justify-center" :class="!s.empty && s.on ? 'df-slot-sel' : 'df-slot'"
          :data-testid="`hotbar-${s.i}`" @click="useHotbar(s.i)" @contextmenu.prevent="!s.empty && doAct({ type: 'hotbar', index: s.i, ref: null })"
          @mouseenter="tipSlot($event, s)" @mousemove="tipSlot($event, s)" @mouseleave="hideTip"
        >
          <template v-if="!s.empty">
            <ItemIcon :name="s.icon" :size="32" :dim="!s.ok" />
            <div v-if="s.cd > 0" class="absolute inset-0 flex items-center justify-center bg-black/65 text-sm font-bold text-[#e8d7a8]">{{ s.cd }}</div>
            <span v-if="s.count !== null" class="absolute bottom-0 right-0.5 text-[10px] font-bold text-[#f0e6c8] [text-shadow:0_1px_0_#000]">{{ s.count }}</span>
          </template>
          <span class="absolute left-0.5 top-0 text-[9px] font-bold text-[#a89c80]">{{ s.i === 9 ? 0 : s.i + 1 }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
