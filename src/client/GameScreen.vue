<script setup lang="ts">
// 게임 화면: 전체 화면 맵 + 좌상단 상태 + 하단 HUD + 우하단 기록 + 창(C/I/K/B/J)
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  adjacentContainer, adjacentCorpse, eq as eqPos, bloodLoss, canReach, cheb, creatureAt, DIRS, findPath, hostile, hpMax, itemDef, mainWeapon, player, terrainAt,
  allItems, autoBlocked, autoSnap, autoStop, turnOf, type Pos, type World,
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
import Banners from './ui/Banners.vue'
import MapWindow from './ui/MapWindow.vue'
import SideBars from './ui/SideBars.vue'
import StatusStrip from './ui/StatusStrip.vue'
import Tooltip from './ui/Tooltip.vue'
import { closeTopWin, confirmTarget, doAct, hideTip, hint, logBig, setWin, startShoot, targeting, toggleWin, useHotbar, wins } from './ui'
import { computeBanners } from './warnings'

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
watch(() => { void version.value; return !!world.value?.s.loot }, (open) => { if (open) setWin('inv', true) })

// 층 이름 카드 · 방 이름 (12 §2.5: 1.5초)
const card = ref<{ big: string; small: string } | null>(null)
let cardTimer: ReturnType<typeof setTimeout> | undefined
function showCard(big: string, small = '') {
  card.value = { big, small }
  clearTimeout(cardTimer)
  cardTimer = setTimeout(() => { card.value = null }, 1500)
}
watch(() => { void version.value; return world.value?.s.map.id }, (id) => {
  const m = world.value?.s.map
  if (id && m) showCard(m.name, m.kind === 'surface' ? '잿빛 고원 — 지상' : `지하 ${m.depth}층`)
})
watch(() => {
  void version.value
  const ww = world.value
  if (!ww) return -1
  const pl = player(ww)
  return ww.s.map.tiles[pl.pos.y * ww.s.map.w + pl.pos.x].room ?? -1
}, (room, before) => {
  const R = world.value?.s.map.rooms[room]
  if (room >= 0 && room !== before && R && R.type !== 'entry' && R.discovered) showCard(R.name)
})

// P0 치명 경고: 새로 뜨면 이동 키 1회를 무시하고 확인을 받는다 (12 §6)
const p0Ack = ref(true)
watch(() => { void version.value; return world.value ? computeBanners(world.value).filter((b) => b.p === 0).map((b) => b.text.replace(/\d+/g, '')).join('|') : '' }, (now, before) => {
  if (now && now !== before) p0Ack.value = false
})

function stopTravel() {
  travel.value = null
  clearInterval(travelTimer)
}

/** 먼 칸 클릭: 경로를 따라 한 걸음씩. 위협 T1~T6(01 §6.2)이 생기면 멈추고, 멈춘 뒤 3턴은 다시 못 쓴다 */
function startTravel(dest: Pos) {
  const ww = w.value
  const pl = player(ww)
  const wait = autoBlocked(ww)
  if (wait > 0) { hint.value = `위협이 가시지 않았다 — ${wait}턴 뒤 자동 이동 가능`; return }
  const path = findPath(ww, pl.pos, dest, { avoidCreatures: true, selfId: pl.id })
  if (!path?.length) { hint.value = '갈 수 없다'; return }
  travel.value = path
  const snap = autoSnap(ww)
  clearInterval(travelTimer)
  travelTimer = setInterval(() => {
    const cur = world.value
    if (!cur || cur.s.over || !travel.value?.length) return stopTravel()
    const me = player(cur)
    const next = travel.value[0]
    const dir = DIRS.findIndex((d) => d.x === next.x - me.pos.x && d.y === next.y - me.pos.y)
    if (dir < 0) return stopTravel()
    const err = doAct({ type: 'move', dir })
    if (err) return stopTravel()
    travel.value = travel.value.slice(1)
    const why = autoStop(world.value!, snap)
    if (why) {
      world.value!.s.autoStopTurn = turnOf(world.value!)
      hint.value = `${why} — 멈춤`
      stopTravel()
    }
  }, 95)
}

