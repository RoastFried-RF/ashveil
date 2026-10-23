<script setup lang="ts">
// 격자 소지품: 장비 인형(11칸) + 10×6 격자 배낭 + 루팅 창. 끌어서 옮기기·장착·버리기.
import { foodMergeQuote,isWaterVessel,waterCapacity,cookingQuote,nearbyCampfires,nearbyIce, nearbySnow } from '../../core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  corpseMoneyQuote, economyDef, bestiaryEntry, knownCreatureName, dissectionChance, dissectionError, bestiaryDef, waterSafetyDef, waterPourQuote, drinkVolume, WATER_TREATMENT_LABEL, BAG_W, BAG_H, canStack, fitsAt, gridFits, itemAtCell, knowledgeDef, itemDef, itemSize, itemLabel, lootEquip, lootGrid, lootItems, maxStack, player, terrainAt, tileAt, type WaterTreatment, type ItemInst, type Slot, type World,
} from '../../core'
import { itemTip, SLOT_LABEL } from '../info'
import { act, version, world } from '../store'
import { itemHotbarRef, assignHotbar, doAct, hideTip, hint, showTip, useItem, wins } from '../ui'
import ItemBadges from './ItemBadges.vue'
import ItemIcon from './ItemIcon.vue'
import Win from './Win.vue'
import {cycleFocus,focusableIn} from '../input-context'
import {preferencesOpen} from '../preferences'
import {definitionInspectorOpen} from '../definition-inspector-ui'

const itemSearch=ref('')
const itemGroup=ref('all')
const groups=[['all','전체'],['food','먹을 것'],['medical','의료'],['gear','장비'],['material','재료']] as const
function matchesItem(it:ItemInst){
 const w=world.value as World,def=itemDef(w,it),q=itemSearch.value.trim().normalize('NFKC').toLocaleLowerCase('ko')
 const group=itemGroup.value
 const category=group==='all'||(group==='food'?!!def.food||!!def.drink:group==='medical'?def.category==='medical'||def.category==='drug':group==='gear'?!!def.slot||!!def.attacks:!!def.rawMaterial||!!def.rawFragment)
 return category&&(!q||itemLabel(w,it).normalize('NFKC').toLocaleLowerCase('ko').includes(q))
}
const searchMatches=computed(()=>{void version.value;return player(world.value as World).bag.filter(matchesItem).length})
const CELL = 38
const DOLL: (Slot | null)[][] = [['neck', 'head', 'back'], ['main', 'chest', 'off'], ['ring1', 'hands', 'ring2'], ['belt', 'feet', 'lining']]

const d = computed(() => {
  void version.value
  const w = world.value as World
  const pl = player(w)
  const bag = pl.bag.filter((i) => i.gx !== undefined && i.gy !== undefined)
  const loose = pl.bag.filter((i) => i.gx === undefined || i.gy === undefined)
  const loot = lootItems(w)
  const grid = lootGrid(w)
  const corpse = lootEquip(w)
  const lootEq = corpse ? (Object.keys(corpse.equip) as Slot[]).filter((k) => corpse.equip[k]).map((k) => ({ slot: k, it: corpse.equip[k]! })) : []
  const openBag=w.s.loot?.kind==='bag'?(pl.bag.find(it=>it.uid===w.s.loot!.id)??(pl.equip.belt?.uid===w.s.loot.id?pl.equip.belt:undefined)??(pl.equip.back?.uid===w.s.loot.id?pl.equip.back:undefined)):undefined
  const lootLabel = openBag?itemLabel(w,openBag):corpse ? `${knownCreatureName(w,corpse)}의 시체` : w.s.loot ? terrainAt(w, w.s.loot.pos).label : ''
  const floor = !loot ? tileAt(w, pl.pos).items : []
  let used = 0
  for (const it of bag) { const [a, b] = itemSize(w, it); used += a * b }
  return { w, pl, bag, loose, loot, grid, lootEq, lootLabel, floor, coins:corpseMoneyQuote(w,pl), currency:economyDef(w).currency, dissection:corpse?{id:corpse.id,kind:bestiaryEntry(w,corpse.def)?.kind,mood:w.db.thought(bestiaryDef(w).tabooThought).mood,loss:bestiaryDef(w).tabooLoss,error:dissectionError(w,pl,corpse.id),chance:dissectionChance(w,pl,corpse),turns:bestiaryDef(w).dissectTurns,done:corpse.dissected}:null, free: BAG_W * BAG_H - used }
})

// ── 끌기 ──
interface Drag { from: 'bag' | 'equip' | 'loot' | 'floor'; it: ItemInst; slot?: Slot; gdx: number; gdy: number; x: number; y: number; moved: boolean; sx: number; sy: number; rot: boolean }
const drag = ref<Drag | null>(null)
const menu = ref<{ x: number; y: number; it: ItemInst; from: Drag['from']; slot?: Slot } | null>(null)
const menuRoot=ref<HTMLElement|null>(null)
let menuOrigin:HTMLElement|null=null,foodMergeOrigin:HTMLElement|null=null
let dismissClickCleanup:(()=>void)|undefined
const foodMerge=ref<{uid:number;into:number;n?:number;signature:string;description:string}|null>(null)
function closeFoodMerge(){foodMerge.value=null;window.removeEventListener('keydown',foodMergeKey,true);if(foodMergeOrigin?.isConnected)foodMergeOrigin.focus({preventScroll:true})}
function foodMergeKey(e:KeyboardEvent){
  if(!foodMerge.value)return
  e.stopImmediatePropagation()
  if(e.key==='Escape'){e.preventDefault();closeFoodMerge();return}
  if(e.key==='Tab'){const root=document.querySelector<HTMLElement>('[data-testid=food-merge-confirmation]');if(root)cycleFocus(root,e);return}
  if(e.ctrlKey||e.metaKey)return
  if((e.key==='Enter'||e.key===' ')&&(e.target as HTMLElement)?.closest('[data-testid=food-merge-confirmation] button'))return
  e.preventDefault()
}
onBeforeUnmount(()=>window.removeEventListener('keydown',foodMergeKey,true))
function requestMerge(uid:number,into:number,n?:number){
  const w=world.value as World,quote=foodMergeQuote(w,player(w),uid,into,n)
  if(!quote.error&&quote.needsConsent){foodMergeOrigin=document.activeElement instanceof HTMLElement?document.activeElement:null;foodMerge.value={uid,into,n,signature:quote.signature,description:quote.description};window.addEventListener('keydown',foodMergeKey,true);void nextTick(()=>document.querySelector<HTMLButtonElement>('[data-testid=food-merge-cancel]')?.focus());return null}
  return act({type:'mergeItem',uid,into,n})
}
function confirmFoodMerge(){
  const request=foodMerge.value;if(!request)return
  const error=act({type:'mergeItem',uid:request.uid,into:request.into,n:request.n,freshnessApproval:request.signature})
  closeFoodMerge();if(error)hint.value=error
}

