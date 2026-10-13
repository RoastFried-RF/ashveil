<script setup lang="ts">
// 맵 위 커서 정보: 지형·물건·생물(상태·체력·명중률). Shift: 명중 공식
import { computed } from 'vue'
import {
  canReach, cheb, creatureAt, hpMax, itemDef, itemLabel, lightAt, mainWeapon, observedCondition, player, previewHit, terrainAt,
  type Pos, type World,
} from '../core'
import { version, world } from './store'

const props = defineProps<{ pos: Pos | null; detail: boolean }>()
const AI: Record<string, string> = { idle: '가만히 있다', wander: '어슬렁거린다', hunt: '당신을 노린다', investigate: '무언가를 찾는다', flee: '달아난다', eat: '먹고 있다', surrender: '항복했다', guard: '자리를 지킨다', return: '제자리로 돌아간다' }

const d = computed(() => {
  void version.value
  const w = world.value as World
  if (!props.pos) return null
  const p = props.pos
  const i = p.y * w.s.map.w + p.x
  const tile = w.s.map.tiles[i]
  const visible = w.s.visible.includes(i)
  if (!tile.seen && !visible) return { title: '미탐색', lines: [] as string[], hit: null, hp: null as null | [number, number] }
  const terr = terrainAt(w, p)
  const lines: string[] = []
  let title = terr.label
  let hp: [number, number] | null = null
  if (terr.description) lines.push(terr.description)
  if (terr.container) lines.push(tile.searched ? '이미 뒤졌다 (다시 열기: S)' : '뒤질 수 있다 (곁에서 S)')
  if (terr.stairs) lines.push(`${w.s.map.links.find((l) => l.pos.x === p.x && l.pos.y === p.y)?.label ?? ''} — 위에 서서 > 또는 <`)
  if (tile.room !== undefined && w.s.map.rooms[tile.room]?.discovered) lines.push(`(${w.s.map.rooms[tile.room].name})`)
  if (visible) {
    lines.push(`밝기 ${Math.round(lightAt(w, p) * 100)}%`)
    if (tile.blood > 4) lines.push(tile.blood > 120 ? '피 웅덩이' : '핏자국')
    if (tile.items.length) lines.push('물건: ' + tile.items.map((it) => itemLabel(w, it)).join(', '))
  } else lines.push('(기억 속의 모습)')
  let hit: { chance: number; lines: string[]; reach: boolean } | null = null
  const c = visible ? creatureAt(w, p, true) : undefined
  if (c) {
    const pl = player(w)
    if (c.id === pl.id) title = `${c.name} (당신)`
    else {
      title = c.alive ? `${c.name}` : `${c.name}의 시체`
      if (c.alive) {
        hp = [Math.max(0, c.hp), hpMax(w, c)]
        lines.unshift(...observedCondition(w, c))
        lines.unshift(c.asleep ? '잠들어 있다 — 기습하면 95%·피해 ×1.5' : AI[c.ai.mode] ?? '')
        const known = w.s.knowledge.bestiary[c.def]
        if (known?.killed) lines.push(`(도감) 무장: ${mainWeapon(w, c) ? itemDef(w, mainWeapon(w, c)!).label : '맨몸'}`)
        const ranged = !!mainWeapon(w, pl) && !!itemDef(w, mainWeapon(w, pl)!).ranged && cheb(pl.pos, c.pos) > 1
        const pv = previewHit(w, pl, c, ranged)
        if (pv) hit = { chance: pv.chance, lines: pv.lines, reach: ranged || canReach(w, pl, c) }
      }
    }
  }
  return { title, lines, hit, hp }
})
</script>

<template>
  <div v-if="d" class="df df-celtic pointer-events-none !border-[10px] max-w-xs text-xs" data-testid="hover">
    <div class="font-title text-sm font-bold text-[#e8d7a8]">{{ d.title }}</div>
    <div v-if="d.hp" class="my-1 h-1.5 w-full bg-black/60"><div class="h-full bg-[#b83a2a]" :style="{ width: (d.hp[0] / d.hp[1]) * 100 + '%' }" /></div>
    <div v-for="(l, i) in d.lines" :key="i" class="text-ash-300">{{ l }}</div>
    <div v-if="d.hit" class="mt-1 border-t border-[#4a4436] pt-1">
      <span class="font-bold text-amber-200">명중 {{ d.hit.chance.toFixed(0) }}%</span>
      <span v-if="!d.hit.reach" class="text-ash-500"> (닿지 않음)</span>
      <span v-if="!detail" class="text-ash-500"> · Shift: 공식</span>
      <div v-if="detail" class="mt-0.5 font-mono text-[11px] text-ash-400"><div v-for="(l, i) in d.hit.lines" :key="i">{{ l }}</div></div>
    </div>
  </div>
</template>
