import {beforeAll,afterEach,describe,it,expect} from 'vitest'
import {mkdtempSync,rmSync,readFileSync,mkdirSync,writeFileSync,cpSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {gunzipSync} from 'node:zlib'
import {spawnSync} from 'node:child_process'
import {packageMod} from '../tools/package-mod'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import type {ScriptHost} from '../src/core/script-contracts'
let host:ScriptHost
const roots:string[]=[]
const temp=()=>{const p=mkdtempSync(join(tmpdir(),'ashveil-script-package-'));roots.push(p);return p}
beforeAll(async()=>{host=await createQuickJSScriptHost()})
afterEach(()=>{for(const p of roots.splice(0))rmSync(p,{recursive:true,force:true})})
describe('격리 검사한 스크립트 모드의 로컬 배포',()=>{
 it('실제 JS진입 파일을 결정적 아카이브에 그대로 보관한다',()=>{const root=temp(),a=packageMod('sample-script-hooks',{out:join(root,'a.tar.gz'),scriptHost:host}),b=packageMod('sample-script-hooks',{out:join(root,'b.tar.gz'),scriptHost:host});expect(a.sha256).toBe(b.sha256);const result=spawnSync('tar',['-xOf','-','sample-script-hooks/scripts/main.js'],{input:gunzipSync(readFileSync(a.archive))});expect(result.status).toBe(0);expect(result.stdout).toEqual(readFileSync('mods/sample-script-hooks/scripts/main.js'));expect(a.loadedMods).toEqual(['core','sample-script-hooks'])})
 it('실행기 검사를 생략한 스크립트 패키지는 출력하지 않는다',()=>{const out=join(temp(),'bad.tar.gz');expect(()=>packageMod('sample-script-hooks',{out})).toThrow('격리 실행기');expect(existsSync(out)).toBe(false)})
 it('잘못된 스크립트 소스는 원본을 보존하고 출력 전에 거절한다',()=>{const root=temp();mkdirSync(join(root,'src/content'),{recursive:true});cpSync('src/content/core',join(root,'src/content/core'),{recursive:true});mkdirSync(join(root,'mods'));cpSync('mods/sample-script-hooks',join(root,'mods/sample-script-hooks'),{recursive:true});const entry=join(root,'mods/sample-script-hooks/scripts/main.js'),out=join(root,'bad.tar.gz');writeFileSync(entry,'while(true){};export default defineMod({hooks:{}})');expect(()=>packageMod('sample-script-hooks',{root,out,scriptHost:host})).toThrow('연산 예산');expect(existsSync(out)).toBe(false);expect(readFileSync(entry,'utf8')).toContain('while(true)')})
})
