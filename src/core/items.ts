import {MISSING_ITEM} from './missing-items'
import {equipmentSnapshot,runEquipmentWorkers} from './script-item'
import { pillBelief } from './knowledge-state'
import { makePillAge } from './pill-aging'
import { prostheticAt, prostheticGrip } from './prosthetic-state'
import { clothingRemoveSlots } from './lining-state'
// 아이템: 격자 배낭 + 장비 슬롯 + 빠른 슬롯

import { agedItemDef, bowProblem } from './gear-state'
import { materialItemDef } from './materials'
import { capacity, regionState, partEff } from './body'
import { turnOf, type World } from './ctx'
import type { AttackDef, Creature, ItemDef, ItemInst, Slot } from './types'

export const BAG_W = 10
export const BAG_H = 6

/** Only an actually worn, intact original eye protector shields optical exposure. */
export function hasEyeProtection(w:World,c:Creature){return Object.values(c.equip).some(it=>it&&it.count>0&&!it.half&&!it.missingItem&&(it.durability??100)>0&&itemDef(w,it).apparel?.eyeProtection)}

export function makeItem(w: World, defId: string, count = 1): ItemInst {
  if(defId===MISSING_ITEM)throw new Error('보관물은 새 물품으로 생성할 수 없다')
  const def = w.db.item(defId)
  if((def.storage||def.pocket||def.quiver)&&count!==1)throw new Error('가방은 한 인스턴스에 하나씩 생성해야 한다')
  const it: ItemInst = { uid: w.s.nextId++, def: defId, count }
  if (def.unidentified === 'pill') { const age = makePillAge(w); if (age) it.pillAge = age }
  if(def.storage||def.pocket||def.quiver)it.contents=[]
  if (def.food?.freshHours || def.drink?.freshHours) { it.freshness = 100; it.foodAgedAt = turnOf(w) }
  if (def.stuffDefaults) it.stuff = structuredClone(def.stuffDefaults)
  if (def.apparel) it.wetness = {}
  if (def.apparel || def.attacks || def.shield || def.toolTags || def.repair || def.prosthetic) it.durability = 100
  if (it.durability!==undefined||def.ranged||def.book||def.fletching||def.powder||def.cartridge)it.gearAgedAt=turnOf(w)
  if (def.attacks?.some((a) => a.damageType === 'cut' || a.damageType === 'stab')) it.edge = def.edgeStart ?? 100
  if (def.light) { it.fuel = def.light.fuelTurns; it.lit = false }
  if(def.powder||def.cartridge)it.powderWetness=0
  if (def.uses!==undefined) it.uses = def.uses
  if(def.food?.servings){it.uses=def.food.servings;it.foodVesselDef=def.food.emptyVessel;it.foodSealed=true}
  return it
}

/** 품질 6단계 (08 §4 · 13 §10): 피해·방어, 최대 내구, 단열, 가치 배율과 테두리 색(탁한 색만) */
export const QUALITY = [
  { label: '조악', dmg: 0.85, dur: 0.7, ins: 0.9, value: 0.5, color: '#4c4a44' },
  { label: '보통', dmg: 1, dur: 1, ins: 1, value: 1, color: '#9c988c' },
  { label: '좋음', dmg: 1.1, dur: 1.15, ins: 1.05, value: 1.6, color: '#76864a' },
  { label: '뛰어남', dmg: 1.2, dur: 1.3, ins: 1.1, value: 2.5, color: '#62788a' },
  { label: '명품', dmg: 1.3, dur: 1.5, ins: 1.15, value: 4, color: '#8e7ea8' },
  { label: '전설', dmg: 1.45, dur: 1.8, ins: 1.2, value: 8, color: '#a8925a' },
] as const

export const qualityOf = (it?: ItemInst): number => it?.quality ?? 1
export const qualityInfo = (it?: ItemInst) => QUALITY[qualityOf(it)]
/** 품질이 의미 있는 아이템: 무기·방어구·방패·정밀 잠금 도구 */
export const hasQuality = (def: ItemDef) => !!(def.apparel || def.attacks || def.shield || def.toolTags?.includes('lockpick'))

