<script setup lang="ts">
// 격자 소지품: 장비 인형(11칸) + 10×6 격자 배낭 + 루팅 창. 끌어서 옮기기·장착·버리기.
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  BAG_W, BAG_H, fitsAt, itemDef, itemLabel, lootItems, player, terrainAt, tileAt, type ItemInst, type Slot, type World,
} from '../../core'
import { itemTip, SLOT_LABEL } from '../info'
import { act, version, world } from '../store'
import { assignHotbar, doAct, hideTip, hint, showTip, useItem, wins } from '../ui'
import ItemIcon from './ItemIcon.vue'
import Win from './Win.vue'

const CELL = 38
const DOLL: (Slot | null)[][] = [['neck', 'head', 'back'], ['main', 'chest', 'off'], ['ring1', 'hands', 'ring2'], ['belt', 'feet', null]]

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const bag = pl.bag.filter((i) => i.gx !== undefined && i.gy !== undefined)
  const loose = pl.bag.filter((i) => i.gx === undefined || i.gy === undefined)
  const loot = lootItems(w)
  const lootLabel = w.s.loot ? terrainAt(w, w.s.loot.pos).label : ''
  const floor = !loot ? tileAt(w, pl.pos).items : []
  let used = 0
  for (const it of bag) { const [a, b] = itemDef(w, it).size; used += a * b }
  return { w, pl, bag, loose, loot, lootLabel, floor, free: BAG_W * BAG_H - used }
})

// ── 끌기 ──
interface Drag { from: 'bag' | 'equip' | 'loot' | 'floor'; it: ItemInst; slot?: Slot; gdx: number; gdy: number; x: number; y: number; moved: boolean; sx: number; sy: number }
const drag = ref<Drag | null>(null)
const menu = ref<{ x: number; y: number; it: ItemInst; from: Drag['from']; slot?: Slot } | null>(null)

function down(e: PointerEvent, from: Drag['from'], it: ItemInst, slot?: Slot) {
  if (e.button !== 0) return
  const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
  drag.value = { from, it, slot, gdx: Math.floor((e.clientX - el.left) / CELL), gdy: Math.floor((e.clientY - el.top) / CELL), x: e.clientX, y: e.clientY, moved: false, sx: e.clientX, sy: e.clientY }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
function move(e: PointerEvent) {
  const g = drag.value
  if (!g) return
  g.x = e.clientX; g.y = e.clientY
  if (Math.abs(g.x - g.sx) + Math.abs(g.y - g.sy) > 5) { g.moved = true; hideTip() }
}
function up(e: PointerEvent) {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', up)
  const g = drag.value
  drag.value = null
  if (!g || !g.moved) return
  const w = world.value as World
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]') as HTMLElement | null
  if (!el) return
  const kind = el.dataset.drop
  if (kind === 'cell') {
    const gx = Number(el.dataset.gx) - (g.from === 'bag' ? g.gdx : 0), gy = Number(el.dataset.gy) - (g.from === 'bag' ? g.gdy : 0)
    if (g.from === 'bag') { const err = act({ type: 'moveItem', uid: g.it.uid, gx, gy }); if (err) hint.value = err; return }
    let err: string | null = null
    if (g.from === 'equip' && g.slot) err = doAct({ type: 'unequip', slot: g.slot })
    else if (g.from === 'loot') err = doAct({ type: 'lootTake', uid: g.it.uid })
    else if (g.from === 'floor') err = doAct({ type: 'pickup', uid: g.it.uid })
    if (!err) {
      const moved = player(w).bag.find((i) => i.uid === g.it.uid)
      if (moved && fitsAt(w, player(w), itemDef(w, moved), gx, gy, moved.uid)) act({ type: 'moveItem', uid: moved.uid, gx, gy })
    }
  } else if (kind === 'slot') {
    if (g.from === 'bag') doAct({ type: 'equip', uid: g.it.uid, slot: el.dataset.slot as Slot })
    else hint.value = '먼저 배낭에 넣어야 한다'
  } else if (kind === 'loot') {
    if (g.from === 'bag') doAct({ type: 'lootPut', uid: g.it.uid })
  } else if (kind === 'ground') {
    if (g.from === 'bag') doAct({ type: 'drop', uid: g.it.uid })
    else if (g.from === 'equip' && g.slot) { if (!doAct({ type: 'unequip', slot: g.slot })) doAct({ type: 'drop', uid: g.it.uid }) }
  } else if (kind === 'hotbar') {
    assignHotbar({ kind: 'item', def: g.it.def })
  }
}
onBeforeUnmount(() => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) })

