<script setup lang="ts">
import NpcWorldCartographyPanel from './NpcWorldCartographyPanel.vue'
import {computed} from 'vue'
import {player,economyDef,canSee,type World} from '../../core'
import {ownedNpcMaps,npcMapPurchaseQuote,npcMapTradeAccess} from '../../core/npc-cartography'
import {isCompanion} from '../../core/companion-state'
import {merchantMapRequestQuote} from '../../core/npc-map-shop-supplies'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,c=w.s.creatures.find(c=>c.id===props.personId),p=player(w);return{c,currency:economyDef(w).currency,request:c?.traderSite&&!npcMapTradeAccess(w,p,c)?merchantMapRequestQuote(w,p,c):undefined,working:c&&!isCompanion(w,c)&&canSee(w,p,c.pos)&&c.activity?.kind==='drawMap'?c.activity.remaining:undefined,rows:c&&!npcMapTradeAccess(w,p,c)?ownedNpcMaps(w,c).map(paper=>({...npcMapPurchaseQuote(w,p,c,paper.uid),paper})):[]}})
</script>
<template>
  <section v-if="data.rows.length||data.working!==undefined||data.request" class="my-3 border border-ash-600 p-2 text-xs" data-testid="npc-map-shop">
    <h3 class="font-bold">직접 그린 지도</h3>
    <p class="my-1 text-ash-400">자기 탐험 기록과 원래 종이·잉크로 그린 원본이다. 누락/오차가 있으며 구입 뒤 직접 읽어야 내용을 알 수 있다.</p>
    <p v-if="data.working!==undefined" data-testid="npc-map-work">자기 종이에 지도를 그리고 있다 · 남은 {{ data.working }}턴</p>
    <div v-if="data.request" class="my-2">
      <button class="dbtn" data-testid="request-merchant-map" :disabled="simulating||!!data.request.error" @click="doAct({type:'requestMerchantMap',target:personId})">자기 상점 재료로 지도 준비 부탁 (1턴)</button>
      <p class="text-ash-400">상인의 원래 재고를 사용한다. 대금은 완성 원본을 구입할 때 낸다.</p>
      <p v-if="data.request.error" class="text-ash-400">{{ data.request.error }}</p>
    </div>
    <div v-for="row in data.rows" :key="row.paper.uid" class="my-2" :data-map-paper="row.paper.uid">
      <p>{{ row.document!.title }} · 작성자 {{ row.document!.author }} · 신뢰도 {{ row.document!.reliability }} · 오차 ±{{ row.document!.error }}칸</p>
      <button class="dbtn" :disabled="simulating||!!row.error" data-testid="buy-npc-map" @click="doAct({type:'buyNpcMap',target:personId,uid:row.paper.uid,expectedPrice:row.price})">원본 지도 구입 {{ row.price }}{{ data.currency }} (1턴)</button>
      <p v-if="row.error" class="text-ash-400">{{ row.error }}</p>
    </div>
  </section>
  <NpcWorldCartographyPanel :person-id="personId" />
</template>
