/** Four declared installed-device groups cover all28 actual targets on four living body types.
 * Initial installations are fixtures, not claims of performing surgery. After Title: real input only. */
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { existsSync,mkdirSync,writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisonerFixture } from '../tests/prisoner-fixture'
import { createCreature } from '../src/core/creatures'
import { makeItem,addToBag,wield } from '../src/core/items'
import { playerAct } from '../src/core/game'
import { DIRS } from '../src/core/geom'
import { turnOf,type World } from '../src/core/ctx'
import { invalidateLights,updatePlayerVision } from '../src/core/fov'
import { serialize,deserialize,stateHash } from '../src/core/save'
import type { ProstheticDef } from '../src/core/types'
import type { MapRenderer } from '../src/client/render/MapRenderer'
type Presentation=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():Presentation}
type Mount=[number,string,string]
const groups:Record<string,Mount[]>={
 A:[[0,'PioneerArm','RightForearm'],[0,'ArticulatedLeg','LeftShin'],[1,'HookHand','LeftHand'],[1,'PegLeg','RightShin'],[2,'GlassEye','RightEye'],[2,'GardenerLimb','LeftUpperArm'],[3,'GardenerLimb','RightThigh']],
 B:[[0,'PioneerArm','LeftForearm'],[0,'ArticulatedLeg','RightShin'],[1,'HookHand','RightHand'],[1,'PegLeg','LeftShin'],[2,'GlassEye','LeftEye'],[2,'GardenerLimb','RightUpperArm'],[3,'GardenerLimb','LeftThigh']],
 C:[[0,'PioneerArm','RightHand'],[0,'ArticulatedLeg','LeftFoot'],[1,'PegLeg','RightFoot'],[1,'GardenerLimb','LeftForearm'],[2,'GardenerLimb','RightShin'],[2,'GardenerLimb','LeftHand'],[3,'GardenerLimb','RightFoot']],
 D:[[0,'PioneerArm','LeftHand'],[0,'ArticulatedLeg','RightFoot'],[1,'PegLeg','LeftFoot'],[1,'GardenerLimb','RightForearm'],[2,'GardenerLimb','LeftShin'],[2,'GardenerLimb','RightHand'],[3,'GardenerLimb','LeftFoot']],
}
const out=process.argv[2],url=process.argv[3],only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[]
let checkedSourceContacts=0
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
let current='startup'
async function idle(){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!(window as unknown as Hook).__ashveil.world().s.simulationPending)}
async function compare(w:World,label:string){await idle();await page.waitForFunction(t=>(window as unknown as Hook).__ashveil.world().s.time===t,w.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)});return await page.evaluate(()=>(window as unknown as Hook).render_game_presentation())}
try{
 await page.goto(url)
 for(const[group,mounts]of Object.entries(groups).filter(([id])=>!only||only.split(',').includes(id)))for(const[direction,facing,key]of [['down',4,'ArrowDown'],['left',6,'ArrowLeft'],['right',2,'ArrowRight'],['up',0,'ArrowUp']]as const){
  current=group+'-'+direction;const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
  for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
  const delta=DIRS[facing],perp={x:-delta.y,y:delta.x}
  const actors=[p,...[['Creature.Shade','shade0'],['Creature.Withered','withered'],['Creature.SporeMan','spore0']].map(([def,sprite],i)=>{const pos=i===0?{x:20+delta.x*2,y:20+delta.y*2}:{x:20+perp.x*(i===1?-2:3),y:20+perp.y*(i===1?-2:3)},c=createCreature(w,def,pos);c.sprite=sprite;return c})]
  s.creatures=actors;p.pos={x:20,y:20}
  for(const c of actors){c.nextAct=c===p?s.time:1e12;c.met=true;c.bag=[];c.equip={};c.facing=facing;c.age=undefined;c.traits=[];c.effects=[];c.traumas=[];c.body.wounds=[];c.body.missing=[];c.body.prosthetics={};c.unconscious=false;c.asleep=false;c.activity=undefined;c.ai.mode='guard';Object.assign(c.needs,{kcal:2500,waterDeficit:0,fatigue:10,bodyTemp:37,wetness:0,stress:0,sleepDebt:0})}
  p.statPoints=0;p.abilityPoints=0;if(group==='B'||group==='D')p.body.missing.push('RightUpperArm')
  const devices=mounts.map(([actor,kind,root])=>{
   const def=w.db.get<ProstheticDef>('Prosthetic.'+kind),c=actors[actor],item=makeItem(w,def.item);assert.ok(def.targets.includes(root));c.body.missing.push(root);c.body.prosthetics![root]={def:def.id,item,installedAt:turnOf(w),servicedAt:turnOf(w),powerUntil:1e12};return{actor:c.id,def:def.id,root,uid:item.uid,item:item.def}
  })
  const weapon=makeItem(w,'Item.PipeClub'),boots=makeItem(w,'Item.Boots');p.equip[group==='B'||group==='D'?'off':'main']=weapon;assert.equal(addToBag(w,p,boots),0)
  assert.equal(wield(w,p)?.item?.uid,weapon.uid,'initial weapon must be held by a real functional hand')
  s.fx=[];invalidateLights(w);updatePlayerVision(w,p);const initial=serialize(s);writeFileSync(join(out,current+'-initial.json'),initial)
  await page.setViewportSize(facing===4?{width:1440,height:1080}:{width:1366,height:768});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:.5,screenShake:false,torchFlicker:false,mapZoom:4}))},initial)
  await page.reload();await page.getByTestId('continue').click();const expected={db:w.db,s:deserialize(initial)};let view=await compare(expected,current+'-loaded')
  for(const device of devices){const human=view.actors.find(a=>a.actor===device.actor)?.human;assert.ok(human,current+' actual NPC is visible');const eye=device.root.endsWith('Eye'),hidden=eye&&(direction==='up'||direction==='left'&&device.root.startsWith('Right')||direction==='right'&&device.root.startsWith('Left'));const drawn=human.prostheticJoints.filter(j=>j.uid===device.uid);assert.equal(drawn.length>0,!hidden);for(const joint of drawn)assert.ok(joint.source.startsWith('av394_'))}
  await page.screenshot({path:join(out,current+'-installed.png')});writeFileSync(join(out,current+'-installed-presentation.json'),JSON.stringify(view))
  await page.keyboard.press('Period');assert.equal(playerAct(expected,{type:'wait'}),null);await compare(expected,current+'-wait')
  const other=facing===2?4:2,otherKey=other===2?'ArrowRight':'ArrowDown';await page.keyboard.press('Control+'+otherKey);assert.equal(playerAct(expected,{type:'face',dir:other}),null);await compare(expected,current+'-other-facing');await page.keyboard.press('Control+'+key);assert.equal(playerAct(expected,{type:'face',dir:facing}),null);view=await compare(expected,current+'-original-facing')
  const footBefore=view.actors.find(a=>a.actor===p.id)!.human!.footSources
  await page.keyboard.press('i');await page.getByTestId('item-Item.Boots').dblclick();assert.equal(playerAct(expected,{type:'equip',uid:boots.uid}),null);view=await compare(expected,current+'-boots-equipped')
  const footAfter=view.actors.find(a=>a.actor===p.id)!.human!.footSources
  for(const side of ['left','right']as const)if(footBefore[side].frame.startsWith('av394_'))assert.equal(footAfter[side].scale,footBefore[side].scale,'boots do not resize actual hardware')
  await page.screenshot({path:join(out,current+'-boots.png')});await page.getByTestId('slot-feet').dblclick();assert.equal(playerAct(expected,{type:'unequip',slot:'feet'}),null);await compare(expected,current+'-boots-removed');await page.keyboard.press('Escape')
  for(let step=0;step<8;step++){const ep=expected.s.creatures.find(c=>c.id===p.id)!,target=expected.s.creatures.find(c=>c.id===actors[1].id)!;if(Math.max(Math.abs(ep.pos.x-target.pos.x),Math.abs(ep.pos.y-target.pos.y))<=1)break;await page.keyboard.press(key);assert.equal(playerAct(expected,{type:'move',dir:facing}),null);await compare(expected,current+'-walk-'+step);await page.waitForFunction(()=>(window as unknown as Hook).render_game_presentation().moving===false)}
  const recording=page.evaluate(async()=>{const rows:Presentation[]=[];for(let i=0;i<24;i++){await new Promise(resolve=>requestAnimationFrame(resolve));rows.push((window as unknown as Hook).render_game_presentation())}return rows})
  await page.keyboard.press(key);assert.equal(playerAct(expected,{type:'move',dir:facing}),null);const samples=await recording;writeFileSync(join(out,current+'-attack-samples.json'),JSON.stringify(samples));assert.ok(samples.some(s=>s.action?.kind==='attack'),'actual attack observed');await compare(expected,current+'-actual-attack')
  const hand=group==='B'||group==='D'?'left':'right'
  for(const sample of samples.filter(s=>s.action?.kind==='attack')){assert.equal(sample.action!.weaponUid,weapon.uid);const human=sample.actors.find(a=>a.actor===p.id)!.human!,joint=human.prostheticJoints.find(j=>j.owner===(hand==='left'?'Left':'Right')+'Hand');assert.ok(joint);assert.ok(Math.hypot(joint.b[0]-human.grips[hand][0],joint.b[1]-human.grips[hand][1])<1e-7)}
  for(const dir of [(facing+3)%8,(facing+7)%8]){
   const diagonalRecording=page.evaluate(async()=>{const rows:Presentation[]=[];for(let i=0;i<24;i++){await new Promise(resolve=>requestAnimationFrame(resolve));rows.push((window as unknown as Hook).render_game_presentation())}return rows})
   await page.keyboard.press(['ArrowUp','Numpad9','ArrowRight','Numpad3','ArrowDown','Numpad1','ArrowLeft','Numpad7'][dir]);assert.equal(playerAct(expected,{type:'move',dir}),null)
   const diagonalSamples=await diagonalRecording;writeFileSync(join(out,current+'-diagonal-'+dir+'-samples.json'),JSON.stringify(diagonalSamples))
   for(const sample of diagonalSamples){const human=sample.actors.find(a=>a.actor===p.id)!.human!;for(const side of ['left','right']as const){const foot=human.gait?.[side],joint=human.prostheticJoints.find(j=>j.owner===(side==='left'?'Left':'Right')+'Foot'&&j.solePinned);if(joint&&foot?.contact&&foot.stanceAnchor){assert.ok(Math.hypot(joint.b[0]+human.root[0]-foot.stanceAnchor.x,joint.b[1]+human.root[1]-foot.stanceAnchor.y)<1e-6,'world stance source anchor');checkedSourceContacts++}}}
   await compare(expected,current+'-diagonal-'+dir);await page.waitForFunction(()=>(window as unknown as Hook).render_game_presentation().moving===false)
  }
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();view=await compare(expected,current+'-continued');runs.push({group,direction,devices,originalWeaponUid:weapon.uid,originalBootsUid:boots.uid,attackFrames:samples.filter(s=>s.action?.kind==='attack').length,decodedBytes:view.assets.estimatedDecodedBytes});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.ok(checkedSourceContacts>0);assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,initialInstallationsAreFixtures:true,postTitleWorldWrites:false,actualBodyTypes:['player','Creature.Shade','Creature.Withered','Creature.SporeMan'],wholePairs:pairs.length,checkedSourceContacts,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,checkedSourceContacts,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));throw error}finally{await browser.close()}
