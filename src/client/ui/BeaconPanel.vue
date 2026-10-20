<script setup lang="ts">
import { computed, ref } from 'vue'
import { beaconFuelQuote, beaconSignalQuote, knownBeaconPosts, nearbyBeacons, player, rumorSignalKey, turnOf, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const selection=ref<Record<number,{rumor:string;to:number}>>({})
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),posts=knownBeaconPosts(w),rumors=w.s.knowledge.rumors??[]
 return nearbyBeacons(w,p).map(post=>{
  const other=posts.filter(o=>o.address.uid!==post.address.uid&&o.config.network===post.config.network),sel=selection.value[post.address.uid],r=rumors.find(r=>rumorSignalKey(r)===sel?.rumor)??rumors[0],to=other.find(o=>o.address.uid===sel?.to)??other[0],fuel=p.bag.find(i=>i.def===post.config.fuel&&i.count>0)
  return{post,other,rumors:rumors.map(r=>({key:rumorSignalKey(r),text:r.text})),r,to,fuel,fuelQuote:beaconFuelQuote(w,p,post.address.pos,post.address.uid,fuel?.uid??-1),signal:to&&r?beaconSignalQuote(w,p,post.address.pos,post.address.uid,to.address,rumorSignalKey(r)):undefined,left:Math.max(0,post.state.fuelUntil-turnOf(w)),packets:w.s.overworld?.signals?.filter(s=>s.from.uid===post.address.uid&&!s.deliveredAt&&!s.failed)??[]}
 })
})
function choose(uid:number,field:'rumor'|'to',value:string){const s=selection.value[uid]??={rumor:'',to:-1};if(field==='to')s.to=Number(value);else s.rumor=value}
</script>
<template>
  <section v-for="row in data" :key="row.post.address.uid" class="my-3 border border-ash-600 p-2 text-xs" data-testid="beacon-panel">
    <h3 class="mb-1 font-bold">해안 봉화와 수신 기록</h3>
    <p>남은 실제 연료 {{ row.left }}턴 · 도착한 기록 {{ row.post.state.inbox.length }}건</p>
    <button class="dbtn my-1" :disabled="simulating||!!row.fuelQuote.error" :title="row.fuelQuote.error??'원래 땔감 한 개를 완료 때 소비한다'" data-testid="beacon-fuel" @click="doAct({type:'beaconFuel',pos:row.post.address.pos,uid:row.post.address.uid,fuelUid:row.fuel!.uid})">땔감 넣고 불 살리기 · {{ row.fuelQuote.turns }}턴</button>
    <button class="dbtn ml-1" :disabled="simulating" data-testid="beacon-read" @click="doAct({type:'beaconRead',pos:row.post.address.pos,uid:row.post.address.uid})">수신 기록 읽기 · 1턴</button>
    <p class="my-1 text-ash-300">방문한 원래 봉화 사이에서 이미 아는 소식을 전한다. 양쪽 불이 살아 있을 때 두 배 속도로 진행하며, 꺼지면 남은 전송이 멈춘다.</p>
    <template v-if="row.r&&row.to">
      <label class="block my-1">아는 소식 <select class="max-w-full bg-ash-900" :value="rumorSignalKey(row.r)" aria-label="봉화로 보낼 소식" @change="choose(row.post.address.uid,'rumor',($event.target as HTMLSelectElement).value)"><option v-for="r in row.rumors" :key="r.key" :value="r.key">{{ r.text }}</option></select></label>
      <label class="block my-1">실제 수신소 <select class="bg-ash-900" :value="row.to.address.uid" aria-label="봉화 수신소" @change="choose(row.post.address.uid,'to',($event.target as HTMLSelectElement).value)"><option v-for="to in row.other" :key="to.address.uid" :value="to.address.uid">{{ to.label }}</option></select></label>
      <button class="dbtn" :disabled="simulating||!!row.signal?.error" :title="row.signal?.error??'직접 아는 내용과 원래 출처만 전한다'" data-testid="beacon-send" @click="doAct({type:'beaconSend',pos:row.post.address.pos,uid:row.post.address.uid,to:row.to.address,rumorKey:rumorSignalKey(row.r)})">소식 부호화 · {{ row.signal?.turns }}턴 + 전송 {{ row.signal?.travelTurns }}턴</button>
      <p v-if="row.signal?.error" class="text-ash-400">{{ row.signal.error }}</p>
    </template>
    <p v-else class="text-ash-400">직접 아는 소식과 방문한 다른 수신 봉화가 필요하다.</p>
    <p v-for="packet in row.packets" :key="packet.key" class="mt-1 text-amber-200" data-testid="beacon-progress">전송 {{ packet.progress }}/{{ packet.total }} · 양쪽 연료가 있어야 진행</p>
  </section>
</template>
