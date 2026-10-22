<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import { preferences as p, preferencesOpen, resetPreferences } from '../preferences'
import {speakText,speechSupported,speechStatus,stopSpeech} from '../speech'
import {primaryBindingText} from '../keybindings'
import Win from './Win.vue'
import { pendingContentAdoption,contentAdopting,reviewCurrentContent,adoptCurrentContent,cancelContentAdoption,version,world, screen, simulating } from '../store'
import { openDefinitionInspector } from '../definition-inspector-ui'
import{GAME_VERSION,DEF_SCHEMA_VERSION}from'../../core/content-version'
import { contentCompatibility } from '../../core/content-compatibility'
import KeyBindingSettings from './KeyBindingSettings.vue'
import LiveContentReload from '../LiveContentReload.vue'
import CheckpointControls from '../CheckpointControls.vue'
const contentStatus=computed(()=>{void version.value;return world.value?contentCompatibility(world.value.s,world.value.db):null})
const adoptionError=ref('')
async function confirmAdoption(){const token=pendingContentAdoption.value?.token;adoptionError.value=token?(await adoptCurrentContent(token)??''):'현재 검토가 없다'}
const width = window.innerWidth
const checks = [['screenShake', '화면 흔들림'], ['torchFlicker', '횃불·조명 깜빡임'], ['hitFlash', '피격 섬광'], ['warningPulse', '위험 경고 맥동']] as const
const previousFocus = document.activeElement as HTMLElement | null
onMounted(() => document.querySelector<HTMLInputElement>('[data-testid="win-settings"] input')?.focus())
onBeforeUnmount(() => {cancelContentAdoption();previousFocus?.focus()})
</script>

