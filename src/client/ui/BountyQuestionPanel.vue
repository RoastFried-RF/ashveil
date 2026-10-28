<script setup lang="ts">
import {computed} from 'vue'
import {bountyQuestionQuote,creatureById,factionDef,isBounty,player,type World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>()
const rows=computed(()=>{void version.value;const w=world.value as World,target=creatureById(w,props.personId)!
 return(w.s.overworld?.contracts??[]).filter(isBounty).filter(r=>r.status==='active'&&r.claimedFaction&&r.targets.includes(target.id)).map(r=>({r,claim:factionDef(w,r.claimedFaction!)?.label??r.claimedFaction,actual:r.testimony?(factionDef(w,r.testimony.faction)?.label??r.testimony.faction):undefined,error:bountyQuestionQuote(w,player(w),target,r.id).error}))})
</script>
<template>
  <div v-for="row in rows" :key="row.r.id" class="my-2 border border-ash-600 p-2 text-xs" data-testid="bounty-question-panel">
    <p>{{ row.r.label }} · 의뢰인은 {{ row.claim }} 소속이라고 주장했다.</p>
    <p v-if="row.r.testimony" data-testid="bounty-testimony">{{ row.r.testimony.name }}에게 직접 들은 소속: {{ row.actual }}. {{ row.r.testimony.faction!==row.r.claimedFaction?'의뢰인의 설명과 다르다. 처치 없이 장부에 이의를 보고할 수 있다.':'의뢰인의 설명과 같다.' }}</p>
    <template v-else><p class="text-ash-400">{{ row.error??'당사자의 설명을 직접 듣고 기록한다.' }}</p><button class="dbtn mt-1" :disabled="simulating||!!row.error" data-testid="bounty-question" @click="doAct({type:'bountyQuestion',target:props.personId,contract:row.r.id})">의뢰의 소속 주장 묻기 (1턴)</button></template>
  </div>
</template>
