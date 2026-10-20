<script setup lang="ts">
// 신체: 6부위 상태(왼쪽) + 상처·출혈·처치(오른쪽)
import { computed, ref } from 'vue'
import AirPanel from './AirPanel.vue'
import {
  infectionFor, scurvyLines, latentBiteLines, diseaseLines, drugLines, topicalError, prostheticError, prostheticLines, allItems, bloodLoss, canHeatBlade, capacity, effectiveBleed, isMissing, procedureDef, procedureError, hpMax, itemDef, itemLabel, painLabel, painTotal, part, partRegion, player,
  recoveryLines, surgeryDef, surgeryError, type Surgery, regionHealth, regionPenalties, regionState, masteryStage, totalBleed, turnOf, woundDef,
  ARM_BLOCK, REGION_LABEL, STATE_LABEL, type DrugDef, type ProstheticDef, type ItemInst, type Region, type Wound, type World,
} from '../../core'
import { parasiteRemovalQuote } from '../../core/parasites'
import { STATE_COLOR } from '../info'
import { act, version, world } from '../store'
import { doAct, hideTip, showTip, wins, prostheticInstallUid } from '../ui'
import Bar from './Bar.vue'
import Win from './Win.vue'

const REGION_EFFECT: Record<Region, string> = {
  head: '명중 감소, 의식', torso: '기력 회복 감소', larm: '방패 막기 감소', rarm: '명중·피해 감소', lleg: '회피 감소, 비틀거림', rleg: '회피 감소, 비틀거림',
}