function tip(e: MouseEvent, it: ItemInst) {
  if (drag.value?.moved) return
  const t = itemTip(world.value as World, it)
  showTip(e, t.title, [...t.lines, '더블클릭: 사용/장착 · 우클릭: 메뉴 · 끌기: 옮기기'], t.color)
}
function dbl(it: ItemInst, from: Drag['from'], slot?: Slot) {
  hideTip()
  const w = world.value as World
  if (from === 'equip' && slot) return doAct({ type: 'unequip', slot })
  if (from === 'loot') return doAct({ type: 'lootTake', uid: it.uid })
  if (from === 'floor') return doAct({ type: 'pickup', uid: it.uid })
  useItem(w, it)
}
function ctx(e: MouseEvent, it: ItemInst, from: Drag['from'], slot?: Slot) {
  hideTip()
  menu.value = { x: e.clientX, y: e.clientY, it, from, slot }
}
const menuItems = computed(() => {
  const m = menu.value
  if (!m) return []
  const w = world.value as World
  const def = itemDef(w, m.it)
  const out: [string, () => void][] = []
  if (m.from === 'bag') {
    if (def.food || def.drink || def.drug || def.unidentified || def.refuel) out.push(['먹기·쓰기', () => useItem(w, m.it)])
    if (def.medical) out.push(['상처에 쓰기', () => useItem(w, m.it)])
    if (def.slot) out.push(['장착', () => doAct({ type: 'equip', uid: m.it.uid })])
    if (def.light && !def.slot) out.push([m.it.lit ? '불 끄기' : '불 켜기', () => doAct({ type: 'toggleLight', uid: m.it.uid })])
    if (w.s.loot) out.push(['넣기', () => doAct({ type: 'lootPut', uid: m.it.uid })])
    out.push(['빠른 슬롯에', () => assignHotbar({ kind: 'item', def: m.it.def })])
    out.push(['살펴보기', () => doAct({ type: 'examine', uid: m.it.uid })])
    out.push(['버리기', () => doAct({ type: 'drop', uid: m.it.uid })])
  } else if (m.from === 'equip' && m.slot) {
    out.push(['벗기·내리기', () => doAct({ type: 'unequip', slot: m.slot! })])
    if (def.light) out.push([m.it.lit ? '불 끄기' : '불 켜기', () => doAct({ type: 'toggleLight', uid: m.it.uid })])
  } else if (m.from === 'loot') out.push(['가져가기', () => doAct({ type: 'lootTake', uid: m.it.uid })])
  else out.push(['줍기', () => doAct({ type: 'pickup', uid: m.it.uid })])
  return out
})
function pick(f: () => void) { menu.value = null; f() }

function size(it: ItemInst): [number, number] {
  return itemDef(world.value as World, it).size ?? [1, 1]
}
const iconSize = (it: ItemInst) => { const [a, b] = size(it); return Math.min(a, b) >= 2 ? 64 : 32 }
</script>

