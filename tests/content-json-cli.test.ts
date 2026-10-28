import {describe,it,expect,afterEach} from 'vitest'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
const roots:string[]=[],tool=resolve('tools/ashveil-defs.ts'),tsx=resolve('node_modules/tsx/dist/cli.mjs')
function fixture(){const root=mkdtempSync(join(tmpdir(),'ashveil-json-'));roots.push(root);for(const dir of ['src/content/core/defs','src/content/core/patches','mods/bad/defs'])mkdirSync(join(root,dir),{recursive:true});writeFileSync(join(root,'src/content/core/manifest.json'),'{"id":"core","name":"코어","version":"1"}');writeFileSync(join(root,'mods/bad/manifest.json'),'{"id":"bad-json","name":"오류 예제","version":"1"}');return root}
function cli(root:string,...mods:string[]){const r=spawnSync(process.execPath,[tsx,tool,'validate',...mods,'--json'],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});return{...r,json:JSON.parse(r.stdout)}}
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})})
describe('실제 Node 원문 파일을 사용하는 validate CLI',()=>{
 it('중복 키를 파일·줄·열 오류와 종료1로 보고하고 앞선 행도 부분 적용하지 않는다',()=>{const root=fixture();writeFileSync(join(root,'src/content/core/defs/test.json'),'[\n {"defType":"Trait","id":"Trait.First","label":"처음","description":"설명"},\n {"id":"A","id":"B"}\n]');const d=cli(root);expect(d.status).toBe(1);expect(d.json.definitions).toBe(0);expect(d.json.report.errors[0]).toContain('/defs/test.json:3:12: 중복 JSON 키')},30000)
 it('선택하지 않은 모드의 오류를 격리하고 실제 켰을 때 실패한다',()=>{const root=fixture();writeFileSync(join(root,'mods/bad/defs/test.json'),'[{"id":"A","id":"B"}]');expect(cli(root).json.valid).toBe(true);const d=cli(root,'bad-json');expect(d.status).toBe(1);expect(d.json.report.order).toEqual(['core','bad-json']);expect(d.json.report.errors[0]).toContain('/mods/bad/defs/test.json:1:12: 중복 JSON 키')},30000)
 it('패치 파일의 BOM을 적용 전에 보고한다',()=>{const root=fixture();writeFileSync(join(root,'src/content/core/patches/test.json'),'\ufeff[]');const d=cli(root);expect(d.status).toBe(1);expect(d.json.patchAudit.counts.applied).toBe(0);expect(d.json.report.errors[0]).toContain('/patches/test.json:1:1: UTF-8 BOM')},30000)
 it('잘못된 manifest도 처리되지 않은 예외 대신 로드 오류로 보고한다',()=>{const root=fixture();writeFileSync(join(root,'mods/bad/manifest.json'),'{"id":"A","id":"B"}');const d=cli(root,'bad');expect(d.status).toBe(1);expect(d.json.valid).toBe(false);expect(d.json.report.errors[0]).toContain('/mods/bad/manifest.json:1:11: 중복 JSON 키')},30000)
})
