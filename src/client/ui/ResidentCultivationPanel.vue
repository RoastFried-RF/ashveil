<script setup lang="ts">
import {computed} from 'vue'
import {player,itemDef,type Creature,type World} from '../../core'
import {residentSeedQuote} from '../../core/resident-cultivation'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{target:Creature}>()
const seeds=computed(()=>{void version.value;const w=world.value as World,p=player(w);return p.bag.filter(i=>itemDef(w,i).place&&w.db.terrain(itemDef(w,i).place!).cultivation).map(i=>({uid:i.uid,label:itemDef(w,i).label,...residentSeedQuote(w,p,props.target,i.uid)}))})
</script>
<template>
  <section v-if="seeds.length" class="my-2 border border-ash-700 p-2 text-xs" data-testid="resident-cultivation-panel">
    <p>개인 밭 · 주민은 자기 물과 실제 보이는 자리에서 재배 재료를 돌본다.</p>
    <div v-for="seed in seeds" :key="seed.uid"><button class="dbtn" :data-resident-seed-uid="seed.uid" :data-target-id="target.id" :disabled="simulating||!!seed.error" @click="doAct({type:'giveResidentSeed',target:target.id,uid:seed.uid})">{{ seed.label }} 한 개 건네기 (1턴)</button><p v-if="seed.error" class="text-ash-400">{{ seed.error }}</p></div>
  </section>
</template>
