// Read-only public MediaWiki inventory for original ASHVEIL art research.
// Metadata/URLs only. Downloaded game images remain local reference material.
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createHash} from 'node:crypto'
const out=resolve(process.argv[2]??'test-results/wiki-resource-survey-v319')
mkdirSync(out,{recursive:true})
const endpoint='https://stoneshard.com/w/api.php',execute=promisify(execFile)
const pause=ms=>new Promise(done=>setTimeout(done,ms))
async function request(params){
 const url=endpoint+'?'+new URLSearchParams({action:'query',format:'json',maxlag:'5',...params})
 for(let attempt=0;attempt<4;attempt++){
  try{
   const {stdout}=await execute('curl',['-fsSL','--max-time','25','-A','ASHVEIL-original-art-reference-study/1.0 (read-only inventory)',url],{maxBuffer:20*1024*1024})
   const data=JSON.parse(stdout);if(data.error)throw Error(JSON.stringify(data.error))
   return{url,data}
  }catch(error){if(attempt===3)throw error;await pause(1500*(attempt+1))}
 }
}
const queries=[
 ['images','allimages',{aiprop:'url|size|sha1|mime',ailimit:'500'}],
 ['articles','allpages',{apnamespace:'0',apfilterredir:'nonredirects',aplimit:'500'}],
 ['categories','allcategories',{acprop:'size',aclimit:'500'}],
 ['file-usages','allfileusages',{afnamespace:'0',aflimit:'500',afprop:'ids|title'}],
]
const counts={}
for(const[name,list,params]of queries){
 const path=join(out,name+'.json'),progressPath=join(out,name+'-progress.json')
 let rows=[],continuation={},pages=0,complete=false
 if(existsSync(progressPath)){
  const saved=JSON.parse(readFileSync(progressPath,'utf8'));({continuation,pages,complete}=saved);rows=JSON.parse(readFileSync(path,'utf8'))
 }
 while(!complete){
  const {url,data}=await request({list,...params,...continuation})
  if(!Array.isArray(data.query?.[list]))throw Error(`Missing inventory ${name}: ${JSON.stringify(data).slice(0,400)}`)
  rows.push(...data.query[list]);pages++;continuation=data.continue??{};complete=!data.continue
  writeFileSync(path,JSON.stringify(rows,null,2)+'\n')
  writeFileSync(progressPath,JSON.stringify({endpoint,list,url,pages,continuation,complete,entries:rows.length,queriedAt:new Date().toISOString()},null,2)+'\n')
  console.log(`${name}: ${rows.length} entries, page ${pages}, complete=${complete}`)
  await pause(650)
 }
 counts[name]=rows.length
}
const site=await request({meta:'siteinfo',siprop:'general|statistics'})
writeFileSync(join(out,'site-statistics.json'),JSON.stringify(site.data,null,2)+'\n')
const categories=JSON.parse(readFileSync(join(out,'categories.json'),'utf8')).filter(category=>category.files>0),catalog=[]
mkdirSync(join(out,'category-files'),{recursive:true})
for(const category of categories){
 const key=createHash('sha256').update(category['*']).digest('hex').slice(0,16),path=join(out,'category-files',key+'.json')
 if(existsSync(path)){const saved=JSON.parse(readFileSync(path,'utf8'));if(saved.complete){catalog.push(saved);continue}}
 const rows=[];let continuation={}
 while(true){
  const {data}=await request({list:'categorymembers',cmtitle:'Category:'+category['*'],cmtype:'file',cmprop:'ids|title',cmlimit:'500',...continuation})
  if(!Array.isArray(data.query?.categorymembers))throw Error('Missing file category '+category['*'])
  rows.push(...data.query.categorymembers);if(!data.continue)break;continuation=data.continue;await pause(650)
 }
 const entry={title:category['*'],declaredFiles:category.files,complete:true,files:rows};catalog.push(entry);writeFileSync(path,JSON.stringify(entry,null,2)+'\n')
 console.log(`file categories: ${catalog.length}/${categories.length}, ${category['*']}: ${rows.length}`);await pause(650)
}
writeFileSync(join(out,'file-category-catalog.json'),JSON.stringify(catalog,null,2)+'\n')
writeFileSync(join(out,'inventory-audit.json'),JSON.stringify({endpoint,counts,fileCategories:catalog.length,complete:true,queriedAt:new Date().toISOString(),scope:'Complete current nonredirect main article titles, category inventory, uploaded file metadata, global file-usage records (join fromid to article pageid for main-namespace usage), and all nonempty file category memberships. Inventory completeness is not a claim that every pixel or animation has been visually reviewed.',externalPixelsInstalled:false},null,2)+'\n')
console.log(JSON.stringify({complete:true,counts}))
