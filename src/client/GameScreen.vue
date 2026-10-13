<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  adjacentContainer, cheb, creatureAt, DIRS, hostile, itemDef, mainWeapon, player, type Action, type Creature, type Pos, type World,
} from '../core'
import BodyPanel from './BodyPanel.vue'
import HoverInfo from './HoverInfo.vue'
import InventoryPanel from './InventoryPanel.vue'
import KnowledgePanel from './KnowledgePanel.vue'
import LogPanel from './LogPanel.vue'
import MapView from './MapView.vue'
import StatusPanel from './StatusPanel.vue'
import { abandonToTitle, act, version, world } from './store'

type Tab = 'status' | 'body' | 'inv' | 'know'
const tab = ref<Tab>('body')
const hover = ref<Pos | null>(null)
const shift = ref(false)
const help = ref(false)
const hint = ref<string | null>(null)
const mode = ref<{ kind: 'shoot'; targets: number[]; idx: number } | { kind: 'throw'; uid: number } | null>(null)

const w = computed(() => { void version.value; return world.value as World })
const over = computed(() => { void version.value; return world.value?.s.over ?? null })

const visibleEnemies = computed<Creature[]>(() => {
  void version.value
  const ww = w.value
  const pl = player(ww)
  const vis = new Set(ww.s.visible)
  return ww.s.creatures
    .filter((c) => c.alive && hostile(pl, c) && vis.has(c.pos.y * ww.s.map.w + c.pos.x))
    .sort((a, b) => cheb(a.pos, pl.pos) - cheb(b.pos, pl.pos))
})

const target = computed<Pos | null>(() => {
  const m = mode.value
  if (m?.kind === 'shoot') {
    const c = w.value.s.creatures.find((x) => x.id === m.targets[m.idx])
    return c ? c.pos : null
  }
  if (m?.kind === 'throw') return hover.value
  return null
})

const activityLabel = computed(() => { void version.value; return player(w.value).activity?.label ?? null })

function doAct(a: Action) {
  const err = act(a)
  hint.value = err
}

const KEYMAP: Record<string, number> = {
  ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6,
  k: 0, u: 1, l: 2, n: 3, j: 4, b: 5, h: 6, y: 7,
  Numpad8: 0, Numpad9: 1, Numpad6: 2, Numpad3: 3, Numpad2: 4, Numpad1: 5, Numpad4: 6, Numpad7: 7,
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Shift') { shift.value = true; return }
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return
  if (over.value) return
  if (e.key === '?') { help.value = !help.value; return }
  if (e.key === 'Escape') { mode.value = null; help.value = false; return }
  const m = mode.value
  if (m?.kind === 'shoot') {
    if (e.key === 'Tab' || e.key === 'f') {
      e.preventDefault()
      if (e.key === 'f') { doAct({ type: 'shoot', target: m.targets[m.idx] }); mode.value = null }
      else m.idx = (m.idx + 1) % m.targets.length
      return
    }
    if (e.key === 'Enter') { doAct({ type: 'shoot', target: m.targets[m.idx] }); mode.value = null; return }
  }
  const code = e.code.startsWith('Numpad') ? e.code : e.key
  if (code in KEYMAP && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    doAct({ type: 'move', dir: KEYMAP[code] })
    return
  }
  switch (e.key) {
    case '.': case ' ': case 'Numpad5': case '5': e.preventDefault(); doAct({ type: 'wait' }); break
    case 'g': case ',': doAct({ type: 'pickup' }); break
    case 's': doAct({ type: 'search' }); break
    case 'r': doAct({ type: 'rest', turns: 200 }); break
    case 'R': doAct({ type: 'rest', turns: 1200 }); break
    case 'z': doAct({ type: 'sleep' }); break
    case 'L': leave(); break
    case 't': {
      const lamp = player(w.value).inventory.find((i) => itemDef(w.value, i).light)
      if (lamp) doAct({ type: 'toggleLight', uid: lamp.uid })
      else hint.value = '등불이 없다'
      break
    }
    case 'f': {
      const pl = player(w.value)
      const mw = mainWeapon(w.value, pl)
      if (!mw || !itemDef(w.value, mw).ranged) { hint.value = '원거리 무기를 들고 있지 않다'; break }
      if (!visibleEnemies.value.length) { hint.value = '보이는 적이 없다'; break }
      mode.value = { kind: 'shoot', targets: visibleEnemies.value.map((c) => c.id), idx: 0 }
      hint.value = 'Tab: 대상 바꾸기 · F/Enter: 쏘기 · Esc: 취소'
      break
    }
    case '1': tab.value = 'status'; break
    case '2': tab.value = 'body'; break
    case '3': case 'i': tab.value = 'inv'; break
    case '4': tab.value = 'know'; break
  }
}
function onKeyUp(e: KeyboardEvent) { if (e.key === 'Shift') shift.value = false }

