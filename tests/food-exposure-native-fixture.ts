import {turnOf} from '../src/core/ctx'
import {runUntilInput} from '../src/core/game'
import {boiledMealNativeFixture} from './boiled-meal-fixture'

/** Declared finite initial scene, built before Title; no acquisition or past course claimed. */
export async function foodExposureNativeFixture(){
 const d=await boiledMealNativeFixture(),ash=d.add('Item.TowerAsh',2),book=d.add('Item.SettlementMycologyRecords')
 d.s.saveMode='SaveMode.Study'
 d.p.literacy=2;d.p.literate=true;d.p.booksRead=[];d.p.literacyBooks=[];d.p.misreadBooks=[]
 d.p.needs.kcal=2500;d.p.needs.vitamin=100;d.p.hands={kind:'washed',at:turnOf(d.w)}
 runUntilInput(d.w)
 return {...d,ash,book,recipe:'Recipe.Ashcake'}
}
