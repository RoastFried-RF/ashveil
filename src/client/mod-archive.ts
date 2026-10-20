import {parseContentJson} from '../core/content-json'
import {packagesFromFiles,type ModPackage,type ModManifest} from '../core/defs'
import {MOD_PACKAGE_BYTES,MOD_PACKAGE_FILES,supportedModFile,validInstallableModId,safeModFilePath} from '../core/mod-package-files'

export interface ModFile {path:string;bytes:Uint8Array}
export interface ImportedMod {id:string;files:Record<string,string>;package:ModPackage;bytes:number;format:'zip'|'tar.gz'|'folder'}
const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true})
const fail=(message:string):never=>{throw Error('모드 가져오기: '+message)}
function pathName(path:string):string{
 if(!safeModFilePath(path))fail('안전한 상대 파일 경로가 아니다: '+path)
 return path
}
export function modFromFiles(input:readonly ModFile[],format:ImportedMod['format']='folder'):ImportedMod{
 if(!input.length||input.length>MOD_PACKAGE_FILES)fail('파일 수는 1~512개여야 한다')
 const seen=new Set<string>();let bytes=0
 for(const file of input){pathName(file.path);if(seen.has(file.path))fail('중복 파일: '+file.path);seen.add(file.path);bytes+=file.bytes.byteLength;if(bytes>MOD_PACKAGE_BYTES)fail('압축을 푼 콘텐츠는 8MiB 이하여야 한다')}
 const manifests=input.filter(f=>f.path==='manifest.json'||f.path.endsWith('/manifest.json'))
 if(manifests.length!==1)fail('하나의 모드 manifest.json이 필요하다')
 const manifestPath=manifests[0].path,prefix=manifestPath.slice(0,-'manifest.json'.length)
 const manifest=parseContentJson(decoder.decode(manifests[0].bytes),manifestPath) as ModManifest
 if(!manifest||!validInstallableModId(manifest.id))fail('core 이외의 유효한 소문자 모드 ID가 필요하다')
 const files:Record<string,string>=Object.create(null)
 for(const file of input){
  if(!file.path.startsWith(prefix))fail('한 모드 폴더 밖의 파일이다: '+file.path)
  const relative=file.path.slice(prefix.length);pathName(relative)
  if(!supportedModFile(relative,manifest))fail('지원하지 않는 콘텐츠 파일: '+relative)
  files[relative]=decoder.decode(file.bytes)
 }
 const parsed=packagesFromFiles(Object.fromEntries(Object.entries(files).map(([path,source])=>['mods/'+manifest.id+'/'+path,source])))
 if(parsed.length!==1||parsed[0].manifest.id!==manifest.id)fail('단일 모드로 해석할 수 없다')
 return{id:manifest.id,files,package:parsed[0],bytes,format}
}
async function decompress(bytes:Uint8Array,format:CompressionFormat,limit:number):Promise<Uint8Array>{
 const stream=new Blob([new Uint8Array(bytes).buffer]).stream().pipeThrough(new DecompressionStream(format)),reader=stream.getReader(),parts:Uint8Array[]=[];let length=0
 try{for(;;){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();fail('압축 해제 크기 제한을 넘었다')}parts.push(value)}}finally{reader.releaseLock()}
 const result=new Uint8Array(length);let at=0;for(const part of parts){result.set(part,at);at+=part.length}return result
}
function tarFiles(bytes:Uint8Array):ModFile[]{
 const files:ModFile[]=[],seen=new Set<string>();let at=0,total=0
 const field=(start:number,length:number)=>{const slice=bytes.subarray(start,start+length),end=slice.indexOf(0);return decoder.decode(end<0?slice:slice.subarray(0,end))}
 const octal=(start:number,length:number)=>{const text=field(start,length).trim();if(!/^[0-7]+$/.test(text))fail('지원하지 않는 tar 숫자');const n=parseInt(text,8);if(!Number.isSafeInteger(n))fail('tar 크기 범위 초과');return n}
 while(at+512<=bytes.length){
  if(bytes.subarray(at,at+512).every(b=>b===0)){if(at+1024>bytes.length||bytes.subarray(at).some(b=>b!==0))fail('잘못된 tar 끝 또는 숨겨진 내용');return files}
  const header=at,checksum=octal(at+148,8);let sum=0;for(let i=0;i<512;i++)sum+=i>=148&&i<156?32:bytes[at+i]
  if(sum!==checksum)fail('tar 헤더 체크섬이 다르다')
  if(field(at+257,5)!=='ustar')fail('ustar 형식이 필요하다')
  const prefix=field(at+345,155),name=field(at,100),path=(prefix?prefix+'/':'')+name,size=octal(at+124,12),type=bytes[at+156]
  at+=512;if(at+size>bytes.length)fail('잘린 tar 파일')
  if(type===53){pathName(path.endsWith('/')?path.slice(0,-1):path);if(size)fail('tar 폴더 내용은 허용하지 않는다')}
  else{
   if(type!==0&&type!==48)fail('링크 또는 특수 tar 파일은 허용하지 않는다')
   pathName(path);if(seen.has(path))fail('중복 tar 파일: '+path);seen.add(path)
   total+=size;if(total>MOD_PACKAGE_BYTES||files.length>=MOD_PACKAGE_FILES)fail('8MiB/512파일 제한 초과')
   files.push({path,bytes:bytes.slice(at,at+size)})
  }
  at=header+512+Math.ceil(size/512)*512
 }
 return fail('tar 끝 기록이 없다')
}
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0})
function crc32(bytes:Uint8Array):number{let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0}
async function zipFiles(bytes:Uint8Array):Promise<ModFile[]>{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=(at:number)=>view.getUint16(at,true),u32=(at:number)=>view.getUint32(at,true)
 let end=-1;for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(u32(at)===0x06054b50&&at+22+u16(at+20)===bytes.length){end=at;break}
 if(end<0)fail('ZIP 끝 기록이 없다')
 const count=u16(end+10),centralSize=u32(end+12),centralStart=u32(end+16)
 if(u16(end+4)||u16(end+6)||u16(end+8)!==count||count===65535||!count||count>MOD_PACKAGE_FILES||centralStart+centralSize!==end)fail('단일 디스크 ZIP/512파일만 지원한다')
 const files:ModFile[]=[],seen=new Set<string>();let at=centralStart,nextLocal=0,total=0
 for(let i=0;i<count;i++){
  if(at+46>end||u32(at)!==0x02014b50)fail('잘못된 ZIP 중앙 기록')
  const flags=u16(at+8),method=u16(at+10),crc=u32(at+16),packed=u32(at+20),size=u32(at+24),nameLength=u16(at+28),extra=u16(at+30),comment=u16(at+32),attributes=u32(at+38),local=u32(at+42),unixType=(attributes>>>16)&0xf000
  if(at+46+nameLength+extra+comment>end||u16(at+34)||flags&~0x80e||![0,8].includes(method)||[packed,size,local].includes(0xffffffff)||unixType&&unixType!==0x8000&&unixType!==0x4000)fail('지원하지 않는 ZIP 암호화/특수 파일/압축 형식')
  const nameBytes=bytes.subarray(at+46,at+46+nameLength);if(!(flags&0x800)&&nameBytes.some(b=>b>127))fail('비ASCII ZIP 경로에는 UTF-8 표시가 필요하다')
  const path=decoder.decode(nameBytes),directory=path.endsWith('/');pathName(directory?path.slice(0,-1):path)
  if(seen.has(path))fail('중복 ZIP 경로: '+path);seen.add(path)
  if(local!==nextLocal||local+30>centralStart||u32(local)!==0x04034b50||u16(local+6)!==flags||u16(local+8)!==method||u16(local+26)!==nameLength)fail('ZIP 로컬 기록이 다르거나 겹친다')
  const data=local+30+nameLength+u16(local+28)
  if(data+packed>centralStart||!nameBytes.every((b,j)=>bytes[local+30+j]===b))fail('ZIP 경로 또는 크기가 다르다')
  if(!(flags&8)&&(u32(local+14)!==crc||u32(local+18)!==packed||u32(local+22)!==size))fail('ZIP 크기/체크섬 기록이 다르다')
  total+=size;if(total>MOD_PACKAGE_BYTES)fail('압축 해제 크기는 8MiB 이하여야 한다')
  const content=method===0?bytes.slice(data,data+packed):await decompress(bytes.subarray(data,data+packed),'deflate-raw',Math.min(size,MOD_PACKAGE_BYTES))
  if(content.length!==size||crc32(content)!==crc)fail('ZIP 파일 크기 또는 CRC32가 다르다')
  nextLocal=data+packed
  if(flags&8){if(nextLocal+12>centralStart)fail('잘린 ZIP 데이터 기록');if(u32(nextLocal)===0x08074b50)nextLocal+=4;if(nextLocal+12>centralStart||u32(nextLocal)!==crc||u32(nextLocal+4)!==packed||u32(nextLocal+8)!==size)fail('ZIP 데이터 기록이 다르다');nextLocal+=12}
  if(directory){if(size||unixType===0x8000)fail('ZIP 폴더 내용은 허용하지 않는다')}else{if(unixType===0x4000)fail('ZIP 파일 종류가 다르다');files.push({path,bytes:content})}
  at+=46+nameLength+extra+comment
 }
 if(at!==end||nextLocal!==centralStart)fail('ZIP에 숨겨진 기록이 있다')
 return files
}
export async function modFromArchive(input:Uint8Array):Promise<ImportedMod>{
 if(input.length>MOD_PACKAGE_BYTES||input.length<4)fail('배포 파일은 8MiB 이하여야 한다')
 const bytes=new Uint8Array(input)
 if(bytes[0]===0x1f&&bytes[1]===0x8b)return modFromFiles(tarFiles(await decompress(bytes,'gzip',MOD_PACKAGE_BYTES+1024*1024)),'tar.gz')
 if(bytes[0]===0x50&&bytes[1]===0x4b)return modFromFiles(await zipFiles(bytes),'zip')
 return fail('ZIP 또는 tar.gz 배포 파일이 필요하다')
}
