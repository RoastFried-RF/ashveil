import {afterEach,describe,it,expect} from 'vitest'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {gzipSync,gunzipSync} from 'node:zlib'
import {packageMod} from '../tools/package-mod'
import {modFromArchive,modFromFiles} from '../src/client/mod-archive'
import {loadMods,requiredModClosure} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {importedFiles,zipFixture} from './mod-archive-fixture'
const roots:string[]=[]
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})})
describe('브라우저 콘텐츠 모드 파일 가져오기',()=>{
 it('실제 CLI tar.gz의 원문·패키지 해시·적용 결과를 동일하게 읽는다',async()=>{
  const root=mkdtempSync(join(tmpdir(),'ashveil-import-'));roots.push(root);const packaged=packageMod('sample-item-renames',{out:join(root,'mod.tar.gz')}),imported=await modFromArchive(readFileSync(packaged.archive)),packages=readPackages(),original=loadMods(packages,requiredModClosure(packages,[imported.id])),restored=loadMods(packages.filter(p=>p.manifest.id!==imported.id).concat(imported.package),requiredModClosure(packages,[imported.id]))
  expect(imported.format).toBe('tar.gz');expect(restored.report.errors).toEqual([]);expect(restored.db.modManifest()).toEqual(original.db.modManifest());expect(restored.db.loadHash).toBe(original.db.loadHash);expect(imported.files['migrations/rename.json']).toBe(readFileSync('mods/sample-item-renames/migrations/rename.json','utf8'))
 })
 it.each([[0,false],[8,false],[8,true]] as const)('표준 ZIP 압축 %i/데이터 기록 %s를 같은 폴더 원문으로 읽는다',async(method,descriptor)=>{const expected=modFromFiles(importedFiles()),actual=await modFromArchive(zipFixture(importedFiles(),method,descriptor));expect(actual.files).toEqual(expected.files);expect(actual.package).toEqual(expected.package);expect(actual.bytes).toBe(expected.bytes)})
 it.each(['../outside.json','/absolute.json','local-floor/../outside.json','local-floor\\defs\\a.json','C:/a.json','local-floor//a.json'])('경로 탈출/모호한 경로를 거절한다: %s',path=>{expect(()=>modFromFiles([...importedFiles(),{path,bytes:Buffer.from('{}')}])).toThrow('경로')})
 it('중복 파일과 여러 모드와 폴더 밖의 파일을 거절한다',()=>{const f=importedFiles();expect(()=>modFromFiles([...f,f[0]])).toThrow('중복');expect(()=>modFromFiles([...f,...importedFiles('second')])).toThrow('하나의');expect(()=>modFromFiles([...f,{path:'outside.json',bytes:Buffer.from('{}')}])).toThrow('폴더 밖')})
 it('core 교체, 실행 파일, 선언하지 않은 스크립트를 거절한다',()=>{expect(()=>modFromFiles(importedFiles('core'))).toThrow('core');for(const path of ['local-floor/run.exe','local-floor/scripts/main.js'])expect(()=>modFromFiles([...importedFiles(),{path,bytes:Buffer.from('hello')}])).toThrow('지원하지 않는')})
 it('UTF-8 BOM과 중복 JSON 키를 실제 엄격한 파서에 보존한다',()=>{const f=importedFiles();f[0].bytes=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),f[0].bytes]);expect(()=>modFromFiles(f)).toThrow('BOM');f[0].bytes=Buffer.from('{"id":"local-floor","id":"other"}');expect(()=>modFromFiles(f)).toThrow('중복 JSON 키')})
 it('손상된 ZIP CRC와 로컬/중앙 경로 불일치를 거절한다',async()=>{const bytes=zipFixture(importedFiles(),0),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);bytes[30+view.getUint16(26,true)]^=1;await expect(modFromArchive(bytes)).rejects.toThrow('CRC32');const other=zipFixture(importedFiles());other[30]^=1;await expect(modFromArchive(other)).rejects.toThrow('경로')})
 it('ZIP 심볼릭 링크, 암호화, 중복 파일을 거절한다',async()=>{const bytes=zipFixture(importedFiles()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),central=view.getUint32(bytes.length-6,true);view.setUint32(central+38,(0o120777<<16)>>>0,true);await expect(modFromArchive(bytes)).rejects.toThrow('특수 파일');const encrypted=zipFixture(importedFiles());new DataView(encrypted.buffer,encrypted.byteOffset).setUint16(6,1,true);await expect(modFromArchive(encrypted)).rejects.toThrow();await expect(modFromArchive(zipFixture([...importedFiles(),importedFiles()[0]]))).rejects.toThrow('중복')})
 it('압축 폭탄과 파일 수 초과를 압축 해제 중/원문 구성 전에 차단한다',async()=>{const large=[...importedFiles(),{path:'local-floor/README.md',bytes:Buffer.alloc(8*1024*1024,65)}];await expect(modFromArchive(zipFixture(large))).rejects.toThrow('8MiB');await expect(modFromArchive(gzipSync(Buffer.alloc(10*1024*1024)))).rejects.toThrow('크기 제한');expect(()=>modFromFiles(Array.from({length:513},(_,i)=>({path:'x/'+i,bytes:Buffer.alloc(0)})))).toThrow('512')})
 it('잘린 ZIP과 tar 헤더 손상/링크를 거절한다',async()=>{const zip=zipFixture(importedFiles());await expect(modFromArchive(zip.slice(0,-1))).rejects.toThrow();const root=mkdtempSync(join(tmpdir(),'ashveil-import-'));roots.push(root);const packaged=packageMod('sample-item-renames',{out:join(root,'mod.tar.gz')}),tar=gunzipSync(readFileSync(packaged.archive));tar[0]^=1;await expect(modFromArchive(gzipSync(tar))).rejects.toThrow('체크섬');tar[0]^=1;tar[156]=50;tar.fill(32,148,156);let sum=0;for(let i=0;i<512;i++)sum+=tar[i];tar.write(sum.toString(8).padStart(6,'0')+'\0 ',148,'ascii');await expect(modFromArchive(gzipSync(tar))).rejects.toThrow('링크')})
})
