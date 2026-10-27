import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {loadDb} from './loadContent'
import {parseContentJson} from '../src/core/content-json'
import type {ItemDef,AbilityDef,CreatureDef,TerrainDef,SwarmDef} from '../src/core/types'
import {validateSpriteAssets} from './sprite-validation'
import {mapIconKeys,terrainArtFrames} from '../src/client/render/terrain-art'
import {forestArtFrames} from '../src/client/render/forest-art'
import {livingArtFrames} from '../src/client/render/living-art'
import {cropArtFrames} from '../src/client/render/crop-art'
import {forageArtFrames} from '../src/client/render/forage-art'
import {humanModels} from '../src/client/render/human-art'
import {humanSpecFrameKeys} from '../src/client/render/human-spec'
const args=process.argv.slice(2),json=args.includes('--json'),enabled=args.filter(x=>x!=='--json')
try{
 const{db,report}=loadDb(enabled),manifest=parseContentJson(readFileSync('src/client/sprites.json','utf8'),'src/client/sprites.json')
 const creatures=db.all<CreatureDef>('Creature')
 const characters=creatures.flatMap(x=>[...(Array.isArray(x.char)?x.char:x.char?[x.char]:[]),...Object.values(x.characterAliases??{}),...(x.dormantChar?[x.dormantChar]:[])])
 const fallback=creatures.filter(x=>!x.char).flatMap(x=>Array.isArray(x.sprite)?x.sprite:x.sprite?[x.sprite]:[])
 const terrain=db.all<TerrainDef>('Terrain').flatMap(x=>[...x.sprites,...(x.visual?[x.visual.sprite]:[])])
 const result=validateSpriteAssets(resolve('public'),manifest,[...db.all<ItemDef>('Item').map(x=>x.sprite),...db.all<AbilityDef>('Ability').map(x=>x.icon)],characters,db.modTextures,[...terrain,...fallback,...db.all<SwarmDef>('Swarm').map(s=>s.sprite),...mapIconKeys,...terrainArtFrames,...forestArtFrames,...livingArtFrames,...cropArtFrames,...forageArtFrames,...Object.values(humanModels).flatMap(spec=>humanSpecFrameKeys(spec)),'shove','trip','disarm','crouch'])
 const output={...result,valid:result.valid&&!report.errors.length,errors:[...report.errors,...result.errors],loadOrder:report.order,scriptsExecuted:false,scope:'Actual sheet PNG header/chunk CRC/frame bounds/animation+character references/UI paths, all resolved Item+Ability/Terrain references, creature fallback+dormant appearances and declared renderer ground/object/maneuver keys. Pixel appearance, PNG decompression, additional dynamic renderer expressions, font/audio and reproduction tools remain separate checks.'}
 if(json)console.log(JSON.stringify(output,null,2));else{console.log('스프라이트 파일 검사: '+JSON.stringify(output.counts));for(const warning of output.warnings)console.log('경고: '+warning);for(const error of output.errors)console.log('오류: '+error);console.log(output.valid?'OK':'검사 실패')}
 if(!output.valid)process.exitCode=1
}catch(error){const message=(error as Error).message;if(json)console.log(JSON.stringify({valid:false,errors:[message],scriptsExecuted:false}));else console.error('오류: '+message);process.exitCode=1}
