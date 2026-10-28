/** Declared finite scenes; after title loading, only real keys and pointer inputs. */
import {chromium,type Page} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {perform} from '../src/core/actions'
import {playerAct} from '../src/core/game'
import {createCreature} from '../src/core/creatures'
import {calendar} from '../src/core/climate-state'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeItem} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
type Kind='warning'|'walk'|'paw'|'bite'|'winter'
const attacksOnly=process.argv.includes('--attacks-only')
const out=process.argv[2]??'test-results/autonomy-v348/native';mkdirSync(out,{recursive:true})
function fixture(kind:Kind){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12
 Object.assign(s.map,{layout:undefined,kind:'dungeon',depth:1,ambient:1,lights:[],props:[],rooms:[],links:[],exits:[],name:'잿곰 · 실제 경고/몸/겨울잠 유한 장면'})
 for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.Earth',roof:true,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 const season=kind==='winter'?'Season.Winter':'Season.Summer';while(calendar(w).season.id!==season)s.time+=28800*100
 if(kind==='bite'&&s.time/100%2===0)s.time+=100
 if(kind==='paw'&&s.time/100%2!==0)s.time+=100
 p.pos=kind==='warning'?{x:26,y:20}:kind==='walk'?{x:25,y:25}:kind==='winter'?{x:28,y:20}:{x:25,y:20};p.bag=[];p.equip={};p.activity=undefined;p.nextAct=s.time;p.facing=6;p.needs.nutritionDay=Math.floor(s.time/(100*28800))
 const bear=createCreature(w,'Creature.CinderBear',{x:20,y:20});bear.home={...bear.pos};bear.met=true;bear.facing=2;bear.asleep=false;bear.unconscious=false;bear.traits=[];bear.nextAct=s.time+1;Object.assign(bear.needs,{kcal:kind==='warning'||kind==='winter'?2000:-2000,waterDeficit:0,fatigue:10,bodyTemp:37});bear.cooldowns['Ab.Bear.Grip']=s.time/100+10;s.creatures=[p,bear]
 let victim:number|undefined
 if(kind==='paw'||kind==='bite'){const target=createCreature(w,p.def,{x:21,y:20});target.faction='coalition';target.met=true;target.asleep=false;target.unconscious=false;target.bag=[];target.equip={};target.ai.mode='calm';target.nextAct=s.time+1000;s.creatures.push(target);victim=target.id}
 let knife:number|undefined
 if(kind==='winter'){assert.equal(perform(w,bear,{type:'sleep',seasonal:true}).ok,true);p.pos={x:21,y:20};const item=makeItem(w,'Item.RustyKnife');knife=item.uid;p.equip.main=item}
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 return{kind,initial:serialize(s),bear:bear.id,knife,victim,expected:{db:w.db,s:deserialize(serialize(s))}}
}
const server=await startNativePreview(4378);let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined
const errors:string[]=[],runs:unknown[]=[],comparisons:unknown[]=[]
const read=()=>page!.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function settled(){await page!.waitForSelector('[data-testid=map][data-ready=true] canvas');await page!.waitForFunction(()=>{const h=window as unknown as Hook,w=h.__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&!h.render_game_presentation().moving})}
async function load(f:ReturnType<typeof fixture>,width:number,height:number){await page!.setViewportSize({width,height});writeFileSync(join(out,`${f.kind}-${width}-initial.json`),f.initial);await page!.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial);await page!.reload();await page!.getByTestId('continue').click();await settled();await page!.getByRole('button',{name:'간략',exact:true}).click()}
async function compare(f:ReturnType<typeof fixture>,phase:string){await settled();f.expected.s.fx.length=0;const actual=await read();assert.equal(stateHash(actual),stateHash(f.expected.s),f.kind+' '+phase);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(f.expected.s)));comparisons.push({kind:f.kind,phase,wholeHash:stateHash(actual)});writeFileSync(join(out,`${f.kind}-${phase}-state.json`),JSON.stringify(actual));return actual}
async function key(f:ReturnType<typeof fixture>,key:string,action:Parameters<typeof playerAct>[1]){await page!.keyboard.press(key);assert.equal(playerAct(f.expected,action),null);await settled()}
async function samples(id:number,mode:string,ms:number){
 return page!.evaluate(async({id,mode,ms})=>{const rows:{at:number;actor:View['actors'][number]}[]=[],start=performance.now();while(performance.now()-start<ms){await new Promise(resolve=>requestAnimationFrame(resolve));const actor=(window as unknown as Hook).render_game_presentation().actors.find(c=>c.actor===id);if(actor?.mode===mode)rows.push({at:performance.now()-start,actor})}return rows},{id,mode,ms})
}
async function point(id:number){return page!.evaluate(id=>{const v=(window as unknown as Hook).render_game_presentation(),c=v.actors.find(c=>c.actor===id)!,r=document.querySelector('canvas')!.getBoundingClientRect();return{x:r.left+v.screen.feet.x+(c.feet.x-v.feet.x)*16*v.zoom,y:r.top+v.screen.feet.y+(c.feet.y-v.feet.y)*16*v.zoom-12*v.zoom}},id)}
async function title(){await page!.getByRole('button',{name:'타이틀',exact:true}).click();await page!.getByTestId('continue').waitFor()}
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(server.url)
 for(const[width,height]of(attacksOnly?[]:[[1440,1080],[1366,768]])as[number,number][]){
  const f=fixture('warning');await load(f,width,height);await key(f,'Period',{type:'wait'});let s=await compare(f,'first-'+width);assert.equal(s.creatures.find(c=>c.id===f.bear)!.wildlifeState?.denWarning?.progress,1)
  const p=await point(f.bear),hover=page.getByTestId('hover').filter({hasText:'영역 경고'});for(const[dx,dy]of[[0,0],[-4,0],[4,0],[0,-4],[0,4]]){await page.mouse.move(p.x+dx,p.y+dy);await page.waitForTimeout(70);if(await hover.isVisible())break}await hover.waitFor();await page.screenshot({path:join(out,`warning-${width}.png`)});await page.mouse.move(5,5)
  await key(f,'ArrowRight',{type:'move',dir:2});await compare(f,'second-'+width);await key(f,'ArrowRight',{type:'move',dir:2});s=await compare(f,'retreated-'+width);assert.equal(s.creatures.find(c=>c.id===f.bear)!.ai.target,undefined);assert.equal(s.creatures.find(c=>c.id===s.playerId)!.body.wounds.length,0);await page.screenshot({path:join(out,`retreated-${width}.png`)});runs.push({kind:'warning',width,realWaits:1,realMoves:2,actualPointerWarning:true,noAttackDuringRetreat:true});await title()
 }
 if(!attacksOnly){
  const f=fixture('walk');await load(f,1440,1080);const all:Awaited<ReturnType<typeof samples>>=[]
  for(let step=0;step<2;step++){const sampling=samples(f.bear,'walk',1500);await key(f,'Period',{type:'wait'});await page.waitForTimeout(350);await page.screenshot({path:join(out,`actual-walk-step-${step}.png`)});const rows=await sampling;for(let i=1;i<rows.length;i++){const a=rows[i-1].actor.feet,b=rows[i].actor.feet;assert.ok(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))<.25)}all.push(...rows);const state=await compare(f,'step-'+step);assert.deepEqual(state.creatures.find(c=>c.id===f.bear)!.pos,{x:21+step,y:21+step})}
  writeFileSync(join(out,'actual-diagonal-walk-samples.json'),JSON.stringify(all));assert.equal(new Set(all.map(row=>row.actor.frame)).size,4);await page.screenshot({path:join(out,'actual-diagonal-walk.png')});runs.push({kind:'walk',width:1440,realWaits:2,originalWalkFramesObserved:4,readonlyWholeStateExact:true,observedFeetMaxComponentStepLessThanQuarterTile:true,footContactIKApproved:false});await title()
 }
 for(const kind of['paw','bite']as const){
  const f=fixture(kind);await load(f,1366,768);const sampling=samples(f.bear,'attack',1600);await key(f,'Period',{type:'wait'});await page.waitForFunction(({id,kind})=>(window as unknown as Hook).render_game_presentation().actors.some(c=>c.actor===id&&c.mode==='attack'&&c.frame.includes(kind==='bite'?'_bite_':'_attack_')),{id:f.bear,kind});await page.waitForTimeout(350);await page.screenshot({path:join(out,kind+'-actual-strike.png')});const rows=await sampling;writeFileSync(join(out,kind+'-actual-attack-samples.json'),JSON.stringify(rows));assert.equal(new Set(rows.map(row=>row.actor.frame)).size,4);const s=await compare(f,kind);assert.equal(s.creatures.find(c=>c.id===f.bear)!.attackMode,kind);assert.equal(s.creatures.find(c=>c.id===f.bear)!.ai.target,f.victim);assert.equal(s.creatures.find(c=>c.id===s.playerId)!.body.wounds.length,0);writeFileSync(join(out,kind+'-actual-attack-samples.json'),JSON.stringify(rows));await page.screenshot({path:join(out,kind+'-actual-attack.png')});runs.push({kind,width:1366,realWaits:1,originalAttackFramesObserved:4,actualAttackMode:kind,declaredInitialGripCooldownTurns:10,actualTargetOriginalHumanId:f.victim,declaredTargetFaction:'coalition',playerIsUninjuredObserver:true,declaredVictimNextActOffsetTU:1000,readonlyWholeStateExact:true});await title()
 }
 if(!attacksOnly){
  const f=fixture('winter');await load(f,1440,1080);await page.waitForFunction(id=>(window as unknown as Hook).render_game_presentation().actors.some(c=>c.actor===id&&c.mode==='sleep'),f.bear);const sleeping=await samples(f.bear,'sleep',2800);assert.equal(new Set(sleeping.map(row=>row.actor.frame)).size,4);await page.screenshot({path:join(out,'winter-original-sleep.png')});const before=await read(),p=await point(f.bear);const sampling=samples(f.bear,'rise',1600);await page.keyboard.down('Control');try{await page.mouse.click(p.x,p.y)}finally{await page.keyboard.up('Control')}assert.equal(playerAct(f.expected,{type:'attack',target:f.bear}),null);await settled();await page.waitForTimeout(350);await page.screenshot({path:join(out,'winter-actual-rising.png')});const rise=await sampling;assert.equal(new Set(rise.map(row=>row.actor.frame)).size,4);const s=await compare(f,'woken'),bear=s.creatures.find(c=>c.id===f.bear)!;assert.equal(bear.asleep,false);assert.ok(bear.body.wounds.length>before.creatures.find(c=>c.id===f.bear)!.body.wounds.length);assert.ok((bear.wildlifeState?.wakeSlowUntil??0)>s.time/100);assert.equal(s.creatures.find(c=>c.id===s.playerId)!.equip.main?.uid,f.knife);writeFileSync(join(out,'winter-actual-rise-samples.json'),JSON.stringify(rise));await page.screenshot({path:join(out,'winter-actually-woken.png')});runs.push({kind:'winter',width:1440,declaredInitialRealSeasonalSleep:true,realCtrlPointerKnifeAttack:true,originalKnifeUid:f.knife,sleepFrames:4,riseFrames:4,actualNewWound:true,actualWakeSlowWindow:true,readonlyWholeStateExact:true});await title()
 }
 assert.equal(errors.length,0,errors.join('\n'));writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,normalExpectedPresentationFxConsumed:true,runs,comparisons,errors,scope:attacksOnly?'Two actual unarmored coalition-human NPC paw/bite scenes; player is an uninjured observer. No warnings, walking or winter scenes rerun in this invocation.':'Finite warnings/retreat at two sizes; actual diagonal two-step4phase gait, resolved paw/bite4phase originals against a declared real unarmored human while the player observes, declared winter sleep and real knife wake/rise. Full JSON+hash vs independent headless same inputs. Not a natural Blackwood campaign, dense12gait, all directions in game, long-term ecology, wearable-body or v1approval.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,wholePairs:comparisons.length,errors}))
}catch(error){if(page){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()));await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText())}catch{/* closed or title */}}throw error}finally{await page?.close();await browser?.close();server.stop()}
