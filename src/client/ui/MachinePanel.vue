<script setup lang="ts">
import { computed } from 'vue'
import { cheb, hasLos, itemLabel, knownCreatureName, machineCareError, machineRules, machineStatus, MACHINE_OPERATION_LABEL, partDamage, player, type MachineOperation, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const data=computed(()=>{
  void version.value
  const w=world.value as World,p=player(w)
  return w.s.creatures.filter(c=>c.alive&&c.body.machine&&cheb(p.pos,c.pos)<=1&&hasLos(w,p.pos,c.pos)).map(c=>{
    const d=machineRules(w,c)!
    const operations:{operation:MachineOperation;woundId?:number;part?:string;label:string}[]=[{operation:'coolant',label:'냉각액 보충'},{operation:'cell',label:'전원셀 교환'},...c.body.wounds.filter(wd=>!wd.patched&&wd.def==='Wound.MachinePerforation'&&[d.chassis,d.coolingLoop].includes(wd.part)&&wd.severity>wd.healed).map(wd=>({operation:'patch' as const,woundId:wd.id,label:`${w.db.body(c.body.def).parts.find(x=>x.id===wd.part)?.label} 누출 밀봉`})),...w.db.body(c.body.def).parts.filter(part=>partDamage(c,part.id)>0).map(part=>({operation:'repair' as const,part:part.id,label:`${part.label} 부품 수리`}))]
    return{c,name:knownCreatureName(w,c),lines:machineStatus(w,c),operations:operations.map(op=>{const rule=d[op.operation],it=p.bag.find(i=>i.def===rule.item&&i.count>0);return{...op,uid:it?.uid,item:it?itemLabel(w,it):w.db.item(rule.item).label,turns:rule.turns,error:machineCareError(w,p,c,op.operation,op.woundId,op.part)??(!it?'소모 부품이 없다':null)}})}
  })
})
</script>
<template>
  <section v-for="row in data" :key="row.c.id" class="mt-3 border-t border-ash-600 pt-2 text-xs" :data-testid="`machine-${row.c.id}`">
    <h3 class="mb-1 font-bold">곁의 {{ row.name }} 정비</h3>
    <p v-for="line in row.lines" :key="line">{{ line }}</p>
    <p class="my-1 text-ash-400">밀봉은 천공의 누출을 멈춘다. 냉각액·전원·손상 수리는 각각 별도 부품을 쓴다.</p>
    <div v-for="op in row.operations" :key="`${op.operation}-${op.woundId??op.part??''}`" class="my-1 flex items-center gap-2">
      <button class="dbtn" :disabled="simulating||!!op.error" :title="op.error??MACHINE_OPERATION_LABEL[op.operation]" :data-machine-operation="op.operation" :data-wound-id="op.woundId" :data-machine-part="op.part" @click="doAct({type:'machineCare',target:row.c.id,operation:op.operation,uid:op.uid!,woundId:op.woundId,part:op.part})">{{ op.label }}</button>
      <span>{{ op.item }} 1개 · 기본 {{ op.turns }}턴<span v-if="op.error"> · {{ op.error }}</span></span>
    </div>
  </section>
</template>
