/** Actual tank use: original prop FX/UID and hand, independent complete Node state. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {makeItem,addToBag} from '../src/core/items'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1366,height:768}}),errors:string[]=[],pairs:unknown[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(expected:World,label:string){expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(expected.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const missing of[false,true]){
  const{w,s,p,target}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p,target];s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
  for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
  p.bag=[];p.equip={};p.body.missing=missing?['RightUpperArm']:[];p.facing=4;target.pos={x:20,y:22};target.nextAct=s.time+1e9;target.met=true;target.ai.mode='guard'
  const tank=makeItem(w,'Item.CullerPurifierTank');tank.uses=4;tank.appraisal=2;assert.equal(addToBag(w,p,tank),0);s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
  const initial=serialize(s),expected={db:w.db,s:deserialize(initial)},name=missing?'left-only':'intact';writeFileSync(join(out,name+'-initial.json'),initial)
  await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:4}))},initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,name+'-loaded')
  await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.getByTestId('purifier-target').selectOption(String(target.id))
  const sampling=page.evaluate(async()=>{const rows:View[]=[],start=performance.now();while(performance.now()-start<1200){await new Promise(resolve=>requestAnimationFrame(resolve));rows.push((window as unknown as Hook).render_game_presentation())}return rows})
  await page.locator(`[data-purifier-spray="${tank.uid}"]`).click();assert.equal(playerAct(expected,{type:'sprayPurifier',uid:tank.uid,target:target.id}),null);await page.keyboard.press('Escape');await page.screenshot({path:join(out,name+'-spray.png')});const samples=await sampling;writeFileSync(join(out,name+'-samples.json'),JSON.stringify(samples));const held=samples.filter(row=>row.action?.propUid===tank.uid&&row.actionProp.visible);assert.ok(held.length,name+' tank was observed');for(const row of held){assert.equal(row.action!.propHand,missing?1:0);assert.equal(row.action!.propDef,tank.def);const grip=row.actors.find(a=>a.actor===p.id)!.human!.grips[missing?'left':'right'];assert.ok(Math.hypot(grip[0]-row.actionProp.x,grip[1]-row.actionProp.y)<1e-7)}
  await compare(expected,name+'-sprayed');assert.equal(expected.s.creatures.find(c=>c.id===p.id)!.bag.find(i=>i.uid===tank.uid)!.uses,3)
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,name+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({name,originalTank:tank.uid,observed:held.length,remainingUses:3})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostTitleWrites:true,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({pairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error)+'\n'+await page.locator('body').innerText());throw error}finally{await browser.close()}
