<script setup lang="ts">
import {computed} from 'vue'
import {canSee,isCompanion,player,turnOf,type World} from '../../core'
import {version,world} from '../store'
import {setWin,socialTarget} from '../ui'
import {t,campClockText,clinicalLabelText} from '../locale'
const data=computed(()=>{
 void version.value;const w=world.value as World,p=player(w)
 return w.s.creatures.filter(c=>c.alive&&isCompanion(w,c)&&canSee(w,p,c.pos)&&c.companion?.carePlan).map(c=>{
  const plan=c.companion!.carePlan!,patient=w.s.creatures.find(o=>o.id===plan.patient),name=plan.patient===p.id?t('나'):patient&&canSee(w,p,patient.pos)?patient.name:t('정한 동료')
  const next=plan.steps[plan.cursor],nextLabel=next?clinicalLabelText(w,next.label,next.request,next.bindings.uid?.def):''
  return{id:c.id,doctor:c.name,patient:name,plan,nextLabel,remaining:Math.max(0,(plan.dueAt??0)-turnOf(w))}
 })
})
function open(id:number){socialTarget.value=id;setWin('society',true)}
</script>
<template>
  <section class="my-3 border border-ash-600 p-3" data-testid="care-plan-overview">
    <h3 class="text-amber-100">{{ t("동료 처치·예약 간호") }}</h3>
    <p class="my-2 text-xs text-ash-400">{{ t("현재 현장에서 직접 보이는 동료에게 맡긴 순서다. 진료는 원래 약·도구와 안전을 매번 확인하며, 예약 대기 동안 환자는 다른 일을 할 수 있다.") }}</p>
    <p v-if="!data.length" class="my-2 text-sm text-ash-300">{{ t("표시할 처치 순서가 없다. 곁의 동료에게 진찰·처치·약을 부탁하며 순서를 정할 수 있다.") }}</p>
    <article v-for="row in data" :key="row.id" class="my-3 border-t border-ash-700 pt-2" :data-care-plan-person="row.id">
      <p class="text-sm">{{ t('{0} → {1} · {2}/{3} 완료 · {4}',row.doctor,row.patient,row.plan.cursor,row.plan.steps.length,t(row.plan.status==='waiting'?'예약 대기':row.plan.status==='running'?'진료 중':row.plan.status==='paused'?'중단':'완료')) }}</p>
      <p v-if="row.plan.status==='waiting'&&row.plan.dueAt!==undefined" class="my-1 text-xs text-amber-200">{{ t('다음 {0} · {1} · {2}턴 뒤',row.nextLabel,campClockText(row.plan.dueAt),row.remaining) }}</p>
      <p v-if="row.plan.reason" class="my-1 text-xs text-amber-200">{{ row.plan.reason }}</p>
      <button class="dbtn my-1" @click="open(row.id)">{{ t("동료의 처치 내용 보기") }}</button>
    </article>
  </section>
</template>
