import {describe,it,expect}from'vitest'
import {ashCakeCraftFixture}from'./ash-cake-fixture'
import {deserialize,serialize}from'../src/core/save'

/** Equivalent standard JSON syntax, including a status stored as a string value. */
function escaped(raw:string){
 return raw.replace(/"([^"\\]+)":/g,(_,key:string)=>'"\\u'+key.charCodeAt(0).toString(16).padStart(4,'0')+key.slice(1)+'":').replaceAll('"netted"','"n\\u0065tted"')
}
describe('decoded save validation',()=>{
 it('roundtrips valid original data when all JSON keys use escaped spelling',()=>{
  const raw=serialize(ashCakeCraftFixture().s),encoded=escaped(raw)
  expect(encoded).not.toBe(raw);expect(JSON.parse(encoded)).toEqual(JSON.parse(raw));expect(serialize(deserialize(encoded))).toBe(raw)
 })
 const cases=[
  {name:'companion care plan',field:'carePlan',value:{},error:/동료 처치 순서/},
  {name:'crawler posture',field:'crawlerState',value:{},error:/지네/},
  {name:'original toxin coating',field:'loadedAmmoToxin',value:{},error:/독샘/},
  {name:'culler component ledger',field:'cullerState',value:{},error:/구제기/},
  {name:'netted effect source',field:'netted',value:{kind:'netted',magnitude:1,untilTurn:100,sourceUid:0,sourceId:1,sourceDef:'Item.SnareNet'},error:/포획망/},
 ]
 it.each(cases)('rejects an invalid $name independently of JSON spelling',({field,value,error})=>{
  const d=ashCakeCraftFixture(),s=JSON.parse(serialize(d.s)),p=s.creatures.find((c:{id:number})=>c.id===s.playerId)
  if(field==='loadedAmmoToxin')p.bag[0].loadedAmmoToxin=value
  else if(field==='carePlan')p.companion={...p.companion,carePlan:value}
  else if(field==='netted')p.effects.push(value)
  else p[field]=value
  const raw=JSON.stringify(s),encoded=escaped(raw);expect(JSON.parse(encoded)).toEqual(s)
  expect(()=>deserialize(raw)).toThrow(error);expect(()=>deserialize(encoded)).toThrow(error)
 })
})
