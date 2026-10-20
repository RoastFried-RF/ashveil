<script setup lang="ts">
import {computed} from 'vue'
import {storySafeSleep} from '../../core/story-safe-sleep'
import {storyPressureQuote} from '../../core/story-director'
import {world,version} from '../store'
import type {World} from '../../core/ctx'
const data=computed(()=>{void version.value;const w=world.value as World;return{...storyPressureQuote(w),safeSleep:storySafeSleep(w)}})
</script>
<template>
  <section v-if="data.profile&&data.state" class="mb-3 border border-ash-700 p-2 text-xs" data-testid="story-director">
    <p class="text-amber-100">사건 흐름 · {{ data.profile.label }}</p>
    <p>{{ data.profile.description }}</p>
    <p>지금 느끼는 긴장 {{ data.state.tension }}/100 · 명성 {{ data.state.fame?.value??0 }}/100</p>
    <p v-if="data.safeSleep" data-testid="story-safe-sleep" class="text-ash-300">{{ data.safeSleep==='camp'?'실제 점유 거점의 침구':'실제 잠긴 방의 침구' }}에서 잠들어 긴장이 더 빨리 가라앉는다.</p>
    <p class="text-ash-400">{{ data.reason??'장소에 남은 실제 인원이 있을 때 강화가 가능하다' }}</p>
    <p class="text-ash-500">사건은 기존 주민이 출발해 걸어서 온다. 몸·물품·시간의 규칙은 같다.</p>
  </section>
</template>