/** 내구 구간 (13 §10): 60~100 · 30~59 닳음 · 1~29 부서지기 직전 · 0 파손 */
export function durabilityBand(d: number): { label: string; color: string } {
  if (d <= 0) return { label: '파손', color: '#d8402e' }
  if (d < 30) return { label: '부서지기 직전', color: '#d9a040' }
  if (d < 60) return { label: '닳음', color: '#b0a878' }
  return { label: '', color: '#e8e4d8' }
}

/** 쌓임 키 (13 §5): 같은 Def·품질·내구·오염 상태만 쌓인다. */
export function canStack(a: ItemInst, b: ItemInst): boolean {
  if(JSON.stringify(a.toxin)!==JSON.stringify(b.toxin))return false
  if ((a.pillAge?.potency ?? 100) !== (b.pillAge?.potency ?? 100) || !!a.pillAge?.spoiled !== !!b.pillAge?.spoiled) return false
  if((a.powderWetness!==undefined||b.powderWetness!==undefined)&&a.gearAgedAt!==b.gearAgedAt)return false
  if((a.powderWetness??0)!==(b.powderWetness??0)||a.loadedRound||b.loadedRound||a.loadedCartridges||b.loadedCartridges)return false
  if(!!a.fletchingDamaged!==!!b.fletchingDamaged)return false
  if(a.contents||b.contents)return false
  if(a.missingItem||b.missingItem||a.def===MISSING_ITEM||b.def===MISSING_ITEM)return false
  if(JSON.stringify(a.cropHarvest)!==JSON.stringify(b.cropHarvest))return false
  if(JSON.stringify(a.workshopMade)!==JSON.stringify(b.workshopMade))return false
  if(a.contaminantAsh!==b.contaminantAsh||a.foodSaltGrams!==b.foodSaltGrams||a.foodHeatedAt!==b.foodHeatedAt)return false
  if (a.pillRemaining !== undefined || b.pillRemaining !== undefined) return false
  if (!!a.waterFrozen !== !!b.waterFrozen) return false
  if ((a.durability??100)!==(b.durability??100)) return false
  if(a.rawGrams!==b.rawGrams||a.rawMaterial!==b.rawMaterial||JSON.stringify(a.stuff)!==JSON.stringify(b.stuff))return false
  return a.def === b.def && qualityOf(a) === qualityOf(b) && JSON.stringify(a.foodWater)===JSON.stringify(b.foodWater) && a.foodQ === b.foodQ && a.cookProgress === b.cookProgress && !!a.foodBurnt === !!b.foodBurnt && !!a.dirty === !!b.dirty && (a.freshness ?? 100) === (b.freshness ?? 100) && a.foodAgedAt === b.foodAgedAt && !!a.foodFrozen === !!b.foodFrozen && !!a.foodThawed === !!b.foodThawed && !!a.foodWet === !!b.foodWet && !!a.foodLeftover === !!b.foodLeftover && !!a.foodSealed === !!b.foodSealed
}

export function itemDef(w: World, it: ItemInst): ItemDef {
  if(it.missingItem)return{...w.db.item(MISSING_ITEM),label:`${it.missingItem.label} (보관물)`,size:[...it.missingItem.size],stackable:true,maxStack:Math.max(it.count,it.missingItem.maxStack)}
  return agedItemDef(materialItemDef(w, it), it)
}

export function maxStack(def: ItemDef): number {
  return def.stackable ? def.maxStack ?? 5 : 1
}

/** 장착 + 배낭의 모든 아이템 */
export function allItems(c: Creature): ItemInst[] {
  const eq = Object.values(c.equip).filter((x): x is ItemInst => !!x)
  return [...c.bag, ...eq, ...pocketItems(c), ...quiverItems(c), ...(c.captivity?[c.captivity.rope]:[]), ...Object.values(c.body.prosthetics ?? {}).map((s) => s.item)]
}

