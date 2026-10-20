import {afterEach,describe,it,expect} from 'vitest'
import {mkdtempSync,rmSync,readFileSync,mkdirSync,writeFileSync,cpSync,symlinkSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
import {gunzipSync} from 'node:zlib'
import {packageMod} from '../tools/package-mod'
const roots:string[]=[]
const temp=()=>{const p=mkdtempSync(join(tmpdir(),'ashveil-mod-package-'));roots.push(p);return p}
afterEach(()=>{for(const p of roots.splice(0))rmSync(p,{recursive:true,force:true})})
describe('검증한 JSON 모드의 로컬 배포 파일',()=>{
 it('같은 입력은 바이트가 같은 배포 파일이며 실제 상대 경로/원본 JSON을 보존한다',()=>{
  const p=temp(),a=packageMod('sample-patrol-contract',{out:join(p,'a.tar.gz')}),b=packageMod('sample-patrol-contract',{out:join(p,'b.tar.gz')});expect(a.sha256).toBe(b.sha256);expect(readFileSync(a.archive)).toEqual(readFileSync(b.archive));expect(a.loadedMods).toEqual(['core','sample-patrol-contract']);expect(a.files.map(f=>f.path)).toContain('sample-patrol-contract/manifest.json')
  const tar=gunzipSync(readFileSync(a.archive)),list=spawnSync('tar',['-tf','-'],{input:tar,encoding:'utf8'});expect(list.status).toBe(0);expect(list.stdout.trim().split('\n')).toEqual(a.files.map(f=>f.path));const body=spawnSync('tar',['-xOf','-','sample-patrol-contract/patches/ledger.json'],{input:tar});expect(body.stdout).toEqual(readFileSync('mods/sample-patrol-contract/patches/ledger.json'))
 })
 it('기존 파일은 원본 그대로 두고 덮어쓰기를 거절한다',()=>{const p=join(temp(),'archive.tar.gz');writeFileSync(p,'keep');expect(()=>packageMod('sample-patrol-contract',{out:p})).toThrow('덮어쓰지 않는다');expect(readFileSync(p,'utf8')).toBe('keep')})
 it.each(['core','../core','missing-mod'])('없는 모드/경로 탈출을 거절한다 (%s)',id=>{expect(()=>packageMod(id,{out:join(temp(),'a.tar.gz')})).toThrow()})
 it('심볼릭 링크나 지원하지 않는 실행 파일은 배포하지 않는다',()=>{
  const root=temp();mkdirSync(join(root,'mods'));cpSync('mods/sample-patrol-contract',join(root,'mods/sample-patrol-contract'),{recursive:true});symlinkSync('/etc/hosts',join(root,'mods/sample-patrol-contract/patches/outside.json'));expect(()=>packageMod('sample-patrol-contract',{root,out:join(root,'a.tar.gz')})).toThrow('심볼릭 링크');rmSync(join(root,'mods/sample-patrol-contract/patches/outside.json'));writeFileSync(join(root,'mods/sample-patrol-contract/run.js'),'throw Error()');expect(()=>packageMod('sample-patrol-contract',{root,out:join(root,'b.tar.gz')})).toThrow('지원하지 않는 파일')
 })
 it('잘못된 실제 Def 패치는 출력 전에 로더에서 거절한다',()=>{
  const root=temp();mkdirSync(join(root,'src/content'),{recursive:true});cpSync('src/content/core',join(root,'src/content/core'),{recursive:true});mkdirSync(join(root,'mods'));cpSync('mods/sample-patrol-contract',join(root,'mods/sample-patrol-contract'),{recursive:true});writeFileSync(join(root,'mods/sample-patrol-contract/patches/ledger.json'),JSON.stringify([{op:'replace',target:'PatrolContract.Hearth',path:'/wealthMult',value:100}]));expect(()=>packageMod('sample-patrol-contract',{root,out:join(root,'a.tar.gz')})).toThrow('모드 로더 검증 실패')
 })
 it('실제 필수 객체 의존성을 함께 검증하되 대상 모드 파일만 포장한다',()=>{const root=temp();mkdirSync(join(root,'src/content'),{recursive:true});cpSync('src/content/core',join(root,'src/content/core'),{recursive:true});for(const id of ['version-parent','version-consumer'])mkdirSync(join(root,'mods',id,'defs'),{recursive:true});writeFileSync(join(root,'mods/version-parent/manifest.json'),JSON.stringify({id:'version-parent',name:'원형',version:'1.2.3',dependencies:['core']}));writeFileSync(join(root,'mods/version-parent/defs/terrain.json'),JSON.stringify([{defType:'Terrain',id:'Test.PackageParent',parent:'Terrain.Floor',label:'원형'}]));const manifest={id:'version-consumer',name:'자식',version:'1.0.0',gameVersion:'>=0.1.0 <0.2.0',dependencies:[{id:'version-parent',version:'^1.0.0'}]};writeFileSync(join(root,'mods/version-consumer/manifest.json'),JSON.stringify(manifest));writeFileSync(join(root,'mods/version-consumer/defs/terrain.json'),JSON.stringify([{defType:'Terrain',id:'Test.PackageChild',parent:'Test.PackageParent',label:'자식'}]));const result=packageMod('version-consumer',{root,out:join(root,'a.tar.gz')});expect(result.loadedMods).toEqual(['core','version-parent','version-consumer']);expect(result.files.every(f=>f.path.startsWith('version-consumer/'))).toBe(true);manifest.dependencies[0]!.version='^2.0.0';writeFileSync(join(root,'mods/version-consumer/manifest.json'),JSON.stringify(manifest));expect(()=>packageMod('version-consumer',{root,out:join(root,'rejected.tar.gz')})).toThrow('요구 범위')})
 it('실제 rename 원문을 대상 모드의 배포 파일에 그대로 포함한다',()=>{const result=packageMod('sample-item-renames',{out:join(temp(),'rename.tar.gz')}),rel='sample-item-renames/migrations/rename.json';expect(result.files.map(f=>f.path)).toContain(rel);const body=spawnSync('tar',['-xOf','-',rel],{input:gunzipSync(readFileSync(result.archive))});expect(body.status).toBe(0);expect(body.stdout).toEqual(readFileSync('mods/'+rel))})
 it('소유하지 않은 기존 임시 파일도 삭제하거나 덮어쓰지 않는다',()=>{const p=join(temp(),'archive.tar.gz'),other=p+'.tmp-'+process.pid;writeFileSync(other,'keep temporary');expect(()=>packageMod('sample-patrol-contract',{out:p})).toThrow();expect(readFileSync(other,'utf8')).toBe('keep temporary')})

})
