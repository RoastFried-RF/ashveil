/** Finite original actors/items, then Title load and actual UI/keys; no post-load world writes. */
import {chromium,type Page} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {seedState} from '../src/core/rng'
import {playerAct} from '../src/core/game'
import {makeItem,addToBag} from '../src/core/items'
import {killCreature} from '../src/core/combat'
import {hpMax} from '../src/core/body'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {bestiaryDef} from '../src/core/bestiary-state'
import type {Action} from '../src/core/actions'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
type Kind='lab'|'aware'|'unaware'|'shot'
const out=process.argv[2]??'test-results/autonomy-v375/native-r1';mkdirSync(out,{recursive:true})
function fixture(kind:Kind){
 const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.creatures=[p];s.fx=[];s.weather='clear';s.weatherUntil=1e12;s.log=[];s.noiseEvents=[]
 Object.assign(s.map,{layout:undefined,kind:'dungeon',ambient:1,lights:[],props:[],rooms:[],links:[],exits:[],name:'관로 지네 · '+kind})
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:true,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 p.pos={x:20,y:20};p.facing=2;p.bag=[];p.equip={};p.activity=undefined;p.nextAct=s.time;p.freeActTurn=undefined;p.stats={str:14,agi:16,per:16,vit:18,wil:16};p.skills.archery=6;p.hp=hpMax(w,p);p.needs.nutritionDay=Math.floor(s.time/(100*28800));p.needs.kcal=1800
 const knife=makeItem(w,'Item.RustyKnife');p.equip.main=knife
 const crawler=createCreature(w,'Creature.ConduitCrawler',{x:kind==='lab'?21:kind==='shot'?28:23,y:20});s.creatures.push(crawler);crawler.nextAct=s.time+60;crawler.needs.kcal=2000;crawler.cooldowns['Ab.CrawlerCoil']=Math.floor(s.time/100)+1000
 s.knowledge.bestiary[crawler.def]={seen:10,fought:0,killed:0,observeTurns:bestiaryDef(w).observeTurns,encounters:1,...(kind==='lab'?{dissected:bestiaryDef(w).autoDissectAfter}:{})}
 const glandUid=crawler.crawlerState!.glands[0].uid
 if(kind==='lab'){
  crawler.crawlerState!.glands[0].item!.uses=2;crawler.crawlerState!.glands[0].spentDoses=1;killCreature(w,crawler,'유한 초기 검토 사체')
  addToBag(w,p,makeItem(w,'Item.Cloth',2));addToBag(w,p,makeItem(w,'Item.Arrow',4));s.map.tiles[21*s.map.w+20].t='Terrain.Campfire';s.map.lights=[{pos:{x:20,y:21},radius:5,kind:'campfire'}]
 }
 if(kind==='shot'){crawler.crawlerState!.mode='floor';const bow=makeItem(w,'Item.Bow');bow.quality=3;p.equip.main=bow;addToBag(w,p,makeItem(w,'Item.Arrow',4));addToBag(w,p,makeItem(w,'Item.CrawlerVenomSac'))}
 if(kind!=='lab')s.rng.combat=seedState('crawler-native-1','combat')
 invalidateLights(w);updatePlayerVision(w,p)
 return{kind,initial:serialize(s),crawler:crawler.id,glandUid,expected:{db:w.db,s:deserialize(serialize(s))}}
}
const server=await startNativePreview(4389);let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined
const errors:string[]=[],pairs:unknown[]=[],runs:unknown[]=[]
async function settled(){await page!.waitForSelector('[data-testid=map][data-ready=true] canvas');await page!.waitForFunction(()=>{const h=window as unknown as Hook,w=h.__ashveil.world();return!w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&!h.render_game_presentation().moving})}
async function compare(f:ReturnType<typeof fixture>,phase:string){await settled();f.expected.s.fx.length=0;const actual=await page!.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));assert.equal(stateHash(actual),stateHash(f.expected.s),phase);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(f.expected.s)));pairs.push({phase,hash:stateHash(actual)});return actual}
async function load(f:ReturnType<typeof fixture>,width:number,height:number){await page!.setViewportSize({width,height});writeFileSync(join(out,'initial-'+f.kind+'.json'),f.initial);await page!.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:.5,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial);await page!.reload();await page!.getByTestId('continue').click();await settled();await page!.getByRole('button',{name:'간략',exact:true}).click()}
async function input(f:ReturnType<typeof fixture>,key:string,action:Action){await page!.keyboard.press(key);assert.equal(playerAct(f.expected,action),null);await settled()}
async function action(f:ReturnType<typeof fixture>,selector:string,a:Action){await page!.locator(selector).click();assert.equal(playerAct(f.expected,a),null);await settled()}
async function sample(id:number,ms=1250){return page!.evaluate(async({id,ms})=>{const rows:View['actors'][number][]=[];const start=performance.now();while(performance.now()-start<ms){await new Promise(resolve=>requestAnimationFrame(resolve));const a=(window as unknown as Hook).render_game_presentation().actors.find(a=>a.actor===id);if(a)rows.push(a)}return rows},{id,ms})}
async function restore(f:ReturnType<typeof fixture>){await page!.getByRole('button',{name:'타이틀',exact:true}).click();await page!.getByTestId('continue').click();await compare(f,f.kind+'-save-continue');await page!.getByRole('button',{name:'타이틀',exact:true}).click()}
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(server.url)
 const lab=fixture('lab');await load(lab,1440,1080);await page.screenshot({path:join(out,'initial-real-corpse.png')});await input(lab,'s',{type:'search',includeEmpty:true});await compare(lab,'lab-actual-search');if(!await page.getByTestId('dissect-corpse').isVisible())await page.keyboard.press('i')
 await action(lab,'[data-testid=dissect-corpse]',{type:'dissect',target:lab.crawler});await compare(lab,'lab-actual-dissection');await page.screenshot({path:join(out,'actual-harvest-icons.png')})
 await action(lab,'[data-testid=loot-all]',{type:'lootAll'});await compare(lab,'lab-actual-original-materials');assert.equal(lab.expected.s.creatures.find(c=>c.id===lab.expected.s.playerId)!.bag.find(i=>i.uid===lab.glandUid)!.uses,2)
 await page.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(playerAct(lab.expected,{type:'lootClose'}),null);await page.keyboard.press('i');await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click()
 const lp=lab.expected.s.creatures.find(c=>c.id===lab.expected.s.playerId)!,arrow=lp.bag.find(i=>i.def==='Item.Arrow')!;await action(lab,`[data-coat-arrow="${lab.glandUid}"]`,{type:'coatArrow',uid:lab.glandUid,arrowUid:arrow.uid});await compare(lab,'lab-actual-coating');const coated=lp.bag.find(i=>i.toxin)!;await action(lab,`[data-select-toxin="${coated.uid}"]`,{type:'selectAmmo',uid:coated.uid});await compare(lab,'lab-actual-ammo-selection');await page.screenshot({path:join(out,'actual-gland-and-poison-arrow.png')})
 for(const[id,query]of[['Recipe.CrawlerCuirass','외골격 흉갑'],['Recipe.RoastedCrawlerMeat','지네 고기 굽기']]){await page.getByTestId('craft-tab-recipes').click();await page.getByTestId('craft-search').fill(query);await page.getByTestId(id).getByRole('button',{name:'제작',exact:true}).click();assert.equal(playerAct(lab.expected,{type:'craft',id}),null);await settled();await compare(lab,'lab-'+id);await page.screenshot({path:join(out,id+'.png')})}
 await page.keyboard.press('Escape');await page.keyboard.press('i');const armour=lp.bag.find(i=>i.def==='Item.CrawlerCuirass')!;await page.locator(`[data-inventory-item="${armour.uid}"]`).dblclick();assert.equal(playerAct(lab.expected,{type:'equip',uid:armour.uid}),null);await settled();await compare(lab,'lab-actual-cuirass-equipped');await page.screenshot({path:join(out,'actual-cuirass-equipped.png')});await page.keyboard.press('Escape');runs.push({kind:'lab',width:1440,height:1080,actualSearchDissectionLoot:true,originalPartlySpentGlandUID:lab.glandUid,actualCoatSelectCraftCookEquip:true});await restore(lab)
 for(const kind of['aware','unaware']as const){const f=fixture(kind);await load(f,kind==='aware'?1366:1440,kind==='aware'?768:1080);await input(f,'ArrowRight',{type:'move',dir:2});await compare(f,kind+'-approach');if(kind==='aware'){await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await action(f,'[data-testid=inspect-ceiling]',{type:'inspectCeiling'});await compare(f,kind+'-actual-ceiling-inspection');await page.screenshot({path:join(out,'actual-ceiling-inspection.png')});await page.keyboard.press('Escape')}
  const sampling=sample(f.crawler,1600);await input(f,'ArrowRight',{type:'move',dir:2});const rows=await sampling;writeFileSync(join(out,kind+'-drop-presentation.json'),JSON.stringify(rows));const state=await compare(f,kind+'-actual-drop'),c=state.creatures.find(c=>c.id===f.crawler)!;assert.equal(c.crawlerState!.lastDrop!.aware,kind==='aware');assert.equal(c.crawlerState!.mode,'floor');assert.ok(rows.some(r=>r.crawler?.sourceFrame==='av375_crawler_head_open'));for(const row of rows){if(!row.crawler)continue;assert.ok(Math.hypot(row.crawler.root.x-(row.feet.x*16+8),row.crawler.root.y-(row.feet.y*16+14))<1e-7);assert.equal(row.crawler.legs.length,16)}await page.screenshot({path:join(out,'actual-'+kind+'-drop.png')});runs.push({kind,actualMoveAndDrop:true,actualPaidInspection:kind==='aware',presentationSamples:rows.length,poseOpenObserved:true});await restore(f)
 }
 const shot=fixture('shot');await load(shot,1366,768);await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();const sp=shot.expected.s.creatures.find(c=>c.id===shot.expected.s.playerId)!,sac=sp.bag.find(i=>i.def==='Item.CrawlerVenomSac')!,ammo=sp.bag.find(i=>i.def==='Item.Arrow')!;await action(shot,`[data-coat-arrow="${sac.uid}"]`,{type:'coatArrow',uid:sac.uid,arrowUid:ammo.uid});await compare(shot,'shot-coating');const poison=sp.bag.find(i=>i.toxin)!;await action(shot,`[data-select-toxin="${poison.uid}"]`,{type:'selectAmmo',uid:poison.uid});await compare(shot,'shot-selected');await page.keyboard.press('Escape');await page.keyboard.press('f');await input(shot,'Enter',{type:'shoot',target:shot.crawler});const hit=await compare(shot,'shot-real-projectile'),target=hit.creatures.find(c=>c.id===shot.crawler)!;assert.ok(target.paralysis?.some(p=>p.sourceUid===sac.uid));assert.equal(sac.uses,2);assert.ok(!sp.bag.some(i=>i.uid===poison.uid));await page.screenshot({path:join(out,'actual-poisoned-arrow-hit.png')});runs.push({kind:'shot',actualCoatSelectFire:true,originalSourceUID:sac.uid,actualWoundBoundParalysis:true});await restore(shot)
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,independentWholeJSONAndHash:true,runs,pairs,errors,scope:'Four finite scenes with a declared combat seed and distant ranged start to isolate single events, not balance evidence. Actual corpse search/dissection/loot, original partly spent gland, real coating/selection, real cuirass/cooking/equipment, ordinary aware/unaware ceiling approach and actual poisonous projectile. Runtime uses one dorsal source/6regions; no natural campaign, all devices, Full/World/1000 or release approval.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,wholePairs:pairs.length,errors}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),runs,pairs,errors},null,2)+'\n');try{await page?.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure-body.txt'),await page!.locator('body').innerText())}catch{/* load/network failure */}throw error}finally{await page?.close();await browser?.close();server.stop()}
