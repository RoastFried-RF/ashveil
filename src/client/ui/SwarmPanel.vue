<script setup lang="ts">
import {computed} from 'vue'
import {player,allItems,mothStudyQuote,cheb,canSee,swarmCaptureQuote,validSwarmRule,type World} from '../../core'
import type {SwarmDef} from '../../core/types'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const data=computed(()=>{
 void version.value;const w=world.value as World,p=player(w)
 return{pigments:p.bag.filter(it=>!!w.db.item(it.def).camouflageCoating),groups:(w.s.map.swarms??[]).filter(s=>s.members>0&&s.cohesion>0&&cheb(p.pos,s.pos)<=1&&canSee(w,p,s.pos)).flatMap(s=>{const d=validSwarmRule(w,s);if(!d)return[];const tool=allItems(p).find(i=>i.def===d.captureTool&&i.count>0),q=swarmCaptureQuote(w,p,s.uid,tool?.uid);return[{id:s.uid,label:d.label,tool:tool?.uid,error:q.error}]}),specimens:w.db.all<SwarmDef>('Swarm').flatMap(d=>{const items=p.bag.filter(it=>it.def===d.bodyItem);return items.length?[{...items[0],total:items.reduce((n,it)=>n+it.count,0),error:mothStudyQuote(w,p,items[0].uid).error}]:[]})}
})
</script>
<template>
  <section v-if="data.groups.length||data.specimens.length||data.pigments.length" class="mt-3 border-t border-ash-600 pt-2 text-xs" data-testid="swarm-panel">
    <h3 class="mb-1 font-bold">나방 채집·표본</h3>
    <p class="mb-2 text-ash-400">불빛에서 벗어나면 흩어진다. 면포로 잡은 표본은 먹거나 날개 가루로 가공할 수 있다.</p>
    <div v-for="group in data.groups" :key="group.id" class="mb-2 flex items-center gap-2">
      <button class="dbtn" :disabled="simulating||!!group.error" :title="group.error??'곁의 원래 군체에서 채집 · 1턴'" :data-capture-swarm="group.id" @click="doAct({type:'captureSwarm',target:group.id,toolUid:group.tool!})">{{ group.label }} · 면포로 채집</button>
      <span class="text-ash-400">{{ group.error??'천 조각 사용 · 1턴' }}</span>
    </div>
    <button v-for="it in data.specimens" :key="it.uid" class="dbtn mr-2" :disabled="simulating||!!it.error" :title="it.error??'실제 한 마리를 소비해 구조 기록 · 1턴'" :data-study-moths="it.uid" @click="doAct({type:'studyMoths',uid:it.uid})">표본 한 마리 살피기 (총 {{ it.total }}마리)</button>
    <button v-for="it in data.pigments" :key="'dust'+it.uid" class="dbtn mr-2 mt-2" :disabled="simulating" :data-apply-camouflage="it.uid" @click="doAct({type:'applyCamouflage',uid:it.uid})">회색 위장 가루 바르기 ({{ it.count }})</button>
  </section>
</template>