// 접두 키: P(밀치기) · O(문 닫기) 다음 방향 (12 §8)
const prefix = ref<'shove' | 'close' | null>(null)

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
    if (prefix.value) { prefix.value = null; hint.value = null; return }
    if (targeting.value) { targeting.value = null; hint.value = null; return }
    if (help.value) { help.value = false; return }
    if (closeTopWin()) return
    if (w.value.s.loot) doAct({ type: 'lootClose' })
    return
  }
  // 소지품 창: Ctrl+S 자동 정렬, Space 모두 가져가기
  if (wins.inv && e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); doAct({ type: 'sortBag' }); return }
  if (e.key === ' ' && w.value.s.loot) { e.preventDefault(); doAct({ type: 'lootAll' }); return }
  if (e.key === '?') { help.value = !help.value; return }
  const t = targeting.value
  if (t && (e.key === 'Tab' || e.key === 'Enter' || e.key === 'f')) {
    e.preventDefault()
    if (e.key === 'Tab') t.idx = (t.idx + (e.shiftKey ? t.targets.length - 1 : 1)) % t.targets.length
    else confirmTarget()
    return
  }
  // 창 단축키는 대문자/소문자 모두. 단, 이동키(hjklyubn)와 겹치는 j·k·b 는 Shift 없이 이동
  const lower = e.key.toLowerCase()
  if (!e.ctrlKey && !e.metaKey) {
    if (lower === 'c') { toggleWin('char'); return }
    if (lower === 'i') { toggleWin('inv'); return }
    if (lower === 'm') { toggleWin('map'); return }
    if (e.key === 'K') { toggleWin('abil'); return }
    if (e.key === 'B') { toggleWin('body'); return }
    if (e.key === 'J') { toggleWin('journal'); return }
  }
  // 방향 키(넘패드·방향키 이름은 Shift와 무관, vi 키는 소문자만)
  const dirKey = e.code.startsWith('Numpad') ? e.code : e.key.startsWith('Arrow') ? e.key : e.key
  if (dirKey in KEYMAP && !e.metaKey) {
    e.preventDefault()
    targeting.value = null
    const dir = KEYMAP[dirKey]
    const viKey = /^[hjklyubn]$/.test(e.key)
    if (prefix.value) {
      const p = prefix.value
      prefix.value = null
      hint.value = null
      doAct(p === 'shove' ? { type: 'shove', dir } : { type: 'closeDoor', dir })
      return
    }
    if (e.ctrlKey) { doAct({ type: 'face', dir }); return } // 제자리 방향 전환 1턴
    if (e.shiftKey && !viKey) { doAct({ type: 'shove', dir }); return } // Shift + 넘패드·방향키 = 밀치기
    if (!p0Ack.value) { p0Ack.value = true; hint.value = '⚠ 치명 경고 — 확인했다. 다시 누르면 움직인다'; return }
    doAct({ type: 'move', dir })
    return
  }
  if (/^[0-9]$/.test(e.key)) { useHotbar(e.key === '0' ? 9 : Number(e.key) - 1); return }
  switch (e.key) {
    case '.': case ' ': case 'Numpad5': e.preventDefault(); doAct({ type: 'wait' }); break
    case 'p': prefix.value = 'shove'; hint.value = '밀칠 방향을 누른다 (Esc 취소)'; break
    case 'o': prefix.value = 'close'; hint.value = '닫을 문 방향을 누른다 (Esc 취소)'; break
    case 'v': case 'V': doAct({ type: 'reactPolicy' }); break
    case 'q': case 'Q': doAct({ type: 'attackMode' }); break
    case 'x': case 'X': shift.value = !shift.value; break
    case 'w': {
      const pl = player(w.value)
      const t = w.value.s.creatures.find((o) => o.alive && cheb(o.pos, pl.pos) <= 1 && w.value.db.creature(o.def).thirsty && o.ai.mode !== 'calm')
      if (t) doAct({ type: 'giveWater', target: t.id })
      else if (w.value.s.map.lights.some((L) => L.kind === 'campfire' && cheb(L.pos, pl.pos) <= 1)) doAct({ type: 'toggleFire' })
      else hint.value = '물을 줄 상대도, 끄거나 켤 모닥불도 없다'
      break
    }
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
    case '?': help.value = !help.value; break
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
    else if (adjacentCorpse(ww, pl) && eqPos(adjacentCorpse(ww, pl)!.pos, p)) doAct({ type: 'search' })
    else if (ww.s.map.tiles[p.y * ww.s.map.w + p.x].items.length) doAct({ type: 'pickup' })
    else doAct({ type: 'wait' })
    return
  }
  if (d === 1) {
    const terr = terrainAt(ww, p)
    if (terr.container && adjacentContainer(ww, pl, true)) { doAct({ type: 'search' }); return }
    const corpse = adjacentCorpse(ww, pl)
    if (corpse && eqPos(corpse.pos, p) && !creatureAt(ww, p)) { doAct({ type: 'search' }); return }
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
    <div class="absolute left-2 top-1/2 -translate-y-1/2"><SideBars /></div>
    <div class="absolute right-2 top-2 flex flex-col items-end gap-2">
      <div class="flex gap-1">
        <button class="dbtn" @click="help = !help">? 조작법</button>
        <button class="dbtn" @click="abandonToTitle">타이틀</button>
      </div>
      <Banners />
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
    <MapWindow v-if="wins.map" />
    <div v-if="card" class="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 text-center" data-testid="card">
      <div class="font-title text-3xl tracking-widest text-[#e8d7a8] [text-shadow:0_2px_0_#000,0_0_12px_#000]">{{ card.big }}</div>
      <div v-if="card.small" class="mt-1 text-xs text-ash-300 [text-shadow:0_1px_0_#000]">{{ card.small }}</div>
    </div>
    <Tooltip />

    <div v-if="help" class="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 p-4" @click="help = false">
      <div class="df df-gold max-w-xl space-y-1.5 text-xs leading-6 text-ash-200" @click.stop>
        <h2 class="font-title text-lg font-bold text-[#e8d7a8]">조작법</h2>
        <p><kbd>방향키</kbd> <kbd>hjklyubn</kbd> <kbd>숫자패드</kbd> 이동·공격 · 맵 클릭: 그 칸까지 걸어간다(적이 보이면 멈춤)</p>
        <p><kbd>1</kbd>~<kbd>0</kbd> 빠른 슬롯(능력·아이템) · 능력은 대상 선택 후 <kbd>Enter</kbd>/클릭 · <kbd>f</kbd> 활 쏘기</p>
        <p><kbd>C</kbd> 캐릭터 · <kbd>I</kbd> 소지품 · <kbd>Shift+K</kbd> 능력 · <kbd>Shift+B</kbd> 신체 · <kbd>Shift+J</kbd> 일지 · <kbd>M</kbd> 지도 · <kbd>Esc</kbd> 가장 위 창 닫기 (창은 3개까지)</p>
        <p><kbd>Ctrl</kbd>+방향 제자리 돌기 · <kbd>Shift</kbd>+방향키/<kbd>P</kbd>+방향 밀치기 · <kbd>O</kbd>+방향 문 닫기 · <kbd>V</kbd> 반응 정책 · <kbd>Q</kbd> 공격 방식(베기/찌르기) · <kbd>X</kbd> 상세 보기 · <kbd>W</kbd> 물 주기·모닥불 끄기/켜기</p>
        <p>소지품: <kbd>Ctrl+S</kbd> 자동 정렬 · 루팅 창 <kbd>Space</kbd> 모두 가져가기 · <kbd>?</kbd> 이 도움말</p>
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
