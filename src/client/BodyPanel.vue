<script setup lang="ts">
import { computed } from 'vue'
import {
  bloodLoss, capacity, effectiveBleed, hasBlade, itemDef, painLabel, painTotal, part, player, skillLevel,
  totalBleed, turnOf, woundDef, type Creature, type ItemInst, type Wound, type World,
} from '../core'
import { barClass, pct } from './format'
import { act, version, world } from './store'

function find(w: World, pl: Creature, pred: (i: ItemInst) => boolean) {
  return pl.inventory.find(pred)
}

const data = computed(() => {
  void version.value
  const w = world.value!
  const pl = player(w)
  const med = skillLevel(pl, 'medicine')
  const bandage = find(w, pl, (i) => i.def === 'Item.Bandage') ?? find(w, pl, (i) => itemDef(w, i).medical?.kind === 'bandage')
  const tourniquet = find(w, pl, (i) => itemDef(w, i).medical?.kind === 'tourniquet')
  const splint = find(w, pl, (i) => itemDef(w, i).medical?.kind === 'splint')
  const disinfect = find(w, pl, (i) => itemDef(w, i).medical?.kind === 'disinfect')
  const canCauterize = pl.inventory.some((i) => i.lit && (i.fuel ?? 0) > 0) && hasBlade(w, pl)
  const bleed = totalBleed(w, pl)
  const blood = pl.body.blood
  const max = pl.body.bloodMax
  const eta = (thr: number) => (bleed > 0.05 && blood > max * thr ? Math.floor((blood - max * thr) / bleed) : null)
  const wounds = pl.body.wounds.map((wd: Wound) => {
    const def = woundDef(w, wd)
    const pd = part(w, pl, wd.part)
    const hidden = wd.internal && med < 25
    return {
      wd,
      label: hidden ? '몸속 출혈 (부위 불명)' : `${pd.label} · ${def.label}`,
      hidden,
      sev: wd.severity - wd.healed,
      healPct: wd.healed / wd.severity,
      bleed: effectiveBleed(w, pl, wd),
      limb: pd.limb,
      tags: [
        wd.arterial ? '동맥' : '',
        wd.fracture ? (wd.splinted ? '골절(부목)' : '골절') : '',
        wd.bandage ? (wd.bandage.quality === 'clean' ? '붕대' : '천 붕대') : '',
        wd.cauterized ? '소작' : '',
        wd.disinfected ? '소독' : '',
        wd.infection ? `감염 ${wd.infection.progress.toFixed(0)}% / 면역 ${wd.infection.immunity.toFixed(0)}%` : '',
        wd.scar ? '' : '',
      ].filter(Boolean),
      source: wd.source,
    }
  })
  const tqs = Object.entries(pl.body.tourniquets).map(([limb, at]) => ({ limb, label: part(w, pl, limb).label, minutes: Math.floor(((turnOf(w) - at) * 3) / 60) }))
  return {
    w, pl, med, bandage, tourniquet, splint, disinfect, canCauterize, wounds, tqs,
    bleed, blood, max, loss: bloodLoss(pl),
    toShock: eta(0.7), toDeath: eta(0.5),
    pain: painTotal(w, pl),
    caps: [
      ['의식', capacity(w, pl, 'consciousness')],
      ['이동', capacity(w, pl, 'moving')],
      ['조작', capacity(w, pl, 'manipulation')],
      ['시야', capacity(w, pl, 'sight')],
      ['호흡', capacity(w, pl, 'breathing')],
    ] as [string, number][],
    missing: pl.body.missing.map((m) => part(w, pl, m).label),
  }
})
</script>

