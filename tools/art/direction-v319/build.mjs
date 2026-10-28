// Generate every original family first, then install the complete registry in one write.
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const here=fileURLToPath(new URL('.',import.meta.url)),root=fileURLToPath(new URL('../../../',import.meta.url))
for(const name of ['draw-people.mjs','draw-actors.mjs','draw-weapons.mjs','draw-portraits.mjs'])execFileSync(process.execPath,[here+name],{stdio:'inherit'})
if(process.argv.includes('--install')){
 const m=JSON.parse(readFileSync(root+'src/client/sprites.json','utf8'))
 for(const name of ['people.fragment.json','actors.fragment.json','weapons.fragment.json','portraits.fragment.json']){
  const fragment=JSON.parse(readFileSync(here+name,'utf8'))
  for(const group of ['sheets','frames','chars'])Object.assign(m[group],fragment[group]??{})
  for(const[role,key]of Object.entries(fragment.portraits??{}))m.chars[role].portrait=key
 }
 writeFileSync(root+'src/client/sprites.json',JSON.stringify(m,null,2)+'\n')
}
