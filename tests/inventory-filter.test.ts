import {expect,it} from 'vitest'
import {inventoryMatches,inventorySearchKey} from '../src/client/inventory-filter'
import {makeItem} from '../src/core/items'
import {serialize,stateHash} from '../src/core/save'
import {makeWorld} from './helpers'

it('finds Korean names regardless of spaces and full-width forms without changing the world',()=>{
 const w=makeWorld('inventory-filter'),bag=makeItem(w,'Item.MedicalBag'),before=serialize(w.s),hash=stateHash(w.s)
 for(const q of ['의료가방',' 의 료 가 방 ','의료\t가방'])expect(inventoryMatches(w,bag,'all',q),q).toBe(true)
 expect(inventorySearchKey(' ＡＢＣ １２ ')).toBe('abc12')
 expect(inventoryMatches(w,bag,'all','없는이름')).toBe(false)
 expect(serialize(w.s)).toBe(before);expect(stateHash(w.s)).toBe(hash)
})
it('includes actual clinical tools and recipe inputs with overlapping useful categories',()=>{
 const w=makeWorld('inventory-categories')
 for(const id of ['Item.Thread','Item.Needle','Item.Moonshine','Item.Bandage','Item.MedicalBag'])expect(inventoryMatches(w,makeItem(w,id),'medical',''),id).toBe(true)
 for(const id of ['Item.Thread','Item.Charcoal','Item.CrawlerPlate','Item.CullerScytheBlade'])expect(inventoryMatches(w,makeItem(w,id),'material',''),id).toBe(true)
 expect(inventoryMatches(w,makeItem(w,'Item.Moonshine'),'food','')).toBe(true)
 expect(inventoryMatches(w,makeItem(w,'Item.SealRing'),'medical','')).toBe(false)
 expect(inventoryMatches(w,makeItem(w,'Item.SealRing'),'material','')).toBe(false)
})
