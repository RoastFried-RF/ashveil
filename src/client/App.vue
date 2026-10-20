<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch, watchEffect } from 'vue'
import GameScreen from './GameScreen.vue'
import TitleScreen from './TitleScreen.vue'
import { uiUrls, base } from './render/atlas'
import { screen } from './store'
import { bindingCapture, paletteColor, preferences, preferencesOpen } from './preferences'
import {stopSpeech} from './speech'
import SettingsWindow from './ui/SettingsWindow.vue'
import DefinitionInspector from './ui/DefinitionInspector.vue'
import { definitionInspectorOpen } from './definition-inspector-ui'

watch(screen,()=>stopSpeech())
function settingsKey(e: KeyboardEvent) {
  if (definitionInspectorOpen.value) {
    if (e.key === 'Escape' || e.key === 'F3') { e.preventDefault(); e.stopImmediatePropagation(); definitionInspectorOpen.value = false; if(e.key==='F3')preferencesOpen.value=true }
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation()
      const controls=[...document.querySelectorAll<HTMLElement>('[data-testid="definition-inspector"] button, [data-testid="definition-inspector"] input, [data-testid="definition-inspector"] textarea, [data-testid="definition-inspector"] select, [data-testid="definition-inspector"] summary')].filter(el=>el.offsetParent!==null&&!el.matches(':disabled'))
      const at=controls.indexOf(document.activeElement as HTMLElement)
      controls[(at+(e.shiftKey?controls.length-1:1))%controls.length]?.focus()
    }
    return
  }
  if(bindingCapture.value)return
  if (e.key === 'F3') { e.preventDefault(); e.stopImmediatePropagation(); preferencesOpen.value = !preferencesOpen.value; return }
  if (preferencesOpen.value) {
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation()
      const controls = [...document.querySelectorAll<HTMLElement>('[data-testid="win-settings"] button, [data-testid="win-settings"] input, [data-testid="win-settings"] select, [data-testid="win-settings"] summary')].filter((el) => el.offsetParent !== null)
      const at = controls.indexOf(document.activeElement as HTMLElement)
      controls[(at + (e.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus()
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); preferencesOpen.value = false }
  }
}
watchEffect(() => {
  const root = document.documentElement
  root.dataset.palette = preferences.palette
  root.dataset.instant = String(preferences.animationSpeed === 0)
  root.dataset.noPulse = String(!preferences.warningPulse)
  for (const key of ['health', 'energy', 'warn', 'danger'] as const) root.style.setProperty(`--state-${key}`, paletteColor(key))
})
// 다크에이지 UI 이미지 경로를 CSS 변수로 주입 (상대 base 에서도 동작)
onMounted(() => {
  window.addEventListener('keydown', settingsKey, true)
  const root = document.documentElement
  for (const [k, v] of Object.entries(uiUrls)) root.style.setProperty(`--ui-${k}`, `url("${new URL(base() + v, window.location.href).href}")`)
})
onBeforeUnmount(() => {stopSpeech();window.removeEventListener('keydown', settingsKey, true)})
</script>

<template>
  <SettingsWindow v-if="preferencesOpen" />
  <DefinitionInspector v-if="definitionInspectorOpen" />
  <TitleScreen v-if="screen === 'title'" />
  <GameScreen v-else />
</template>
