<script setup lang="ts">
import { computed } from 'vue'
import { isWaterVessel,allItems, capacity, cheb, drinkVolume, hasLos, itemLabel, nearbyWater, player, tileAt, waterLines, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const data = computed(() => {
  void version.value
  const w = world.value as World, well = w.s.map.residentWell, p = player(w)
  if (!well || cheb(p.pos, well.pos) > 1 || !hasLos(w, p.pos, well.pos) || tileAt(w, well.pos).t !== well.terrain) return null
  const source = nearbyWater(w, p, well.pos), hands = capacity(w, p, 'manipulation') >= .2
  return { pos: well.pos, available: !!source && hands, lines: source ? waterLines(w, p, { uid: -1, def: 'Item.DirtyWaterBottle', count: 1, uses: 5, water: source.quality }).slice(0, 1) : ['지금은 우물에서 물을 뜰 수 없다'],
    bottles: allItems(p).filter((it) => isWaterVessel(w,it)).map((it) => ({ uid: it.uid, label: itemLabel(w, it), ml: drinkVolume(w, it) })) }
})
</script>
<template>
  <section v-if="data" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="resident-well">
    <h3 class="font-bold">공용 우물</h3>
    <p v-for="line in data.lines" :key="line">{{ line }}</p>
    <button class="dbtn my-1" :disabled="simulating || !data.available" data-testid="well-drink" @click="doAct({ type: 'drinkHere', pos: data.pos })">물 떠 마시기 (300ml · 2턴)</button>
    <p class="text-ash-300">우물물도 끓이거나 거르면 더 안전하다. 용기를 채우면 기존 내용물은 버린다.</p>
    <div v-for="bottle in data.bottles" :key="bottle.uid" class="my-1 flex items-center gap-2">
      <span>{{ bottle.label }} · {{ bottle.ml }}ml</span><button class="dbtn" :disabled="simulating || !data.available" :data-testid="`well-fill-${bottle.uid}`" @click="doAct({ type: 'fillBottle', uid: bottle.uid, pos: data.pos })">용기 채우기 (1.5턴)</button>
    </div>
  </section>
</template>
