<script setup lang="ts">
// 신체: 6부위 상태(왼쪽) + 상처·출혈·처치(오른쪽)
import { computed } from 'vue'
import {
  allItems, bloodLoss, capacity, effectiveBleed, hasBlade, hpMax, itemDef, painLabel, painTotal, part, partRegion, player,
  regionHealth, regionPenalties, regionState, skillLevel, totalBleed, turnOf, woundDef,
  REGION_LABEL, STATE_LABEL, type ItemInst, type Region, type Wound, type World,
} from '../../core'
import { STATE_COLOR } from '../info'
import { act, version, world } from '../store'
import { hideTip, showTip, wins } from '../ui'
import Bar from './Bar.vue'
import Win from './Win.vue'

const REGION_EFFECT: Record<Region, string> = {
  head: '명중 감소, 의식', torso: '기력 회복 감소', larm: '방패 막기 감소', rarm: '명중·피해 감소', lleg: '회피 감소, 비틀거림', rleg: '회피 감소, 비틀거림',
}

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const inv = allItems(pl)
  const find = (pred: (i: ItemInst) => boolean) => inv.find(pred)
  const med = skillLevel(pl, 'medicine')
  const bandage = find((i) => i.def === 'Item.Bandage') ?? find((i) => itemDef(w, i).medical?.kind === 'bandage')
  const tourniquet = find((i) => itemDef(w, i).medical?.kind === 'tourniquet')
  const splint = find((i) => itemDef(w, i).medical?.kind === 'splint')
  const disinfect = find((i) => itemDef(w, i).medical?.kind === 'disinfect')
  const canCauterize = inv.some((i) => i.lit && (i.fuel ?? 0) > 0) && hasBlade(w, pl)
  const bleed = totalBleed(w, pl)
  const blood = pl.body.blood, max = pl.body.bloodMax
  const eta = (thr: number) => (bleed > 0.05 && blood > max * thr ? Math.floor((blood - max * thr) / bleed) : null)
  const regions = (['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg'] as Region[]).map((r) => ({
    r, label: REGION_LABEL[r], s: regionState(w, pl, r), h: regionHealth(w, pl, r),
    wounds: pl.body.wounds.filter((x) => partRegion(w, pl, x.part) === r).length,
  }))
  const wounds = pl.body.wounds.map((wd: Wound) => {
    const def = woundDef(w, wd)
    const pd = part(w, pl, wd.part)
    const hidden = wd.internal && med < 25
    return {
      wd, hidden, limb: pd.limb, region: REGION_LABEL[partRegion(w, pl, wd.part)],
      label: hidden ? '몸속 출혈 (부위 불명)' : `${pd.label} · ${def.label}`,
      sev: wd.severity - wd.healed, healPct: wd.healed / wd.severity, bleed: effectiveBleed(w, pl, wd),
      tags: [
        wd.arterial ? '동맥' : '', wd.fracture ? (wd.splinted ? '골절(부목)' : '골절') : '',
        wd.bandage ? (wd.bandage.quality === 'clean' ? '붕대' : '천 붕대') : '', wd.cauterized ? '소작' : '', wd.disinfected ? '소독' : '',
        wd.infection ? `감염 ${wd.infection.progress.toFixed(0)}% / 면역 ${wd.infection.immunity.toFixed(0)}%` : '',
      ].filter(Boolean),
      source: wd.source,
    }
  }).sort((a, b) => b.bleed - a.bleed)
  const pen = regionPenalties(w, pl)
  return {
    pl, bandage, tourniquet, splint, disinfect, canCauterize, regions, wounds, med,
    hp: pl.hp, hpMax: hpMax(w, pl), bleed, blood, max, loss: bloodLoss(pl), toShock: eta(0.7), toDeath: eta(0.5),
    pain: painTotal(w, pl),
    pen: [
      pen.hit ? `명중 −${pen.hit}` : '', pen.damageMult < 1 ? `피해 ×${pen.damageMult}` : '', pen.block ? `막기 −${pen.block}` : '',
      pen.evasion ? `회피 −${pen.evasion}` : '', pen.stumble ? `비틀거림 ${Math.round(pen.stumble * 100)}%` : '', pen.energyRegen < 1 ? `기력 회복 ×${pen.energyRegen}` : '',
    ].filter(Boolean),
    caps: [['의식', capacity(w, pl, 'consciousness')], ['이동', capacity(w, pl, 'moving')], ['조작', capacity(w, pl, 'manipulation')], ['시야', capacity(w, pl, 'sight')], ['호흡', capacity(w, pl, 'breathing')]] as [string, number][],
    tqs: Object.entries(pl.body.tourniquets).map(([limb, at]) => ({ limb, label: part(w, pl, limb).label, minutes: Math.floor(((turnOf(w) - at) * 3) / 60) })),
    missing: pl.body.missing.map((m) => part(w, pl, m).label),
  }
})
const R = (r: Region) => d.value.regions.find((x) => x.r === r)!
function rtip(e: MouseEvent, r: Region) {
  const x = R(r)
  showTip(e, `${x.label}: ${STATE_LABEL[x.s]}`, [`부위 체력 ${Math.round(x.h * 100)}%`, `상처 ${x.wounds}개`, `영향: ${REGION_EFFECT[r]}`])
}
const pct = (v: number) => `${Math.round(v * 100)}%`
</script>

