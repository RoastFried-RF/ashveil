<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BackgroundDef } from '../core'
import { buildDb, chronicle, continueImprint, hasImprint, packages, randomSeed, startNew } from './store'

const seed = ref(randomSeed())
const bg = ref<string>('')
const err = ref<string | null>(null)
const mods = ref<string[]>([])
const optionalMods = packages.filter((p) => p.manifest.id !== 'core')
const imprint = ref(hasImprint())
const chron = ref(chronicle())

const backgrounds = computed(() => buildDb(mods.value).all<BackgroundDef>('Background'))

function start() {
  err.value = null
  startNew(seed.value.trim() || randomSeed(), bg.value || undefined, mods.value)
}
function cont() {
  err.value = continueImprint()
  imprint.value = hasImprint()
}
</script>

<template>
  <div class="flex h-full items-start justify-center overflow-auto px-4 py-10">
    <div class="w-full max-w-3xl space-y-6">
      <header class="space-y-2 text-center">
        <h1 class="text-5xl font-bold tracking-[0.3em] text-ash-100">ASHVEIL</h1>
        <p class="text-ash-400">재의 장막 아래, 회색 고원의 폐허. 피 한 방울도 기록된다.</p>
        <p class="text-xs text-ash-500">프로토타입 v0.1 · 각인 모드(단일 저장, 죽으면 끝) · 키보드 권장 (모바일은 맵 클릭으로 한 칸씩 이동)</p>
      </header>

      <section v-if="imprint" class="panel space-y-2 p-4">
        <h2 class="text-sm font-semibold text-amber-300">이어서 하기</h2>
        <p class="text-xs text-ash-400">각인된 떠돌이가 있다. 각인은 하나뿐이다. 새로 시작하면 덮어쓴다.</p>
        <button class="btn !px-4 !py-1.5 !text-sm" data-testid="continue" @click="cont">각인 불러오기</button>
      </section>

      <section class="panel space-y-4 p-4">
        <h2 class="text-sm font-semibold text-amber-300">새 떠돌이</h2>
        <label class="block space-y-1 text-xs">
          <span class="text-ash-400">시드 (같은 시드 + 같은 입력 = 같은 세계)</span>
          <div class="flex gap-2">
            <input v-model="seed" data-testid="seed" class="w-full rounded border border-ash-600 bg-ash-800 px-2 py-1 font-mono text-sm text-ash-100 outline-none focus:border-amber-500" />
            <button class="btn" @click="seed = randomSeed()">무작위</button>
          </div>
        </label>
        <div class="space-y-1 text-xs">
          <span class="text-ash-400">배경</span>
          <div class="grid gap-2 sm:grid-cols-2">
            <button :class="['rounded border p-2 text-left', bg === '' ? 'border-amber-500 bg-ash-800' : 'border-ash-700 hover:border-ash-500']" @click="bg = ''">
              <div class="text-sm text-ash-100">무작위</div>
              <div class="text-ash-400">시드가 정한다.</div>
            </button>
            <button v-for="b in backgrounds" :key="b.id" :class="['rounded border p-2 text-left', bg === b.id ? 'border-amber-500 bg-ash-800' : 'border-ash-700 hover:border-ash-500']" @click="bg = b.id">
              <div class="text-sm text-ash-100">{{ b.label }} <span v-if="!b.literate" class="text-[10px] text-ash-500">(문맹)</span></div>
              <div class="text-ash-400">{{ b.description }}</div>
            </button>
          </div>
        </div>
        <div v-if="optionalMods.length" class="space-y-1 text-xs">
          <span class="text-ash-400">모드 (core 는 항상 켜짐)</span>
          <label v-for="m in optionalMods" :key="m.manifest.id" class="flex items-start gap-2 rounded border border-ash-700 p-2">
            <input v-model="mods" type="checkbox" :value="m.manifest.id" class="mt-0.5" />
            <span>
              <span class="text-ash-100">{{ m.manifest.name }}</span>
              <span class="ml-1 text-ash-500">{{ m.manifest.version }}</span>
              <span class="block text-ash-400">{{ m.manifest.description }}</span>
            </span>
          </label>
        </div>
        <button class="btn !border-amber-600 !px-4 !py-1.5 !text-sm !text-amber-200" data-testid="start" @click="start">고원으로 들어선다</button>
        <p v-if="err" class="text-xs text-blood-300">{{ err }}</p>
      </section>

      <section v-if="chron.length" class="panel space-y-2 p-4">
        <h2 class="text-sm font-semibold text-amber-300">연대기</h2>
        <ul class="space-y-2 text-xs">
          <li v-for="c in chron.slice(0, 12)" :key="c.at" class="border-l-2 pl-2" :class="c.kind === 'escape' ? 'border-moss-500' : 'border-blood-500'">
            <div class="text-ash-200">{{ c.report.epitaph }}</div>
            <div class="text-ash-500">{{ c.report.background }} · {{ c.report.traits.join(', ') }} · 시드 {{ c.seed }}</div>
          </li>
        </ul>
      </section>

      <footer class="text-center text-[11px] text-ash-500">
        타일: Dungeon Crawl Stone Soup 32×32 (CC0) · RimWorld·Stoneshard 의 구조에서 영감을 받은 독자 창작
      </footer>
    </div>
  </div>
</template>
