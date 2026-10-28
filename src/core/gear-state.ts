// 장비 상태는 저장값이다. 표시와 전투에서 같은 보정을 읽는다.
import type { World } from './ctx'
import type { BodyDef, BodyPartDef, Creature, ItemDef, ItemInst } from './types'

export function bowProblem(it: ItemInst, d: ItemDef): string | null {
  if (!d.ranged) return null
  if(d.ranged.firearm)return (it.durability??100)<=0?'화기가 부서졌다. 수리해야 한다':it.firearmJammed?'총이 걸렸다. 먼저 걸림을 해소해야 한다':null
  if ((it.durability ?? 100) <= 0) return '활이 부서졌다. 수리해야 한다'
  if (it.bowBroken) return '활시위가 끊어졌다. 새 시위를 걸어야 한다'
  if (it.bowUnstrung) return '활시위를 걸어야 쏠 수 있다'
  return null
}
const cache = new WeakMap<ItemInst, { base: ItemDef; key: string; def: ItemDef }>()
export function agedItemDef(base: ItemDef, it: ItemInst): ItemDef {
  const wet = (it.bowMoisture ?? 0) >= 60 ? 2 : (it.bowMoisture ?? 0) >= 30 ? 1 : 0
  const elasticity = it.elasticity ?? 100, rust = it.rust ?? 0
  if ((!base.ranged || base.ranged.firearm || (!wet && elasticity === 100)) && !rust) return base
  const key = `${wet}:${elasticity}:${rust}`, found = cache.get(it)
  if (found?.base === base && found.key === key) return found.def
  const d = { ...base }
  if (base.ranged&&!base.ranged.firearm) {
    const penalty = wet === 2 ? 3 : wet === 1 ? 1 : 0, mult = (wet === 2 ? .75 : wet === 1 ? .9 : 1) * elasticity / 100
    d.ranged = { ...base.ranged, range: Math.max(1, base.ranged.range - penalty), effective: Math.max(1, (base.ranged.effective ?? base.ranged.range) - penalty) }
    d.attacks = base.attacks?.map((a) => ({ ...a, damage: a.damage * mult }))
  }
  if (base.value !== undefined) d.value = Math.max(0, Math.floor(base.value * (1 - rust * .15)))
  cache.set(it, { base, key, def: d })
  return d
}
const armorCache = new WeakMap<BodyDef, Map<string, BodyPartDef[]>>()
export function armorParts(w: World, c: Creature, d: ItemDef): BodyPartDef[] {
  return armorPartsForBody(w,c.body.def,d)
}
export function armorPartsForBody(w:World,bodyId:string,d:ItemDef):BodyPartDef[]{
  const body = w.db.body(bodyId)
  let cache = armorCache.get(body)
  if (!cache) { cache = new Map(); armorCache.set(body, cache) }
  let parts = cache.get(d.id)
  if (!parts) { parts = body.parts.filter((p) => !p.internal && p.groups.some((g) => d.apparel?.groups.includes(g))); cache.set(d.id, parts) }
  return parts
}
export function armorPartIDs(w: World, c: Creature, d: ItemDef): string[] { return armorParts(w, c, d).map((p) => p.id) }
export function armorDurability(it: ItemInst, id: string): number { return it.partDurability?.[id] ?? it.durability ?? 100 }
export function ensureArmorParts(w: World, c: Creature, it: ItemInst) {
  const d = w.db.item(it.def), parts = (it.partDurability ??= {})
  for (const id of armorPartIDs(w, c, d)) parts[id] ??= it.durability ?? 100
  return parts
}
export function averageArmorDurability(it: ItemInst) {
  const parts = Object.values(it.partDurability ?? {})
  if (parts.length) it.durability = parts.reduce((n, p) => n + p, 0) / parts.length
}
export function wearArmorPart(w: World, c: Creature, it: ItemInst | undefined, id: string, pct: number) {
  if (!it || pct <= 0) return
  const parts = ensureArmorParts(w, c, it)
  parts[id] = Math.max(0, (parts[id] ?? it.durability ?? 100) - pct)
  averageArmorDurability(it)
}
