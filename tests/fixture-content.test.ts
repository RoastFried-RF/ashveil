import{describe,it,expect}from'vitest'
import{db}from'./helpers'
import{beddingFireNativeFixture}from'./bedding-fire-fixture'
import{beddingLiceNativeFixture}from'./bedding-lice-fixture'
import{waterVesselsNativeFixture}from'./water-vessels-fixture'
import{clinicalDiseaseFixture}from'./clinical-diseases-fixture'
import{hpMax}from'../src/core/body'
import{runUntilInput}from'../src/core/game'
import{deserialize,serialize}from'../src/core/save'
import type{World}from'../src/core/ctx'
describe('실제 기본 콘텐츠 검증 장면의 원래 설정과 유효 초기 상태',()=>{
 it.each([['침구 화재',beddingFireNativeFixture],['침구 접촉',beddingLiceNativeFixture],['물 용기',waterVesselsNativeFixture]]as const)('%s 화면 장면은 검사 전용 확률 모드를 끼우지 않는다',async(_,fixture)=>{const d=await fixture(false);expect(d.w.db).toBe(db)})
 it('초기 시계를 낮으로 정한 검사에서 미래 관찰이나 현재 최대치 초과 체력을 주장하지 않는다',()=>{const d=clinicalDiseaseFixture();expect(d.s.map.tiles.every(t=>!t.observed||t.observed.at<=d.s.time/100)).toBe(true);expect(d.p.hp).toBe(hpMax(d.w,d.p))})
 it('기본 콘텐츠의 원래 침구 화재도 실제200턴 발화와20턴 뒤 실제 화상을 전체 복원한다',async()=>{const d=await beddingFireNativeFixture(true),copy:World={db:d.w.db,s:deserialize(serialize(d.s))};expect(d.w.db).toBe(db);expect(d.bed.beddingFire!.startedAt).toBe(14600);runUntilInput(d.w);runUntilInput(copy);expect(d.s.time).toBe(1462000);expect(d.p.body.wounds.some(w=>w.def==='Wound.Burn')).toBe(true);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))})
})
