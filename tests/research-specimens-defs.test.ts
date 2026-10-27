import {describe,it,expect} from 'vitest'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
function report(target:string,path:string,value:unknown){return loadMods([...readPackages(),{manifest:{id:'invalid-specimen-rules',name:'Validation fixture',version:'1'},defs:[],patches:[{op:'add',target,path,value:value as never}]}],['invalid-specimen-rules']).report}
describe('personal specimen research and finite stock content validation',()=>{
 for(const[name,dissections]of [['unknown',['BestiaryEntry.Missing']],['item',['Item.WaterBottle']],['creature',['Creature.AshHound']],['unavailable',['BestiaryEntry.Withered']],['duplicate',['BestiaryEntry.Hound','BestiaryEntry.Hound']],['shape','BestiaryEntry.Hound'],['empty',[]]]as const)it(`rejects ${name} dissection references`,()=>{
  const result=report('Knowledge.Human','/research/-',{id:'bad-specimen',label:'검사',steps:[{id:'sample',label:'검사',text:'검사',dissections}]});expect(result.errors.length).toBeGreaterThan(0)
 })
 it('accepts an actual dissection as the sole evidence source without requiring a fake field-device note',()=>{expect(report('Knowledge.Human','/research/-',{id:'sample-only',label:'검사',steps:[{id:'sample',label:'검사',text:'검사',dissections:['BestiaryEntry.Rat']}]}).errors).toEqual([])})
 for(const[name,value]of [['shape',{}],['duplicate-id',[{id:'copy',items:[{item:'Item.Cloth',count:1}]},{id:'copy',items:[{item:'Item.Cloth',count:1}]}]],['empty-items',[{id:'copy',items:[]}]],['unknown-item',[{id:'copy',items:[{item:'Item.MissingFixture',count:1}]}]],['zero',[{id:'copy',items:[{item:'Item.Cloth',count:0}]}]],['fraction',[{id:'copy',items:[{item:'Item.Cloth',count:1.5}]}]],['duplicate-item',[{id:'copy',items:[{item:'Item.Cloth',count:1},{item:'Item.Cloth',count:1}]}]]]as const)it(`rejects ${name} finite stock additions`,()=>{expect(report('Stock.shadefolk','/initialAdditions',value).errors.length).toBeGreaterThan(0)})
})
