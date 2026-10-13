<script setup lang="ts">
// 게임 화면: 전체 화면 맵 + 좌상단 상태 + 하단 HUD + 우하단 기록 + 창(C/I/K/B/J)
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  adjacentContainer, bloodLoss, canReach, cheb, creatureAt, DIRS, findPath, hostile, hpMax, itemDef, mainWeapon, player, terrainAt,
  allItems, type Pos, type World,
} from '../core'
import HoverInfo from './HoverInfo.vue'
import LogPanel from './LogPanel.vue'
import MapView from './MapView.vue'
import type { RenderOpts } from './render/MapRenderer'
import { abandonToTitle, version, world } from './store'
import AbilityWindow from './ui/AbilityWindow.vue'
import BodyWindow from './ui/BodyWindow.vue'
import CharacterWindow from './ui/CharacterWindow.vue'
import Hud from './ui/Hud.vue'
import InventoryWindow from './ui/InventoryWindow.vue'
import JournalWindow from './ui/JournalWindow.vue'
import StatusStrip from './ui/StatusStrip.vue'
import Tooltip from './ui/Tooltip.vue'
import { confirmTarget, doAct, hideTip, hint, logBig, startShoot, targeting, toggleWin, useHotbar, visibleEnemies, wins } from './ui'

const hover = ref<Pos | null>(null)
const shift = ref(false)
const help = ref(false)
const travel = ref<Pos[] | null>(null)
let travelTimer: ReturnType<typeof setInterval> | undefined

const w = computed(() => { void version.value; return world.value as World })
const over = computed(() => { void version.value; return world.value?.s.over ?? null })
const activity = computed(() => { void version.value; return player(w.value).activity?.label ?? null })
const onStairs = computed(() => {
  void version.value
  const ww = w.value
  const pl = player(ww)
  const t = terrainAt(ww, pl.pos)
  if (!t.stairs) return null
  return ww.s.map.links.find((l) => l.pos.x === pl.pos.x && l.pos.y === pl.pos.y)?.label ?? null
})
const danger = computed(() => {
  void version.value
  const pl = player(w.value)
  return Math.max(0, Math.min(1, Math.max(1 - pl.hp / hpMax(w.value, pl) - 0.55, bloodLoss(pl) * 2.5 - 0.3) * 2.2))
})

const opts = computed<RenderOpts>(() => {
  void version.value
  const t = targeting.value
  const ww = w.value
  const pos = (id: number) => ww.s.creatures.find((c) => c.id === id)?.pos
  return {
    hover: hover.value,
    targets: t ? t.targets.map(pos).filter((p): p is Pos => !!p) : [],
    selected: t ? pos(t.targets[t.idx]) ?? null : null,
    path: travel.value ?? [],
  }
})

// 루팅 창이 열리면 소지품 창도 연다
watch(() => { void version.value; return !!world.value?.s.loot }, (open) => { if (open) wins.inv = true })

function stopTravel() {
  travel.value = null
  clearInterval(travelTimer)
}

