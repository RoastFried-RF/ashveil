/** Finite original-body scenes; after Title, real keys/pointer only. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,existsSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {makeItem} from '../src/core/items'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {ProstheticDef} from '../src/core/types'
import {turnOf} from '../src/core/ctx'
import {db} from '../tests/helpers'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
const out=process.argv[2]??'test-results/autonomy-v389/human-fit-r1',url=process.argv[3]??'http://localhost:4395/?debug';assert.equal(existsSync(out),false,'Preserve previous observations');mkdirSync(out,{recursive:true})
type Hook={__ashveil:{world():World};render_game_presentation():NonNullable<ReturnType<MapRenderer['presentation']>>}
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],pairs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 const scenes=[...(['down','left','right','up']as const).map((npcDirection,index)=>({id:'npc-'+npcDirection,npcDirection,npcFacing:[4,6,2,0][index]})),{id:'base'},{id:'coat'},{id:'lost-arm',missing:'LeftUpperArm'},{id:'lining'},...db.all<ProstheticDef>('Prosthetic').flatMap(rule=>rule.targets.map(root=>({id:rule.id+'-'+root,rule,root})))];
 for(const entry of scenes){const scene=entry.id;if(process.argv[4]&&!new RegExp(process.argv[4]).test(scene))continue;
  const f=prisonerFixture(),{w,s,p}=f;s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.sources=[];s.map.kind='dungeon';s.map.depth=3;s.map.name='인물 조립 유한 검토실';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
  for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]});p.bag=[];p.equip={};p.facing=4;p.hotbar=Array(10).fill(null)
  if(scene==='coat'){for(const[id,slot]of [['Item.LeatherCoat','chest'],['Item.Hood','head'],['Item.Boots','feet'],['Item.Gloves','hands'],['Item.LeatherBelt','belt'],['Item.Quiver','back'],['Item.RustyKnife','main']]as const)p.equip[slot]=makeItem(w,id)}
  if('missing' in entry)p.body.missing=[entry.missing as string];
  if(scene==='lining'){p.equip.chest=makeItem(w,'Item.LeatherCoat');p.equip.lining=makeItem(w,'Item.RagShirt')}
  if('rule' in entry){const root=entry.root as string,rule=entry.rule as ProstheticDef,item=makeItem(w,rule.item);p.body.missing=[root];p.body.prosthetics={[root]:{def:rule.id,item,installedAt:turnOf(w),servicedAt:turnOf(w),powerUntil:turnOf(w)+1000}}}
  if('npcDirection' in entry){for(const[index,def]of ['Creature.Settler','Creature.SettlementDoctor','Creature.SettlementTrader','Creature.SettlementGuard','Creature.Reaver','Creature.ReaverChief','Creature.ReaverArcher','Creature.Drifter'].entries()){const npc=createCreature(w,def,{x:p.pos.x+(index%4-1)*2,y:p.pos.y+Math.floor(index/4)*2-3});npc.facing=entry.npcFacing as number;npc.nextAct=s.time+1e9;npc.met=true;npc.faction='player';npc.ai.mode='guard';s.creatures.push(npc)}}
  s.fx=[];invalidateLights(w);updatePlayerVision(w,p);const initial=serialize(s),expected={db:w.db,s:deserialize(initial)};writeFileSync(join(out,scene+'-initial.json'),initial)
  await page.goto(url);await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false}))},initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).render_game_presentation()?.actors.find(a=>a.actor===1)?.human)
  for(const[direction,key,dir]of [['down','Control+ArrowDown',4],['left','Control+ArrowLeft',6],['right','Control+ArrowRight',2],['up','Control+ArrowUp',0]]as const){
   if('npcDirection' in entry&&direction!=='down')continue;
   await page.keyboard.press(key);assert.equal(playerAct(expected,{type:'face',dir}),null);await page.waitForTimeout(100);expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,scene+'-'+direction+'-actual.json'),serialize(actual));writeFileSync(join(out,scene+'-'+direction+'-expected.json'),serialize(expected.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)));assert.equal(stateHash(actual),stateHash(expected.s));const presentation=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation()),human=presentation.actors.find(a=>a.actor===1)!.human;assert.ok(human);if('npcDirection' in entry){assert.equal(presentation.actors.filter(a=>a.human).length,9);for(const actor of presentation.actors)if(actor.actor!==1)assert.equal(actor.human?.direction,entry.npcDirection)}writeFileSync(join(out,scene+'-'+direction+'-presentation.json'),JSON.stringify(presentation));await page.screenshot({path:join(out,scene+'-'+direction+'-world.png')});const point=presentation.screen.feet;await page.screenshot({path:join(out,scene+'-'+direction+'-body.png'),clip:{x:Math.max(0,point.x-90),y:Math.max(0,point.y-130),width:180,height:160}});pairs.push({scene,direction,hash:stateHash(actual),human})
  }
  await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,actualInputs:true,pairs,errors},null,2));console.log(JSON.stringify({pairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error)+'\n'+await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await browser.close()}
