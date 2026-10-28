import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {atlasPlan,type AtlasManifest} from '../src/client/render/atlas-plan'
import {worldAssets} from '../src/client/render/world-assets'
import {prisonerFixture} from './prisoner-fixture'
import {humanSpecFrameKeys} from '../src/client/render/human-spec'
import {humanArtFor} from '../src/client/render/human-art'
const m=JSON.parse(readFileSync('src/client/sprites.json','utf8'))as AtlasManifest
const audit=JSON.parse(readFileSync('tools/art/direction-v396/history-audit.json','utf8'))as{previousHistorySheets:string[];addedHistorySheets:string[];sheetWitnesses:Record<string,{path:string;sha256:string;witnessFrames:string[]}>}
describe('historical character sources remain addressable without blanket common preload',()=>{
 it('records exact immutable historical character references and preserves every original PNG',()=>{expect(audit.addedHistorySheets).toHaveLength(197);for(const[sheet,witness]of Object.entries(audit.sheetWitnesses)){expect(m.sheets[sheet]).toBe(witness.path);expect(createHash('sha256').update(readFileSync('public/'+witness.path)).digest('hex')).toBe(witness.sha256);expect(witness.witnessFrames.length).toBeGreaterThan(0);for(const key of witness.witnessFrames)expect(m.frames[key][0]).toBe(sheet)}})
 it('reduces a real human scene by93 unused sheets and over38MiB, with the same current source phases',()=>{const{w,s,p}=prisonerFixture();s.creatures=[p];const r=worldAssets(w),before=atlasPlan({...m,characterSheetHistory:audit.previousHistorySheets},r.icons,r.characters),after=atlasPlan(m,r.icons,r.characters);expect(before.sheets.length-after.sheets.length).toBe(93);expect(before.estimatedDecodedBytes-after.estimatedDecodedBytes).toBeGreaterThan(38*1024*1024);for(const name of r.characters){const body=m.chars[name];if(body?.human)for(const key of humanSpecFrameKeys(humanArtFor(body.humanSpec),new Set()))expect(after.sheets).toContain(m.frames[key][0])}})
 it('explicit saved-frame and icon requests still load each of the197 newly classified sources',()=>{for(const sheet of audit.addedHistorySheets){const frame=audit.sheetWitnesses[sheet].witnessFrames[0];expect(atlasPlan(m,[],[frame]).sheets).toContain(sheet);expect(atlasPlan(m,[frame],[]).sheets).toContain(sheet)}})
})