/** 벗었거나 반쯤 걸친 허리띠의 안쪽은 바로 사용할 수 없다. */
export function pocketItems(c:Creature):ItemInst[]{const belt=c.equip.belt;return belt&&!belt.half&&!belt.missingItem&&(belt.durability??100)>0?belt.contents??[]:[]}
export function quiverItems(c:Creature):ItemInst[]{const back=c.equip.back;return back&&!back.half&&!back.missingItem&&(back.durability??100)>0?back.contents??[]:[]}
export function supplyItems(c:Creature):ItemInst[]{return[...c.bag,...pocketItems(c),...quiverItems(c)]}
export const itemStorage=(def:ItemDef)=>def.storage??def.pocket??def.quiver?.size
function quickSources(c:Creature,includeHeld:boolean):ItemInst[]{return[...supplyItems(c),...(includeHeld?[c.equip.main,c.equip.off].filter((i):i is ItemInst=>!!i&&!i.half):[])]}
/** 기본은 배낭/착용한 주머니이며, 투척이 명시한 경우만 실제 두 손을 포함한다. */
export function quickItem(c:Creature,def:string,fletchingDamaged?:boolean,includeHeld=false):ItemInst|undefined{return quickSources(c,includeHeld).filter(it=>it.def===def&&!it.missingItem&&(fletchingDamaged===undefined||!!it.fletchingDamaged===fletchingDamaged)).sort((a,b)=>(a.freshness??100)-(b.freshness??100)||a.uid-b.uid)[0]}
export function quickCount(c:Creature,def:string,fletchingDamaged?:boolean,includeHeld=false):number{return quickSources(c,includeHeld).filter(it=>it.def===def&&!it.missingItem&&(fletchingDamaged===undefined||!!it.fletchingDamaged===fletchingDamaged)).reduce((n,it)=>n+it.count,0)}

/** 환경·가치 정산용. 사용/도구 검색은 allItems의 접근 가능한 물품만 찾는다. */
export function storedItems(items: readonly ItemInst[]): ItemInst[] {
  const result:ItemInst[]=[],seen=new Set<ItemInst>()
  const visit=(it:ItemInst)=>{if(seen.has(it))return;seen.add(it);result.push(it);for(const child of it.contents??[])visit(child);if(it.loadedRound){visit(it.loadedRound.ball);visit(it.loadedRound.powder)}for(const round of it.loadedCartridges??[])visit(round)}
  for(const it of items)visit(it)
  return result
}

export function findItem(c: Creature, uid: number): ItemInst | undefined {
  return allItems(c).find((i) => i.uid === uid)
}

export function isEquipped(c: Creature, uid: number): boolean {
  return Object.values(c.equip).some((i) => i?.uid === uid)
}

export function equippedSlot(c: Creature, uid: number): Slot | undefined {
  return (Object.keys(c.equip) as Slot[]).find((k) => c.equip[k]?.uid === uid)
}

// ── 격자 ──────────────────────────────────────────────

/** 놓인 방향을 반영한 칸 크기 [가로, 세로] */
export function itemSize(w: World, it: ItemInst): [number, number] {
  const [a, b] = itemDef(w, it).size ?? [1, 1]
  return it.rot ? [b, a] : [a, b]
}

/** 격자 하나 (배낭·상자·시체 배낭·보관함) */
export interface Grid { items: ItemInst[]; w: number; h: number }

export function bagGrid(c: Creature): Grid {
  return { items: c.bag, w: BAG_W, h: BAG_H }
}

function occupiedIn(w: World, g: Grid, ignore?: number): boolean[] {
  const grid = new Array(g.w * g.h).fill(false)
  for (const it of g.items) {
    if (it.uid === ignore || it.gx === undefined || it.gy === undefined) continue
    const [iw, ih] = itemSize(w, it)
    for (let y = it.gy; y < Math.min(g.h, it.gy + ih); y++) for (let x = it.gx; x < Math.min(g.w, it.gx + iw); x++) grid[y * g.w + x] = true
  }
  return grid
}

export function gridFits(w: World, g: Grid, def: ItemDef, gx: number, gy: number, ignore?: number, rot = false): boolean {
  const [iw, ih] = rot ? [def.size[1], def.size[0]] : def.size
  if (gx < 0 || gy < 0 || gx + iw > g.w || gy + ih > g.h) return false
  const occ = occupiedIn(w, g, ignore)
  for (let y = gy; y < gy + ih; y++) for (let x = gx; x < gx + iw; x++) if (occ[y * g.w + x]) return false
  return true
}

/** 빈 자리: 행 우선(y → x), 기본 방향 먼저 → 안 되면 돌려서 (13 §9) */
export function gridSpot(w: World, g: Grid, def: ItemDef): [number, number, boolean] | null {
  for (const rot of def.size[0] === def.size[1] ? [false] : [false, true]) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (gridFits(w, g, def, x, y, undefined, rot)) return [x, y, rot]
  }
  return null
}

