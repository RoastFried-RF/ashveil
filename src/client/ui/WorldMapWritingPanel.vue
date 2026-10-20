<script setup lang="ts">
import {computed} from 'vue'
import {player,type World} from '../../core'
import {worldMapDrawingQuote} from '../../core/world-cartography'
import {cartographyDef} from '../../core/cartography'
import {act,simulating,version,world} from '../store'
const state=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),r=cartographyDef(w).writing,j=p.worldMapDrawingJob,paper=p.bag.find(i=>i.def===r?.paper&&!i.note&&i.count===1),ink=p.bag.find(i=>i.def===r?.ink&&i.count>0),paperUid=j?.paperUid??paper?.uid??-1,inkUid=j?.inkUid??ink?.uid??-1
 return{job:j,paperUid,inkUid,quote:worldMapDrawingQuote(w,p,paperUid,inkUid),papers:p.bag.filter(i=>i.def===r?.paper&&!i.note&&i.count===1).length,ink:p.bag.filter(i=>i.def===r?.ink).reduce((n,i)=>n+i.count,0)}
})
</script>
<template>
  <div class="mt-2 border-t border-ash-600 pt-2 text-[11px] space-y-1" data-testid="world-map-writing">
    <p>직접 살펴본 당시 월드 지형 {{ state.quote.cells }}칸을 종이에 옮긴다. 처음 받은 지도는 복사하지 않는다. 빈 종이 {{ state.papers }}장 · 잉크 {{ state.ink }}회분</p>
    <p>신뢰도 {{ state.quote.reliability }} · 월드 오차 ±{{ state.quote.errorTiles }}칸 · 누락될 수 있다. 완료할 때 원래 종이와 잉크1회분을 쓴다.</p>
    <p v-if="state.job">처음의 관찰 기록과 진행을 보존한다. 남은 {{ state.quote.remaining }}턴</p>
    <p v-if="state.quote.error" class="text-ash-400" data-testid="world-map-writing-error">{{ state.quote.error }}</p>
    <button class="dbtn" data-testid="draw-world-map-start" :disabled="simulating||!!state.quote.error" @click="act({type:'drawWorldMap',paperUid:state.paperUid,inkUid:state.inkUid})">{{ state.job?'월드 지도 작성 재개':'관찰한 월드 지도 그리기' }} ({{ state.quote.remaining }}턴)</button>
    <button v-if="state.job" class="dbtn ml-2" data-testid="draw-world-map-cancel" :disabled="simulating" @click="act({type:'cancelWorldMapDrawing'})">월드 지도 작성 취소</button>
  </div>
</template>
