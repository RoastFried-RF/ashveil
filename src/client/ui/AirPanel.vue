<script setup lang="ts">
import {computed} from 'vue'
import {airLines,airRules,allItems,dustMask,inhaledAsh,itemLabel,maskRefillQuote,player,type World} from '../../core'
import {version,world,simulating} from '../store'
import {doAct} from '../ui'
const data=computed(()=>{
 void version.value
 const w=world.value as World,p=player(w),active=dustMask(w,p),masks=allItems(p).filter(it=>w.db.item(it.def).respirator).map(it=>({it,label:itemLabel(w,it),worn:Object.values(p.equip).some(i=>i?.uid===it.uid),q:maskRefillQuote(w,p,it.uid)}))
 return{show:inhaledAsh(p)>0||masks.length>0||w.s.map.kind==='surface'&&(airRules(w)?.weather[w.s.weather]??0)>0,lines:airLines(w,p),active,masks}
})
</script>
<template>
  <section v-if="data.show" class="df df-tab p-2 text-xs" data-testid="body-air">
    <p v-for="line in data.lines" :key="line">{{ line }}</p>
    <p v-if="data.active">실제 착용한 여과포의 재 차단 {{ (data.active.protection*100).toFixed(0) }}%</p>
    <p v-else class="text-amber-200">지금 재 먼지를 막는 착용 여과포가 없다. 지붕 아래에서는 바깥 재 먼지를 피할 수 있다.</p>
    <div v-for="m in data.masks" :key="m.it.uid" class="mt-1">
      <p>{{ m.label }} · {{ m.worn?'착용 중':'소지 중' }} · 남은 여과 {{ m.it.uses??0 }}턴</p>
      <button class="dbtn" :data-mask-filter="m.it.uid" :disabled="simulating||!!m.q.error" :title="m.q.error??'새 여과포를 한 번 쓴다. 교체 중에는 보호하지 않고 남은 여과 시간은 버린다.'" @click="doAct({type:'refillMask',uid:m.it.uid,filterUid:m.q.filter!.uid})">여과포 바꾸기 · {{ m.q.turns }}턴</button>
    </div>
  </section>
</template>
