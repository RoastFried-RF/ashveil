/** Finite declared diagnostic stock, then real UI inputs and independent Core comparisons. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium,type Page} from 'playwright-core'
import {loadDb} from './loadContent'
import {startNativePreview} from './native-preview'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,turnOf,type World} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {readingPageTurns} from '../src/core/knowledge-state'
import {serialize,deserialize,stateHash} from '../src/core/save'
import type {Action} from '../src/core/actions'
import type {ItemDef} from '../src/core/types'

const out=process.argv[2];assert.ok(out&&!existsSync(out),'Use a new output directory');mkdirSync(out,{recursive:true})
const selectedScene=process.argv[3];assert.ok(!selectedScene||['provisions','equipment'].includes(selectedScene),'Unknown diagnostic scene')
const rows:unknown[]=[],errors:string[]=[],fixtures:unknown[]=[]
const server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 const {db,report}=loadDb();assert.deepEqual(report.errors,[])
 for(const scene of selectedScene?[selectedScene]:['provisions','equipment'])for(const[width,height]of [[1440,1080],[1366,768],[390,844]]){
  const prefix=scene+'-'+width,context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(45000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const w:World={db,s:newGame(db,{seed:'ashveil-item-supplies-v406-'+scene,background:'Bg.Deserter',mods:db.loadedMods,characterRoll:0,saveMode:'SaveMode.Study',overworld:true,legacyResidents:[]})};runUntilInput(w)
  const p=player(w);p.bag=[];p.hotbar=Array(10).fill(null)
  const stock=(id:string)=>{const it=makeItem(w,id);assert.equal(addToBag(w,p,it),0,id);return it}
  const meal=scene==='provisions'?stock('Item.OatmealBowl'):undefined
  const bottle=stock('Item.WaterBottle')
  bottle.water={pathogen:scene==='provisions'?.01:35,ash:scene==='provisions'?.01:60,salinity:scene==='provisions'?.75:35,source:scene==='provisions'?'개울물':'바닷물'};bottle.uses=5
  const pill=scene==='provisions'?stock('Item.PillYellow'):undefined,known=scene==='provisions'?stock('Item.PillGreen'):undefined
  const book=scene==='provisions'?stock('Item.SurvivalGuide'):undefined
  const gun=scene==='equipment'?stock('Item.Revolver'):undefined,crossbow=scene==='equipment'?stock('Item.LightCrossbow'):undefined
  const bedding=scene==='equipment'?stock('Item.Bedroll'):undefined
  if(meal){meal.uses=1;meal.foodSealed=false;meal.foodHeatedAt=turnOf(w);meal.foodSaltGrams=.2;meal.foodQ=73}
  if(pill&&known){
   w.s.knowledge.pillMap[pill.def]='Pill.Toxin';(w.s.knowledge.pillBeliefs??={})[pill.def]={belief:'Pill.Analgesic',confidence:'likely',ruledOut:[],evidence:[]};pill.pillAge={potency:37,spoiled:false}
   w.s.knowledge.pillMap[known.def]='Pill.Antibiotic';w.s.knowledge.pillKnown[known.def]='Pill.Antibiotic';known.pillAge={potency:73,spoiled:false}
  }
  if(book){p.literacy=2;p.skills.survival=0;book.readPages=db.item(book.def).book!.pages-1;book.readProgress=readingPageTurns(w,p)-1
   delete p.equip.main;const lamp=makeItem(w,'Item.Lantern');lamp.lit=true;p.equip.off=lamp;invalidateLights(w);updatePlayerVision(w,p)
  }
  if(gun&&crossbow&&bedding){
   p.skills.survival=5;gun.loadedCartridges=[makeItem(w,'Item.FactoryCartridge'),makeItem(w,'Item.ReclaimedCartridge')];gun.loadedAmmo=gun.loadedCartridges[0]!.def;gun.loadedCartridges[0]!.powderWetness=80;gun.firearmFouling=72;gun.firearmJammed=true
   stock('Item.FactoryCartridge');crossbow.loadedAmmo=db.item(crossbow.def).ranged!.ammo;crossbow.loadedAmmoFletching=true;crossbow.bowMoisture=65
   bedding.wetness={torso:40};bedding.beddingScorch=7;bedding.beddingLice={source:p.id,at:turnOf(w),until:turnOf(w)+1200}
   stock('Item.WhitecapCulture');const fragment=stock(db.all<ItemDef>('Item').find(d=>d.rawFragment)!.id);fragment.rawMaterial='Material.Iron';fragment.rawGrams=25
  }
  const raw=serialize(w.s);assert.deepEqual(JSON.parse(serialize(deserialize(raw))),JSON.parse(raw),'Declared fixture must pass real save validation');writeFileSync(join(out,prefix+'-initial-world.json'),raw);fixtures.push({scene,width,height,items:p.bag.map(i=>({uid:i.uid,def:i.def})),declared:true})
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
   await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   rows.push({scene,label,width,height,time:actual.time,hash:stateHash(actual)})
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  const item=(uid:number)=>page.getByTestId('win-inv').locator(`[data-inventory-item="${uid}"]`)
  async function hover(uid:number){await page.mouse.move(0,0);await item(uid).hover();await page.getByTestId('tooltip').waitFor();const text=await page.getByTestId('tooltip').innerText();assert.doesNotMatch(text,/[가-힣]|undefined|NaN|Infinity/);return text}
  async function act(action:Action,input:()=>Promise<unknown>,label:string){assert.equal(playerAct(w,action),null,label);await input();await compare(label)}
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click()
  await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor()
  await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await page.keyboard.press('Escape')
  if(meal&&pill&&known&&book){
   assert.match(await hover(meal.uid),/Food remaining 1\//);await compare('last-serving-en')
   const water=await hover(bottle.uid);assert.match(water,/Stream water — Cloudy/);assert.match(water,/Salinity 0.75g\/L/);assert.doesNotMatch(water,/pathogens|0\.01/);await compare('water-en')
   const guessed=await hover(pill.uid);assert.match(guessed,/Suspected effect: Reduces pain by 50/);assert.doesNotMatch(guessed,/vomiting|potency 37/);await compare('suspected-pill-en')
   assert.match(await hover(known.uid),/Antibiotic/);await compare('known-pill-en')
   assert.match(await hover(book.uid),/Reading/);await compare('book-progress-en')
   const vessel=db.item(meal.def).food!.emptyVessel!;await act({type:'consume',uid:meal.uid},()=>item(meal.uid).dblclick(),'meal-consumed');assert.equal(p.bag.find(i=>i.uid===meal.uid)?.def,vessel)
   await act({type:'consume',uid:bottle.uid},()=>item(bottle.uid).dblclick(),'water-drunk');assert.equal(p.bag.find(i=>i.uid===bottle.uid)?.uses,4)
   await act({type:'read',uid:book.uid},()=>item(book.uid).dblclick(),'book-finished');assert.equal(p.bag.find(i=>i.uid===book.uid)?.readPages,db.item(book.def).book!.pages)
  }else if(gun&&crossbow&&bedding){
   const text=await hover(gun.uid);assert.match(text,/Barrel fouling 72\/100/);assert.match(text,/currently jammed/);assert.match(text,/Loaded powder Wet/);await compare('jammed-gun-en')
   assert.match(await hover(crossbow.uid),/String strung · moisture 65/);await compare('crossbow-en')
   assert.match(await hover(bedding.uid),/Bedding wetness 40% · scorch 7%/);await compare('bedding-en')
   const saline=await hover(bottle.uid);assert.match(saline,/Seawater — pathogens High \/ ash Very high/);assert.match(saline,/unsuitable for drinking/);await compare('seawater-en')
   await item(gun.uid).click({button:'right'});await act({type:'firearmCare',uid:gun.uid,operation:'unjam'},()=>page.getByTestId('item-menu').getByRole('button',{name:/^Clear jam/}).click(),'gun-unjammed');assert.equal(p.bag.find(i=>i.uid===gun.uid)?.firearmJammed,undefined)
   await page.mouse.move(0,0);await item(gun.uid).click({button:'right'});await act({type:'reload',uid:gun.uid},()=>page.getByTestId('item-menu').getByRole('button',{name:/^Reload/}).click(),'gun-reloaded');assert.equal(p.bag.find(i=>i.uid===gun.uid)?.loadedCartridges?.length,3)
  }
  await page.keyboard.press('Escape');await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare('saved-en')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare('continued-en')
  await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor();await hover(bottle.uid);await compare('continued-details-en')
  await context.close()
 }
 assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({declaredFixture:'Two fresh Study diagnostic scenes with finite original item UIDs, near-complete book and lit finite lantern, partially filled drink, wrong pill hypothesis, fouled/jammed loaded firearm and one spare round. Not natural acquisition. No post-Title world writes.',fixtures,rows,errors},null,2))
 console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
