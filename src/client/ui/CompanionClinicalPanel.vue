<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {canSee,cheb,companionAccess,companionCarePlanQuote,companionClinicalCancelError,companionClinicalQuote,companionClinicalRule,isCompanion,isMissing,itemDef,itemLabel,part,player,woundDef,type CompanionClinicalRequest,type DrugDef,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>(),selected=ref<CompanionClinicalRequest|null>(null),patientId=ref<number>(),consent=ref(false),amputation=ref(false)
const draft=ref<CompanionClinicalRequest[]>([])
const labels:Record<CompanionClinicalRequest['kind'],string>={diagnose:'진찰',dose:'약 1회 투여',bandage:'붕대',disinfect:'상처 세척',tourniquet:'지혈대',splint:'부목',suture:'봉합',ligate:'동맥 결찰',tendon:'힘줄 수복',extract:'이물질 제거',reduce:'관절 맞추기',amputate:'절단'}
const data=computed(()=>{
 void version.value
 const w=world.value as World,leader=player(w),c=w.s.creatures.find(c=>c.id===props.personId)!,policy=companionClinicalRule(w)
 const patients=w.s.creatures.filter(p=>p!==c&&p.alive&&(p===leader||isCompanion(w,p))&&(p.mapId===undefined||p.mapId===w.s.map.id)&&cheb(c.pos,p.pos)<=1&&canSee(w,leader,p.pos)&&canSee(w,c,p.pos))
 const id=patientId.value??leader.id,p=patients.find(p=>p.id===id)
 const medicines=c.bag.flatMap(it=>{const d=itemDef(w,it),drug=d.drug?.def?w.db.tryGet<DrugDef>(d.drug.def):undefined;return !it.missingItem&&!d.unidentified&&(!d.relic||(it.appraisal??0)>=2)&&policy?.prescriptions.some(rx=>rx.item===it.def)&&drug?[{uid:it.uid,label:itemLabel(w,it),drug,count:it.count*(it.uses??1)}]:[]})
 const give=leader.bag.filter(it=>!it.missingItem&&!it.half&&!it.dirty&&(policy?.prescriptions.some(rx=>rx.item===it.def)||!!itemDef(w,it).medical)).map(it=>({uid:it.uid,label:itemLabel(w,it),count:it.count}))
 const wounds=p?p.body.wounds.filter(wd=>!wd.internal&&!isMissing(w,p,wd.part)&&(wd.healed<wd.severity||wd.tendon||wd.dislocated||wd.foreign)).map(wd=>{
  const kinds:CompanionClinicalRequest['kind'][]=[]
  if(wd.healed<wd.severity)kinds.push('bandage','disinfect','suture')
  if((wd.artery??0)>0)kinds.push('tourniquet','ligate')
  if(wd.fracture)kinds.push('splint');if(wd.tendon)kinds.push('tendon');if(wd.foreign)kinds.push('extract');if(wd.dislocated)kinds.push('reduce')
  return{id:wd.id,label:`${part(w,p,wd.part).label} · ${woundDef(w,wd).label}`,kinds}
 }):[]
 const tendons=p?(p.body.damagedTendons??[]).filter(id=>!isMissing(w,p,id)&&!p.body.wounds.some(wd=>wd.part===id&&wd.tendon)).map(id=>({id,label:part(w,p,id).label})):[]
 const limbs=p?w.db.body(p.body.def).parts.filter(pd=>pd.limb&&!pd.internal&&!pd.vital&&!isMissing(w,p,pd.id)&&/UpperArm|Thigh|Hand$|Foot$/.test(pd.id)):[]
 const request=selected.value?{...selected.value,permanentLossAccepted:consent.value}:null
 const current=c.activity?.companionClinical&&c.activity.patientId!==undefined?{patient:c.activity.patientId,label:c.activity.label,error:companionClinicalCancelError(w,c,c.activity.patientId)}:undefined
 const planQuote=companionCarePlanQuote(w,c,draft.value),planned=planQuote.steps.map(s=>({...s,materials:s.bindings.supplies.map(b=>`${w.db.item(b.def).label} #${b.uid} · ${b.uses??b.count}${b.uses===undefined?'개':'회분'}`),tool:s.bindings.tool?`${w.db.item(s.bindings.tool.def).label} #${s.bindings.tool.uid}`:undefined}))
 return{plan:c.companion?.carePlan,planQuote,planned,current,leaderId:leader.id,enabled:!!policy||!!c.activity?.companionClinical,access:companionAccess(w,c),patients,id,patient:p,medicines,give,wounds,tendons,limbs,report:p?.medicalReports?.filter(r=>r.examinerId===c.id).at(-1),request,quote:request?companionClinicalQuote(w,c,request):null}
})
function choose(request:CompanionClinicalRequest){selected.value={...request,patient:data.value.id};consent.value=false}
function clear(){selected.value=null;consent.value=false}
watch(()=>props.personId,()=>{clear();draft.value=[];patientId.value=undefined;amputation.value=false});watch(version,clear);watch(patientId,()=>{clear();draft.value=[];amputation.value=false})
function confirm(){const q=data.value.quote,request=data.value.request;if(!request||!q||q.error)return;if(!doAct({type:'companionClinical',target:props.personId,request,expected:q.signature}))clear()}
function addStep(){const request=selected.value;if(!request||request.kind==='amputate'||draft.value.length>=data.value.planQuote.maxSteps)return;draft.value.push({...request});clear()}
function moveStep(index:number,delta:number){const other=index+delta;if(other<0||other>=draft.value.length)return;[draft.value[index],draft.value[other]]=[draft.value[other]!,draft.value[index]!]}
function startPlan(){const q=data.value.planQuote;if(q.error)return;if(!doAct({type:'companionCarePlan',target:props.personId,requests:draft.value.map(r=>({...r})),expected:q.signature})){draft.value=[];clear()}}
function reviewRemaining(){const plan=data.value.plan;if(!plan||plan.status!=='paused')return;patientId.value=plan.patient===data.value.leaderId?undefined:plan.patient;queueMicrotask(()=>{draft.value=plan.steps.slice(plan.cursor).map(s=>({...s.request}))})}
</script>
<template>
  <details v-if="data.enabled" class="my-3 border border-ash-600 bg-black/20 p-2 text-xs" data-testid="companion-clinical-panel">
    <summary class="cursor-pointer text-amber-100">진찰·처치·약 부탁 · 환자 선택</summary>
    <p class="my-2 text-ash-300">의료 숙달과 도구가 있는 동료에게 곁의 나 또는 동료를 돌보도록 직접 부탁한다. 별도 진료비 없이 실제 시간·물품을 쓴다. 다른 동료의 진료를 맡기면1턴이 들고, 이후 기다리거나 다른 일을 할 수 있다.</p>
    <div v-if="data.current" class="my-2 border border-amber-800 p-2"><p>부탁한 진료 진행 중 · {{ data.current.label }}</p><button class="dbtn my-1" :disabled="simulating||!!data.current.error" :title="data.current.error??'원래 환자의 진료를 중단하고 양쪽 대기를 해제한다'" data-testid="companion-clinical-cancel" @click="doAct({type:'cancelCompanionClinical',target:personId,patient:data.current.patient})">부탁한 진료 중단 (1턴)</button><p class="text-ash-400">절반 진행한 부목은 반쪽 처치와 소모가 남을 수 있다. 이미 끝난 처치/소모는 되돌리지 않는다.</p></div>
    <div v-if="data.plan" class="my-2 border border-ash-600 p-2" data-testid="companion-care-plan-status">
      <p class="text-amber-100">맡긴 처치 순서 · {{ data.plan.status==='complete'?'완료':data.plan.status==='paused'?'중단':'진행 중' }} · {{ data.plan.cursor }}/{{ data.plan.steps.length }}</p>
      <ol class="my-2 list-inside list-decimal"><li v-for="(step,index) in data.plan.steps" :key="index" :class="index<data.plan.cursor?'text-ash-400':'text-ash-100'">{{ step.label }} {{ index<data.plan.cursor?'· 완료':index===data.plan.cursor&&data.plan.status==='running'?'· 작업 중':'' }}</li></ol>
      <p v-if="data.plan.reason" class="my-2 text-amber-200">{{ data.plan.reason }}</p>
      <button v-if="data.plan.status==='paused'" class="dbtn" :disabled="simulating" data-testid="companion-care-plan-review" @click="reviewRemaining">남은 순서 다시 검토</button>
    </div>
    <label class="my-2 flex flex-wrap items-center gap-2">환자 <select v-model="patientId" :disabled="simulating" class="dbtn max-w-full" data-testid="companion-clinical-patient"><option :value="undefined">나</option><option v-for="p in data.patients.filter(p=>p.id!==data.leaderId)" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
    <p v-if="!data.patient" class="my-2 text-amber-200">정한 환자가 시술자 곁에서 직접 보이지 않는다. 환자를 다시 선택해야 한다.</p>
    <button class="dbtn" :disabled="simulating||!data.patient" data-testid="companion-clinical-diagnose" @click="choose({kind:'diagnose'})">진찰 내용 확인</button>
    <details v-if="data.give.length" class="my-2"><summary class="cursor-pointer">내 약·의료품을 동료에게 건네기 · 한 묶음/1턴</summary><button v-for="it in data.give" :key="it.uid" class="dbtn m-1" :disabled="simulating||!!data.access" @click="doAct({type:'giveCompanion',target:personId,uid:it.uid})">{{ it.label }} ×{{ it.count }}</button></details>
    <p v-if="!data.medicines.length" class="my-2 text-ash-400">동료의 배낭에 확인한 처방약이 없다.</p>
    <div v-for="m in data.medicines.filter(m=>!m.drug.external)" :key="m.uid" class="my-2"><button class="dbtn" :disabled="simulating||!data.patient" :data-clinical-dose="m.uid" @click="choose({kind:'dose',uid:m.uid})">{{ m.label }} · {{ m.count }}회분 · 1회 투약 확인</button></div>
    <div v-for="wd in data.wounds" :key="wd.id" class="my-2"><template v-if="data.medicines.some(m=>m.drug.external)"><p>{{ wd.label }}</p><button v-for="m in data.medicines.filter(m=>m.drug.external)" :key="m.uid" class="dbtn m-1" :disabled="simulating" :data-clinical-topical="`${wd.id}-${m.uid}`" @click="choose({kind:'dose',uid:m.uid,woundId:wd.id})">{{ m.label }} · 1회 바르기 확인</button></template></div>
    <details v-if="data.patient" class="my-2 border-t border-ash-700 pt-2" data-testid="companion-clinical-procedures">
      <summary class="cursor-pointer">상처별 처치·봉합·정복</summary>
      <p class="my-2 text-ash-400">처치별 숙달·원래 도구/소모품이 필요하다. 부족한 조건은 검토에서 표시한다. 다른 환자의 신체에 실제 효과와 위험이 남는다.</p>
      <div v-for="wd in data.wounds" :key="wd.id" class="my-2 border-b border-ash-700 pb-2"><p>{{ wd.label }}</p><div class="mt-1 flex flex-wrap gap-1"><button v-for="kind in wd.kinds" :key="kind" class="dbtn" :disabled="simulating" :data-clinical-procedure="`${kind}-${wd.id}`" @click="choose({kind,woundId:wd.id})">{{ labels[kind] }} 확인</button></div></div>
      <p v-for="t in data.tendons" :key="t.id" class="my-2">{{ t.label }} · 아문 힘줄 손상 <button class="dbtn" :disabled="simulating" @click="choose({kind:'tendon',part:t.id})">힘줄 수복 확인</button></p>
      <button class="dbtn my-2" :disabled="simulating" @click="amputation=!amputation">절단 상담 {{ amputation?'접기':'펼치기' }}</button>
      <div v-if="amputation" class="flex flex-wrap gap-1"><button v-for="limb in data.limbs" :key="limb.id" class="dbtn" :disabled="simulating" :data-clinical-amputate="limb.id" @click="choose({kind:'amputate',part:limb.id})">{{ limb.label }} 절단 확인</button></div>
    </details>
    <div v-if="selected&&data.quote" class="my-2 border border-ash-500 p-2" data-testid="companion-clinical-quote">
      <p class="text-amber-100">{{ data.patient?.name }} · {{ labels[selected.kind] }} · 대기 포함 약{{ data.quote.turns }}턴{{ data.quote.quality===null?'':` · 예상Q ${data.quote.quality}` }}</p>
      <p class="my-1 text-ash-300">진료 동안 출혈과 시간은 흐른다. 약과 완성 처치는 완료 때 적용하며, 절반 진행한 부목은 중단해도 반쪽으로 남을 수 있다. 실제 품질·약효는 완료 시점의 몸과 여건을 따른다.</p>
      <p v-if="selected.kind==='diagnose'" class="my-1">숙달에 따라 상처·복부·맥 등을 살피고, 마친 소견은 정한 환자의 기록에 남는다.</p>
      <p v-if="selected.kind==='extract'" class="my-1 text-amber-200">이물질을 뽑으면 출혈이 늘거나 상처가 더 커질 수 있다.</p>
      <p v-for="line in data.quote.lines" :key="line" class="my-1 text-ash-300">{{ line }}</p>
      <label v-if="selected.kind==='amputate'" class="my-2 block text-red-300"><input v-model="consent" type="checkbox" data-testid="companion-clinical-permanent-consent" /> 정한 환자의 해당 부위가 영구적으로 사라지고 출혈·실신·사망할 수 있음을 확인했다.</label>
      <p v-if="data.quote.error" class="my-2 text-red-300" data-testid="companion-clinical-error">{{ data.quote.error }}</p>
      <div class="mt-2 flex flex-wrap gap-2"><button class="dbtn-gold" :disabled="simulating||!!data.quote.error||selected.kind==='amputate'&&!consent" data-testid="companion-clinical-confirm" @click="confirm">{{ labels[selected.kind] }} 시작</button><button v-if="selected.kind!=='amputate'" class="dbtn" :disabled="simulating||!!data.quote.error||draft.length>=data.planQuote.maxSteps" data-testid="companion-care-plan-add" @click="addStep">처치 순서에 추가</button><button class="dbtn" @click="clear">취소</button></div>
    </div>
    <section v-if="draft.length" class="my-3 border border-amber-900 bg-amber-950/20 p-2" data-testid="companion-care-plan-draft">
      <p class="text-amber-100">{{ data.patient?.name }} · 맡길 순서 {{ draft.length }}/{{ data.planQuote.maxSteps }}</p>
      <p class="my-2 text-ash-300">확인한 순서대로 한 번씩 시행한다. 원래 약·실·붕대 수량을 함께 검토하며, 상태나 물품이 바뀌면 멈춘다. 절단은 별도로 확인한다.</p>
      <div v-for="(step,index) in draft" :key="index" class="my-1 flex flex-wrap items-center gap-1"><span class="mr-auto">{{ index+1 }}. {{ labels[step.kind] }}{{ step.woundId===undefined?'':` · 상처 #${step.woundId}` }}</span><button class="dbtn" :disabled="simulating||index===0" :aria-label="`${index+1}번째 위로`" @click="moveStep(index,-1)">↑</button><button class="dbtn" :disabled="simulating||index===draft.length-1" :aria-label="`${index+1}번째 아래로`" @click="moveStep(index,1)">↓</button><button class="dbtn" :disabled="simulating" :aria-label="`${index+1}번째 제거`" @click="draft.splice(index,1)">제거</button></div>
      <details v-for="(step,index) in data.planned" :key="index" class="my-2 text-ash-300"><summary class="cursor-pointer">{{ index+1 }}. {{ step.label }} · {{ step.turns }}턴{{ step.quality===null?'':` · 검토 Q ${step.quality}` }}</summary><p v-if="step.tool" class="my-1">도구 {{ step.tool }}</p><p v-for="material in step.materials" :key="material" class="my-1">{{ material }}</p><p v-for="(line,j) in step.lines" :key="j" class="my-1">{{ line }}</p></details>
      <p v-if="data.planQuote.error" class="my-2 text-red-300" data-testid="companion-care-plan-error">{{ data.planQuote.error }}</p>
      <p v-else class="my-2 text-ash-300">약 {{ data.planQuote.turns }}턴 · 출혈과 시간은 계속 흐른다. 실제 처치 품질과 약효는 매 단계의 상태를 따른다.</p>
      <div class="mt-2 flex gap-2"><button class="dbtn-gold" :disabled="simulating||!!data.planQuote.error" data-testid="companion-care-plan-start" @click="startPlan">이 순서대로 맡기기</button><button class="dbtn" :disabled="simulating" @click="draft=[]">비우기</button></div>
    </section>
    <details v-if="data.report" class="my-2" data-testid="companion-clinical-report"><summary class="cursor-pointer">{{ data.patient?.name }} · 이 동료의 마지막 진찰 기록 · {{ data.report.at }}턴</summary><p class="my-1 text-ash-400">당시 검사 소견이다. 현재 몸 상태를 다시 검사한 결과가 아니다.</p><p v-for="(finding,index) in data.report.findings" :key="index" class="my-1">{{ finding }}</p></details>
  </details>
</template>
