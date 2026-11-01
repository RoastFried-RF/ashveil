<script setup lang="ts">
import { computed, ref } from 'vue'
import { campfireAccessError, campfireAt, campfireDef, fireTurnsLeft, fireWorkQuote, nearbyCampfires, player, type World } from '../../core'
import {t}from'../locale'
import {displayItemLabel as itemLabel}from'../locales/item'
import { simulating, version, world } from '../store'
import { doAct } from '../ui'
const chosen=ref<Record<number,string>>({})
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w);return{w,p,fuel:p.bag.filter((i)=>i.def===campfireDef(w).fuel),fires:nearbyCampfires(w,p).map((pos)=>({pos,uid:campfireAt(w,pos)!.uid,left:fireTurnsLeft(w,pos),error:campfireAccessError(w,p,pos)}))}})
function quote(uid:number,pos:{x:number;y:number}){return fireWorkQuote(d.value.w,d.value.p,pos,Number(chosen.value[uid]))}
</script>
<template>
  <section v-if="d.fires.length" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="campfire-panel">
    <p>{{ t('주변에 설치된 모닥불 · 관리할 수 있는 불에 땔감을 넣거나 불을 끈다') }}</p>
    <div v-for="f in d.fires" :key="f.uid" :data-fire-uid="f.uid" class="my-2">
      <p>{{ f.pos.x }},{{ f.pos.y }} · {{ f.left>0?f.error?t('불이 타고 있음'):t('연료 약{0}분 남음',Math.floor(f.left/20)):t('꺼진 모닥불') }}</p>
      <p v-if="f.error" class="text-ash-400" data-testid="campfire-access-error">{{ t(f.error) }}</p>
      <template v-else>
        <select v-model="chosen[f.uid]" class="my-1 max-w-56 bg-[#211e18] p-1" :aria-label="t('모닥불 {0} 땔감',f.uid)"><option :value="undefined" disabled>{{ t('배낭의 실제 땔감 선택') }}</option><option v-for="i in d.fuel" :key="i.uid" :value="String(i.uid)">{{ t('{0} · {1}% 젖음',itemLabel(d.w,i),Math.max(0,...Object.values(i.wetness??{}))) }}</option></select>
        <button class="dbtn m-1" :disabled="simulating||!!quote(f.uid,f.pos).error" :title="t(quote(f.uid,f.pos).error??'')" data-fire-action="fuel" @click="doAct({type:'fireWork',pos:f.pos,uid:Number(chosen[f.uid])})">{{ t(f.left>0?'땔감 넣기':'불 피우기') }}<span v-if="!quote(f.uid,f.pos).error"> ({{ t('{0}턴',quote(f.uid,f.pos).turns) }})</span></button>
        <button class="dbtn m-1" :disabled="simulating||!f.left" data-fire-action="out" @click="doAct({type:'extinguishFire',pos:f.pos})">{{ t('불 끄기 (1턴)') }}</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.dbtn{white-space:normal;max-width:100%;overflow-wrap:anywhere}
</style>