/** 먼 칸 클릭: 경로를 따라 한 걸음씩. 적이 보이거나 다치면 멈춘다 */
function startTravel(dest: Pos) {
  const ww = w.value
  const pl = player(ww)
  const path = findPath(ww, pl.pos, dest, { avoidCreatures: true, selfId: pl.id })
  if (!path?.length) { hint.value = '갈 수 없다'; return }
  travel.value = path
  const startEnemies = visibleEnemies(ww).length
  clearInterval(travelTimer)
  travelTimer = setInterval(() => {
    const cur = world.value
    if (!cur || cur.s.over || !travel.value?.length) return stopTravel()
    const me = player(cur)
    if (visibleEnemies(cur).filter((c) => !c.asleep).length > startEnemies) { hint.value = '적이 보인다 — 멈춤'; return stopTravel() }
    const hp = me.hp
    const next = travel.value[0]
    const dir = DIRS.findIndex((d) => d.x === next.x - me.pos.x && d.y === next.y - me.pos.y)
    if (dir < 0) return stopTravel()
    const err = doAct({ type: 'move', dir })
    if (err) return stopTravel()
    travel.value = travel.value.slice(1)
    if (player(world.value!).hp < hp) { hint.value = '다쳤다 — 멈춤'; stopTravel() }
  }, 95)
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
  stopTravel()
  hideTip()
  if (e.key === 'Escape') {
    if (targeting.value) { targeting.value = null; hint.value = null; return }
    if (help.value) { help.value = false; return }
    const open = (Object.keys(wins) as (keyof typeof wins)[]).filter((k) => wins[k])
    if (open.length) { wins[open[open.length - 1]] = false; return }
    if (w.value.s.loot) doAct({ type: 'lootClose' })
    return
  }
  if (e.key === '?') { help.value = !help.value; return }
  const t = targeting.value
  if (t && (e.key === 'Tab' || e.key === 'Enter' || e.key === 'f')) {
    e.preventDefault()
    if (e.key === 'Tab') t.idx = (t.idx + (e.shiftKey ? t.targets.length - 1 : 1)) % t.targets.length
    else confirmTarget()
    return
  }
  const code = e.code.startsWith('Numpad') ? e.code : e.key
  // 창 단축키는 대문자/소문자 모두. 단, 이동키(hjklyubn)와 겹치는 j·k·b 는 Shift 없이 이동
  const lower = e.key.toLowerCase()
  if (!e.ctrlKey && !e.metaKey) {
    if (lower === 'c') { toggleWin('char'); return }
    if (lower === 'i') { toggleWin('inv'); return }
    if (e.key === 'K') { toggleWin('abil'); return }
    if (e.key === 'B') { toggleWin('body'); return }
    if (e.key === 'J') { toggleWin('journal'); return }
  }
  if (code in KEYMAP && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault()
    targeting.value = null
    doAct({ type: 'move', dir: KEYMAP[code] })
    return
  }
  if (/^[0-9]$/.test(e.key)) { useHotbar(e.key === '0' ? 9 : Number(e.key) - 1); return }
  switch (e.key) {
    case '.': case ' ': case 'Numpad5': e.preventDefault(); doAct({ type: 'wait' }); break
    case 'g': case ',': doAct({ type: 'pickup' }); break
    case 's': doAct({ type: 'search' }); break
    case 'e': if (w.value.s.loot) doAct({ type: 'lootAll' }); break
    case 'r': doAct({ type: 'rest', turns: 200 }); break
    case 'R': doAct({ type: 'rest', turns: 1200 }); break
    case 'z': case 'Z': doAct({ type: 'sleep' }); break
    case '>': case '<': case 'Enter': if (onStairs.value) doAct({ type: 'stairs' }); break
    case 'L': logBig.value = !logBig.value; break
    case 'f': startShoot(); break
    case 't': {
      const lamp = allItems(player(w.value)).find((i) => itemDef(w.value, i).light)
      if (lamp) doAct({ type: 'toggleLight', uid: lamp.uid })
      else hint.value = '등불이 없다'
      break
    }
    case 'm': case 'M': help.value = !help.value; break
  }
}
function onKeyUp(e: KeyboardEvent) { if (e.key === 'Shift') shift.value = false }

