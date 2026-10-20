<script setup lang="ts">
import { computed } from 'vue'
import { boatLaunchQuote, boatRepairQuote, itemLabel, player, portDock, watercraft, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),v=w.s.map.vessel,d=watercraft(w),dock=portDock(w),parked=boatLaunchQuote(w,p)
 return{v,d,dock,parked,liveCrew:v?.crew.filter(id=>w.s.creatures.some(a=>a.id===id&&a.alive)).length??0,repair:boatRepairQuote(w),boats:p.bag.filter(i=>w.db.item(i.def).watercraft).map(i=>({i,label:itemLabel(w,i),q:boatLaunchQuote(w,p,i.uid)})),label:v?itemLabel(w,v.hull):undefined}
})
</script>
<template>
  <section v-if="data.v||data.dock" class="my-3 border border-ash-600 p-2 text-xs" data-testid="marine-panel">
    <h3 class="mb-1 font-bold">{{ data.v?(data.v.floodedAt!==undefined?'침수된 작은 배':'작은 배의 갑판'):'부두와 작은 배' }}</h3>
    <template v-if="data.v&&data.d">
      <p>{{ data.label }} · 선체 {{ data.v.hull.durability?.toFixed(1)??100 }}% · 살아 있는 승선자 {{ data.liveCrew }}/{{ data.d.seats }}명</p>
      <p v-if="data.v.floodedAt!==undefined" class="my-1 text-red-300" data-testid="boat-flooded">갑판이 잠겼다. 남은 실제 뼈대 위에서 원래 재료로 기우거나 빈 물가로 익수자를 끌어내야 한다. 화물은 원래 위치의 물가/바닥에 남는다.</p>
      <p class="my-1 text-ash-300">지도에서 실제 바닷길을 고른다. 노를 저으면 허기·갈증·추위를 겪는다. 화물함의 짐도 함께 움직인다.</p>
      <button class="dbtn" :disabled="simulating" data-testid="boat-hold" @click="doAct({type:'search'})">화물함 열기</button>
      <button class="dbtn ml-1" :disabled="simulating||!!data.repair.error" :title="data.repair.error??'원래 선체에 실제 재료를 대어 수리한다'" data-testid="boat-repair" @click="doAct({type:'repairBoat'})">선체 기우기 ({{ data.repair.turns }}턴)</button>
      <p v-if="data.repair.error" class="mt-1 text-ash-400">{{ data.repair.error }}</p>
    </template>
    <template v-else>
      <p class="my-1 text-ash-300">실제 부두의 바닷물 곁에서 배를 편다. 가까이 있는 동행자와 포로도 정원에 포함한다.</p>
      <button v-if="data.parked.hull" class="dbtn my-1" :disabled="simulating||!!data.parked.error" :title="data.parked.error??'원래 정박선에 다시 오른다'" data-testid="boat-reboard" @click="doAct({type:'launchBoat'})">정박한 원래 배에 타기</button>
      <p v-if="data.parked.hull&&data.parked.error" class="text-ash-400">{{ data.parked.error }}</p>
      <div v-for="boat in data.boats" :key="boat.i.uid" class="my-2">
        <button class="dbtn" :disabled="simulating||!!boat.q.error" :title="boat.q.error??'같은 선체를 띄운다'" :data-boat-launch="boat.i.uid" @click="doAct({type:'launchBoat',uid:boat.i.uid})">{{ boat.label }} 띄우기 ({{ boat.q.turns }}턴)</button>
        <p v-if="boat.q.error" class="text-ash-400">{{ boat.q.error }}</p>
      </div>
      <p v-if="!data.boats.length&&!data.parked.hull" class="text-ash-400">배낭에 실제 소형 선체를 준비해야 한다.</p>
    </template>
  </section>
</template>