/** 격자에 넣기. 같은 종류는 먼저 쌓는다. 실패하면 남은 개수 반환 */
export function gridAdd(w: World, g: Grid, it: ItemInst): number {
  const def = itemDef(w, it)
  const ms = maxStack(def)
  let left = it.count
  if (ms > 1) {
    for (const ex of g.items) {
      if (!canStack(ex, it) || ex.count >= ms) continue
      const take = Math.min(ms - ex.count, left)
      ex.count += take
      left -= take
      if (left <= 0) return 0
    }
  }
  while (left > 0) {
    const spot = gridSpot(w, g, def)
    if (!spot) return left
    const n = Math.min(ms, left)
    const piece: ItemInst = n === it.count && left === it.count ? it : { ...it, uid: w.s.nextId++, count: n }
    piece.count = n
    piece.gx = spot[0]
    piece.gy = spot[1]
    piece.rot = spot[2] || undefined
    g.items.push(piece)
    left -= n
  }
  return 0
}

export function fitsAt(w: World, c: Creature, def: ItemDef, gx: number, gy: number, ignore?: number, rot = false): boolean {
  return gridFits(w, bagGrid(c), def, gx, gy, ignore, rot)
}

export function findSpot(w: World, c: Creature, def: ItemDef): [number, number, boolean] | null {
  return gridSpot(w, bagGrid(c), def)
}

/** 배낭에 넣기. 같은 종류는 먼저 쌓는다. 실패하면 남은 개수 반환 */
export function addToBag(w: World, c: Creature, it: ItemInst): number {
  const result = gridAdd(w, bagGrid(c), it)
  if (result < it.count) delete it.waterSettlesAt
  return result
}

/** NPC 등 격자 제약 없이 넣기 (배낭이 꽉 차도 소지) */
export function addToInventory(w: World, c: Creature, it: ItemInst) {
  if (addToBag(w, c, it) > 0) {
    it.gx = undefined
    it.gy = undefined
    c.bag.push(it)
  }
}

export function moveInBag(w: World, c: Creature, uid: number, gx: number, gy: number, rot?: boolean): boolean {
  const it = c.bag.find((i) => i.uid === uid)
  if (!it) return false
  const r = rot ?? !!it.rot
  if (!fitsAt(w, c, itemDef(w, it), gx, gy, uid, r)) return false
  it.gx = gx
  it.gy = gy
  it.rot = r || undefined
  return true
}

/** 격자에서 (gx, gy) 칸을 차지한 아이템 */
export function itemAtCell(w: World, items: ItemInst[], gx: number, gy: number, ignore?: number): ItemInst | undefined {
  return items.find((i) => {
    if (i.uid === ignore || i.gx === undefined || i.gy === undefined) return false
    const [iw, ih] = itemSize(w, i)
    return gx >= i.gx && gx < i.gx + iw && gy >= i.gy && gy < i.gy + ih
  })
}

/** 합치기 (13 §5): 같은 것 위에 놓으면 합친다. 넘치는 수는 끌던 쪽에 남는다. 옮긴 수 */
export function mergeInto(w: World, items: ItemInst[], from: ItemInst, to: ItemInst, n = from.count): number {
  if (from.uid === to.uid || !canStack(from, to)) return 0
  const take = Math.min(maxStack(itemDef(w, to)) - to.count, n, from.count)
  if (take <= 0) return 0
  to.count += take
  from.count -= take
  if (from.count <= 0) items.splice(items.indexOf(from), 1)
  return take
}

/** 나누기 (13 §5): Ctrl+끌기 = 절반, Shift+끌기 = 1개. 새 더미를 (gx, gy)에 */
export function splitInBag(w: World, c: Creature, uid: number, n: number, gx: number, gy: number, rot?: boolean): ItemInst | undefined {
  const it = c.bag.find((i) => i.uid === uid)
  if (!it || it.missingItem || it.contents || n <= 0 || n >= it.count) return undefined
  const r = rot ?? !!it.rot
  if (!fitsAt(w, c, itemDef(w, it), gx, gy, undefined, r)) return undefined
  const piece: ItemInst = { ...it, uid: w.s.nextId++, count: n, gx, gy, rot: r || undefined }
  it.count -= n
  c.bag.push(piece)
  return piece
}

