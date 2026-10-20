<script setup lang="ts">
// 하단 중앙 HUD: 초상 · 체력/기력/경험치 · 빠른 슬롯 1~0 · 창 버튼
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { quickCount, abilityReady, energyMax, hpCap, hpMax, player, turnOf, wield, xpToNext, xpTotalFor, type World } from '../../core'
import { frameCss } from '../render/atlas'
import { abilityTip, itemTip } from '../info'
import { primaryBindingText, type Command } from '../keybindings'
import { preferences } from '../preferences'
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
    const count = quickCount(pl,ref.def,ref.fletchingDamaged)
    const def = w.db.item(ref.def)
    return { i, empty: false as const, icon: def.sprite, label: def.label+(ref.fletchingDamaged?' (깃 손상)':''), cd: 0, cdMax: 1, ok: count > 0, count, on: def.category==='ammo'&&pl.ammoPreference?.def===ref.def&&(ref.fletchingDamaged===undefined||pl.ammoPreference.fletchingDamaged===ref.fletchingDamaged), ref }
  })
  return {
    pl, hp: Math.max(0, pl.hp), hpMax: hpMax(w, pl), en: pl.needs.energy, enMax: energyMax(w, pl),
    xp: pl.xp - xpTotalFor(pl.level), xpNext: xpToNext(pl.level) - xpTotalFor(pl.level), level: pl.level, slots,
    points: pl.statPoints, apoints: pl.abilityPoints, wounds: pl.body.wounds.length, cap: hpCap(w, pl),
    // 채널 진행 (12 §2.1): "붕대 감기 3/5턴"
    chan: pl.activity?.total ? { label: pl.activity.label, done: pl.activity.total - pl.activity.remaining, total: pl.activity.total } : null,
    policy: { block: '막기 우선', parry: '받아넘기기 우선', none: '반응 안 함' }[pl.reactPolicy ?? 'block'],
    mode: wield(w, pl)?.atk.label ?? '맨손',
    modes: (wield(w, pl)?.item ? w.db.item(wield(w, pl)!.item!.def).attacks?.length ?? 0 : 0) > 1,
  }
})

// 체력이 깎이면 잠시 옅은 잔상 막대를 남긴다
const ghost = ref(0)
const portraitVisible = ref(true)
const portraitSrc = `${import.meta.env.BASE_URL}art/ashveil-wanderer-portrait.png`
let ghostTimer: ReturnType<typeof setTimeout> | undefined
watch(() => d.value.hp, (now, before) => {
  if (before !== undefined && now < before) {
    ghost.value = Math.max(ghost.value, before)
    clearTimeout(ghostTimer)
    ghostTimer = setTimeout(() => { ghost.value = 0 }, 650)
  }
})
onBeforeUnmount(() => clearTimeout(ghostTimer))

function tipSlot(e: MouseEvent, s: (typeof d.value.slots)[number]) {
  if (s.empty) return showTip(e, `빈 칸 ${s.i === 9 ? 0 : s.i + 1}`, [`능력 창(${primaryBindingText(preferences.keyBindings,'abilities')})이나 소지품(${primaryBindingText(preferences.keyBindings,'inventory')})에서 등록한다`])
  const w = world.value as World
  if (s.ref.kind === 'ability') { const t = abilityTip(w, w.db.ability(s.ref.id)); showTip(e, t.title, [...t.lines, '우클릭: 칸 비우기']) }
  else { const t = itemTip(w, null, s.ref.def); showTip(e, s.label, [...t.lines,...(s.ref.fletchingDamaged?['깃 손상 탄약만 선택한다.']:[]), '우클릭: 칸 비우기'], t.color) }
}

const BTNS: [WinKey, string, Command][] = [['char','캐릭터','character'],['inv','소지품','inventory'],['abil','능력','abilities'],['body','신체','body'],['journal','일지','journal'],['map','지도','map'],['craft','제작','craft'],['society','주민·세력','society']]
</script>

