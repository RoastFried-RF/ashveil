/** Native canvas contact sheets of every registered pose for visual review. No source pixel edits. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {startNativePreview} from './native-preview'
const out=process.argv[2]??'test-results/animation-v322/pose-sheets';mkdirSync(out,{recursive:true})
const server=await startNativePreview(4354),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium'}),page=await browser.newPage({viewport:{width:1660,height:1840}})
try{
 await page.goto(server.url)
 const results=await page.evaluate(async()=>{
  const data=await(await fetch('artbook/motion/catalog.json')).json(),set=data.after,images=new Map<string,HTMLImageElement>(),results:{name:string;roles:string[];modes:string[]}[]=[]
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#282b2d;color:#ddcfb2;font:16px monospace;overflow:auto'
  const groups={locomotion:['walk','idle'],combat:['attack','block','hurt'],active:['crouchWalk','work','use'],ground:['fall','sleep'],ranged:['shoot','throw','interact']}
  for(const[group,modes]of Object.entries(groups))for(let start=0;start<data.roles.length;start+=4){
   const roles=data.roles.slice(start,start+4).filter((role:string)=>group!=='ranged'||set.characters[role].motions.shoot),name=group+'-'+start;if(!roles.length)continue
   const canvas=document.createElement('canvas');canvas.id=name;canvas.width=1660;canvas.height=roles.length*440;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#282b2d';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='15px monospace';ctx.fillStyle='#ddcfb2'
   for(let ri=0;ri<roles.length;ri++){
    const role=roles[ri],c=set.characters[role],zoom=Math.min(2.8,76/c.headOffset)
    ctx.fillText(role+' / '+modes.join(' · '),8,ri*440+18)
    for(let di=0;di<4;di++){
     const dir=['down','left','right','up'][di];let index=0;ctx.fillText(dir,5,ri*440+di*100+75)
     for(const mode of modes){const clip=c[mode]?.[dir]??c.motions?.[mode]?.[dir];if(!clip)continue
      for(const key of clip){const f=set.frames[key],path=set.sheets[f[0]];let img=images.get(path);if(!img){img=new Image();img.src=path;await img.decode();images.set(path,img)}const t=c.frameTransforms[key],x=105+index*96,y=ri*440+di*100+112;ctx.strokeStyle='#434541';ctx.beginPath();ctx.moveTo(x-40,y+.5);ctx.lineTo(x+45,y+.5);ctx.stroke();ctx.save();ctx.translate(x,y);ctx.scale(t.flipX?-1:1,1);ctx.drawImage(img,f[1],f[2],f[3],f[4],-t.anchor[0]*f[3]*t.scale*zoom,-t.anchor[1]*f[4]*t.scale*zoom,f[3]*t.scale*zoom,f[4]*t.scale*zoom);ctx.restore();index++}
     }
    }
   }
   document.body.append(canvas);results.push({name,roles,modes})
  }
  return results
 })
 for(const result of results)await page.locator('#'+result.name).screenshot({path:join(out,result.name+'.png')})
 writeFileSync(join(out,'index.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({sheets:results.length}))
}finally{await page.close();await browser.close();server.stop()}
