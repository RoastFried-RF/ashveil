<script setup lang="ts">
// 일지: 기록(전체 로그) · 도감 · 약 · 생존 상태
import { computed, ref } from 'vue'
import {
  activeThoughts, ambientTemp, comfortMin, fmtClock, insulation, mood, player, turnOf,
  type CreatureDef, type ItemDef, type World,
} from '../../core'
import { KIND_CLASS } from '../format'
import { version, world } from '../store'
import { wins } from '../ui'
import Bar from './Bar.vue'
import Win from './Win.vue'

// 탭 (12 §2.3): 지식 · 도감 · 소문 · 사건 · 연대기 (+ 생존 상태 · 전체 기록)
type Tab = 'log' | 'beast' | 'pill' | 'needs' | 'rumor' | 'events' | 'chron'
const tab = ref<Tab>('needs')
const TABS: [Tab, string][] = [['needs', '생존'], ['pill', '지식'], ['beast', '도감'], ['rumor', '소문'], ['events', '사건'], ['chron', '연대기'], ['log', '기록']]
const EVENT_LABEL: Record<string, string> = { 'Event.ReaverPatrol': '약탈자 순찰', 'Event.ReaverSearch': '약탈자 수색대 출발', 'Event.StashRaided': '야영지 보관함 약탈', 'Event.Reoccupy': '던전 재점거' }

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const k = w.s.knowledge
  const n = pl.needs
  return {
    log: w.s.log.slice(-200).reverse(),
    pills: w.db.all<ItemDef>('Item').filter((i) => i.unidentified === 'pill').map((i) => ({ label: i.label, known: k.pillKnown[i.id] ? w.db.pill(k.pillKnown[i.id]) : null })),
    beasts: w.db.all<CreatureDef>('Creature').filter((c) => !c.abstract && c.faction !== 'player' && c.faction !== 'beasts' && c.faction !== 'vermin').map((c) => {
      const b = k.bestiary[c.id]
      const stage = !b ? 0 : b.killed > 0 ? 3 : b.fought > 0 ? 2 : 1
      return { c, b, stage, lines: (c.bestiary ?? []).slice(0, stage) }
    }),
    needs: [
      ['열량', n.kcal, 3000, `${Math.round(n.kcal)} kcal`], ['수분', n.water, 3000, `${Math.round(n.water)} ml`],
      ['비타민', n.vitamin, 100, n.vitamin.toFixed(0)], ['피로', 100 - n.fatigue, 100, `${n.fatigue.toFixed(0)}`], ['스트레스', 100 - n.stress, 100, n.stress.toFixed(0)],
    ] as [string, number, number, string][],
    temp: `체온 ${n.bodyTemp.toFixed(1)}°C · 기온 ${ambientTemp(w, pl.pos).toFixed(1)}°C · 단열 ${insulation(w, pl)} (쾌적 ≥${comfortMin(w, pl).toFixed(0)}°C) · 젖음 ${n.wetness.toFixed(0)}%`,
    mood: mood(w, pl), thoughts: activeThoughts(w, pl).sort((a, b) => a.mood - b.mood),
    clock: fmtClock(turnOf(w)),
    events: w.s.storyteller.history.slice(-40).reverse().map((e) => ({ when: fmtClock(e.turn), label: EVENT_LABEL[e.event] ?? e.event })),
    chron: pl.history.slice(-80).reverse().map((h) => ({ when: fmtClock(h.turn), text: h.text })),
  }
})
</script>

