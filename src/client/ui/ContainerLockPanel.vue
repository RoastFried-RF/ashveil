<script setup lang="ts">
import {computed} from 'vue'
import {lockPickQuote,nearbyContainerLocks,player,terrainAt,type World} from '../../core'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
import{t,defText}from'../locale'
import{displayItemLabel as itemLabel}from'../locales/item'
const data=computed(()=>{void version.value;const w=world.value as World,pl=player(w);return{w,locks:nearbyContainerLocks(w,pl).map(lock=>({...lock,label:defText(terrainAt(w,lock.pos)),pick:lockPickQuote(w,pl,lock.pos)}))}})
</script>
<template>
  <section v-if="data.locks.length" class="df df-tab mb-2 text-xs" data-testid="container-locks">
    <div v-for="lock in data.locks" :key="lock.pos.x+','+lock.pos.y" class="mb-1">
      <span>{{ t('{0} · 잠김',lock.label) }}</span>
      <span v-if="lock.quote.tool"> · {{ t('{0} · {1}턴 · 완료 시 내구 −{2}',itemLabel(data.w,lock.quote.tool),lock.quote.turns,data.w.db.terrain(data.w.s.map.tiles[lock.pos.y*data.w.s.map.w+lock.pos.x].t).lock!.wear) }}</span>
      <span v-if="lock.quote.error" class="ml-2 text-amber-200">{{ t(lock.quote.error) }}</span>
      <button class="dbtn ml-2" :data-testid="'pry-container-'+lock.pos.x+'-'+lock.pos.y" :disabled="simulating||!!lock.quote.error" @click="doAct({type:'pryContainer',pos:lock.pos})">{{ t('잠금쇠 벌리기') }}</button>
      <div class="mt-1">
        <span v-if="lock.pick.tool">{{ t('{0} · {1}턴 · 성공 {2}% · 내구 −{3} · 소음 {4}',itemLabel(data.w,lock.pick.tool),lock.pick.turns!,lock.pick.chance!,lock.pick.rule!.wear,lock.pick.rule!.noise) }}</span>
        <span v-else class="text-amber-200">{{ t(lock.pick.error??'') }}</span>
        <button class="dbtn ml-2" :data-testid="'pick-lock-'+lock.pos.x+'-'+lock.pos.y" :disabled="simulating||!!lock.pick.error" @click="doAct({type:'pickLock',pos:lock.pos})">{{ t('정밀 잠금 따기') }}</button>
      </div>
    </div>
    <p>{{ t('벌리기는 큰 소리가 난다. 정밀 작업은 실패해도 시간과 내구를 쓴다. 잠금을 푼 뒤 상자는 따로 수색하고, 문은 한 번 더 열어야 한다.') }}</p>
  </section>
</template>
