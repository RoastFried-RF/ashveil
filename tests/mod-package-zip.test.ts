import {afterEach,describe,it,expect} from 'vitest'
import {mkdtempSync,rmSync,readFileSync,mkdirSync,cpSync,writeFileSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
import {packageMod} from '../tools/package-mod'
import {modFromArchive} from '../src/client/mod-archive'
import {loadMods,requiredModClosure} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
const roots:string[]=[]
const temp=()=>{const path=mkdtempSync(join(tmpdir(),'ashveil-zip-package-'));roots.push(path);return path}
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})})
describe('검증한 실제 모드의 ZIP 배포',()=>{
 it('같은 원문은 같은 ZIP 바이트이며 독립 Python zipfile로 원문/CRC/시각/권한을 검증한다',()=>{
  const root=temp(),a=packageMod('sample-body-renames',{format:'zip',out:join(root,'a.zip')}),b=packageMod('sample-body-renames',{out:join(root,'b.zip')});expect(a.format).toBe('zip');expect(a.sha256).toBe(b.sha256);expect(readFileSync(a.archive)).toEqual(readFileSync(b.archive))
  const source='import zipfile,hashlib,json,sys\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n print(json.dumps([dict(path=i.filename,sha256=hashlib.sha256(z.read(i)).hexdigest(),date=list(i.date_time),permissions=(i.external_attr>>16)&511,method=i.compress_type,utf8=bool(i.flag_bits&2048)) for i in z.infolist()]))'
  const independent=spawnSync(process.env.ASHVEIL_PYTHON??(process.platform==='win32'?'python':'python3'),['-c',source,a.archive],{encoding:'utf8'});expect(independent.status,independent.stderr).toBe(0);const records=JSON.parse(independent.stdout);expect(records.map((row:{path:string;sha256:string})=>({path:row.path,sha256:row.sha256}))).toEqual(a.files);for(const row of records)expect(row).toMatchObject({date:[1980,1,1,0,0,0],permissions:0o644,method:0,utf8:true})
 })
 it('실제 ZIP을 브라우저 파서와 로더로 가져와 원문과 패키지/전체 해시를 보존한다',async()=>{
  const root=temp(),packaged=packageMod('sample-item-renames',{format:'zip',out:join(root,'item.zip')}),imported=await modFromArchive(readFileSync(packaged.archive)),packages=readPackages(),original=loadMods(packages,requiredModClosure(packages,[imported.id])),restored=loadMods(packages.filter(pkg=>pkg.manifest.id!==imported.id).concat(imported.package),requiredModClosure(packages,[imported.id]));expect(imported.format).toBe('zip');expect(restored.report.errors).toEqual([]);expect(restored.db.modManifest()).toEqual(original.db.modManifest());expect(restored.db.loadHash).toBe(original.db.loadHash);for(const file of packaged.files)expect(imported.files[file.path.slice(imported.id.length+1)]).toBe(readFileSync('mods/'+file.path,'utf8'))
 })
 it('실제 스크립트 모드도 격리 검사한 원문 그대로 ZIP에 넣는다',async()=>{const root=temp(),scriptHost=await createQuickJSScriptHost(),result=packageMod('sample-script-prosthetic',{out:join(root,'scripts.zip'),scriptHost}),imported=await modFromArchive(readFileSync(result.archive));expect(imported.package.scripts?.length).toBe(1);expect(imported.package.scripts![0].source).toBe(readFileSync('mods/sample-script-prosthetic/scripts/main.js','utf8'));expect(()=>packageMod('sample-script-prosthetic',{out:join(root,'no-vm.zip')})).toThrow('격리 실행기')})
 it('기존 ZIP/임시 파일을 덮어쓰거나 지우지 않는다',()=>{const root=temp(),out=join(root,'keep.zip');writeFileSync(out,'keep');expect(()=>packageMod('sample-body-renames',{out})).toThrow('덮어쓰지');expect(readFileSync(out,'utf8')).toBe('keep');const second=join(root,'new.zip'),other=second+'.tmp-'+process.pid;writeFileSync(other,'other');expect(()=>packageMod('sample-body-renames',{out:second})).toThrow();expect(readFileSync(other,'utf8')).toBe('other')})
 it('실제 pack CLI는 ZIP을 만들고 JSON 결과/실패 종료 코드와 출력 형식을 지킨다',()=>{const root=temp(),out=join(root,'cli.zip'),run=(...args:string[])=>spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tools/ashveil-defs.ts','pack',...args,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024}),good=run('sample-body-renames',out);expect(good.status,good.stderr).toBe(0);expect(JSON.parse(good.stdout)).toMatchObject({format:'zip',archive:out,id:'sample-body-renames'});const duplicate=run('sample-body-renames',out);expect(duplicate.status).toBe(1);expect(JSON.parse(duplicate.stderr).error).toContain('덮어쓰지');const wrong=run('sample-body-renames',join(root,'wrong.tar.gz'));expect(wrong.status).toBe(1);expect(JSON.parse(wrong.stderr).error).toContain('.zip')},30000)
 it('브라우저가 거절하는 모호한 파일 경로는 배포 도구에서도 차단한다',()=>{const root=temp();mkdirSync(join(root,'mods'),{recursive:true});if(process.platform==='win32'){expect(()=>cpSync('mods/sample-body-renames',join(root,'mods','bad:folder'),{recursive:true})).toThrow();expect(existsSync(join(root,'bad.zip'))).toBe(false)}else{cpSync('mods/sample-body-renames',join(root,'mods','bad:folder'),{recursive:true});expect(()=>packageMod('sample-body-renames',{root,out:join(root,'bad.zip')})).toThrow('상대 경로')}})
 it('타르 기본 출력은 기존 배포 바이트와 같고 새 검사가 형식을 바꾸지 않는다',()=>{const root=temp(),result=packageMod('sample-body-renames',{out:join(root,'same.tar.gz')});expect(result.format).toBe('tar.gz');expect(result.bytes).toBe(1186);expect(result.sha256).toBe('969362a709c48665d1ecd8826e5af9c8642f031bf6afbd8f4c3571825ae343f3')})
 it.each(['zip','tar.gz'] as const)('실제 격리 검증 중 원문이 바뀌면 %s 파일을 출력하지 않는다',async format=>{
  const root=temp();mkdirSync(join(root,'src/content'),{recursive:true});cpSync('src/content/core',join(root,'src/content/core'),{recursive:true});mkdirSync(join(root,'mods'));cpSync('mods/sample-script-hooks',join(root,'mods/sample-script-hooks'),{recursive:true});const entry=join(root,'mods/sample-script-hooks/scripts/main.js'),original=readFileSync(entry,'utf8'),host=await createQuickJSScriptHost(),out=join(root,'changed.'+format)
  const scriptHost={...host,inspect(source:Parameters<typeof host.inspect>[0]){const inspected=host.inspect(source);writeFileSync(entry,original+'\n// actual concurrent source change\n');return inspected}}
  expect(()=>packageMod('sample-script-hooks',{root,out,format,scriptHost})).toThrow(/검증한 원문|원본 파일이 바뀌었다/);expect(existsSync(out)).toBe(false);expect(readFileSync(entry,'utf8')).not.toBe(original)
 })
})
