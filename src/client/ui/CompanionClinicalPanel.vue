<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {companionAccess,companionClinicalQuote,companionClinicalRule,isMissing,itemDef,itemLabel,part,player,woundDef,type CompanionClinicalRequest,type DrugDef,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>(),selected=ref<CompanionClinicalRequest|null>(null)
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),c=w.s.creatures.find(c=>c.id===props.personId)!,policy=companionClinicalRule(w)
 const medicines=c.bag.flatMap(it=>{const d=itemDef(w,it),drug=d.drug?.def?w.db.tryGet<DrugDef>(d.drug.def):undefined;return !it.missingItem&&!d.unidentified&&(!d.relic||(it.appraisal??0)>=2)&&policy?.prescriptions.some(rx=>rx.item===it.def)&&drug?[{uid:it.uid,label:itemLabel(w,it),drug,count:it.count*(it.uses??1)}]:[]})
 const give=p.bag.filter(it=>!it.missingItem&&!it.half&&!it.dirty&&policy?.prescriptions.some(rx=>rx.item===it.def)).map(it=>({uid:it.uid,label:itemLabel(w,it),count:it.count}))
 const wounds=p.body.wounds.filter(wd=>!wd.internal&&wd.healed<wd.severity&&!isMissing(w,p,wd.part)).map(wd=>({id:wd.id,label:`${part(w,p,wd.part).label} · ${woundDef(w,wd).label}`}))
 return{enabled:!!policy,access:companionAccess(w,c),medicines,give,wounds,report:p.medicalReports?.filter(r=>r.examinerId===c.id).at(-1),quote:selected.value?companionClinicalQuote(w,c,selected.value):null}
})
watch(()=>props.personId,()=>{selected.value=null});watch(version,()=>{selected.value=null})
function confirm(){const q=data.value.quote;if(!selected.value||!q||q.error)return;if(!doAct({type:'companionClinical',target:props.personId,request:{...selected.value},expected:q.signature}))selected.value=null}
</script>
<template>
  <details v-if="data.enabled" class="my-3 border border-ash-600 bg-black/20 p-2 text-xs" data-testid="companion-clinical-panel">
    <summary class="cursor-pointer text-amber-100">진찰·특정 약 부탁 · 1회 진료</summary>
    <p class="my-2 text-ash-300">의료 숙달이 있는 동료에게 내 몸을 살피거나 가진 약을 정확히 1회 투여하도록 부탁한다. 별도 진료비 없이 동료의 실제 시간·물품을 쓴다. 각 진료는 직접 선택한다.</p>
    <button class="dbtn" :disabled="simulating" data-testid="companion-clinical-diagnose" @click="selected={kind:'diagnose'}">진찰 내용 확인</button>
    <details v-if="data.give.length" class="my-2"><summary class="cursor-pointer">내 약을 동료에게 건네기 · 한 묶음/1턴</summary><button v-for="it in data.give" :key="it.uid" class="dbtn m-1" :disabled="simulating||!!data.access" @click="doAct({type:'giveCompanion',target:personId,uid:it.uid})">{{ it.label }} ×{{ it.count }}</button></details>
    <p v-if="!data.medicines.length" class="my-2 text-ash-400">동료의 배낭에 확인한 처방약이 없다.</p>
    <div v-for="m in data.medicines.filter(m=>!m.drug.external)" :key="m.uid" class="my-2"><button class="dbtn" :disabled="simulating" :data-clinical-dose="m.uid" @click="selected={kind:'dose',uid:m.uid}">{{ m.label }} · {{ m.count }}회분 · 1회 투약 확인</button></div>
    <div v-for="wd in data.wounds" :key="wd.id" class="my-2"><template v-if="data.medicines.some(m=>m.drug.external)"><p>{{ wd.label }}</p><button v-for="m in data.medicines.filter(m=>m.drug.external)" :key="m.uid" class="dbtn m-1" :disabled="simulating" :data-clinical-topical="`${wd.id}-${m.uid}`" @click="selected={kind:'dose',uid:m.uid,woundId:wd.id}">{{ m.label }} · 1회 바르기 확인</button></template></div>
    <div v-if="selected&&data.quote" class="my-2 border border-ash-500 p-2" data-testid="companion-clinical-quote">
      <p class="text-amber-100">{{ selected.kind==='diagnose'?'동료 진찰':'정한 약 1회 투여' }} · 대기 포함 약{{ data.quote.turns }}턴{{ data.quote.quality===null?'':` · 예상Q ${data.quote.quality}` }}</p>
      <p class="my-1 text-ash-300">진료 동안 출혈과 시간은 흐른다. 중단하면 완료 효과가 없으며, 약은 완료 때만 1회분 쓴다. 약효·품질은 완료 시점의 몸과 여건을 따른다.</p>
      <p v-if="selected.kind==='diagnose'" class="my-1">숙달에 따라 상처·복부·맥 등을 살피고, 실제로 마친 소견은 일지에 남는다.</p>
      <p v-for="line in data.quote.lines" :key="line" class="my-1 text-ash-300">{{ line }}</p>
      <p v-if="data.quote.error" class="my-2 text-red-300" data-testid="companion-clinical-error">{{ data.quote.error }}</p>
      <div class="mt-2 flex flex-wrap gap-2"><button class="dbtn-gold" :disabled="simulating||!!data.quote.error" data-testid="companion-clinical-confirm" @click="confirm">{{ selected.kind==='diagnose'?'진찰 시작':'정한 약 1회 투여 시작' }}</button><button class="dbtn" @click="selected=null">취소</button></div>
    </div>
    <details v-if="data.report" class="my-2" data-testid="companion-clinical-report"><summary class="cursor-pointer">이 동료의 마지막 진찰 기록 · {{ data.report.at }}턴</summary><p class="my-1 text-ash-400">당시 검사 소견이다. 현재 몸 상태를 다시 검사한 결과가 아니다.</p><p v-for="(finding,index) in data.report.findings" :key="index" class="my-1">{{ finding }}</p></details>
  </details>
</template>
