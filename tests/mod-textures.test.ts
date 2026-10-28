import {describe,it,expect,vi} from 'vitest'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {crc32} from 'node:zlib'
import {encodeTexture,decodeTexture,validateModTexture,modTextureKey} from '../src/core/mod-textures'
import {modFromFiles,modFromArchive} from '../src/client/mod-archive'
import {createModInstallation} from '../src/client/mod-installation'
import type {InstalledMod,ModDisk} from '../src/client/mod-disk'
import {loadMods,packagesFromFiles} from '../src/core/defs'
import {readPackages,loadDb} from '../tools/loadContent'
import {packageMod} from '../tools/package-mod'
import {zipFixture} from './mod-archive-fixture'
import {newGame} from '../src/core/game'
import {serialize} from '../src/core/save'
import {setDisplayedModTextures,modTextureUrl} from '../src/client/mod-texture-display'
import {inspectModTextureImages} from '../src/client/mod-texture-images'
import {validateSpriteAssets} from '../tools/sprite-validation'
const id='sample-original-textures',path='textures/salt-pouch.png',key=modTextureKey(id,path),png=readFileSync('mods/'+id+'/'+path)
const input=()=>['manifest.json','patches/salt.json',path,'LICENSE.txt','README.md'].map(p=>({path:id+'/'+p,bytes:readFileSync('mods/'+id+'/'+p)}))
function chunk(kind:string,data:Buffer){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(kind,4);data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out}
function memoryDisk(){let epoch=0;const records=new Map<string,InstalledMod>(),disk:ModDisk={async read(){return{epoch,records:structuredClone([...records.values()])}},async change(at,id,row){if(at!==epoch)throw Error('stale');if(row)records.set(id,structuredClone(row));else records.delete(id);return++epoch}};return{disk,records}}
describe('모드16×16 PNG의 원문·설치·콘텐츠 식별',()=>{
 it('base64를 독립 Buffer와 모든 바이트·패딩 길이에서 일치시키고 비정규 입력을 거절한다',()=>{
  for(const length of[1,2,3,4,255,256,257]){const raw=Uint8Array.from({length},(_,i)=>i%256),encoded=encodeTexture(raw);expect(encoded).toBe(Buffer.from(raw).toString('base64'));expect(Buffer.from(decodeTexture(encoded))).toEqual(Buffer.from(raw))}
  for(const bad of['','Zg=','Zg===','Zh==','Zm9=',' Zg==','data:image/png;base64,Zg==','Zg==\n','a'.repeat(90000)])expect(()=>decodeTexture(bad)).toThrow()
 })
 it('실제 원본16PNG는 UTF-8변환 없이 같은 바이트·크기로 폴더와ZIP에서 해석한다',async()=>{
  const folder=modFromFiles(input()),zip=await modFromArchive(zipFixture(input()));expect(folder.files).toEqual(zip.files);expect(folder.package).toEqual(zip.package);expect(folder.package.textures?.[path]).toBe(png.toString('base64'));expect(folder.bytes).toBe(input().reduce((n,f)=>n+f.bytes.length,0));expect(()=>validateModTexture(png)).not.toThrow()
 })
 it('CRC가 맞아도32px·잘못된IHDR·애니메이션·중복종료·청크순서·손상CRC를 거절한다',()=>{
  const header=Buffer.from(png.subarray(16,29)),rest=png.subarray(33),badSize=Buffer.from(header);badSize.writeUInt32BE(32)
  const corrupt=Buffer.from(png);corrupt[corrupt.length-1]^=1
  for(const raw of[Buffer.concat([png.subarray(0,8),chunk('IHDR',badSize),rest]),Buffer.concat([png.subarray(0,8),chunk('IHDR',Buffer.alloc(0)),rest]),Buffer.concat([png.subarray(0,33),chunk('acTL',Buffer.alloc(8)),rest]),Buffer.concat([png,png.subarray(-12)]),corrupt,png.subarray(0,-1)])expect(()=>validateModTexture(raw)).toThrow()
 })
 it('SVG·대문자·퍼센트경로·상위경로는 실행/경로해석 대상으로 가져오지 않는다',()=>{
  for(const name of['textures/salt.svg','textures/Salt.png','textures/%73alt.png','textures/../salt.png','textures/a.png.js'])expect(()=>modFromFiles([...input(),{path:id+'/'+name,bytes:png}])).toThrow()
 })
 it('비활성 텍스처는 기본세계·해시를 바꾸지 않고 활성PNG의 한바이트변경은 식별한다',()=>{
  const packages=readPackages(),without=packages.filter(p=>p.manifest.id!==id),before=loadMods(without,[]).db,after=loadMods(packages,[]).db
  expect(after.loadHash).toBe(before.loadHash);expect(serialize(newGame(after,{seed:'texture-off'}))).toBe(serialize(newGame(before,{seed:'texture-off'})))
  const a=loadMods(packages,[id]);expect(a.report.errors).toEqual([]);expect(a.db.item('Item.Salt').sprite).toBe(key);expect(a.db.modTextures[key]).toBe(png.toString('base64'))
  const copy=structuredClone(packages),own=copy.find(p=>p.manifest.id===id)!,altered=Buffer.concat([png.subarray(0,-12),chunk('tEXt',Buffer.from('comment\0different bytes')),png.subarray(-12)]);own.textures![path]=altered.toString('base64');const b=loadMods(copy,[id]);expect(b.report.errors).toEqual([]);expect(b.db.loadHash).not.toBe(a.db.loadHash);expect(b.db.modManifest()).not.toEqual(a.db.modManifest());expect(a.db.modTextures[key]).toBe(png.toString('base64'));expect(Object.isFrozen(a.db.modTextures)).toBe(true)
 })
 it('수동 패키지와최종상속 뒤없는모드 아이콘을 로드오류로 보고한다',()=>{
  const packages=readPackages(),bad=structuredClone(packages),own=bad.find(p=>p.manifest.id===id)!;own.textures![path]='not-png';expect(loadMods(bad,[id]).report.errors.join()).toMatch(/텍스처/)
  const missing=packagesFromFiles({'mods/missing/manifest.json':{id:'missing',name:'없음',version:'1'},'mods/missing/patches/a.json':[{op:'replace',target:'Item.Salt',path:'/sprite',value:'mod:missing/textures/absent.png'}]});expect(loadMods(packages.concat(missing),['missing']).report.errors.join()).toMatch(/활성 모드 텍스처 없음/)
 })
 it.each(['zip','tar.gz']as const)('CLI %s 원본PNG가 브라우저 파서와Node로더의 패키지해시까지 같다',async format=>{
  const root=mkdtempSync(join(tmpdir(),'ashveil-texture-pack-'))
  try{const metadata=packageMod(id,{out:join(root,'mod.'+format),format}),imported=await modFromArchive(readFileSync(metadata.archive)),packages=readPackages(),a=loadMods(packages,[id]).db,b=loadMods(packages.filter(p=>p.manifest.id!==id).concat(imported.package),[id]).db;expect(imported.package.textures?.[path]).toBe(png.toString('base64'));expect(b.loadHash).toBe(a.loadHash);expect(b.modManifest()).toEqual(a.modManifest());expect(metadata.files.find(f=>f.path===id+'/'+path)).toBeTruthy()}finally{rmSync(root,{recursive:true,force:true})}
 })
 it('명시 설치·재시작·제거에서 이미지와해시를복원하고 기존DB/World는 보존한다',async()=>{
  const{disk}=memoryDisk(),packages=readPackages().filter(p=>p.manifest.id!==id),original=loadMods(packages,[]).db,s=newGame(original,{seed:'texture-install'}),raw=serialize(s),manager=createModInstallation(packages,disk,vi.fn(),async()=>{}),review=await manager.review(modFromFiles(input()));expect(review.textures).toBe(1);expect(packages.find(p=>p.manifest.id===id)).toBeUndefined();await manager.install(review.token);const active=loadMods(packages,[id]).db,restarted=readPackages().filter(p=>p.manifest.id!==id),next=createModInstallation(restarted,disk,vi.fn(),async()=>{});await next.initialize();expect(loadMods(restarted,[id]).db.modTextures).toEqual(active.modTextures);expect(loadMods(restarted,[id]).db.loadHash).toBe(active.loadHash);await next.remove(id);expect(loadMods(restarted,[]).db.modTextures).toEqual({});expect(active.modTextures[key]).toBe(png.toString('base64'));expect(serialize(s)).toBe(raw)
 })
 it('승인된 현재DB 그림만표시하고 후보/제거한목록에서 진행중세계그림을바꾸지 않는다',()=>{
  const db=loadDb([id]).db;setDisplayedModTextures(db.modTextures);expect(modTextureUrl(key)).toBe('data:image/png;base64,'+png.toString('base64'));setDisplayedModTextures({});expect(modTextureUrl(key)).toBeUndefined()
 })
 it('이미지 디코더 실패는 설치 검토를 거절하고 성공한 비트맵도 닫는다',async()=>{
  const close=vi.fn(),decode=vi.fn().mockRejectedValueOnce(Error('invalid compressed pixels')).mockResolvedValue({width:16,height:16,close});vi.stubGlobal('createImageBitmap',decode)
  try{const{disk}=memoryDisk(),packages=readPackages().filter(p=>p.manifest.id!==id),manager=createModInstallation(packages,disk,vi.fn(),db=>inspectModTextureImages(db.modTextures));await expect(manager.review(modFromFiles(input()))).rejects.toThrow('PNG 픽셀');expect(packages.some(p=>p.manifest.id===id)).toBe(false);const review=await manager.review(modFromFiles(input()));expect(close).toHaveBeenCalledTimes(1);expect(review.textures).toBe(1)}finally{vi.unstubAllGlobals()}
 })
 // Several complete PNG/CRC passes are an integration check, not a five-second performance budget.
 it('리소스CLI도활성16pxPNG만인식하고 잘못된경로를 public파일로우회하지않는다',()=>{
  const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8')),db=loadDb([id]).db,result=validateSpriteAssets(resolve('public'),manifest,[key,key],[],db.modTextures);expect(result.errors).toEqual([]);expect(result.counts.uniquePngFiles).toBe(validateSpriteAssets(resolve('public'),manifest).counts.uniquePngFiles+1);expect(validateSpriteAssets(resolve('public'),manifest,[key]).errors.join()).toMatch(/활성 모드 텍스처/)
 },30000)
})
