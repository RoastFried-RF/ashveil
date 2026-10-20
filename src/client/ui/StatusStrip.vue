<script setup lang="ts">
// 좌상단: 장소·시각·날씨 + 6부위 미니 인형 + 상태 이상 칩 (한눈 보기)
import { computed } from 'vue'
import {
  hallucinating, dietStatus, hungerBand, hungerStage, thirstBand, thirstStage, nutritionDef,
  ambientTemp, bloodLoss, fmtClock, LIGHT_LABEL, lightLevel, mood, painLabel, painTotal, player, regionState, totalBleed, turnOf,
  REGION_LABEL, STATE_LABEL, calendar, weatherLabel, type Region, type World,
} from '../../core'
import { STATE_COLOR } from '../info'
import { version, world } from '../store'
import { hideTip, showTip, toggleWin } from '../ui'

const EFFECT: Record<string, [string, string]> = {
  painkiller: ['진통', '#a0c0a0'], analgesic: ['마취', '#a0c0a0'], alcohol: ['취기', '#d0a060'], stimulant: ['각성', '#e0d070'],
  antibiotic: ['항생', '#90c0d0'], sedative: ['진정', '#a0a0d0'], dysentery: ['이질', '#c08040'], foodPoisoning: ['식중독', '#c08040'], lice: ['이', '#c08040'],
  withdrawal: ['금단', '#c06060'], shock: ['쇼크', '#e05050'], stunned: ['기절', '#f0e070'], panic: ['공황', '#e07070'],
  breath: ['호흡 고르기', '#a0d0c0'], parryStance: ['받아넘기기 자세', '#e0c070'], spearWall: ['창벽', '#e0c070'],
  knockedDown: ['넘어짐', '#e0a050'], spores: ['포자', '#a0c060'],
}

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const n = pl.needs
  const turn = turnOf(w)
  const diet=dietStatus(w,pl)
  const chips: { t: string; c: string; tip: string[] }[] = []
  if(hallucinating(w,pl))chips.push({t:'환각',c:'#c090c0',tip:['잠 부족으로 지각이 흐려졌다. 충분한 수면으로 부채를 갚아야 한다.']})
  if(diet.active)chips.push({t:'살코기 굶주림',c:'#c08040',tip:['최근'+diet.windowDays+'일 식사 중 단백질 열량 '+(diet.fraction*100).toFixed(1)+'%','설사 · 열량 흡수 ×'+diet.absorption+' · 수분 소모 증가']})
  if (pl.breakdown) chips.push({ t: `붕괴: ${w.db.get(pl.breakdown.def).label}`, c: '#d080b0', tip: [`${Math.max(0, pl.breakdown.until - turn)}턴 남음`] })
  for (const d of pl.diseases ?? []) if (d.incubatesUntil<=turn&&d.immunity<100) chips.push({ t: w.db.get(d.def).label ?? '질병', c: '#c0a060', tip: [`진행 ${d.progress.toFixed(0)} · 면역 ${d.immunity.toFixed(0)}`] })
  if (Object.values(pl.frostbite ?? {}).some((f) => f.grade > 0)) chips.push({ t: '동상', c: '#80a0d0', tip: ['따뜻한 곳으로 피하고 손발을 보호해야 한다.'] })
  const bleed = totalBleed(w, pl)
  if (bleed > 0.3) chips.push({ t: `출혈 ${bleed.toFixed(1)}`, c: bleed > 6 ? '#ff4a3a' : '#d06050', tip: [`턴(3초)당 ${bleed.toFixed(1)} ml 흘린다`, '신체(B)에서 붕대·압박·지혈대'] })
  const loss = bloodLoss(pl)
  if (loss > 0.12) chips.push({ t: `실혈 ${Math.round(loss * 100)}%`, c: loss > 0.3 ? '#ff4a3a' : '#d08070', tip: ['30% 쇼크 · 50% 사망'] })
  const pain = painTotal(w, pl)
  if (pain > 15) chips.push({ t: `통증: ${painLabel(pain)}`, c: pain > 60 ? '#e06050' : '#d0a070', tip: ['명중·의식에 벌칙'] })
  if (hungerStage(w, pl) >= 1) chips.push({ t: hungerBand(w, pl).label, c: hungerStage(w, pl) >= 2 ? '#e06050' : '#d0b070', tip: [`칼로리 균형 ${Math.round(n.kcal)} kcal`] })
  if (thirstStage(w, pl) >= 1) chips.push({ t: thirstBand(w, pl).label, c: thirstStage(w, pl) >= 2 ? '#e06050' : '#80b0d0', tip: [`수분 결손 ${Math.round(n.waterDeficit)} ml`] })
  if (n.protein < nutritionDef(w).lowProtein) chips.push({ t: '단백 부족', c: '#d0b070', tip: [`단백 상태 ${n.protein.toFixed(0)} /100`, '기력 회복·치유·면역 감소'] })
  if (n.vitamin < nutritionDef(w).lowVitamin) chips.push({ t: '비타민 부족', c: '#d0b070', tip: [`비타민 ${n.vitamin.toFixed(0)} /100`, '피로 회복 감소'] })
  if (n.scurvy > 0) chips.push({ t: '괴혈병', c: '#e06050', tip: [`진행 ${n.scurvy.toFixed(0)}/100`, '비타민이 필요하다'] })
  if ((n.sleepDebt ?? 0) > 0) chips.push({ t: `수면 부채 ${(n.sleepDebt ?? 0).toFixed(1)}h`, c: '#b0a0d0', tip: ['피로를 다 풀고 더 자야 갚는다.', '8시간부터 10분마다 미세수면 위험'] })
  if (n.fatigue > 60) chips.push({ t: n.fatigue > 85 ? '탈진' : '피로', c: n.fatigue > 85 ? '#e06050' : '#b0a0c0', tip: [`피로 ${n.fatigue.toFixed(0)} — Z: 잠자기`] })
  if (n.bodyTemp < 36) chips.push({ t: n.bodyTemp < 35 ? '저체온' : '추위', c: '#80b0e0', tip: [`체온 ${n.bodyTemp.toFixed(1)}°C`] })
  if (n.wetness > 40) chips.push({ t: `젖음 ${n.wetness.toFixed(0)}%`, c: '#80a0c0', tip: ['단열이 떨어진다'] })
  if (pl.body.wounds.some((x) => x.infection)) chips.push({ t: '감염', c: '#c0d050', tip: ['소독·항생제·휴식'] })
  if (pl.body.wounds.some((x) => x.fracture && !x.splint)) chips.push({ t: '골절', c: '#e0c0a0', tip: ['부목으로 고정'] })
  if (Object.keys(pl.body.tourniquets).length) chips.push({ t: '지혈대', c: '#e0a040', tip: ['2시간 넘기면 괴사'] })
  if (lightLevel(w, pl.pos) >= 2) chips.push({ t: LIGHT_LABEL[lightLevel(w, pl.pos)], c: '#8890a0', tip: ['내 칸이 어두우면 상대 명중 −15(어둠) · −30(칠흑)', '등불(T)을 켜면 반경 5가 밝음'] })
  if (pl.sneaking) chips.push({ t: '잠행', c: '#9fb3c8', tip: ['이동이 느리고 눈에 덜 띈다', '잠든 적 기습 ×1.5'] })
  if (mood(w, pl) < 25) chips.push({ t: '절망', c: '#a080a0', tip: ['기분이 바닥이다'] })
  if ((n.ash ?? 0) >= 30) chips.push({ t: (n.ash ?? 0) >= 60 ? '재·신장 위험' : '재 체기', c: '#c08040', tip: [`재 축적${(n.ash ?? 0).toFixed(1)} · 칼로리 흡수×0.9 · 매일1 감소`] })
  for (const e of pl.effects) if (e.untilTurn > turn && EFFECT[e.kind]) chips.push({ t: EFFECT[e.kind][0], c: EFFECT[e.kind][1], tip: e.kind === 'lice' ? ['몸을 씻으면 제거된다. 수면 질×0.9·기분−3'] : [`${Math.ceil(e.untilTurn - turn)}턴 남음`] })
  const regions = (['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg'] as Region[]).map((r) => ({ r, s: regionState(w, pl, r) }))
  return {
    name: w.s.map.name, depth: w.s.map.depth, clock: fmtClock(turn), weather: (w.s.overworld ? `${calendar(w).season.label}${calendar(w).seasonDay}일 · ` : '') + weatherLabel(w),
    temp: ambientTemp(w, pl.pos), surface: w.s.map.kind === 'surface', chips, regions,
  }
})