function leave() {
  doAct({ type: 'leave' })
}

function onClick(p: Pos, button: number) {
  const m = mode.value
  if (m?.kind === 'throw') {
    doAct({ type: 'throw', uid: m.uid, target: p })
    mode.value = null
    return
  }
  if (button !== 0) return
  const ww = w.value
  const pl = player(ww)
  const d = cheb(p, pl.pos)
  const c = creatureAt(ww, p)
  if (c && c.id !== pl.id && hostile(pl, c)) {
    const mw = mainWeapon(ww, pl)
    if (mw && itemDef(ww, mw).ranged && d > 1) doAct({ type: 'shoot', target: c.id })
    else doAct({ type: 'attack', target: c.id })
    return
  }
  if (d === 1) {
    const dir = DIRS.findIndex((x) => x.x === p.x - pl.pos.x && x.y === p.y - pl.pos.y)
    if (ww.db.terrain(ww.s.map.tiles[p.y * ww.s.map.w + p.x].t).container && adjacentContainer(ww, pl)) doAct({ type: 'search' })
    else doAct({ type: 'move', dir })
  }
}

function startThrow(uid: number) {
  mode.value = { kind: 'throw', uid }
  hint.value = '던질 곳을 클릭 (6칸 이내) · Esc: 취소'
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
})

