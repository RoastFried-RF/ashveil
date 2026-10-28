<script setup lang="ts">
import {t} from './locale'
const props=defineProps<{modelValue:string[];names:Record<string,string>;disabled?:boolean;prefix:string}>()
const emit=defineEmits<{'update:modelValue':[value:string[]]}>()
function move(index:number,offset:number){const target=index+offset;if(props.disabled||target<0||target>=props.modelValue.length)return;const next=[...props.modelValue];[next[index],next[target]]=[next[target]!,next[index]!];emit('update:modelValue',next)}
</script>
<template>
  <div v-if="modelValue.length" class="space-y-1 rounded border border-ash-700 p-2 text-xs" :data-testid="`${prefix}-mod-order`">
    <p class="text-ash-400">{{ t("모드 적용 우선순위 · 의존 관계를 지켜 최종 순서를 정한다.") }}</p>
    <div v-for="(id,index) in modelValue" :key="id" class="flex items-center gap-2"><span class="min-w-0 flex-1 truncate">{{ index+1 }}. {{ names[id]??id }}</span><button class="dbtn" :aria-label="t('{0} 위로',names[id]??id)" :data-testid="`${prefix}-mod-up-${id}`" :disabled="disabled||index===0" @click="move(index,-1)">↑</button><button class="dbtn" :aria-label="t('{0} 아래로',names[id]??id)" :data-testid="`${prefix}-mod-down-${id}`" :disabled="disabled||index===modelValue.length-1" @click="move(index,1)">↓</button></div>
  </div>
</template>
