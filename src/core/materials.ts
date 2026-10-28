// 08 §3·7.3: 재질 슬롯의 물성. 기존 인스턴스에 재질 지정이 없으면 기존 결과값을 유지한다.
import type { World } from './ctx'
import type { ItemDef, ItemInst, MaterialDef, Stuff } from './types'

export function stuffProfile(w: World, stuff: Stuff[string]): MaterialDef {
  if (typeof stuff === 'string') return w.db.get<MaterialDef>(stuff)
  if (!stuff.length || stuff.some((p) => p.massG <= 0 || !Number.isFinite(p.massG))) throw new Error('혼합 재질의 질량은 양수여야 한다')
  const rows = stuff.map((p) => ({ m: w.db.get<MaterialDef>(p.material), mass: p.massG })), total = rows.reduce((n, p) => n + p.mass, 0)
  if (new Set(stuff.map((p) => p.material)).size === 1) return rows[0].m
  const avg = (key: 'sharpness' | 'hardness' | 'toughness' | 'insulation' | 'wetLoss' | 'corrosionResist' | 'flammability' | 'valuePerKg') => Math.floor(rows.reduce((n, p) => n + p.m[key] * p.mass, 0) / total)
  return { ...rows[0].m, id: 'Material.Mixed', label: rows.map((p) => p.m.label).join('·'), density: Math.floor(rows.reduce((n, p) => n + p.m.density * p.mass, 0) / total * 1000) / 1000, sharpness: avg('sharpness'), hardness: avg('hardness'), toughness: avg('toughness'), insulation: avg('insulation'), wetLoss: avg('wetLoss'), corrosionResist: avg('corrosionResist'), flammability: avg('flammability'), valuePerKg: avg('valuePerKg') }
}
export function materialMixPenalty(stuff?: Stuff): number {
  return Object.values(stuff ?? {}).some((s) => Array.isArray(s) && new Set(s.map((p) => p.material)).size > 1) ? -5 : 0
}
function primary(w: World, it: ItemInst) {
  const d = w.db.item(it.def), slot = d.stuffSlots?.find((s) => s.primary)
  if (!slot) { const m = d.material ? w.db.get<MaterialDef>(d.material) : undefined; return m ? { d, current: m, ref: m } : null }
  return { d, current: stuffProfile(w, it.stuff?.[slot.id] ?? slot.ref), ref: w.db.get<MaterialDef>(slot.ref) }
}
export function primaryMaterial(w: World, it: ItemInst): MaterialDef | null { return primary(w, it)?.current ?? null }
export function materialDurabilityRatio(w: World, it: ItemInst): number {
  const p = primary(w, it)
  return p && it.stuff ? p.current.toughness / p.ref.toughness : 1
}
export function materialMassG(w: World, it: ItemInst): number {
  const d = w.db.item(it.def)
  return (d.massFixedG ?? 0) + (d.stuffSlots ?? []).reduce((n, s) => {const stuff=it.stuff?.[s.id];return n+(Array.isArray(stuff)?stuff.reduce((sum,p)=>sum+p.massG,0):s.volumeCm3 * stuffProfile(w,stuff??s.ref).density)},0)
}
export function rawStock(w:World,it:ItemInst){
 const def=w.db.item(it.def),d=def.rawMaterial,grams=(def.rawFragment?it.rawGrams:d?.grams)??0,material=def.rawFragment?it.rawMaterial:d?.material
 if(!material||!Number.isSafeInteger(grams)||grams<=0)return null
 const m=w.db.tryGet<MaterialDef>(material);if(!m||m.defType!=='Material')return null
 return{material:m,unitGrams:grams,grams:grams*it.count}
}
export function structuralDurability(w: World, it: ItemInst): number | null {
  const p = primary(w, it)
  return p?.d.durabilityBase !== undefined ? Math.floor(p.d.durabilityBase * p.current.toughness / 50 + 1e-9) : null
}
const cache = new WeakMap<ItemInst, { db: World['db']; key: string; def: ItemDef }>()
export function materialItemDef(w: World, it: ItemInst): ItemDef {
  const base = w.db.item(it.def)
  if(base.rawFragment){const stock=rawStock(w,it);return stock?{...base,label:`${stock.material.label} 조각`,value:stock.material.valuePerKg*stock.unitGrams/1000}:base}
  if (!it.stuff || !base.stuffSlots?.length) return base
  const key = `${it.def}:${JSON.stringify(it.stuff)}`, found = cache.get(it)
  if (found?.db === w.db && found.key === key) return found.def
  const p = primary(w, it)
  if (!p) return base
  const { current: m, ref } = p, d = { ...base }
  if (base.attacks) d.attacks = base.attacks.map((a) => ({ ...a,
    damage: ['cut', 'stab', 'bite'].includes(a.damageType) ? Math.floor(a.damage * (m.sharpness + 50) / (ref.sharpness + 50)) : a.damageType === 'blunt' ? Math.floor(a.damage * Math.max(.7, Math.min(1.5, Math.sqrt((m.density + 1) / (ref.density + 1))))) : a.damage,
    pen: Math.max(0, a.pen + Math.floor((m.hardness - 50) / 5) - Math.floor((ref.hardness - 50) / 5)),
  }))
  if (base.apparel) {
    const ap = base.apparel, armor = ap.armor
    d.apparel = { ...ap, armor: {
      ...armor,
      sharp: Math.floor((armor.sharp ?? 0) * (m.hardness + 50) / (ref.hardness + 50)),
      blunt: Math.floor((armor.blunt ?? 0) * (m.toughness + 50) / (ref.toughness + 50)),
      heat: Math.max(0, (armor.heat ?? 0) + (m.insulation - ref.insulation) * 2),
    }, insulation: Math.max(0, ap.insulation + m.insulation - ref.insulation), wetLoss: m.wetLoss,
    durability: Math.max(1, Math.floor(ap.durability * m.toughness / ref.toughness)),
    waterproofPct: m.wetLoss === 0 && m.category === 'Fabric' ? 90 : ap.waterproofPct }
  }
  cache.set(it, { db: w.db, key, def: d })
  return d
}
