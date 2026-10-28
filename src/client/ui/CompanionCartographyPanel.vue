<script setup lang="ts">
import CompanionWorldCartographyPanel from './CompanionWorldCartographyPanel.vue'
import {computed} from 'vue'
import {companionMapQuote} from '../../core/companion-cartography'
import type {World} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,c=w.s.creatures.find(c=>c.id===props.personId)!;return{c,q:companionMapQuote(w,c)}})
</script>
<template>
  <div class="mt-2 border-t border-ash-600 pt-2 text-xs space-y-1" data-testid="companion-cartography">
    <p>동료의 직접 탐험 지도 · 기억하는 방 {{ data.q.memory?.rooms.length??0 }}개 · 계단 {{ data.q.memory?.stairs.length??0 }}곳 · 지상 물 지형/시설 {{ data.q.memory?.landmarks?.length??0 }}곳</p>
    <p>동료의 빈 종이 {{ data.q.paperCount }}장 · 잉크 {{ data.q.inkCount }}회분</p>
    <p>동료 자신의 빈 종이·잉크를 쓴다. 신뢰도 {{ data.q.quote.reliability }} · 오차 ±{{ data.q.quote.errorTiles }}칸 · 작성 {{ data.q.quote.remaining }}턴</p>
    <p v-if="data.q.job">진행과 처음의 관찰 기록을 보존한다. 완료할 때만 종이에 쓰고 잉크1회분을 쓴다.</p>
    <p v-if="data.q.error" class="text-ash-400" data-testid="companion-map-error">{{ data.q.error }}</p>
    <button v-if="data.c.activity?.kind!=='drawMap'" class="dbtn" :disabled="simulating||!!data.q.error" data-testid="companion-map-start" @click="doAct({type:'companionMap',target:personId,operation:'start',paperUid:data.q.paperUid,inkUid:data.q.inkUid})">{{ data.q.job?'지도 작성 재개 부탁':'지도 작성 부탁' }} (1턴)</button>
    <button v-else class="dbtn" :disabled="simulating||!!data.q.access" data-testid="companion-map-stop" @click="doAct({type:'companionMap',target:personId,operation:'stop'})">작업 중단 부탁 (1턴)</button>
    <button v-if="data.q.job" class="dbtn ml-1" :disabled="simulating||!!data.q.access" data-testid="companion-map-cancel" @click="doAct({type:'companionMap',target:personId,operation:'cancel'})">미완성 작업 취소 (1턴)</button>
    <button v-for="paper in data.q.maps" :key="paper.uid" class="dbtn block" :disabled="simulating||!!data.q.access" :data-testid="'companion-map-collect-'+paper.uid" @click="doAct({type:'companionMap',target:personId,operation:'collect',paperUid:paper.uid})">{{ paper.note!.mapDocument!.title }} 건네받기 (1턴)</button>
  </div>
  <CompanionWorldCartographyPanel :person-id="personId" />
</template>
