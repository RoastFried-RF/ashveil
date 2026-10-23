// All main article category memberships identify files that lack direct file categories.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const execute=promisify(execFile),out=resolve(process.argv[2]??'test-results/wiki-resource-survey-v319'),articles=JSON.parse(readFileSync(join(out,'articles.json'),'utf8')),dir=join(out,'article-categories')
mkdirSync(dir,{recursive:true});const batches=Array.from({length:Math.ceil(articles.length/50)},(_,i)=>({index:i,ids:articles.slice(i*50,(i+1)*50).map(p=>p.pageid)})),results=[]
async function worker(){while(batches.length){
 const batch=batches.shift(),path=join(dir,String(batch.index).padStart(3,'0')+'.json')
 if(existsSync(path)){results.push(...JSON.parse(readFileSync(path,'utf8')));continue}
 const pages=new Map();let continuation={}
 while(true){
  const url='https://stoneshard.com/w/api.php?'+new URLSearchParams({action:'query',format:'json',maxlag:'5',prop:'categories',pageids:batch.ids.join('|'),cllimit:'500',...continuation})
  const{stdout}=await execute('curl',['-fsSL','--retry','2','--retry-delay','1','--max-time','25','-A','ASHVEIL-original-art-reference-study/1.0',url],{maxBuffer:20*1024*1024}),data=JSON.parse(stdout)
  if(data.error||!data.query?.pages)throw Error(JSON.stringify(data.error??data).slice(0,300))
  for(const page of Object.values(data.query.pages)){const prior=pages.get(page.pageid)??{pageid:page.pageid,title:page.title,categories:new Set()};for(const c of page.categories??[])prior.categories.add(c.title.replace(/^Category:/,''));pages.set(page.pageid,prior)}
  if(!data.continue)break;continuation=data.continue;await new Promise(done=>setTimeout(done,650))
 }
 const rows=[...pages.values()].map(page=>({...page,categories:[...page.categories].sort()}));writeFileSync(path,JSON.stringify(rows,null,2)+'\n');results.push(...rows)
 console.log(`article category batches ${batch.index+1}/${Math.ceil(articles.length/50)}, accumulated ${results.length}`);await new Promise(done=>setTimeout(done,650))
}}
await Promise.all([worker(),worker()]);results.sort((a,b)=>a.pageid-b.pageid)
writeFileSync(join(out,'article-categories.json'),JSON.stringify({complete:results.length===articles.length,expected:articles.length,pages:results},null,2)+'\n');console.log(JSON.stringify({complete:results.length===articles.length,pages:results.length}))