function down(e: PointerEvent, from: Drag['from'], it: ItemInst, slot?: Slot) {
  if (e.button !== 0) return
  cancelDrag();closeMenu(false)
  ;(e.currentTarget as HTMLElement).focus({preventScroll:true})
  const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
  drag.value = { from, it, slot, gdx: Math.floor((e.clientX - el.left) / CELL), gdy: Math.floor((e.clientY - el.top) / CELL), x: e.clientX, y: e.clientY, moved: false, sx: e.clientX, sy: e.clientY, rot: (from === 'bag' || from === 'loot') && !!it.rot }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel',cancelDrag)
  window.addEventListener('keydown', rotKey, true)
  window.addEventListener('contextmenu', rotCtx, true)
}
function move(e: PointerEvent) {
  const g = drag.value
  if (!g) return
  g.x = e.clientX; g.y = e.clientY
  if (Math.abs(g.x - g.sx) + Math.abs(g.y - g.sy) > 5) { g.moved = true; hideTip() }
  if (g.moved) hover.value = dropTarget(g, e)
}

/** 격자 위 포인터 칸 [cx, cy] */
function cellAt(sel: string, x: number, y: number, gw: number, gh: number): [number, number] | null {
  const el = document.querySelector(sel)
  if (!el) return null
  if(document.elementFromPoint(x,y)?.closest('[data-testid=bag],[data-testid=loot-grid]')!==el)return null
  const r = el.getBoundingClientRect()
  const cx = Math.floor((x - r.left - 2) / CELL), cy = Math.floor((y - r.top - 2) / CELL)
  return cx >= 0 && cy >= 0 && cx < gw && cy < gh ? [cx, cy] : null
}

/** 놓기 윤곽 (12 §2.3 G3): 들어가면 초록, 안 들어가면 빨강, 같은 더미 위면 합치기(노랑) */
interface Hover { grid: 'bag' | 'loot'; gx: number; gy: number; ok: boolean; merge?: ItemInst }
const hover = ref<Hover | null>(null)
function dropTarget(g: Drag, e: { clientX: number; clientY: number }): Hover | null {
  const w = world.value as World
  const pl = player(w)
  const def = itemDef(w, g.it)
  const offset = g.from === 'bag' || g.from === 'loot'
  const b = cellAt('[data-testid=bag]', e.clientX, e.clientY, BAG_W, BAG_H)
  if (b) {
    const under = itemAtCell(w, pl.bag, b[0], b[1], g.it.uid)
    if (under && (canStack(under, g.it)||g.from==='bag'&&!foodMergeQuote(w,pl,g.it.uid,under.uid).error) && under.count < maxStack(itemDef(w, under))) return { grid: 'bag', gx: under.gx!, gy: under.gy!, ok: true, merge: under }
    const gx = b[0] - (offset ? g.gdx : 0), gy = b[1] - (offset ? g.gdy : 0)
    return { grid: 'bag', gx, gy, ok: fitsAt(w, pl, def, gx, gy, g.from === 'bag' ? g.it.uid : undefined, g.rot) }
  }
  const lg = lootGrid(w)
  const l = lg && cellAt('[data-testid=loot-grid]', e.clientX, e.clientY, lg.w, lg.h)
  if (lg && l) {
    const gx = l[0] - (offset ? g.gdx : 0), gy = l[1] - (offset ? g.gdy : 0)
    return { grid: 'loot', gx, gy, ok: gridFits(w, lg, def, gx, gy, g.from === 'loot' ? g.it.uid : undefined, g.rot) }
  }
  return null
}