<template>
  <div class="hud-shell pointer-events-auto" data-testid="hud">
    <div v-if="d.chan" class="hud-channel" data-testid="channel">
      <Bar :value="d.chan.done" :max="d.chan.total" color="gold" :height="18" :label="`${d.chan.label} ${d.chan.done}/${d.chan.total}턴`" />
    </div>

    <div class="hud-vitals">
      <div class="hud-portrait">
        <div class="pix mb-4 origin-bottom scale-[2.8]" :style="frameCss('hero_w_down1', 1)" />
        <img v-if="portraitVisible" :src="portraitSrc" alt="" @error="portraitVisible = false" />
        <span class="hud-level">LV. {{ d.level }}</span>
      </div>
      <div class="min-w-0 flex-1 space-y-1.5">
        <p class="hud-name">{{ d.pl.name }}</p>
        <Bar :value="d.hp" :max="d.hpMax" :ghost="ghost" :cap="d.cap" color="red" :height="19" :label="`체력 ${Math.ceil(d.hp)} / ${d.hpMax}`" :title="`상처로 묶인 회복 상한 ${d.cap} / ${d.hpMax}`" data-testid="hp-bar" />
        <Bar :value="d.en" :max="d.enMax" color="blue" :height="18" :label="`기력 ${Math.floor(d.en)} / ${d.enMax}`" />
        <Bar class="hud-xp" :value="d.xp" :max="d.xpNext" color="gold" :height="5" :label="''" :title="`경험치 ${d.xp} / ${d.xpNext}`" aria-label="다음 레벨까지 경험치" />
      </div>
    </div>

    <div class="hud-context">
      <button class="dbtn" :title="`반응 정책 순환 (${primaryBindingText(preferences.keyBindings,'reaction')})`" @click="doAct({ type: 'reactPolicy' })"><span class="text-ash-400">반응</span> {{ d.policy }} <kbd>{{ primaryBindingText(preferences.keyBindings,'reaction') }}</kbd></button>
      <button class="dbtn" :disabled="!d.modes" :title="`공격 방식 바꾸기 (${primaryBindingText(preferences.keyBindings,'attackMode')}, 자유 행동)`" @click="doAct({ type: 'attackMode' })"><span class="text-ash-400">공격</span> {{ d.mode }} <kbd>{{ primaryBindingText(preferences.keyBindings,'attackMode') }}</kbd></button>
    </div>

    <div class="hud-hotbar" data-testid="hotbar">
      <button
        v-for="s in d.slots" :key="s.i" class="df df-slot hud-slot relative flex items-center justify-center" :class="{ 'df-slot-sel': !s.empty && s.on, 'is-selected': !s.empty && s.on, 'is-empty': s.empty }"
        :data-testid="`hotbar-${s.i}`" :aria-label="`${primaryBindingText(preferences.keyBindings,`hotbar${s.i===9?0:s.i+1}` as Command)}: ${s.empty ? '빈 빠른 슬롯' : s.label}`" :aria-pressed="!s.empty && s.on"
        @click="useHotbar(s.i)" @contextmenu.prevent="!s.empty && doAct({ type: 'hotbar', index: s.i, ref: null })"
        @mouseenter="tipSlot($event, s)" @mousemove="tipSlot($event, s)" @mouseleave="hideTip"
      >
        <template v-if="!s.empty">
          <ItemIcon :name="s.icon" :size="32" :dim="!s.ok" />
          <div v-if="s.cd > 0" class="absolute inset-0 flex items-center justify-center rounded-sm bg-black/70 text-base font-bold text-[#e8d7a8]">{{ s.cd }}</div>
          <span v-if="s.count !== null" class="absolute bottom-0 right-0.5 rounded-sm bg-[#091114]/80 px-0.5 font-mono text-[11px] font-bold text-[#f0e6c8] [text-shadow:0_1px_0_#000]" :data-testid="`hotbar-count-${s.i}`">{{ s.count }}</span>
        </template>
        <span class="hud-key">{{ primaryBindingText(preferences.keyBindings,`hotbar${s.i===9?0:s.i+1}` as Command) }}</span>
      </button>
    </div>

    <nav class="hud-nav" aria-label="게임 창">
      <button v-for="[k, l, key] in BTNS" :key="k" :class="wins[k] ? 'dbtn-gold' : 'dbtn'" class="relative whitespace-nowrap" :data-testid="`btn-${k}`" :aria-pressed="wins[k]" @click="toggleWin(k)">
        {{ l }}<kbd>{{ primaryBindingText(preferences.keyBindings,key) }}</kbd>
        <span v-if="(k === 'char' && d.points) || (k === 'abil' && d.apoints)" class="pulse-gold absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-amber-300" />
      </button>
    </nav>
  </div>
</template>