<template>
  <Win title="신체" :x="760" :y="70" :width="600" testid="win-body" @close="wins.body = false">
    <div class="flex flex-wrap gap-3 text-xs">
      <!-- 6부위 인형 -->
      <div class="w-[170px] shrink-0">
        <div class="inset relative mx-auto h-[220px] w-[150px]" data-testid="body-doll">
          <div class="absolute left-1/2 top-[8px] h-[38px] w-[38px] -translate-x-1/2 rounded-full border border-black/50" :style="{ background: STATE_COLOR[R('head').s] }" @mouseenter="rtip($event, 'head')" @mouseleave="hideTip" />
          <div class="absolute left-1/2 top-[50px] h-[70px] w-[46px] -translate-x-1/2 rounded-md border border-black/50" :style="{ background: STATE_COLOR[R('torso').s] }" @mouseenter="rtip($event, 'torso')" @mouseleave="hideTip" />
          <div class="absolute left-[22px] top-[52px] h-[66px] w-[16px] rotate-[8deg] rounded-md border border-black/50" :style="{ background: STATE_COLOR[R('rarm').s] }" @mouseenter="rtip($event, 'rarm')" @mouseleave="hideTip" />
          <div class="absolute right-[22px] top-[52px] h-[66px] w-[16px] -rotate-[8deg] rounded-md border border-black/50" :style="{ background: STATE_COLOR[R('larm').s] }" @mouseenter="rtip($event, 'larm')" @mouseleave="hideTip" />
          <div class="absolute left-[50px] top-[124px] h-[82px] w-[20px] rounded-md border border-black/50" :style="{ background: STATE_COLOR[R('rleg').s] }" @mouseenter="rtip($event, 'rleg')" @mouseleave="hideTip" />
          <div class="absolute right-[50px] top-[124px] h-[82px] w-[20px] rounded-md border border-black/50" :style="{ background: STATE_COLOR[R('lleg').s] }" @mouseenter="rtip($event, 'lleg')" @mouseleave="hideTip" />
        </div>
        <div class="mt-1 grid grid-cols-2 gap-x-2">
          <div v-for="x in d.regions" :key="x.r" class="flex justify-between"><span class="text-ash-400">{{ x.label }}</span><b :style="{ color: STATE_COLOR[x.s] === '#4a1612' ? '#c04030' : STATE_COLOR[x.s] }">{{ STATE_LABEL[x.s] }}</b></div>
        </div>
        <div v-if="d.pen.length" class="mt-1 text-[11px] text-amber-300">{{ d.pen.join(' · ') }}</div>
      </div>

      <!-- 수치·상처 -->
      <div class="min-w-[300px] flex-1 space-y-2">
        <Bar :value="d.hp" :max="d.hpMax" color="red" :label="`체력 ${Math.ceil(d.hp)} / ${d.hpMax}`" />
        <div>
          <Bar :value="d.blood" :max="d.max" color="red" :height="12" :label="`혈액 ${Math.round(d.blood)} / ${d.max} ml`" />
          <div class="mt-0.5 flex flex-wrap gap-x-3 text-ash-400">
            <span>출혈 <b :class="d.bleed > 5 ? 'text-blood-300' : 'text-ash-200'">{{ d.bleed.toFixed(1) }}</b> ml/턴</span>
            <span v-if="d.toShock !== null">쇼크까지 ~{{ d.toShock }}턴</span>
            <span v-if="d.toDeath !== null" :class="d.toDeath < 300 ? 'text-blood-300' : ''">사망까지 ~{{ d.toDeath }}턴</span>
            <span>통증 <b class="text-ash-200">{{ painLabel(d.pain) }}</b></span>
          </div>
        </div>
        <div class="grid grid-cols-5 gap-1">
          <div v-for="[k, v] in d.caps" :key="k" class="df df-tab text-center">
            <div class="text-[10px] text-ash-400">{{ k }}</div>
            <div class="font-mono" :class="v < 0.5 ? 'text-blood-300' : v < 0.85 ? 'text-amber-300' : 'text-ash-100'">{{ pct(v) }}</div>
          </div>
        </div>
        <div v-if="d.missing.length" class="text-blood-300">잃은 부위: {{ d.missing.join(', ') }}</div>
        <div v-for="t in d.tqs" :key="t.limb" class="df df-tab flex items-center justify-between">
          <span>지혈대: {{ t.label }} · <b :class="t.minutes > 90 ? 'text-blood-300' : 'text-amber-300'">{{ t.minutes }}분</b> (120분 넘으면 괴사)</span>
          <button class="dbtn" @click="act({ type: 'removeTourniquet', limb: t.limb })">풀기</button>
        </div>
        <div class="font-title text-sm text-[#e8d7a8]">상처 {{ d.wounds.length }}개 <span class="text-xs text-ash-500">(의료 {{ d.med }})</span></div>
        <p v-if="!d.wounds.length" class="text-ash-500">멀쩡하다.</p>
        <ul class="space-y-1.5" data-testid="wounds">
          <li v-for="x in d.wounds" :key="x.wd.id" class="df df-tab" :data-testid="`wound-${x.wd.id}`">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div :class="x.bleed > 5 ? 'text-blood-300' : 'text-ash-100'">{{ x.label }} <span class="text-[10px] text-ash-500">[{{ x.region }}]</span></div>
                <div class="text-[10px] text-ash-500">{{ x.source }} · 심각도 {{ x.sev.toFixed(1) }} · 치유 {{ pct(x.healPct) }}</div>
              </div>
              <div class="shrink-0 font-mono" :class="x.bleed > 5 ? 'text-blood-300' : 'text-ash-400'">{{ x.bleed > 0.05 ? x.bleed.toFixed(1) + 'ml' : '' }}</div>
            </div>
            <div v-if="x.tags.length" class="mt-0.5 flex flex-wrap gap-1">
              <span v-for="t in x.tags" :key="t" class="rounded-sm bg-black/40 px-1 text-[10px]" :class="t === '동맥' || t.startsWith('감염') ? 'text-blood-300' : 'text-ash-200'">{{ t }}</span>
            </div>
            <div v-if="!x.hidden" class="mt-1 flex flex-wrap gap-1">
              <button v-if="d.bandage && !x.wd.internal && x.wd.bandage?.quality !== 'clean'" class="dbtn" @click="act({ type: 'treat', uid: d.bandage.uid, woundId: x.wd.id })">{{ d.bandage.def === 'Item.Bandage' ? '붕대' : '천 감기' }}</button>
              <button v-if="x.bleed > 0.3" class="dbtn" @click="act({ type: 'press', woundId: x.wd.id })">압박</button>
              <button v-if="d.tourniquet && x.limb && x.bleed > 0.3 && d.pl.body.tourniquets[x.limb] === undefined" class="dbtn" @click="act({ type: 'treat', uid: d.tourniquet.uid, woundId: x.wd.id })">지혈대</button>
              <button v-if="d.canCauterize && x.wd.bleed > 0 && !x.wd.internal && !x.wd.cauterized" class="dbtn" @click="act({ type: 'cauterize', woundId: x.wd.id })">소작</button>
              <button v-if="d.splint && x.wd.fracture && !x.wd.splinted" class="dbtn" @click="act({ type: 'treat', uid: d.splint.uid, woundId: x.wd.id })">부목</button>
              <button v-if="d.disinfect && (!x.wd.infectionChecked || x.wd.infection) && !x.wd.disinfected" class="dbtn" @click="act({ type: 'treat', uid: d.disinfect.uid, woundId: x.wd.id })">술로 소독</button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </Win>
</template>
