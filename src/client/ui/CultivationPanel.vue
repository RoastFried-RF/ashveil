<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {player,terrainAt,tileAt,inBounds,turnOf,type World} from '../../core'
import {cultivationStatus,cultivationWaterQuote,cultivationSubstrateQuote,cropUprootQuote} from '../../core/cultivation'
import {canSee,hasLos} from '../../core/fov'
import {diagonalBlocked} from '../../core/path'
import {DIRS} from '../../core/geom'
import {drinkVolume} from '../../core/wash-water'
import {isWaterVessel} from '../../core/water-vessels'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
import {cropArt} from '../render/crop-art'
import {t,defText} from '../locale'
import ItemIcon from './ItemIcon.vue'
const pendingUproot=ref<number>()
watch(version,()=>{pendingUproot.value=undefined})
const rows=computed(()=>{void version.value;const w=world.value as World,c=player(w);return[{x:0,y:0},...DIRS].map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y})).filter(p=>inBounds(w,p)&&tileAt(w,p).cultivation&&canSee(w,c,p)&&hasLos(w,c.pos,p)&&!diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y)).map(pos=>{const status=cultivationStatus(w,pos)!;return{pos,label:defText(terrainAt(w,pos)),art:cropArt(terrainAt(w,pos),tileAt(w,pos),true,turnOf(w)),status,uproot:cropUprootQuote(w,c,pos),substrates:status.rule?.substrate?c.bag.filter(i=>i.def===status.rule!.substrate!.item).map(i=>({uid:i.uid,label:defText(w.db.item(i.def)),...cultivationSubstrateQuote(w,c,pos,i.uid)})):[],water:c.bag.filter(i=>isWaterVessel(w,i)&&drinkVolume(w,i)>0).map(i=>{const ml=Math.min(drinkVolume(w,i),Math.floor((status.rule?.waterMl??0)-status.waterMl));return{uid:i.uid,label:defText(w.db.item(i.def)),...cultivationWaterQuote(w,c,pos,i.uid,ml)}})}})})
</script>
<template>
  <section v-if="rows.length" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="cultivation-panel">
    <p>{{ t('재배 작물 · 실제 빛과 기온·물') }}</p>
    <p class="text-ash-400">{{ t('물은 성장과 증발에 각각 쓰인다. 지붕 아래·비·0°C 이하에서는 증발하지 않는다.') }}</p>
    <p v-if="(world as World).s.overworld&&(world as World).s.map.kind==='surface'&&!(world as World).s.map.vessel" class="text-ash-400" data-testid="surface-crop-away-rule">{{ t('자리를 떠난 밭도 그 지역의 비·햇빛·추위에 따라 자란다. 남은 물과 빗물만 쓰며, 돌아와 직접 수확해야 한다.') }}</p>
    <div v-for="row in rows" :key="row.pos.x+','+row.pos.y" class="my-2" :data-crop="row.pos.x+','+row.pos.y">
      <div class="crop-heading"><ItemIcon v-if="row.art" :name="row.art.sprite" :size="42" /><div><strong>{{ row.label }}</strong><span>{{ row.pos.x }},{{ row.pos.y }} · {{ t(row.status.ready?'수확 가능':row.status.progress>=65?'여무는 중':row.status.progress>=25?'잎이 자라는 중':'새싹·배양 초기') }}</span></div><b>{{ row.status.progress }}%</b></div>
      <div class="crop-meter" role="progressbar" :aria-label="t('{0} 성장',row.label)" :aria-valuenow="row.status.progress" aria-valuemin="0" aria-valuemax="100"><i :style="{width:row.status.progress+'%'}" /></div>
      <p class="crop-water">{{ t('관수 {0}/{1}ml',Math.round(row.status.waterMl*100)/100,row.status.rule?.waterMl??0) }} <span>{{ t('햇빛 {0}% · {1}°C',Math.round(row.status.light*1000)/10,row.status.temp) }}</span></p>
      <details class="crop-rules">
        <summary>{{ t('재배 조건·토양 살피기') }}</summary>
        <p>{{ t('성장 햇빛 {0}~{1}% · {2}~{3}°C · 현재 증발 최대 {4}ml/시간',(row.status.rule?.minLight??0)*100,(row.status.rule?.maxLight??1)*100,row.status.rule?.minTemp??0,row.status.rule?.maxTemp??0,row.status.evaporationMlPerHour) }}</p>
        <p v-if="row.status.soilDiffusion?.maxMlPerEdge" class="text-ash-400">{{ t('지상 토양 밭은 {0}턴마다 맞닿은 네 이웃과 남은 물을 최대 {1}ml씩 나눈다. 영하·배양목은 제외하며 이미 작물에 옮은 오염은 남는다.',row.status.soilDiffusion.everyTurns,row.status.soilDiffusion.maxMlPerEdge) }}</p>
        <p v-if="row.status.rule?.substrate">{{ t('배지 수확 {0}/{1}회 남음 · 햇빛 {2}% 이하',row.status.state.remainingCycles??0,row.status.rule.substrate.cycles,(row.status.rule.maxLight??1)*100) }}</p>
      </details>
      <div v-if="row.status.state.remainingCycles===0">
        <p v-if="!row.substrates.length">{{ t('배낭의 실제 목재 하나가 필요하다.') }}</p>
        <button v-for="source in row.substrates" :key="source.uid" class="dbtn" data-testid="crop-substrate" :disabled="simulating||!!source.error" @click="doAct({type:'refreshCropSubstrate',pos:row.pos,uid:source.uid})">{{ t('{0} 하나로 배지 교체 ({1}턴)',source.label,row.status.rule!.substrate!.turns) }}</button>
      </div>
      <p v-if="(world as World).s.map.kind==='dungeon'&&row.status.rule?.minLight===0&&!row.status.gather?.soilDependent" class="text-ash-400">{{ t('지하에서는 자리를 떠나도 실제 물과 남은 배지 범위에서 자란다.') }}</p>
      <p v-if="row.status.state.ownerId&&row.status.state.ownerId!==player(world as World).id" class="text-ash-400">{{ t('타인이 심은 밭') }}</p>
      <p v-if="row.status.state.irrigation" class="text-amber-300">{{ t('물·밭 잔재에서 옮은 오염 · 수확물에 남는다') }}</p>
      <p v-if="!row.status.ready" class="text-ash-400">{{ t(row.status.error??'현재 환경에서 자라고 있다') }}</p>
      <button v-if="row.status.ready" class="dbtn" data-testid="crop-harvest" :disabled="simulating" @click="doAct({type:'gather',pos:row.pos})">{{ t('다 자란 작물 수확') }}</button>
      <div v-for="water in row.water" v-else :key="water.uid">
        <button class="dbtn" data-testid="crop-water" :data-water-uid="water.uid" :disabled="simulating||!!water.error" @click="doAct({type:'waterCrop',pos:row.pos,uid:water.uid,ml:water.ml})">{{ t('{0} · {1}ml 물 주기 (1턴)',water.label,water.ml) }}</button>
        <p v-if="water.error" class="text-ash-400">{{ t(water.error) }}</p>
      </div>
      <details class="crop-rules crop-remove"><summary>{{ t('밭 정리·다른 작물로 바꾸기') }}</summary><p>{{ t('작물과 남은 관수 {0}ml를 포기하고 심기 전 바닥을 드러낸다. 종자·음식·배양목을 돌려받지 않는다. 남은 오염은 밭 잔재에 보관되어 다시 심은 작물로 옮는다.',Math.floor(row.uproot.waterMl)) }}</p><p v-if="row.uproot.error" class="text-ash-400">{{ t(row.uproot.error) }}</p><template v-else><p v-if="row.uproot.unharvested" class="text-amber-300">{{ t('수확할 작물이 남아 있다. 먼저 수확할지 결정하자.') }}</p><div v-if="pendingUproot===row.uproot.seedUid" class="crop-remove-confirm"><p>{{ t('이 작물을 뽑고 {0}을 드러낸다.',defText(row.uproot.base!)) }}</p><button class="dbtn" :disabled="simulating" data-testid="crop-uproot-confirm" @click="doAct({type:'uprootCrop',pos:row.pos,expectedSeed:row.uproot.seedUid!});pendingUproot=undefined">{{ t('작물 포기·밭 정리 ({0}턴)',row.uproot.turns) }}</button><button class="dbtn" @click="pendingUproot=undefined">{{ t('계속 기르기') }}</button></div><button v-else class="dbtn" :disabled="simulating" data-testid="crop-uproot-review" @click="pendingUproot=row.uproot.seedUid">{{ t('이 밭 정리 검토') }}</button></template></details>
    </div>
  </section>
</template>

<style scoped>
.dbtn{max-width:100%;white-space:normal;text-align:left}
.crop-remove{border-top:1px solid #514936;padding-top:9px;margin-top:12px}.crop-remove-confirm{border:1px solid #8a6b43;background:#362b1e;padding:9px;margin-top:7px}.crop-remove-confirm button{margin:6px 5px 0 0}.crop-heading{display:flex;align-items:center;gap:10px;padding:8px 0 3px}.crop-heading>div{flex:1;min-width:0}.crop-heading strong{display:block;color:#ddd0b1;font-size:13px}.crop-heading span{display:block;color:#a89e84;font-size:10px;margin-top:3px}.crop-heading b{color:#b9c39c;font-size:15px;font-weight:400}.crop-meter{height:5px;background:#191e18;border:1px solid #424c37;margin:5px 0 8px}.crop-meter i{display:block;height:100%;background:#8b9c69}.crop-water{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;color:#a7b9ba;font-size:11px}.crop-water span{color:#b0a78e}.crop-rules{font-size:10px;color:#9f967f;line-height:1.8;margin:7px 0}.crop-rules summary{cursor:pointer;color:#b4a27d}
</style>
