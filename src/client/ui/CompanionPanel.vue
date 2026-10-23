<script setup lang="ts">
import { computed } from 'vue'
import { companionAccess, hireQuote, isCompanion, itemLabel, player, turnOf, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
import CompanionCartographyPanel from './CompanionCartographyPanel.vue'
import CompanionCarePanel from './CompanionCarePanel.vue'
const props=defineProps<{personId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,c=w.s.creatures.find((c)=>c.id===props.personId)!;const now=turnOf(w),trial=Math.max(0,Math.ceil(((c.companion?.trialUntil??0)-now)/1200)),afterTrial=Math.max(0,Math.ceil(((c.companion?.paidUntil??0)-Math.max(now,c.companion?.trialUntil??0))/1200));return{w,c,trial,afterTrial,bound:isCompanion(w,c),quote:hireQuote(w,c),access:companionAccess(w,c),hours:Math.max(0,Math.ceil(((c.companion?.paidUntil??0)-turnOf(w))/1200)),bag:player(w).bag}})
</script>
<template>
  <details v-if="data.bound||data.w.db.creature(data.c.def).ai==='guard'" class="my-2 border border-ash-700 p-2" data-testid="companion-panel">
    <summary class="cursor-pointer text-sm">동행·급료 <span v-if="data.bound">· {{ data.c.companion!.status==='unpaid'?'급료 대기':data.trial?`시험 동행 ${data.trial}시간`:`${data.hours}시간 동행 가능` }}<span v-if="data.trial&&data.afterTrial"> · 이후 선불 {{ data.afterTrial }}시간</span></span></summary>
    <template v-if="data.bound">
      <p class="my-2 text-xs" data-testid="companion-attitude">{{ !data.c.companion!.bond?.heard?'아직 함께 지내는 마음을 물어보지 않았다':data.c.companion!.bond.heard.attitude==='trust'?'믿고 함께 갈 만하다고 했다':data.c.companion!.bond.heard.attitude==='neutral'?'아직 서로 알아 가는 사이라고 했다':data.c.companion!.bond.heard.attitude==='uneasy'?'함께 지내는 것이 불편하다고 했다':'더 함께 갈지 고민한다고 했다' }}<span v-if="data.c.companion!.bond?.heard"> · {{ Math.floor(data.c.companion!.bond.heard.turn/28800)+1 }}일차에 들음</span></p>
      <p class="my-2 text-xs text-ash-400">함께 지내는 시간과 성향, 약속한 급료가 관계에 쌓인다. 마음이 상하면 동행을 끝낼 수 있다. 다시 이야기해 현재 마음을 듣자.</p>
      <p class="my-2 text-xs">{{ data.c.companion!.order==='follow'?'곁에서 동행':data.c.companion!.order==='hold'?'현지 대기':'주변 방어' }} · 식수·식량과 몸 상태는 각자 필요하다. 출입구 곁에 모여야 함께 이동한다.</p>
      <div class="flex flex-wrap gap-1">
        <button class="dbtn" :disabled="simulating||!!data.access||data.c.companion!.status!=='employed'" data-testid="companion-follow" @click="doAct({type:'commandCompanion',target:personId,order:'follow'})">동행 (1턴)</button>
        <button class="dbtn" :disabled="simulating||!!data.access" data-testid="companion-hold" @click="doAct({type:'commandCompanion',target:personId,order:'hold'})">이 자리 대기 (1턴)</button>
        <button class="dbtn" :disabled="simulating||!!data.access||data.c.companion!.status!=='employed'" @click="doAct({type:'commandCompanion',target:personId,order:'defend'})">주변 방어 (1턴)</button>
        <button class="dbtn" :disabled="simulating||!!data.access" data-testid="companion-pay" @click="doAct({type:'payCompanion',target:personId})">하루 급료 {{ data.quote.wage }}표 (1턴)</button>
        <button class="dbtn" :disabled="simulating||!!data.access" data-testid="companion-dismiss" @click="doAct({type:'dismissCompanion',target:personId})">이곳에서 헤어지기 (1턴)</button>
      </div>
      <details class="mt-2 text-xs"><summary>배낭 물품 건네기 · 한 묶음/1턴</summary><button v-for="item in data.bag" :key="item.uid" class="dbtn m-1" :disabled="simulating||!!data.access" :data-give-uid="item.uid" @click="doAct({type:'giveCompanion',target:personId,uid:item.uid})">{{ itemLabel(data.w,item) }} ×{{ item.count }}</button></details>
      <CompanionCartographyPanel :person-id="personId" />
      <CompanionCarePanel :person-id="personId" />
      <p v-if="data.access" class="my-1 text-xs text-red-300">{{ data.access }}</p>
    </template>
    <template v-else>
      <p class="my-2 text-xs">첫 하루 포함 {{ data.quote.fee }}표 · 이후 하루 {{ data.quote.wage }}표. 기간이 끝나면 현지에서 급료를 기다린다. 헤어지면 선불은 돌려받지 않는다.</p>
      <p v-if="data.quote.error" class="text-xs text-red-300">{{ data.quote.error }}</p>
      <button class="dbtn" :disabled="simulating||!!data.quote.error" data-testid="companion-hire" @click="doAct({type:'hireCompanion',target:personId})">동료 고용 (1턴)</button>
    </template>
  </details>
</template>
