// 정적 모드 PNG의 휴대 가능한 파일 계약. DOM·이미지 디코더·파일 시스템을 사용하지 않는다.
import {validInstallableModId,isModTexturePath} from './mod-package-files'
export {isModTexturePath} from './mod-package-files'

export const MOD_TEXTURE_BYTES=64*1024
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export const modTextureKey=(id:string,path:string)=>'mod:'+id+'/'+path
export function encodeTexture(bytes:Uint8Array):string{
 let out=''
 for(let i=0;i<bytes.length;i+=3){const a=bytes[i]!,b=bytes[i+1],c=bytes[i+2];out+=alphabet[a>>>2]+alphabet[((a&3)<<4)|((b??0)>>>4)]+(b===undefined?'=':alphabet[((b&15)<<2)|((c??0)>>>6)])+(c===undefined?'=':alphabet[c&63])}
 return out
}
export function decodeTexture(source:unknown):Uint8Array{
 if(typeof source!=='string'||source.length>Math.ceil(MOD_TEXTURE_BYTES/3)*4||!source.length||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(source))throw Error('텍스처는64KiB 이하의 정규 base64여야 한다')
 const bytes=new Uint8Array(source.length/4*3-(source.endsWith('==')?2:source.endsWith('=')?1:0));let at=0
 for(let i=0;i<source.length;i+=4){const a=alphabet.indexOf(source[i]!),b=alphabet.indexOf(source[i+1]!),c=alphabet.indexOf(source[i+2]!),d=alphabet.indexOf(source[i+3]!);bytes[at++]=(a<<2)|(b>>>4);if(at<bytes.length)bytes[at++]=(b<<4)|(c>>>2);if(at<bytes.length)bytes[at++]=(c<<6)|d}
 if(bytes.length>MOD_TEXTURE_BYTES||encodeTexture(bytes)!==source)throw Error('텍스처 base64의 패딩이 올바르지 않다')
 return bytes
}
const crcTable=Uint32Array.from({length:256},(_,index)=>{let x=index;for(let i=0;i<8;i++)x=x&1?0xedb88320^(x>>>1):x>>>1;return x>>>0})
function crc(bytes:Uint8Array){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]!^(value>>>8);return(value^0xffffffff)>>>0}
/** 16×16 정적 PNG의 청크/CRC 계약. 픽셀 압축 해제와 외형은 실제 이미지 로더에서 별도 확인한다. */
export function validateModTexture(bytes:Uint8Array):void{
 if(bytes.length>MOD_TEXTURE_BYTES||bytes.length<57||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('텍스처는64KiB 이하의16×16 PNG여야 한다')
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=8,data=false,dataClosed=false,palette=false,color=-1
 while(offset<bytes.length){
  if(offset+12>bytes.length)throw Error('텍스처 PNG 청크가 잘렸다')
  const size=view.getUint32(offset),end=offset+12+size
  if(end>bytes.length)throw Error('텍스처 PNG 청크 길이가 범위를 벗어난다')
  const kind=String.fromCharCode(...bytes.subarray(offset+4,offset+8))
  if(!/^[A-Za-z]{4}$/.test(kind)||crc(bytes.subarray(offset+4,offset+8+size))!==view.getUint32(offset+8+size))throw Error('텍스처 PNG 청크/CRC 오류')
  if(offset===8&&kind!=='IHDR')throw Error('텍스처 PNG 첫 청크는 IHDR이어야 한다')
  if(kind==='IHDR'){
   color=bytes[offset+17]!
   const depth=bytes[offset+16]!,depths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]}
   if(offset!==8||size!==13||view.getUint32(offset+8)!==16||view.getUint32(offset+12)!==16||!depths[color]?.includes(depth)||bytes[offset+18]!==0||bytes[offset+19]!==0||![0,1].includes(bytes[offset+20]!))throw Error('텍스처 PNG는 유효한16×16 IHDR이어야 한다')
  }else if(kind==='PLTE'){
   if(data||palette||!size||size%3||size>768||[0,4].includes(color))throw Error('텍스처 PNG 팔레트 오류')
   palette=true
  }else if(kind==='IDAT'){
   if(dataClosed||color===3&&!palette)throw Error('텍스처 PNG 픽셀 청크 순서 오류')
   data=true
  }else if(kind==='IEND'){
   if(size||!data||end!==bytes.length)throw Error('텍스처 PNG 종료/꼬리 데이터 오류')
   return
  }else{
   if(['acTL','fcTL','fdAT'].includes(kind)||kind[0]===kind[0]!.toUpperCase())throw Error('텍스처 PNG는 지원하는 정적 청크만 허용한다')
   if(data)dataClosed=true
  }
  offset=end
 }
 throw Error('텍스처 PNG 종료 청크가 없다')
}
export function checkedModTextures(id:string,textures:unknown):Record<string,string>{
 if(textures===undefined)return{}
 if(!validInstallableModId(id)||!textures||typeof textures!=='object'||Array.isArray(textures))throw Error('모드 텍스처 ID/파일 사전 오류')
 const entries=Object.entries(textures);if(entries.length>512)throw Error('모드 텍스처는512개 이하여야 한다')
 const result:Record<string,string>={};let total=0
 for(const[path,source]of entries){if(!isModTexturePath(path))throw Error('안전한 textures/*.png 경로가 필요하다: '+path);const bytes=decodeTexture(source);total+=bytes.length;if(total>8*1024*1024)throw Error('모드 텍스처는8MiB 이하여야 한다');validateModTexture(bytes);result[modTextureKey(id,path)]=source as string}
 return result
}
export function encodeModFile(path:string,bytes:Uint8Array):string{
 if(isModTexturePath(path)){validateModTexture(bytes);return encodeTexture(bytes)}
 return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
}
export function decodeModFile(path:string,source:string):Uint8Array{return isModTexturePath(path)?decodeTexture(source):new TextEncoder().encode(source)}
