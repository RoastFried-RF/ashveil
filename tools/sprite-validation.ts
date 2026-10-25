// 클라이언트 자산 계약을 디스크에서 검사한다. 코어/세계/스크립트는 실행하지 않는다.
import {readFileSync,statSync} from 'node:fs'
import {resolve,relative,isAbsolute} from 'node:path'
import {checkedModTextures} from '../src/core/mod-textures'
import {motionNames} from '../src/client/render/character-motion'
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
 if(manifest.characterSheetHistory!==undefined&&(!Array.isArray(manifest.characterSheetHistory)||manifest.characterSheetHistory.some(key=>typeof key!=='string'||!Object.hasOwn(sheets,key))))errors.push('characterSheetHistory: 등록된 sheet 목록이 필요하다')
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
 const crawlerSpec=(value:unknown,where:string)=>{
  if(!object(value)||!object(value.art)||!object(value.layout)){errors.push(where+': art/layout 지네 구성이 필요하다');return}
  const point=(v:unknown,path:string,rect:unknown)=>{
   if(!object(v)||typeof v.x!=='number'||typeof v.y!=='number'||!Number.isFinite(v.x)||!Number.isFinite(v.y)){errors.push(path+': 유한한 x/y 원문 좌표가 필요하다');return false}
   if(Array.isArray(rect)&&(v.x<0||v.y<0||v.x>rect[3]||v.y>rect[4]))errors.push(path+': 등록 frame을 벗어난다')
   return true
  }
  for(const name of ['headClosed','headOpen','middle','tail','upper','lower']){
   const p=value.art[name],path=where+'.art.'+name
   if(!object(p)){errors.push(path+': 독립 원문 부품이 필요하다');continue}
   if(typeof p.frame!=='string'||!Object.hasOwn(frames,p.frame))errors.push(path+'.frame: 등록된 frame이 필요하다')
   const rect=typeof p.frame==='string'?frames[p.frame]:undefined
   const keys=['upper','lower'].includes(name)?['proximal','distal']:['middle','tail'].includes(name)?['pivot','left','right']:['pivot']
   for(const key of keys)point(p[key],path+'.'+key,rect)
   const pair=['middle','tail'].includes(name)?['left','right']:keys,a=p[pair[0]],b=p[pair[1]]
   if(pair[1]&&object(a)&&object(b)&&a.x===b.x&&a.y===b.y)errors.push(path+': 등록 축의 두 점이 같을 수 없다')
  }
  for(const key of ['bodyScale','headScale','pitch','firstOffset','tailOffset','upper','lower','outreach','stride','swingTravel','settleSeconds','ceilingLift']){
   const n=value.layout[key];if(typeof n!=='number'||!Number.isFinite(n)||n<=0)errors.push(where+'.layout.'+key+': 유한한 양수가 필요하다')
  }
  if(typeof value.layout.stride==='number'&&typeof value.layout.swingTravel==='number'&&value.layout.swingTravel>=value.layout.stride)errors.push(where+'.layout: 회복 거리는 보행 주기보다 작아야 한다')
 }
 const cullerSpec=(value:unknown,where:string)=>{
  const finite=(v:unknown,path:string,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||positive&&v<=0){errors.push(path+': 유한한 '+(positive?'양수':'수')+'가 필요하다');return false}return true}
  const point=(v:unknown,path:string,frame?:unknown)=>{if(!object(v)){errors.push(path+': x/y 좌표가 필요하다');return}if(!finite(v.x,path+'.x')||!finite(v.y,path+'.y'))return;const rect=typeof frame==='string'?frames[frame]:undefined;if(Array.isArray(rect)&&((v.x as number)<0||(v.y as number)<0||(v.x as number)>rect[3]||(v.y as number)>rect[4]))errors.push(path+': frame 범위를 벗어난다')}
  if(!object(value)||!object(value.directions)||!object(value.attackTools)){errors.push(where+': directions/attackTools 구성이 필요하다');return}
  for(const [mode,tool]of Object.entries(value.attackTools))if(!mode||!['left','right','acid','net'].includes(String(tool)))errors.push(where+'.attackTools.'+mode+': left/right/acid/net 중 하나가 필요하다')
  for(const dir of directions){
   const d=value.directions[dir],path=where+'.directions.'+dir
   if(!object(d)||!object(d.art)||!object(d.layout)){errors.push(path+': 방향별 art/layout가 필요하다');continue}
   if(d.physical3DVerified!==false)errors.push(path+': physical3DVerified:false가 필요하다')
   for(const name of ['chassis','driveUpper','driveLower','foot','scytheUpper','scytheBlade']){
    const a=d.art[name],partPath=path+'.art.'+name;if(!object(a)){errors.push(partPath+': 원문 부품이 필요하다');continue}
    if(typeof a.frame!=='string'||!Object.hasOwn(frames,a.frame))errors.push(partPath+'.frame: 등록된 원문 frame이 필요하다')
    const keys=name==='chassis'?['pivot']:name==='foot'?['ankle','sole']:name==='scytheBlade'?['proximal','tip']:['proximal','distal']
    for(const key of keys)point(a[key],partPath+'.'+key,a.frame)
    const x=a[keys[0]],y=a[keys[1]];if(keys[1]&&object(x)&&object(y)&&x.x===y.x&&x.y===y.y)errors.push(partPath+': 서로 다른 두 원문점이 필요하다')
    if(name==='chassis'||name==='foot')finite(a.scale,partPath+'.scale',true)
    if(name==='chassis')point(a.offset,partPath+'.offset')
   }
   const L=d.layout
   for(const key of ['upper','lower','stride','swingTravel','settleSeconds','clearance','deathLower'])finite(L[key],path+'.layout.'+key,true)
   if(typeof L.stride==='number'&&typeof L.swingTravel==='number'&&L.swingTravel>=L.stride)errors.push(path+'.layout: 회복 거리는 주기보다 작아야 한다')
   if(!object(L.legs))errors.push(path+'.layout.legs: 여섯 구동 소유가 필요하다')
   else for(const id of ['DriveRF','DriveRM','DriveRH','DriveLF','DriveLM','DriveLH']){const p=L.legs[id],legPath=path+'.layout.legs.'+id;if(!object(p)){errors.push(legPath+': 독립 drive가 필요하다');continue}for(const key of ['hip','sole','bend'])point(p[key],legPath+'.'+key);for(const key of ['far','mirror'])if(typeof p[key]!=='boolean')errors.push(legPath+'.'+key+': boolean이 필요하다')}
   if(!object(L.tools))errors.push(path+'.layout.tools: 좌우 낫 소유가 필요하다')
   else for(const id of ['left','right']){const p=L.tools[id],toolPath=path+'.layout.tools.'+id;if(!object(p)){errors.push(toolPath+': 독립 낫이 필요하다');continue}point(p.shoulder,toolPath+'.shoulder');for(const key of ['upper','blade'])finite(p[key],toolPath+'.'+key,true);for(const key of ['guard','windup','follow','dead'])if(!Array.isArray(p[key])||p[key].length!==2||p[key].some(n=>typeof n!=='number'||!Number.isFinite(n)))errors.push(toolPath+'.'+key+': 유한한 각도2개가 필요하다');for(const key of ['far','mirror'])if(typeof p[key]!=='boolean')errors.push(toolPath+'.'+key+': boolean이 필요하다')}
   if(!object(L.emitters))errors.push(path+'.layout.emitters: acid/net 표시 기부가 필요하다');else for(const key of ['acid','net'])point(L.emitters[key],path+'.layout.emitters.'+key)
  }
 }
 const rigSpec=(value:unknown,where:string)=>{
  const number=(v:unknown,path:string,minimum?:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||(minimum!==undefined&&v<=minimum)){errors.push(path+': 유한한 '+(minimum===undefined?'수':'양수')+'가 필요하다');return false}return true}
  const point=(v:unknown,path:string,frame?:unknown)=>{
   if(!object(v)||!number(v.x,path+'.x')||!number(v.y,path+'.y')){if(!object(v))errors.push(path+': 유한한 x/y 좌표가 필요하다');return false}
   const rect=typeof frame==='string'?frames[frame]:undefined
   if(Array.isArray(rect)&&typeof rect[3]==='number'&&typeof rect[4]==='number'&&((v.x as number)<0||(v.y as number)<0||(v.x as number)>rect[3]||(v.y as number)>rect[4]))errors.push(path+': 원본 frame 좌표 범위를 벗어난다')
   return true
  }
  const pair=(v:unknown,path:string,frame?:unknown)=>{
   if(!Array.isArray(v)||v.length!==2){errors.push(path+': 두 등록점이 필요하다');return}
   if(point(v[0],path+'[0]',frame)&&point(v[1],path+'[1]',frame)&&v[0].x===v[1].x&&v[0].y===v[1].y)errors.push(path+': 서로 다른 등록점이 필요하다')
  }
  const part=(v:unknown,path:string)=>{
   if(!object(v)){errors.push(path+': 원본 부품 객체가 필요하다');return null}
   if(typeof v.frame!=='string'||!Object.hasOwn(frames,v.frame))errors.push(path+'.frame: 등록된 frame이 필요하다')
   return v
  }
  if(!object(value)||!object(value.directions)){errors.push(where+': 네 방향 rig 객체가 필요하다');return}
  for(const dir of directions){
   const view=value.directions[dir],path=where+'.directions.'+dir
   if(!object(view)){errors.push(path+': 방향별 rig가 필요하다');continue}
   if(!object(view.art))errors.push(path+'.art: body/upper/lower/foot 원본이 필요하다')
   else for(const name of ['body','upper','lower','foot']){
    const p=part(view.art[name],path+'.art.'+name);if(!p)continue
    if(name==='upper'||name==='lower'){
     pair([p.proximal,p.distal],path+'.art.'+name+'.pins',p.frame);number(p.thickness,path+'.art.'+name+'.thickness',0)
    }else{point(p[name==='body'?'pivot':'ankle'],path+'.art.'+name+'.'+(name==='body'?'pivot':'ankle'),p.frame);number(p.scale,path+'.art.'+name+'.scale',0)}
   }
   const layout=view.layout
   if(!object(layout))errors.push(path+'.layout: 유한한 2.5D 설계 좌표가 필요하다')
   else{
    for(const name of ['stride','swingTravel','swingSeconds','upper','lower','hipHeight','ankleHeight'])number(layout[name],path+'.layout.'+name,0)
    number(layout.soleX,path+'.layout.soleX');number(layout.clearance,path+'.layout.clearance')
    if(typeof layout.clearance==='number'&&layout.clearance<0)errors.push(path+'.layout.clearance: 음수일 수 없다')
    point(layout.com,path+'.layout.com')
    if(!object(layout.legs))errors.push(path+'.layout.legs: LF/RF/LH/RH 기부/발 설계가 필요하다')
    else for(const id of ['LF','RF','LH','RH']){
     const leg=layout.legs[id],legPath=path+'.layout.legs.'+id
     if(!object(leg)){errors.push(legPath+': 다리 설계가 필요하다');continue}
     point(leg.hip,legPath+'.hip');point(leg.sole,legPath+'.sole')
     if(leg.side!==-1&&leg.side!==1)errors.push(legPath+'.side: -1 또는1이 필요하다')
     if(typeof leg.far!=='boolean')errors.push(legPath+'.far: boolean이 필요하다')
    }
   }
   if(!Array.isArray(view.work)||!view.work.length)errors.push(path+'.work: 비어 있지 않은 차체 목록이 필요하다')
   else for(const [index,entry]of view.work.entries()){
    const entryPath=path+'.work['+index+']',p=part(entry,entryPath);if(!p)continue
    point(p.pivot,entryPath+'.pivot',p.frame);number(p.scale,entryPath+'.scale',0)
    if(p.key!==undefined&&(typeof p.key!=='string'||!p.key))errors.push(entryPath+'.key: 비어 있지 않은 문자열이 필요하다')
    if(p.registration!==undefined){if(!object(p.registration))errors.push(entryPath+'.registration: source/target 등록점이 필요하다');else{pair(p.registration.source,entryPath+'.registration.source',p.frame);pair(p.registration.target,entryPath+'.registration.target')}}
   }
  }
 }
 for(const[key,row]of Object.entries(anims)){
  counts.animations++;if(!object(row)){errors.push('anim '+key+': 객체가 필요하다');continue}
  frameList(row.frames,'anim '+key)
  if(typeof row.fps!=='number'||!Number.isFinite(row.fps)||row.fps<=0)errors.push('anim '+key+': fps는 양수여야 한다')
  if(row.anchors!==undefined){
   if(!object(row.anchors))errors.push('anim '+key+'.anchors: frame별 정규화 좌표 객체가 필요하다')
   else{
    const keys=Array.isArray(row.frames)?row.frames:[]
    for(const[frame,anchor]of Object.entries(row.anchors)){
     if(!Object.hasOwn(frames,frame)||!keys.includes(frame))errors.push('anim '+key+'.anchors.'+frame+': 이 anim에 등록된 frame이 필요하다')
     if(!Array.isArray(anchor)||anchor.length!==2||!anchor.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1))errors.push('anim '+key+'.anchors.'+frame+': 0~1의 유한 좌표2개가 필요하다')
    }
    for(const frame of keys)if(typeof frame==='string'&&!Object.hasOwn(row.anchors,frame))errors.push('anim '+key+'.anchors.'+frame+': 모든 프레임에 앵커가 필요하다')
   }
   if(row.renderScale!==undefined&&(typeof row.renderScale!=='number'||!Number.isFinite(row.renderScale)||row.renderScale<=0))errors.push('anim '+key+'.renderScale: 앵커 원본을 표시할 양수 배율이 필요하다')
  }
 }
 for(const[key,row]of Object.entries(chars)){
  counts.characters++
  if(!object(row)){errors.push('char '+key+': 객체가 필요하다');continue}
  for(const mode of['walk','idle',...(row.attack!==undefined?['attack']:[])]){const poses=row[mode];if(!object(poses)){errors.push('char '+key+'.'+mode+': 방향별 객체가 필요하다');continue}for(const dir of directions)frameList(poses[dir],'char '+key+'.'+mode+'.'+dir)}
  for(const name of['anchor',...(row.attackAnchor!==undefined?['attackAnchor']:[])]){const anchor=row[name];if(!Array.isArray(anchor)||anchor.length!==2||!anchor.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1))errors.push('char '+key+'.'+name+': 0~1의 좌표2개가 필요하다')}
  for(const name of['renderScale','headOffset','healthBarWidth'])if(row[name]!==undefined&&(typeof row[name]!=='number'||!Number.isFinite(row[name])||row[name]<=0))errors.push('char '+key+'.'+name+': 양수여야 한다')
  if(row.portrait!==undefined&&(typeof row.portrait!=='string'||!Object.hasOwn(frames,row.portrait)))errors.push('char '+key+'.portrait: 등록된 frame이 필요하다')
  if(row.heldItems!==undefined&&typeof row.heldItems!=='boolean')errors.push('char '+key+'.heldItems: boolean이 필요하다')
  if(row.rig!==undefined)rigSpec(row.rig,'char '+key+'.rig')
  if(row.crawler!==undefined){crawlerSpec(row.crawler,'char '+key+'.crawler');if(row.rig!==undefined)errors.push('char '+key+': rig/crawler 두 표시 소유자를 동시에 가질 수 없다')}
  if(row.culler!==undefined){cullerSpec(row.culler,'char '+key+'.culler');if(row.rig!==undefined||row.crawler!==undefined)errors.push('char '+key+': culler와 다른 표시 소유자를 동시에 가질 수 없다')}
  const gait=row.gait
  const durations=row.motionDurations
  if(durations!==undefined&&(!object(durations)||Object.entries(durations).some(([name,ms])=>!(motionNames as readonly string[]).includes(name)||typeof ms!=='number'||!Number.isFinite(ms)||ms<200||ms>5000)))errors.push('char '+key+'.motionDurations: 실제 동작과200~5000ms 주기가 필요하다')
  if(gait!==undefined&&(!object(gait)||!['walk','crouchWalk'].every(name=>typeof gait[name]==='number'&&Number.isFinite(gait[name])&&gait[name]>=200&&gait[name]<=5000)))errors.push('char '+key+'.gait: 동작별200~5000ms 주기가 필요하다')
  if(row.attackVariants!==undefined){
   if(!object(row.attackVariants))errors.push('char '+key+'.attackVariants: 공격 방식별 객체가 필요하다')
   else for(const[name,poses]of Object.entries(row.attackVariants)){if(!object(poses))errors.push('char '+key+'.attackVariants.'+name+': 방향별 객체가 필요하다');else for(const dir of directions)frameList(poses[dir],'char '+key+'.attackVariants.'+name+'.'+dir)}
  }
  if(row.motions!==undefined){
   if(!object(row.motions))errors.push('char '+key+'.motions: 동작별 객체가 필요하다')
   else for(const[name,poses]of Object.entries(row.motions)){
    if(!(motionNames as readonly string[]).filter(mode=>!['idle','walk','attack'].includes(mode)).includes(name))errors.push('char '+key+'.motions: 알 수 없는 동작 '+name)
    if(!object(poses))errors.push('char '+key+'.motions.'+name+': 방향별 객체가 필요하다')
    else for(const dir of directions)frameList(poses[dir],'char '+key+'.motions.'+name+'.'+dir)
   }
  }
  if(row.frameTransforms!==undefined){
   if(!object(row.frameTransforms))errors.push('char '+key+'.frameTransforms: 포즈별 객체가 필요하다')
   else for(const[frame,value]of Object.entries(row.frameTransforms)){
    if(!Object.hasOwn(frames,frame)||!object(value)||!Array.isArray(value.anchor)||value.anchor.length!==2||!value.anchor.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)||typeof value.scale!=='number'||!Number.isFinite(value.scale)||value.scale<=0)errors.push('char '+key+'.frameTransforms.'+frame+': 실제 frame/0~1발 위치/양수 배율이 필요하다')
    if(object(value)&&value.mainHand!==undefined&&(!Array.isArray(value.mainHand)||value.mainHand.length!==2||!value.mainHand.every(n=>typeof n==='number'&&Number.isFinite(n))))errors.push('char '+key+'.frameTransforms.'+frame+'.mainHand: 유한 좌표2개가 필요하다')
    if(object(value)&&value.flipX!==undefined&&typeof value.flipX!=='boolean')errors.push('char '+key+'.frameTransforms.'+frame+'.flipX: boolean이 필요하다')
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
