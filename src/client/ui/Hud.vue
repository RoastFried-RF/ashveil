<script setup lang="ts">
// 하단 중앙 HUD: 초상 · 체력/기력/경험치 · 빠른 슬롯 1~0 · 창 버튼
import { t, defText, keyLabel } from '../locale'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { abilityReady, crouched, energyMax, hpCap, hpMax, player, turnOf, wield, xpToNext, xpTotalFor, type World } from '../../core'
import {quickbarCount,quickbarItem} from '../quickbar-items'
import {displayItemLabel,displayItemDefLabel} from '../locales/item'
import {creatureSprite} from '../render/creature-sprite'
import { abilityTip, itemTip } from '../info'
import { primaryBindingText, type Command } from '../keybindings'
import { preferences } from '../preferences'
import { version, world } from '../store'
import { doAct, hideTip, showTip, startManeuver, toggleWin, useHotbar, wins, type WinKey } from '../ui'
import Bar from './Bar.vue'
import ItemIcon from './ItemIcon.vue'
import CharacterPortrait from './CharacterPortrait.vue'

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const turn = turnOf(w)
  const gun = pl.equip.main
  const gunDef = gun && w.db.item(gun.def)
  const ranged = gunDef?.ranged
  const firearm = gun && gunDef && ranged?.firearm ? {
    uid: gun.uid, label: defText(gunDef),
    loaded: ranged.magazine ? gun.loadedCartridges?.length ?? 0 : gun.loadedRound ? 1 : 0,
    capacity: ranged.magazine?.capacity ?? 1,
    jammed: !!gun.firearmJammed,
  } : null
  const slots = pl.hotbar.map((ref, i) => {
    if (!ref) return { i, empty: true as const }
    if (ref.kind === 'ability') {
      const a = w.db.ability(ref.id)
      const cd = Math.max(0, (pl.cooldowns[ref.id] ?? 0) - turn)
      const err = abilityReady(w, pl, ref.id)
      return { i, empty: false as const, icon: a.icon, label: defText(a), cd, cdMax: a.cooldown ?? 1, ok: !err, count: null as number | null, on: a.kind === 'toggle' && pl.sneaking, ref }
    }
    const def = w.db.item(ref.def)
    const count = quickbarCount(w,pl,ref)
    const selected=quickbarItem(w,pl,ref),label=selected?displayItemLabel(w,selected):ref.fletchingDamaged?t('{0} (깃 손상)',displayItemDefLabel(def)):displayItemDefLabel(def)
    return { i, empty: false as const, icon: def.sprite, label, cd: 0, cdMax: 1, ok: count > 0, count, on: def.category==='ammo'&&pl.ammoPreference?.def===ref.def&&(ref.fletchingDamaged===undefined||pl.ammoPreference.fletchingDamaged===ref.fletchingDamaged), ref }
  })
  return {
    pl,portrait:creatureSprite(w,pl), hp: Math.max(0, pl.hp), hpMax: hpMax(w, pl), en: pl.needs.energy, enMax: energyMax(w, pl),
    xp: pl.xp - xpTotalFor(pl.level), xpNext: xpToNext(pl.level) - xpTotalFor(pl.level), level: pl.level, slots,
    points: pl.statPoints, apoints: pl.abilityPoints, wounds: pl.body.wounds.length, cap: hpCap(w, pl),
    // 채널 진행 (12 §2.1): "붕대 감기 3/5턴"
    chan: pl.activity?.total ? { label: pl.activity.label, done: pl.activity.total - pl.activity.remaining, total: pl.activity.total } : null,
    policy: { block: '막기 우선', parry: '받아넘기기 우선', none: '반응 안 함' }[pl.reactPolicy ?? 'block'],
    firearm, crouched: crouched(w, pl), mode: wield(w, pl)?.atk.label ?? '맨손',
    modes: (wield(w, pl)?.item ? w.db.item(wield(w, pl)!.item!.def).attacks?.length ?? 0 : 0) > 1,
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
onBeforeUnmount(() => clearTimeout(ghostTimer))

function tipSlot(e: MouseEvent, s: (typeof d.value.slots)[number]) {
  if (s.empty) return showTip(e, t('빈 칸 {0}',s.i === 9 ? 0 : s.i + 1), [t('능력 창({0})이나 소지품({1})에서 등록한다',keyLabel(primaryBindingText(preferences.keyBindings,'abilities')),keyLabel(primaryBindingText(preferences.keyBindings,'inventory')))])
  const w = world.value as World
  if (s.ref.kind === 'ability') { const tooltip = abilityTip(w, w.db.ability(s.ref.id)); showTip(e, tooltip.title, [...tooltip.lines, t('우클릭: 칸 비우기')]) }
  else { const tooltip = itemTip(w, quickbarItem(w,player(w),s.ref)??null, s.ref.def); showTip(e, tooltip.title, [...tooltip.lines,...(s.ref.fletchingDamaged?[t('깃 손상 탄약만 선택한다.')]:[]), t('우클릭: 칸 비우기')], tooltip.color) }
}

const BTNS: [WinKey, string, Command][] = [['char','캐릭터','character'],['inv','소지품','inventory'],['abil','능력','abilities'],['body','신체','body'],['journal','일지','journal'],['map','지도','map'],['craft','제작','craft'],['society','주민·세력','society']]
const MANEUVERS = [['trip', '넘어뜨리기'], ['disarm', '무장해제']] as const
</script>

<template>
  <div class="hud-shell pointer-events-auto" data-testid="hud">
    <div v-if="d.chan" class="hud-channel" data-testid="channel">
      <Bar :value="d.chan.done" :max="d.chan.total" color="gold" :height="18" :label="t('{0} {1}/{2}턴',d.chan.label,d.chan.done,d.chan.total)" />
    </div>

    <div class="hud-vitals">
      <div class="hud-portrait">
        <CharacterPortrait :name="d.portrait" fill />
        <span class="hud-level">LV. {{ d.level }}</span>
      </div>
      <div class="hud-gauges min-w-0 flex-1">
        <p class="hud-name">{{ d.pl.name }}</p>
        <Bar :value="d.hp" :max="d.hpMax" :ghost="ghost" :cap="d.cap" color="red" :height="19" :label="t('체력 {0} / {1}',Math.ceil(d.hp),d.hpMax)" :title="t('상처로 묶인 회복 상한 {0} / {1}',d.cap,d.hpMax)" data-testid="hp-bar" />
        <Bar :value="d.en" :max="d.enMax" color="blue" :height="18" :label="t('기력 {0} / {1}',Math.floor(d.en),d.enMax)" />
        <Bar class="hud-xp" :value="d.xp" :max="d.xpNext" color="gold" :height="8" :label="''" :title="t('경험치 {0} / {1}',d.xp,d.xpNext)" :aria-label="t('다음 레벨까지 경험치')" />
      </div>
    </div>

    <div class="hud-context">
      <div class="hud-policy-context" role="group" :aria-label="t('반응 정책 및 자세')">
        <button class="dbtn" :title="t('반응 정책 순환 ({0})',keyLabel(primaryBindingText(preferences.keyBindings,'reaction')))" @click="doAct({ type: 'reactPolicy' })"><span class="text-ash-400">{{ t("반응") }}</span> {{ t(d.policy) }} <kbd>{{ keyLabel(primaryBindingText(preferences.keyBindings,'reaction')) }}</kbd></button>
        <button class="dbtn hud-posture" :class="{ 'is-crouched': d.crouched }" data-testid="btn-crouch" :aria-pressed="d.crouched" :aria-label="t('현재 자세: {0}. {1} ({2})',t(d.crouched ? '웅크림' : '서기'),t(d.crouched ? '일어서기' : '웅크리기'),keyLabel(primaryBindingText(preferences.keyBindings,'crouch')))" :title="t('현재 {0} · {1} ({2})',t(d.crouched ? '웅크림' : '서기'),t(d.crouched ? '일어서기' : '웅크리기'),keyLabel(primaryBindingText(preferences.keyBindings,'crouch')))" @click="doAct({ type: 'crouch' })">
          <ItemIcon name="crouch" :size="16" />{{ t(d.crouched ? '웅크림' : '서기') }}<kbd>{{ keyLabel(primaryBindingText(preferences.keyBindings,'crouch')) }}</kbd>
        </button>
      </div>
      <div class="hud-attack-context">
        <button class="dbtn" :disabled="!d.modes" :title="t('공격 방식 바꾸기 ({0}, 자유 행동)',keyLabel(primaryBindingText(preferences.keyBindings,'attackMode')))" @click="doAct({ type: 'attackMode' })"><span class="text-ash-400">{{ t("공격") }}</span> <span class="hud-mode-label">{{ t(d.mode) }}</span> <kbd>{{ keyLabel(primaryBindingText(preferences.keyBindings,'attackMode')) }}</kbd></button>
        <span v-if="d.firearm" class="hud-firearm-ammo" :class="{ 'is-empty': !d.firearm.loaded, 'is-jammed': d.firearm.jammed }" role="status" aria-live="polite" aria-atomic="true" :aria-label="t('{0}: 장전 {1}/{2}발{3}',d.firearm.label,d.firearm.loaded,d.firearm.capacity,t(d.firearm.jammed ? ', 걸림' : !d.firearm.loaded ? ', 빈 총' : ''))" :title="t('{0} · 장전 {1}/{2}발{3}',d.firearm.label,d.firearm.loaded,d.firearm.capacity,t(d.firearm.jammed ? ' · 걸림' : !d.firearm.loaded ? ' · 빈 총' : ''))" data-testid="hud-firearm-ammo" :data-weapon-uid="d.firearm.uid" :data-loaded="d.firearm.loaded" :data-capacity="d.firearm.capacity" :data-jammed="d.firearm.jammed">
          <svg width="6" height="11" viewBox="0 0 6 11" fill="none" aria-hidden="true"><path d="M2 1h2l1 2v6H1V3l1-2ZM1 7h4M0 10h6" stroke="currentColor" stroke-width=".8" /></svg>
          <span v-if="d.firearm.jammed" class="hud-firearm-state">{{ t("걸림") }}</span><span v-else-if="!d.firearm.loaded" class="hud-firearm-state">{{ t("빈 총") }}</span>
          <span class="hud-firearm-count">{{ d.firearm.loaded }}/{{ d.firearm.capacity }}<span class="hud-firearm-unit">{{ t('{0}발','') }}</span></span>
        </span>
      </div>
    </div>

    <div class="hud-hotbar" data-testid="hotbar">
      <button
        v-for="s in d.slots" :key="s.i" class="df df-slot hud-slot relative flex items-center justify-center" :class="{ 'df-slot-sel': !s.empty && s.on, 'is-selected': !s.empty && s.on, 'is-empty': s.empty }"
        :data-testid="`hotbar-${s.i}`" :aria-label="`${keyLabel(primaryBindingText(preferences.keyBindings,`hotbar${s.i===9?0:s.i+1}` as Command))}: ${s.empty ? t('빈 빠른 슬롯') : s.label}`" :aria-pressed="!s.empty && s.on"
        @click="useHotbar(s.i)" @contextmenu.prevent="!s.empty && doAct({ type: 'hotbar', index: s.i, ref: null })"
        @mouseenter="tipSlot($event, s)" @mousemove="tipSlot($event, s)" @mouseleave="hideTip"
      >
        <template v-if="!s.empty">
          <ItemIcon :name="s.icon" :size="32" :dim="!s.ok" />
          <div v-if="s.cd > 0" class="absolute inset-0 flex items-center justify-center rounded-sm bg-black/70 text-base font-bold text-[#e8d7a8]">{{ s.cd }}</div>
          <span v-if="s.count !== null" class="absolute bottom-0 right-0.5 rounded-sm bg-[#171416]/80 px-0.5 font-mono text-[11px] font-bold text-[#f0e6c8] [text-shadow:0_1px_0_#000]" :data-testid="`hotbar-count-${s.i}`">{{ s.count }}</span>
        </template>
        <span class="hud-key">{{ keyLabel(primaryBindingText(preferences.keyBindings,`hotbar${s.i===9?0:s.i+1}` as Command)) }}</span>
      </button>
    </div>

    <nav class="hud-nav" :aria-label="t('게임 창 및 기본 전투 행동')">
      <button v-for="[k, l, key] in BTNS" :key="k" :class="wins[k] ? 'dbtn-gold' : 'dbtn'" class="relative whitespace-nowrap" :data-testid="`btn-${k}`" :aria-pressed="wins[k]" @click="toggleWin(k)">
        {{ t(l) }}<kbd>{{ keyLabel(primaryBindingText(preferences.keyBindings,key)) }}</kbd>
        <span v-if="(k === 'char' && d.points) || (k === 'abil' && d.apoints)" class="pulse-gold absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-amber-300" />
      </button>
      <div class="hud-maneuvers" role="group" :aria-label="t('기본 전투 행동')">
        <button v-for="[command, label] in MANEUVERS" :key="command" class="dbtn hud-maneuver-button" :data-testid="`btn-${command}`" :title="t('{0}: 대상을 고른다 ({1})',t(label),keyLabel(primaryBindingText(preferences.keyBindings,command)))" @click="startManeuver(command)">
          <ItemIcon :name="command" :size="16" />{{ t(label) }}<kbd>{{ keyLabel(primaryBindingText(preferences.keyBindings,command)) }}</kbd>
        </button>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.hud-context { flex-wrap: wrap; row-gap: 4px; }
.hud-policy-context { display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: 3px; }
.hud-policy-context > button { flex-shrink: 0; white-space: nowrap; }
.hud-context .hud-posture { gap: 3px; padding-inline: 5px; }
.hud-context .hud-posture.is-crouched { border-color: #8d9a70; background: #40372b; color: #f2e8c5; }
.hud-nav { flex-wrap: wrap; }
.hud-maneuvers { display: flex; flex-shrink: 0; align-items: center; gap: 3px; margin-left: 4px; padding-left: 7px; border-left: 1px solid #687052; }
.hud-nav .hud-maneuver-button { display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto; min-height: 24px; padding: 2px 6px; border-color: #716249; background: #332b2180; color: #ded8ba; font-size: 10px; }
.hud-nav .hud-maneuver-button:hover { border-color: #bea56e; background: #4a3c2b; color: #fff0c6; }
.hud-attack-context { display: flex; min-width: 0; max-width: 100%; align-items: center; gap: 6px; margin-left: auto; }
.hud-attack-context > button { min-width: 0; }
.hud-mode-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hud-firearm-ammo { display: inline-flex; flex-shrink: 0; min-height: 20px; align-items: center; gap: 5px; border: 1px solid #758164; border-radius: 3px; background: #28211d; padding: 1px 6px; color: #e2d9b9; white-space: nowrap; }
.hud-firearm-ammo > svg { color: #c0a46e; }
.hud-firearm-count { font: 600 11px var(--font-mono); font-variant-numeric: tabular-nums; }
.hud-firearm-unit { margin-left: 2px; color: #aab8a6; font: 10px var(--font-sans); }
.hud-firearm-state { font-size: 10px; font-weight: 600; }
.hud-firearm-ammo.is-empty { border-color: var(--state-warn); background: #302d20; color: #e9cb91; }
.hud-firearm-ammo.is-jammed { border-color: var(--state-danger); background: #3c2723; color: #ffdbb2; }
</style>