/** 나누기 수 (13 §5): Ctrl = 절반, Shift = 1개 */
function splitN(e: PointerEvent, it: ItemInst): number | undefined {
  if (it.count < 2) return undefined
  if (e.ctrlKey || e.metaKey) return Math.floor(it.count / 2)
  if (e.shiftKey) return 1
  return undefined
}
/** 끄는 중 R 또는 우클릭: 90° 돌리기 (13 §3) */
function rotate() {
  const g = drag.value
  if (!g) return
  const [a, b] = itemDef(world.value as World, g.it).size
  if (a === b) return
  g.rot = !g.rot
  g.gdx = 0
  g.gdy = 0
}
function rotKey(e:KeyboardEvent){
  if(!drag.value)return
  e.preventDefault();e.stopImmediatePropagation()
  if(e.key==='Escape'){cancelDrag();return}
  if(drag.value.moved&&e.code==='KeyR'&&!e.repeat)rotate()
}
function cancelDrag(){
  drag.value=null;hover.value=null
  window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancelDrag)
  window.removeEventListener('keydown',rotKey,true);window.removeEventListener('contextmenu',rotCtx,true)
}
function rotCtx(e: MouseEvent) {
  if (!drag.value?.moved) return
  e.preventDefault()
  e.stopImmediatePropagation()
  rotate()
}
function up(e: PointerEvent) {
  if (e.button !== 0) return
  const g=drag.value
  cancelDrag()
  if (!g || !g.moved) return
  const w = world.value as World
  const tgt = dropTarget(g, e)
  if(tgt&&!tgt.ok){hint.value='놓을 공간이 없다';return}
  if (tgt?.grid === 'bag' && g.from === 'bag') {
    const n = splitN(e, g.it)
    const err = tgt.merge ? requestMerge(g.it.uid,tgt.merge.uid,n)
      : n ? act({ type: 'splitItem', uid: g.it.uid, n, gx: tgt.gx, gy: tgt.gy, rot: g.rot })
        : act({ type: 'moveItem', uid: g.it.uid, gx: tgt.gx, gy: tgt.gy, rot: g.rot })
    if (err) hint.value = err
    return
  }
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]') as HTMLElement | null
  if (!el && !tgt) return
  const kind = tgt ? (tgt.grid === 'bag' ? 'cell' : 'lootcell') : el!.dataset.drop
  if (kind === 'cell') {
    const gx = tgt ? tgt.gx : Number(el!.dataset.gx), gy = tgt ? tgt.gy : Number(el!.dataset.gy)
    let err: string | null = null
    if (g.from === 'equip' && g.slot) err = doAct({ type: 'unequip', slot: g.slot })
    else if (g.from === 'loot') err = doAct({ type: 'lootTake', uid: g.it.uid })
    else if (g.from === 'floor') err = doAct({ type: 'pickup', uid: g.it.uid })
    if (!err) {
      const moved = player(w).bag.find((i) => i.uid === g.it.uid)
      if (moved && fitsAt(w, player(w), itemDef(w, moved), gx, gy, moved.uid, g.rot)) act({ type: 'moveItem', uid: moved.uid, gx, gy, rot: g.rot })
    }
  } else if (kind === 'slot' && el) {
    if (g.from === 'bag') doAct({ type: 'equip', uid: g.it.uid, slot: el.dataset.slot as Slot })
    else hint.value = '먼저 배낭에 넣어야 한다'
  } else if (kind === 'lootcell') {
    const gx = tgt ? tgt.gx : Number(el!.dataset.gx) - g.gdx, gy = tgt ? tgt.gy : Number(el!.dataset.gy) - g.gdy
    if (g.from === 'bag') { const err = doAct({ type: 'lootPut', uid: g.it.uid, gx, gy, rot: g.rot }); if (err) hint.value = err }
    else if (g.from === 'loot') { const err = act({ type: 'lootMove', uid: g.it.uid, gx, gy, rot: g.rot }); if (err) hint.value = err }
  } else if (kind === 'loot') {
    if (g.from === 'bag') doAct({ type: 'lootPut', uid: g.it.uid })
  } else if (kind === 'ground') {
    if (g.from === 'bag'||g.from==='equip') doAct({type:'drop',uid:g.it.uid})
  } else if (kind === 'hotbar') {
    assignHotbar(itemHotbarRef(world.value as World,g.it))
  }
}
function cancelPointer(){cancelDrag();closeMenu(false);dismissClickCleanup?.()}
watch([preferencesOpen,definitionInspectorOpen],([settings,inspector])=>{if(settings||inspector){cancelPointer();if(foodMerge.value)closeFoodMerge()}},{flush:'sync'})
onMounted(()=>window.addEventListener('blur',cancelPointer))
onBeforeUnmount(()=>{cancelPointer();window.removeEventListener('blur',cancelPointer)})

/** 같은 칸에 착용 중인 장비와 비교 (12 §2.3 I 창 비교) */
function compare(w: World, it: ItemInst): string[] {
  const d = itemDef(w, it)
  if (!d.slot || d.slot === 'ring') return []
  const cur = player(w).equip[d.slot as Slot]
  if (!cur || cur.uid === it.uid) return []
  const c = itemDef(w, cur)
  const out = [`— 착용 중: ${c.label}`]
  const diff = (label: string, a: number, b: number) => { if (a !== b) out.push(`${label} ${b} → ${a} (${a > b ? '+' : ''}${a - b})`) }
  if (d.apparel && c.apparel) {
    diff('날 방어', d.apparel.armor.sharp ?? 0, c.apparel.armor.sharp ?? 0)
    diff('타격 방어', d.apparel.armor.blunt ?? 0, c.apparel.armor.blunt ?? 0)
    diff('단열', d.apparel.insulation, c.apparel.insulation)
    diff('둔중', d.bulk ?? 0, c.bulk ?? 0)
  }
  const a = d.attacks?.[0], b = c.attacks?.[0]
  if (a && b) {
    diff('피해', a.damage, b.damage)
    diff('관통', a.pen, b.pen)
    diff('정확도', a.accuracy, b.accuracy)
    diff('기력', a.energy, b.energy)
  }
  return out.length > 1 ? out : []
}

