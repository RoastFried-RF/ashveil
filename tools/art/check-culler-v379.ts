/** Renderer-only geometry/source contract. Does not instantiate Core, World or game. */
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {CullerMotion,cullerDistance,cullerPinMatrix,cullerSolve} from '../../src/client/render/culler-motion'
import {cullerDriveIds,cullerPartIds,type CullerSpec} from '../../src/client/render/culler-spec'
import {atlasPlan,type AtlasManifest} from '../../src/client/render/atlas-plan'
import {validateSpriteAssets} from '../sprite-validation'
const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8')) as AtlasManifest,spec=manifest.chars.av379_culler.culler as CullerSpec,installation=JSON.parse(readFileSync('tools/art/direction-v379/installation.json','utf8')) as {originals:{publicPath:string;sha256:string}[]}
for(const original of installation.originals)assert.equal(createHash('sha256').update(readFileSync(original.publicPath)).digest('hex'),original.sha256)
const ownSheets=Object.fromEntries(Object.entries(manifest.sheets).filter(([key])=>key.startsWith('av379_culler_'))),own={sheets:ownSheets,sheetSizes:Object.fromEntries(Object.keys(ownSheets).map(key=>[key,manifest.sheetSizes![key]])),frames:Object.fromEntries(Object.entries(manifest.frames).filter(([key])=>key.startsWith('av379_culler_'))),chars:{av379_culler:manifest.chars.av379_culler},anims:{},ui:{}}
assert.equal(Object.keys(ownSheets).length,4);assert.equal(Object.keys(own.frames).length,24);assert.equal(new Set(cullerPartIds).size,21);assert.equal(cullerDriveIds.length,6)
assert.equal(validateSpriteAssets('public',own,[],['av379_culler']).valid,true);const bad=structuredClone(own);bad.chars.av379_culler.culler!.directions.up.art.driveUpper.proximal.x=10000;assert.equal(validateSpriteAssets('public',bad).valid,false)
for(const key of Object.keys(ownSheets)){assert.ok(atlasPlan(manifest,[],['av379_culler']).sheets.includes(key));assert.ok(!atlasPlan(manifest,[],['hero']).sheets.includes(key))}
let maxReachError=0,maxContactDrift=0,maxAnchorMutation=0,maxLinkError=0,maxPinError=0,maxToolContactError=0,samples=0,minHealthyContacts=6,maxLandingAdjustment=0
for(const [direction,d]of Object.entries(spec.directions)){
 let point={x:136,y:142};const motion=new CullerMotion(d,point);let prior=motion.pose()
 for(const [dx,dy,n]of [[.4,0,80],[0,.4,80],[-.4,-.4,80],[0,0,60],[.4,-.4,80]])for(let i=0;i<n;i++){
  point={x:point.x+dx,y:point.y+dy};const pose=motion.update(point,16);assert.deepEqual(pose.root,point);assert.equal(pose.legs.length,6);assert.equal(new Set(pose.legs.map(l=>l.id)).size,6)
  for(const leg of pose.legs){assert.equal(leg.ownerId,leg.id);maxReachError=Math.max(maxReachError,leg.error);maxLinkError=Math.max(maxLinkError,Math.abs(cullerDistance(leg.hip,leg.knee)-d.layout.upper),Math.abs(cullerDistance(leg.knee,leg.end)-d.layout.lower));const old=prior.legs.find(l=>l.id===leg.id)!;if(leg.contact){maxContactDrift=Math.max(maxContactDrift,cullerDistance(leg.requested,leg.end));if(old.contact&&old.epoch===leg.epoch)maxAnchorMutation=Math.max(maxAnchorMutation,cullerDistance(old.anchor,leg.anchor))}}
  minHealthyContacts=Math.min(minHealthyContacts,pose.legs.filter(l=>l.contact).length);maxLandingAdjustment=Math.max(maxLandingAdjustment,pose.maxLandingAdjustment);prior=pose;samples++
 }
 for(let n=0;n<100;n++)prior=motion.update(point,16);assert.equal(prior.legs.filter(l=>l.contact).length,6);const frozen=motion.pose();for(let n=0;n<20;n++)motion.update(point,0);assert.deepEqual(motion.pose(),frozen)
 for(const id of cullerDriveIds){const blocked=motion.update(point,16,new Set([id]));assert.equal(blocked.legs.find(l=>l.id===id)!.contact,false);assert.equal(blocked.legs.filter(l=>l.disabled).length,1)}
 const heading={down:{x:0,y:1},up:{x:0,y:-1},left:{x:-1,y:0},right:{x:1,y:0}}[direction as keyof typeof spec.directions]
 for(const tool of Object.values(d.layout.tools)){const solved=cullerSolve(tool.shoulder,{x:heading.x*16,y:heading.y*16-9},tool.upper,tool.blade,{x:tool.shoulder.x||1,y:1});maxToolContactError=Math.max(maxToolContactError,solved.error)}
 for(const part of [d.art.driveUpper,d.art.driveLower,d.art.scytheUpper,{proximal:d.art.scytheBlade.proximal,distal:d.art.scytheBlade.tip}])for(const mirror of [false,true]){const A={x:17,y:31},B={x:19,y:36},m=cullerPinMatrix(part.proximal,part.distal,A,B,mirror),apply=(p:{x:number;y:number})=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});maxPinError=Math.max(maxPinError,cullerDistance(apply(part.proximal),A),cullerDistance(apply(part.distal),B))}
}
assert.ok(maxReachError<1e-8);assert.ok(maxContactDrift<1e-8);assert.equal(maxAnchorMutation,0);assert.ok(maxLinkError<1e-8);assert.ok(maxPinError<1e-8);assert.ok(maxToolContactError<1e-8);assert.ok(minHealthyContacts>=3)
const out=process.argv[2]??'test-results/autonomy-v379/culler-geometry';mkdirSync(out,{recursive:true});const result={samples,sourcePNGs:4,sourceRegions:24,newSourcePNGs:0,sourceCrcAndCrops:true,selectedOnlySheets:true,invalidSocketRejected:true,ownedActualParts:21,ownedDrives:6,maxReachError,maxContactDrift,maxAnchorMutation,maxLinkError,maxPinError,maxToolContactError,minHealthyContacts,maxLandingAdjustment,scope:'Four2D facing models, supplied root/stance/fixed links and two tool target math only. Landings are planned inside2D reach envelope; nominal vs planned is retained. Not Core,3D contact stability, game Native or release approval.'};writeFileSync(out+'/audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
