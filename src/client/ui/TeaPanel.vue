<script setup lang="ts">
import {computed,ref} from 'vue'
import {brewQuote,drinkVolume,itemDef,itemLabel,nearbyPines,needlesQuote,player,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const selected=ref<number>()
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w),leaves=p.bag.filter(i=>!!itemDef(w,i).brew);return{w,p,leaves,pines:nearbyPines(w,p).map(pos=>({pos,q:needlesQuote(w,p,pos)})),bottles:p.bag.filter(i=>leaves.some(l=>itemDef(w,l).brew!.bottles.includes(i.def))).map(it=>({it,ml:drinkVolume(w,it),q:brewQuote(w,p,it.uid,selected.value)}))}})
</script>
<template>
  <section v-if="d.pines.length||d.leaves.length||d.p.brewJob" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="tea-panel">
    <div v-if="d.p.brewJob" data-testid="brew-progress" class="mb-2 text-amber-200">
      원래 물병의 차 끓이기 · 남은 {{ d.p.brewJob.remaining }}/{{ d.p.brewJob.total }}턴
      <button class="dbtn ml-1" data-tea-action="cancel" :disabled="simulating" @click="doAct({type:'cancelBrew'})">차 끓이기 취소</button>
      <p>같은 물·솔잎과 원래 모닥불로 남은 시간을 이어 간다. 취소하면 쓴 시간은 되돌아오지 않는다.</p>
    </div>
    <p>솔잎차 · 솔잎과 물병 속 실제 물을 장작불에 끓인다</p>
    <div v-for="g in d.pines" :key="g.pos.x+','+g.pos.y" class="my-1">
      소나무 {{ g.pos.x }},{{ g.pos.y }}
      <button class="dbtn m-1" :disabled="simulating||!!g.q.error" :title="g.q.error??''" data-tea-action="gather" @click="doAct({type:'gatherNeedles',pos:g.pos})">솔잎 모으기 ({{ g.q.turns }}턴)</button>
      <span v-if="g.q.error" class="text-ash-400">{{ g.q.error }}</span>
    </div>
    <template v-if="d.leaves.length">
      <select v-model="selected" class="my-1 bg-[#211e18] p-1" aria-label="솔잎차에 사용할 원래 솔잎"><option :value="undefined">배낭의 솔잎 자동 선택</option><option v-for="i in d.leaves" :key="i.uid" :value="i.uid">{{ itemLabel(d.w,i) }} ×{{ i.count }}</option></select>
      <p>300ml당 비타민6 · 신선6시간 · 끓여도 재와 소금은 남는다</p>
      <div v-for="b in d.bottles" :key="b.it.uid" class="my-2" :data-tea-bottle="b.it.uid">
        <p>{{ itemLabel(d.w,b.it) }} · 실제 {{ b.ml }}ml</p>
        <button class="dbtn my-1" :disabled="simulating||!!b.q.error" :title="b.q.error??''" data-tea-action="brew" @click="doAct({type:'brewTea',uid:b.it.uid,leafUid:selected})">이 물병에 차 끓이기 ({{ b.q.turns }}턴)</button>
        <p v-if="b.q.error" class="text-ash-400">{{ b.q.error }}</p>
      </div>
    </template>
  </section>
</template>
