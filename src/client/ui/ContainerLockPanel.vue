<script setup lang="ts">
import {computed} from 'vue'
import {itemLabel,lockPickQuote,nearbyContainerLocks,player,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const data=computed(()=>{void version.value;const w=world.value as World,pl=player(w);return{w,locks:nearbyContainerLocks(w,pl).map(lock=>({...lock,pick:lockPickQuote(w,pl,lock.pos)}))}})
</script>
<template>
  <section v-if="data.locks.length" class="df df-tab mb-2 text-xs" data-testid="container-locks">
    <div v-for="lock in data.locks" :key="lock.pos.x+','+lock.pos.y" class="mb-1">
      <span>{{ lock.label }} · 잠김</span>
      <span v-if="lock.quote.tool"> · {{ itemLabel(data.w,lock.quote.tool) }} · {{ lock.quote.turns }}턴 · 완료 시 내구 −{{ data.w.db.terrain(data.w.s.map.tiles[lock.pos.y*data.w.s.map.w+lock.pos.x].t).lock!.wear }}</span>
      <span v-if="lock.quote.error" class="ml-2 text-amber-200">{{ lock.quote.error }}</span>
      <button class="dbtn ml-2" :data-testid="'pry-container-'+lock.pos.x+'-'+lock.pos.y" :disabled="simulating||!!lock.quote.error" @click="doAct({type:'pryContainer',pos:lock.pos})">잠금쇠 벌리기</button>
      <div class="mt-1">
        <span v-if="lock.pick.tool">{{ itemLabel(data.w,lock.pick.tool) }} · {{ lock.pick.turns }}턴 · 성공 {{ lock.pick.chance }}% · 내구 −{{ lock.pick.rule!.wear }} · 소음 {{ lock.pick.rule!.noise }}</span>
        <span v-else class="text-amber-200">{{ lock.pick.error }}</span>
        <button class="dbtn ml-2" :data-testid="'pick-lock-'+lock.pos.x+'-'+lock.pos.y" :disabled="simulating||!!lock.pick.error" @click="doAct({type:'pickLock',pos:lock.pos})">정밀 잠금 따기</button>
      </div>
    </div>
    <p>벌리기는 큰 소리가 난다. 정밀 작업은 실패해도 시간과 내구를 쓴다. 잠금을 푼 뒤 상자는 따로 수색하고, 문은 한 번 더 열어야 한다.</p>
  </section>
</template>
