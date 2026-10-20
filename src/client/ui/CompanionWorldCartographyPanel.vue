<script setup lang="ts">
import {computed} from 'vue'
import {type World} from '../../core'
import {companionWorldMapQuote} from '../../core/companion-world-cartography'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const props=defineProps<{personId:number}>()
const data=computed(()=>{void version.value;const w=world.value as World,c=w.s.creatures.find(c=>c.id===props.personId);return c?{c,q:companionWorldMapQuote(w,c)}:undefined})
</script>
<template>
  <div v-if="data&&world?.s.overworld" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="companion-world-cartography">
    <p class="font-title text-amber-100">동료의 당시 월드 지도</p>
    <p>자기가 실제로 살펴본 {{ data.q.quote.cells }}칸만 옮긴다. 동료의 빈 종이{{ data.q.paperCount }}장/잉크{{ data.q.inkCount }}회분 · 신뢰도{{ data.q.quote.reliability }}/월드 오차±{{ data.q.quote.errorTiles }}칸</p>
    <p v-if="data.q.job">처음 관찰한 기록과 진행을 유지한다. 남은{{ data.q.quote.remaining }}턴</p>
    <p v-if="data.q.error" class="text-ash-400">{{ data.q.error }}</p>
    <button v-if="data.c.activity?.kind!=='drawWorldMap'" class="dbtn" :disabled="simulating||!!data.q.error" data-testid="companion-world-map-start" @click="doAct({type:'companionWorldMap',target:personId,operation:'start',paperUid:data.q.paperUid,inkUid:data.q.inkUid})">{{ data.q.job?'월드 지도 작성 재개 부탁':'월드 지도 작성 부탁' }} (1턴)</button>
    <button v-else class="dbtn" :disabled="simulating||!!data.q.access" data-testid="companion-world-map-stop" @click="doAct({type:'companionWorldMap',target:personId,operation:'stop'})">월드 지도 작성 멈추기 (1턴)</button>
    <button v-if="data.q.job" class="dbtn ml-1" :disabled="simulating||!!data.q.access" data-testid="companion-world-map-cancel" @click="doAct({type:'companionWorldMap',target:personId,operation:'cancel'})">미완성 월드 지도 취소 (1턴)</button>
    <p v-for="paper in data.q.maps" :key="paper.uid" class="mt-1">{{ paper.note!.worldMapDocument!.title }} · {{ paper.note!.worldMapDocument!.cells.length }}칸 <button class="dbtn" data-testid="companion-world-map-collect" :disabled="simulating||!!data.q.access" @click="doAct({type:'companionWorldMap',target:personId,operation:'collect',paperUid:paper.uid})">원래 월드 지도 받기 (1턴)</button></p>
  </div>
</template>
