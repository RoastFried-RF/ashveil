<script setup lang="ts">
import {computed} from 'vue'
import {beddingLiceRules,foodSafetyDef,hasEffect,nearbyPeople,residentHygieneGoal,residentHygieneSupply,residentVesselGoal,turnOf,type ResidentWaterDef,type World} from '../../core'
import {version,world} from '../store'
const props=defineProps<{personId:number}>()
const data=computed(()=>{
 void version.value
 const w=world.value as World,c=nearbyPeople(w).find(c=>c.id===props.personId),policy=w.db.tryGet<ResidentWaterDef>('ResidentWater.Hearth')?.hygiene
 if(!c||!policy||!c.residentSite||c.residentSite!==w.s.overworld?.currentRegion)return null
 const bodyMl=foodSafetyDef(w).washWater,bedMl=beddingLiceRules(w)?.washWaterMl,goal=residentHygieneGoal(w,c),water=residentHygieneSupply(w,c,goal?.waterMl??bodyMl),busy=c.activity?.kind==='wash'||c.activity?.kind==='washBedding'
 return {enabled:w.s.hygieneEnabled!==false,goal,water,vessel:residentVesselGoal(w,c),busy,bodyMl,bedMl,label:c.activity?.label,remaining:c.activity?.remaining,dirty:c.needs.hygiene<policy.washAt,lice:hasEffect(c,'lice',turnOf(w))}
})
</script>
<template>
  <section v-if="data" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="resident-hygiene">
    <p v-if="!data.enabled">위생 관리 꺼짐</p>
    <template v-else>
      <p v-if="data.busy" data-testid="resident-hygiene-activity">{{ data.label }} · 남은 {{ data.remaining }}턴 · 마지막에 실제 물을 사용한다.</p>
      <p v-else>{{ data.lice?'몸에 이가 있음':data.dirty?'몸을 씻어야 함':'몸이 깨끗함' }}<span v-if="data.goal?.kind==='bedding'"> · 직접 본 개인 침구 세탁 준비</span></p>
      <p v-if="data.goal&&!data.water.available" class="text-ash-300">{{ data.vessel?(data.vessel.own?'자기 상점의 실제 용기를 가져오려 한다.':'상점에서 자기 돈으로 물 용기를 구하려 한다.'):data.water.capacityMl<data.goal.waterMl?'씻을 물을 담을 용기가 부족하다.':'우물까지 걸어가 실제 물을 준비한다.' }}</p>
      <p class="text-ash-400">몸과 개인 침구는 따로 씻는다. 몸 {{ data.bodyMl }}ml · 침구 {{ data.bedMl }}ml의 실제 물과 노동이 필요하다.</p>
    </template>
  </section>
</template>
