import {loadMods,requiredModClosure,type ModPackage} from '../core/defs'
import {canonicalContent,sha256} from '../core/load-hash'
import {modFromFiles,type ImportedMod} from './mod-archive'
import type {InstalledMod,ModDisk} from './mod-disk'

export interface ModInstallReview {token:string;id:string;name:string;version:string;previousVersion?:string;previousHash?:string;hash:string;loadedMods:string[];files:number;bytes:number;scripts:boolean;warnings:string[];format:ImportedMod['format']}
const filesDigest=(files:Record<string,string>)=>sha256(JSON.stringify(Object.entries(files).sort(([a],[b])=>a<b?-1:a>b?1:0)))
const parseRecord=(record:InstalledMod)=>{
 if(!record||typeof record.id!=='string'||!record.files||typeof record.files!=='object'||Object.values(record.files).some(value=>typeof value!=='string')||record.digest!==filesDigest(record.files))throw Error('설치된 모드 원문 체크섬이 다르다')
 const imported=modFromFiles(Object.entries(record.files).map(([path,source])=>({path,bytes:new TextEncoder().encode(source)})),record.format)
 if(imported.id!==record.id)throw Error('설치된 모드 ID와 원문이 다르다')
 return imported
}
/** 설치는 사용 가능한 패키지만 갱신한다. 활성 모드·현재 World·각인은 호출자가 명시적으로 선택한다. */
export function createModInstallation(packages:ModPackage[],disk:ModDisk,changed:()=>void,inspectScripts:(db:ReturnType<typeof loadMods>['db'])=>Promise<void>){
 const bundled=new Map(packages.map(pkg=>[pkg.manifest.id,pkg])),installed=new Map<string,InstalledMod>()
 let epoch=0,revision=0,busy=false,initialized=false,initializing:Promise<void>|undefined,pending:{review:ModInstallReview;record:InstalledMod;catalog:string}|null=null
 const catalogKey=()=>sha256(canonicalContent(packages))
 function publish(){for(const[id,record]of installed){const parsed=parseRecord(record).package,index=packages.findIndex(p=>p.manifest.id===id);if(index<0)packages.push(parsed);else packages[index]=parsed}revision++;pending=null;changed()}
 async function readCatalog(){
  const state=await disk.read(),rows=state.records.map(record=>structuredClone(record)),ids=new Set<string>();for(const row of rows){parseRecord(row);if(ids.has(row.id))throw Error('설치된 모드 ID가 중복되었다');ids.add(row.id)}
  for(const id of installed.keys())if(!ids.has(id)){const index=packages.findIndex(pkg=>pkg.manifest.id===id),original=bundled.get(id);if(index>=0){if(original)packages[index]=original;else packages.splice(index,1)}}
  installed.clear();for(const row of rows)installed.set(row.id,row);epoch=state.epoch;publish();initialized=true
 }
 async function initialize(){
  if(initialized)return
  return initializing??=readCatalog().catch(error=>{initializing=undefined;throw error})
 }
 async function validate(record:InstalledMod){
  const imported=parseRecord(record),manifest=imported.package.manifest
  if(typeof manifest.name!=='string'||!manifest.name.trim()||typeof manifest.version!=='string'||!manifest.version.trim())throw Error('manifest 이름과 버전이 필요하다')
  const candidate=packages.filter(pkg=>pkg.manifest.id!==record.id).concat(imported.package),selected=requiredModClosure(candidate,[record.id]),{db,report}=loadMods(candidate,selected)
  if(report.errors.length)throw Error('모드 검증 실패:\n'+report.errors.join('\n'))
  await inspectScripts(db)
  const own=db.modManifest()?.find(p=>p.id===record.id);if(!own)throw Error('검증한 패키지 해시가 없다')
  return{imported,db,report,own}
 }
 return{
  initialize,
  async reload(){if(busy)throw Error('다른 모드 작업을 마쳐야 한다');busy=true;try{await initialize();await readCatalog()}finally{busy=false}},
  installed:()=>[...installed.values()].map(row=>({id:row.id,format:row.format})),
  cancel(){pending=null},
  async review(input:ImportedMod):Promise<ModInstallReview>{
   if(busy)throw Error('다른 모드 작업을 마쳐야 한다');busy=true;pending=null
   try{
    await initialize();const record:InstalledMod={id:input.id,files:structuredClone(input.files),digest:filesDigest(input.files),format:input.format},key=catalogKey(),at=revision,{imported,db,report,own}=await validate(record)
    if(at!==revision||key!==catalogKey())throw Error('검사 중 모드 목록이 바뀌었다. 다시 검토해야 한다')
    const previous=packages.find(pkg=>pkg.manifest.id===record.id),previousDb=previous?loadMods(packages,requiredModClosure(packages,[record.id])).db:undefined
    const review:ModInstallReview={token:sha256(record.digest+'\n'+epoch+'\n'+revision+'\n'+key),id:record.id,name:imported.package.manifest.name,version:own.version,previousVersion:previous?.manifest.version,previousHash:previousDb?.modManifest()?.find(p=>p.id===record.id)?.hash,hash:own.hash,loadedMods:[...db.loadedMods],files:Object.keys(record.files).length,bytes:imported.bytes,scripts:!!db.scriptSources.length,warnings:[...report.warnings],format:record.format}
    pending={review:structuredClone(review),record,catalog:key};return structuredClone(review)
   }finally{busy=false}
  },
  async install(token:string){
   if(busy)throw Error('다른 모드 작업을 마쳐야 한다');const candidate=pending
   if(!candidate||candidate.review.token!==token)throw Error('설치할 모드를 다시 검토해야 한다')
   busy=true
   try{
    if(candidate.catalog!==catalogKey())throw Error('검토 뒤 모드 목록이 바뀌었다. 다시 검토해야 한다')
    const at=revision;await validate(candidate.record)
    if(pending!==candidate||at!==revision||candidate.catalog!==catalogKey())throw Error('검토 뒤 모드 목록이 바뀌었다. 다시 검토해야 한다')
    epoch=await disk.change(epoch,candidate.record.id,candidate.record)
    installed.set(candidate.record.id,candidate.record);publish()
   }finally{busy=false}
  },
  async remove(id:string){
   if(busy)throw Error('다른 모드 작업을 마쳐야 한다');busy=true
   try{await initialize();if(!installed.has(id))throw Error('직접 설치한 모드가 아니다');epoch=await disk.change(epoch,id,null);installed.delete(id);const index=packages.findIndex(p=>p.manifest.id===id),original=bundled.get(id);if(index>=0){if(original)packages[index]=original;else packages.splice(index,1)}publish()}finally{busy=false}
  }
 }
}