/** 하나 빼내기 (쌓인 경우 1개 분리) */
export function removeOne(w: World, c: Creature, uid: number): ItemInst | undefined {
  const slot = equippedSlot(c, uid)
  if (slot) {
    const it = c.equip[slot]!
    delete c.equip[slot]
    return it
  }
  const source=supplyItems(c).find(i=>i.uid===uid),items=source&&c.bag.includes(source)?c.bag:source&&pocketItems(c).includes(source)?pocketItems(c):quiverItems(c)
  const it = items.find((i) => i.uid === uid)
  if (!it) return undefined
  if(it.missingItem&&it.count>1)return undefined
  if (it.count > 1) {
    it.count--
    return { ...it, uid: w.s.nextId++, count: 1, gx: undefined, gy: undefined }
  }
  if(items===c.bag)c.bag=c.bag.filter(i=>i.uid!==uid)
  else items.splice(items.indexOf(it),1)
  return { ...it, gx: undefined, gy: undefined }
}

export function removeStack(c: Creature, uid: number): ItemInst | undefined {
  const slot = equippedSlot(c, uid)
  if (slot) {
    const it = c.equip[slot]!
    delete c.equip[slot]
    return it
  }
  const source=supplyItems(c).find(i=>i.uid===uid),items=source&&c.bag.includes(source)?c.bag:source&&pocketItems(c).includes(source)?pocketItems(c):quiverItems(c)
  const it = items.find((i) => i.uid === uid)
  if (!it) return undefined
  if(items===c.bag)c.bag=c.bag.filter(i=>i.uid!==uid)
  else items.splice(items.indexOf(it),1)
  return { ...it, gx: undefined, gy: undefined }
}

export function countOf(c: Creature, defId: string): number {
  return supplyItems(c).filter((i) => i.def === defId).reduce((s, i) => s + i.count, 0)
}

// ── 장비 ──────────────────────────────────────────────

export function slotFor(w: World, c: Creature, def: ItemDef): Slot | null {
  if (!def.slot) return null
  if (def.slot === 'ring') return c.equip.ring1 ? (c.equip.ring2 ? 'ring1' : 'ring2') : 'ring1'
  return def.slot
}
export function equipDisplacements(w:World,c:Creature,it:ItemInst,target?:Slot):{slot:Slot;item:ItemInst}[]{
  const def=itemDef(w,it),slot=target??slotFor(w,c,def)
  if(!slot)return[]
  const slots:Slot[]=[slot]
  if(slot==='chest'&&!def.apparel?.liningHost)slots.push('lining')
  if(slot==='main'&&def.twoHanded)slots.push('off')
  return slots.filter((s)=>!!c.equip[s]&&c.equip[s]!.uid!==it.uid).map((s)=>({slot:s,item:c.equip[s]!}))
}

/** 장착 전 슬롯/교체 공간을 읽기 전용으로 검사한다. 실제 입기/완료/중단 모두 같은 규칙을 쓴다. */
export function equipError(w: World, c: Creature, uid: number, target?: Slot): string | null {
  const it = c.bag.find((i) => i.uid === uid)
  if(!it){const worn=(Object.keys(c.equip)as Slot[]).find((slot)=>c.equip[slot]?.uid===uid);if(worn&&(!target||target===worn))return slotBlocked(w,c,worn);return '배낭에 없다'}
  if(it.missingItem)return '원래 정의를 복원해야 장착할 수 있다'
  const def = itemDef(w, it)
  const slot = target ?? slotFor(w, c, def)
  if (!slot) return '장착할 수 없는 물건'
  // 한손 무기는 보조 칸에도 든다 (13 §6.1)
  const offWeapon = slot === 'off' && def.slot === 'main' && !def.twoHanded && !!def.attacks
  const lining=slot==='lining'
  if(lining&&(def.slot!=='chest'||!def.apparel?.liner))return '이 물품은 안감으로 입을 수 없다'
  if(lining&&!c.equip.chest)return '안감을 넣을 겉옷을 먼저 입어야 한다'
  if(lining&&!itemDef(w,c.equip.chest!).apparel?.liningHost)return '이 겉옷에는 안감 칸이 없다'
  if (!lining&&!offWeapon && (def.slot === 'ring' ? !slot.startsWith('ring') : def.slot !== slot)) return '그 칸에는 맞지 않는다'
  const blocked = slotBlocked(w, c, slot)
  if (blocked) return blocked
  if(slot==='main'&&def.twoHanded&&c.leading)return '호송 밧줄을 잡은 동안 양손 장비를 들 수 없다'
  if (slot === 'off') {
    const main = c.equip.main
    if (main && itemDef(w, main).twoHanded) return '양손 무기를 들고 있다'
  }
  // 꺼낼 물품의 빈 칸까지 포함하되, 두 개의 기존 장비가 함께 들어가야 한다.
  // 미리보기에서 쌓임 분할/UID 할당이 일어나도 실제 세계에는 반영하지 않는다.
  const preview:World={db:w.db,s:{...w.s,nextId:w.s.nextId}},grid:Grid={items:structuredClone(c.bag.filter((b)=>b.uid!==uid)),w:BAG_W,h:BAG_H}
  const displaced=equipDisplacements(w,c,it,slot).map((e)=>e.item)
  for(const old of displaced)if(gridAdd(preview,grid,structuredClone(old)))return '교체할 장비를 넣을 배낭 자리가 없다'
  return null
}

