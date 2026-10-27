import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
import {atlasPlan,type AtlasManifest} from '../src/client/render/atlas-plan'
import {worldAssets} from '../src/client/render/world-assets'
import {terrainArtFrames,mapIconKeys} from '../src/client/render/terrain-art'
import {forestArtFrames} from '../src/client/render/forest-art'
import {livingArtFrames} from '../src/client/render/living-art'
import {cropArtFrames} from '../src/client/render/crop-art'
import {forageArtFrames} from '../src/client/render/forage-art'
import {stateHash} from '../src/core/save'
import {createCreature} from '../src/core/creatures'
import {prisonerFixture} from './prisoner-fixture'
import {rigSpecFrameKeys} from '../src/client/render/rig-spec'
import {humanSpecFrameKeys} from '../src/client/render/human-spec'
import {humanArtFor} from '../src/client/render/human-art'
import {makeItem} from '../src/core/items'
const m=JSON.parse(readFileSync('src/client/sprites.json','utf8'))as AtlasManifest
function keys(c:AtlasManifest['chars'][string]){if(c.human)return humanSpecFrameKeys(humanArtFor(c.humanSpec),new Set());return[c.walk,c.idle,c.attack,...Object.values(c.attackVariants??{}),...Object.values(c.motions??{})].flatMap(clip=>clip?Object.values(clip).flat():[])}
it('keeps all original common terrain/prop/FX sheets while loading every actual phase of only selected body models',()=>{
 const {w,s,p}=prisonerFixture();s.creatures=[p,createCreature(w,'Creature.Surveyor',{x:24,y:20})];const request=worldAssets(w),before=stateHash(s),plan=atlasPlan(m,request.icons,request.characters)
 for(const key of [...mapIconKeys,...terrainArtFrames,...forestArtFrames,...livingArtFrames,...cropArtFrames,...forageArtFrames,'shove','trip','disarm','crouch'])if(m.frames[key])expect(plan.sheets).toContain(m.frames[key][0])
 for(const name of request.characters)if(m.chars[name])for(const key of keys(m.chars[name]))expect(plan.sheets).toContain(m.frames[key][0])
 for(const [body,motion]of[['av331_ash_crow','flight'],['av331_tuskhog','wallow']]as const){const key=m.chars[body].motions![motion]!.down[0];expect(plan.sheets).not.toContain(m.frames[key][0])}
 expect(stateHash(s)).toBe(before);expect(plan.estimatedDecodedBytes).toBeLessThan(300*1024*1024)
})
it('retains a requested retired appearance but does not request arbitrary unregistered saved sprite URLs',()=>{
 const plan=atlasPlan(m,[],['not-a-known-historical-frame']);expect(plan.fallback).not.toContain('not-a-known-historical-frame')
 const key=Object.keys(m.frames).find(key=>m.characterSheetHistory?.includes(m.frames[key][0]))!;expect(key).toBeDefined();expect(atlasPlan(m,[],[key]).sheets).toContain(m.frames[key][0])
 expect(atlasPlan(m,['explicit-mod-texture'],[]).fallback).toContain('explicit-mod-texture')
})
it('preserves original rectangles and PNG paths; planning does not rewrite, resample or collapse motion sources',()=>{
 const before=JSON.stringify(m)
 for(const character of Object.keys(m.chars)){const plan=atlasPlan(m,[],[character]);for(const key of keys(m.chars[character]))expect(plan.sheets).toContain(m.frames[key][0])}
 expect(JSON.stringify(m)).toBe(before)
})
it('loads all thirty Sower rig originals only when its body is selected, including shared recovery sources',()=>{
 const rig=m.chars.av331_sower.rig!,frames=rigSpecFrameKeys(rig),common=atlasPlan(m,[],[]),selected=atlasPlan(m,[],['av331_sower'])
 expect(frames).toHaveLength(30)
 for(const key of frames){expect(selected.sheets).toContain(m.frames[key][0]);expect(common.sheets).not.toContain(m.frames[key][0])}
 for(const dir of ['left','right'] as const){expect(rig.directions[dir].work[3].frame).toBe(rig.directions[dir].work[0].frame);expect(frames).not.toContain('av364_sower_'+dir+'_work_chassis3')}
})
it('loads directional prosthetics from actual installed bodies, changes the request on install/remove, and preserves the memory budget',()=>{
 const {w,s,p}=prisonerFixture();s.creatures=[p]
 const empty=worldAssets(w),baseline=atlasPlan(m,empty.icons,empty.characters),newSheets=Object.keys(m.sheets).filter(key=>key.startsWith('av394_prosthetic_'))
 expect(newSheets).toHaveLength(5)
 for(const sheet of newSheets)expect(baseline.sheets).not.toContain(sheet)
 expect(baseline.estimatedDecodedBytes).toBeLessThan(300*1024*1024)
 const item=makeItem(w,'Item.PioneerArm');p.body.prosthetics={LeftForearm:{def:'Prosthetic.PioneerArm',item,installedAt:0,servicedAt:0,powerUntil:10000}}
 const hash=stateHash(s),installed=worldAssets(w),plan=atlasPlan(m,installed.icons,installed.characters)
 expect(stateHash(s)).toBe(hash);expect(installed.key).not.toBe(empty.key)
 expect(plan.sheets.filter(key=>newSheets.includes(key))).toEqual(['av394_prosthetic_pioneer'])
 expect(installed.icons.filter(key=>key.startsWith('av394_pioneerarm_'))).toHaveLength(8)
 item.durability=0
 expect(worldAssets(w).key).toBe(installed.key)
 delete p.body.prosthetics
 expect(worldAssets(w).key).toBe(empty.key)
})
