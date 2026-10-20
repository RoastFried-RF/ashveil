<script setup lang="ts">
import {computed} from 'vue'
import {cookingAccess,cookingRules,cookingStatus,itemLabel,player,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{w,p,rules:cookingRules(w),batches:(w.s.map.cooking??[]).filter(b=>b.crafter===p.id).map(b=>({b,s:cookingStatus(w,b),error:cookingAccess(w,p,b.pos)}))}})
</script>
<template>
  <section v-if="d.batches.length" data-testid="cooking-panel" class="mb-3 border border-ash-700 p-2 text-xs">
    <p>모닥불 위 음식 · 익은 뒤에도 불 위에 두면 탈 수 있다</p>
    <p class="text-ash-400">익은 뒤 {{ (d.rules?.neglectTurns??200)*3/60 }}분마다 탐 판정 · 탄 음식 열량 ×{{ d.rules?.burnKcal??.7 }}</p>
    <div v-for="x in d.batches" :key="x.b.item.uid" :data-cooking-uid="x.b.item.uid" class="my-2">
      <p>{{ itemLabel(d.w,x.b.item) }} · {{ x.b.pos.x }},{{ x.b.pos.y }} · {{ x.s.burnt?'탐':x.s.ready?'익음':x.s.progress+'/'+x.s.total+'턴' }}</p>
      <p v-if="x.s.reason" class="text-amber-200">{{ x.s.reason }}</p>
      <button class="dbtn mt-1" data-cooking-action="take" :disabled="simulating||!!x.error" :title="x.error??''" @click="doAct({type:'takeCooking',uid:x.b.item.uid})">{{ x.s.ready?'음식 회수':'덜 익은 음식 내리기' }}</button>
      <button v-if="!x.s.ready&&x.s.hot&&!x.s.reason" class="dbtn ml-2" data-cooking-action="wait" :disabled="simulating||!!x.error" @click="doAct({type:'rest',turns:x.s.remaining})">곁에서 익을 때까지 기다리기 ({{ x.s.remaining }}턴)</button>
      <button v-if="x.s.ready&&x.s.hot&&!x.s.burnt" class="dbtn ml-2" data-cooking-action="rest" :disabled="simulating||!!x.error" title="음식이 불 위에 남아 탈 수 있다" @click="doAct({type:'rest',turns:d.rules?.neglectTurns??200})">음식을 올려 둔 채10분 쉬기</button>
      <p v-if="x.error" class="text-ash-400">{{ x.error }}</p>
    </div>
  </section>
</template>
