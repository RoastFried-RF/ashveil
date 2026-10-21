<script setup lang="ts">
import {computed} from 'vue'
import {canSee,hasLos,cheb,cookingAccess,cookingRules,cookingStatus,itemDef,itemLabel,player,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
import ItemIcon from './ItemIcon.vue'
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{w,p,rules:cookingRules(w),batches:(w.s.map.cooking??[]).filter(b=>b.crafter===p.id||cheb(p.pos,b.pos)<=1&&canSee(w,p,b.pos)&&hasLos(w,p.pos,b.pos)).map(b=>({b,own:b.crafter===p.id,s:cookingStatus(w,b),error:cookingAccess(w,p,b.pos)}))}})
</script>
<template>
  <section v-if="d.batches.length" data-testid="cooking-panel" class="mb-3 border border-ash-700 p-2 text-xs">
    <p>모닥불 위 음식 · 익은 뒤에도 불 위에 두면 탈 수 있다</p>
    <p class="text-ash-400">익은 뒤 {{ (d.rules?.neglectTurns??200)*3/60 }}분마다 탐 판정 · 탄 음식 열량 ×{{ d.rules?.burnKcal??.7 }}</p>
    <div v-for="x in d.batches" :key="x.b.item.uid" :data-cooking-uid="x.b.item.uid" class="my-2">
      <div class="flex items-center gap-2">
        <ItemIcon :name="itemDef(d.w,x.b.item).sprite" :size="32" data-testid="cooking-food-icon" />
        <p>{{ x.own?itemLabel(d.w,x.b.item):itemDef(d.w,x.b.item).label }} · {{ x.b.pos.x }},{{ x.b.pos.y }} · {{ x.s.burnt?'탐':x.s.ready?'익음':x.own?x.s.progress+'/'+x.s.total+'턴':'아직 익지 않음' }}</p>
      </div>
      <p v-if="!x.own" class="text-ash-400" data-testid="other-cooking-owner">다른 사람이 올린 음식 · 회수할 수 없다</p>
      <template v-else>
        <p v-if="x.s.reason" class="text-amber-200">{{ x.s.reason }}</p>
        <button class="dbtn mt-1" data-cooking-action="take" :disabled="simulating||!!x.error" :title="x.error??''" @click="doAct({type:'takeCooking',uid:x.b.item.uid})">{{ x.s.ready?'음식 회수':'덜 익은 음식 내리기' }}</button>
        <button v-if="!x.s.ready&&x.s.hot&&!x.s.reason" class="dbtn ml-2" data-cooking-action="wait" :disabled="simulating||!!x.error" @click="doAct({type:'rest',turns:x.s.remaining})">곁에서 익을 때까지 기다리기 ({{ x.s.remaining }}턴)</button>
        <button v-if="x.s.ready&&x.s.hot&&!x.s.burnt" class="dbtn ml-2" data-cooking-action="rest" :disabled="simulating||!!x.error" title="음식이 불 위에 남아 탈 수 있다" @click="doAct({type:'rest',turns:d.rules?.neglectTurns??200})">음식을 올려 둔 채10분 쉬기</button>
        <p v-if="x.error" class="text-ash-400">{{ x.error }}</p>
      </template>
    </div>
  </section>
</template>
