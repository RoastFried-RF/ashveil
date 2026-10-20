<script setup lang="ts">
import { computed } from 'vue'
import { undergroundKin } from '../../core/kinship-state'
import { canSee,hasLos,cheb,prisonerExchangeOffers,ransomQuote,economyDef,itemDef, itemLabel, inviteRecruitQuote, knownCreatureName, player, recruitmentQuote, prisonerCareAccess, prisonerQuote, rescuedBy, rescueCaptor, visiblePrisoners, type PrisonerOperation, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const actions:PrisonerOperation[]=['release','bind','escort','hold','interrogate','execute']
const labels={escort:'밧줄 잡고 호송',hold:'발목 다시 묶기',release:'풀어 주기',bind:'밧줄로 포박',interrogate:'소문 묻기',execute:'처형'}
function ransom(w:World,c:World['s']['creatures'][number]){const p=player(w),holder=w.s.creatures.find(o=>o.id===c.captivity?.captor);return holder&&holder!==p&&cheb(p.pos,holder.pos)<=1&&canSee(w,p,holder.pos)&&hasLos(w,p.pos,holder.pos)?{holder,quote:ransomQuote(w,p,holder,c),exchanges:prisonerExchangeOffers(w,p,holder,c)}:undefined}
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{w,currency:economyDef(w).currency,food:p.bag.filter((i)=>{const d=itemDef(w,i);return!!d.food||!!d.drink&&!d.drink.alcohol&&(i.uses??1)>0}).map((i)=>({uid:i.uid,label:itemLabel(w,i)})),rows:visiblePrisoners(w).map((c)=>({c,ransom:ransom(w,c),kin:undergroundKin(w,c),rescued:rescuedBy(w,p,c),rescuing:!!rescueCaptor(w,p,c),recruit:recruitmentQuote(w,p,c),invite:inviteRecruitQuote(w,p,c),canLetGo:p.leading?.target===c.id,name:knownCreatureName(w,c),careError:prisonerCareAccess(w,p,c),wakeError:prisonerCareAccess(w,p,c,true),actions:actions.map((operation)=>(prisonerQuote(w,p,c,operation)))}))}})
</script>
<template>
  <section v-for="row in data.rows" :key="row.c.id" class="my-2 border border-ash-700 p-2" data-testid="prisoner-panel" :data-prisoner-id="row.c.id">
    <p class="mb-2 text-sm">{{ row.name }} · {{ row.c.captivity?(row.c.captivity.escort?'밧줄 호송 중':row.c.captivity.anklesFree?'손목만 묶임':'밧줄에 묶임'):row.rescued?'구조된 사람':row.c.unconscious?'의식을 잃음':'항복' }}<span v-if="row.c.captivity&&row.c.unconscious"> · 의식 없음</span></p>
    <p v-if="row.rescuing||row.rescued" class="mb-2 text-xs text-ash-300">구조는 격퇴 경험치로 세지 않는다. 깨어서 구해 준 사람을 알아본 뒤에 구조 기억과 소식을 남긴다. 몸과 물품·기존 계약을 보존한다.</p>
    <p v-else-if="row.c.captivity?.surrendered===false||row.c.unconscious&&!row.c.captivity" class="mb-2 text-xs text-ash-300">살아 있는 사람을 실제 밧줄로 포박할 수 있다. 의식을 잃은 사람의 해방은 항복 보상으로 세지 않는다. 깨우기로 실신을 치료할 수 없다.</p>
    <p v-else-if="row.kin" class="mb-2 text-xs text-ash-300" data-testid="kinship-release-rule">풀려난 사람이 관로 출구로 걸어가 시야 밖으로 떠나면 {{ row.kin.delayDays }}일 뒤 친족에게 전한다. 죽이지 않은 무리의 소식 {{ row.kin.peaceReward>0?'+':'' }}{{ row.kin.peaceReward }} · 목격된 살해 {{ row.kin.killLoss }} / 우두머리 {{ row.kin.chiefLoss }}. 증인 없는 사건은 전해지지 않는다.</p>
    <p v-else class="mb-2 text-xs text-ash-300">석방 소식이 닿으면 평판+3 · 처형을 목격한 소식은 평판−5. 처형은 되돌릴 수 없다. 밧줄은 풀거나 사망하면 그 자리에 남는다.</p>
    <div v-if="row.c.captivity||!row.rescued" class="flex flex-wrap gap-1"><button v-for="action in row.actions" :key="action.operation" class="dbtn" :disabled="simulating||!!action.error" :title="action.error??''" :data-prisoner-action="action.operation" @click="doAct({type:'prisoner',target:row.c.id,operation:action.operation,ropeUid:action.ropeUid})">{{ labels[action.operation] }} ({{ action.turns }}턴)</button></div>
    <div v-if="row.ransom" class="my-2 border-y border-ash-700 py-2 text-xs" data-testid="ransom-panel">
      <p>현재 곁의 포박자와 합의가 끝나면 같은 포로를 풀고 {{ row.ransom.quote.price }}{{ data.currency }}를 상대 개인 지갑에 건넨다. 중단하면 지급하지 않는다.</p>
      <p v-if="row.ransom.exchanges.length" class="mt-1">상대 편의 포로를 실제로 붙잡고 있다면 두 사람의 석방을 교환할 수 있다. 합의가 끝나기 전에는 어느 쪽도 풀지 않는다.</p>
      <p v-else class="mt-1 text-ash-400">교환하려면 현재 직접 붙잡은 상대 편 포로가 함께 곁에 있어야 한다.</p>
      <button v-for="offer in row.ransom.exchanges" :key="offer.given.id" class="dbtn my-1 mr-1" :disabled="simulating" data-prisoner-action="exchange" :data-given-person="offer.given.id" @click="doAct({type:'prisonerExchange',holder:row.ransom.holder.id,person:row.c.id,given:offer.given.id,receivedRope:row.c.captivity?.rope.uid,givenRope:offer.given.captivity?.rope.uid})">{{ knownCreatureName(data.w,offer.given) }}과 교환 ({{ offer.quote.turns }}턴 · 돈 이동 없음)</button>
      <p v-if="row.ransom.quote.error" class="text-amber-200">{{ row.ransom.quote.error }}</p>
      <button class="dbtn mt-1" :disabled="simulating||!!row.ransom.quote.error" data-prisoner-action="ransom" @click="doAct({type:'ransom',holder:row.ransom.holder.id,person:row.c.id,expectedPrice:row.ransom.quote.price})">몸값과 석방 합의 ({{ row.ransom.quote.turns??'—' }}턴)</button>
    </div>
    <div v-if="row.c.captivity||row.rescued" class="mt-2 flex flex-wrap gap-1">
      <button v-if="row.canLetGo" class="dbtn" :disabled="simulating" data-prisoner-order="letGo" @click="doAct({type:'dropLeash'})">호송 밧줄 놓기 (1턴)</button>
      <button v-if="row.c.asleep" class="dbtn" :disabled="simulating||!!row.wakeError" :title="row.wakeError??''" data-prisoner-care="wake" @click="doAct({type:'wakePrisoner',target:row.c.id})">조심스레 깨우기</button>
      <button v-for="food in data.food" :key="food.uid" class="dbtn" :disabled="simulating||!!row.careError" :title="row.careError??''" data-prisoner-care="feed" :data-care-uid="food.uid" @click="doAct({type:'feedPrisoner',target:row.c.id,uid:food.uid})">{{ food.label }} 먹이기</button>
    </div>
    <div v-if="row.c.captivity||row.rescued" class="mt-2 flex flex-wrap gap-1">
      <button class="dbtn" :disabled="simulating||!!row.recruit.error" :title="row.recruit.error??''" data-prisoner-recruit="talk" @click="doAct({type:'recruitPrisoner',target:row.c.id})">동행 이야기 ({{ row.recruit.days.length }}/{{ row.recruit.target }}일 · {{ row.recruit.turns }}턴)</button>
      <button class="dbtn" :disabled="simulating||!!row.invite.error" :title="row.invite.error??''" data-prisoner-recruit="invite" @click="doAct({type:'inviteRecruit',target:row.c.id})">함께 가자 ({{ row.invite.turns }}턴)</button>
    </div>
    <p v-if="row.c.captivity||row.rescued" class="mt-2 text-xs text-ash-400">실제로 받은 열량{{ row.recruit.careKcal }}kcal·필요 수분{{ row.recruit.careWater }}ml 이상을 돌보고 {{ row.recruit.target }}일의 대화를 마친다. <span v-if="row.invite.probationDays">처음 동의한 사람은 시험 동행{{ row.invite.probationDays }}일, 이후 하루 급료{{ row.invite.wage }}표.</span><span v-else>전에 동행한 사람은 기존 약속 기한을 잇고, 기간이 끝났으면 하루 급료{{ row.invite.wage }}표를 기다린다.</span></p>
    <p v-if="row.c.captivity" class="mt-2 text-xs text-ash-400">호송에는 빈손 하나와 직접 걸을 수 있는 상대가 필요하다. 거리가 벌어지거나 잠들면 밧줄을 놓친다. 깨어 있을 때 실제 음식과 물을 먹일 수 있다. 감시자가 잠들거나 자리를 비우면 밧줄을 풀려 애쓸 수 있다.</p>
    <p v-if="!row.c.captivity&&!row.rescued" class="mt-2 text-xs text-ash-400">포박에는 배낭의 밧줄1개가 필요하다. F2에서 천으로 만들 수 있다.</p>
    <p v-if="row.rescued&&!row.c.captivity" class="mt-2 text-xs text-ash-400">곁에서 깨어 있는 몸에 실제 음식과 물을 먹일 수 있다. 안전하면 잠시 쉰 뒤 원래 자리로 돌아가며, 식량·수분·수면도 계속 필요하다.</p>
  </section>
</template>