/** 장착. 기존 장비는 배낭으로. 반환: 오류 메시지 또는 null */
export function equip(w:World,c:Creature,uid:number,target?:Slot,scriptNotify=true):string|null{
  const error=equipError(w,c,uid,target)
  if(error)return error
  const it=c.bag.find((i)=>i.uid===uid)
  if(!it)return null // 같은 슬롯의 반착용 재개
  const before=scriptNotify?equipmentSnapshot(c):[]
  const def=itemDef(w,it),slot=target??slotFor(w,c,def)!
  c.bag = c.bag.filter((i) => i.uid !== uid)
  it.gx = undefined
  it.gy = undefined
  const prev = c.equip[slot]
  c.equip[slot] = it
  if (prev) {prev.half=undefined;prev.dressProgress=undefined;addToBag(w, c, prev)}
  if(slot==='chest'&&!def.apparel?.liningHost&&c.equip.lining){const liner=c.equip.lining;delete c.equip.lining;liner.half=undefined;liner.dressProgress=undefined;addToBag(w,c,liner)}
  if (slot === 'main' && def.twoHanded && c.equip.off) {
    const off = c.equip.off
    delete c.equip.off
    off.half=undefined;off.dressProgress=undefined;addToBag(w, c, off)
  }
  if(scriptNotify)runEquipmentWorkers(w,c,before)
  return null
}

export function unequipError(w:World,c:Creature,slot:Slot):string|null{
  const it = c.equip[slot]
  if (!it) return '비어 있다'
  const slots=clothingRemoveSlots(c,slot)
  if(slots.length>1){
    const shadow:World={db:w.db,s:{...w.s,nextId:-1}},grid:Grid={items:structuredClone(c.bag),w:BAG_W,h:BAG_H}
    for(const s of slots)if(gridAdd(shadow,grid,structuredClone(c.equip[s]!)))return '겉옷과 안감을 넣을 배낭 자리가 없다'
    return null
  }
  const def=itemDef(w,it)
  return !findSpot(w,c,def)&&!c.bag.some((b)=>b.def===it.def&&b.count<maxStack(def))?'배낭에 자리가 없다':null
}
export function unequip(w: World, c: Creature, slot: Slot): string | null {
  const error=unequipError(w,c,slot);if(error)return error
  const before=equipmentSnapshot(c),it=c.equip[slot]!,slots=clothingRemoveSlots(c,slot)
  if(slots.length>1){
    for(const s of slots){const item=c.equip[s]!;delete c.equip[s];item.half=undefined;item.dressProgress=undefined;addToBag(w,c,item)}
    runEquipmentWorkers(w,c,before)
    return null
  }
  delete c.equip[slot]
  it.half=undefined;it.dressProgress=undefined
  addToBag(w, c, it)
  runEquipmentWorkers(w,c,before)
  return null
}

