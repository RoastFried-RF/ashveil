import {crc32,deflateRawSync} from 'node:zlib'
import {modFromFiles,type ModFile} from '../src/client/mod-archive'
export function importedFiles(id='local-floor',label='가져온 바닥'):ModFile[]{return[
 {path:id+'/manifest.json',bytes:Buffer.from(JSON.stringify({id,name:'가져온 바닥',version:'1.0.0',dependencies:['core']}))},
 {path:id+'/patches/floor.json',bytes:Buffer.from(JSON.stringify([{op:'replace',target:'Terrain.KtFloor',path:'/label',value:label}]))}
]}
export const importedFixture=()=>modFromFiles(importedFiles())
/** Node zlib의 독립 CRC32/deflate로 만드는 표준 ZIP. 제품 파서는 재사용하지 않는다. */
export function zipFixture(files:ModFile[],method:0|8=8,descriptor=false):Uint8Array{
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0
 for(const file of files){
  const name=Buffer.from(file.path),raw=Buffer.from(file.bytes),data=method===8?deflateRawSync(raw):raw,crc=crc32(raw),flags=0x800|(descriptor?8:0),a=Buffer.alloc(30),b=Buffer.alloc(46)
  a.writeUInt32LE(0x04034b50);a.writeUInt16LE(20,4);a.writeUInt16LE(flags,6);a.writeUInt16LE(method,8);if(!descriptor){a.writeUInt32LE(crc,14);a.writeUInt32LE(data.length,18);a.writeUInt32LE(raw.length,22)}a.writeUInt16LE(name.length,26)
  b.writeUInt32LE(0x02014b50);b.writeUInt16LE(0x314,4);b.writeUInt16LE(20,6);b.writeUInt16LE(flags,8);b.writeUInt16LE(method,10);b.writeUInt32LE(crc,16);b.writeUInt32LE(data.length,20);b.writeUInt32LE(raw.length,24);b.writeUInt16LE(name.length,28);b.writeUInt32LE((0o100644<<16)>>>0,38);b.writeUInt32LE(offset,42)
  local.push(a,name,data);central.push(b,name);offset+=a.length+name.length+data.length
  if(descriptor){const d=Buffer.alloc(16);d.writeUInt32LE(0x08074b50);d.writeUInt32LE(crc,4);d.writeUInt32LE(data.length,8);d.writeUInt32LE(raw.length,12);local.push(d);offset+=16}
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([...local,directory,end])
}
