<script setup lang="ts">
import GameScreen from './GameScreen.vue'
import TitleScreen from './TitleScreen.vue'
import { screen } from './store'
</script>

<template>
  <TitleScreen v-if="screen === 'title'" />
  <GameScreen v-else />
</template>
