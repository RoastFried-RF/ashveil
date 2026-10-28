<script setup lang="ts">
import {computed} from 'vue'
import {canSee,player,type BreakDef,type World} from '../../core'
import {version,world} from '../store'
const props=defineProps<{personId:number}>()
const data=computed(()=>{
 void version.value
 const w=world.value as World,c=w.s.creatures.find(c=>c.id===props.personId)
 if(!c?.alive||!c.breakdown||w.db.body(c.body.def).kind!=='humanoid'||!canSee(w,player(w),c.pos))return null
 return{label:w.db.get<BreakDef>(c.breakdown.def).label}
})
</script>
<template>
  <p v-if="data" class="my-2 text-xs text-rose-300" data-testid="npc-psyche">불안정한 행동 · {{ data.label }}</p>
</template>
