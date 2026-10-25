/** Prepared finite Native check. Run only after the parent freezes/builds v388.
 * Before Title: declared ordinary source stock and optional actual88HP drive wound.
 * After Title: real buttons/Period only; all page hooks are read-only observations.
 */
import{chromium,type Page}from'playwright-core'
import{mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import assert from'node:assert/strict'
import{prisonerFixture}from'../tests/prisoner-fixture'
import{createCreature}from'../src/core/creatures'
import{addWound,isMissing,partDamage,partEff}from'../src/core/body'
import{initialSowerState}from'../src/core/sower-state'
import{playerAct}from'../src/core/game'
import{invalidateLights,updatePlayerVision}from'../src/core/fov'
import{deserialize,serialize,stateHash}from'../src/core/save'
import type{MapRenderer}from'../src/client/render/MapRenderer'
import{startNativePreview}from'./native-preview'

type Kind='healthy'|'damaged'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Actor=View['actors'][number]
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
type Row={batch:number;at:number;actor:Actor}
const args=process.argv.slice(2),out=args.find(x=>!x.startsWith('--'))??'test-results/quality-v388/sower-native-r1'
const option=(name:string,fallback:string)=>args.find(x=>x.startsWith(name+'='))?.slice(name.length+1)??fallback
const maxWaits=Number(option('--max-waits','48')),sampleMs=Number(option('--sample-ms','800')),selected=option('--scene','all')
assert.ok(Number.isSafeInteger(maxWaits)&&maxWaits>0&&maxWaits<=80,'finite --max-waits=1..80')
assert.ok(Number.isFinite(sampleMs)&&sampleMs>=450&&sampleMs<=2000,'--sample-ms=450..2000')
assert.ok(['all','healthy','damaged'].includes(selected),'--scene=all|healthy|damaged')
mkdirSync(out,{recursive:true})

function fixture(kind:Kind){
 const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12
 Object.assign(s.map,{layout:undefined,kind:'dungeon',depth:1,ambient:1,lights:[],props:[],rooms:[],links:[],exits:[],swarms:[],name:'파종기 구동 손상 · '+kind})
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:true,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 p.pos={x:46,y:18};p.bag=[];p.equip={};p.activity=undefined;p.nextAct=s.time;p.needs.nutritionDay=Math.floor(s.time/(100*28800))
 const rule=w.db.creature('Creature.Sower').sower!,first=rule.route[0]
 // The actual first destination is diagonal from this declared initial square.
 // All remaining waypoints and finite capsule UIDs come from the actual Def.
 const machine=createCreature(w,'Creature.Sower',{x:first.x-1,y:first.y-1})
 machine.home={...machine.pos};machine.met=true;machine.facing=3;machine.nextAct=s.time+1;machine.sowerState=initialSowerState(rule);s.creatures=[p,machine]
 const body=w.db.body(machine.body.def),drive=body.parts.find(x=>x.id==='DriveLeg1')!
 assert.equal(machine.body.maxHp.DriveLeg1,88);assert.notEqual(drive.detach,true)
 let initialWound:unknown=null
 if(kind==='damaged'){
  const result=addWound(w,machine,{def:'Wound.Bruise',part:'DriveLeg1',severity:88,source:'유한 초기 각인 · 붙어 있는 구동부 파괴'})
  machine.hp=Math.max(1,machine.hp-result.damage)
  assert.equal(isMissing(w,machine,'DriveLeg1'),false);assert.equal(partEff(w,machine,'DriveLeg1'),0)
  initialWound={requestedDef:'Wound.Bruise',actualDef:result.wound.def,id:result.wound.id,part:result.wound.part,damage:result.damage,partDamage:partDamage(machine,'DriveLeg1'),present:true,partEff:partEff(w,machine,'DriveLeg1'),detach:false}
 }
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 const initial=serialize(s)
 return{kind,initial,machine:machine.id,expected:{db:w.db,s:deserialize(initial)},declaration:{initialWound,route:rule.route,initialDiagonal:{from:{...machine.pos},to:{...first}},stock:machine.bag.map(it=>({uid:it.uid,def:it.def,count:it.count})),actualBody:machine.body.def,sourcePixelsModified:false}}
}

let page:Page|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined
const errors:string[]=[],pairs:{kind:Kind;phase:string;hash:string}[]=[],runs:unknown[]=[]
async function settled(){
 await page!.waitForSelector('[data-testid=map][data-ready=true] canvas')
 await page!.waitForFunction(()=>{const h=window as unknown as Hook,w=h.__ashveil.world();return!w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&!h.render_game_presentation().moving})
}
async function compare(f:ReturnType<typeof fixture>,phase:string){
 await settled();f.expected.s.fx.length=0
 const actual=await page!.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
 writeFileSync(join(out,`${f.kind}-${phase}-actual.json`),JSON.stringify(actual))
 writeFileSync(join(out,`${f.kind}-${phase}-expected.json`),serialize(f.expected.s))
 assert.equal(stateHash(actual),stateHash(f.expected.s),f.kind+' '+phase)
 assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(f.expected.s)))
 pairs.push({kind:f.kind,phase,hash:stateHash(actual)})
}
async function load(f:ReturnType<typeof fixture>){
 await page!.setViewportSize(f.kind==='healthy'?{width:1440,height:1080}:{width:1366,height:768})
 writeFileSync(join(out,f.kind+'-initial.json'),f.initial)
 writeFileSync(join(out,f.kind+'-declaration.json'),JSON.stringify(f.declaration,null,2)+'\n')
 await page!.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial)
 await page!.reload();await page!.getByTestId('continue').click();await settled()
 await page!.getByRole('button',{name:'간략',exact:true}).click()
 await compare(f,'initial')
}
let sampleSequence=0
async function sample(id:number,ms:number){
 const batch=++sampleSequence
 return page!.evaluate(async({id,ms,batch})=>{const rows:Row[]=[],start=performance.now();while(performance.now()-start<ms){await new Promise(resolve=>requestAnimationFrame(resolve));const actor=(window as unknown as Hook).render_game_presentation().actors.find(a=>a.actor===id);if(actor)rows.push({batch,at:performance.now(),actor})}return rows},{id,ms,batch})
}
function inspect(kind:Kind,rows:readonly Row[]){
 const faces=new Set<string>(),workFaces=new Set<string>(),movingFaces=new Set<string>()
 let samples=0,damagedVisible=0,healthyLFContact=0,diagonalPairs=0,stoppedPairs=0,maxRootError=0,maxReachError=0,maxStanceDrift=0,noSupportHullFrames=0
 for(const[rowIndex,{actor}]of rows.entries()){
  const rig=actor.rig;if(!rig)continue;samples++;faces.add(rig.direction)
  if(actor.moving)movingFaces.add(rig.direction)
  if(actor.mode==='work')workFaces.add(rig.direction)
  const LF=rig.pose.legs.find(l=>l.id==='LF')!,display=rig.display.legs.LF
  if(kind==='damaged'){
   assert.equal(LF.present,true);assert.equal(LF.disabled,true);assert.equal(LF.contact,false)
   assert.equal(display.visible,true);assert.equal(display.disabled,true);assert.equal(display.contact,false)
   assert.notEqual(rig.pose.swing,'LF');damagedVisible++
  }else{assert.equal(LF.present,true);assert.equal(LF.disabled,false);if(LF.contact)healthyLFContact++}
  const rootError=Math.hypot(rig.pose.root.x-actor.feet.x*16,rig.pose.root.y*Math.SQRT1_2-actor.feet.y*16)
  maxRootError=Math.max(maxRootError,rootError);assert.ok(rootError<1e-7,'rig input must remain the actual interpolated actor anchor')
  maxReachError=Math.max(maxReachError,...rig.pose.legs.map(l=>l.error));assert.ok(rig.pose.legs.every(l=>Number.isFinite(l.error)))
  if(!rig.pose.supportHullAvailable)noSupportHullFrames++
  const old=rows[rowIndex-1]?.actor,oldRig=old?.rig
  if(rows[rowIndex-1]?.batch!==rows[rowIndex]!.batch||!oldRig||oldRig.direction!==rig.direction||oldRig.transition||rig.transition||rig.pose.distance<oldRig.pose.distance)continue
  const delta={x:actor.feet.x-old!.feet.x,y:actor.feet.y-old!.feet.y}
  if(Math.abs(delta.x)>1e-7&&Math.abs(delta.y)>1e-7)diagonalPairs++
  if(!actor.moving&&!old!.moving&&Math.hypot(delta.x,delta.y)<1e-8)stoppedPairs++
  for(const l of rig.pose.legs){const previous=oldRig.pose.legs.find(p=>p.id===l.id)!;if(l.contact&&previous.contact)maxStanceDrift=Math.max(maxStanceDrift,Math.hypot(l.sole.x-previous.sole.x,l.sole.y-previous.sole.y,l.sole.z-previous.sole.z))}
 }
 assert.ok(maxStanceDrift<1e-7,'continuous sampled contacts must stay planted')
 assert.ok(samples>0,'the actual Sower standing/work rig must be observed')
 if(kind==='damaged')assert.ok(damagedVisible>0);else assert.ok(healthyLFContact>0)
 return{samples,faces:[...faces],movingFaces:[...movingFaces],workFaces:[...workFaces],unobservedDirections:['down','left','right','up'].filter(f=>!faces.has(f)),damagedVisible,healthyLFContact,diagonalPairs,stoppedPairs,maxRootError,maxReachError,maxStanceDrift,noSupportHullFrames,physical3DVerified:false}
}