const tabs: [Tab, string][] = [['status', '1 상태'], ['body', '2 신체'], ['inv', '3 소지품'], ['know', '4 지식']]
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex min-h-0 flex-1">
      <div class="relative min-w-0 flex-1">
        <MapView :target="target" :highlight="mode?.kind === 'shoot' ? visibleEnemies.map((c) => c.pos) : []" @hover="hover = $event" @click="onClick" />
        <div class="absolute left-2 top-2 flex items-center gap-2">
          <button class="btn" @click="abandonToTitle">타이틀</button>
          <button class="btn" @click="help = !help">? 조작법</button>
          <span v-if="activityLabel" class="rounded bg-ash-900/90 px-2 py-0.5 text-xs text-amber-200">{{ activityLabel }} 중…</span>
        </div>
        <div v-if="hover" class="absolute bottom-2 left-2"><HoverInfo :pos="hover" :detail="shift" /></div>
        <div v-if="hint" class="absolute bottom-2 right-2 max-w-sm rounded bg-ash-900/95 px-2 py-1 text-xs text-amber-200" @click="hint = null">{{ hint }}</div>

        <div v-if="help" class="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4" @click="help = false">
          <div class="panel max-w-lg space-y-2 p-4 text-xs leading-6" @click.stop>
            <h2 class="text-sm font-semibold text-amber-300">조작법</h2>
            <p><kbd>방향키</kbd> <kbd>hjklyubn</kbd> <kbd>숫자패드</kbd> 이동·공격(부딪히면 공격, 문은 열기)</p>
            <p><kbd>.</kbd>/<kbd>Space</kbd> 한 턴 기다리기 · <kbd>r</kbd> 10분 휴식 · <kbd>R</kbd> 1시간 휴식 · <kbd>z</kbd> 잠자기</p>
            <p><kbd>g</kbd> 줍기 · <kbd>s</kbd> 주변 용기 뒤지기 · <kbd>t</kbd> 등불 켜기/끄기 · <kbd>f</kbd> 활 쏘기(Tab으로 대상 변경)</p>
            <p><kbd>L</kbd> 동쪽 길 끝에서 떠나기(탈출) · <kbd>1~4</kbd> 패널 전환 · <kbd>?</kbd> 이 창</p>
            <p>마우스: 맵 위에 올리면 정보, <kbd>Shift</kbd>를 누르면 명중 공식. 로그의 ▸ 를 누르면 판정 단계가 펼쳐진다.</p>
            <h3 class="pt-2 font-semibold text-amber-300">기억할 것</h3>
            <ul class="list-disc pl-5 text-ash-300">
              <li>피는 5,000ml. 30%를 잃으면 쇼크, 50%면 죽는다. 신체 탭의 "사망까지 ~N턴"을 보라.</li>
              <li>동맥 출혈은 붕대로 멎지 않는다. 지혈대(2시간 안에 풀 것), 압박, 또는 켜진 등불+칼로 소작.</li>
              <li>젖은 옷은 단열을 잃는다. 재비가 오면 지붕 아래로. 방수포 망토는 비를 막는다.</li>
              <li>피 냄새는 바람을 타고 재늑대를 부른다. 배고픈 짐승에게 생고기를 던지면 먹느라 멈춘다.</li>
              <li>적도 같은 규칙으로 피 흘리고, 절뚝이고, 겁먹고 달아난다. 사람은 궁지에 몰리면 항복한다.</li>
              <li>각인 모드: 저장은 하나, 죽으면 끝이다.</li>
            </ul>
          </div>
        </div>

        <div v-if="over" class="absolute inset-0 z-20 flex items-center justify-center overflow-auto bg-black/80 p-4" data-testid="report">
          <div class="panel w-full max-w-xl space-y-3 p-5 text-xs">
            <h2 class="text-center text-2xl tracking-widest" :class="over.kind === 'escape' ? 'text-moss-300' : 'text-blood-300'">{{ over.report.title }}</h2>
            <p class="text-center text-sm text-ash-100">{{ over.report.epitaph }}</p>
            <p class="text-center text-ash-400">{{ over.report.background }} · {{ over.report.traits.join(', ') }} · 원인: {{ over.report.cause }}</p>
            <div>
              <h3 class="mb-1 text-amber-300">마지막 기록</h3>
              <ul class="space-y-0.5 font-mono text-[11px] text-ash-300"><li v-for="(l, i) in over.report.chain" :key="i">{{ l }}</li></ul>
            </div>
            <div>
              <h3 class="mb-1 text-amber-300">그때의 몸</h3>
              <ul class="space-y-0.5 text-ash-300"><li v-for="(l, i) in over.report.vitals" :key="i">{{ l }}</li></ul>
            </div>
            <div>
              <h3 class="mb-1 text-amber-300">기록</h3>
              <ul class="space-y-0.5 text-ash-300"><li v-for="(l, i) in over.report.stats" :key="i">{{ l }}</li></ul>
            </div>
            <div class="text-center"><button class="btn !px-4 !py-1.5 !text-sm" @click="abandonToTitle">연대기에 새기고 돌아가기</button></div>
          </div>
        </div>
      </div>

      <aside class="flex w-[360px] shrink-0 flex-col border-l border-ash-800 bg-ash-900">
        <nav class="flex border-b border-ash-800">
          <button v-for="[k, l] in tabs" :key="k" class="flex-1 py-1.5 text-xs" :class="tab === k ? 'bg-ash-800 text-amber-200' : 'text-ash-400 hover:text-ash-100'" @click="tab = k">{{ l }}</button>
        </nav>
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <StatusPanel v-if="tab === 'status'" />
          <BodyPanel v-else-if="tab === 'body'" />
          <InventoryPanel v-else-if="tab === 'inv'" @throw="startThrow" @hint="hint = $event" />
          <KnowledgePanel v-else />
        </div>
      </aside>
    </div>
    <div class="h-44 shrink-0 border-t border-ash-800 bg-ash-950"><LogPanel /></div>
  </div>
</template>
