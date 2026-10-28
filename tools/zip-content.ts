/** 표준 ZIP store. 압축기/OS 시각에 의존하지 않는 고정 DOS 시각·UTF8·권한. */
export function zipContent(files:readonly {path:string;bytes:Uint8Array}[]):Buffer{
 const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0})
 const locals:Buffer[]=[],central:Buffer[]=[];let offset=0
 for(const file of files){
  const name=Buffer.from(file.path,'utf8'),bytes=Buffer.from(file.bytes);if(name.length>65535||bytes.length>=0xffffffff)throw Error('ZIP 경로 또는 크기 제한 초과')
  let checksum=0xffffffff;for(const byte of bytes)checksum=table[(checksum^byte)&255]^(checksum>>>8);checksum=(checksum^0xffffffff)>>>0
  const local=Buffer.alloc(30),row=Buffer.alloc(46)
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(checksum,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26)
  row.writeUInt32LE(0x02014b50);row.writeUInt16LE(0x314,4);row.writeUInt16LE(20,6);row.writeUInt16LE(0x800,8);row.writeUInt16LE(33,14);row.writeUInt32LE(checksum,16);row.writeUInt32LE(bytes.length,20);row.writeUInt32LE(bytes.length,24);row.writeUInt16LE(name.length,28);row.writeUInt32LE((0o100644<<16)>>>0,38);row.writeUInt32LE(offset,42)
  locals.push(local,name,bytes);central.push(row,name);offset+=local.length+name.length+bytes.length
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([...locals,directory,end])
}
