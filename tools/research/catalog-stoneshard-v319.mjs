// Join complete metadata inventories; cache only selected visual-study files locally.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const execute=promisify(execFile),root=resolve(process.argv[2]??'test-results/wiki-resource-survey-v319')
const read=name=>JSON.parse(readFileSync(join(root,name+'.json'),'utf8'))
const images=read('images'),articles=read('articles'),categories=read('file-category-catalog'),usage=read('file-usages'),ids=new Map(articles.map(p=>[p.pageid,p.title]))
const normalize=name=>name.replace(/^File:/,'').replaceAll('_',' ').normalize('NFC')
const byFile=new Map(images.map(image=>[normalize(image.name),{...image,categories:[],articles:new Set()}]))
for(const category of categories)for(const file of category.files){const image=byFile.get(normalize(file.title));if(image)image.categories.push(category.title)}
for(const row of usage){const image=byFile.get(normalize(row.title)),article=ids.get(row.fromid);if(image&&article)image.articles.add(article)}
const rows=[...byFile.values()].map(image=>({...image,articles:[...image.articles].sort(),categories:image.categories.sort()}))
const enemyIndex=new Set()
if(existsSync(join(root,'enemy-page-images.json')))for(const image of read('enemy-page-images')){
 const parts=(image.src??'').split('/'),name=decodeURIComponent(parts[parts.includes('thumb')?parts.length-2:parts.length-1]??'')
 const row=byFile.get(normalize(name));if(row)enemyIndex.add(row.name)
}
writeFileSync(join(root,'joined-resource-inventory.json'),JSON.stringify({source:'https://stoneshard.com/wiki/Stoneshard_Wiki',queriedAt:new Date().toISOString(),counts:{images:rows.length,articles:articles.length,fileCategories:categories.length,allFileUsages:usage.length,mainArticleUsages:usage.filter(row=>ids.has(row.fromid)).length,uncategorizedImages:rows.filter(row=>!row.categories.length).length},images:rows},null,2)+'\n')
const excluded=/^(Achievement|Article images|Candidates|Frontpage|Images$|Images copyrighted|Images needing|Images not yet|Pages with|Skill Videos|Video$|Wiki)/
const visual=categories.filter(category=>!excluded.test(category.title)),selected=new Set()
for(const name of enemyIndex)selected.add(name)
for(const category of visual){
 const files=category.files.map(file=>byFile.get(normalize(file.title))).filter(image=>image&&['image/png','image/jpeg','image/gif','image/webp','image/svg+xml'].includes(image.mime)&&image.width>0&&image.height>0)
 if(/^(Enemy NPC images|NPC images|PC images)$/.test(category.title)){for(const image of files)selected.add(image.name)}
 else{const sorted=files.sort((a,b)=>a.width*a.height-b.width*b.height||a.name.localeCompare(b.name));for(const index of [0,Math.floor(sorted.length/2),Math.max(0,sorted.length-1)])if(sorted[index])selected.add(sorted[index].name)}
}
mkdirSync(join(root,'visual-cache'),{recursive:true})
const queue=rows.filter(image=>selected.has(image.name)),cached=[],failures=[]
async function worker(){while(queue.length){
 const image=queue.shift(),key=createHash('sha256').update(image.name).digest('hex').slice(0,20),extension=({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/svg+xml':'svg'})[image.mime],path=join(root,'visual-cache',key+'.'+extension)
 if(new URL(image.url).hostname!=='stoneshard.com')throw Error('Unexpected reference host')
 try{
  if(!existsSync(path))await execute('curl',['-fsSL','--retry','2','--retry-delay','1','--max-time','25','-o',path,image.url])
  cached.push({name:image.name,path:'visual-cache/'+key+'.'+extension,url:image.url,width:image.width,height:image.height,categories:image.categories,onEnemyIndex:enemyIndex.has(image.name),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})
 }catch(error){failures.push({name:image.name,error:String(error).slice(0,200)})}
 if((cached.length+failures.length)%25===0)console.log(`visual references ${cached.length}, failures ${failures.length}, remaining ${queue.length}`)
 await new Promise(done=>setTimeout(done,300))
}}
await Promise.all([worker(),worker()])
cached.sort((a,b)=>a.name.localeCompare(b.name))
writeFileSync(join(root,'visual-cache.json'),JSON.stringify({selected:selected.size,cached,failures,scope:'All categorized enemy/NPC/player files and three size-spaced examples from every other non-administrative visual file category. Local reference images only; none installed into ASHVEIL.'},null,2)+'\n')
const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const groups=[['enemies',cached.filter(image=>image.onEnemyIndex||image.categories.includes('Enemy NPC images'))],['npcs',cached.filter(image=>image.categories.includes('NPC images'))],['players',cached.filter(image=>image.categories.includes('PC images'))],['other',cached.filter(image=>!image.onEnemyIndex&&!image.categories.some(c=>['Enemy NPC images','NPC images','PC images'].includes(c)))]]
const pages=[]
for(const[group,entries]of groups)for(let start=0;start<entries.length;start+=30){
 const name=`contact-${group}-${String(start/30+1).padStart(2,'0')}.html`,slice=entries.slice(start,start+30)
 const cards=slice.map(image=>{const scale=Math.min(3,190/image.width,140/image.height);return`<article><div><img src="${escape(image.path)}" width="${Math.round(image.width*scale)}" height="${Math.round(image.height*scale)}"></div><a href="${escape(image.url)}">${escape(image.name)}</a><small>${image.width}×${image.height} · ${escape(image.categories.join(', '))}</small></article>`}).join('')
 writeFileSync(join(root,name),`<!doctype html><meta charset="utf-8"><title>Local reference study: ${group}</title><style>*{box-sizing:border-box}body{margin:0;background:#28282a;color:#c7bfae;font:11px sans-serif}header{height:46px;padding:10px}main{display:grid;grid-template-columns:repeat(6,220px)}article{height:205px;border:1px solid #454548;padding:8px;overflow:hidden}article div{height:146px;display:flex;align-items:center;justify-content:center}img{image-rendering:pixelated}a,small{display:block;color:#c7bfae;overflow-wrap:anywhere}small{font-size:9px;color:#96938b}</style><header>Stoneshard Wiki · local visual reference · ${group} ${start+1}–${start+slice.length} / ${entries.length} · Original images remain with their rightsholders</header><main>${cards}</main>`)
 pages.push({group,page:name,images:slice.map(image=>image.name)})
}
writeFileSync(join(root,'contact-pages.json'),JSON.stringify(pages,null,2)+'\n')
console.log(JSON.stringify({selected:selected.size,cached:cached.length,failures:failures.length,pages:pages.length,visualCategories:visual.length}))