const server=await startNativePreview(4394)
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(server.url)
 for(const kind of['healthy','damaged']as const){
  if(selected!=='all'&&selected!==kind)continue
  const f=fixture(kind);await load(f);const rows:Row[]=[],faces=new Set<string>();let waits=0
  await page.screenshot({path:join(out,kind+'-initial-standing.png')})
  for(;waits<maxWaits;waits++){
   const sampling=sample(f.machine,sampleMs)
   await page.keyboard.press('Period');assert.equal(playerAct(f.expected,{type:'wait'}),null)
   if(waits===0){await page.waitForTimeout(140);await page.screenshot({path:join(out,kind+'-first-real-step.png')})}
   await settled();const batch=await sampling;rows.push(...batch)
   const newFace=batch.find(r=>r.actor.rig&&!faces.has(r.actor.rig.direction))?.actor.rig?.direction
   for(const r of batch)if(r.actor.rig)faces.add(r.actor.rig.direction)
   if(newFace)await page.screenshot({path:join(out,kind+'-observed-'+newFace+'.png')})
   if(waits===0)await compare(f,'first-real-wait')
   // Bound the tool. Missing directions are reported, never invented from the source sheet.
   if(waits>=8&&faces.size===4)break
  }
  await compare(f,'route-end');rows.push(...await sample(f.machine,300))
  const coverage=inspect(kind,rows);writeFileSync(join(out,kind+'-presentation.json'),JSON.stringify(rows))
  await page.screenshot({path:join(out,kind+'-stopped.png')})
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(f,'save-continue')
  const restored=await sample(f.machine,250);inspect(kind,restored);writeFileSync(join(out,kind+'-restored-presentation.json'),JSON.stringify(restored))
  runs.push({kind,realWaits:Math.min(waits+1,maxWaits),coverage,finiteInitial:f.declaration,restoredSamples:restored.length})
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor()
 }
 assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostTitleWorldWrites:true,originalPixelsModified:false,independentWholeJSONAndHash:true,maxWaits,sampleMs,runs,pairs,errors,scope:'Two finite actual-content scenes; first original-route destination begins one diagonal step from declared spawn. Actual Period/Title inputs only, attached DriveLeg1 wound from addWound, conditional observations of directions/work/diagonal/stop, exact Node whole comparisons and save/continue. Not every route/damage combination, natural campaign, GPU memory, Full/World or release approval.'},null,2)+'\n')
 console.log(JSON.stringify({runs:runs.length,pairs:pairs.length,errors}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),runs,pairs,errors},null,2)+'\n');try{await page?.screenshot({path:join(out,'failure.png')})}catch{/* load may fail before canvas */}throw error}
finally{await page?.close();await browser?.close();server.stop()}
