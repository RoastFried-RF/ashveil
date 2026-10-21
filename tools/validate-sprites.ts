import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {loadDb} from './loadContent'
import {parseContentJson} from '../src/core/content-json'
import type {ItemDef,AbilityDef,CreatureDef} from '../src/core/types'
import {validateSpriteAssets} from './sprite-validation'
const args=process.argv.slice(2),json=args.includes('--json'),enabled=args.filter(x=>x!=='--json')
try{
 const{db,report}=loadDb(enabled),manifest=parseContentJson(readFileSync('src/client/sprites.json','utf8'),'src/client/sprites.json')
 const characters=db.all<CreatureDef>('Creature').flatMap(x=>[...(Array.isArray(x.char)?x.char:x.char?[x.char]:[]),...Object.values(x.characterAliases??{})])
 const result=validateSpriteAssets(resolve('public'),manifest,[...db.all<ItemDef>('Item').map(x=>x.sprite),...db.all<AbilityDef>('Ability').map(x=>x.icon)],characters)
 const output={...result,valid:result.valid&&!report.errors.length,errors:[...report.errors,...result.errors],loadOrder:report.order,scriptsExecuted:false,scope:'Actual sheet PNG header/chunk CRC/frame bounds/animation+character references/UI paths and resolved Item+Ability icon files. Pixel appearance, PNG decompression, hardcoded renderer keys, font/audio and reproduction tools remain separate checks.'}
 if(json)console.log(JSON.stringify(output,null,2));else{console.log('스프라이트 파일 검사: '+JSON.stringify(output.counts));for(const warning of output.warnings)console.log('경고: '+warning);for(const error of output.errors)console.log('오류: '+error);console.log(output.valid?'OK':'검사 실패')}
 if(!output.valid)process.exitCode=1
}catch(error){const message=(error as Error).message;if(json)console.log(JSON.stringify({valid:false,errors:[message],scriptsExecuted:false}));else console.error('오류: '+message);process.exitCode=1}
