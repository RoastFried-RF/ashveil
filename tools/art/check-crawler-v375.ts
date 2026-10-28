/** Focused presentation geometry contract; no World/Core execution or golden update. */
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {atlasPlan,type AtlasManifest} from '../../src/client/render/atlas-plan'
import {CrawlerMotion,crawlerDistance,crawlerPinMatrix} from '../../src/client/render/crawler-motion'
import {crawlerPartIds,type CrawlerSpec} from '../../src/client/render/crawler-spec'
import {validateSpriteAssets} from '../sprite-validation'
const m=JSON.parse(readFileSync('src/client/sprites.json','utf8')) as AtlasManifest,spec=m.chars.av375_conduit_crawler.crawler as CrawlerSpec
const hash=createHash('sha256').update(readFileSync('public/sprites/original/direction-v375/crawler-parts-v372.png')).digest('hex');assert.equal(hash,'d79e58402ddfe288399997088a83bd85ee08d171e83b7dcfc342fdaf49d29d2f')
assert.equal(crawlerPartIds.length,25);assert.equal(new Set(crawlerPartIds).size,25)
assert.ok(atlasPlan(m,[],['av375_conduit_crawler']).sheets.includes('av375_crawler_source'));assert.ok(!atlasPlan(m,[],['hero']).sheets.includes('av375_crawler_source'))
const own={sheets:{av375_crawler_source:m.sheets.av375_crawler_source},sheetSizes:{av375_crawler_source:m.sheetSizes!.av375_crawler_source},frames:Object.fromEntries(Object.entries(m.frames).filter(([key])=>key.startsWith('av375_crawler_'))),chars:{av375_conduit_crawler:m.chars.av375_conduit_crawler},anims:{},ui:{}}
assert.equal(validateSpriteAssets('public',own,[],['av375_conduit_crawler']).valid,true)
const invalid=structuredClone(own);invalid.chars.av375_conduit_crawler.crawler!.art.upper.distal={x:9999,y:9999};assert.equal(validateSpriteAssets('public',invalid).valid,false)
let point={x:136,y:142},maxReachError=0,maxAnchorMutation=0,minStance=16,samples=0;const motion=new CrawlerMotion(spec,point,0);let prior=motion.pose()
for(const [dx,dy,frames]of [[.5,0,100],[0,.5,100],[-.5,-.5,100],[0,0,60],[.5,-.5,100]])for(let n=0;n<frames;n++){
 point={x:point.x+dx,y:point.y+dy};const pose=motion.update(point,Math.atan2(dy,dx),16);assert.deepEqual(pose.root,point);assert.equal(pose.bodies.length,8);assert.equal(pose.legs.length,16);assert.equal(new Set(pose.legs.map(l=>l.id)).size,16)
 for(const l of pose.legs){assert.equal(l.ownerId,pose.bodies[l.index].id);maxReachError=Math.max(maxReachError,l.error);const old=prior.legs.find(o=>o.id===l.id)!;if(l.contact&&old.contact&&l.epoch===old.epoch)maxAnchorMutation=Math.max(maxAnchorMutation,crawlerDistance(l.anchor,old.anchor));if(l.contact)assert.ok(crawlerDistance(l.end,l.anchor)<1e-8)}
 minStance=Math.min(minStance,pose.legs.filter(l=>l.contact).length);prior=pose;samples++
}
assert.ok(maxReachError<1e-8);assert.equal(maxAnchorMutation,0)
for(let n=0;n<100;n++)prior=motion.update(point,0,16);assert.equal(prior.legs.filter(l=>l.contact).length,16)
const freeze=motion.pose();for(let n=0;n<20;n++)motion.update(point,0,0);assert.deepEqual(motion.pose(),freeze)
const lost=motion.update(point,0,16,new Set(['Segment1LeftLeg','Segment2']));assert.equal(lost.legs.find(l=>l.id==='Segment1LeftLeg')!.contact,false);assert.ok(lost.legs.filter(l=>l.ownerId==='Segment2').every(l=>!l.contact));assert.equal(lost.legs.filter(l=>!l.contact).length,3)
const A={x:17,y:31},B={x:19,y:36},a=spec.art.lower.proximal,b=spec.art.lower.distal,mat=crawlerPinMatrix(a,b,A,B,true),apply=(p:{x:number;y:number})=>({x:mat.a*p.x+mat.c*p.y+mat.e,y:mat.b*p.x+mat.d*p.y+mat.f});assert.ok(crawlerDistance(apply(a),A)<1e-12);assert.ok(crawlerDistance(apply(b),B)<1e-12)
const out=process.argv[2]??'test-results/autonomy-v375/crawler-geometry';mkdirSync(out,{recursive:true});const result={sourceSha256:hash,selectedOnlySheet:true,sourceCrcAndCropContract:true,invalidSocketRejected:true,stableOwnedIds:25,samples,exactSuppliedRoot:true,maxReachError,maxAnchorMutation,minStance,settledLegs:16,zeroTimeStable:true,missingOrMotorBlockedLegsFolded:3,sourcePinAlignment:true,scope:'Independent 2D display route: straight, immediate90/135degree corners, diagonal, stop/restart. No Core/world/build/native/release validation.'};writeFileSync(out+'/audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