function onClick(p: Pos, button: number) {
  hideTip()
  if (button === 2) { stopTravel(); targeting.value = null; return }
  if (button !== 0) return
  const ww = w.value
  const pl = player(ww)
  const c = creatureAt(ww, p)
  const t = targeting.value
  if (t) {
    if (c && t.targets.includes(c.id)) confirmTarget(c.id)
    else { targeting.value = null; hint.value = null }
    return
  }
  stopTravel()
  const d = cheb(p, pl.pos)
  if (c && c.id !== pl.id && hostile(pl, c) && c.alive) {
    const mw = mainWeapon(ww, pl)
    if (mw && itemDef(ww, mw).ranged && d > 1) doAct({ type: 'shoot', target: c.id })
    else if (canReach(ww, pl, c)) doAct({ type: 'attack', target: c.id })
    else startTravel(p)
    return
  }
  if (d === 0) {
    if (terrainAt(ww, p).stairs) doAct({ type: 'stairs' })
    else if (ww.s.map.exits.some((e) => e.x === p.x && e.y === p.y)) doAct({ type: 'leave' })
    else if (ww.s.map.tiles[p.y * ww.s.map.w + p.x].items.length) doAct({ type: 'pickup' })
    else doAct({ type: 'wait' })
    return
  }
  if (d === 1) {
    const terr = terrainAt(ww, p)
    if (terr.container && adjacentContainer(ww, pl, true)) { doAct({ type: 'search' }); return }
    doAct({ type: 'move', dir: DIRS.findIndex((x) => x.x === p.x - pl.pos.x && x.y === p.y - pl.pos.y) })
    return
  }
  const terr = terrainAt(ww, p)
  if (!terr.passable && !terr.door && !terr.container) { hint.value = '갈 수 없는 곳'; return }
  startTravel(p)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  stopTravel()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <div class="relative h-full w-full select-none overflow-hidden bg-black">
    <MapView :opts="opts" @hover="hover = $event" @click="onClick" />

    <!-- 위험: 화면 가장자리 붉은 기운 -->
    <div v-if="danger > 0" class="pointer-events-none absolute inset-0" :style="{ opacity: danger, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(120,0,0,.55) 100%)', animation: 'danger-vignette 1.6s ease-in-out infinite' }" />

    <div class="pointer-events-none absolute left-2 top-2"><StatusStrip /></div>
    <div class="absolute right-2 top-2 flex flex-col items-end gap-2">
      <div class="flex gap-1">
        <button class="dbtn" @click="help = !help">? 조작법</button>
        <button class="dbtn" @click="abandonToTitle">타이틀</button>
      </div>
      <HoverInfo v-if="hover" :pos="hover" :detail="shift" />
    </div>

    <div v-if="activity" class="df df-tab pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 text-xs text-amber-200">{{ activity }} 중… (위험하면 저절로 멈춘다)</div>
    <div v-if="targeting" class="df df-btn-sel pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 text-xs text-amber-100">{{ targeting.label }}: 대상 선택 — 클릭 · Tab · Enter · Esc</div>

    <div class="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
      <div v-if="onStairs" class="pointer-events-auto"><button class="dbtn-gold !text-xs" data-testid="stairs" @click="doAct({ type: 'stairs' })">{{ onStairs }}(으)로 ( &gt; )</button></div>
      <div v-if="hint" class="df df-parch pointer-events-auto max-w-md cursor-pointer text-xs font-bold" data-testid="hint" @click="hint = null">{{ hint }}</div>
      <Hud />
    </div>
    <div class="pointer-events-none absolute bottom-[124px] right-2 2xl:bottom-2"><LogPanel /></div>

    <CharacterWindow v-if="wins.char" />
    <InventoryWindow v-if="wins.inv" />
    <AbilityWindow v-if="wins.abil" />
    <BodyWindow v-if="wins.body" />
    <JournalWindow v-if="wins.journal" />
    <Tooltip />

    <div v-if="help" class="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 p-4" @click="help = false">
      <div class="df df-gold max-w-xl space-y-1.5 text-xs leading-6 text-ash-200" @click.stop>
        <h2 class="font-title text-lg font-bold text-[#e8d7a8]">조작법</h2>
        <p><kbd>방향키</kbd> <kbd>hjklyubn</kbd> <kbd>숫자패드</kbd> 이동·공격 · 맵 클릭: 그 칸까지 걸어간다(적이 보이면 멈춤)</p>
        <p><kbd>1</kbd>~<kbd>0</kbd> 빠른 슬롯(능력·아이템) · 능력은 대상 선택 후 <kbd>Enter</kbd>/클릭 · <kbd>f</kbd> 활 쏘기</p>
        <p><kbd>C</kbd> 캐릭터 · <kbd>I</kbd> 소지품 · <kbd>Shift+K</kbd> 능력 · <kbd>Shift+B</kbd> 신체 · <kbd>Shift+J</kbd> 일지 · <kbd>Esc</kbd> 창 닫기</p>
        <p><kbd>s</kbd> 곁의 용기 뒤지기 → 루팅 창 · <kbd>e</kbd> 모두 가져가기 · <kbd>g</kbd> 줍기 · <kbd>t</kbd> 등불 · <kbd>&gt;</kbd> 계단</p>
        <p><kbd>.</kbd>/<kbd>Space</kbd> 한 턴 · <kbd>r</kbd> 10분 휴식 · <kbd>R</kbd> 1시간 · <kbd>z</kbd> 잠 · <kbd>Shift+L</kbd> 기록 크게 · 소지품: 끌어서 옮기기/장착, 끄는 중 <kbd>R</kbd>·우클릭 돌리기, 우클릭 메뉴</p>
        <p>남쪽 옛 수레길 끝(지역 출입구)에 서서 그 칸을 클릭하면 고원을 떠난다(탈출).</p>
        <h3 class="pt-1 font-title text-sm text-[#e8d7a8]">기억할 것</h3>
        <ul class="list-disc pl-5 text-ash-300">
          <li>적은 정해진 곳에 산다. 잠든 적은 기습하라(명중 95%, 피해 ×1.5). 잠행은 생존 능력.</li>
          <li>체력(빨강)이 0이면 죽는다. 그 아래에 상처·출혈이 따로 돈다 — 머리 위 붉은 방울은 출혈이다.</li>
          <li>부위가 다치면(좌상단 인형) 명중·회피·막기가 떨어진다. 다리가 상하면 비틀거린다.</li>
          <li>던전은 어둡다. 등불을 켜지 않으면 명중이 깎인다. 연료는 등불 기름으로 채운다.</li>
          <li>각인 모드: 저장은 하나, 죽으면 끝.</li>
        </ul>
      </div>
    </div>

    <div v-if="over" class="absolute inset-0 z-[6000] flex items-start justify-center overflow-auto bg-black/80 p-4" data-testid="report">
      <div class="df df-gold my-auto w-full max-w-xl space-y-3 text-xs">
        <h2 class="text-center font-title text-3xl tracking-widest" :class="over.kind === 'escape' ? 'text-moss-300' : 'text-blood-300'">{{ over.report.title }}</h2>
        <p class="text-center text-sm text-ash-100">{{ over.report.epitaph }}</p>
        <p class="text-center text-ash-400">{{ over.report.background }} · {{ over.report.traits.join(', ') }} · 원인: {{ over.report.cause }}</p>
        <div><h3 class="mb-1 font-title text-amber-300">마지막 기록</h3><ul class="space-y-0.5 font-mono text-[11px] text-ash-300"><li v-for="(l, i) in over.report.chain" :key="i">{{ l }}</li></ul></div>
        <div><h3 class="mb-1 font-title text-amber-300">그때의 몸</h3><ul class="space-y-0.5 text-ash-300"><li v-for="(l, i) in over.report.vitals" :key="i">{{ l }}</li></ul></div>
        <div><h3 class="mb-1 font-title text-amber-300">기록</h3><ul class="space-y-0.5 text-ash-300"><li v-for="(l, i) in over.report.stats" :key="i">{{ l }}</li></ul></div>
        <div class="text-center"><button class="dbtn-gold !px-4 !text-sm" @click="abandonToTitle">연대기에 새기고 돌아가기</button></div>
      </div>
    </div>
  </div>
</template>
