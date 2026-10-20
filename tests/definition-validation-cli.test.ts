import {describe,it,expect} from 'vitest'
import {spawnSync} from 'node:child_process'
const cli=(...args:string[])=>spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tools/ashveil-defs.ts','validate',...args],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024})
describe('실제 validate CLI',()=>{
 it('코어의 실제 패치 미리보기·집계와 성공 종료를 JSON으로 제공한다',()=>{const r=cli('--json');expect(r.status).toBe(0);const d=JSON.parse(r.stdout);expect(d.valid).toBe(true);expect(d.report.errors).toEqual([]);expect(d.patchAudit.counts.applied).toBe(290);expect(d.patchAudit.counts.failed).toBe(0);expect(d.patchAudit.patches).toHaveLength(290);expect(d.definitions).toBe(866);expect(d.byType.Item).toBe(197);expect(d.scriptValidation.attempted).toBe(false)},30000)
 it('선택한 실제 스크립트는 격리 실행기 등록까지 검사한다',()=>{const r=cli('sample-script-prosthetic','--json');expect(r.status).toBe(0);const d=JSON.parse(r.stdout);expect(d.scriptValidation.attempted).toBe(true);expect(d.scriptValidation.modules).toHaveLength(1);expect(d.scriptValidation.modules[0]).toMatchObject({modId:'sample-script-prosthetic'});expect(d.patchAudit.counts.applied).toBe(295)},30000)
 it('누락 선택 모드의 구조화 오류와 실패 종료를 유지한다',()=>{const r=cli('missing-mod','--json');expect(r.status).toBe(1);const d=JSON.parse(r.stdout);expect(d.valid).toBe(false);expect(d.report.errors).toContain("선택한 모드 없음 'missing-mod'");expect(d.scriptValidation.attempted).toBe(false)},30000)
 it('사람용 출력도 실제 원본 항목과 미리보기임을 알린다',()=>{const r=cli();expect(r.status).toBe(0);expect(r.stdout).toMatch(/패치 미리보기: 적용 290/);expect(r.stdout).toContain('실제 원시값 차이');expect(r.stdout).toContain('검증 통과')},30000)
})
