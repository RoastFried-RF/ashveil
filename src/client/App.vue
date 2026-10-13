<script setup lang="ts">
import { onMounted } from 'vue'
import GameScreen from './GameScreen.vue'
import TitleScreen from './TitleScreen.vue'
import { uiUrls, base } from './render/atlas'
import { screen } from './store'

// 다크에이지 UI 이미지 경로를 CSS 변수로 주입 (상대 base 에서도 동작)
onMounted(() => {
  const root = document.documentElement
  for (const [k, v] of Object.entries(uiUrls)) root.style.setProperty(`--ui-${k}`, `url("${new URL(base() + v, window.location.href).href}")`)
})
</script>

<template>
  <TitleScreen v-if="screen === 'title'" />
  <GameScreen v-else />
</template>
