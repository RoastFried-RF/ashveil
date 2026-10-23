<script setup lang="ts">
import {computed} from 'vue'
import {player,terrainAt,tileAt,inBounds,type World} from '../../core'
import {cultivationStatus,cultivationWaterQuote,cultivationSubstrateQuote} from '../../core/cultivation'
import {canSee,hasLos} from '../../core/fov'
import {diagonalBlocked} from '../../core/path'
import {DIRS} from '../../core/geom'
import {drinkVolume} from '../../core/wash-water'
import {isWaterVessel} from '../../core/water-vessels'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
const rows=computed(()=>{void version.value;const w=world.value as World,c=player(w);return[{x:0,y:0},...DIRS].map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y})).filter(p=>inBounds(w,p)&&tileAt(w,p).cultivation&&canSee(w,c,p)&&hasLos(w,c.pos,p)&&!diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y)).map(pos=>{const status=cultivationStatus(w,pos)!;return{pos,label:terrainAt(w,pos).label,status,substrates:status.rule?.substrate?c.bag.filter(i=>i.def===status.rule!.substrate!.item).map(i=>({uid:i.uid,label:w.db.item(i.def).label,...cultivationSubstrateQuote(w,c,pos,i.uid)})):[],water:c.bag.filter(i=>isWaterVessel(w,i)&&drinkVolume(w,i)>0).map(i=>{const ml=Math.min(drinkVolume(w,i),Math.floor((status.rule?.waterMl??0)-status.waterMl));return{uid:i.uid,label:w.db.item(i.def).label,...cultivationWaterQuote(w,c,pos,i.uid,ml)}})}})})
</script>
<template>
  <section v-if="rows.length" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="cultivation-panel">
    <p>재배 작물 · 실제 빛과 기온·물</p>
    <p class="text-ash-400">물은 성장과 증발에 각각 쓰인다. 지붕 아래·비·0°C 이하에서는 증발하지 않는다.</p>
    <p v-if="(world as World).s.overworld&&(world as World).s.map.kind==='surface'&&!(world as World).s.map.vessel" class="text-ash-400" data-testid="surface-crop-away-rule">자리를 떠난 밭도 그 지역의 비·햇빛·추위에 따라 자란다. 남은 물과 빗물만 쓰며, 돌아와 직접 수확해야 한다.</p>
    <div v-for="row in rows" :key="row.pos.x+','+row.pos.y" class="my-2" :data-crop="row.pos.x+','+row.pos.y">
      <p>{{ row.label }} {{ row.pos.x }},{{ row.pos.y }} · 성장{{ row.status.progress }}% · 관수{{ Math.round(row.status.waterMl*100)/100 }}ml</p>
      <p>햇빛{{ Math.round(row.status.light*1000)/10 }}% · {{ row.status.temp }}°C · 현재 증발 최대{{ row.status.evaporationMlPerHour }}ml/시간</p>
      <p v-if="row.status.soilDiffusion?.maxMlPerEdge" class="text-ash-400">지상 토양 밭은 {{ row.status.soilDiffusion.everyTurns }}턴마다 맞닿은 네 이웃과 남은 물을 최대 {{ row.status.soilDiffusion.maxMlPerEdge }}ml씩 나눈다. 영하·배양목은 제외하며 이미 작물에 옮은 오염은 남는다.</p>
      <p v-if="row.status.rule?.substrate">배지 수확 {{ row.status.state.remainingCycles }}/{{ row.status.rule.substrate.cycles }}회 남음 · 햇빛 {{ (row.status.rule.maxLight??1)*100 }}% 이하</p>
      <div v-if="row.status.state.remainingCycles===0">
        <p v-if="!row.substrates.length">배낭의 실제 목재 하나가 필요하다.</p>
        <button v-for="source in row.substrates" :key="source.uid" class="dbtn" data-testid="crop-substrate" :disabled="simulating||!!source.error" @click="doAct({type:'refreshCropSubstrate',pos:row.pos,uid:source.uid})">{{ source.label }} 하나로 배지 교체 ({{ row.status.rule!.substrate!.turns }}턴)</button>
      </div>
      <p v-if="(world as World).s.map.kind==='dungeon'&&row.status.rule?.minLight===0&&!row.status.gather?.soilDependent" class="text-ash-400">지하에서는 자리를 떠나도 실제 물과 남은 배지 범위에서 자란다.</p>
      <p v-if="row.status.state.ownerId&&row.status.state.ownerId!==player(world as World).id" class="text-ash-400">타인이 심은 밭</p>
      <p v-if="row.status.state.irrigation" class="text-amber-300">관수에서 옮은 오염 · 수확물에 남는다</p>
      <p v-if="!row.status.ready" class="text-ash-400">{{ row.status.error??'현재 환경에서 자라고 있다' }}</p>
      <button v-if="row.status.ready" class="dbtn" data-testid="crop-harvest" :disabled="simulating" @click="doAct({type:'gather',pos:row.pos})">다 자란 작물 수확</button>
      <div v-for="water in row.water" v-else :key="water.uid">
        <button class="dbtn" data-testid="crop-water" :data-water-uid="water.uid" :disabled="simulating||!!water.error" @click="doAct({type:'waterCrop',pos:row.pos,uid:water.uid,ml:water.ml})">{{ water.label }} · {{ water.ml }}ml 물 주기 (1턴)</button>
        <p v-if="water.error" class="text-ash-400">{{ water.error }}</p>
      </div>
    </div>
  </section>
</template>
