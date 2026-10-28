<script setup lang="ts">
import {computed} from 'vue'
import {itemDef,itemLabel,player,economyDef,type World} from '../../core'
import {appraisalQuote} from '../../core/merchant-appraisal'
import {knowledgeDef,pillBelief} from '../../core/knowledge-state'
import {simulating,version,world} from '../store'
import {doAct} from '../ui'
const props=defineProps<{traderId:number}>()
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),trader=w.s.creatures.find(c=>c.id===props.traderId)
 if(!trader||!knowledgeDef(w).appraisal)return null
 const rows=p.bag.filter(it=>it.count>0&&itemDef(w,it).unidentified==='pill'&&pillBelief(w,it.def)?.confidence!=='certain').map(it=>({it,label:itemLabel(w,it),quote:appraisalQuote(w,p,trader,it.uid)}))
 return{rows,trader,currency:economyDef(w).currency}
})
</script>
<template>
  <section v-if="data?.rows.length" class="my-2 border-y border-ash-600 py-2 text-xs" data-testid="appraisal-panel">
    <h3 class="font-bold">약 감별</h3>
    <p class="my-1 text-ash-300">상인의 말은 추정이다. 사용·직접 감별·문헌으로 확인할 수 있다.</p>
    <div class="max-h-40 overflow-y-auto">
      <div v-for="row in data.rows" :key="row.it.uid" class="my-1" :data-testid="'appraisal-item-'+row.it.uid">
        <span>{{ row.label }} · {{ row.quote.fee }}{{ data.currency }}</span>
        <button class="dbtn ml-2" :disabled="simulating||!!row.quote.error" :data-testid="'appraise-'+row.it.uid" @click="doAct({type:'merchantIdentify',target:data.trader.id,uid:row.it.uid,expectedFee:row.quote.fee})">감별을 부탁한다 (1턴)</button>
        <p v-if="row.quote.error" class="text-amber-200">{{ row.quote.error }}</p>
      </div>
    </div>
  </section>
</template>
