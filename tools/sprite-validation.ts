// 클라이언트 자산 계약을 디스크에서 검사한다. 코어/세계/스크립트는 실행하지 않는다.
import {readFileSync,statSync} from 'node:fs'
import {resolve,relative,isAbsolute} from 'node:path'
import {checkedModTextures} from '../src/core/mod-textures'
type RecordValue=Record<string,unknown>
const object=(v:unknown):v is RecordValue=>!!v&&typeof v==='object'&&!Array.isArray(v)
const directions=['down','left','right','up']
const crcTable=Uint32Array.from({length:256},(_,index)=>{let x=index;for(let i=0;i<8;i++)x=x&1?0xedb88320^(x>>>1):x>>>1;return x>>>0})
function crc(bytes:Buffer){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]!^(value>>>8);return(value^0xffffffff)>>>0}
function pngSize(bytes:Buffer){
 if(bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('PNG 헤더가 아니다')
 let offset=8,width=0,height=0,ended=false,hasData=false,repeatedEnd=false
 while(offset<bytes.length){
  if(offset+12>bytes.length)throw Error('PNG 청크가 잘렸다')
  const size=bytes.readUInt32BE(offset),end=offset+12+size;if(end>bytes.length)throw Error('PNG 청크 길이가 파일을 벗어난다')
  const kind=bytes.toString('ascii',offset+4,offset+8)
  if(crc(bytes.subarray(offset+4,offset+8+size))!==bytes.readUInt32BE(offset+8+size))throw Error('PNG '+kind+' CRC가 맞지 않는다')
  if(offset===8&&kind!=='IHDR')throw Error('PNG 첫 청크는 IHDR이어야 한다')
  if(kind==='IHDR'){if(offset!==8||size!==13)throw Error('PNG IHDR 크기/위치가 잘못되었다');width=bytes.readUInt32BE(offset+8);height=bytes.readUInt32BE(offset+12);if(!width||!height)throw Error('PNG 크기는 양수여야 한다')}
  if(kind==='IDAT')hasData=true
  offset=end
  if(kind==='IEND'){
   if(size!==0)throw Error('PNG 종료 청크가 잘못되었다')
   if(offset!==bytes.length){
    // 기존 상류 CC0 원본 일부의 완전히 같은 종료 청크 하나는 호환 경고로 보존한다.
    if(!bytes.subarray(offset).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130])))throw Error('PNG 종료 뒤 알 수 없는 데이터가 있다')
    repeatedEnd=true
   }
   ended=true;break
  }
 }
 if(!ended||!hasData)throw Error('PNG 픽셀 데이터/종료 청크가 없다')
 return{width,height,repeatedEnd}
}
export function validateSpriteAssets(publicRoot:string,manifest:unknown,icons:Iterable<string>=[],creatureCharacters:Iterable<string>=[],modTextures:Readonly<Record<string,string>>={},renderReferences:Iterable<string>=[]){
 const errors:string[]=[],warnings:string[]=[],counts={sheets:0,frames:0,animations:0,characters:0,ui:0,icons:0,creatureCharacters:0,renderReferences:0,uniquePngFiles:0},files=new Map<string,ReturnType<typeof pngSize>|null>(),modFiles=new Set<string>()
 const file=(url:unknown,where:string)=>{
  if(typeof url!=='string'||!url||/[\\?#%]/.test(url)||[...url].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)||url.startsWith('/')||/^[a-z]+:/i.test(url)||url.split('/').some(p=>p==='..'||p==='.'||!p)){errors.push(where+': public 아래의 상대 PNG 경로가 필요하다');return null}
  const path=resolve(publicRoot,url),rel=relative(resolve(publicRoot),path)
  if(rel.startsWith('..')||isAbsolute(rel)){errors.push(where+': public 밖의 파일이다');return null}
  if(files.has(path))return files.get(path)??null
  try{if(statSync(path).size>32*1024*1024)throw Error('PNG 한 파일은32MiB 이하여야 한다');const size=pngSize(readFileSync(path));files.set(path,size);if(size.repeatedEnd)warnings.push(where+': '+url+' · 완전히 같은 IEND 한 개가 덧붙은 원본을 보존했다');return size}catch(e){errors.push(where+': '+url+' · '+(e as Error).message);files.set(path,null);return null}
 }
 if(!object(manifest)){errors.push('sprites.json 객체가 필요하다');return{valid:false,counts,errors,warnings}}
 const records:Record<string,RecordValue>={}
 for(const key of['sheets','frames','anims','chars','ui']){const row=manifest[key];if(!object(row)){errors.push('sprites.json.'+key+' 객체가 필요하다');records[key]={}}else records[key]=row}
 const{sheets,frames,anims,chars,ui}=records as Record<'sheets'|'frames'|'anims'|'chars'|'ui',RecordValue>,sizes=new Map<string,ReturnType<typeof pngSize>|null>()
 for(const[key,url]of Object.entries(sheets)){counts.sheets++;sizes.set(key,file(url,'sheet '+key))}
 if(manifest.sheetSizes!==undefined){
  if(!object(manifest.sheetSizes))errors.push('sheetSizes: 시트별 PNG 크기 객체가 필요하다')
  else{
   for(const key of Object.keys(manifest.sheetSizes))if(!Object.hasOwn(sheets,key))errors.push('sheetSizes: 등록되지 않은 sheet '+key)
   for(const key of Object.keys(sheets)){
    const row=manifest.sheetSizes[key],actual=sizes.get(key)
    if(!Array.isArray(row)||row.length!==2||!row.every(n=>Number.isSafeInteger(n)&&n>0)||actual&&(row[0]!==actual.width||row[1]!==actual.height))errors.push('sheetSizes '+key+': 실제 PNG 너비/높이와 같아야 한다')
   }
  }
 }
 for(const[key,row]of Object.entries(frames)){
  counts.frames++
  if(!Array.isArray(row)||row.length!==5||typeof row[0]!=='string'||!row.slice(1).every(Number.isSafeInteger)){errors.push('frame '+key+': [sheet,x,y,width,height] 정수5항목이 필요하다');continue}
  const[sheet,x,y,width,height]=row as[string,number,number,number,number],size=sizes.get(sheet)
  if(!Object.hasOwn(sheets,sheet)){errors.push('frame '+key+': 등록되지 않은 sheet '+sheet);continue}
  if(x<0||y<0||width<=0||height<=0||size&&(x+width>size.width||y+height>size.height))errors.push('frame '+key+': 픽셀 영역이 PNG 범위를 벗어난다')
 }
 const frameList=(value:unknown,where:string)=>{if(!Array.isArray(value)||!value.length){errors.push(where+': 비어 있지 않은 프레임 목록이 필요하다');return}for(const name of value)if(typeof name!=='string'||!Object.hasOwn(frames,name))errors.push(where+': 등록되지 않은 frame '+String(name))}
 for(const[key,row]of Object.entries(anims)){counts.animations++;if(!object(row)){errors.push('anim '+key+': 객체가 필요하다');continue}frameList(row.frames,'anim '+key);if(typeof row.fps!=='number'||!Number.isFinite(row.fps)||row.fps<=0)errors.push('anim '+key+': fps는 양수여야 한다')}
 for(const[key,row]of Object.entries(chars)){
  counts.characters++
  if(!object(row)){errors.push('char '+key+': 객체가 필요하다');continue}
  for(const mode of['walk','idle',...(row.attack!==undefined?['attack']:[])]){const poses=row[mode];if(!object(poses)){errors.push('char '+key+'.'+mode+': 방향별 객체가 필요하다');continue}for(const dir of directions)frameList(poses[dir],'char '+key+'.'+mode+'.'+dir)}
  for(const name of['anchor',...(row.attackAnchor!==undefined?['attackAnchor']:[])]){const anchor=row[name];if(!Array.isArray(anchor)||anchor.length!==2||!anchor.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1))errors.push('char '+key+'.'+name+': 0~1의 좌표2개가 필요하다')}
  for(const name of['renderScale','headOffset','healthBarWidth'])if(row[name]!==undefined&&(typeof row[name]!=='number'||!Number.isFinite(row[name])||row[name]<=0))errors.push('char '+key+'.'+name+': 양수여야 한다')
  if(row.portrait!==undefined&&(typeof row.portrait!=='string'||!Object.hasOwn(frames,row.portrait)))errors.push('char '+key+'.portrait: 등록된 frame이 필요하다')
  if(row.heldItems!==undefined&&typeof row.heldItems!=='boolean')errors.push('char '+key+'.heldItems: boolean이 필요하다')
  if(row.frameTransforms!==undefined){
   if(!object(row.frameTransforms))errors.push('char '+key+'.frameTransforms: 포즈별 객체가 필요하다')
   else for(const[frame,value]of Object.entries(row.frameTransforms)){
    if(!Object.hasOwn(frames,frame)||!object(value)||!Array.isArray(value.anchor)||value.anchor.length!==2||!value.anchor.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)||typeof value.scale!=='number'||!Number.isFinite(value.scale)||value.scale<=0)errors.push('char '+key+'.frameTransforms.'+frame+': 실제 frame/0~1발 위치/양수 배율이 필요하다')
   }
  }
 }
 for(const[key,url]of Object.entries(ui)){counts.ui++;file(url,'UI '+key)}
 for(const key of new Set(icons)){counts.icons++;if(key.startsWith('mod:')){const match=key.match(/^mod:([^/]+)\/(.+)$/);try{if(!match||!Object.hasOwn(modTextures,key))throw Error('활성 모드 텍스처가 없다');checkedModTextures(match[1]!,{[match[2]!]:modTextures[key]});modFiles.add(key)}catch(error){errors.push('icon '+key+': '+(error as Error).message)}}else if(!Object.hasOwn(frames,key))file('tiles/'+key+'.png','icon '+key)}
 for(const key of new Set(creatureCharacters)){counts.creatureCharacters++;if(!Object.hasOwn(chars,key))errors.push('Creature: 등록되지 않은 char '+key)}
 for(const key of new Set(renderReferences)){
  counts.renderReferences++
  if(Object.hasOwn(frames,key)||Object.hasOwn(chars,key)||Object.hasOwn(anims,key))continue
  if(key.startsWith('mod:')){const match=key.match(/^mod:([^/]+)\/(.+)$/);try{if(!match||!Object.hasOwn(modTextures,key))throw Error('활성 모드 텍스처가 없다');checkedModTextures(match[1]!,{[match[2]!]:modTextures[key]});modFiles.add(key)}catch(error){errors.push('render '+key+': '+(error as Error).message)}}
  else file('tiles/'+key+'.png','render '+key)
 }
 counts.uniquePngFiles=[...files.values()].filter(Boolean).length+modFiles.size
 return{valid:errors.length===0,counts,errors,warnings}
}
