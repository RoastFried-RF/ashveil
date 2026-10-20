<script setup lang="ts">
import {mapVisibility,terrainAppearance,displayTile} from './map-memory'
// 맵 위 커서 정보: 지형·물건·생물(상태·체력·명중률). Shift: 명중 공식
import { computed } from 'vue'
import {
  maneuverQuote, throwQuote, bestiaryEntry, bestiaryStage, bestiaryDetails, knownCreatureName, canReach, cheb, creatureAt, fmtClock, hpMax, innBedAt, residentBedAt, itemDef, itemLabel, lightAt, mainWeapon, observedCondition, player, previewHit, turnOf,
  type Pos, type World,
} from '../core'
import { version, world } from './store'
import { targeting } from './ui'
import { machineStatus } from '../core/machines'
import {cultivationStatus} from '../core/cultivation'

const props = defineProps<{ pos: Pos | null; detail: boolean }>()
const AI: Record<string, string> = { idle: '가만히 있다', wander: '어슬렁거린다', hunt: '당신을 노린다', investigate: '무언가를 찾는다', flee: '달아난다', eat: '먹고 있다', surrender: '항복했다', guard: '자리를 지킨다', return: '제자리로 돌아간다' }

const d = computed(() => {
  void version.value
  const w = world.value as World
  if (!props.pos) return null
  const p = props.pos
  const i = p.y * w.s.map.w + p.x
  const visible=mapVisibility(w).has(i),id=terrainAppearance(w,i,new Set(visible?[i]:[]))
  if(!id)return { title: '미탐색', lines: [] as string[], hit: null, hp: null as null | [number, number] }
  const tile=displayTile(w.s.map.tiles[i]!,id,visible)
  const terr=w.db.terrain(id)
  const lines: string[] = []
  let title = terr.label
  let hp: [number, number] | null = null
  if (terr.description) lines.push(terr.description)
  if (visible && terr.residentWell) lines.push('곁에서 N: 물 마시기·물병 채우기')
  if (terr.container) lines.push(visible?(tile.searched?'이미 뒤졌다 (다시 열기: S)':'뒤질 수 있다 (곁에서 S)'):'현재 내용·개폐 상태는 보이지 않는다')
  if (visible&&terr.stairs) lines.push(`${w.s.map.links.find((l) => l.pos.x === p.x && l.pos.y === p.y)?.label ?? ''} — 위에 서서 > 또는 <`)
  if (tile.room !== undefined && w.s.map.rooms[tile.room]?.discovered) lines.push(`(${w.s.map.rooms[tile.room].name})`)
  if (visible) {
    const bed = innBedAt(w, p)
    if (residentBedAt(w, p)) lines.push('주민 개인 침대 · 손님은 여관 침대를 빌려야 한다')
    if (bed) lines.push(bed.lease?.tenant === w.s.playerId && bed.lease.until > turnOf(w) ? `빌린 침대 · ${fmtClock(bed.lease.until)}까지 · Z 수면` : '여관 침대 · 주인 곁에서 N으로 대여')
    lines.push(`밝기 ${Math.round(lightAt(w, p) * 100)}%`)
    if(tile.cultivation){const crop=cultivationStatus(w,p)!;lines.push(`성장${crop.progress}% · 관수${Math.round(crop.waterMl*100)/100}ml · 증발 최대${crop.evaporationMlPerHour}ml/시간 · ${crop.ready?'수확 가능':crop.error??'자라는 중'}`);if(crop.rule?.substrate)lines.push(`배지 수확 ${crop.state.remainingCycles}/${crop.rule.substrate.cycles}회 남음`);if(crop.state.ownerId&&crop.state.ownerId!==player(w).id)lines.push('타인이 심은 밭');if(crop.state.irrigation)lines.push('관수에서 옮은 오염 · 수확물에 남는다')}
    if(terr.gather&&!tile.cultivation&&(tile.gatherAt??0)>turnOf(w))lines.push(`다음 수확까지 ${Math.ceil((tile.gatherAt!-turnOf(w))/1200)}시간`)
    if (tile.blood > 4) lines.push(tile.blood > 120 ? '피 웅덩이' : '핏자국')
    if (tile.items.length) lines.push('물건: ' + tile.items.map((it) => itemLabel(w, it)).join(', '))
  } else lines.push(tile.observed?`(기억 속의 모습 · 관찰 ${fmtClock(tile.observed.at)})`:'(기억 속의 모습 · 관찰 시각 미기록)')
  let hit: { chance: number; lines: string[]; reach: boolean;label?:string } | null = null
  const c = visible ? creatureAt(w, p, true) : undefined
  if (c) {
    const pl = player(w)
    if (c.id === pl.id) title = `${c.name} (당신)`
    else {
      const name=knownCreatureName(w,c),entry=bestiaryEntry(w,c.def),stage=entry?bestiaryStage(w,c.def):1
      title = c.alive ? name : `${name}의 시체`
      if (c.alive) {
        hp = [Math.max(0, c.hp), hpMax(w, c)]
        if(c.body.machine&&cheb(pl.pos,c.pos)<=1)lines.push(...machineStatus(w,c).slice(0,2))
        lines.unshift(...observedCondition(w, c))
        lines.unshift(c.asleep ? '잠들어 있다 — 기습하면 95%·피해 ×1.5' : AI[c.ai.mode] ?? '')
        if(entry)lines.push(...bestiaryDetails(w,c.def).slice(0,3))
        if (stage>=2) lines.push(`(도감) 무장: ${mainWeapon(w, c) ? itemDef(w, mainWeapon(w, c)!).label : '맨몸'}`)
        const aim = targeting.value
        if (aim?.kind === 'throw') {
          const quote = throwQuote(w, pl, aim.uid!, c.id)
          if (quote.preview) hit = { chance: quote.preview.chance, lines: quote.preview.lines, reach: true }
          else if (quote.error) lines.push(quote.error)
        } else if (aim?.kind === 'trip' || aim?.kind === 'disarm') {
          const quote=maneuverQuote(w,pl,aim.kind,c.id)
          if(!quote.error)hit={chance:quote.chance!,lines:quote.lines??[],reach:true,label:aim.label+' 성공'}
          else lines.push(quote.error)
        } else {
          const ranged = !!mainWeapon(w, pl) && !!itemDef(w, mainWeapon(w, pl)!).ranged && cheb(pl.pos, c.pos) > 1
          const pv = previewHit(w, pl, c, ranged)
          if (pv) hit = { chance: pv.chance, lines: pv.lines, reach: ranged || canReach(w, pl, c) }
        }
      }
    }
  }
  return { title, lines, hit, hp }
})
</script>

<template>
  <div v-if="d" class="df df-celtic pointer-events-none max-w-xs text-xs" data-testid="hover">
    <div class="font-title text-sm font-bold text-[#e8d7a8]">{{ d.title }}</div>
    <div v-if="d.hp" class="my-1 h-1.5 w-full bg-black/60"><div class="h-full bg-[#b83a2a]" :style="{ width: (d.hp[0] / d.hp[1]) * 100 + '%' }" /></div>
    <div v-for="(l, i) in d.lines" :key="i" class="text-ash-300">{{ l }}</div>
    <div v-if="d.hit" class="mt-1 border-t border-[#4a4436] pt-1">
      <span class="font-bold text-amber-200">{{ d.hit.label ?? '명중' }} {{ d.hit.chance.toFixed(0) }}%</span>
      <span v-if="!d.hit.reach" class="text-ash-500"> (닿지 않음)</span>
      <span v-if="!detail" class="text-ash-500"> · Shift: 공식</span>
      <div v-if="detail" class="mt-0.5 font-mono text-[11px] text-ash-400"><div v-for="(l, i) in d.hit.lines" :key="i">{{ l }}</div></div>
    </div>
  </div>
</template>
