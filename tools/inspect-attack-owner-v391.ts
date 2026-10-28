/** Declared original stock/anatomy; after Title only real keys and read-only observations. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {makeItem,addToBag,supplyItems} from '../src/core/items'
import {throwQuote} from '../src/core/throwing'
import {playerAct} from '../src/core/game'
import {startActionObservation,takeAttackObservation} from '../src/core/action-observations'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
type Scene={name:string;dx:number;dy:number;source?:'main'|'bag'|'pocket';stone?:boolean;missingRight?:boolean;crouched?:boolean;speed?:number;merge?:boolean;repeat?:boolean}
const out=process.argv[2],url=process.argv[3],baseline=process.argv.includes('--baseline');assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const compass:Scene[]=[['n',0,-3],['ne',3,-3],['e',3,0],['se',3,3],['s',0,3],['sw',-3,3],['w',-3,0],['nw',-3,-3]].map(([name,dx,dy])=>({name:'off-'+name,dx:Number(dx),dy:Number(dy)}))
const available:Scene[]=baseline?[compass[4]]:[...compass,
 {name:'main',dx:3,dy:0,source:'main'},
 {name:'bag-javelin',dx:-3,dy:0,source:'bag'},
 {name:'bag-stones',dx:3,dy:3,source:'bag',stone:true},
 {name:'pocket-stones',dx:0,dy:-3,source:'pocket',stone:true},
 {name:'missing-right',dx:-3,dy:3,source:'bag',missingRight:true},
 {name:'crouched',dx:3,dy:-3,crouched:true},
 {name:'instant',dx:0,dy:3,speed:0},
 {name:'fast',dx:-3,dy:0,speed:2},
 {name:'slow',dx:0,dy:3,speed:.5},
 {name:'merge-stones',dx:0,dy:3,source:'bag',stone:true,merge:true},
 {name:'repeat-stones',dx:3,dy:0,source:'bag',stone:true,repeat:true},
]
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7),scenes=only?available.filter(scene=>only.split(',').includes(scene.name)):available;assert.ok(scenes.length)
const avatar=process.argv.find(arg=>arg.startsWith('--sprite='))?.slice(9);if(avatar)assert.ok(['shade0','shade1','shade2','shade3','shade_chief','withered','withered_priest','spore0','spore1'].includes(avatar),'Declared registered appearance only')
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1366,height:768}})
const pairs:{label:string;hash:string}[]=[],errors:string[]=[],runs:unknown[]=[];let current='startup',lastExpected:World|undefined
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(expected:World,label:string){expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(expected.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const scene of scenes){
  current=scene.name
  const{w,s,p,target}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p,target];s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
  for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
  if(avatar)p.sprite=avatar; // Declared appearance only; original player physiology is unchanged.
  p.bag=[];p.equip={};p.facing=4;p.crouching=scene.crouched;target.pos={x:p.pos.x+scene.dx,y:p.pos.y+scene.dy};target.nextAct=s.time+1e9;target.met=true;target.reactPolicy='none';target.ai.mode='guard';target.equip={};target.bag=[]
  const other=makeItem(w,'Item.Hatchet'),projectile=makeItem(w,scene.stone?'Item.Stone':'Item.Javelin',scene.stone?3:1)
  if(scene.source==='main')p.equip={main:projectile,off:other}
  else if(scene.source==='bag'||scene.source==='pocket'){
   p.equip.main=other
   if(scene.source==='pocket'){const belt=makeItem(w,'Item.LeatherBelt');projectile.gx=0;projectile.gy=0;belt.contents=[projectile];p.equip.belt=belt}else assert.equal(addToBag(w,p,projectile),0)
  }else p.equip={main:other,off:projectile}
  if(scene.missingRight){p.body.missing=['RightUpperArm'];delete p.equip.main;assert.equal(addToBag(w,p,other),0)}
  const floor=s.map.tiles[target.pos.y*s.map.w+target.pos.x].items,ground=scene.merge?makeItem(w,'Item.Stone',1):undefined;if(ground)floor.push(ground)
  p.hotbar[0]={kind:'item',def:projectile.def};s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
  const quote=throwQuote(w,p,projectile.uid,target.id);assert.equal(quote.error,null,current);const arm=quote.wield!.arm!,slot=arm==='larm'?1:0
  const initial=serialize(s),expected={db:w.db,s:deserialize(initial)};lastExpected=expected;writeFileSync(join(out,current+'-initial.json'),initial);const stop=startActionObservation(expected)
  await page.evaluate(({initial,speed})=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:speed,screenShake:false,torchFlicker:false,mapZoom:4}))},{initial,speed:scene.speed??1})
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,current+'-loaded')
  const throws:unknown[]=[]
  for(let turn=0;turn<(scene.repeat?2:1);turn++){
   const label=current+'-throw-'+turn
   await page.keyboard.press('1')
   const sampling=page.evaluate(async expectThrow=>{const rows:View[]=[],start=performance.now();let seen=false;while(performance.now()-start<6000){await new Promise(resolve=>requestAnimationFrame(resolve));const row=(window as unknown as Hook).render_game_presentation();rows.push(row);seen ||= row.action?.kind==='throw';if(performance.now()-start>=1600&&(!expectThrow||seen&&row.action?.kind!=='throw'))break}return rows},scene.speed!==0)
   await page.keyboard.press('Enter');const immediate=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation())
   if(scene.name==='slow'||baseline)await page.screenshot({path:join(out,label+'-preparation.png')})
   const samples=[immediate,...await sampling];writeFileSync(join(out,label+'-samples.json'),JSON.stringify(samples))
   assert.equal(playerAct(expected,{type:'throwAttack',uid:projectile.uid,target:target.id}),null)
   const event=expected.s.fx.find(e=>e.k==='attack'&&e.id===p.id);assert.ok(event?.k==='attack');const source=takeAttackObservation(expected,event)!;assert.ok(source);const actualUid=source.wield.item!.uid
   assert.equal(source.wield.arm,arm);assert.equal(source.wield.item!.def,projectile.def)
   const early=samples.filter(row=>row.action?.kind==='throw'&&row.action.phase<.5)
   if(baseline){assert.ok(early.some(row=>{const human=row.actors.find(a=>a.actor===p.id)!.human!;return row.actionProp.visible&&Math.hypot(row.actionProp.x-human.grips.right[0],row.actionProp.y-human.grips.right[1])<1e-7}),'baseline wrong right-palm attachment reproduced')}
   else if(scene.speed===0){assert.ok(samples.every(row=>!row.action||row.action.kind!=='throw'));assert.ok(samples.every(row=>!row.actionProp.visible))}
   else{
    assert.ok(early.length,label+' actual pre-release pose observed')
    for(const row of early){
     assert.equal(row.action!.sourceObserved,true);assert.equal(row.action!.arm,arm);assert.equal(row.action!.weaponUid,actualUid);assert.equal(row.action!.weaponDef,projectile.def);assert.equal(row.actionProp.visible,false)
     const length=Math.hypot(scene.dx,scene.dy);assert.deepEqual(row.action!.vector,{x:scene.dx/length,y:scene.dy/length});assert.equal(row.frame!.direction,scene.dx>0?'right':scene.dx<0?'left':scene.dy<0?'up':'down')
     assert.equal(row.equipment[slot].visible,true);assert.equal(row.equipment[slot].uid,actualUid)
     const grip=row.actors.find(a=>a.actor===p.id)!.human!.grips[arm==='larm'?'left':'right'];assert.ok(Math.hypot(grip[0]-row.equipment[slot].x,grip[1]-row.equipment[slot].y)<1e-7)
     if(!scene.missingRight&&!(scene.source==='bag'||scene.source==='pocket'))assert.equal(row.equipment[1-slot].uid,other.uid)
    }
    const released=samples.filter(row=>row.action?.kind==='throw'&&row.action.phase>=.5);assert.ok(released.length,label+' release observed');for(const row of released)assert.equal(row.equipment[slot].visible,false)
    assert.ok(samples.some(row=>row.action===null),label+' recovered')
   }
   await compare(expected,label)
   const ep=expected.s.creatures.find(c=>c.id===p.id)!,landing=expected.s.map.tiles[target.pos.y*expected.s.map.w+target.pos.x].items
   if(scene.stone){assert.notEqual(actualUid,projectile.uid);assert.equal(supplyItems(ep).find(i=>i.uid===projectile.uid)!.count,2-turn)}else assert.ok(!supplyItems(ep).some(i=>i.uid===projectile.uid)&&!Object.values(ep.equip).some(i=>i?.uid===projectile.uid))
   if(scene.merge){assert.equal(landing.find(i=>i.uid===ground!.uid)!.count,2);assert.ok(!landing.some(i=>i.uid===actualUid))}else if(!scene.repeat||turn===0)assert.equal(landing.filter(i=>i.uid===actualUid).length,1)
   if(!scene.missingRight)assert.equal(ep.equip[scene.source==='main'?'off':'main']!.uid,other.uid)
   throws.push({label,arm,inputUid:projectile.uid,physicalUid:actualUid,early:early.length,samples:samples.length,landing:landing.map(i=>({uid:i.uid,def:i.def,count:i.count}))})
  }
  stop();await page.screenshot({path:join(out,current+'-recovered.png')});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,current+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({scene,throws})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,avatar:avatar??'default',avatarChangesPhysiology:false,finiteInitial:true,noPostTitleWorldWrites:true,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({baseline,scenes:runs.length,pairs:pairs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-actual.json'),serialize(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)));if(lastExpected)writeFileSync(join(out,'failure-expected.json'),serialize(lastExpected.s))}catch{/* title/load failure */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error)+'\n'+await page.locator('body').innerText());writeFileSync(join(out,'failure-audit.json'),JSON.stringify({scene:current,runs,pairs,errors},null,2));throw error}finally{await browser.close()}
