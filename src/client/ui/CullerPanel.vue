<script setup lang="ts">
import {computed,ref} from 'vue'
import {allItems,canSee,cheb,cullerCooling,cullerWaterError,cullerFireError,itemDef,itemLabel,knownCreatureName,player,purifierQuote,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
import ItemIcon from './ItemIcon.vue'
const targetId=ref<number>()
const d=computed(()=>{
 void version.value;const w=world.value as World,p=player(w),radius=Math.max(2,...p.bag.map(i=>itemDef(w,i).purifier?.radius??0)),near=w.s.creatures.filter(c=>c.alive&&c.id!==p.id&&cheb(p.pos,c.pos)<=radius&&canSee(w,p,c.pos)),targets=near.map(c=>({id:c.id,label:knownCreatureName(w,c)})),target=near.find(c=>c.id===targetId.value)??near[0],water=p.bag.filter(i=>itemDef(w,i).drink&&!itemDef(w,i).drink?.alcohol),torch=[p.equip.main,p.equip.off].find(i=>i?.lit&&itemDef(w,i).attacks?.some(a=>a.requiresLit&&a.damageType==='burn'))
 return{targets,target:target?.id,tanks:p.bag.filter(i=>itemDef(w,i).purifier).map(i=>({uid:i.uid,label:itemLabel(w,i),sprite:itemDef(w,i).sprite,error:purifierQuote(w,p,i.uid,target?.id??-1).error})),bells:allItems(p).filter(i=>w.db.all<import('../../core').CreatureDef>('Creature').some(d=>d.culler?.weaknesses.bellItem===i.def)).map(i=>({uid:i.uid,label:itemLabel(w,i),sprite:itemDef(w,i).sprite})),guardians:near.filter(c=>cheb(p.pos,c.pos)<=2&&w.db.creature(c.def).culler).map(c=>{const bottle=water.find(i=>!cullerWaterError(w,p,c,i.uid))??water[0];return{id:c.id,label:knownCreatureName(w,c),cooling:cullerCooling(w,c),waterUid:bottle?.uid,waterError:cullerWaterError(w,p,c,bottle?.uid??-1),torchUid:torch?.uid,fireError:cullerFireError(w,p,c,torch?.uid??-1)}})}
})
</script>
<template>
  <section v-if="d.tanks.length||d.bells.length||d.guardians.length" class="mt-3 border-t border-ash-600 pt-2 text-xs" data-testid="culler-panel">
    <h3 class="mb-1 font-bold">정원 기계·회수한 정화액</h3>
    <p v-if="d.guardians.length" class="mb-2 text-ash-400">연속 공격 뒤의 냉각 틈에 물이나 불을 댈 수 있다. 접근은 위험하다.</p>
    <div v-for="c in d.guardians" :key="c.id" class="mb-2 border border-ash-700 p-2">
      <p class="mb-1">{{ c.label }} · {{ c.cooling?'냉각 중':'가동 중' }}</p>
      <button class="dbtn mr-2" :data-culler-water="c.id" :disabled="simulating||!!c.waterError" :title="c.waterError??'물200ml · 1턴 · 단락은 확률 판정'" @click="doAct({type:'cullerWater',target:c.id,uid:c.waterUid!})">물 끼얹기</button>
      <button class="dbtn" :data-culler-fire="c.id" :disabled="simulating||!!c.fireError" :title="c.fireError??'손에 든 불붙은 횃불 · 1턴'" @click="doAct({type:'cullerIgnite',target:c.id,uid:c.torchUid!})">횃불 대기</button>
    </div>
    <div v-for="it in d.bells" :key="it.uid" class="mb-2 flex items-center gap-2"><ItemIcon :name="it.sprite" :size="24" /><button class="dbtn" :data-maintenance-bell="it.uid" :disabled="simulating" title="실제 종 · 1턴 · 반복 신호에는 적응한다" @click="doAct({type:'ringMaintenanceBell',uid:it.uid})">{{ it.label }} 울리기</button></div>
    <p v-if="d.tanks.length" class="mb-1 text-ash-400">앞쪽 부채꼴에 분무한다. 곁의 다른 사람도 맞을 수 있다.</p>
    <select v-if="d.tanks.length&&d.targets.length" class="mb-2 bg-ash-900 p-1" :value="d.target" data-testid="purifier-target" @change="targetId=Number(($event.target as HTMLSelectElement).value)"><option v-for="t in d.targets" :key="t.id" :value="t.id">{{ t.label }}</option></select>
    <div v-for="it in d.tanks" :key="it.uid" class="mb-2 flex items-center gap-2"><ItemIcon :name="it.sprite" :size="24" /><button class="dbtn" :data-purifier-spray="it.uid" :disabled="simulating||!!it.error" :title="it.error??'원래 정화액1회분 · 1턴'" @click="doAct({type:'sprayPurifier',uid:it.uid,target:d.target!})">{{ it.label }} · 분사</button><span class="text-ash-400">{{ it.error??'1턴' }}</span></div>
  </section>
</template>
