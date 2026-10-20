<script setup lang="ts">
import {computed} from 'vue'
import {player,turnOf,TURNS_PER_DAY,type World} from '../../core'
import {postRumorError,publicRumors,rumorClaimText} from '../../core/rumor-network'
import {rumorList} from '../../core/rumor-state'
import {version,world,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,p=player(w),person=w.s.creatures.find(c=>c.id===props.personId);return{w,known:rumorList(w,p).filter(r=>r.relay),offers:person?publicRumors(w,p).map(r=>({r,error:postRumorError(w,p,person,r.id)})):[],now:turnOf(w)}})
const fieldLabels={count:'인원수',place:'장소',faction:'세력',when:'시점'}
</script>
<template>
  <section v-if="data.offers.length||data.known.length" class="my-3 border border-ash-600 p-2 text-xs" data-testid="rumor-network-panel">
    <h3 class="font-bold">정착지의 소식</h3>
    <p class="my-1 text-ash-400">아는 소식을 현지 주민에게 전할 수 있다. 먼 곳까지 전해지는 데 시간이 걸리며, 들은 말은 실제 사실과 다를 수 있다.</p>
    <div v-for="row in data.offers" :key="row.r.id" class="my-2" data-testid="rumor-post-offer">
      <p>{{ rumorClaimText(data.w,row.r) }}</p>
      <button class="dbtn" data-testid="post-rumor" :disabled="simulating||!!row.error" @click="doAct({type:'postRumor',target:personId,rumorId:row.r.id})">소식 전하기 (1턴)</button>
      <span v-if="row.error" class="ml-2 text-ash-400">{{ row.error }}</span>
    </div>
    <div v-for="r in data.known" :key="r.id" class="my-2" data-testid="heard-town-rumor">
      <p>{{ rumorClaimText(data.w,r) }}</p>
      <p class="text-ash-400">{{ r.hop===0?'목격자':r.hop===1?'전해 들음':'떠도는 말' }} · {{ r.source }} · 기록 {{ Math.floor(r.writtenAt/TURNS_PER_DAY)+1 }}일차 · {{ Math.floor((data.now-r.foundAt)/TURNS_PER_DAY) }}일 전 들음</p>
      <p v-if="r.relay?.suspected" class="text-amber-200">{{ fieldLabels[r.relay.suspected] }} 이야기가 의심스럽다.</p>
    </div>
  </section>
</template>
