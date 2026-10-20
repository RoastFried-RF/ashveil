<script setup lang="ts">
import { computed, ref } from 'vue'
import { canSee, hasLos, campfireAt, nearbyCampfires, baseCampDef, baseRestDef, baseWaterDef, baseCommandError, baseBedQuote, baseBedTenant, nearbyBaseBeds, baseStoreError, baseTaskStatus, claimBaseQuote, cheb, itemLabel, nearbyBaseStores, player, type RecipeDef, type TerrainDef, type World } from '../../core'
import { simulating, version, world } from '../store'
import { doAct, setWin } from '../ui'
const fires=ref<Record<number,string>>({})
const beds=ref<Record<number,string>>({})
const resources=ref<Record<number,string>>({}),recipes=ref<Record<number,string>>({}),batches=ref<Record<number,number>>({})
const d=computed(()=>{void version.value;const w=world.value as World,p=player(w),base=w.s.map.baseCamp,near=base&&cheb(p.pos,base.store)<=baseCampDef(w).radius;return{w,base:near?base:undefined,stores:nearbyBaseStores(w,p).map((pos)=>({pos,q:claimBaseQuote(w,p,pos)})),access:baseStoreError(w,p),bag:p.bag.map((i)=>({uid:i.uid,label:itemLabel(w,i),count:i.count})),stock:base&&!baseStoreError(w,p)?w.s.map.tiles[base.store.y*w.s.map.w+base.store.x].cont?.items.map((i)=>({uid:i.uid,label:itemLabel(w,i),count:i.count}))??[]:[],members:base&&near?w.s.creatures.filter((c)=>c.alive&&c.companion?.employer===p.id&&['employed','unpaid'].includes(c.companion.status)&&cheb(p.pos,c.pos)<=1).map((c)=>({c,status:baseTaskStatus(w,c),error:baseCommandError(w,c),task:base.tasks[c.id],recipes:w.db.all<RecipeDef>('Recipe').filter((r)=>(r.basic||c.recipes?.includes(r.id))&&!r.passiveTurns)})):[]}})
const materialOptions=computed(()=>{void version.value;const w=world.value as World,ids=new Set([...player(w).bag.map((i)=>i.def),...w.db.all<RecipeDef>('Recipe').filter((r)=>r.basic).flatMap((r)=>r.inputs.map((i)=>i.item)),...w.db.all<TerrainDef>('Terrain').flatMap((t)=>t.gather?[t.gather.item]:[])]);return [...ids].sort().map((id)=>({id,label:w.db.item(id).label}))})
const bedOptions=computed(()=>{void version.value;const w=world.value as World;return nearbyBaseBeds(w).map((pos)=>({pos,uid:w.s.map.tiles[pos.y*w.s.map.w+pos.x].placed!.item.uid,tenant:baseBedTenant(w,pos),label:w.db.terrain(w.s.map.tiles[pos.y*w.s.map.w+pos.x].t).label}))})
const fireOptions=computed(()=>{void version.value;const w=world.value as World;return nearbyCampfires(w,player(w)).map((pos)=>({pos,uid:campfireAt(w,pos)!.uid}))})
function fireChoice(id:number){return fireOptions.value.find((f)=>String(f.uid)===fires.value[id])}
function bedChoice(id:number){return bedOptions.value.find((b)=>String(b.uid)===beds.value[id])}
function assignBed(id:number){const bed=bedChoice(id);if(bed)doAct({type:'baseBed',target:id,pos:bed.pos})}
function openStore(){doAct({type:'baseOpen'});setWin('inv',true)}
</script>
<template>
  <section class="mb-3 border border-ash-700 p-2 text-xs" data-testid="base-camp-panel">
    <p class="mb-2 text-ash-100">거점과 동료 작업</p>
    <template v-if="d.base">
      <p class="mb-2 text-ash-400">창고 주변 {{ baseCampDef(d.w).radius }}칸 · 실물 재료·급료·식량과 시간이 필요하다. 운반·채집은 실제 창고의 목표 재고를 채운다. 작업 취소는 진행만 초기화하고 재료는 남긴다.</p>
      <p v-if="d.base.raidHeard" class="my-2 text-amber-200" data-testid="base-raid-news">{{ d.base.raidHeard.phase==='repelled'?'거점 공격자들이 제압된 것을 직접 확인했다':d.base.raidHeard.phase==='stolen'?'약탈자가 창고 물품을 가져가는 것을 목격했다':'거점을 향해 움직이는 약탈대를 목격했다' }} · {{ Math.floor(d.base.raidHeard.at/28800)+1 }}일차 관측</p>
      <button class="dbtn" :disabled="simulating||!!d.access" :title="d.access??''" data-testid="base-open" @click="openStore">창고 열기</button>
      <p v-if="d.access" class="my-1 text-ash-400">{{ d.access }}</p>
      <details v-if="!d.access" class="my-2">
        <summary>창고·배낭 사이 실제 물품 옮기기 · 묶음당1턴</summary>
        <div class="my-1"><button v-for="i in d.bag" :key="i.uid" class="dbtn m-1" :disabled="simulating" :data-base-put="i.uid" @click="doAct({type:'baseTransfer',direction:'put',uid:i.uid})">{{ i.label }} ×{{ i.count }} 넣기</button></div>
        <div><button v-for="i in d.stock" :key="i.uid" class="dbtn m-1" :disabled="simulating" :data-base-take="i.uid" @click="doAct({type:'baseTransfer',direction:'take',uid:i.uid})">{{ i.label }} ×{{ i.count }} 꺼내기</button></div>
      </details>
      <div v-for="m in d.members" :key="m.c.id" :data-base-worker="m.c.id" class="my-2 border-t border-ash-700 pt-2">
        <p>{{ m.c.name }} · {{ m.task?.kind==='guard'?'거점 방어':m.task?.kind==='fire'?'실제 모닥불 관리':m.task?.recipe?`${d.w.db.get<RecipeDef>(m.task.recipe).label} ${m.task.remaining}회 남음`:m.task?.kind==='water'?`식수 ${m.task.remaining}ml 보충 남음`:m.task?.item?`${d.w.db.item(m.task.item).label} ${m.task.remaining}개 ${m.task.kind==='haul'?'운반':'채집'} 남음`:'배정 없음' }} · {{ m.c.companion!.status==='unpaid'?'급료 대기':'급료 유효' }}</p>
        <p v-if="m.c.activity?.kind==='gearSwap'&&canSee(d.w,player(d.w),m.c.pos)&&hasLos(d.w,player(d.w).pos,m.c.pos)" class="my-1 text-ash-300">갈아입는 중 · {{ m.c.activity.label }} {{ m.c.activity.remaining }}턴 남음</p>
        <p v-if="m.c.asleep" class="my-1 text-ash-300">수면 중 · 피로 {{ Math.floor(m.c.needs.fatigue) }}</p>
        <p class="my-1 text-ash-400">{{ m.status }}</p>
        <select v-model="recipes[m.c.id]" class="my-1 max-w-64 bg-[#211e18] p-1" :aria-label="`${m.c.name} 제작법`"><option :value="undefined" disabled>제작법 선택</option><option v-for="r in m.recipes" :key="r.id" :value="r.id">{{ r.label }}</option></select>
        <input v-model.number="batches[m.c.id]" type="number" min="1" :max="baseCampDef(d.w).maxBatches" class="mx-1 w-14 bg-[#211e18] p-1" :aria-label="`${m.c.name} 제작 횟수·창고 목표 수량`" placeholder="1" />
        <button class="dbtn m-1" :disabled="simulating||!!m.error||!recipes[m.c.id]||m.c.companion!.status==='unpaid'" :title="m.error??''" data-base-order="craft" @click="doAct({type:'baseAssign',target:m.c.id,kind:'craft',recipe:recipes[m.c.id],batches:batches[m.c.id]??1})">제작 배정·재개 (1턴)</button>
        <button class="dbtn m-1" :disabled="simulating||!!m.error||m.c.companion!.status==='unpaid'" :title="m.error??''" data-base-order="guard" @click="doAct({type:'baseAssign',target:m.c.id,kind:'guard'})">거점 방어 (1턴)</button>
        <div class="my-1">
          <select v-model="resources[m.c.id]" class="max-w-56 bg-[#211e18] p-1" :aria-label="`${m.c.name} 운반·채집 물품`"><option :value="undefined" disabled>운반·채집할 물품</option><option v-for="i in materialOptions" :key="i.id" :value="i.id">{{ i.label }}</option></select>
          <button class="dbtn m-1" :disabled="simulating||!!m.error||!resources[m.c.id]||m.c.companion!.status==='unpaid'" :title="m.error??''" data-base-order="haul" @click="doAct({type:'baseAssign',target:m.c.id,kind:'haul',item:resources[m.c.id],batches:batches[m.c.id]??1})">보이는 바닥에서 운반 (1턴)</button>
          <button class="dbtn m-1" :disabled="simulating||!!m.error||!resources[m.c.id]||m.c.companion!.status==='unpaid'" :title="m.error??''" data-base-order="gather" @click="doAct({type:'baseAssign',target:m.c.id,kind:'gather',item:resources[m.c.id],batches:batches[m.c.id]??1})">주변 채집·작물 돌봄 (1턴)</button>
        </div>
        <p v-if="m.task?.kind==='gather'" class="text-ash-400" data-testid="base-crop-care">다 자란 자원을 먼저 모은다. 성장 중인 실제 밭에는 자기 물병이나 창고의 원래 물 용기로 물을 주고 본인이 마실 물을 남긴다. 목표는 창고 납품으로만 채운다.</p>
        <button class="dbtn m-1" :disabled="simulating||!!m.error||m.c.companion!.status==='unpaid'" :title="m.error??`입력한 수량의 한 단위는 ${baseWaterDef(d.w).unitMl}ml다. 실제 병과 수원·정수 도구/연료가 필요하다.`" data-base-order="water" @click="doAct({type:'baseAssign',target:m.c.id,kind:'water',batches:batches[m.c.id]??1})">식수 보급 · 단위당{{ baseWaterDef(d.w).unitMl }}ml (1턴)</button>
        <div v-if="fireOptions.length" class="my-1">
          <select v-model="fires[m.c.id]" class="max-w-60 bg-[#211e18] p-1" :aria-label="`${m.c.name} 모닥불`"><option :value="undefined" disabled>곁의 모닥불 선택</option><option v-for="f in fireOptions" :key="f.uid" :value="String(f.uid)">모닥불 ({{ f.pos.x }},{{ f.pos.y }})</option></select>
          <button class="dbtn m-1" :disabled="simulating||!!m.error||!fireChoice(m.c.id)||m.c.companion!.status==='unpaid'" :title="m.error??'실제 창고 땔감을 나르고 불을 관리한다.'" data-base-order="fire" @click="fireChoice(m.c.id)&&doAct({type:'baseAssign',target:m.c.id,kind:'fire',firePos:fireChoice(m.c.id)!.pos})">모닥불 관리 (1턴)</button>
        </div>
        <div v-if="bedOptions.length" class="my-1">
          <select v-model="beds[m.c.id]" class="max-w-60 bg-[#211e18] p-1" :aria-label="`${m.c.name} 침구`"><option :value="undefined" disabled>곁의 실제 침구 선택</option><option v-for="b in bedOptions" :key="b.uid" :value="String(b.uid)">{{ b.label }} ({{ b.pos.x }},{{ b.pos.y }}){{ b.tenant!==undefined?' · 배정됨':'' }}</option></select>
          <button class="dbtn m-1" :disabled="simulating||!bedChoice(m.c.id)||!!baseBedQuote(d.w,bedChoice(m.c.id)!.pos,m.c).error" :title="bedChoice(m.c.id)?baseBedQuote(d.w,bedChoice(m.c.id)!.pos,m.c).error??'같은 실제 침구를 이 동료에게 허락한다.':''" data-base-bed="assign" @click="assignBed(m.c.id)">침구 사용 허락 ({{ baseRestDef(d.w).assignTurns }}턴)</button>
          <button class="dbtn m-1" :disabled="simulating||!bedChoice(m.c.id)||!!baseBedQuote(d.w,bedChoice(m.c.id)!.pos).error" data-base-bed="release" @click="bedChoice(m.c.id)&&doAct({type:'baseBed',pos:bedChoice(m.c.id)!.pos})">사용 허가 해제 ({{ baseRestDef(d.w).assignTurns }}턴)</button>
        </div>
        <button v-if="m.task" class="dbtn m-1" :disabled="simulating||!!m.error" :title="m.error??''" data-base-order="cancel" @click="doAct({type:'baseAssign',target:m.c.id,kind:'cancel'})">작업 취소 (1턴)</button>
        <p v-if="m.error" class="text-ash-400">{{ m.error }}</p>
      </div>
    </template>
    <template v-else>
      <p class="text-ash-400">본인의 야영지 보관함 곁에서 주변을 정비한다. F2에서 목재/천으로 보관함을 만들어 I창에서 설치할 수도 있다. 주민이 사는 정착지는 점유할 수 없다.</p>
      <button v-for="s in d.stores" :key="`${s.pos.x},${s.pos.y}`" class="dbtn mt-1" :disabled="simulating||!!s.q.error" :title="s.q.error??''" data-testid="base-claim" @click="doAct({type:'claimBase',pos:s.pos})">거점 정비·점유 ({{ s.q.turns }}턴)</button>
    </template>
  </section>
</template>