<template>
  <div class="fixed inset-0 z-[6000] flex items-start justify-center bg-black/65" role="dialog" aria-modal="true" aria-label="화면·접근성 설정">
    <Win title="화면·접근성 설정" :x="Math.max(8, (width - 460) / 2)" :y="70" :width="460" testid="win-settings" @close="preferencesOpen = false">
      <div class="space-y-4 p-2 text-sm text-ash-200">
        <CheckpointControls v-if="screen==='game'" />
        <label class="flex items-center justify-between">지도 배율
          <select v-model="p.mapZoom" class="bg-ash-800 p-1" aria-label="지도 배율" data-testid="map-zoom"><option value="auto">화면에 맞춤</option><option value="vision">전체 시야 맞춤</option><option :value="1">1배 · 넓게</option><option :value="2">2배</option><option :value="3">3배</option><option :value="4">4배 · 크게</option></select>
        </label>
        <p class="text-xs text-ash-400">‘전체 시야 맞춤’은 주변을 넓게 보여 준다. 배율은 보이는 거리나 턴을 바꾸지 않는다.</p>
        <label class="block">기록 글자 크기: {{ p.logFontSize }}px
          <input v-model.number="p.logFontSize" type="range" min="12" max="24" step="1" class="block w-full" aria-label="기록 글자 크기" />
        </label>
        <label class="flex items-center justify-between">연출 속도
          <select v-model.number="p.animationSpeed" class="bg-ash-800 p-1" aria-label="연출 속도"><option :value="0">즉시</option><option :value="0.5">0.5배</option><option :value="1">1배</option><option :value="2">2배</option></select>
        </label>
        <label class="flex items-center justify-between">상태 색상
          <select v-model="p.palette" class="bg-ash-800 p-1" aria-label="상태 색상"><option value="standard">기본</option><option value="redgreen">적록 구분 보조</option><option value="blueyellow">청황 구분 보조</option></select>
        </label>
        <p class="text-xs text-ash-400">체력·기력·위험 막대 색을 바꾼다. 상태는 수치와 무늬로도 표시한다.</p>
        <label class="flex items-center justify-between">떠오르는 표시
          <select v-model="p.floaters" class="bg-ash-800 p-1" aria-label="떠오르는 표시"><option value="normal">보통</option><option value="large">크게 (1.5배)</option><option value="off">숨기기 · 기록으로 확인</option></select>
        </label>
        <label v-for="[key, label] in checks" :key="key" class="flex items-center gap-2"><input v-model="p[key]" type="checkbox" />{{ label }}</label>
        <details class="border-y border-ash-600 py-2" data-testid="key-repeat-settings">
          <summary class="cursor-pointer font-title">키 반복 지연·속도</summary>
          <label class="my-2 flex items-center justify-between">키를 누르고 있을 때
            <select v-model="p.keyRepeatMode" class="bg-ash-800 p-1" aria-label="키 반복 방식" data-testid="key-repeat-mode"><option value="system">운영체제 기본</option><option value="limited">지연·속도 제한</option><option value="once">한 번만 실행</option></select>
          </label>
          <template v-if="p.keyRepeatMode==='limited'">
            <label class="my-2 block">처음 반복까지 {{ p.keyRepeatDelay }}ms<input v-model.number="p.keyRepeatDelay" type="range" min="0" max="2000" step="50" class="block w-full" aria-label="처음 반복 지연" data-testid="key-repeat-delay" /></label>
            <label class="my-2 block">반복 간격 {{ p.keyRepeatInterval }}ms<input v-model.number="p.keyRepeatInterval" type="range" min="50" max="1000" step="25" class="block w-full" aria-label="키 반복 간격" data-testid="key-repeat-interval" /></label>
          </template>
          <p class="text-xs text-ash-400">이동·대기에 적용한다. ‘한 번만’은 키를 떼고 다시 눌러야 한다. 창·물품·전투 확정은 한 번 눌렀을 때 한 번만 실행한다.</p>
        </details>
        <details class="border-y border-ash-600 py-2" data-testid="speech-settings">
          <summary class="cursor-pointer font-title">기록·툴팁 읽기 지원</summary>
          <label class="my-2 flex items-center gap-2"><input v-model="p.speechEnabled" type="checkbox" data-testid="speech-enabled" />음성 읽기 사용</label>
          <label class="my-2 block">읽기 속도 {{ p.speechRate }}배<input v-model.number="p.speechRate" type="range" min="0.5" max="2" step="0.1" class="block w-full" aria-label="읽기 속도" data-testid="speech-rate" /></label>
          <p class="text-xs text-ash-400">기록의 ‘읽기’ 버튼 또는 {{ primaryBindingText(p.keyBindings,'readAloud') }}: 현재 툴팁·커서 정보, 없으면 표시된 기록을 읽는다. {{ primaryBindingText(p.keyBindings,'stopReading') }}: 멈춤. 읽기는 턴을 쓰지 않는다.</p>
          <p v-if="!speechSupported()" class="my-1 text-xs text-ash-400">이 브라우저에서는 음성 읽기를 지원하지 않는다.</p>
          <div class="my-2 flex gap-2"><button class="dbtn" :disabled="!p.speechEnabled||!speechSupported()" data-testid="speech-sample" @click="speakText('화면에 표시된 기록과 도움말을 읽는다. 읽기는 게임의 턴을 진행하지 않는다.')">읽기 시험</button><button class="dbtn" data-testid="speech-stop" @click="stopSpeech">읽기 멈춤</button></div>
          <p class="text-xs text-ash-400" role="status" data-testid="speech-status">{{ speechStatus }}</p>
        </details>
        <KeyBindingSettings />
        <details v-if="contentStatus" class="border-y border-ash-600 py-2" data-testid="content-identity-settings">
          <summary>각인 콘텐츠 구성</summary>
          <div v-if="world?.s.loadHash===undefined" class="my-2 space-y-2" data-testid="content-adoption-controls">
            <button class="dbtn" data-testid="content-adoption-open" :disabled="contentAdopting||simulating" @click="adoptionError=reviewCurrentContent()??''">현재 구성으로 기록 시작</button>
            <section v-if="pendingContentAdoption" class="space-y-2 border border-amber-800 p-2" data-testid="content-adoption-review">
              <p>이전 구성은 알 수 없다. 지금 적용 중인 아래 구성으로 기록을 시작하고 업적 기록을 비활성화한다.</p>
              <p>현재 게임 {{ GAME_VERSION }} · 정의 계약 {{ DEF_SCHEMA_VERSION }} · {{ pendingContentAdoption.turn }}턴</p>
              <ul class="max-h-32 overflow-auto"><li v-for="mod in pendingContentAdoption.mods" :key="mod.id" class="break-all">{{ mod.id }} · {{ mod.version }}<span class="block font-mono text-[10px]">{{ mod.hash }}</span></li></ul>
              <div class="flex gap-2"><button class="dbtn-gold" data-testid="content-adoption-confirm" :disabled="contentAdopting" @click="confirmAdoption">이 현재 구성으로 기록</button><button class="dbtn" data-testid="content-adoption-cancel" :disabled="contentAdopting" @click="cancelContentAdoption();adoptionError=''">취소</button></div>
            </section>
          </div>
          <p v-if="adoptionError" class="break-all text-red-300" role="alert">{{ adoptionError }}</p>
          <p v-if="contentAdopting" class="text-amber-200">현재 구성 기록을 각인에 저장 중이다.</p>
          <p v-if="world?.s.contentAdoptedAt" data-testid="content-adoption-origin">이전 구성 기록이 없는 각인에서 {{ world.s.contentAdoptedAt.turn }}턴에 현재 구성 기록을 시작했다.</p>
          <p data-testid="save-version-identity">각인 {{ world?.s.version }} · 게임 {{ world?.s.gameVersion??'기록 없음' }} · 정의 계약 {{ world?.s.defSchemaVersion??'기록 없음' }}</p>
          <p v-if="!world?.s.contentMods" class="text-ash-400">구형 각인에는 개별 모드 버전/해시 기록이 없다.</p>
          <ul v-else class="max-h-36 space-y-1 overflow-auto" data-testid="save-mod-records"><li v-for="mod in world.s.contentMods" :key="mod.id" class="break-all">{{ mod.id }} · {{ mod.version }}<span class="block font-mono text-[10px]">{{ mod.hash }}</span></li></ul>
          <p class="break-all" data-testid="settings-final-mod-order">현재 모드 적용 순서: {{ world?.db.loadedMods.join(' → ') }}</p>
          <p v-if="contentStatus.status==='unknown'" class="my-1 text-ash-400">구형 각인에는 콘텐츠 해시 기록이 없다. 과거 구성을 현재 값으로 채우지 않는다.</p>
          <p v-else class="my-1">{{ contentStatus.status==='same'?'각인 기록과 현재 콘텐츠 구성이 같다.':'각인 기록과 현재 콘텐츠 구성이 다르다.' }}</p>
          <p v-if="contentStatus.recorded" class="break-all font-mono text-[10px]">각인 기록: {{ contentStatus.recorded }}</p>
          <p v-if="world?.s.achievementsDisabled" class="my-1 text-amber-200">콘텐츠 변경으로 업적 기록 비활성 상태다.</p>
          <p class="break-all font-mono text-[10px]">현재 구성: {{ contentStatus.current }}</p>
        </details>
        <LiveContentReload v-if="world&&screen==='game'" />
        <button v-if="world" class="dbtn" :disabled="simulating" data-testid="open-definition-inspector" @click="openDefinitionInspector(world.db.loadedMods.filter(id=>id!=='core'))">모드 제작 · Def 조회</button>
        <p class="text-xs text-ash-400">설정은 바로 적용하고 다음 실행에도 유지한다. 연출 속도는 게임의 턴과 판정에 영향을 주지 않는다.</p>
        <div class="flex justify-between"><button class="dbtn" @click="resetPreferences">기본값 복원</button><button class="dbtn-gold" @click="preferencesOpen = false">닫기 (Esc)</button></div>
      </div>
    </Win>
  </div>
</template>