/** 슬롯이 막혔는가 (13 §6.1): 보조 칸은 왼팔 불구면, 반지는 그 손 손가락을 잃으면 */
export function slotBlocked(w: World, c: Creature, slot: Slot): string | null {
  if(c.leading&&c.leading.hand===(slot==='main'?'Right':slot==='off'?'Left':undefined))return '호송 밧줄을 잡고 있는 손이다'
  if (slot === 'off' && !prostheticGrip(w, c, 'Left')) return '갈고리 손으로는 장비를 쥘 수 없다'
  if (slot === 'main' && !prostheticGrip(w, c, 'Right')) return '갈고리 손으로는 무기를 쥘 수 없다'
  if (slot === 'off' && regionState(w, c, 'larm') === 4) return '왼팔을 쓸 수 없다'
  if (slot === 'main' && regionState(w, c, 'rarm') === 4) return '오른팔을 쓸 수 없다'
  if (slot === 'ring1' || slot === 'ring2') {
    const side = slot === 'ring1' ? 'Right' : 'Left'
    if (!prostheticGrip(w, c, side)) return '그 손에는 반지를 낄 수 없다'
    if (!prostheticAt(w, c, `${side}Hand`) && c.body.missing.some((m) => m.startsWith(side) && /Ring|Hand|Forearm|UpperArm/.test(m))) return '그 손에 낄 손가락이 없다'
  }
  return null
}

/** 지금 공격에 쓰는 무기·팔 (02 §2.0.3: 불구 팔의 무기는 못 쓴다, 양손 무기는 두 팔 모두 필요) */
export interface Wield {
  atk: AttackDef
  item?: ItemInst
  arm: 'larm' | 'rarm'
  twoHanded: boolean
  /** 손에 든 무기 대신 실제로 던지는 물품의 공격 문맥. */
  throwing?: boolean
}

function pickMode(def: ItemDef, mode?: string, it?: ItemInst): AttackDef | undefined {
  const list = def.attacks!.filter((a) => !a.requiresLit || (it?.lit && (it.fuel ?? 0) > 0))
  return list.find((a) => a.id === mode) ?? list[0]
}

export function wield(w: World, c: Creature, mode?: string): Wield | undefined {
  const la = regionState(w, c, 'larm'), ra = regionState(w, c, 'rarm')
  const want = mode ?? c.attackMode
  const main = c.equip.main
  if (main) {
    const d = itemDef(w, main)
    if (d.attacks?.length && (main.durability ?? 100) > 0 && !bowProblem(main, d)) {
      const atk = pickMode(d, want, main)
      if (atk && (d.twoHanded ? la < 4 && ra < 4 && prostheticGrip(w, c, 'Right') : ra < 4 && prostheticGrip(w, c, 'Right'))) return { atk, item: main, arm: 'rarm', twoHanded: !!d.twoHanded }
    }
  }
  const off = c.equip.off
  if (off && la < 4 && prostheticGrip(w, c, 'Left')) {
    const d = itemDef(w, off)
    const atk = d.attacks?.length && !d.ranged && (off.durability ?? 100) > 0 ? pickMode(d, want, off) : undefined
    if (atk) return { atk, item: off, arm: 'larm', twoHanded: false }
  }
  return naturalWield(w, c,want)
}

function naturalWield(w: World, c: Creature,mode?:string): Wield | undefined {
  const la = regionState(w, c, 'larm'), ra = regionState(w, c, 'rarm')
  for (const side of ['Right', 'Left'] as const) {
    if(c.leading?.hand===side)continue
    const hook = prostheticAt(w, c, `${side}Hand`)
    if (hook?.rule.attack && (side === 'Right' ? ra : la) < 4) return { atk: hook.rule.attack, arm: side === 'Right' ? 'rarm' : 'larm', twoHanded: false }
  }
  const def=w.db.creature(c.def),chosen=def.naturalAttacks?.find(a=>a.id===(mode??c.attackMode))??def.naturalAttack
  if(mode&&chosen?.requiresParts?.some(id=>partEff(w,c,id)<.1))return undefined
  const nat=[chosen,...(def.naturalAttacks??[]).filter(a=>a!==chosen)].find(a=>a&&(!a.requiresCapacity||capacity(w,c,a.requiresCapacity)>=.1)&&(!a.requiresParts||a.requiresParts.every(id=>partEff(w,c,id)>=.1)))
  if (!nat) return undefined
  if (nat.family === 'unarmed' && w.db.body(c.body.def).kind === 'humanoid') {
    if (ra < 4&&c.leading?.hand!=='Right') return { atk: nat, arm: nat.requiresParts?.some(id=>w.db.body(c.body.def).parts.find(p=>p.id===id)?.region==='larm')?'larm':'rarm', twoHanded: false }
    if (la < 4&&c.leading?.hand!=='Left') return { atk: nat, arm: 'larm', twoHanded: false }
    return undefined
  }
  return { atk: nat, arm: nat.requiresParts?.some(id=>w.db.body(c.body.def).parts.find(p=>p.id===id)?.region==='larm')?'larm':'rarm', twoHanded: false }
}

