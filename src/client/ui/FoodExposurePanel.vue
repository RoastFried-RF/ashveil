<script setup lang="ts">
import {computed} from 'vue'
import {player,type World} from '../../core'
import {displayFoodExposureLines} from '../locales/food-exposure'
import {t} from '../locale'
import {version,world} from '../store'
const lines=computed(()=>{void version.value;const w=world.value as World;return displayFoodExposureLines(w,player(w))})
</script>
<template>
  <section v-if="lines.length" class="df df-tab p-2 text-xs" data-testid="body-food-exposure">
    <p class="mb-1 text-ash-200">{{ t('음식 노출 기록') }}</p>
    <p v-for="line in lines" :key="line">{{ line }}</p>
  </section>
</template>
