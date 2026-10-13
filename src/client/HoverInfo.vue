<script setup lang="ts">
import { computed } from 'vue'
import {
  canReach, cheb, creatureAt, itemLabel, observedCondition, player, previewHit, mainWeapon, itemDef, lightAt,
  type Pos, type World,
} from '../core'
import { version, world } from './store'

const props = defineProps<{ pos: Pos | null; detail: boolean }>()

const d = computed(() => {
  void version.value
  const w = world.value as World
  if (!props.pos) return null
  const p = props.pos
  const i = p.y * w.s.map.w + p.x
  const tile = w.s.map.tiles[i]
  const visible = w.s.visible.includes(i)
  if (!tile.seen && !visible) return { title: '미탐색', lines: [] as string[], hit: null }
  const terr = w.db.terrain(tile.t)
  const lines: string[] = []
  let title = terr.label
  if (terr.description) lines.push(terr.description)
  if (tile.roof) lines.push('지붕 아래 (비를 피함, 어둡다)')
  if (terr.container) lines.push(tile.searched ? '이미 뒤졌다' : '뒤질 수 있다 (S)')
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
      const known = w.s.knowledge.bestiary[c.def]
      title = c.alive ? c.name : `${c.name}의 시체`
      if (c.alive) {
        lines.unshift(...observedCondition(w, c))
        const ai: Record<string, string> = { idle: '가만히 있다', wander: '어슬렁거린다', hunt: '당신을 노린다', investigate: '무언가를 찾는다', flee: '달아난다', eat: '먹고 있다', surrender: '항복했다' }
        lines.unshift(ai[c.ai.mode] ?? '')
        if (known?.killed) lines.push(`(도감) 무장: ${mainWeapon(w, c) ? itemDef(w, mainWeapon(w, c)!).label : '이빨·발톱'}`)
        const ranged = !!mainWeapon(w, pl) && !!itemDef(w, mainWeapon(w, pl)!).ranged && cheb(pl.pos, c.pos) > 1
        const pv = previewHit(w, pl, c, ranged)
        if (pv) hit = { chance: pv.chance, lines: pv.lines, reach: ranged || canReach(w, pl, c) }
      }
    }
  }
  return { title, lines, hit }
})
</script>

<template>
  <div v-if="d" class="panel pointer-events-none max-w-xs p-2 text-xs shadow-lg" data-testid="hover">
    <div class="text-sm text-ash-100">{{ d.title }}</div>
    <div v-for="(l, i) in d.lines" :key="i" class="text-ash-300">{{ l }}</div>
    <div v-if="d.hit" class="mt-1 border-t border-ash-700 pt-1">
      <span class="text-amber-200">명중 {{ d.hit.chance.toFixed(0) }}%</span>
      <span v-if="!d.hit.reach" class="text-ash-500"> (닿지 않음)</span>
      <span v-if="!detail" class="text-ash-500"> · Shift: 공식</span>
      <div v-if="detail" class="mt-0.5 font-mono text-[11px] text-ash-400">
        <div v-for="(l, i) in d.hit.lines" :key="i">{{ l }}</div>
      </div>
    </div>
  </div>
</template>