function regionTip(e: MouseEvent, r: Region, s: number) {
  showTip(e, `${REGION_LABEL[r]}: ${STATE_LABEL[s]}`, [
    { head: '머리 → 명중·의식', torso: '몸통 → 기력 회복', larm: '왼팔 → 방패 막기', rarm: '오른팔 → 명중·피해', lleg: '왼다리 → 회피·비틀거림', rleg: '오른다리 → 회피·비틀거림' }[r],
    '클릭: 신체 창',
  ])
}
const R = (r: string) => d.value.regions.find((x) => x.r === r)!.s
const bodyLabel = computed(() => `신체 상태: ${d.value.regions.map(r => `${REGION_LABEL[r.r]} ${STATE_LABEL[r.s]}`).join(', ')}. 클릭해서 신체 창 열기`)

// 작은 신체도도 떠돌이와 같은 후드·겹친 흉갑·장갑·장화의 실루엣을 쓴다.
// 화면 왼쪽 팔다리는 인물의 오른쪽이다. 각 경로가 독립적인 상태/호버 영역이다.
const BODY_REGIONS: { region: Region; shape: string; detail: string }[] = [
  { region: 'rleg', shape: 'M15 36H19L18 47 17 53V57H10V54L13 51 14 44Z', detail: 'M16 39 15 47M13 52H17M11 55H16' },
  { region: 'lleg', shape: 'M21 36H25L26 44 27 51 30 54V57H23V53L22 47Z', detail: 'M24 39 25 47M23 52H27M24 55H29' },
  { region: 'rarm', shape: 'M10 18 15 19 13 28 12 32 11 38H7L6 34 7 28Z', detail: 'M10 22 9 28M8 31 12 32M8 35H10' },
  { region: 'larm', shape: 'M25 19 30 18 33 28 34 34 33 38H29L28 32 27 28Z', detail: 'M30 22 31 28M28 32 32 31M30 35H32' },
  { region: 'torso', shape: 'M16 17 20 16 24 17 27 20 25 29 26 35 23 38H17L14 35 15 29 13 20Z', detail: 'M17 20 20 22 23 20M17 24H23M16 30H24M16 33H24M20 24V29' },
  { region: 'head', shape: 'M15 7 18 4H22L25 7 26 13 23 17H17L14 13Z', detail: 'M17 9 20 7 23 9V13L20 15 17 13ZM18 11H22' },
]
</script>

