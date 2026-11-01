<script setup lang="ts">
import { computed } from 'vue'
import { factionDef, fieldDeviceQuote, nearbyFieldDevices, player, type ItemDef, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
import{t,defText,deviceOperationText,fieldWorkIssueText}from'../locale'
import{displayItemLabel as itemLabel,displayItemDefLabel}from'../locales/item'
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w)
 return nearbyFieldDevices(w,p).map(row=>({...row,ownWork:row.device.work?.owner===p.id,installed:row.device.installed.map(i=>itemLabel(w,i)),operations:row.def.operations.map(op=>{
  const q=fieldDeviceQuote(w,p,row.pos,row.device.uid,op.id),toolDef=op.tool?w.db.all<ItemDef>('Item').find(i=>i.toolTags?.includes(op.tool!)):undefined,crime=op.crime?factionDef(w,op.crime.faction):undefined
  return{op,q,label:deviceOperationText(row.def.id,op),issue:fieldWorkIssueText(q.error,{waterMl:op.waterMl,tool:op.tool,materials:op.materials.map(m=>({def:w.db.item(m.item),displayLabel:displayItemDefLabel(w.db.item(m.item)),count:m.count}))}),crime:crime?defText(crime):undefined,held:op.hold?.map(id=>displayItemDefLabel(w.db.item(id))).join(' · '),done:row.device.completed.includes(op.id),materials:op.materials.map(m=>t('{0} {1}개',displayItemDefLabel(w.db.item(m.item)),m.count)).join(' · '),tool:toolDef?displayItemDefLabel(toolDef):undefined,books:op.books?.map(id=>displayItemDefLabel(w.db.item(id))).join(' · ')}
 })}))
})
</script>
<template>
  <section v-for="row in data" :key="row.device.uid" class="my-3 border border-ash-600 p-2 text-xs" :data-testid="`field-device-${row.device.uid}`">
    <h3 class="mb-1 font-bold">{{ defText(row.def) }}</h3>
    <p class="mb-2 text-ash-300">{{ defText(row.def,'description') }}</p>
    <p v-if="row.device.work" class="my-1 text-amber-200" data-testid="device-progress">{{ t('정비 {0}% · 멈춘 진행과 예약은 설비에 남는다.',(100*row.device.work.progress/row.device.work.total).toFixed(0)) }}</p>
    <p v-if="row.installed.length" class="my-1 text-ash-300">{{ t('장착한 부품·사용한 천: {0}',row.installed.join(' · ')) }}</p>
    <p v-if="row.device.waterUsed" class="my-1 text-ash-300">{{ t('세척에 쓴 물 {0}ml',row.device.waterUsed) }}</p>
    <p v-if="row.device.energy!==undefined" class="my-1 text-ash-300" data-device-energy>{{ t('남은 전력 {0}',row.device.energy) }}</p>
    <div v-for="op in row.operations" :key="op.op.id" class="my-2 border-t border-ash-700 pt-1">
      <p v-if="op.done" class="text-moss-300" :data-device-completed="op.op.id">{{ t('{0} · 완료',op.label) }}</p>
      <template v-else>
        <button class="dbtn" :disabled="simulating||!!op.q.error" :title="op.issue||op.label" :data-device-operation="op.op.id" @click="doAct({type:'deviceWork',pos:row.pos,uid:row.device.uid,operation:op.op.id})">{{ t('{0} ({1}턴)',op.label,op.q.turns) }}</button>
        <p class="my-1">{{ op.materials }}<span v-if="op.op.waterMl"> · {{ t('맑은 물 {0}ml',op.op.waterMl) }}</span><span v-if="op.tool"> · {{ t('{0} 계열 도구',op.tool) }}</span></p>
        <p v-if="op.crime" class="text-amber-300" data-device-crime>{{ t(op.op.crime?.provoke?'{0} 소유의 기구다. 목격되면 소식이 전해지며 경비가 제지한다.':'{0} 소유의 기구다. 목격되면 소식이 전해지며 평판이 나빠진다.',op.crime) }}</p>
        <p v-if="op.books" class="text-ash-400">{{ t('완독 지침: {0}',op.books) }}</p>
        <p v-if="op.held" class="text-ash-300">{{ t('직접 소지할 증표: {0}',op.held) }}</p>
        <p v-if="op.op.energyCost" class="text-ash-300">{{ t('전력 {0} 소비',op.op.energyCost) }}</p>
        <p v-if="op.q.error" class="text-ash-400">{{ op.issue }}</p>
      </template>
    </div>
    <button v-if="row.ownWork" class="dbtn" :disabled="simulating" data-device-cancel @click="doAct({type:'deviceCancel',pos:row.pos,uid:row.device.uid})">{{ t('예약 해제·진행 초기화') }}</button>
  </section>
</template>
