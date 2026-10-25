/** Finite declared scenes; Title load, real inputs, independent whole-state expected worlds. */
import {chromium,type Page} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {seedState} from '../src/core/rng'
import {playerAct} from '../src/core/game'
import {addToBag,makeItem} from '../src/core/items'
import {hpMax} from '../src/core/body'
import {killCreature} from '../src/core/combat'
import {cullerCooling} from '../src/core/culler-state'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {bestiaryDef} from '../src/core/bestiary-state'
import type {Action} from '../src/core/actions'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type Kind='lab'|'water'|'fire'|'bell'|'combat'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
const out=process.argv[2]??'test-results/autonomy-v379/native-r1';mkdirSync(out,{recursive:true})
function fixture(kind:Kind,seed='culler-native-1'){
 const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.creatures=[p];s.fx=[];s.log=[];s.noiseEvents=[];s.weather='clear';s.weatherUntil=1e12
 Object.assign(s.map,{layout:undefined,kind:'dungeon',ambient:1,lights:[],props:[],rooms:[],links:[],exits:[],gardenAlert:{level:kind==='combat'?3:0,events:[]},name:'구제기 · '+kind})
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:true,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 p.pos={x:20,y:20};p.facing=2;p.bag=[];p.equip={};p.activity=undefined;p.nextAct=s.time;p.freeActTurn=undefined;p.stats={str:14,agi:16,per:16,vit:18,wil:16};p.hp=hpMax(w,p);p.needs.nutritionDay=Math.floor(s.time/(100*28800));p.needs.kcal=1800
 const c=createCreature(w,'Creature.Culler',{x:kind==='combat'?23:21,y:20});c.home={...c.pos};s.creatures.push(c);c.nextAct=s.time
 s.knowledge.bestiary[c.def]={seen:10,fought:0,killed:0,observeTurns:bestiaryDef(w).observeTurns,encounters:1,...(kind==='lab'?{dissected:bestiaryDef(w).autoDissectAfter}:{})}
 const tankUid=c.body.machine!.components!.find(i=>i.def==='Item.CullerPurifierTank')!.uid
 let dummy:number|undefined
 if(kind==='lab'){
  c.body.machine!.components!.find(i=>i.uid===tankUid)!.uses=4;c.cullerState!.components.find(i=>i.uid===tankUid)!.spent=2;killCreature(w,c,'유한 초기 검토 사체')
  p.equip.main=makeItem(w,'Item.IronHammer');addToBag(w,p,makeItem(w,'Item.Wood'));addToBag(w,p,makeItem(w,'Item.Cloth',2));p.recipes=['Recipe.CullerGlaive','Recipe.CullerHeartCells'];p.booksRead=['Item.CullerSpecifications']
  const t=createCreature(w,'Creature.TenderDrone',{x:22,y:20});t.body.machine!.power=0;t.unconscious=true;s.creatures.push(t);dummy=t.id
 }else if(kind!=='combat'){
  c.cullerState!.coolUntil=Math.floor(s.time/100)+10
  if(kind==='water')addToBag(w,p,makeItem(w,'Item.WaterBottle'))
  if(kind==='fire'){const torch=makeItem(w,'Item.Torch');torch.lit=true;p.equip.main=torch}
  if(kind==='bell')addToBag(w,p,makeItem(w,'Item.MaintenanceBell'))
 }else{
  // Actual original armor; normal anatomical HP, no invulnerability or post-load adjustments.
  p.equip.head=makeItem(w,'Item.ScrapHelmet');p.equip.chest=makeItem(w,'Item.ScrapMail');c.cullerState!.tracked={id:p.id,pos:{...p.pos},at:Math.floor(s.time/100)}
 }
 s.rng.combat=seedState(seed,'combat');invalidateLights(w);updatePlayerVision(w,p)
 return{kind,initial:serialize(s),machine:c.id,tankUid,dummy,expected:{db:w.db,s:deserialize(serialize(s))}}
}
if(process.argv.includes('--preflight')){
 for(let i=1;i<=16;i++){const f=fixture('combat','culler-native-'+i),rows=[];for(let n=0;n<9;n++){const error=playerAct(f.expected,{type:'wait'}),p=f.expected.s.creatures.find(c=>c.id===f.expected.s.playerId)!,c=f.expected.s.creatures.find(c=>c.id===f.machine)!;rows.push({n,error,hp:p.hp,alive:p.alive,attacks:c.body.machine!.attacks??0,cooling:cullerCooling(f.expected,c)});if(!p.alive||error||cullerCooling(f.expected,c))break}console.log(JSON.stringify({seed:i,rows}));if(rows.at(-1)?.alive&&rows.at(-1)?.cooling)break}
 process.exit(0)
}
const server=await startNativePreview(4391);let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined
const errors:string[]=[],pairs:{phase:string;hash:string}[]=[],runs:unknown[]=[]
async function settled(){await page!.waitForSelector('[data-testid=map][data-ready=true] canvas');await page!.waitForFunction(()=>{const h=window as unknown as Hook,w=h.__ashveil.world();return!w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&!h.render_game_presentation().moving})}
async function compare(f:ReturnType<typeof fixture>,phase:string){await settled();f.expected.s.fx.length=0;const actual=await page!.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));assert.equal(stateHash(actual),stateHash(f.expected.s),phase);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(f.expected.s)));pairs.push({phase,hash:stateHash(actual)});return actual}
async function load(f:ReturnType<typeof fixture>,width:number,height:number){await page!.setViewportSize({width,height});writeFileSync(join(out,'initial-'+f.kind+'.json'),f.initial);await page!.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial);await page!.reload();await page!.getByTestId('continue').click();await settled();await page!.getByRole('button',{name:'간략',exact:true}).click()}
async function input(f:ReturnType<typeof fixture>,key:string,a:Action){await page!.keyboard.press(key);assert.equal(playerAct(f.expected,a),null);await settled()}
async function action(f:ReturnType<typeof fixture>,selector:string,a:Action){await page!.locator(selector).click();assert.equal(playerAct(f.expected,a),null);await settled()}
async function field(){await page!.keyboard.press('F2');await page!.getByTestId('craft-tab-field').click()}
async function restore(f:ReturnType<typeof fixture>){await page!.getByRole('button',{name:'타이틀',exact:true}).click();await page!.getByTestId('continue').click();await compare(f,f.kind+'-save-continue');await page!.getByRole('button',{name:'타이틀',exact:true}).click()}
async function samplePlayer(){return page!.evaluate(async()=>{const rows:View[]=[],start=performance.now();while(performance.now()-start<1300){await new Promise(resolve=>requestAnimationFrame(resolve));rows.push((window as unknown as Hook).render_game_presentation())}return rows})}
async function sample(id:number){return page!.evaluate(async id=>{const rows:View['actors'][number][]=[];const start=performance.now();while(performance.now()-start<1500){await new Promise(resolve=>requestAnimationFrame(resolve));const a=(window as unknown as Hook).render_game_presentation().actors.find(a=>a.actor===id);if(a)rows.push(a)}return rows},id)}
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(server.url)
 const lab=fixture('lab');await load(lab,1440,1080);await input(lab,'s',{type:'search',includeEmpty:true});await compare(lab,'lab-real-search');if(!await page.getByTestId('dissect-corpse').isVisible())await page.keyboard.press('i');await action(lab,'[data-testid=dissect-corpse]',{type:'dissect',target:lab.machine});await compare(lab,'lab-real-dissection');await page.screenshot({path:join(out,'actual-harvest-icons.png')});await action(lab,'[data-testid=loot-all]',{type:'lootAll'});await compare(lab,'lab-original-stock');const lp=lab.expected.s.creatures.find(c=>c.id===lab.expected.s.playerId)!;assert.equal(lp.bag.find(i=>i.uid===lab.tankUid)!.uses,4)
 await page.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(playerAct(lab.expected,{type:'lootClose'}),null);await page.keyboard.press('i');await field();await page.getByTestId('craft-tab-recipes').click();await page.getByTestId('craft-search').fill('정원사 낫창');await page.getByTestId('Recipe.CullerGlaive').getByRole('button',{name:'제작',exact:true}).click();assert.equal(playerAct(lab.expected,{type:'craft',id:'Recipe.CullerGlaive'}),null);await compare(lab,'lab-real-glaive-craft');await page.keyboard.press('Escape');await page.keyboard.press('i');const glaive=lp.bag.find(i=>i.def==='Item.CullerGlaive')!;await page.locator(`[data-inventory-item="${glaive.uid}"]`).dblclick();assert.equal(playerAct(lab.expected,{type:'equip',uid:glaive.uid}),null);await compare(lab,'lab-real-glaive-equip');await page.screenshot({path:join(out,'actual-glaive-equipped.png')});await page.keyboard.press('Escape');await page.screenshot({path:join(out,'actual-glaive-held-world.png')});await field();await page.getByTestId('purifier-target').selectOption(String(lab.dummy));const spraying=samplePlayer();await action(lab,`[data-purifier-spray="${lab.tankUid}"]`,{type:'sprayPurifier',uid:lab.tankUid,target:lab.dummy!});const sprayRows=await spraying;writeFileSync(join(out,'actual-tank-prop-presentation.json'),JSON.stringify(sprayRows));assert.ok(sprayRows.some(r=>r.action?.propUid===lab.tankUid&&r.action?.propDef==='Item.CullerPurifierTank'));await compare(lab,'lab-real-recovered-acid');assert.equal(lp.bag.find(i=>i.uid===lab.tankUid)!.uses,3);await page.screenshot({path:join(out,'actual-recovered-tank.png')});await page.keyboard.press('Escape');runs.push({kind:'lab',realSearchDissectionLootCraftEquipSpray:true,originalPartlySpentTankUID:lab.tankUid,priorKnowledge:'declared S3/S4 and learned glaive recipe; reading discovery not exercised'});await restore(lab)
 for(const kind of['water','fire','bell']as const){const f=fixture(kind);await load(f,1366,768);await field();const p=f.expected.s.creatures.find(c=>c.id===f.expected.s.playerId)!;if(kind==='water'){const bottle=p.bag.find(i=>i.def==='Item.WaterBottle')!;await action(f,`[data-culler-water="${f.machine}"]`,{type:'cullerWater',target:f.machine,uid:bottle.uid})}else if(kind==='fire')await action(f,`[data-culler-fire="${f.machine}"]`,{type:'cullerIgnite',target:f.machine,uid:p.equip.main!.uid});else{const bell=p.bag.find(i=>i.def==='Item.MaintenanceBell')!;await action(f,`[data-maintenance-bell="${bell.uid}"]`,{type:'ringMaintenanceBell',uid:bell.uid})}await compare(f,kind+'-actual-counterplay');await page.screenshot({path:join(out,'actual-'+kind+'.png')});await page.keyboard.press('Escape');runs.push({kind,realPaidUI:true,initialCooling:'declared finite cooling state before Title load'});await restore(f)}
 const combat=fixture('combat');await load(combat,1440,1080);const rows:Awaited<ReturnType<typeof sample>>=[];let waits=0;for(;waits<9;waits++){const sampling=sample(combat.machine);await input(combat,'Period',{type:'wait'});rows.push(...await sampling);await compare(combat,'combat-wait-'+waits);const c=combat.expected.s.creatures.find(c=>c.id===combat.machine)!;assert.equal(combat.expected.s.creatures.find(c=>c.id===combat.expected.s.playerId)!.alive,true);if(cullerCooling(combat.expected,c))break}assert.ok(waits<9);assert.ok(rows.some(r=>r.culler));for(const row of rows){if(!row.culler)continue;assert.equal(row.culler.pose.legs.length,6);assert.ok(Math.hypot(row.culler.root.x-(row.feet.x*16+8),row.culler.root.y-(row.feet.y*16+14))<1e-7)}writeFileSync(join(out,'combat-presentation.json'),JSON.stringify(rows));await page.screenshot({path:join(out,'actual-four-attack-cooling.png')});runs.push({kind:'combat',realWaits:waits+1,originalFiniteAcidNet:true,presentationSamples:rows.length,sourceRegions:24,authoredDirections:4,notBalanceEvidence:true});await restore(combat)
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,independentWholeJSONAndHash:true,runs,pairs,errors,scope:'Finite original partly spent stock, prior dissection/recipe knowledge, declared cooling counterplay and combat seed isolate actual inputs. Not a natural campaign, Full/World/1000 or release approval.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,wholePairs:pairs.length,errors}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),runs,pairs,errors},null,2)+'\n');try{await page?.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure-body.txt'),await page!.locator('body').innerText())}catch{/* failed load */}throw error}finally{await page?.close();await browser?.close();server.stop()}
