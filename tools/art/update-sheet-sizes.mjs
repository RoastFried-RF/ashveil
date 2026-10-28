// CSS/SVG consumers need the actual PNG canvas size, including unused atlas padding.
import {readFileSync,writeFileSync} from 'node:fs'
const path='src/client/sprites.json',m=JSON.parse(readFileSync(path,'utf8'))
m.sheetSizes=Object.fromEntries(Object.entries(m.sheets).map(([key,url])=>{
 const png=readFileSync('public/'+url)
 if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Not a PNG: '+url)
 return[key,[png.readUInt32BE(16),png.readUInt32BE(20)]]
}))
writeFileSync(path,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({sheetSizes:Object.keys(m.sheetSizes).length}))
