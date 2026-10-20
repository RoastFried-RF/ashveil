<script setup lang="ts">
import {computed} from 'vue'
import {itemLabel,nearbyContainerLocks,player,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const data=computed(()=>{void version.value;const w=world.value as World;return{w,locks:nearbyContainerLocks(w,player(w))}})
</script>
<template>
  <section v-if="data.locks.length" class="df df-tab mb-2 text-xs" data-testid="container-locks">
    <div v-for="lock in data.locks" :key="lock.pos.x+','+lock.pos.y" class="mb-1">
      <span>{{ lock.label }} · 잠김</span>
      <span v-if="lock.quote.tool"> · {{ itemLabel(data.w,lock.quote.tool) }} · {{ lock.quote.turns }}턴 · 완료 시 내구 −{{ data.w.db.terrain(data.w.s.map.tiles[lock.pos.y*data.w.s.map.w+lock.pos.x].t).lock!.wear }}</span>
      <span v-if="lock.quote.error" class="ml-2 text-amber-200">{{ lock.quote.error }}</span>
      <button class="dbtn ml-2" :data-testid="'pry-container-'+lock.pos.x+'-'+lock.pos.y" :disabled="simulating||!!lock.quote.error" @click="doAct({type:'pryContainer',pos:lock.pos})">잠금쇠 벌리기</button>
    </div>
    <p>큰 소리가 나며, 잠금을 연 뒤 원래 상자를 따로 수색한다.</p>
  </section>
</template>
