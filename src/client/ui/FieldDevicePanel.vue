<script setup lang="ts">
import { computed } from 'vue'
import { factionDef, fieldDeviceQuote, itemLabel, nearbyFieldDevices, player, type ItemDef, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w)
 return nearbyFieldDevices(w,p).map(row=>({...row,ownWork:row.device.work?.owner===p.id,installed:row.device.installed.map(i=>itemLabel(w,i)),operations:row.def.operations.map(op=>{
  const q=fieldDeviceQuote(w,p,row.pos,row.device.uid,op.id),tool=op.tool?w.db.all<ItemDef>('Item').find(i=>i.toolTags?.includes(op.tool!))?.label:undefined
  return{op,q,crime:op.crime?factionDef(w,op.crime.faction)?.label:undefined,held:op.hold?.map(id=>w.db.item(id).label).join(' · '),done:row.device.completed.includes(op.id),materials:op.materials.map(m=>`${w.db.item(m.item).label} ${m.count}개`).join(' · '),tool,books:op.books?.map(id=>w.db.item(id).label).join(' · ')}
 })}))
})
</script>
<template>
  <section v-for="row in data" :key="row.device.uid" class="my-3 border border-ash-600 p-2 text-xs" :data-testid="`field-device-${row.device.uid}`">
    <h3 class="mb-1 font-bold">{{ row.def.label }}</h3>
    <p class="mb-2 text-ash-300">{{ row.def.description }}</p>
    <p v-if="row.device.work" class="my-1 text-amber-200" data-testid="device-progress">정비 {{ (100*row.device.work.progress/row.device.work.total).toFixed(0) }}% · 멈춘 진행과 예약은 설비에 남는다.</p>
    <p v-if="row.installed.length" class="my-1 text-ash-300">장착한 부품·사용한 천: {{ row.installed.join(' · ') }}</p>
    <p v-if="row.device.waterUsed" class="my-1 text-ash-300">세척에 쓴 물 {{ row.device.waterUsed }}ml</p>
    <p v-if="row.device.energy!==undefined" class="my-1 text-ash-300" data-device-energy>남은 전력 {{ row.device.energy }}</p>
    <div v-for="op in row.operations" :key="op.op.id" class="my-2 border-t border-ash-700 pt-1">
      <p v-if="op.done" class="text-moss-300" :data-device-completed="op.op.id">{{ op.op.label }} · 완료</p>
      <template v-else>
        <button class="dbtn" :disabled="simulating||!!op.q.error" :title="op.q.error??op.op.label" :data-device-operation="op.op.id" @click="doAct({type:'deviceWork',pos:row.pos,uid:row.device.uid,operation:op.op.id})">{{ op.op.label }} ({{ op.q.turns }}턴)</button>
        <p class="my-1">{{ op.materials }}<span v-if="op.op.waterMl"> · 맑은 물 {{ op.op.waterMl }}ml</span><span v-if="op.tool"> · {{ op.tool }} 계열 도구</span></p>
        <p v-if="op.crime" class="text-amber-300" data-device-crime>{{ op.crime }} 소유의 기구다. 목격되면 소식이 전해지며<span v-if="op.op.crime?.provoke"> 경비가 제지한다.</span><span v-else> 평판이 나빠진다.</span></p>
        <p v-if="op.books" class="text-ash-400">완독 지침: {{ op.books }}</p>
        <p v-if="op.held" class="text-ash-300">직접 소지할 증표: {{ op.held }}</p>
        <p v-if="op.op.energyCost" class="text-ash-300">전력 {{ op.op.energyCost }} 소비</p>
        <p v-if="op.q.error" class="text-ash-400">{{ op.q.error }}</p>
      </template>
    </div>
    <button v-if="row.ownWork" class="dbtn" :disabled="simulating" data-device-cancel @click="doAct({type:'deviceCancel',pos:row.pos,uid:row.device.uid})">예약 해제·진행 초기화</button>
  </section>
</template>
