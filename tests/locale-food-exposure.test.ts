import {afterEach,describe,expect,it} from 'vitest'
import {displayFoodExposureLines} from '../src/client/locales/food-exposure'
import {displayAirLines} from '../src/client/locales/air'
import {displayItemLabel} from '../src/client/locales/item'
import {preferences} from '../src/client/preferences'
import {consumeFor} from '../src/core/actions'
import {airLines} from '../src/core/air-state'
import {player,turnOf} from '../src/core/ctx'
import {foodExposureLines} from '../src/core/food-exposure-state'
import {addToBag,makeItem} from '../src/core/items'
import {serialize} from '../src/core/save'
import {makeWorld} from './helpers'

afterEach(()=>{preferences.language='ko'})
describe('personally learned food observations in either language',()=>{
 it('keeps the unread mechanism hidden and shows the same real burden without changing the world',()=>{
  const w=makeWorld('food-observation-language','Bg.Deserter'),c=player(w);c.bag=[];c.needs.hygiene=100;c.hands={kind:'washed',at:turnOf(w)}
  const food=makeItem(w,'Item.Ashcake');expect(addToBag(w,c,food)).toBe(0)
  preferences.language='en';expect(displayItemLabel(w,food)).toBe('Ashcake [1 use]');preferences.language='ko'
  expect(consumeFor(w,c,c,food.uid).ok).toBe(true)
  const unread=serialize(w.s)
  for(const language of ['ko','en']as const){preferences.language=language;expect(displayFoodExposureLines(w,c)).toEqual([]);expect(serialize(w.s)).toBe(unread)}
  c.booksRead=['Item.SettlementMycologyRecords'];c.literacyBooks=[...c.booksRead]
  const before=serialize(w.s)
  preferences.language='ko';expect(displayFoodExposureLines(w,c)).toEqual(foodExposureLines(w,c));expect(displayAirLines(w,c)).toEqual(airLines(w,c))
  preferences.language='en';const visible=displayFoodExposureLines(w,c).join('\n'),air=displayAirLines(w,c).join('\n')
  expect(visible).toContain('Ashcake');expect(visible).toContain('meals spaced as required 1/30');expect(visible).toContain('Next qualifying meal: after Day ')
  expect(visible).not.toContain('exposure risk ×0.7');expect(visible+air).not.toMatch(/[가-힣]/)
  expect(air).toContain('Ash lung burden from food 0.33')
  expect(serialize(w.s)).toBe(before)
  c.misreadBooks=[...c.booksRead];const misread=serialize(w.s);expect(displayFoodExposureLines(w,c)).toEqual([]);expect(serialize(w.s)).toBe(misread)
 })
})
