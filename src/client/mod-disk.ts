export interface InstalledMod {id:string;files:Record<string,string>;digest:string;format:'zip'|'tar.gz'|'folder'}
export interface ModDiskState {epoch:number;records:InstalledMod[]}
export interface ModDisk {
 read():Promise<ModDiskState>
 change(epoch:number,id:string,record:InstalledMod|null):Promise<number>
}
/** 각인 DB와 분리하며, 다른 탭의 설치를 덮어쓰지 않도록 같은 트랜잭션에서 세대를 비교한다. */
export function browserModDisk():ModDisk{
 let opened:Promise<IDBDatabase>|undefined
 function open(){return opened??=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('ashveil.mod-packages',1)
  request.onupgradeneeded=()=>request.result.createObjectStore('packages')
  request.onerror=()=>{opened=undefined;reject(request.error??Error('모드 저장소를 열 수 없다'))}
  request.onblocked=()=>{opened=undefined;reject(Error('다른 창의 모드 저장소 작업을 마쳐야 한다'))}
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opened=undefined};resolve(db)}
 })}
 return{
  async read(){const db=await open();return new Promise<ModDiskState>((resolve,reject)=>{
   const tx=db.transaction('packages','readonly'),store=tx.objectStore('packages'),epoch=store.get('@catalog'),records=store.getAll()
   tx.oncomplete=()=>resolve({epoch:epoch.result??0,records:records.result.filter((row):row is InstalledMod=>typeof row==='object'&&row!==null)})
   tx.onabort=()=>reject(tx.error??Error('설치된 모드를 읽을 수 없다'))
   tx.onerror=()=>{}
  })},
  async change(epoch,id,record){const db=await open();return new Promise<number>((resolve,reject)=>{
   const tx=db.transaction('packages','readwrite',{durability:'strict'}),store=tx.objectStore('packages'),current=store.get('@catalog');let stale=false
   current.onsuccess=()=>{if((current.result??0)!==epoch){stale=true;tx.abort();return}if(record)store.put(record,id);else store.delete(id);store.put(epoch+1,'@catalog')}
   tx.oncomplete=()=>resolve(epoch+1)
   tx.onabort=()=>reject(stale?Error('다른 창에서 모드 목록을 바꾸었다. 목록을 다시 읽고 검토해야 한다'):tx.error??Error('모드를 저장하지 못했다'))
   tx.onerror=()=>{}
  })}
 }
}
