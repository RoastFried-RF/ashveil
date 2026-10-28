<script setup lang="ts">
import { computed } from 'vue'
import { economyDef, lessonQuote, player, teacherDef, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const props = defineProps<{ teacherId: number }>()
const data = computed(() => {
  void version.value
  const w = world.value as World, pupil = player(w), teacher = w.s.creatures.find((c) => c.id === props.teacherId)!, rule = teacherDef(w, teacher)
  return rule ? { teacher, rule, quote: lessonQuote(w,pupil,teacher), currency: economyDef(w).currency, learned: (pupil.literacy ?? (pupil.literate ? 2 : 0)) > 0 } : null
})
</script>
<template>
  <section v-if="data" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="teaching-panel">
    <h3 class="font-bold">글자 수업</h3>
    <p data-testid="lesson-progress">마친 수업 {{ data.quote.days.length }}/{{ data.rule.days }}일</p>
    <p class="my-1 text-ash-300">서로 다른 {{ data.rule.days }}일의 수업을 마치면 기초 글자를 읽는다. 하루에 한 번 진도를 얻으며, 같은 과정을 가르치는 다른 교사에게 이어서 배울 수 있다.</p>
    <p v-if="data.learned">기초 글자는 이미 읽을 수 있다. 다음 문해 단계는 서로 다른 책의 완독으로 얻는다.</p>
    <template v-else>
      <p>오늘 수업 {{ data.quote.fee }}{{ data.currency }} · 약 {{ Math.ceil((data.quote.turns || data.rule.lessonTurns) / 20) }}분</p>
      <p class="my-1 text-ash-300">수업 중에도 몸과 시간이 흐른다. 중단하면 오늘의 진도와 수업료를 돌려받지 못한다.</p>
      <p v-if="data.quote.error" class="my-1 text-amber-200" data-testid="lesson-error">{{ data.quote.error }}</p>
      <button class="dbtn my-1" :disabled="simulating || !!data.quote.error" data-testid="lesson-start" @click="doAct({ type: 'lesson', target: data.teacher.id, expectedFee: data.quote.fee })">수업료 내고 배우기</button>
    </template>
  </section>
</template>