<template>
  <div class="space-y-3 text-xs" data-testid="body-panel">
    <div>
      <div class="mb-1 flex justify-between">
        <span>혈액</span>
        <span class="font-mono">{{ Math.round(data.blood) }} / {{ data.max }} ml</span>
      </div>
      <div class="relative h-2 rounded bg-ash-800">
        <div class="h-2 rounded" :class="barClass(1 - data.loss * 2)" :style="{ width: pct(data.blood / data.max) }" />
        <div v-for="t in [0.85, 0.7, 0.6, 0.5]" :key="t" class="absolute top-0 h-2 w-px bg-ash-400/70" :style="{ left: pct(t) }" />
      </div>
      <div class="mt-1 flex flex-wrap gap-x-3 text-ash-400">
        <span>출혈 <b :class="data.bleed > 5 ? 'text-blood-300' : 'text-ash-200'">{{ data.bleed.toFixed(1) }}</b> ml/턴</span>
        <span v-if="data.toShock !== null">쇼크까지 ~{{ data.toShock }}턴</span>
        <span v-if="data.toDeath !== null" :class="data.toDeath < 300 ? 'text-blood-300' : 'text-ash-400'">사망까지 ~{{ data.toDeath }}턴</span>
        <span>통증 <b class="text-ash-200">{{ painLabel(data.pain) }}</b> ({{ data.pain.toFixed(0) }})</span>
      </div>
    </div>

    <div class="grid grid-cols-5 gap-1">
      <div v-for="[k, v] in data.caps" :key="k" class="rounded bg-ash-800 p-1 text-center">
        <div class="text-[10px] text-ash-400">{{ k }}</div>
        <div class="font-mono" :class="v < 0.5 ? 'text-blood-300' : v < 0.85 ? 'text-amber-300' : 'text-ash-100'">{{ pct(v) }}</div>
      </div>
    </div>
    <div v-if="data.missing.length" class="text-blood-300">잃은 부위: {{ data.missing.join(', ') }}</div>

    <div v-if="data.tqs.length" class="space-y-1">
      <div v-for="t in data.tqs" :key="t.limb" class="flex items-center justify-between rounded border border-amber-700/60 bg-ash-800 p-1.5">
        <span>지혈대: {{ t.label }} · <b :class="t.minutes > 90 ? 'text-blood-300' : 'text-amber-300'">{{ t.minutes }}분</b> 경과 (120분 넘으면 괴사)</span>
        <button class="btn" @click="act({ type: 'removeTourniquet', limb: t.limb })">풀기</button>
      </div>
    </div>

    <div>
      <div class="mb-1 text-ash-400">상처 {{ data.wounds.length }}개 <span class="text-ash-500">(의료 {{ data.med }})</span></div>
      <p v-if="!data.wounds.length" class="text-ash-500">멀쩡하다.</p>
      <ul class="space-y-1.5">
        <li v-for="x in data.wounds" :key="x.wd.id" class="rounded border border-ash-700 bg-ash-800/60 p-1.5" :data-testid="`wound-${x.wd.id}`">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div :class="x.bleed > 5 ? 'text-blood-300' : 'text-ash-100'">{{ x.label }}</div>
              <div class="text-[10px] text-ash-500">{{ x.source }} · 심각도 {{ x.sev.toFixed(1) }} · 치유 {{ pct(x.healPct) }}</div>
            </div>
            <div class="shrink-0 font-mono" :class="x.bleed > 5 ? 'text-blood-300' : 'text-ash-400'">{{ x.bleed > 0.05 ? x.bleed.toFixed(1) + 'ml' : '' }}</div>
          </div>
          <div v-if="x.tags.length" class="mt-0.5 flex flex-wrap gap-1">
            <span v-for="t in x.tags" :key="t" class="rounded bg-ash-700 px-1 text-[10px]" :class="t === '동맥' || t.startsWith('감염') ? 'text-blood-300' : 'text-ash-200'">{{ t }}</span>
          </div>
          <div v-if="!x.hidden" class="mt-1 flex flex-wrap gap-1">
            <button v-if="data.bandage && !x.wd.internal && x.wd.bandage?.quality !== 'clean'" class="btn" @click="act({ type: 'treat', uid: data.bandage.uid, woundId: x.wd.id })">{{ data.bandage.def === 'Item.Bandage' ? '붕대' : '천 감기' }}</button>
            <button v-if="x.bleed > 0.3" class="btn" @click="act({ type: 'press', woundId: x.wd.id })">압박</button>
            <button v-if="data.tourniquet && x.limb && x.bleed > 0.3 && data.pl.body.tourniquets[x.limb] === undefined" class="btn" @click="act({ type: 'treat', uid: data.tourniquet.uid, woundId: x.wd.id })">지혈대</button>
            <button v-if="data.canCauterize && x.wd.bleed > 0 && !x.wd.internal && !x.wd.cauterized" class="btn !border-blood-700" @click="act({ type: 'cauterize', woundId: x.wd.id })">소작</button>
            <button v-if="data.splint && x.wd.fracture && !x.wd.splinted" class="btn" @click="act({ type: 'treat', uid: data.splint.uid, woundId: x.wd.id })">부목</button>
            <button v-if="data.disinfect && (!x.wd.infectionChecked || x.wd.infection) && !x.wd.disinfected" class="btn" @click="act({ type: 'treat', uid: data.disinfect.uid, woundId: x.wd.id })">술로 소독</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