<template>
  <div class="pointer-events-auto flex items-start gap-2" data-testid="status-strip">
    <div class="df df-olive min-w-[180px]">
      <div class="font-title text-[15px] font-bold leading-tight text-[#e8d7a8]" data-testid="location">{{ d.name }}<span v-if="d.depth" class="ml-1 text-xs text-ash-400">지하 {{ d.depth }}층</span></div>
      <div class="text-[11px] text-ash-300">{{ d.clock }} · <template v-if="d.surface">{{ d.weather }} · </template>{{ d.temp.toFixed(0) }}°C</div>
    </div>
    <button class="df df-slot mini-body relative h-[64px] w-[44px] shrink-0" data-testid="mini-body" :aria-label="bodyLabel" @click="toggleWin('body')">
      <svg class="mini-body-drawing" viewBox="0 0 40 62" fill="none" aria-hidden="true">
        <defs><pattern id="mini-body-injury" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M-1 1 1-1M0 3 3 0M2 4 4 2" stroke="#f1d9b3" stroke-width=".65" opacity=".6" /></pattern></defs>
        <path d="M20 2V60M4 19H36M4 38H36M11 59H29" stroke="#8fa181" stroke-width=".5" opacity=".18" pointer-events="none" />
        <path d="M4 5V2H8M32 2H36V5M4 57V60H8M32 60H36V57" stroke="#ab9b70" stroke-width=".6" opacity=".5" pointer-events="none" />
        <g v-for="part in BODY_REGIONS" :key="part.region" class="body-region" :data-body-region="part.region" :data-state="R(part.region)" @mouseenter="regionTip($event, part.region, R(part.region))" @mouseleave="hideTip">
          <path :d="part.shape" :fill="STATE_COLOR[R(part.region)]" stroke="#b8c2a0" stroke-opacity=".48" stroke-width=".65" stroke-linejoin="round" />
          <path :d="part.detail" stroke="#f0e6bf" stroke-width=".7" stroke-linejoin="round" opacity=".48" pointer-events="none" />
          <path v-if="R(part.region) > 0" :d="part.shape" fill="url(#mini-body-injury)" :opacity="R(part.region) > 2 ? .85 : .45" pointer-events="none" />
        </g>
      </svg>
    </button>
    <div class="flex max-w-[46vw] flex-wrap gap-1" data-testid="status-chips">
      <span v-for="c in d.chips" :key="c.t" class="df df-tab cursor-default px-1 text-[11px] font-bold leading-4" :style="{ color: c.c }" @mouseenter="showTip($event, c.t, c.tip)" @mouseleave="hideTip">{{ c.t }}</span>
    </div>
  </div>
</template>

<style scoped>
.mini-body { display: grid; place-items: center; cursor: pointer; box-shadow: inset 0 0 12px #0008; }
.mini-body-drawing { display: block; width: 40px; height: 60px; }
.body-region { cursor: help; }
.body-region:hover > path:first-child { stroke: #f2dba0; stroke-opacity: 1; stroke-width: 1; filter: brightness(1.25); }
</style>