/** 근접에 쓰는 무기 (활을 들고 있으면 주먹) */
export function meleeWield(w: World, c: Creature, mode?: string): Wield | undefined {
  const main = c.equip.main
  if (main && itemDef(w, main).ranged) return naturalWield(w, c)
  return wield(w, c, mode)
}

export function mainWeapon(_w: World, c: Creature): ItemInst | undefined {
  return c.equip.main
}

export function offHand(_w: World, c: Creature): ItemInst | undefined {
  return c.equip.off
}

export function currentAttack(w: World, c: Creature): AttackDef | undefined {
  return wield(w, c)?.atk
}

export function apparelItems(w: World, c: Creature): { it: ItemInst; def: ItemDef }[] {
  return Object.entries(c.equip)
    .filter((x): x is [string,ItemInst] => !!x[1])
    .map(([slot,it]) => {const def=itemDef(w,it);return{it,def:slot==='lining'&&def.apparel?{...def,apparel:{...def.apparel,layer:0}}:def}})
    .filter((x) => !!x.def.apparel)
}

/** 장비 수정치 합 (반지·목걸이 등) */
export function gearAdd(w: World, c: Creature, key: string): number {
  let v = 0
  for (const it of Object.values(c.equip)) {
    if (!it) continue
    const m = itemDef(w, it).mods?.[key]
    if (typeof m === 'number') v += m
  }
  return v
}

/** 켜진 등불이 빛나는 곳 (13 §6, C5): 보조 손 = 제 반경, 허리띠 걸이(배낭 속 + 허리띠) = 반경 −1. 배낭에만 있으면 빛이 새지 않는다 */
export function lightSource(w: World, c: Creature): { it: ItemInst; radius: number } | undefined {
  const lit = (i?: ItemInst) => !!i && !!i.lit && (i.fuel ?? 0) > 0 && !!itemDef(w, i).light
  const off = c.equip.off
  if (off && lit(off)) return { it: off, radius: itemDef(w, off).light!.radius }
  for (const it of Object.values(c.equip)) if (it && lit(it) && it !== off) return { it, radius: itemDef(w, it).light!.radius }
  if (c.equip.belt) {
    const hooked = c.bag.find((i) => lit(i))
    if (hooked) return { it: hooked, radius: itemDef(w, hooked).light!.radius - 1 }
  }
  return undefined
}

export function hasBlade(w: World, c: Creature): boolean {
  return allItems(c).some((i) => itemDef(w, i).attacks?.some((a) => a.family === 'blade'))
}

// 무게는 쓰지 않는다 (공간이 제약). 호환용으로 1 고정
export function encumbranceMult(_w: World, _c: Creature): number {
  return 1
}

export function itemLabel(w: World, it: ItemInst): string {
  const def = itemDef(w, it)
  let s = def.relic && (it.appraisal ?? 0) < 2 ? def.unknownLabel ?? '미확인 유물' : def.label
  if (def.drink && !def.drink.alcohol && (it.uses ?? 1) > 0 && (it.water?.salinity ?? def.drink.quality?.salinity ?? 0) > 0) s += ' (소금물)'
  if (def.unidentified) {
    const belief = pillBelief(w,it.def)
    if (belief?.belief) s += ` (${w.db.pill(belief.belief).label}${belief.confidence === 'likely' ? ' 추정' : ''})`
    else s += ' (미확인)'
  }
  if (it.pillRemaining !== undefined) s += ` [${Math.round(it.pillRemaining * 4)}/4정]`
  if(def.rawFragment)s+=` [${it.rawGrams??0}g]`
  if(it.toxin)s+=' (마비독)'
  if(it.fletchingDamaged)s+=' (깃 손상)'
  if (it.count > 1) s += ` ×${it.count}`
  if (it.uses !== undefined) s += ` [${it.uses}회]`
  if (def.light) s += it.lit ? ' (켜짐)' : ''
  return s
}
