<script setup lang="ts">
// 게임 화면: 전체 화면 맵 + 좌상단 상태 + 하단 HUD + 우하단 기록 + 창(C/I/K/B/J)
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  maneuverQuote, eq as eqPos, bloodLoss, canReach, cheb, creatureAt, DIRS, findPath, hostile, hpMax, itemDef, mainWeapon, player, terrainAt,
  allItems, autoBlocked, autoSnap, autoStop, turnOf, type Pos, type World,
} from '../core'
import {readVisibleText,stopSpeech} from './speech'
import {cycleFocus,editableTarget,directionOf,repeatableCommand} from './input-context'
import {KeyRepeatGate} from './key-repeat'
import { COMMANDS, bindingText, resolveGameKey, type Command } from './keybindings'
import { definitionInspectorOpen } from './definition-inspector-ui'
import { preferences, preferencesOpen } from './preferences'
import HoverInfo from './HoverInfo.vue'
import LogPanel from './LogPanel.vue'
import MapView from './MapView.vue'
import type { RenderOpts } from './render/MapRenderer'
import { abandonToTitle, saveImprint, saveStatus, saveError, version, simulating, world } from './store'
import AbilityWindow from './ui/AbilityWindow.vue'
import BodyWindow from './ui/BodyWindow.vue'
import CraftingWindow from './ui/CraftingWindow.vue'
import SocietyWindow from './ui/SocietyWindow.vue'
import CharacterWindow from './ui/CharacterWindow.vue'
import Hud from './ui/Hud.vue'
import InventoryWindow from './ui/InventoryWindow.vue'
import JournalWindow from './ui/JournalWindow.vue'
import Banners from './ui/Banners.vue'
import MapWindow from './ui/MapWindow.vue'
import SideBars from './ui/SideBars.vue'
import StatusStrip from './ui/StatusStrip.vue'
import Tooltip from './ui/Tooltip.vue'
import { closeTopWin, confirmTarget, doAct, hideTip, hint, logBig, setWin, startManeuver, startShoot, socialTarget, targeting, toggleWin, useHotbar, wins, resetGameUI, type WinKey } from './ui'
import { computeBanners } from './warnings'

resetGameUI()
const hover = ref<Pos | null>(null)
const shift = ref(false)
const help = ref(false)
const hudDock = ref<HTMLElement | null>(null)
const hudDockHeight = ref(190)
let hudObserver: ResizeObserver | undefined
const helpDialog = ref<HTMLElement | null>(null)
let helpOrigin: HTMLElement | null = null
watch(help, async open => {
  if (open) {
    helpOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null
    stopTravel()
    clearKeys()
    await nextTick()
    helpDialog.value?.querySelector<HTMLElement>('button')?.focus()
  } else {
    await nextTick()
    if (helpOrigin?.isConnected) helpOrigin.focus()
  }
})
const travel = ref<Pos[] | null>(null)
const resumeDest = ref<Pos | null>(null)
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

const maneuverPreview=computed(()=>{
  void version.value
  const t=targeting.value;if(!t||t.kind!=='trip'&&t.kind!=='disarm')return null
  return maneuverQuote(w.value,player(w.value),t.kind,t.targets[t.idx])
})

const opts = computed<RenderOpts>(() => {
  void version.value
  const t = targeting.value
  const ww = w.value
  const pos = (id: number) => ww.s.creatures.find((c) => c.id === id)?.pos
  return {
    hudHeight: hudDockHeight.value,
    hover: hover.value,
    targets: t ? t.targets.map(pos).filter((p): p is Pos => !!p) : [],
    selected: t ? pos(t.targets[t.idx]) ?? null : null,
    path: travel.value ?? [],
  }
})

// 루팅 창이 열리면 소지품 창도 연다
watch(() => { void version.value; return world.value?.s.loot }, (loot) => { if (loot) setWin('inv', true) })

