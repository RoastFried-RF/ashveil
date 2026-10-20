<script setup lang="ts">
import {computed} from 'vue'
import {player,type World} from '../../core'
import {mapDrawingQuote} from '../../core/map-writing'
import {cartographyDef} from '../../core/cartography'
import {act,simulating,version,world} from '../store'
const state=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),r=cartographyDef(w).writing,j=p.mapDrawingJob
 const paper=p.bag.find(i=>i.def===r?.paper&&!i.note&&i.count===1),ink=p.bag.find(i=>i.def===r?.ink&&i.count>0)
 const paperUid=j?.paperUid??paper?.uid??-1,inkUid=j?.inkUid??ink?.uid??-1
 return{job:j,paperUid,inkUid,papers:p.bag.filter(i=>i.def===r?.paper&&!i.note&&i.count===1).length,ink:p.bag.filter(i=>i.def===r?.ink).reduce((n,i)=>n+i.count,0),quote:mapDrawingQuote(w,p,paperUid,inkUid)}
})
</script>
<template>
  <div class="mt-2 border-t border-ash-600 pt-2 text-[11px] space-y-1" data-testid="map-writing">
    <p>직접 탐험한 방·관찰한 계단과 지상의 물 지형/시설을 종이에 옮긴다. 빈 종이 {{ state.papers }}장 · 잉크 {{ state.ink }}회분</p>
    <p>신뢰도 {{ state.quote.reliability }} · 오차 ±{{ state.quote.errorTiles }}칸 · 누락될 수 있다. 완료할 때 종이에 쓰고 잉크1회분을 사용한다.</p>
    <p v-if="state.job">중단해도 진행과 처음의 탐험 기록이 남는다. 남은 {{ state.quote.remaining }}턴</p>
    <p v-if="state.quote.error" class="text-ash-400" data-testid="map-writing-error">{{ state.quote.error }}</p>
    <button class="dbtn" data-testid="draw-map-start" :disabled="simulating||!!state.quote.error" @click="act({type:'drawMap',paperUid:state.paperUid,inkUid:state.inkUid})">{{ state.job?'지도 작성 재개':'현재 지역 지도 그리기' }} ({{ state.quote.remaining }}턴)</button>
    <button v-if="state.job" class="dbtn ml-2" data-testid="draw-map-cancel" :disabled="simulating" @click="act({type:'cancelMapDrawing'})">작성 취소</button>
  </div>
</template>
