<script setup lang="ts">
import { computed } from 'vue'
import { retirementLongLeaseQuote, fmtClock, innDef, innQuote, player, turnOf, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
import RetirementPanel from './RetirementPanel.vue'
const props = defineProps<{ keeperId: number }>()
const data = computed(() => {
  void version.value
  const w = world.value as World, p = player(w), keeper = w.s.creatures.find((c) => c.id === props.keeperId)!
  const def = innDef(w, keeper)
  return { p, def, now: turnOf(w), rows: (w.s.map.innBeds ?? []).filter((b) => b.keeper === keeper.id).map((bed) => ({ bed, quote: innQuote(w, p, keeper, bed.id),long:retirementLongLeaseQuote(w,p,keeper,bed.id) })) }
})
</script>
<template>
  <section v-if="data.def" class="my-3 border-y border-ash-600 py-2" data-testid="inn-panel">
    <h3 class="text-sm font-bold">숙박</h3>
    <p class="my-1 text-xs text-ash-300">침대를 빌린 뒤 표시된 위치로 직접 가서 Z로 잠든다. 음식·치료는 별도다. 기한이 끝나면 일반 수면에서 깬다.</p>
    <p v-if="!data.rows.length" class="text-xs">사용할 수 있는 침대가 없다.</p>
    <div v-for="({ bed, quote, long }, index) in data.rows" :key="bed.id" class="my-2 text-xs" :data-testid="`inn-bed-${index}`">
      <p>침대 {{ index + 1 }} · ({{ bed.pos.x }}, {{ bed.pos.y }}) · {{ Math.round(quote.turns / 1200) }}시간 / {{ quote.fee }}전</p>
      <p v-if="bed.lease?.tenant === data.p.id && bed.lease.until > data.now" data-testid="inn-lease">대여 중 · {{ fmtClock(bed.lease.until) }}까지</p>
      <p v-if="quote.error" class="text-red-300">{{ quote.error }}</p>
      <button class="dbtn mt-1" :disabled="simulating || !!quote.error" :data-testid="`inn-rent-${index}`" @click="doAct({ type: 'rentBed', target: keeperId, bed: bed.id, expectedFee: quote.fee })">{{ bed.lease?.tenant === data.p.id && bed.lease.until > data.now ? '기간 연장' : '침대 빌리기' }} (1턴)</button>
      <button class="dbtn mt-1 ml-1" :disabled="simulating||!!long.error" :title="long.error??'장기 거처를 확보한다'" :data-testid="`inn-long-rent-${index}`" @click="doAct({type:'rentBed',target:keeperId,bed:bed.id,periods:long.periods,expectedFee:long.fee})">장기 임대 {{ Math.round(long.turns/28800) }}일 · {{ long.fee }}전</button>
    </div>
    <RetirementPanel :keeper-id="keeperId" />
  </section>
</template>