const prostheticPart = ref('')
const amputationPart = ref(''), confirmAmputation = ref(false)
const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const inv = allItems(pl)
  const find = (pred: (i: ItemInst) => boolean) => inv.find(pred)
  const owned = pl.bag.filter((i) => !!itemDef(w, i).prosthetic)
  const selected = owned.find((i) => i.uid === prostheticInstallUid.value) ?? owned[0]
  const selectedRule = selected ? w.db.get<ProstheticDef>(itemDef(w, selected).prosthetic!) : undefined
  const ready = selectedRule && (!selectedRule.appraisalRequired || (selected?.appraisal ?? 0) >= 2)
  const targets = ready ? pl.body.missing.filter((id) => selectedRule.targets.includes(id)) : []
  const target = targets.includes(prostheticPart.value) ? prostheticPart.value : targets[0] ?? ''
  const installedLines = prostheticLines(w, pl)
  const med = masteryStage(w, pl, 'medicine')
  const bandage = find((i) => i.def === 'Item.Bandage') ?? find((i) => itemDef(w, i).medical?.kind === 'bandage')
  const bandageLabel = bandage && itemDef(w, bandage).medical?.dirty ? '천 감기' : '붕대'
  const tourniquet = find((i) => itemDef(w, i).medical?.kind === 'tourniquet')
  const splint = find((i) => itemDef(w, i).medical?.kind === 'splint')
  const disinfect = find((i) => itemDef(w, i).medical?.kind === 'disinfect')
  const thread = find((i) => itemDef(w, i).medical?.kind === 'suture')
  const topical = find((i) => !!itemDef(w, i).drug?.def && !!w.db.get<DrugDef>(itemDef(w, i).drug!.def!).external)
  const canCauterize = canHeatBlade(w, pl) && !pl.traumas?.some((t) => t.def === 'Trauma.Fire')
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
    // 내출혈은 보이지 않는다. 의료 숙달 2 이상이 자기 몸을 살피면 '원인 불명 혈액 감소' (02 §8 · 15 §9.3)
    const examined = pl.examinedAt !== undefined && pl.examinedAt >= turnOf(w) - wd.ageTurns
    const hidden = wd.internal && med < 3
    const showArtery = med >= 1 || examined
    return {
      preventable:(wd.biteCareUntil??-1)>=turnOf(w),
      wd, hidden, limb: pd.limb, region: REGION_LABEL[partRegion(w, pl, wd.part)],
      label: hidden ? '원인 불명 혈액 감소' : `${pd.label} · ${def.label}`,
      sev: wd.severity - wd.healed, healPct: wd.healed / wd.severity, bleed: effectiveBleed(w, pl, wd),
      tags: [
        wd.arterial && showArtery ? '동맥' : '', wd.fracture ? `${FRACTURE[wd.fracture.grade]} 골절${wd.splint ? (wd.splint.half ? '(반쪽 부목)' : '(부목)') : ''}` : '',
        wd.foreign ? wd.foreign.kind === 'arrow' ? '박힌 화살' : '남은 이물질' : '', wd.dislocated ? '탈구' : '',
        wd.suture ? `봉합 Q${wd.suture.quality}` : '', wd.ligated ? '결찰' : '',
        wd.bandage ? `${wd.bandage.dirty ? '천' : '붕대'} Q${wd.bandage.quality}` : '', wd.cauterized ? '소작' : '', wd.tendon ? '힘줄 절단' : '',
        med >= 1 && wd.contam > 0 && !wd.infection ? `오염 ${wd.contam}` : '',
        !hidden && wd.infection ? (med >= 1 ? `${infectionFor(w,wd).label} · 감염 ${wd.infection.progress.toFixed(0)} / 면역 ${wd.infection.immunity.toFixed(0)}` : infectionFor(w,wd).at>0?infectionFor(w,wd).label:'') : '',
      ].filter(Boolean),
      source: wd.source,
      topical: topical ? { uid: topical.uid, label: itemDef(w, topical).label, error: topicalError(w, pl, topical.uid, wd.id) } : undefined,
      procedures: (['extract', 'reduce'] as const).filter((kind) => kind === 'extract' ? !!wd.foreign : !!wd.dislocated).map((kind) => { const rule = procedureDef(w, kind); return { kind, label: rule.label, error: procedureError(w, pl, rule, wd) } }),
      surgery: thread ? (['suture', 'ligate', 'tendon'] as Surgery[]).filter((kind) => kind === 'ligate' ? (wd.artery ?? 0) > 0 : kind === 'tendon' ? !!wd.tendon : !wd.suture && !wd.artery && !!def.suturable).map((kind) => {
        const rule = surgeryDef(w, kind)
        return { kind, label: rule.label, error: surgeryError(w, pl, rule, wd), cost: `${rule.count}개 실 · 바늘 · 기본${Math.ceil(rule.turns + wd.severity * rule.perSeverity)}턴` }
      }) : [],
    }
  }).sort((a, b) => b.bleed - a.bleed)
  const pen = regionPenalties(w, pl)
  return {
    parasites:(pl.parasites??[]).map(a=>{const q=parasiteRemovalQuote(w,pl,a.creature.id,'salt'),m=parasiteRemovalQuote(w,pl,a.creature.id,'manual');return{id:a.creature.id,label:a.creature.name,part:part(w,pl,a.part).label,rate:q.d!.mlPerTurn,salt:q.salt?.uid,error:q.error,manualError:m.error,saltCount:q.d!.saltCount,turns:q.turns,manualTurns:m.turns}}),
    aquatic:pl.aquatic?{...pl.aquatic}:undefined,
    scurvy:scurvyLines(w,pl),
    latentClues:latentBiteLines(w,pl),
    diseases:diseaseLines(w,pl),
    drugs: drugLines(w, pl),
    pl, bandage, bandageLabel, tourniquet, splint, disinfect, thread, canCauterize, regions, wounds, med,
    amputationParts: w.db.body(pl.body.def).parts.filter((p) => p.limb && !p.internal && !isMissing(w, pl, p.id)),
    amputationError: procedureError(w, pl, procedureDef(w, 'amputate'), undefined, amputationPart.value),
    hp: pl.hp, hpMax: hpMax(w, pl), bleed, blood, max, loss: bloodLoss(pl), toShock: eta(0.7), toDeath: eta(0.5),
    // 위험 시간 (12 §4): floor((현재 혈액 − 임계) / 총 출혈), 임계 85·70·60·50%
    timers: [['어지러움', eta(0.85)], ['쇼크 위험', eta(0.7)], ['기절', eta(0.6)], ['사망', eta(0.5)]].filter(([, t]) => t !== null) as [string, number][],
    pain: painTotal(w, pl),
    pen: [
      pen.hit ? `명중 −${Math.min(pen.hit, 25)}` : '', pen.damageMult < 1 ? `피해 ×${pen.damageMult}` : '', ARM_BLOCK[pen.leftArm] ? `방패 막기 −${ARM_BLOCK[pen.leftArm]}` : '',
      pen.per ? `지각 −${pen.per}` : '', pen.evasionCoef < 1 ? `회피 ×${pen.evasionCoef}` : '', pen.stumble ? `비틀거림 +${pen.stumble}%` : '', pen.energyMax < 1 ? `최대 기력 ×${pen.energyMax}` : '', pen.energyRegen < 1 ? `기력 회복 ×${pen.energyRegen}` : '', pen.multiTurn > 1 ? `다턴 행동 ×${pen.multiTurn}` : '',
    ].filter(Boolean),
    caps: [['의식', capacity(w, pl, 'consciousness')], ['이동', capacity(w, pl, 'moving')], ['조작', capacity(w, pl, 'manipulation')], ['시야', capacity(w, pl, 'sight')], ['호흡', capacity(w, pl, 'breathing')]] as [string, number][],
    tqs: Object.entries(pl.body.tourniquets).map(([limb, at]) => ({ limb, label: part(w, pl, limb).label, minutes: Math.floor(((turnOf(w) - at) * 3) / 60) })),
    prosthetics: {
      owned: owned.map((it) => ({ uid: it.uid, label: itemLabel(w, it) })),
      selected: selected?.uid, target,
      targets: targets.map((id) => ({ id, label: part(w, pl, id).label })),
      error: selectedRule?.appraisalRequired && !ready ? '먼저 정확한 유물 감정이 필요하다' : selected ? prostheticError(w, pl, 'install', target, selected.uid) : '설치할 의수족이 없다',
      installed: Object.entries(pl.body.prosthetics ?? {}).map(([root, state], index) => {
        const rule = w.db.get<ProstheticDef>(state.def)
        return { root, line: installedLines[index], remove: prostheticError(w, pl, 'remove', root), maintenance: !!rule.maintenanceTurns, service: prostheticError(w, pl, 'service', root), power: !!rule.powerTurns, charge: prostheticError(w, pl, 'charge', root) }
      }),
    },
    aftermath: recoveryLines(w, pl),
    tendonRepairs: (pl.body.damagedTendons ?? []).map((id) => ({ id, label: part(w, pl, id).label, error: surgeryError(w, pl, surgeryDef(w, 'tendon'), undefined, id) })),
    missing: pl.body.missing.map((m) => part(w, pl, m).label),
  }
})
const FRACTURE = { hairline: '금', simple: '단순', compound: '복합' }
const R = (r: Region) => d.value.regions.find((x) => x.r === r)!
/** 색약 대응 무늬 (12 §4): 멀쩡 빈칸 · 타박 점 · 부상 사선 · 중상 격자 · 불구 × */
const PATTERN = [
  'none',
  'radial-gradient(circle, rgba(0,0,0,.45) 1px, transparent 1.5px) 0 0/5px 5px',
  'repeating-linear-gradient(45deg, rgba(0,0,0,.45) 0 1px, transparent 1px 5px)',
  'repeating-linear-gradient(0deg, rgba(0,0,0,.45) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(0,0,0,.45) 0 1px, transparent 1px 5px)',
  'linear-gradient(45deg, transparent 45%, rgba(0,0,0,.7) 45% 55%, transparent 55%), linear-gradient(-45deg, transparent 45%, rgba(0,0,0,.7) 45% 55%, transparent 55%)',
]
const fill = (r: Region) => ({ background: PATTERN[R(r).s] === 'none' ? STATE_COLOR[R(r).s] : `${PATTERN[R(r).s]}, ${STATE_COLOR[R(r).s]}` })
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
          <div class="absolute left-1/2 top-[8px] h-[38px] w-[38px] -translate-x-1/2 rounded-full border border-black/50" :style="fill('head')" @mouseenter="rtip($event, 'head')" @mouseleave="hideTip" />
          <div class="absolute left-1/2 top-[50px] h-[70px] w-[46px] -translate-x-1/2 rounded-md border border-black/50" :style="fill('torso')" @mouseenter="rtip($event, 'torso')" @mouseleave="hideTip" />
          <div class="absolute left-[22px] top-[52px] h-[66px] w-[16px] rotate-[8deg] rounded-md border border-black/50" :style="fill('rarm')" @mouseenter="rtip($event, 'rarm')" @mouseleave="hideTip" />
          <div class="absolute right-[22px] top-[52px] h-[66px] w-[16px] -rotate-[8deg] rounded-md border border-black/50" :style="fill('larm')" @mouseenter="rtip($event, 'larm')" @mouseleave="hideTip" />
          <div class="absolute left-[50px] top-[124px] h-[82px] w-[20px] rounded-md border border-black/50" :style="fill('rleg')" @mouseenter="rtip($event, 'rleg')" @mouseleave="hideTip" />
          <div class="absolute right-[50px] top-[124px] h-[82px] w-[20px] rounded-md border border-black/50" :style="fill('lleg')" @mouseenter="rtip($event, 'lleg')" @mouseleave="hideTip" />
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
            <span v-for="[k, t] in d.timers" :key="k" :class="t < 30 ? 'text-blood-300' : ''">{{ k }}까지 ~{{ t }}턴</span>
            <span>통증 <b class="text-ash-200">{{ painLabel(d.pain) }}</b></span>
          </div>
        </div>
        <div class="grid grid-cols-5 gap-1">
          <div v-for="[k, v] in d.caps" :key="k" class="df df-tab text-center">
            <div class="text-[10px] text-ash-400">{{ k }}</div>
            <div class="font-mono" :class="v < 0.5 ? 'text-blood-300' : v < 0.85 ? 'text-amber-300' : 'text-ash-100'">{{ pct(v) }}</div>
          </div>
        </div>
        <AirPanel />
        <div v-if="d.scurvy.length" class="df df-tab p-2 text-xs" data-testid="body-scurvy"><p v-for="line in d.scurvy" :key="line">{{ line }}</p></div>
        <div v-if="d.latentClues.length" class="df df-tab p-2 text-xs" data-testid="body-bite-clues"><p v-for="line in d.latentClues" :key="line">{{ line }}</p></div>
        <div v-if="d.diseases.length" class="df df-tab p-2 text-xs" data-testid="body-diseases"><p v-for="line in d.diseases" :key="line">{{ line }}</p></div>
        <div v-if="d.aquatic" class="df df-tab p-2 text-xs" data-testid="body-aquatic">
          <p :class="d.aquatic.submerged?'text-blood-300':'text-amber-200'">{{ d.aquatic.submerged?'물속에 잠김':'수면에서 수영/호흡 회복' }} · 남은 숨 {{ Math.ceil(d.aquatic.air) }}턴 · 산소 부족 {{ d.aquatic.hypoxia }}턴</p>
          <p>물가로 나가거나 가까운 사람의 구조가 필요하다. 무거운 착용 장비를 벗어야 다시 뜰 수 있다.</p>
        </div>
        <div v-if="d.parasites.length" class="df df-tab p-2 text-xs" data-testid="body-parasites">
          <p class="text-amber-200">몸에 붙은 기생 개체</p>
          <div v-for="a in d.parasites" :key="a.id" class="mt-1" :data-parasite-id="a.id">
            <p>{{ a.label }} · {{ a.part }} · 흡혈 {{ a.rate.toFixed(2) }}ml/턴</p>
            <button class="dbtn" :disabled="!!a.error" :title="a.error ?? '원래 소금 한 단위를 완료 때 소비한다'" @click="doAct({type:'removeParasite',parasite:a.id,method:'salt',saltUid:a.salt})">소금 {{ a.saltCount }}개로 제거 · {{ a.turns }}턴</button>
            <button class="dbtn" :disabled="!!a.manualError" :title="a.manualError ?? '작은 찔린 상처가 남는다'" @click="doAct({type:'removeParasite',parasite:a.id,method:'manual'})">직접 떼기 · {{ a.manualTurns }}턴</button>
          </div>
        </div>
        <div v-if="d.drugs.length" class="df df-tab p-2 text-xs" data-testid="body-drugs"><p v-for="line in d.drugs" :key="line">{{ line }}</p></div>
        <div v-if="d.missing.length" class="text-blood-300">잃은 부위: {{ d.missing.join(', ') }}</div>
        <details v-if="d.prosthetics.owned.length || d.prosthetics.installed.length" open class="df df-tab p-2" data-testid="prosthetic-panel">
          <summary class="cursor-pointer font-title text-sm text-amber-100">의수족</summary>
          <div v-if="d.prosthetics.owned.length" class="mt-2 space-y-1">
            <label class="block text-xs">설치할 물건 <select :value="d.prosthetics.selected" aria-label="설치할 의수족" class="bg-ash-800" @change="prostheticInstallUid = Number(($event.target as HTMLSelectElement).value)"><option v-for="it in d.prosthetics.owned" :key="it.uid" :value="it.uid">{{ it.label }}</option></select></label>
            <label class="block text-xs">결손 부위 <select :value="d.prosthetics.target" aria-label="의수족 설치 부위" class="bg-ash-800" @change="prostheticPart = ($event.target as HTMLSelectElement).value"><option v-if="!d.prosthetics.targets.length" value="">설치 가능한 부위 없음</option><option v-for="p in d.prosthetics.targets" :key="p.id" :value="p.id">{{ p.label }}</option></select></label>
            <button class="dbtn" :disabled="!!d.prosthetics.error" :title="d.prosthetics.error ?? '완료 때 설치하며 중단하면 물건을 보존한다'" @click="doAct({ type: 'prosthetic', operation: 'install', part: d.prosthetics.target, uid: d.prosthetics.selected })">선택한 의수족 설치</button>
            <p v-if="d.prosthetics.error" class="text-[10px] text-ash-400">{{ d.prosthetics.error }}</p>
          </div>
          <div v-for="p in d.prosthetics.installed" :key="p.root" class="mt-2 border-t border-ash-700 pt-1" :data-testid="`prosthetic-${p.root}`">
            <p class="text-xs text-amber-100">{{ p.line }}</p>
            <div class="mt-1 flex gap-1"><button class="dbtn" :disabled="!!p.remove" :title="p.remove ?? ''" @click="doAct({ type: 'prosthetic', operation: 'remove', part: p.root })">분리</button><button v-if="p.maintenance" class="dbtn" :disabled="!!p.service" :title="p.service ?? '가죽끈1개'" @click="doAct({ type: 'prosthetic', operation: 'service', part: p.root })">가죽끈 정비</button><button v-if="p.power" class="dbtn" :disabled="!!p.charge" :title="p.charge ?? '전원셀1개'" @click="doAct({ type: 'prosthetic', operation: 'charge', part: p.root })">전원셀 교체</button></div>
          </div>
        </details>
        <div v-for="t in d.tqs" :key="t.limb" class="df df-tab flex items-center justify-between">
          <span>지혈대: {{ t.label }} · <b :class="t.minutes > 90 ? 'text-blood-300' : 'text-amber-300'">{{ t.minutes }}분</b> (120분 넘으면 괴사)</span>
          <button class="dbtn" @click="act({ type: 'removeTourniquet', limb: t.limb })">풀기</button>
        </div>
        <div class="font-title text-sm text-[#e8d7a8]">상처 {{ d.wounds.length }}개 <span class="text-xs text-ash-500">(의료 숙달 {{ d.med }}단계)</span></div>
        <div v-if="d.aftermath.length" class="space-y-1 text-xs text-amber-200" data-testid="aftermath">
          <div class="font-title text-sm">남은 후유증</div>
          <p v-for="line in d.aftermath" :key="line">{{ line }}</p>
          <div v-for="t in d.tendonRepairs" :key="t.id" class="flex items-center gap-2"><span>{{ t.label }}</span><button class="dbtn" :disabled="!d.thread || !!t.error" :title="t.error ?? '실2개·바늘·의료3단계'" @click="act({ type: 'treat', uid: d.thread!.uid, limb: t.id, procedure: 'tendon' })">힘줄 봉합</button><span v-if="t.error" class="text-[10px] text-ash-400">{{ t.error }}</span></div>
        </div>
        <p v-if="!d.wounds.length" class="text-ash-500">새 상처가 없다.</p>
        <ul class="space-y-1.5" data-testid="wounds">
          <li v-for="x in d.wounds" :key="x.wd.id" class="df df-tab" :data-testid="`wound-${x.wd.id}`">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div :class="x.bleed > 5 ? 'text-blood-300' : 'text-ash-100'">{{ x.label }} <span class="text-[10px] text-ash-500">[{{ x.region }}]</span></div>
                <div class="text-[10px] text-ash-500">{{ x.source }} · 심각도 {{ x.sev.toFixed(0) }} · 치유 {{ pct(x.healPct) }}</div>
              </div>
              <div class="shrink-0 font-mono" :class="x.bleed > 5 ? 'text-blood-300' : 'text-ash-400'">{{ x.bleed > 0.05 ? x.bleed.toFixed(1) + 'ml' : '' }}</div>
            </div>
            <div v-if="x.tags.length" class="mt-0.5 flex flex-wrap gap-1">
              <span v-for="t in x.tags" :key="t" class="rounded-sm bg-black/40 px-1 text-[10px]" :class="t === '동맥' || t.startsWith('감염') ? 'text-blood-300' : 'text-ash-200'">{{ t }}</span>
            </div>
            <div v-if="!x.hidden" class="mt-1 flex flex-wrap gap-1">
              <button v-for="op in x.procedures" :key="op.kind" class="dbtn" :disabled="!!op.error" :title="op.error ?? ''" @click="act({ type: 'procedure', procedure: op.kind, woundId: x.wd.id })">{{ op.label }}</button>
              <button v-for="op in x.surgery" :key="op.kind" class="dbtn" :disabled="!!op.error" :title="op.error ?? op.cost" @click="act({ type: 'treat', uid: d.thread!.uid, woundId: x.wd.id, procedure: op.kind })">{{ op.label }}</button>
              <button v-if="d.bandage && !x.wd.internal && (!x.wd.bandage || x.wd.bandage.dirty)" class="dbtn" @click="act({ type: 'treat', uid: d.bandage.uid, woundId: x.wd.id })">{{ d.bandageLabel }}</button>
              <button v-if="x.bleed > 0.3" class="dbtn" @click="act({ type: 'press', woundId: x.wd.id })">압박</button>
              <button v-if="d.tourniquet && x.limb && x.bleed > 0.3 && d.pl.body.tourniquets[x.limb] === undefined" class="dbtn" @click="act({ type: 'treat', uid: d.tourniquet.uid, woundId: x.wd.id })">지혈대</button>
              <button v-if="d.canCauterize && (x.wd.bleed > 0 || x.wd.artery || x.preventable) && !x.wd.internal && !x.wd.cauterized" class="dbtn" @click="act({ type: 'cauterize', woundId: x.wd.id })">소작</button>
              <button v-if="d.splint && x.wd.fracture && (!x.wd.splint || x.wd.splint.half)" class="dbtn" @click="act({ type: 'treat', uid: d.splint.uid, woundId: x.wd.id })">부목</button>
              <button v-if="x.topical && !x.wd.internal" class="dbtn" :disabled="!!x.topical.error" :title="x.topical.error ?? undefined" @click="doAct({ type: 'medicate', uid: x.topical.uid, woundId: x.wd.id })">{{ x.topical.label }} 바르기</button>
              <button v-if="d.disinfect && x.wd.contam > 5 && !x.wd.cauterized" class="dbtn" @click="act({ type: 'treat', uid: d.disinfect.uid, woundId: x.wd.id })">술로 소독</button>
            </div>
          </li>
        </ul>
        <details class="df df-tab text-xs" data-testid="amputation-panel">
          <summary class="cursor-pointer text-blood-300">사지 절단</summary>
          <p class="my-1 text-ash-400">선택한 부위와 그 아래를 영구적으로 잃습니다. 먼저 상완·대퇴에 지혈대를 감아야 합니다. 절단면 상처와 극심한 통증이 남습니다.</p>
          <select v-model="amputationPart" aria-label="절단 부위" class="bg-ash-900" @change="confirmAmputation = false"><option value="">부위 선택</option><option v-for="p in d.amputationParts" :key="p.id" :value="p.id">{{ p.label }}</option></select>
          <label class="ml-2"><input v-model="confirmAmputation" type="checkbox" aria-label="부위 상실 확인"> 부위를 잃는 것을 확인</label>
          <button class="dbtn ml-1" :disabled="!!d.amputationError || !confirmAmputation" :title="d.amputationError ?? '기본60턴·칼날'" @click="act({ type: 'procedure', procedure: 'amputate', part: amputationPart }); confirmAmputation = false">선택 부위 절단</button>
          <p v-if="d.amputationError" class="mt-1 text-ash-400">{{ d.amputationError }}</p>
        </details>
      </div>
    </div>
  </Win>
</template>