<template>
  <Win title="소지품" :x="420" :y="70" :width="660" testid="win-inv" @close="wins.inv = false" @pointerdown="menu = null">
    <div class="flex flex-wrap gap-3">
      <!-- 장비 인형 -->
      <div class="relative shrink-0">
        <div class="mb-1 text-center font-title text-xs text-ash-400">장비</div>
        <div class="grid grid-cols-3 gap-1.5" data-testid="equip">
          <template v-for="(row, ri) in DOLL" :key="ri">
            <div v-for="(s, ci) in row" :key="ri + '-' + ci" class="h-[54px] w-[54px]">
              <div v-if="s" class="df relative flex h-full w-full items-center justify-center" :class="d.pl.equip[s] ? 'df-slot-sel' : 'df-slot'" data-drop="slot" :data-slot="s" :data-testid="`slot-${s}`">
                <template v-if="d.pl.equip[s]">
                  <div
                    class="flex h-full w-full cursor-grab items-center justify-center" @pointerdown="down($event, 'equip', d.pl.equip[s]!, s)" @dblclick="dbl(d.pl.equip[s]!, 'equip', s)"
                    @contextmenu.prevent="ctx($event, d.pl.equip[s]!, 'equip', s)" @mouseenter="tip($event, d.pl.equip[s]!)" @mousemove="tip($event, d.pl.equip[s]!)" @mouseleave="hideTip"
                  >
                    <ItemIcon :name="d.w.db.item(d.pl.equip[s]!.def).sprite" :size="32" />
                  </div>
                  <span v-if="d.pl.equip[s]!.lit" class="absolute right-0.5 top-0 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_4px_#ffb040]" />
                </template>
                <span v-else class="pointer-events-none text-[10px] text-[#6a6252]">{{ SLOT_LABEL[s] }}</span>
              </div>
            </div>
          </template>
        </div>
        <div class="df df-tab mt-2 flex h-9 items-center justify-center text-[11px] text-ash-400" data-drop="ground" title="여기로 끌어 버리기">⤓ 바닥에 버리기</div>
      </div>

      <!-- 배낭 격자 -->
      <div>
        <div class="mb-1 flex justify-between font-title text-xs text-ash-400"><span>배낭</span><span>빈 칸 {{ d.free }}</span></div>
        <div class="inset relative" :style="{ width: BAG_W * CELL + 4 + 'px', height: BAG_H * CELL + 4 + 'px' }" data-testid="bag">
          <div
            v-for="i in BAG_W * BAG_H" :key="i" class="absolute border border-[#2c2a22] bg-[#15140f]/60" data-drop="cell" :data-gx="(i - 1) % BAG_W" :data-gy="Math.floor((i - 1) / BAG_W)"
            :style="{ left: ((i - 1) % BAG_W) * CELL + 'px', top: Math.floor((i - 1) / BAG_W) * CELL + 'px', width: CELL + 'px', height: CELL + 'px' }"
          />
          <div
            v-for="it in d.bag" :key="it.uid" class="absolute flex cursor-grab items-center justify-center border border-[#5a5340] bg-[#2a2720]/90 hover:border-amber-500"
            :class="drag?.it.uid === it.uid && drag.moved ? 'opacity-30' : ''" :data-testid="`item-${it.def}`"
            :style="{ left: it.gx! * CELL + 1 + 'px', top: it.gy! * CELL + 1 + 'px', width: size(it)[0] * CELL - 2 + 'px', height: size(it)[1] * CELL - 2 + 'px' }"
            @pointerdown="down($event, 'bag', it)" @dblclick="dbl(it, 'bag')" @contextmenu.prevent="ctx($event, it, 'bag')" @mouseenter="tip($event, it)" @mousemove="tip($event, it)" @mouseleave="hideTip"
          >
            <ItemIcon :name="d.w.db.item(it.def).sprite" :size="iconSize(it)" />
            <span v-if="it.count > 1" class="absolute bottom-0 right-0.5 text-[10px] font-bold text-[#f0e6c8] [text-shadow:0_1px_0_#000]">{{ it.count }}</span>
            <span v-if="it.lit" class="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_4px_#ffb040]" />
          </div>
        </div>
        <div v-if="d.loose.length" class="mt-1 text-[11px] text-blood-300">넘친 짐: {{ d.loose.map((i) => itemLabel(d.w, i)).join(', ') }}</div>
      </div>
    </div>

    <!-- 루팅 / 발밑 -->
    <div v-if="d.loot" class="df df-olive mt-2 !border-[12px]" data-drop="loot" data-testid="loot">
      <div class="mb-1 flex items-center justify-between">
        <span class="font-title text-sm text-[#e8d7a8]">{{ d.lootLabel }}</span>
        <span class="flex gap-1">
          <button class="dbtn-gold" data-testid="loot-all" :disabled="!d.loot.length" @click="doAct({ type: 'lootAll' })">모두 가져가기 (E)</button>
          <button class="dbtn" @click="doAct({ type: 'lootClose' })">닫기</button>
        </span>
      </div>
      <p v-if="!d.loot.length" class="text-xs text-ash-500">비어 있다.</p>
      <div class="flex flex-wrap gap-1">
        <div
          v-for="it in d.loot" :key="it.uid" class="df df-slot relative flex h-[46px] w-[46px] cursor-grab items-center justify-center" :data-testid="`loot-${it.def}`"
          @pointerdown="down($event, 'loot', it)" @dblclick="dbl(it, 'loot')" @click.right.prevent="ctx($event, it, 'loot')" @mouseenter="tip($event, it)" @mouseleave="hideTip"
        >
          <ItemIcon :name="d.w.db.item(it.def).sprite" />
          <span v-if="it.count > 1" class="absolute bottom-0 right-0.5 text-[10px] font-bold text-[#f0e6c8] [text-shadow:0_1px_0_#000]">{{ it.count }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="d.floor.length" class="df df-olive mt-2 !border-[12px]">
      <div class="mb-1 flex items-center justify-between"><span class="font-title text-sm text-[#e8d7a8]">발밑</span><button class="dbtn" @click="doAct({ type: 'pickup' })">모두 줍기 (G)</button></div>
      <div class="flex flex-wrap gap-1">
        <div v-for="it in d.floor" :key="it.uid" class="df df-slot relative flex h-[46px] w-[46px] cursor-grab items-center justify-center" @pointerdown="down($event, 'floor', it)" @dblclick="dbl(it, 'floor')" @mouseenter="tip($event, it)" @mouseleave="hideTip">
          <ItemIcon :name="d.w.db.item(it.def).sprite" />
          <span v-if="it.count > 1" class="absolute bottom-0 right-0.5 text-[10px] font-bold text-[#f0e6c8]">{{ it.count }}</span>
        </div>
      </div>
    </div>

    <!-- 끄는 중인 아이템 -->
    <Teleport to="body">
      <div v-if="drag?.moved" class="pointer-events-none fixed z-[9998] opacity-90" :style="{ left: drag.x - 16 + 'px', top: drag.y - 16 + 'px' }">
        <ItemIcon :name="d.w.db.item(drag.it.def).sprite" />
      </div>
      <div v-if="menu" class="df df-celtic fixed z-[9998] !border-[10px] min-w-[120px]" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @pointerdown.stop>
        <div class="mb-1 border-b border-[#4a4436] text-xs text-[#e8d7a8]">{{ itemLabel(d.w, menu.it) }}</div>
        <button v-for="[l, f] in menuItems" :key="l" class="block w-full px-1 py-0.5 text-left text-xs text-ash-100 hover:bg-[#3a3428] hover:text-amber-200" @click="pick(f)">{{ l }}</button>
      </div>
    </Teleport>
  </Win>
</template>
