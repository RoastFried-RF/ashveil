import{describe,it,expect}from'vitest'
import{fmtClock}from'../src/core/ctx'
import{retirementDef,retirementQuote}from'../src/core/retirement'
import{serialize}from'../src/core/save'
import{displayCampClock,translateRetirementIssue,translateRetirementLabel}from'../src/client/locales/resident-camp'
import{translate}from'../src/client/locales/message'
import{retirementFixture}from'./retirement-fixture'

describe('resident services display preserves quotes and saved text',()=>{
 it('formats the actual housing requirement without changing the original world or person',()=>{
  const{w,s,p,keeper}=retirementFixture(),before=serialize(s),name=keeper.name,q=retirementQuote(w,p,keeper),context={minHousingDays:retirementDef(w).minHousingDays,savings:q.savings}
  expect(q.error).toBe(`이 여관의 실제 침대를 앞으로${context.minHousingDays}일 이상 빌려야 한다`)
  expect(translateRetirementIssue(q.error,context,'en')).toBe(`Rent an actual bed at this inn for at least ${context.minHousingDays} more days`)
  expect(translateRetirementIssue(q.error,context,'ko')).toBe(q.error)
  expect(keeper.name).toBe(name);expect(serialize(s)).toBe(before)
 })
 it('requires exact actual quote amounts and retirement kind/source, preserving foreign text literally',()=>{
  const context={minHousingDays:30,savings:2000},source='앞으로의 생활비2000전이 부족하다'
  expect(translateRetirementIssue(source,context,'en')).toContain('2000 coins required')
  expect(translateRetirementIssue(source,{...context,savings:2001},'en')).toBe(source)
  expect(translateRetirementIssue('이 여관의 실제 침대를 앞으로31일 이상 빌려야 한다',context,'en')).toContain('31일')
  expect(translateRetirementLabel('peaceful','평온한 은퇴','en')).toBe('Peaceful retirement')
  expect(translateRetirementLabel('legend','평온한 은퇴','en')).toBe('평온한 은퇴')
  const foreign='원래 {0} $& 기록';expect(translateRetirementIssue(foreign,context,'en')).toBe(foreign);expect(translateRetirementLabel('peaceful',foreign,'en')).toBe(foreign)
 })
 it('uses the same Core clock on both sides of midnight',()=>{
  for(const turn of[0,28799,28800,600001])expect(displayCampClock(turn,'ko')).toBe(fmtClock(turn))
  expect(displayCampClock(28799,'en')).toBe('Day 1 23:59');expect(displayCampClock(28800,'en')).toBe('Day 2 00:00')
 })
 it('uses singular only for one numeric use and keeps quantity values literal',()=>{
  expect(translate(' [{0}회]','en',1)).toBe(' [1 use]');expect(translate(' [{0}회]','en',2)).toBe(' [2 uses]');expect(translate(' [{0}회]','ko',1)).toBe(' [1회]')
  expect(translate(' [{0}회]','en','1 {0} $&')).toBe(' [1 {0} $& uses]')
  expect(translate('남은 음식 {0}/{1}회분 · 다 먹으면 같은 빈 용기가 남는다','en',1,1)).toBe('Servings remaining: 1/1 · leaves the same empty container when finished')
 })
})
