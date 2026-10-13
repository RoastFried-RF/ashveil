<script setup lang="ts">
import { computed } from 'vue'
import { isEquipped, itemDef, itemLabel, player, terrainAt, DIRS, inBounds, type ItemInst, type World } from '../core'
import { act, version, world } from './store'

const emit = defineEmits<{ throw: [uid: number]; hint: [msg: string] }>()

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const nearWater = [{ x: 0, y: 0 }, ...DIRS].some((dd) => {
    const p = { x: pl.pos.x + dd.x, y: pl.pos.y + dd.y }
    return inBounds(w, p) && !!terrainAt(w, p).water
  })
  const groups: Record<string, { it: ItemInst; label: string; eq: boolean; def: ReturnType<typeof itemDef> }[]> = {}
  const order = ['weapon', 'shield', 'apparel', 'medical', 'drug', 'food', 'drink', 'tool', 'ammo', 'misc']
  for (const it of pl.inventory) {
    const def = itemDef(w, it)
    ;(groups[def.category] ??= []).push({ it, label: itemLabel(w, it), eq: isEquipped(pl, it.uid), def })
  }
  const floor = w.s.map.tiles[pl.pos.y * w.s.map.w + pl.pos.x].items.map((it) => ({ it, label: itemLabel(w, it) }))
  return { groups: order.filter((o) => groups[o]).map((o) => ({ cat: o, items: groups[o] })), floor, nearWater, w }
})

const CAT: Record<string, string> = {
  weapon: '무기', shield: '방패', apparel: '의복·방어구', medical: '의료', drug: '약', food: '음식', drink: '마실 것', tool: '도구', ammo: '탄약', misc: '기타',
}

function use(x: { it: ItemInst; def: ReturnType<typeof itemDef> }) {
  const def = x.def
  if (def.medical && def.medical.kind !== 'disinfect') { emit('hint', '치료 도구는 신체 탭에서 상처를 골라 쓴다.'); return }
  if (def.food || def.drink || def.drug || def.unidentified) act({ type: 'consume', uid: x.it.uid })
  else if (def.light) act({ type: 'toggleLight', uid: x.it.uid })
}
</script>

<template>
  <div class="space-y-3 text-xs" data-testid="inventory-panel">
    <div v-if="d.floor.length" class="rounded border border-amber-700/50 bg-ash-800/60 p-1.5">
      <div class="mb-1 flex items-center justify-between text-amber-200">
        <span>발밑</span>
        <button class="btn" @click="act({ type: 'pickup' })">모두 줍기 <kbd>G</kbd></button>
      </div>
      <div v-for="f in d.floor" :key="f.it.uid" class="flex items-center justify-between py-0.5">
        <span>{{ f.label }}</span>
        <button class="btn" @click="act({ type: 'pickup', uid: f.it.uid })">줍기</button>
      </div>
    </div>
    <div v-for="g in d.groups" :key="g.cat">
      <div class="mb-0.5 text-ash-400">{{ CAT[g.cat] }}</div>
      <div v-for="x in g.items" :key="x.it.uid" class="flex items-center justify-between gap-1 border-b border-ash-800 py-1">
        <span :class="x.eq ? 'text-amber-200' : 'text-ash-100'" :title="x.def.description">
          {{ x.eq ? '◆ ' : '' }}{{ x.label }}
          <span v-if="x.it.durability !== undefined && x.def.apparel" class="text-ash-500">{{ Math.round((x.it.durability / x.def.apparel.durability) * 100) }}%</span>
          <span v-if="x.it.fuel !== undefined" class="text-ash-500">기름 {{ Math.round((x.it.fuel * 3) / 60) }}분</span>
        </span>
        <span class="flex shrink-0 gap-1">
          <button v-if="x.def.apparel || x.def.category === 'weapon' || x.def.category === 'shield'" class="btn" @click="act(x.eq ? { type: 'unequip', uid: x.it.uid } : { type: 'equip', uid: x.it.uid })">{{ x.eq ? '해제' : '장착' }}</button>
          <button v-if="x.def.food || x.def.drink || x.def.drug || x.def.unidentified || x.def.light" class="btn" @click="use(x)">{{ x.def.light ? (x.it.lit ? '끄기' : '켜기') : x.def.food ? '먹기' : x.def.drink ? '마시기' : '삼키기' }}</button>
          <button v-if="x.def.unidentified" class="btn" title="의료 15 이상" @click="act({ type: 'examine', uid: x.it.uid })">감별</button>
          <button v-if="x.def.drink && d.nearWater && !x.def.drink.alcohol" class="btn" @click="act({ type: 'fillBottle', uid: x.it.uid })">채우기</button>
          <button class="btn" @click="emit('throw', x.it.uid)">던지기</button>
          <button class="btn" @click="act({ type: 'drop', uid: x.it.uid })">버리기</button>
        </span>
      </div>
    </div>
    <button v-if="d.nearWater" class="btn" @click="act({ type: 'drinkHere' })">웅덩이 물 마시기 (이질 위험)</button>
  </div>
</template>
