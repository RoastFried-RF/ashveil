/** Finite original live humanoid NPCs; Title load, real keys, independent full Node state. */
import{chromium}from'playwright-core'
import assert from'node:assert/strict'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import{prisonerFixture}from'../tests/prisoner-fixture'
import{createCreature}from'../src/core/creatures'
import{makeItem}from'../src/core/items'
import{playerAct}from'../src/core/game'
import{serialize,deserialize,stateHash}from'../src/core/save'
import{invalidateLights,updatePlayerVision}from'../src/core/fov'
import type{World}from'../src/core/ctx'
import type{Action}from'../src/core/actions'
import type{MapRenderer}from'../src/client/render/MapRenderer'
type Hook={__ashveil:{world():World};render_game_presentation():NonNullable<ReturnType<MapRenderer['presentation']>>}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const variants=[['shade0','Creature.Shade','shade'],['shade1','Creature.Shade','shade'],['shade2','Creature.Shade','shade'],['shade3','Creature.Shade','shade'],['shade_chief','Creature.ShadeChief','shade'],['withered','Creature.Withered','withered'],['withered_priest','Creature.WitheredPriest','withered'],['spore0','Creature.SporeMan','spore'],['spore1','Creature.SporeMan','spore']]
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7),modes=only?['bare','equipped','losses'].filter(mode=>only.split(',').includes(mode)):['bare','equipped','losses'],helmet=process.argv.includes('--helmet');assert.ok(modes.length)
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:unknown[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(expected:World,label:string,action?:Action){if(action)assert.equal(playerAct(expected,action),null,label);await page.waitForFunction(t=>(window as unknown as Hook).__ashveil.world().s.time===t,expected.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(expected.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label);pairs.push({label,hash:stateHash(actual)});return await page.evaluate(()=>(window as unknown as Hook).render_game_presentation())}
try{
 await page.goto(url)
 for(const mode of modes)for(const[direction,facing]of[['down',4],['left',6],['right',2],['up',0]]as const){
  const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
  for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
  p.facing=helmet?facing:4;p.bag=[];p.equip={};if(helmet)p.equip.head=makeItem(w,'Item.ScrapHelmet');const actors=variants.map(([name,def,body],i)=>{const npc=createCreature(w,def,{x:p.pos.x+(i%3-1)*3,y:p.pos.y+(Math.floor(i/3)-1)*2-1});npc.sprite=name;npc.facing=facing;npc.nextAct=s.time+1e9;npc.met=true;npc.faction='player';npc.ai.mode='guard';npc.bag=[];npc.equip={};npc.body.missing=mode==='losses'?['LeftIndex','RightToe1','Nose']:[];if(mode==='equipped'){npc.equip.chest=makeItem(w,'Item.RagShirt');npc.equip.feet=makeItem(w,'Item.Boots');npc.equip.head=makeItem(w,helmet?'Item.ScrapHelmet':'Item.Hood');npc.equip.main=makeItem(w,'Item.RustyKnife')}s.creatures.push(npc);return{id:npc.id,name,body}})
  s.fx=[];invalidateLights(w);updatePlayerVision(w,p);const initial=serialize(s),expected={db:w.db,s:deserialize(initial)},label=mode+'-'+direction;writeFileSync(join(out,label+'-initial.json'),initial)
  await page.setViewportSize(mode==='bare'?{width:1440,height:1080}:{width:1366,height:768});await page.evaluate(({initial,mode})=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:mode==='bare'?4:3}))},{initial,mode});await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');const view=await compare(expected,label+'-loaded');assert.equal(view.actors.filter(a=>a.human).length,10)
  for(const actor of actors){const human=view.actors.find(a=>a.actor===actor.id)?.human;assert.ok(human,actor.name+' visible');assert.ok(human.base.includes(actor.body));assert.equal(human.direction,direction);if(mode==='losses'&&direction!=='up')assert.ok(human.parts.some(p=>p.owner==='Nose'&&p.role==='loss-mark'));if(mode==='equipped')assert.ok(human.parts.some(p=>p.role==='clothing'));for(const side of['left','right']as const)assert.ok(Math.hypot(human.footSources[side].sole[0]-human.footProjection[side].actual[0],human.footSources[side].sole[1]-human.footProjection[side].actual[1])<1e-7)}
  writeFileSync(join(out,label+'-presentation.json'),JSON.stringify(view));await page.screenshot({path:join(out,label+'.png')});await page.keyboard.press('Period');await compare(expected,label+'-waited',{type:'wait'});await page.keyboard.press('Control+ArrowRight');await compare(expected,label+'-faced',{type:'face',dir:2});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,label+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();rows.push({mode,direction,actors})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({helmet,finiteInitial:true,noPostTitleWorldWrites:true,wholePairs:pairs.length,rows,pairs,errors},null,2));console.log(JSON.stringify({scenes:rows.length,pairs:pairs.length,errors}))
}catch(e){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(e),pairs,rows,errors},null,2));throw e}finally{await browser.close()}
