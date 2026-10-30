// 로더와 선택적인 격리 실행기로 검증한 콘텐츠를 로컬 배포 파일로 묶는다.
import {createHash} from 'node:crypto'
import {closeSync,existsSync,lstatSync,mkdirSync,openSync,readFileSync,readdirSync,realpathSync,linkSync,unlinkSync,writeFileSync} from 'node:fs'
import {dirname,join,relative,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {gzipSync} from 'node:zlib'
import {spawnSync} from 'node:child_process'
import {zipContent} from './zip-content'
import {encodeModFile} from '../src/core/mod-textures'
import {readPackages} from './loadContent'
import{validModDependency,requiredModClosure,loadMods,packagesFromFiles}from'../src/core/defs'
import {MOD_PACKAGE_BYTES,MOD_PACKAGE_FILES,supportedModFile,validInstallableModId,safeModFilePath} from '../src/core/mod-package-files'
import {configureScriptHost} from '../src/core/script-hooks'
import type {ScriptHost} from '../src/core/script-contracts'
export function packageMod(id:string,options:{root?:string;out?:string;scriptHost?:ScriptHost;format?:'zip'|'tar.gz'}={}){
 const root=realpathSync(resolve(options.root??process.cwd())),mods=join(root,'mods')
 if(!validInstallableModId(id))throw Error('mods 안에 있는 실제 모드 id를 지정해야 한다')
 function rejectLinks(path:string){const stat=lstatSync(path);if(stat.isSymbolicLink())throw Error('패키지 검사 경로에 심볼릭 링크를 넣을 수 없다: '+relative(root,path));if(stat.isDirectory())for(const name of readdirSync(path))rejectLinks(join(path,name))}
 rejectLinks(mods);if(existsSync(join(root,'src/content')))rejectLinks(join(root,'src/content'))
 const folders=readdirSync(mods).filter(name=>{const p=join(mods,name);return!lstatSync(p).isSymbolicLink()&&lstatSync(p).isDirectory()&&existsSync(join(p,'manifest.json'))}).filter(name=>JSON.parse(readFileSync(join(mods,name,'manifest.json'),'utf8')).id===id)
 if(folders.length!==1)throw Error('실제 모드 manifest id가 없거나 중복되었다: '+id)
 const folder=folders[0]!,source=join(mods,folder),files:string[]=[],metadata=JSON.parse(readFileSync(join(source,'manifest.json'),'utf8'))
 function walk(dir:string){for(const name of readdirSync(dir).sort()){
  const file=join(dir,name),stat=lstatSync(file),rel=relative(source,file)
  if(!safeModFilePath([folder,...rel.split(sep)].join('/')))throw Error('안전한 콘텐츠 상대 경로가 아니다: '+rel)
  if(stat.isSymbolicLink())throw Error('패키지에 심볼릭 링크를 넣을 수 없다: '+rel)
  if(!realpathSync(file).startsWith(realpathSync(source)+sep))throw Error('모드 폴더 밖의 파일이다: '+rel)
  if(stat.isDirectory()){if(!['defs','patches','migrations','textures',...([1,2].includes(metadata.scripts?.stage)?['scripts']:[])].includes(rel.split(sep)[0]!))throw Error('지원하지 않는 콘텐츠 폴더다: '+rel);walk(file)}
  else if(stat.isFile()){
   if(!supportedModFile(rel.split(sep).join('/'),metadata))throw Error('현재 콘텐츠 패키지에서 지원하지 않는 파일이다: '+rel)
   files.push([folder,...rel.split(sep)].join('/'))
  }else throw Error('일반 파일이 아니다: '+rel)
 }}
 walk(source)
 const total=files.reduce((n,p)=>n+lstatSync(join(mods,p)).size,0);if(total>MOD_PACKAGE_BYTES||files.length>MOD_PACKAGE_FILES)throw Error('콘텐츠 패키지는 8MiB/512파일 이하여야 한다')
 const contents=files.map(path=>({path,bytes:readFileSync(join(mods,path))})),fileHashes=contents.map(({path,bytes})=>({path,sha256:createHash('sha256').update(bytes).digest('hex')}))
 if(typeof metadata.name!=='string'||!metadata.name.trim()||typeof metadata.version!=='string'||!metadata.version.trim()||['dependencies','optionalDependencies','loadAfter','loadBefore','incompatibleWith'].some(k=>metadata[k]!==undefined&&(!Array.isArray(metadata[k])||metadata[k].some((v:unknown)=>k==='dependencies'||k==='optionalDependencies'?!validModDependency(v):typeof v!=='string'||!v))))throw Error('manifest의 이름/버전/의존 목록을 확인해야 한다')
 const packages=readPackages(root).filter(pkg=>pkg.manifest.id!==id),target=packagesFromFiles(Object.fromEntries(contents.map(({path,bytes})=>['mods/'+path,encodeModFile(path.split('/').slice(1).join('/'),bytes)])));packages.push(...target)
 const{db,report}=loadMods(packages,requiredModClosure(packages,[id]));if(report.errors.length)throw Error('모드 로더 검증 실패:\n'+report.errors.join('\n'))
 if(db.scriptSources.length){if(!options.scriptHost)throw Error('스크립트 패키지에는 격리 실행기 검사가 필요하다');const errors=configureScriptHost(db,options.scriptHost);if(errors.length)throw Error('스크립트 검사 실패:\n'+errors.join('\n'))}
 const manifest=target[0].manifest,version=String(manifest.version).replace(/[^0-9A-Za-z.+_-]/g,'_'),format=options.format??(options.out?.endsWith('.zip')?'zip':'tar.gz'),out=resolve(options.out??join(root,'test-results/mod-packages',id+'-'+version+'.'+format))
 if(!['zip','tar.gz'].includes(format))throw Error('ZIP 또는 tar.gz 형식이 필요하다')
 if(existsSync(out))throw Error('이미 있는 배포 파일을 덮어쓰지 않는다: '+out)
 if(out.startsWith(source+sep))throw Error('배포 파일은 원본 모드 폴더 밖에 만들어야 한다')
 let archive:Buffer
 if(format==='zip'){archive=zipContent(contents.map(({path,bytes})=>({path:path.split(sep).join('/'),bytes})));if(archive.length>MOD_PACKAGE_BYTES)throw Error('ZIP 배포 파일은 8MiB 이하여야 한다')}
 else{
 const packed=spawnSync('tar',['--format=ustar','--mtime=@0','--owner=0','--group=0','--numeric-owner','--mode=0644','-cf','-','-C',mods.replaceAll('\\','/'),'--',...files],{maxBuffer:16*1024*1024,env:{...process.env,LC_ALL:'C'}})
 if(packed.error||packed.status!==0)throw Error('배포 파일을 만들지 못했다: '+(packed.error?.message??packed.stderr.toString()))
 const listed=spawnSync('tar',['--quoting-style=literal','-tf','-'],{input:packed.stdout,maxBuffer:1024*1024,env:{...process.env,LC_ALL:'C'}}),kinds=spawnSync('tar',['--quoting-style=literal','-tvf','-'],{input:packed.stdout,maxBuffer:1024*1024,env:{...process.env,LC_ALL:'C'}})
 if(listed.error||listed.status!==0||listed.stdout.toString('utf8')!==files.map(path=>path.split(sep).join('/')).join('\n')+'\n'||kinds.error||kinds.status!==0||kinds.stdout.toString('utf8').trimEnd().split('\n').some(line=>!line.startsWith('-')))throw Error('검증한 일반 파일 목록과 실제 tar 배포 기록이 다르다')
 const extracted=spawnSync('tar',['-xOf','-','--',...files],{input:packed.stdout,maxBuffer:16*1024*1024,env:{...process.env,LC_ALL:'C'}})
 if(extracted.error||extracted.status!==0||!extracted.stdout.equals(Buffer.concat(contents.map(file=>file.bytes))))throw Error('검증한 원문과 실제 tar 배포 내용이 다르다')
 archive=gzipSync(packed.stdout,{level:9});archive[9]=3 // Canonical gzip OS byte: preserve the established Unix archive hash on Windows too.
 }
 if(fileHashes.some(f=>createHash('sha256').update(readFileSync(join(mods,f.path))).digest('hex')!==f.sha256))throw Error('검사 중 원본 파일이 바뀌었다. 다시 배포 파일을 만들어야 한다')
 const temp=out+'.tmp-'+process.pid
 mkdirSync(dirname(out),{recursive:true});let fd:number|undefined,ownsTemp=false
 try{fd=openSync(temp,'wx');ownsTemp=true;writeFileSync(fd,archive);closeSync(fd);fd=undefined;linkSync(temp,out)}finally{if(fd!==undefined)closeSync(fd);if(ownsTemp&&existsSync(temp))unlinkSync(temp)}
 return{id,version:manifest.version,format,archive:out,bytes:archive.length,sha256:createHash('sha256').update(archive).digest('hex'),loadedMods:db.loadedMods,patches:report.patched,warnings:report.warnings,files:fileHashes}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(!process.argv[2]||process.argv.length>4)throw Error('사용법: pnpm mod:package <모드id> [배포파일.tar.gz|배포파일.zip]');const{createQuickJSScriptHost}=await import('../src/scripting/quickjs');const scriptHost=await createQuickJSScriptHost();console.log(JSON.stringify(packageMod(process.argv[2],{out:process.argv[3],scriptHost}),null,2))}catch(error){console.error((error as Error).message);process.exitCode=1}
}