function tip(e: MouseEvent, it: ItemInst) {
  if (drag.value?.moved) return
  const w = world.value as World
  const t = itemTip(w, it)
  showTip(e, t.title, [...t.lines, ...compare(w, it), it.missingItem?'우클릭: 통째 보관·이동 메뉴 · 끌기: 옮기기 · 끌기 중 R: 회전':'더블클릭: 사용/장착 · 우클릭: 메뉴 · 끌기: 옮기기 · Ctrl+S: 자동 정렬'], t.color)
}
function dbl(it: ItemInst, from: Drag['from'], slot?: Slot) {
  hideTip()
  const w = world.value as World
  if (from === 'equip' && slot) return doAct({ type: 'unequip', slot })
  if (from === 'loot') return doAct({ type: 'lootTake', uid: it.uid })
  if (from === 'floor') return doAct({ type: 'pickup', uid: it.uid })
  if(itemDef(w,it).storage)return doAct({type:'openBag',uid:it.uid})
  useItem(w, it)
}
function closeMenu(restore=true){
  menu.value=null
  window.removeEventListener('keydown',menuKey,true);document.removeEventListener('pointerdown',outsideMenu,true);window.removeEventListener('resize',clampMenu)
  if(restore&&menuOrigin?.isConnected)menuOrigin.focus({preventScroll:true})
}
function clampMenu(){
 const m=menu.value,el=menuRoot.value;if(!m||!el)return
 const rect=el.getBoundingClientRect();m.x=Math.max(8,Math.min(m.x,window.innerWidth-rect.width-8));m.y=Math.max(8,Math.min(m.y,window.innerHeight-rect.height-8))
}
function outsideMenu(e:PointerEvent){
 if(!menu.value||menuRoot.value?.contains(e.target as Node))return
 closeMenu();e.preventDefault();e.stopImmediatePropagation()
 // Prevent the click following this pointerdown from activating the control behind it.
 dismissClickCleanup?.()
 let timer:ReturnType<typeof setTimeout>|undefined
 const clear=()=>{clearTimeout(timer);document.removeEventListener('click',consume,true);document.removeEventListener('pointerup',released,true);document.removeEventListener('pointercancel',clear,true);document.removeEventListener('pointerdown',nextPointer,true);dismissClickCleanup=undefined}
 const consume=(event:MouseEvent)=>{event.preventDefault();event.stopImmediatePropagation();clear()}
 const released=()=>{timer=setTimeout(clear,0)}
 const nextPointer=(event:PointerEvent)=>{if(event!==e)clear()}
 dismissClickCleanup=clear
 document.addEventListener('click',consume,true);document.addEventListener('pointerup',released,true);document.addEventListener('pointercancel',clear,true);document.addEventListener('pointerdown',nextPointer,true)
}
function menuKey(e:KeyboardEvent){
 const root=menuRoot.value;if(!menu.value||!root)return
 e.stopImmediatePropagation()
 if(e.key==='Escape'){e.preventDefault();closeMenu();return}
 if(e.key==='Tab'){cycleFocus(root,e);return}
 const controls=focusableIn(root),at=controls.indexOf(document.activeElement as HTMLElement)
 if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
  e.preventDefault();const i=e.key==='Home'?0:e.key==='End'?controls.length-1:at<0?(e.key==='ArrowUp'?controls.length-1:0):(at+(e.key==='ArrowUp'?-1:1)+controls.length)%controls.length;controls[i]?.focus();return
 }
 if((e.key==='Enter'||e.key===' ')&&root.contains(document.activeElement)){if(e.repeat)e.preventDefault();return}
 e.preventDefault()
}
function ctx(e:{clientX:number;clientY:number;currentTarget:EventTarget|null},it:ItemInst,from:Drag['from'],slot?:Slot){
 hideTip();cancelDrag();closeMenu(false)
 menuOrigin=e.currentTarget instanceof HTMLElement?e.currentTarget:null
 menu.value={x:e.clientX,y:e.clientY,it,from,slot}
 window.addEventListener('keydown',menuKey,true);document.addEventListener('pointerdown',outsideMenu,true);window.addEventListener('resize',clampMenu)
 void nextTick(()=>{clampMenu();menuRoot.value?.querySelector<HTMLElement>('button')?.focus({preventScroll:true})})
}
function itemAccess(it:ItemInst,from:Drag['from'],slot?:Slot){return{
 role:'button',tabindex:0,'aria-label':itemLabel(d.value.w,it)+' · Enter: 메뉴','data-inventory-item':it.uid,
 onKeydown:(e:KeyboardEvent)=>{
  if(!['Enter',' ','ContextMenu'].includes(e.key)&&!(e.shiftKey&&e.key==='F10'))return
  e.preventDefault();e.stopPropagation();if(e.repeat)return
  const box=(e.currentTarget as HTMLElement).getBoundingClientRect();ctx({clientX:box.left,clientY:box.bottom,currentTarget:e.currentTarget},it,from,slot)
 },
}}
const menuItems = computed(() => {
  const m = menu.value
  if (!m) return []
  const w = world.value as World
  const def = itemDef(w, m.it)
  const out: [string, () => void][] = []
  if(m.it.missingItem){
    if(m.from==='bag'||m.from==='equip'){if(w.s.loot)out.push(['넣기',()=>doAct({type:'lootPut',uid:m.it.uid})]);out.push(['바닥에 놓기',()=>doAct({type:'drop',uid:m.it.uid})])}
    else if(m.from==='loot')out.push(['가져가기',()=>doAct({type:'lootTake',uid:m.it.uid})])
    else out.push(['줍기',()=>doAct({type:'pickup',uid:m.it.uid})])
    return out
  }
  if ((m.from === 'bag' || m.from === 'equip') && def.ranged?.reloadTurns && (def.ranged.magazine?(m.it.loadedCartridges?.length??0)<def.ranged.magazine.capacity:!m.it.loadedAmmo)) out.push([`장전 (기본${def.ranged.reloadTurns}턴${def.ranged.magazine?.mode==='round'?'·한 발마다':''})`, () => doAct({ type: 'reload', uid: m.it.uid })])
  if((m.from==='bag'||m.from==='equip')&&def.ranged?.firearm){
    if(m.it.firearmJammed)out.push([`걸림 해소 (기본${def.ranged.firearm.unjamTurns}턴)`,()=>doAct({type:'firearmCare',uid:m.it.uid,operation:'unjam'})])
    if((m.it.firearmFouling??0)>0)out.push([`총열 청소 (기본${def.ranged.firearm.cleanTurns}턴·총기 기름1)`,()=>doAct({type:'firearmCare',uid:m.it.uid,operation:'clean'})])
  }
  if((m.from==='bag'||m.from==='equip'&&(m.slot==='main'||m.slot==='off'))&&def.throwable)out.push(['투척 공격 (1개)',()=>useItem(w,m.it)])
  if (m.from === 'bag') {
    if(def.category==='ammo'&&!def.powder)out.push(['탄약으로 선택',()=>useItem(w,m.it)])
    if (def.place) out.push([w.db.terrain(def.place).gather?(w.db.terrain(def.place).cultivation?.needsSoil===false?'바라보는 바닥에 심기':'바라보는 흙에 심기'):'바라보는 쪽에 설치', () => doAct({ type: 'place', uid: m.it.uid, dir: player(w).facing })])
    if (def.readable) out.push(['읽기', () => doAct({ type: 'read', uid: m.it.uid })])
    if (isWaterVessel(w,m.it)) {
      if ((m.it.uses ?? 0) > 0) for (const method of Object.keys(waterSafetyDef(w).treatments) as WaterTreatment[]) out.push([`${m.it.waterFrozen && method === 'boil' ? '눈 녹여 끓이기' : '물 ' + WATER_TREATMENT_LABEL[method]}${method === 'settle' ? ' (6시간 내려놓기)' : ''}`, () => doAct({ type: 'waterTreatment', uid: m.it.uid, method })])
      for (const target of player(w).bag.filter(i => i.uid !== m.it.uid && isWaterVessel(w,i))) {
        const free = waterCapacity(w,target) - drinkVolume(w,target), ml = Math.min(drinkVolume(w,m.it),free)
        const quote = waterPourQuote(w,player(w),m.it.uid,target.uid,ml)
        if(!quote.error) out.push([`다른 물병[${target.uid}]에 ${ml}ml 붓기`, () => doAct({type:'pourWater',uid:m.it.uid,targetUid:target.uid,ml})])
      }
      out.push([(m.it.uses??0)>0?'내용 버리고 새 물 채우기':'물가에서 채우기', () => doAct({ type: 'fillBottle', uid: m.it.uid })])
      if (nearbyIce(w, player(w))) out.push(['얼음 깨기 (3턴)', () => doAct({ type: 'breakIce' })])
      if (nearbySnow(w, player(w)) && (m.it.uses ?? 0) <= 0) out.push(['눈 모으기', () => doAct({ type: 'collectSnow', uid: m.it.uid })])
      out.push(['재비 빗물 받기', () => doAct({ type: 'collectRain', uid: m.it.uid })])
    }
    if (def.cooking&&!def.food?.emptyVessel) out.push(['불에서 굽기', () => doAct({ type: 'cook', uid: m.it.uid })])
    if(def.cooking)for(const pos of nearbyCampfires(w,player(w)))if(!cookingQuote(w,player(w),m.it.uid,pos).error)out.push(['모닥불에 올리기 ('+pos.x+','+pos.y+')',()=>doAct({type:'stageCooking',uid:m.it.uid,pos})])

    if (def.prosthetic) out.push(['신체에 설치', () => useItem(w, m.it)])
    if (def.unidentified === 'pill') out.push([`맛보기 (¼·${knowledgeDef(w).tasteTurns}턴)`, () => doAct({ type: 'taste', uid: m.it.uid })])
    if(def.openFood&&m.from==='bag')out.push([def.openFoodLabel??'밀봉 음식 열기',()=>doAct({type:'openFood',uid:m.it.uid})])
    if(def.storage)out.push(['열기',()=>doAct({type:'openBag',uid:m.it.uid})])
    if (def.food || def.drink || def.drug || def.unidentified || def.refuel) out.push(['먹기·쓰기', () => useItem(w, m.it)])
    if (def.medical) out.push(['상처에 쓰기', () => useItem(w, m.it)])
    if (def.slot) out.push(['장착', () => doAct({ type: 'equip', uid: m.it.uid })])
    if(def.apparel?.liner)out.push(['안감으로 입기',()=>doAct({type:'equip',uid:m.it.uid,slot:'lining'})])
    if (def.light && !def.slot) out.push([m.it.lit ? '불 끄기' : '불 켜기', () => doAct({ type: 'toggleLight', uid: m.it.uid })])
    if (w.s.loot) out.push(['넣기', () => doAct({ type: 'lootPut', uid: m.it.uid })])
    out.push(['빠른 슬롯에', () => assignHotbar(itemHotbarRef(w,m.it))])
    out.push([def.unidentified === 'pill' ? `감별 (${knowledgeDef(w).examineTurns}턴)` : '살펴보기', () => doAct({ type: 'examine', uid: m.it.uid })])
    out.push(['버리기', () => doAct({ type: 'drop', uid: m.it.uid })])
  } else if (m.from === 'equip' && m.slot) {
    if(m.it.half)out.push(['마저 입기',()=>doAct({type:'equip',uid:m.it.uid,slot:m.slot})])
    if(def.quiver)out.push(['화살통 열기',()=>doAct({type:'openBag',uid:m.it.uid})])
    if(def.pocket)out.push(['주머니 열기',()=>doAct({type:'openBag',uid:m.it.uid})])
    out.push(['벗기·내리기', () => doAct({ type: 'unequip', slot: m.slot! })])
    out.push([def.apparel?'벗어 바닥에 놓기':'바닥에 놓기',()=>doAct({type:'drop',uid:m.it.uid})])
    if (def.light) out.push([m.it.lit ? '불 끄기' : '불 켜기', () => doAct({ type: 'toggleLight', uid: m.it.uid })])
  } else if (m.from === 'loot') {
    out.push(['가져가기', () => doAct({ type: 'lootTake', uid: m.it.uid })])
    if(w.s.loot?.kind==='bag'&&(w.s.loot.id===d.value.pl.equip.belt?.uid||w.s.loot.id===d.value.pl.equip.back?.uid)){out.push([def.category==='ammo'?'탄약으로 선택':'주머니에서 쓰기',()=>useItem(w,m.it)]);out.push(['빠른 슬롯에',()=>assignHotbar(itemHotbarRef(w,m.it))])}
  }
  else out.push(['줍기', () => doAct({ type: 'pickup', uid: m.it.uid })])
  return out
})
function pick(f: () => void) { closeMenu();f() }

