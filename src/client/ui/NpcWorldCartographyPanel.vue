<script setup lang="ts">
import {computed} from 'vue'
import {canSee,isCompanion,player,economyDef,type World} from '../../core'
import {npcMapTradeAccess} from '../../core/npc-cartography'
import {ownedNpcWorldMaps,npcWorldMapPurchaseQuote} from '../../core/npc-world-cartography'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,c=w.s.creatures.find(c=>c.id===props.personId),p=player(w);return{c,currency:economyDef(w).currency,working:c&&!isCompanion(w,c)&&canSee(w,p,c.pos)&&c.activity?.kind==='drawWorldMap'?c.activity.remaining:undefined,rows:c&&!npcMapTradeAccess(w,p,c)?ownedNpcWorldMaps(w,c).map(paper=>({...npcWorldMapPurchaseQuote(w,p,c,paper.uid),paper})):[]}})
</script>
<template>
  <div v-if="data.working!==undefined||data.rows.length" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="npc-world-map-shop">
    <p v-if="data.working!==undefined" class="text-ash-400">자기 월드 지도를 작성 중이다. 남은{{ data.working }}턴</p>
    <div v-for="row in data.rows" :key="row.paper.uid" class="my-1">
      <p>{{ row.paper.note!.worldMapDocument!.title }} · {{ row.paper.note!.worldMapDocument!.cells.length }}칸 · 신뢰도{{ row.paper.note!.worldMapDocument!.reliability }}/월드 오차±{{ row.paper.note!.worldMapDocument!.error }}칸 · {{ row.price }}{{ data.currency }}</p>
      <p class="text-ash-400">같은 원본과 실제 개인 현금을 교환한다. 내용은 직접 읽어야 알 수 있다.</p>
      <p v-if="row.error" class="text-red-300">{{ row.error }}</p>
      <button class="dbtn" data-testid="buy-npc-world-map" :disabled="simulating||!!row.error" @click="doAct({type:'buyNpcWorldMap',target:personId,uid:row.paper.uid,expectedPrice:row.price})">월드 원본 지도 구매 (1턴)</button>
    </div>
  </div>
</template>
