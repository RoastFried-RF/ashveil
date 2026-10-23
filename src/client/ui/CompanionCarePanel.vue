<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {companionAccess,companionAidRule,companionCareQuote,isMissing,itemDef,itemLabel,part,player,woundDef,type CompanionCareKind,type CompanionCareRequest,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>(),selected=ref<CompanionCareRequest|null>(null)
const labels:Record<CompanionCareKind,string>={bandage:'붕대 감기',disinfect:'상처 씻기',splint:'부목 대기'}
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),c=w.s.creatures.find(c=>c.id===props.personId)!
 const wounds=p.body.wounds.filter(wd=>!wd.internal&&wd.healed<wd.severity&&!isMissing(w,p,wd.part)).map(wd=>{
  const kinds:CompanionCareKind[]=['bandage','disinfect'];if(wd.fracture)kinds.push('splint')
  return{id:wd.id,label:`${part(w,p,wd.part).label} · ${woundDef(w,wd).label}`,arterial:!!wd.arterial,options:kinds.map(kind=>({kind,quote:companionCareQuote(w,c,{kind,woundId:wd.id})}))}
 })
 const wound=wounds.find(wound=>wound.id===selected.value?.woundId),option=wound?.options.find(option=>option.kind===selected.value?.kind)
 const supplies=p.bag.filter(it=>!it.missingItem&&!it.dirty&&!itemDef(w,it).medical?.dirty&&['bandage','disinfect','splint'].includes(itemDef(w,it).medical?.kind??'')&&(it.uses??1)>0).map(it=>({uid:it.uid,count:it.count,label:itemLabel(w,it)}))
 const aid=c.companion?.aid,rally=aid?.anchor,here=rally?.map===w.s.map.id&&rally?.region===w.s.overworld?.currentRegion
 return{aidRule:companionAidRule(w),aidMode:aid?.mode??'off',rally:rally?(here?`현재 지도 (${rally.pos.x}, ${rally.pos.y})`:'다른 지도에 지정됨 · 현장에서 다시 지시'):undefined,working:c.activity?.kind==='rescueDrag'?'쓰러진 동료를 옮기는 중':c.activity?.patientId!==undefined?'동료 처치 중':undefined,wounds,chosen:wound&&option?{...wound,...option}:null,supplies,access:companionAccess(w,c)}
})
watch(()=>props.personId,()=>{selected.value=null})
watch(version,()=>{selected.value=null})
function confirm(){const wound=data.value.chosen;if(!wound||wound.quote.error)return;const q=wound.quote;if(!doAct({type:'companionCare',target:props.personId,request:{kind:wound.kind,woundId:wound.id},expectedUid:q.materialUid!,expectedTurns:q.turns,expectedQuality:q.quality!}))selected.value=null}
</script>
<template>
  <details class="my-2 border-t border-ash-700 pt-2 text-xs" data-testid="companion-care-panel">
    <summary class="cursor-pointer">응급 처치 부탁 · 붕대·세척·부목</summary>
    <section v-if="data.aidRule" class="my-3 border border-ash-600 bg-black/20 p-2" data-testid="companion-aid-policy">
      <p class="text-amber-100">상호 응급 처치·구조 · {{ data.aidMode==='off'?'자동 돌봄 꺼짐':data.aidMode==='firstAid'?'응급 처치 맡김':'응급 처치와 집결지 구조 맡김' }}</p>
      <p class="my-1 text-ash-300">안전할 때 자기 물품으로 나와 동료들의 출혈을 먼저 돌보고, 오염된 상처와 골절도 처치한다. 쓰러진 사람에게는 음식이나 물을 억지로 먹이지 않는다.</p>
      <p v-if="data.rally" class="my-1">안전 집결지 · {{ data.rally }}</p>
      <p v-if="data.working" class="my-1 text-amber-100">{{ data.working }}</p>
      <p class="my-1 text-ash-400">구조를 맡기면 현재 내 위치를 집결지로 기억한다. 관찰한 {{ data.aidRule.range }}칸 안에서 응급 처치 후, 출혈이 가라앉은 실신자를 한 칸씩 옮긴다. 물품·기력·급료와 안전한 길이 필요하다.</p>
      <div class="my-2 flex flex-wrap gap-1">
        <button class="dbtn" :disabled="simulating||!!data.access" data-testid="companion-aid-first" @click="doAct({type:'setCompanionAid',target:personId,mode:'firstAid'})">응급 처치 맡기기 (1턴)</button>
        <button class="dbtn-gold" :disabled="simulating||!!data.access" data-testid="companion-aid-rescue" @click="doAct({type:'setCompanionAid',target:personId,mode:'rescue'})">구조 맡기기·현재 위치를 집결지로 (1턴)</button>
        <button class="dbtn" :disabled="simulating||!!data.access||data.aidMode==='off'" data-testid="companion-aid-off" @click="doAct({type:'setCompanionAid',target:personId,mode:'off'})">자동 돌봄 끄기 (1턴)</button>
      </div>
    </section>
    <p class="my-2 text-ash-400">안전한 곁에서 동료가 가진 깨끗한 물품과 손을 쓴다. 처치 동안 기다리며, 실제 완료 때 물품1회분을 쓴다. 시작만으로 상처가 치료되지는 않는다.</p>
    <details v-if="data.supplies.length" class="my-2"><summary class="cursor-pointer">내 의료 물품을 먼저 건네기 · 한 묶음/1턴</summary><button v-for="item in data.supplies" :key="item.uid" class="dbtn m-1" :disabled="simulating||!!data.access" :data-care-give-uid="item.uid" @click="doAct({type:'giveCompanion',target:personId,uid:item.uid})">{{ item.label }} ×{{ item.count }}</button></details>
    <p v-if="!data.wounds.length" class="text-ash-400">부탁할 외부 상처가 없다.</p>
    <div v-for="wound in data.wounds" :key="wound.id" class="my-2 border border-ash-800 p-2" :data-care-wound="wound.id">
      <p>{{ wound.label }}</p>
      <p v-if="wound.arterial" class="my-1 text-amber-200">동맥 출혈은 붕대로 멈추지 않는다. 지혈대·의사의 처치가 필요하다.</p>
      <div v-for="option in wound.options" :key="option.kind" class="my-2" :data-care-kind="option.kind">
        <p v-if="option.quote.error" class="my-1 text-ash-400">{{ labels[option.kind] }} — {{ option.quote.error }}</p>
        <template v-else>
          <p class="my-1">{{ labels[option.kind] }} · {{ option.quote.materialLabel }}1회분 · 약{{ option.quote.turns }}턴 · 예상Q {{ option.quote.quality }}</p>
          <button class="dbtn" :disabled="simulating" @click="selected={kind:option.kind,woundId:wound.id}">이 처치 부탁</button>
        </template>
      </div>
    </div>
    <div v-if="data.chosen&&!data.chosen.quote.error" class="my-2 border border-ash-500 bg-black/25 p-2" data-testid="companion-care-confirmation">
      <p>{{ data.chosen.label }}에 동료의 {{ data.chosen.quote.materialLabel }}을 사용한다. 기다리는 동안 시간·출혈·몸 상태는 계속 진행한다. 완료 시점의 몸과 환경으로 품질을 계산한다.</p>
      <p v-if="data.chosen.kind==='splint'" class="mt-1 text-ash-400">절반 이상 진행한 부목은 중단해도 반쪽 부목으로 남고 물품을 쓸 수 있다.</p>
      <p v-else class="mt-1 text-ash-400">중단하면 완료 효과와 완성된 붕대가 남지 않는다.</p>
      <div class="mt-2 flex gap-2"><button class="dbtn-gold" :disabled="simulating" data-testid="companion-care-confirm" @click="confirm">처치 시작</button><button class="dbtn" @click="selected=null">취소</button></div>
    </div>
  </details>
</template>
