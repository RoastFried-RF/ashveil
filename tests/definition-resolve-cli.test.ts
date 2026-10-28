import { describe,it,expect } from 'vitest'
import { spawnSync } from 'node:child_process'
const cli=(...args:string[])=>spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tools/ashveil-defs.ts',...args],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024})
describe('읽기 전용 resolve CLI 실제 실행',()=>{
 it('선택한 실제 스크립트 패치의 최종 값과 필드 출처를 JSON으로 출력한다',()=>{const r=cli('resolve','Item.PegLeg','sample-script-prosthetic','--json');expect(r.status).toBe(0);expect(r.stderr).toBe('');const d=JSON.parse(r.stdout);expect(d.report.errors).toEqual([]);expect(d.definition.compWorker).toBe('sample-script-prosthetic:ActualLimb');expect(d.fields.find((f:{path:string})=>f.path==='/compWorker')).toMatchObject({value:'sample-script-prosthetic:ActualLimb',source:{modId:'sample-script-prosthetic',file:'patches/items.json',entry:0,sourcePath:'/value',kind:'patch'}})},30000)
 it('사람용 출력은 실제 상속값과 JSON 배열 항목·원본 경로를 구분한다',()=>{const r=cli('resolve','Terrain.KtFloor');expect(r.status).toBe(0);expect(r.stdout).toContain('필드별 출처');expect(r.stdout).toMatch(/\/passable = true ← core · defs\/terrain.json · 항목 1 · 정의 Terrain.Floor · \/passable/);expect(r.stdout).not.toContain('line ')},30000)
 it('없는 정의는 기계가 읽을 수 있는 오류와 실패 종료 코드를 제공한다',()=>{const r=cli('resolve','Item.DoesNotExist','--json');expect(r.status).toBe(1);expect(JSON.parse(r.stdout)).toMatchObject({id:'Item.DoesNotExist',error:'정의 없음: Item.DoesNotExist'})},30000)
 it('없는 선택 모드는 일부 정의가 있어도 로드 오류와 실패를 유지한다',()=>{const r=cli('resolve','Item.PegLeg','missing-mod','--json');expect(r.status).toBe(1);expect(JSON.parse(r.stdout).report.errors).toContain("선택한 모드 없음 'missing-mod'")},30000)
 it('알 수 없는 옵션과 빠진 ID는 명확한 사용법을 반환한다',()=>{for(const args of [['resolve'],['resolve','Item.PegLeg','--write']]){const r=cli(...args,'--json');expect(r.status).toBe(1);expect(JSON.parse(r.stderr).error).toContain('사용법:');expect(r.stdout).toBe('')}},30000)
})
