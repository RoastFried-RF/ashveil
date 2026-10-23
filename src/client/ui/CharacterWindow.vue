<script setup lang="ts">
// 캐릭터: 초상·배경·특성 / 능력치(+포인트) / 파생치 / 숙달
import { computed } from 'vue'
import {
  attackScore, currentAttack, darkSightRange, energyMax, evasion, hpMax, insulation, mood, player, sightRange, masteryCount, masteryNext, masteryStage, MASTERY_LABEL, xpToNext, xpTotalFor,
  STAT_LABEL, regenerationPeriod, traitMul, effectiveStat, traitAdd, traumaLabel, traumaHelp, type Stats, type World,
} from '../../core'
import { creatureSprite } from '../render/creature-sprite'
import { modLines } from '../info'
import { version, world } from '../store'
import { doAct, hideTip, showTip, wins } from '../ui'
import Bar from './Bar.vue'
import Win from './Win.vue'
import CharacterPortrait from './CharacterPortrait.vue'

const STAT_TIP: Record<keyof Stats, string> = {
  str: '근접 피해, 넘어뜨리기·밀치기',
  agi: '공격치 +1.5/점, 회피치 +2/점, 받아넘기기',
  per: '공격치 +1/점, 지각 15부터 5점마다 기본 시야 +5%, 기척',
  vit: '최대 체력 +5/점, 출혈·감염 저항',
  wil: '최대 기력 +5/점, 통증·스트레스 저항',
}

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const atk = currentAttack(w, pl)
  const prev = xpTotalFor(pl.level)
  return {
    pl,
    portrait: creatureSprite(w, pl),
    prayer: traitAdd(w, pl, 'prayerRelief') > 0 || pl.background === 'Bg.Excommunicate',
    traumas: (pl.traumas ?? []).map((t) => ({ label: traumaLabel(w, t), score: t.overcome, active: t.active, help: traumaHelp(w, t) })),
    hunters: (pl.fearlessAgainst ?? []).map((id) => w.db.creature(id).label),
    bg: pl.background ? w.db.background(pl.background) : null,
    traits: pl.traits.map((t) => w.db.trait(t)),
    stats: (Object.keys(STAT_LABEL) as (keyof Stats)[]).map((k) => ({ k, label: STAT_LABEL[k], v: effectiveStat(w, pl, k) })),
    derived: [
      ['나이', pl.age ? `${pl.age.years}세` : '기록 없음'], ['HP 회복 주기', `${regenerationPeriod(w, pl)}턴`], ['면역 계수', `×${traitMul(w, pl, 'immunityMult').toFixed(2)}`],
      ['최대 체력', hpMax(w, pl)], ['최대 기력', energyMax(w, pl)],
      ['공격치', atk ? attackScore(w, pl, atk).toFixed(1) : '-'], ['회피치', evasion(w, pl).toFixed(1)],
      ['문해', ['문맹', '더듬더듬', '읽음', '학자'][pl.literacy ?? (pl.literate ? 2 : 0)]], ['완독', `${pl.booksRead?.length ?? 0}권`],
      ...(pl.literacyLessons ? [['글자 수업', `${pl.literacyLessons.days.length}일 수료`]] : []),
      ['시야', `${sightRange(w, pl)}칸 · 어둠 ${darkSightRange(w, pl)}칸`], ['전신 단열', insulation(w, pl).toFixed(3)], ['기분', mood(w, pl).toFixed(0)],
      ['무기', atk ? `${atk.label} ${atk.damage}` : '맨손'],
    ] as [string, string | number][],
    skills: (['medicine', 'survival'] as const).map((k) => ({ label: `${MASTERY_LABEL[k]} 숙달`, lv: `${masteryStage(w, pl, k)}단계 (${masteryCount(pl, k)}/${masteryNext(w, pl, k) ?? '최고'})` })),
    xp: pl.xp - prev, xpMax: xpToNext(pl.level) - prev,
  }
})
</script>

<template>
  <Win title="캐릭터" :x="16" :y="80" :width="430" testid="win-char" @close="wins.char = false">
    <div class="flex gap-3">
      <div class="df df-slot-sel flex h-[112px] w-[84px] shrink-0 items-end justify-center overflow-hidden bg-[#1a1712]">
        <CharacterPortrait :name="d.portrait" fill />
      </div>
      <div class="min-w-0 flex-1 space-y-1">
        <div class="font-title text-lg font-bold text-[#e8d7a8]">{{ d.pl.name }} <span class="text-sm text-ash-400">레벨 {{ d.pl.level }}</span></div>
        <div class="text-xs text-ash-300" @mouseenter="d.bg && showTip($event, d.bg.label, [d.bg.description, ...modLines(d.bg.mods)])" @mouseleave="hideTip">{{ d.bg?.label }}</div>
        <Bar :value="d.xp" :max="d.xpMax" color="gold" :height="14" :label="`경험치 ${d.xp} / ${d.xpMax}`" />
        <div class="flex flex-wrap gap-1 pt-0.5">
          <span v-for="t in d.traits" :key="t.id" class="df df-tab cursor-help px-1 text-[11px] text-amber-200" @mouseenter="showTip($event, t.label, [t.description ?? '', ...modLines(t.mods)])" @mouseleave="hideTip">{{ t.label }}</span>
        </div>
      </div>
    </div>

    <div v-if="d.traumas.length || d.hunters.length" class="mt-3 space-y-1 text-xs" data-testid="traumas">
      <div v-for="t in d.traumas" :key="t.label" class="flex cursor-help justify-between text-orange-200" @mouseenter="showTip($event, t.label, t.help)" @mouseleave="hideTip"><span>{{ t.label }}{{ t.active ? ' · 노출 중' : '' }}</span><span>극복 {{ t.score }}/100</span></div>
      <div v-for="name in d.hunters" :key="name" class="text-emerald-200">{{ name }} 사냥꾼 · 명중 +10 / 사기 +10 / 생고기 +20%</div>
      <div v-if="d.traumas.length" class="text-[11px] text-ash-400">공포 항목에 마우스를 올리면 효과와 극복 방법이 보인다.</div>
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
    <button v-if="d.prayer" class="dbtn mt-3 text-xs" data-testid="pray" @click="doAct({ type: 'pray' })">장막에 기도 (10분)</button>
    <div v-if="d.skills.length" class="mt-3 text-xs">
      <div class="mb-1 font-title text-sm text-[#e8d7a8]">숙달 (성공할수록 오른다 · 같은 대상 1회 · 시간당 3회)</div>
      <div class="grid grid-cols-2 gap-x-4">
        <div v-for="s in d.skills" :key="s.label" class="flex justify-between"><span class="text-ash-300">{{ s.label }}</span><span class="font-mono">{{ s.lv }}</span></div>
      </div>
    </div>
  </Win>
</template>