// 층 이름 카드 · 방 이름 (12 §2.5: 1.5초)
const card = ref<{ big: string; small: string } | null>(null)
let cardTimer: ReturnType<typeof setTimeout> | undefined
function showCard(big: string, small = '') {
  card.value = { big, small }
  clearTimeout(cardTimer)
  cardTimer = setTimeout(() => { card.value = null }, 1500)
}
watch(() => { void version.value; return world.value?.s.map }, (map) => {
  const m = world.value?.s.map
  if (map && m) showCard(m.name, m.kind === 'surface' ? '잿빛 고원 — 지상' : `지하 ${m.depth}층`)
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
const keyRepeat=new KeyRepeatGate()
const p0Ack = ref(true)
watch(() => { void version.value; return world.value ? computeBanners(world.value).filter((b) => b.p === 0).map((b) => b.text.replace(/\d+/g, '')).join('|') : '' }, (now, before) => {
  if(now&&now!==before){p0Ack.value=false;stopTravel();keyRepeat.clear()}
},{immediate:true})

function stopTravel() {
  travel.value = null
  clearInterval(travelTimer)
}

/** 먼 칸 클릭: 경로를 따라 한 걸음씩. 위협 T1~T6(01 §6.2)이 생기면 멈추고, 멈춘 뒤 3턴은 다시 못 쓴다 */
function startTravel(dest: Pos) {
  resumeDest.value = null
  if(!allowMovement())return
  const ww = w.value
  const pl = player(ww)
  const wait = autoBlocked(ww)
  if (wait > 0) { hint.value = `위협이 가시지 않았다 — ${wait}턴 뒤 자동 이동 가능`; return }
  const path = findPath(ww, pl.pos, dest, { avoidCreatures: true, selfId: pl.id, preferStraight: true })
  if (!path?.length) { hint.value = '갈 수 없다'; return }
  travel.value = path
  const snap = autoSnap(ww)
  clearInterval(travelTimer)
  const step = () => {
    const cur = world.value
    if (!cur || cur.s.over || document.hidden || preferencesOpen.value || definitionInspectorOpen.value || help.value || !travel.value?.length) return stopTravel()
    const me = player(cur)
    const next = travel.value[0]
    const dir = DIRS.findIndex((d) => d.x === next.x - me.pos.x && d.y === next.y - me.pos.y)
    if (dir < 0) return stopTravel()
    const err = doAct({ type: 'move', dir })
    if (err) return stopTravel()
    travel.value = travel.value.slice(1)
    const why = autoStop(world.value!, snap)
    if (why) {
      if (world.value!.s.autoThreat !== undefined) resumeDest.value = { ...dest }
      world.value!.s.autoStopTurn = turnOf(world.value!)
      hint.value = `${why} — 멈춤`
      stopTravel()
    }
  }
  travelTimer=setInterval(step,95)
  step()
}

function ignoreAndResume() {
  const dest = resumeDest.value, target = w.value.s.autoThreat
  if (!dest || target === undefined) return
  if (!doAct({ type: 'ignoreThreat', target })) startTravel(dest)
}

// 접두 키: P(밀치기) · O(문 닫기) 다음 방향 (12 §8)
watch(preferencesOpen, (open) => { if (open) stopTravel() })
const prefix = ref<'shove' | 'close' | null>(null)

const WINDOW_COMMANDS:Partial<Record<Command,WinKey>>={character:'char',inventory:'inv',abilities:'abil',body:'body',journal:'journal',map:'map',craft:'craft',society:'society'}
function clearPrefix(){if(prefix.value){prefix.value=null;hint.value=null}}
function clearKeys(){keyRepeat.clear();shift.value=false;clearPrefix()}
function suspendInput(){stopTravel();clearKeys()}
watch([preferencesOpen,definitionInspectorOpen,help],([settings,inspector,helpOpen])=>{if(settings||inspector||helpOpen)suspendInput()},{flush:'sync'})
watch(()=>Object.values(wins),()=>{if(Object.values(wins).some(Boolean))suspendInput()},{flush:'sync'})
watch(targeting,t=>{if(t){suspendInput();document.querySelector<HTMLElement>('[data-testid=map]')?.focus({preventScroll:true})}},{flush:'sync'})
function allowMovement(){
 if(p0Ack.value)return true
 p0Ack.value=true;keyRepeat.clear();hint.value='⚠ 치명 경고 — 확인했다. 다시 누르면 움직인다'
 return false
}
function onFocusIn(e:FocusEvent){if(e.target instanceof HTMLElement&&e.target.closest('.window-shell,button,summary,a[href],input,textarea,select,[contenteditable="true"]'))suspendInput()}
function onUiPointer(e:PointerEvent){if(e.target instanceof HTMLElement&&e.target.closest('button,input,select,textarea,[role="dialog"],[role="menu"]'))suspendInput()}
function onKey(raw:KeyboardEvent){
 if(raw.defaultPrevented||raw.isComposing||raw.metaKey||preferencesOpen.value||definitionInspectorOpen.value)return
 if(help.value){
  if(raw.key==='Escape'&&!raw.repeat){raw.preventDefault();help.value=false}
  else if(raw.key==='Tab'&&helpDialog.value)cycleFocus(helpDialog.value,raw)
  return
 }
 if(raw.key==='Escape'){
  raw.preventDefault();if(raw.repeat)return
  const travelling=!!travel.value;stopTravel();keyRepeat.clear();hideTip();resumeDest.value=null
  if(prefix.value){clearPrefix();return}
  if(targeting.value){targeting.value=null;hint.value=null;return}
  if(travelling)return
  if(closeTopWin())return
  if(w.value.s.loot)doAct({type:'lootClose'})
  else if(player(w.value).activity)doAct({type:'stopActivity'})
  return
 }
 if(editableTarget(raw.target))return
 if(raw.key==='Shift'){shift.value=true;return}
 const element=raw.target instanceof HTMLElement?raw.target:null
 // Enter/Space on a real control activate that control once, not a game action.
 if((raw.key==='Enter'||raw.key===' ')&&element?.closest('button,summary,[role="button"]')){if(raw.repeat)raw.preventDefault();return}
 const t=targeting.value
 if(t&&!raw.ctrlKey&&!raw.altKey&&(raw.key==='Tab'||raw.key==='Enter'&&!raw.shiftKey)){
  raw.preventDefault()
  if(raw.key==='Tab')t.idx=(t.idx+(raw.shiftKey?t.targets.length-1:1))%t.targets.length
  else if(!raw.repeat)confirmTarget()
  return
 }
 const mapped=resolveGameKey(raw,preferences.keyBindings);if(!mapped)return
 raw.preventDefault()
 if(raw.repeat&&!repeatableCommand(mapped.command))return
 if(!keyRepeat.accept(raw,performance.now(),preferences))return
 const command=mapped.command,dir=directionOf(command),travelling=!!travel.value
 stopTravel();hideTip();resumeDest.value=null
 if(dir===null)clearPrefix()
 if(command==='readAloud'){readVisibleText();return}
 if(command==='stopReading'){stopSpeech();return}
 if(over.value)return
 const win=WINDOW_COMMANDS[command]
 if(win){targeting.value=null;toggleWin(win);return}
 if(command==='help'){help.value=true;return}
 if(command==='log'){logBig.value=!logBig.value;return}
 if(command==='inspect'){shift.value=!shift.value;return}
 if(command==='sortBag'){if(wins.inv)doAct({type:'sortBag'});return}
 // A window's controls keep the keyboard; click the map to resume movement.
 const inWindow=!!element?.closest('.window-shell')||document.activeElement===document.body&&Object.values(wins).some(Boolean)
 const inventoryCommand=wins.inv&&(command==='lootAll'||command==='pickup'||command==='wait'&&raw.code==='Space')
 const aimCommand=command==='shoot'||command==='trip'||command==='disarm'||command.startsWith('hotbar')
 if(inWindow&&!inventoryCommand&&!aimCommand){keyRepeat.clear();return}
 if(dir!==null){
  targeting.value=null
  if(prefix.value){const p=prefix.value;clearPrefix();keyRepeat.clear();doAct(p==='shove'?{type:'shove',dir}:{type:'closeDoor',dir});return}
  if(mapped.ctrlKey){keyRepeat.clear();doAct({type:'face',dir});return}
  if(mapped.shiftKey){keyRepeat.clear();doAct({type:'shove',dir});return}
  if(allowMovement())doAct({type:'move',dir})
  return
 }
 if(command.startsWith('hotbar')){useHotbar(command==='hotbar0'?9:Number(command.slice(-1))-1);return}
 switch(command){
  case 'wait':
   if(travelling)return
   if(wins.inv&&raw.code==='Space'){if(w.value.s.loot)doAct({type:'lootAll'});return}
   doAct({type:'wait'});break
  case 'crouch':doAct({type:'crouch'});break
  case 'trip':startManeuver('trip');break
  case 'disarm':startManeuver('disarm');break
  case 'shove':prefix.value='shove';hint.value='밀칠 방향을 누른다 (Esc 취소)';break
  case 'closeDoor':prefix.value='close';hint.value='닫을 문 방향을 누른다 (Esc 취소)';break
  case 'reaction':doAct({type:'reactPolicy'});break
  case 'attackMode':doAct({type:'attackMode'});break
  case 'interact':{
   const pl=player(w.value),t=w.value.s.creatures.find(o=>o.alive&&cheb(o.pos,pl.pos)<=1&&w.value.db.creature(o.def).thirsty&&o.ai.mode!=='calm')
   if(t)doAct({type:'giveWater',target:t.id})
   else if(w.value.s.map.lights.some(L=>L.kind==='campfire'&&cheb(L.pos,pl.pos)<=1))doAct({type:'toggleFire'})
   else hint.value='물을 줄 상대도, 끄거나 켤 모닥불도 없다'
   break
  }
  case 'pickup':doAct({type:'pickup'});break
  case 'search':doAct({type:'search',includeEmpty:true});break
  case 'lootAll':if(wins.inv&&w.value.s.loot)doAct({type:'lootAll'});break
  case 'rest':doAct({type:'rest',turns:200});break
  case 'restHour':doAct({type:'rest',turns:1200});break
  case 'sleep':doAct({type:'sleep'});break
  case 'dry':doAct({type:'dry'});break
  case 'stairs':if(onStairs.value)doAct({type:'stairs'});break
  case 'shoot':if(t)confirmTarget();else startShoot();break
  case 'light':{
   const lamp=allItems(player(w.value)).find(i=>itemDef(w.value,i).light)
   if(lamp)doAct({type:'toggleLight',uid:lamp.uid});else hint.value='등불이 없다'
   break
  }
 }
}
function onKeyUp(e:KeyboardEvent){keyRepeat.release(e.code);if(e.key==='Shift')shift.value=false}

function onClick(p: Pos, button: number, ctrl=false) {
  if(preferencesOpen.value||definitionInspectorOpen.value||help.value||over.value)return
  resumeDest.value = null
  clearPrefix()
  hideTip()
  if(button===2){
    stopTravel();clearPrefix();targeting.value=null;hint.value=null
    if(ctrl){const pl=player(w.value),dx=Math.sign(p.x-pl.pos.x),dy=Math.sign(p.y-pl.pos.y),dir=DIRS.findIndex(d=>d.x===dx&&d.y===dy);if(dir>=0)doAct({type:'face',dir})}
    return
  }
  if (button !== 0) return
  const ww = w.value
  const pl = player(ww)
  const c = creatureAt(ww, p)
  const corpse=[...ww.s.creatures].reverse().find(o=>!o.alive&&eqPos(o.pos,p))
  const t = targeting.value
  if (t) {
    if (c && t.targets.includes(c.id)) confirmTarget(c.id)
    else { targeting.value = null; hint.value = null }
    return
  }
  stopTravel()
  const d = cheb(p, pl.pos)
  if (c && c.id !== pl.id && hostile(ww, pl, c) && c.alive) {
    const mw = mainWeapon(ww, pl)
    if (mw && itemDef(ww, mw).ranged && d > 1) doAct({ type: 'shoot', target: c.id })
    else if (canReach(ww, pl, c)) doAct({ type: 'attack', target: c.id })
    else startTravel(p)
    return
  }
  if (c && c.id !== pl.id && c.alive && d <= 1) {
    socialTarget.value = c.id
    if (!doAct({ type: 'talk', target: c.id })) setWin('society', true)
    return
  }
  if (d === 0) {
    if (terrainAt(ww, p).stairs) doAct({ type: 'stairs' })
    else if (ww.s.map.exits.some((e) => e.x === p.x && e.y === p.y)) doAct({ type: 'leave' })
    else if(corpse)doAct({type:'search',includeEmpty:true,target:corpse.id})
    else if (ww.s.map.tiles[p.y * ww.s.map.w + p.x].items.length) doAct({ type: 'pickup' })
    else doAct({ type: 'wait' })
    return
  }
  if (d === 1) {
    const terr = terrainAt(ww, p)
    if(corpse&&!c){doAct({type:'search',includeEmpty:true,target:corpse.id});return}
    if(terr.container){doAct({type:'search',includeEmpty:true,pos:p});return}
    if(allowMovement())doAct({ type: 'move', dir: DIRS.findIndex((x) => x.x === p.x - pl.pos.x && x.y === p.y - pl.pos.y) })
    return
  }
  const terr = terrainAt(ww, p)
  if (!terr.passable && !terr.door && !terr.container) { hint.value = '갈 수 없는 곳'; return }
  startTravel(p)
}

onMounted(() => {
  hudObserver = new ResizeObserver(entries => { hudDockHeight.value = Math.ceil(entries[0].contentRect.height) })
  if (hudDock.value) hudObserver.observe(hudDock.value)
  window.addEventListener('blur',suspendInput)
  document.addEventListener('focusin',onFocusIn)
  document.addEventListener('pointerdown',onUiPointer,true)
  document.addEventListener('visibilitychange',suspendInput)
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  hudObserver?.disconnect()
  stopTravel()
  keyRepeat.clear()
  window.removeEventListener('blur',suspendInput)
  document.removeEventListener('focusin',onFocusIn)
  document.removeEventListener('pointerdown',onUiPointer,true)
  document.removeEventListener('visibilitychange',suspendInput)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <div class="relative h-full w-full select-none overflow-hidden bg-black" :style="{ '--hud-dock-height': hudDockHeight + 'px' }">
    <MapView :key="w.db.loadHash" :opts="opts" @hover="hover = $event" @click="onClick" />

    <!-- 위험: 화면 가장자리 붉은 기운 -->
    <div v-if="danger > 0" class="pointer-events-none absolute inset-0" :style="{ opacity: danger, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(120,0,0,.55) 100%)', animation: preferences.warningPulse ? 'danger-vignette 1.6s ease-in-out infinite' : 'none' }" />

    <div class="pointer-events-none absolute left-3 top-3"><StatusStrip /></div>
    <div class="absolute left-3 top-1/2 -translate-y-1/2"><SideBars /></div>
    <div class="absolute right-3 top-3 flex flex-col items-end gap-3">
      <div class="game-tools flex gap-1.5">
        <button class="dbtn" @click="preferencesOpen = true">설정 (F3)</button>
        <button class="dbtn" @click="help = !help">? 조작법</button>
        <button class="dbtn" @click="abandonToTitle">타이틀</button>
      </div>
      <p v-if="saveStatus === 'saving'" class="rounded border border-ash-700 bg-ash-900/90 px-2 py-1 text-[11px] text-ash-300" data-testid="save-status">각인 중…</p>
      <div v-if="saveStatus === 'error'" class="df df-celtic max-w-sm text-xs text-red-300" role="alert" data-testid="save-error">{{ saveError }} <button class="dbtn ml-2" @click="saveImprint">다시 저장</button></div>
      <Banners />
      <HoverInfo v-if="hover" :pos="hover" :detail="shift" />
    </div>

    <div v-if="activity" class="game-notice pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 text-xs">{{ activity }} 중… <span class="text-ash-300">위험을 감지하면 멈춘다</span></div>
    <div v-if="targeting" class="game-notice pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 text-xs">{{ targeting.label }}: 대상 선택 <span v-if="maneuverPreview && !maneuverPreview.error">· {{ maneuverPreview.chance }}% · 기력 {{ maneuverPreview.cost }}</span><span class="text-ash-300">· 클릭 / Tab / Enter / Esc</span></div>

    <div ref="hudDock" class="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      <div v-if="onStairs" class="pointer-events-auto"><button class="dbtn-gold !text-xs" data-testid="stairs" @click="doAct({ type: 'stairs' })">{{ onStairs }}(으)로 ( &gt; )</button></div>
      <div v-if="hint" class="game-notice pointer-events-auto max-w-md cursor-pointer text-xs font-semibold" data-testid="hint" @click="hint = null">{{ hint }}</div>
      <button v-if="resumeDest && w.s.autoThreat !== undefined" class="dbtn pointer-events-auto !text-xs" data-testid="ignore-threat" @click="ignoreAndResume">이번 개체를 무시하고 계속 (공격·3칸 접근 시 해제)</button>
      <Hud />
    </div>
    <div class="game-log pointer-events-none absolute right-3"><LogPanel /></div>

    <CraftingWindow v-if="wins.craft" />
    <SocietyWindow v-if="wins.society" />
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
    <div v-if="simulating" class="game-notice absolute bottom-40 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 text-xs" role="status" data-testid="simulation-progress"><span>시간이 흐르는 중…</span><button class="dbtn" data-testid="stop-activity" @click="doAct({ type: 'stopActivity' })">중단 (Esc)</button></div>
    <Tooltip />

    <div v-if="help" class="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 p-4" @click="help = false">
      <div ref="helpDialog" class="df df-gold max-h-[85vh] w-full max-w-2xl space-y-3 overflow-y-auto text-xs leading-6 text-ash-200" role="dialog" aria-modal="true" aria-label="조작법" @click.stop>
        <div class="mb-4 flex items-center justify-between border-b border-ash-600 pb-3"><h2 class="font-title text-2xl font-bold text-[#e8d7a8]">고원에서 살아남기</h2><button class="dbtn" aria-label="조작법 닫기" @click="help = false">닫기</button></div>
        <p>맵을 클릭하면 그 칸까지 걸어간다(적이 보이면 멈춤). 키는 F3 설정에서 바꿀 수 있다.</p>
        <p>창에 초점이 있으면 방향키로 캐릭터가 움직이지 않는다. 지도를 클릭하면 이동 입력을 다시 받는다. Esc는 메뉴·끌기를 먼저 취소한다.</p>
        <p>Esc는 가장 위 창/선택/활동을 닫는다. 조준 중 Tab은 대상 변경, Enter/클릭은 확정이다.</p>
        <p>방향에 Ctrl을 더하면 제자리 회전, Shift를 더하면 밀친다. 접두 키를 쓴 뒤 방향을 골라도 된다.</p>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1" data-testid="current-keybindings"><div v-for="[id,label] in COMMANDS" :key="id"><span>{{ label }}: </span><kbd>{{ bindingText(preferences.keyBindings,id) }}</kbd></div></div>
        <p>소지품은 끌어서 옮기기/장착·우클릭 메뉴를 쓴다. 끄는 중 R·우클릭 회전은 유지한다.</p>
        <p>남쪽 옛 수레길 끝(지역 출입구)에 서서 그 칸을 클릭하면 고원을 떠난다(탈출).</p>
        <p>불 곁에서 옷 말리기 · 침구 우클릭 → 설치·그 위에서 수면(제작 창에서 회수) · 재료 우클릭 → 불에서 굽기 · 책 우클릭 → 읽기 (진행 보존)</p>
        <h3 class="pt-1 font-title text-sm text-[#e8d7a8]">기억할 것</h3>
        <label class="flex items-center gap-2"><input type="checkbox" :checked="w.s.autoSmells ?? false" @change="doAct({ type: 'smellWarnings', enabled: ($event.target as HTMLInputElement).checked })">연기·썩은 냄새가 나면 자동 이동 중단</label>
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
        <h2 class="text-center font-title text-3xl tracking-widest" :class="over.kind !== 'death' ? 'text-moss-300' : 'text-blood-300'">{{ over.report.title }}</h2>
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
