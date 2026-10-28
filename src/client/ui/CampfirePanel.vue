<script setup lang="ts">
import { computed, ref } from 'vue'
import { campfireAccessError, campfireAt, campfireDef, fireTurnsLeft, fireWorkQuote, itemLabel, nearbyCampfires, player, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const chosen=ref<Record<number,string>>({})
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{w,p,fuel:p.bag.filter((i)=>i.def===campfireDef(w).fuel),fires:nearbyCampfires(w,p).map((pos)=>({pos,uid:campfireAt(w,pos)!.uid,left:fireTurnsLeft(w,pos),error:campfireAccessError(w,p,pos)}))}})
function quote(uid:number,pos:{x:number;y:number}){return fireWorkQuote(d.value.w,d.value.p,pos,Number(chosen.value[uid]))}
</script>
<template>
  <section v-if="d.fires.length" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="campfire-panel">
    <p>주변에 설치된 모닥불 · 관리할 수 있는 불에 땔감을 넣거나 불을 끈다</p>
    <div v-for="f in d.fires" :key="f.uid" :data-fire-uid="f.uid" class="my-2">
      <p>{{ f.pos.x }},{{ f.pos.y }} · {{ f.left>0?f.error?'불이 타고 있음':`연료 약${Math.floor(f.left/20)}분 남음`:'꺼진 모닥불' }}</p>
      <p v-if="f.error" class="text-ash-400" data-testid="campfire-access-error">{{ f.error }}</p>
      <template v-else>
        <select v-model="chosen[f.uid]" class="my-1 max-w-56 bg-[#211e18] p-1" :aria-label="`모닥불 ${f.uid} 땔감`"><option :value="undefined" disabled>배낭의 실제 땔감 선택</option><option v-for="i in d.fuel" :key="i.uid" :value="String(i.uid)">{{ itemLabel(d.w,i) }} ×{{ i.count }} · {{ Math.max(0,...Object.values(i.wetness??{})) }}% 젖음</option></select>
        <button class="dbtn m-1" :disabled="simulating||!!quote(f.uid,f.pos).error" :title="quote(f.uid,f.pos).error??''" data-fire-action="fuel" @click="doAct({type:'fireWork',pos:f.pos,uid:Number(chosen[f.uid])})">{{ f.left>0?'땔감 넣기':'불 피우기' }}<span v-if="!quote(f.uid,f.pos).error"> ({{ quote(f.uid,f.pos).turns }}턴)</span></button>
        <button class="dbtn m-1" :disabled="simulating||!f.left" data-fire-action="out" @click="doAct({type:'extinguishFire',pos:f.pos})">불 끄기 (1턴)</button>
      </template>
    </div>
  </section>
</template>
