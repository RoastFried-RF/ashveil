<script setup lang="ts">
import {computed,ref} from 'vue'
import {player,tileAt,ceilingInspectionError,toxinCoatQuote,itemLabel,type World,type ItemDef} from '../../core'
import {world,version,simulating} from '../store'
import {doAct} from '../ui'
import ItemIcon from './ItemIcon.vue'
const arrowUid=ref<number>()
const d=computed(()=>{
 void version.value;const w=world.value as World,p=player(w),projectiles=new Set(w.db.all<ItemDef>('Item').filter(i=>i.ranged&&!i.ranged.firearm).map(i=>i.ranged!.ammo)),arrows=p.bag.filter(i=>projectiles.has(i.def)&&i.count>0&&!i.toxin),arrow=arrows.find(i=>i.uid===arrowUid.value)??arrows[0]
 return{roof:tileAt(w,p.pos).roof,error:ceilingInspectionError(w,p),arrow,arrows:arrows.map(i=>({uid:i.uid,label:itemLabel(w,i)})),glands:p.bag.filter(i=>w.db.item(i.def).neurotoxin&&(i.uses??0)>0).map(i=>({uid:i.uid,def:i.def,sprite:w.db.item(i.def).sprite,label:itemLabel(w,i),error:toxinCoatQuote(w,p,i.uid,arrow?.uid??-1).error})),coated:p.bag.filter(i=>i.toxin).map(i=>({uid:i.uid,label:itemLabel(w,i)}))}
})
</script>
<template>
  <section v-if="d.roof||d.glands.length||d.coated.length" class="mt-3 border-t border-ash-600 pt-2 text-xs" data-testid="crawler-panel">
    <h3 class="mb-1 font-bold">천장 경계·신경독</h3>
    <div v-if="d.roof" class="mb-2 flex items-center gap-2">
      <button class="dbtn" data-testid="inspect-ceiling" :disabled="simulating||!!d.error" :title="d.error??'곁의 천장을 실제로 살핀다 · 1턴'" @click="doAct({type:'inspectCeiling'})">천장 살피기</button>
      <span class="text-ash-400">곁의 천장 · 1턴 · 미리 본 지네의 낙하를 경계</span>
    </div>
    <p v-if="d.glands.length" class="mb-2 text-ash-400">남은 독샘 한 회분을 화살 한 발에 바른다. 발사하면 독도 소모된다.</p>
    <select v-if="d.glands.length&&d.arrows.length" class="mb-2 bg-ash-900 p-1" :value="d.arrow?.uid" data-testid="toxin-arrow" @change="arrowUid=Number(($event.target as HTMLSelectElement).value)">
      <option v-for="it in d.arrows" :key="it.uid" :value="it.uid">{{ it.label }}</option>
    </select>
    <div v-for="it in d.glands" :key="it.uid" class="mb-2 flex items-center gap-2">
      <ItemIcon :name="it.sprite" :size="24" />
      <button class="dbtn" :data-coat-arrow="it.uid" :disabled="simulating||!!it.error" :title="it.error??'실제 독1회분·화살1발 · 1턴'" @click="doAct({type:'coatArrow',uid:it.uid,arrowUid:d.arrow!.uid})">{{ it.label }} · 독 바르기</button>
      <span class="text-ash-400">{{ it.error??'1턴' }}</span>
    </div>
    <button v-for="it in d.coated" :key="it.uid" class="dbtn mr-2 mb-2" :data-select-toxin="it.uid" :disabled="simulating" @click="doAct({type:'selectAmmo',uid:it.uid})">{{ it.label }} · 다음 사격에 선택</button>
  </section>
</template>