<template>
  <Win title="일지" :x="200" :y="90" :width="470" testid="win-journal" @close="wins.journal = false">
    <div class="mb-2 flex gap-1">
      <button v-for="[k, l] in TABS" :key="k" class="df px-2 text-xs" :class="tab === k ? 'df-tab-sel text-amber-100' : 'df-tab text-ash-300'" @click="tab = k">{{ l }}</button>
    </div>
    <div class="text-xs">
      <template v-if="tab === 'needs'">
        <div class="mb-2 text-ash-400">{{ d.clock }}</div>
        <div v-for="[k, v, m, t] in d.needs" :key="k" class="mb-1 flex items-center gap-2">
          <span class="w-14 text-ash-400">{{ k }}</span>
          <div class="flex-1"><Bar :value="Math.max(0, v)" :max="m" :color="v / m > 0.4 ? 'green' : 'red'" :height="12" /></div>
          <span class="w-20 text-right font-mono text-ash-300">{{ t }}</span>
        </div>
        <p class="mt-2 text-ash-300">{{ d.temp }}</p>
        <div class="mt-2 font-title text-sm text-[#e8d7a8]">기분 {{ d.mood.toFixed(0) }}</div>
        <div v-for="t in d.thoughts" :key="t.def" class="flex justify-between"><span class="text-ash-300">{{ t.label }}</span><span class="font-mono" :class="t.mood < 0 ? 'text-blood-300' : 'text-moss-300'">{{ t.mood > 0 ? '+' : '' }}{{ t.mood }}</span></div>
      </template>
      <template v-else-if="tab === 'beast'">
        <p class="mb-1 text-ash-400">보고 → 싸우고 → 쓰러뜨려야 더 알게 된다.</p>
        <div v-for="x in d.beasts" :key="x.c.id" class="df df-tab mb-1">
          <div class="flex justify-between"><span :class="x.stage ? 'text-ash-100' : 'text-ash-500'">{{ x.stage ? x.c.label : '???' }}</span><span v-if="x.b" class="text-ash-500">교전 {{ x.b.fought }} · 처치 {{ x.b.killed }}</span></div>
          <p v-for="(l, i) in x.lines" :key="i" class="mt-0.5 text-ash-300">{{ ['관찰', '전투', '처치'][i] }}: {{ l }}</p>
        </div>
      </template>
      <template v-else-if="tab === 'pill'">
        <p class="mb-1 text-ash-400">알약의 색과 효과는 시드마다 섞인다.</p>
        <div v-for="p in d.pills" :key="p.label" class="flex justify-between border-b border-[#2e2a22] py-0.5"><span>{{ p.label }}</span><span :class="p.known ? 'text-moss-300' : 'text-ash-500'" :title="p.known?.description">{{ p.known ? p.known.label : '???' }}</span></div>
      </template>
      <template v-else-if="tab === 'rumor'">
        <p class="text-ash-400">서가·석관의 쪽지, 포로, 시체 소지품에서 듣는 소문이 여기에 모인다. (쪽지 콘텐츠는 후속)</p>
      </template>
      <template v-else-if="tab === 'events'">
        <p class="mb-1 text-ash-400">장소에서 일어난 일. 순찰은 매일 06:00, 흔적을 보면 수색대가 나온다.</p>
        <div v-for="(e, i) in d.events" :key="i" class="flex justify-between border-b border-[#2e2a22] py-0.5"><span class="font-mono text-ash-500">{{ e.when }}</span><span class="text-ash-200">{{ e.label }}</span></div>
        <p v-if="!d.events.length" class="text-ash-500">아직 없다.</p>
      </template>
      <template v-else-if="tab === 'chron'">
        <div v-for="(h, i) in d.chron" :key="i" class="font-mono text-[11px] leading-5"><span class="text-ash-600">{{ h.when }}</span> <span class="text-ash-200">{{ h.text }}</span></div>
        <p v-if="!d.chron.length" class="text-ash-500">아직 없다.</p>
      </template>
      <template v-else>
        <div v-for="(e, i) in d.log" :key="i" :class="KIND_CLASS[e.kind]" class="font-mono text-[11px] leading-5"><span class="text-ash-600">{{ fmtClock(e.turn).slice(-5) }}</span> {{ e.text }}</div>
      </template>
    </div>
  </Win>
</template>