function size(it: ItemInst): [number, number] {
  return itemSize(world.value as World, it)
}
const dragSize = computed<[number, number]>(() => {
  const g = drag.value
  if (!g) return [1, 1]
  const [a, b] = itemDef(world.value as World, g.it).size
  return g.rot ? [b, a] : [a, b]
})
function outline(h: Hover) {
  const [a, b] = h.merge ? size(h.merge) : dragSize.value
  return { left: h.gx * CELL + 'px', top: h.gy * CELL + 'px', width: a * CELL + 'px', height: b * CELL + 'px' }
}
const OUTLINE = (h: Hover) => (h.merge ? 'border-amber-300 bg-amber-300/10' : h.ok ? 'border-[#6aa84f] bg-[#6aa84f]/15' : 'border-[#d8402e] bg-[#d8402e]/15')
const iconBox = (it: ItemInst) => { const [a,b]=itemDef(world.value as World,it).size;return{width:a*CELL-6,height:b*CELL-6} }
</script>

<template>
  <Win title="소지품" :x="420" :y="70" :width="660" testid="win-inv" @close="wins.inv = false">
    <div class="inventory-search"><input v-model="itemSearch" type="search" placeholder="지닌 물품 찾기" aria-label="소지품 이름 검색" data-testid="inventory-search"><button v-if="itemSearch||itemGroup!=='all'" class="dbtn" @click="itemSearch='';itemGroup='all'">해제</button></div>
    <div class="inventory-groups"><button v-for="[id,label] in groups" :key="id" :aria-pressed="itemGroup===id" :class="{'is-active':itemGroup===id}" @click="itemGroup=id">{{ label }}</button><span v-if="itemSearch||itemGroup!=='all'">배낭 {{ searchMatches }}개 더미 표시 · 위치 유지</span></div>
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
                    class="flex h-full w-full cursor-grab items-center justify-center" :class="{'inventory-unmatched':!matchesItem(d.pl.equip[s]!)}" v-bind="itemAccess(d.pl.equip[s]!,'equip',s)" @pointerdown="down($event, 'equip', d.pl.equip[s]!, s)" @dblclick="dbl(d.pl.equip[s]!, 'equip', s)"
                    @contextmenu.prevent="ctx($event, d.pl.equip[s]!, 'equip', s)" @mouseenter="tip($event, d.pl.equip[s]!)" @mousemove="tip($event, d.pl.equip[s]!)" @mouseleave="hideTip"
                  >
                    <ItemIcon :name="d.w.db.item(d.pl.equip[s]!.def).sprite" :size="32" />
                  </div>
                  <ItemBadges :w="d.w" :it="d.pl.equip[s]!" />
                  <span v-if="d.pl.equip[s]!.lit" class="absolute right-0.5 top-0 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_4px_#ffb040]" />
                </template>
                <span v-else class="pointer-events-none text-[10px] text-[#b3a182]">{{ SLOT_LABEL[s] }}</span>
              </div>
            </div>
          </template>
        </div>
        <div class="df df-tab mt-2 flex h-9 items-center justify-center text-[11px] text-ash-400" data-drop="ground" title="여기로 끌어 버리기">⤓ 바닥에 버리기</div>
      </div>

      <!-- 배낭 격자 -->
      <div>
        <div class="mb-1 flex justify-between font-title text-xs text-ash-400"><span>배낭</span><span data-testid="wallet-balance">지갑 {{ d.pl.money??0 }}{{ d.currency }}</span><span>빈 칸 {{ d.free }}</span></div>
        <div class="inset relative" :style="{ width: BAG_W * CELL + 4 + 'px', height: BAG_H * CELL + 4 + 'px' }" data-testid="bag">
          <div
            v-for="i in BAG_W * BAG_H" :key="i" class="absolute border border-[#2c2a22] bg-[#15140f]/60" data-drop="cell" :data-gx="(i - 1) % BAG_W" :data-gy="Math.floor((i - 1) / BAG_W)"
            :style="{ left: ((i - 1) % BAG_W) * CELL + 'px', top: Math.floor((i - 1) / BAG_W) * CELL + 'px', width: CELL + 'px', height: CELL + 'px' }"
          />
          <div v-if="hover?.grid === 'bag'" class="pointer-events-none absolute z-10 border-2" :class="OUTLINE(hover)" :style="outline(hover)" data-testid="drop-outline" />
          <div
            v-for="it in d.bag" :key="it.uid" class="absolute flex cursor-grab items-center justify-center border border-[#5a5340] bg-[#2a2720]/90 hover:border-amber-500"
            :class="{'opacity-30':drag?.it.uid===it.uid&&drag.moved,'inventory-unmatched':!matchesItem(it),'inventory-matched':(itemSearch||itemGroup!=='all')&&matchesItem(it)}" :data-testid="`item-${it.def}`" :data-uid="it.uid" v-bind="itemAccess(it,'bag')"
            :style="{ left: it.gx! * CELL + 1 + 'px', top: it.gy! * CELL + 1 + 'px', width: size(it)[0] * CELL - 2 + 'px', height: size(it)[1] * CELL - 2 + 'px' }"
            @pointerdown="down($event, 'bag', it)" @dblclick="dbl(it, 'bag')" @contextmenu.prevent="ctx($event, it, 'bag')" @mouseenter="tip($event, it)" @mousemove="tip($event, it)" @mouseleave="hideTip"
          >
            <div :style="{ transform: it.rot ? 'rotate(90deg)' : '' }"><ItemIcon :name="d.w.db.item(it.def).sprite" v-bind="iconBox(it)" /></div>
            <ItemBadges :w="d.w" :it="it" />
            <span v-if="it.count > 1" class="absolute bottom-0 right-0.5 text-[10px] font-bold text-[#f0e6c8] [text-shadow:0_1px_0_#000]">{{ it.count }}</span>
            <span v-if="it.lit" class="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_4px_#ffb040]" />
          </div>
        </div>
        <div class="mt-0.5 text-[10px] text-ash-500">끌기 중 Ctrl = 절반 나누기 · Shift = 1개 · 같은 것 위에 놓으면 합치기</div>
        <div v-if="d.loose.length" class="mt-1 text-[11px] text-blood-300">넘친 짐: {{ d.loose.map((i) => itemLabel(d.w, i)).join(', ') }}</div>
      </div>
    </div>

    <button v-if="d.pl.equip.belt && d.w.db.item(d.pl.equip.belt.def).pocket" class="dbtn mt-2" data-testid="open-belt-pocket" @click="doAct({type:'openBag',uid:d.pl.equip.belt.uid})">허리 주머니 열기 (2×2)</button>

    <button v-if="d.pl.ammoPreference" class="dbtn mt-2 ml-2" data-testid="clear-ammo-selection" @click="doAct({type:'clearAmmo'})">탄약 자동 선택으로 전환</button>
    <button v-if="d.pl.equip.back && d.w.db.item(d.pl.equip.back.def).quiver" class="dbtn mt-2 ml-2" data-testid="open-quiver" @click="doAct({type:'openBag',uid:d.pl.equip.back.uid})">화살통 열기 (1×6)</button>

    <!-- 루팅: 상자·석관·서가·보관함·시체는 격자, 바닥은 목록 (13 §8) -->
    <div v-if="d.loot" class="df df-olive mt-2" data-drop="loot" data-testid="loot">
      <div v-if="d.dissection" class="mb-1 flex items-center gap-2 text-xs" data-testid="dissection-panel"><button class="dbtn" data-testid="dissect-corpse" :disabled="!!d.dissection.error" :title="d.dissection.error??'완료 때 한 번 판정하며 중단하면 사체를 보존한다'" @click="doAct({type:'dissect',target:d.dissection.id})">{{ d.dissection.kind==='machine'?'기계 분해':'사체 해부' }} (기본{{ d.dissection.turns }}턴)</button><span>{{ d.dissection.done ? (d.dissection.done.success?'해부 성공':'해부 실패 · 재료 손상') : d.dissection.error??`성공 ${d.dissection.chance}%` }}</span><span v-if="d.dissection.kind==='human'" class="text-amber-200">완료 시 기분 {{ d.dissection.mood }} · 목격 시 평판 소식 {{ d.dissection.loss }}</span></div>
      <div class="mb-1 flex items-center justify-between">
        <span class="font-title text-sm text-[#e8d7a8]">{{ d.lootLabel }}<span v-if="d.grid" class="ml-2 text-[10px] text-ash-500">{{ d.grid.w }}×{{ d.grid.h }}</span></span>
        <span class="flex gap-1">
          <button class="dbtn-gold" data-testid="loot-all" :disabled="!(d.grid ? d.grid.items.length : d.loot.length) && (!!d.coins.error || !d.coins.amount)" @click="doAct({ type: 'lootAll' })">모두 가져가기 (E)</button>
          <button class="dbtn" @click="doAct({ type: 'lootClose' })">닫기</button>
        </span>
      </div>
      <div v-if="d.coins.id !== undefined && d.coins.amount" class="mb-2 flex items-center gap-2 text-xs" data-testid="corpse-money"><span>주머니 동전 {{ d.coins.amount }}{{ d.currency }}</span><button class="dbtn" :disabled="!!d.coins.error" :title="d.coins.error??'동전은 지갑으로 옮긴다'" data-testid="take-corpse-money" @click="doAct({type:'lootMoney',target:d.coins.id!,expectedAmount:d.coins.amount})">동전 가져가기</button></div>
      <div v-if="d.lootEq.length" class="mb-1 flex flex-wrap items-center gap-1">
        <span class="text-[10px] text-ash-500">입고 있는 것 (벗기기 = 탈 턴):</span>
        <div
          v-for="e in d.lootEq" :key="e.it.uid" class="df df-slot relative flex h-[40px] w-[40px] cursor-grab items-center justify-center" :data-testid="`loot-${e.it.def}`" v-bind="itemAccess(e.it,'loot')"
          @pointerdown="down($event, 'loot', e.it)" @dblclick="dbl(e.it, 'loot')" @contextmenu.prevent="ctx($event,e.it,'loot')" @mouseenter="tip($event, e.it)" @mouseleave="hideTip"
        >
          <ItemIcon :name="d.w.db.item(e.it.def).sprite" :size="28" />
          <ItemBadges :w="d.w" :it="e.it" />
        </div>
      </div>
      <div v-if="d.grid" class="inset relative" :style="{ width: d.grid.w * CELL + 4 + 'px', height: d.grid.h * CELL + 4 + 'px' }" data-testid="loot-grid">
        <div
          v-for="i in d.grid.w * d.grid.h" :key="i" class="absolute border border-[#2c2a22] bg-[#15140f]/60" data-drop="lootcell" :data-gx="(i - 1) % d.grid.w" :data-gy="Math.floor((i - 1) / d.grid.w)"
          :style="{ left: ((i - 1) % d.grid.w) * CELL + 'px', top: Math.floor((i - 1) / d.grid.w) * CELL + 'px', width: CELL + 'px', height: CELL + 'px' }"
        />
        <div v-if="hover?.grid === 'loot'" class="pointer-events-none absolute z-10 border-2" :class="OUTLINE(hover)" :style="outline(hover)" />
        <div
          v-for="it in d.grid.items.filter((x) => x.gx !== undefined)" :key="it.uid" class="absolute flex cursor-grab items-center justify-center border border-[#5a5340] bg-[#2a2720]/90 hover:border-amber-500"
          :class="{'opacity-30':drag?.it.uid===it.uid&&drag.moved,'inventory-unmatched':!matchesItem(it),'inventory-matched':(itemSearch||itemGroup!=='all')&&matchesItem(it)}" :data-testid="`loot-${it.def}`" v-bind="itemAccess(it,'loot')"
          :style="{ left: it.gx! * CELL + 1 + 'px', top: it.gy! * CELL + 1 + 'px', width: size(it)[0] * CELL - 2 + 'px', height: size(it)[1] * CELL - 2 + 'px' }"
          @pointerdown="down($event, 'loot', it)" @dblclick="dbl(it, 'loot')" @contextmenu.prevent="ctx($event, it, 'loot')" @mouseenter="tip($event, it)" @mousemove="tip($event, it)" @mouseleave="hideTip"
        >
          <div :style="{ transform: it.rot ? 'rotate(90deg)' : '' }"><ItemIcon :name="d.w.db.item(it.def).sprite" v-bind="iconBox(it)" /></div>
          <ItemBadges :w="d.w" :it="it" />
          <span v-if="it.count > 1" class="absolute bottom-0 right-0.5 text-[10px] font-bold text-[#f0e6c8] [text-shadow:0_1px_0_#000]">{{ it.count }}</span>
        </div>
        <p v-if="!d.grid.items.length && !d.lootEq.length" class="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-ash-500">비어 있다.</p>
      </div>
      <template v-else>
        <p v-if="!d.loot.length" class="text-xs text-ash-500">비어 있다.</p>
        <div class="flex flex-wrap gap-1">
          <div
            v-for="it in d.loot" :key="it.uid" class="df df-slot relative flex h-[46px] w-[46px] cursor-grab items-center justify-center" :data-testid="`loot-${it.def}`" v-bind="itemAccess(it,'loot')"
            @pointerdown="down($event, 'loot', it)" @dblclick="dbl(it, 'loot')" @contextmenu.prevent="ctx($event, it, 'loot')" @mouseenter="tip($event, it)" @mouseleave="hideTip"
          >
            <ItemIcon :name="d.w.db.item(it.def).sprite" />
            <span v-if="it.count > 1" class="absolute bottom-0 right-0.5 text-[10px] font-bold text-[#f0e6c8] [text-shadow:0_1px_0_#000]">{{ it.count }}</span>
          </div>
        </div>
      </template>
    </div>
    <div v-else-if="d.floor.length" class="df df-olive mt-2">
      <div class="mb-1 flex items-center justify-between"><span class="font-title text-sm text-[#e8d7a8]">발밑</span><button class="dbtn" @click="doAct({ type: 'pickup' })">모두 줍기 (G)</button></div>
      <div class="flex flex-wrap gap-1">
        <div v-for="it in d.floor" :key="it.uid" :data-floor-uid="it.uid" v-bind="itemAccess(it,'floor')" class="df df-slot relative flex h-[46px] w-[46px] cursor-grab items-center justify-center" @pointerdown="down($event, 'floor', it)" @dblclick="dbl(it, 'floor')" @contextmenu.prevent="ctx($event,it,'floor')" @mouseenter="tip($event, it)" @mouseleave="hideTip">
          <ItemIcon :name="d.w.db.item(it.def).sprite" />
          <span v-if="it.count > 1" class="absolute bottom-0 right-0.5 text-[10px] font-bold text-[#f0e6c8]">{{ it.count }}</span>
        </div>
      </div>
    </div>

    <!-- 끄는 중인 아이템 -->
    <Teleport to="body">
      <div v-if="foodMerge" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70" data-testid="food-merge-confirmation" @pointerdown.stop>
        <div class="df df-celtic max-w-md p-3 text-sm" role="dialog" aria-modal="true" aria-label="음식 신선도 병합 확인">
          <p class="mb-2 text-amber-200">합치면 모두 더 낮은 신선도로 바뀐다.</p>
          <p class="mb-3">{{ foodMerge.description }}</p>
          <button class="dbtn-gold mr-2" data-testid="food-merge-accept" @click="confirmFoodMerge">이 상태로 합치기</button>
          <button class="dbtn" data-testid="food-merge-cancel" @click="closeFoodMerge">취소</button>
        </div>
      </div>
      <div v-if="drag?.moved" class="pointer-events-none fixed z-[9998] flex items-center justify-center border border-amber-400/70 bg-amber-200/10" :style="{ left: drag.x - drag.gdx * CELL - CELL / 2 + 'px', top: drag.y - drag.gdy * CELL - CELL / 2 + 'px', width: dragSize[0] * CELL + 'px', height: dragSize[1] * CELL + 'px' }">
        <div :style="{ transform: drag.rot ? 'rotate(90deg)' : '' }"><ItemIcon :name="d.w.db.item(drag.it.def).sprite" v-bind="iconBox(drag.it)" /></div>
        <span class="absolute -bottom-4 left-0 whitespace-nowrap text-[10px] text-amber-200 [text-shadow:0_1px_0_#000]">R·우클릭: 돌리기</span>
      </div>
      <div v-if="menu" ref="menuRoot" role="dialog" aria-label="물품 행동" data-testid="item-menu" class="df df-celtic fixed z-[9998] max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] min-w-[120px] overflow-y-auto" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @pointerdown.stop>
        <div class="mb-1 border-b border-[#4a4436] text-xs text-[#e8d7a8]">{{ itemLabel(d.w, menu.it) }}</div>
        <button v-for="[l, f] in menuItems" :key="l" class="block w-full px-1 py-0.5 text-left text-xs text-ash-100 hover:bg-[#3a3428] hover:text-amber-200" @click="pick(f)">{{ l }}</button>
      </div>
    </Teleport>
  </Win>
</template>

<style scoped>
.inventory-search{display:flex;gap:8px;margin-bottom:8px}.inventory-search input{flex:1;min-width:0;border:1px solid #62553d;background:#191b17;color:#d9ccb0;padding:8px 10px;font-size:11px}.inventory-groups{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-bottom:13px}.inventory-groups button{font-size:10px;border:1px solid #4b4431;padding:4px 9px;color:#a89f85;background:#212119}.inventory-groups button.is-active{color:#dfc994;border-color:#9d8351;background:#3b3221}.inventory-groups span{color:#a19679;font-size:9px;margin-left:auto}.inventory-unmatched{opacity:.32;filter:saturate(.2)}.inventory-matched{outline:1px solid #c4ab71;outline-offset:-2px}
</style>
