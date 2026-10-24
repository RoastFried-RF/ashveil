/** Extract the parent's exact calibration without a renderer, GPU, Assets or Pixi runtime. */
import {readFileSync} from 'node:fs'
import {resolve,dirname,relative,basename} from 'node:path'
import {createHash} from 'node:crypto'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {RIG} from '../../src/client/render/articulated-gait'
import type {RigSpec,RigDirectionSpec} from '../../src/client/render/rig-spec'

const root=resolve(import.meta.dirname,'../..'),modelPath=resolve(root,'tools/art/sower-pixi-v360/models.ts')
const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex')
const read=(file:string)=>JSON.parse(readFileSync(file,'utf8'))
type Frame=[string,number,number,number,number]
const groups=[
 {dir:'tools/art/direction-v356/front-original'},
 {dir:'tools/art/direction-v362/directional-original'},
 {dir:'tools/art/direction-v360/work-original'},
 {dir:'tools/art/direction-v362/work-original'},
]
const fragment={sheets:{} as Record<string,string>,sheetSizes:{} as Record<string,[number,number]>,frames:{} as Record<string,Frame>}
const originals:{source:string;path:string;sha256:string;size:[number,number]}[]=[]
const selections:{historicalFrameKey:string;frame:string;source:string;crop:number[]}[]=[]
const sourceByHash=new Map<string,string>(),frameByRect=new Map<string,string>()
for(const group of groups){
 const stage=resolve(root,group.dir),source=read(resolve(stage,'sprites.fragment.json')) as typeof fragment
 const sheetSources=new Map<string,string>()
 for(const [sheet,url]of Object.entries(source.sheets)){
  const file=resolve(stage,'originals',basename(url)),sha256=hash(file),registered=sheet.replace(/^held_av\d+_/,'av364_'),path='sprites/original/direction-v364/'+basename(file)
  sheetSources.set(sheet,file);sourceByHash.set(sha256,file)
  fragment.sheets[registered]=path;fragment.sheetSizes[registered]=source.sheetSizes[sheet]
  originals.push({source:relative(root,file),path:'public/'+path,sha256,size:source.sheetSizes[sheet]})
 }
 for(const [historicalFrameKey,rect]of Object.entries(source.frames)){
  const frame=historicalFrameKey.replace(/^held_av\d+_/,'av364_'),file=sheetSources.get(rect[0])!
  if(fragment.frames[frame])throw Error('Duplicate rig frame '+frame)
  fragment.frames[frame]=[rect[0].replace(/^held_av\d+_/,'av364_'),...rect.slice(1)] as Frame
  frameByRect.set(JSON.stringify([file,...rect.slice(1)]),frame)
  selections.push({historicalFrameKey,frame,source:relative(root,file),crop:rect.slice(1) as number[]})
 }
}
if(selections.length!==30||originals.length!==8)throw Error('Expected8 originals/30 clean regions')

// The model's prepareModels only constructs texture views and plain calibration.
// These stand-ins never import Pixi or decode/rewrite any image.
class Rectangle {constructor(public x:number,public y:number,public width:number,public height:number){}}
class Texture {constructor(public options:{source:{file:string;scaleMode?:string};frame:Rectangle}){}get source(){return this.options.source}get frame(){return this.options.frame}}
const Assets={load:async(url:string)=>{
 const file=sourceByHash.get(hash(url));if(!file)throw Error('Unregistered source import '+url)
 return{source:{file,scaleMode:'nearest'}}
}}
const exports={} as {prepareModels:()=>Promise<{models:Record<string,{
 art:{textures:Record<'body'|'upper'|'lower'|'foot',Texture>;body:RigDirectionSpec['art']['body'];upper:RigDirectionSpec['art']['upper'];lower:RigDirectionSpec['art']['lower'];foot:RigDirectionSpec['art']['foot']}
 layout:RigDirectionSpec['layout'];work:({texture:Texture}&Omit<RigDirectionSpec['work'][number],'frame'>)[]
}>}>}
const source=readFileSync(modelPath,'utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
runInNewContext(compiled,{exports,require:(name:string)=>{
 if(name==='pixi.js')return{Assets,Rectangle,Texture}
 if(name.endsWith('/articulated-gait'))return{RIG}
 if(name.endsWith('?url'))return resolve(dirname(modelPath),name.slice(0,-4))
 if(name.endsWith('.json'))return read(resolve(dirname(modelPath),name))
 throw Error('Unsupported model dependency '+name)
}},{filename:modelPath,timeout:1000})
const {models}=await exports.prepareModels()
const frame=(texture:Texture)=>{
 const r=texture.frame,key=frameByRect.get(JSON.stringify([texture.source.file,r.x,r.y,r.width,r.height]))
 if(!key)throw Error('Unselected/held raw crop requested by parent model')
 return key
}
const directions={} as RigSpec['directions']
for(const [dir,facing]of [['down','front'],['left','left'],['right','right'],['up','back']] as const){
 const model=models[facing]
 directions[dir]={art:{body:{...model.art.body,frame:frame(model.art.textures.body)},upper:{...model.art.upper,frame:frame(model.art.textures.upper)},lower:{...model.art.lower,frame:frame(model.art.textures.lower)},foot:{...model.art.foot,frame:frame(model.art.textures.foot)}},layout:model.layout,work:model.work.map(({texture,...pose})=>({...pose,frame:frame(texture)}))}
}
console.log(JSON.stringify({rig:{directions} satisfies RigSpec,fragment,originals,selections,calibrationSource:{path:relative(root,modelPath),sha256:hash(modelPath),gaitSource:{path:'src/client/render/articulated-gait.ts',sha256:hash(resolve(root,'src/client/render/articulated-gait.ts'))},method:'Parent prepareModels executed with inert metadata-only texture/rectangle stand-ins; no Pixi, PNG decoding, browser, GPU or gait simulation.',physicalHipObserved:{LF:null,RF:null,LH:null,RH:null},layoutKind:'Parent view-specific2.5D design calibration; graphic registration points are not physical hips.'}}))
