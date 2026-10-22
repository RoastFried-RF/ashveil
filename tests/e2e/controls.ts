// Complete UI input regression: declared finite saves, real keys/pointers, independent Core.
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {startNativePreview} from '../../tools/native-preview'
import {controlsFixture} from '../controls-fixture'
import {player,playerAct,serialize,foodMergeQuote,fitsAt,itemDef,findPath,DIRS,autoSnap,autoStop,type World,type Action} from '../../src/core'
const out=process.argv[2];if(!out||existsSync(out))throw Error('Fresh output directory required')
mkdirSync(out,{recursive:true});const width=Number(process.argv[3]??1440),height=width===1366?768:1080
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width,height}}),errors:string[]=[],rows:unknown[]=[],checks:string[]=[],images:string[]=[],actions:unknown[]=[]
type Hook={__ashveil:{world():World}}
let d=controlsFixture(),w=d.w,roundtrips=0
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:60000})
async function check(name:string){
 await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s))
 writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected))
 if(!isDeepStrictEqual(actual,expected))throw Error('Whole-state mismatch: '+name+' (saved actual/expected JSON)')
 checks.push(name);console.log('PASS',name)
}
async function input(name:string,a:Action,fn:()=>Promise<unknown>){const at=w.s.time;assert.equal(playerAct(w,a),null,name);await fn();await check(name);actions.push({name,a,tu:w.s.time-at})}
async function shot(name:string){await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});images.push(name+'.png')}
async function initial(kind:Parameters<typeof controlsFixture>[0]='quiet'){
 d=controlsFixture(kind);w=d.w;const raw=serialize(w.s);writeFileSync(join(out,kind+'-declared-initial.json'),raw);rows.push(d.proof)
 await page.goto(server.url);await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.removeItem('ashveil.preferences.v1')},raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(kind+'-initial-'+checks.length)
}
async function settings(){await page.keyboard.press('F3');await page.getByTestId('win-settings').waitFor()}
async function preset(side:'default'|'left'|'right'){
 await settings();const group=page.getByTestId('keybinding-settings');if(!await group.evaluate(el=>(el as HTMLDetailsElement).open))await group.locator('summary').click()
 await page.getByTestId('key-preset-'+side).click();await page.keyboard.press('Escape');await page.getByTestId('map').focus()
}
async function point(pos:{x:number;y:number}){
 await page.waitForTimeout(200);const h=await page.getByTestId('hud').evaluate(el=>el.parentElement!.getBoundingClientRect().height),s=16*Math.max(1,Math.floor(height/360)),p=player(w).pos,usable=height-Math.min(height*.45,h)-24,mw=w.s.map.w*s,mh=w.s.map.h*s
 let x=width/2-(p.x+.5)*s,y=height/2-(p.y+.5)*s-s
 x=mw<width?(width-mw)/2:Math.min(0,Math.max(width-mw,x));y=mh<usable?(usable-mh)/2:Math.min(0,Math.max(usable-mh,y))
 return{x:x+(pos.x+.5)*s,y:y+(pos.y+.5)*s}
}
async function clickTile(pos:{x:number;y:number},button:'left'|'right'='left',ctrl=false){const at=await point(pos);if(ctrl)await page.keyboard.down('Control');await page.mouse.click(at.x,at.y,{button});if(ctrl)await page.keyboard.up('Control')}
const item=(uid:number)=>page.locator('[data-inventory-item="'+uid+'"]')
async function dragTo(uid:number,gx:number,gy:number,options:{rotate?:boolean;ctrl?:boolean;shift?:boolean}={}){
 const source=await item(uid).boundingBox(),bag=await page.getByTestId('bag').boundingBox();assert.ok(source&&bag)
 if(options.ctrl)await page.keyboard.down('Control');if(options.shift)await page.keyboard.down('Shift')
 await page.mouse.move(source.x+8,source.y+8);await page.mouse.down();await page.mouse.move(source.x+18,source.y+18)
 if(options.rotate)await page.keyboard.press('r')
 await page.mouse.move(bag.x+2+gx*38+8,bag.y+2+gy*38+8,{steps:4});await page.mouse.up()
 if(options.ctrl)await page.keyboard.up('Control');if(options.shift)await page.keyboard.up('Shift')
}
function freeCell(uid:number,rot=false){const p=player(w),it=p.bag.find(i=>i.uid===uid)!;for(let y=0;y<6;y++)for(let x=0;x<10;x++)if((x!==it.gx||y!==it.gy)&&fitsAt(w,p,itemDef(w,it),x,y,uid,rot))return{x,y};throw Error('no finite test cell')}
async function repeatMode(mode:'system'|'limited'|'once'){
 await settings();const group=page.getByTestId('key-repeat-settings');if(!await group.evaluate(el=>(el as HTMLDetailsElement).open))await group.locator('summary').click();await page.getByTestId('key-repeat-mode').selectOption(mode)
 if(mode==='limited'){await page.getByTestId('key-repeat-delay').focus();await page.keyboard.press('End');await page.getByTestId('key-repeat-interval').focus();await page.keyboard.press('End')}
 await page.keyboard.press('Escape');await page.getByTestId('map').focus()
}
try{
 await initial()
 for(const[key,id]of [['c','char'],['i','inv'],['Shift+k','abil'],['Shift+b','body'],['Shift+j','journal'],['m','map'],['F2','craft'],['Shift+n','society']]as const){
  await page.keyboard.press(key);const win=page.getByTestId('win-'+id);await win.waitFor();assert.ok(await win.evaluate(el=>el.contains(document.activeElement)))
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Period');await page.keyboard.press('r');await page.keyboard.press('Space');await page.keyboard.press('Tab');assert.ok(await win.evaluate(el=>el.contains(document.activeElement)))
  await page.keyboard.press('Shift+Tab');await page.keyboard.press('Escape');await win.waitFor({state:'detached'});await check('window-'+id+'-focus-tab-escape-no-turn')
 }
 await page.keyboard.press('i');await page.getByTestId('win-inv').locator('.window-close').focus();await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.ok(!await page.getByTestId('win-inv').isVisible());await check('native-close-button-held-enter-is-one-click')
 await page.keyboard.down('i');await page.keyboard.down('i');await page.keyboard.down('i');await page.keyboard.up('i');assert.ok(await page.getByTestId('win-inv').isVisible());await page.keyboard.press('Escape');await check('held-inventory-toggles-only-once')
 await page.keyboard.down('F3');await page.keyboard.down('F3');await page.keyboard.up('F3');assert.ok(await page.getByTestId('win-settings').isVisible());await page.keyboard.press('Escape');await check('held-F3-toggles-only-once')
 await page.keyboard.press('c');await page.keyboard.press('i');await page.getByTestId('win-char').locator('.window-heading').click({position:{x:70,y:15}});await page.keyboard.press('Escape');assert.ok(!await page.getByTestId('win-char').isVisible());assert.ok(await page.getByTestId('win-inv').isVisible());await shot('1801-top-window-escape-preserves-inventory');await page.keyboard.press('Escape');await check('raised-window-is-escape-top')
 await page.keyboard.press('F2');await page.getByTestId('win-craft').getByLabel('제작 분야').focus();await page.keyboard.press('Escape');assert.ok(!await page.getByTestId('win-craft').isVisible());await check('escape-from-native-select')
 await page.keyboard.press('i');const pain=player(w).bag.find(i=>i.def==='Item.Painkiller')!
 await item(pain.uid).focus();await page.keyboard.press('Enter');await page.getByTestId('item-menu').waitFor();await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.keyboard.press('n');await page.keyboard.press('Tab');assert.ok(await page.getByTestId('item-menu').evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Escape');assert.ok(await page.getByTestId('win-inv').isVisible());assert.ok(await item(pain.uid).evaluate(el=>el===document.activeElement));await check('keyboard-context-menu-focus-and-escape')
 await item(pain.uid).click({button:'right'});await page.keyboard.press('Escape');assert.ok(await page.getByTestId('win-inv').isVisible());await check('right-click-context-menu-escape-first')
 await item(pain.uid).click({button:'right'});await page.getByTestId('btn-crouch').click();assert.equal(await page.getByTestId('item-menu').count(),0);await check('outside-menu-click-does-not-activate-hud')
 await input('next-deliberate-hud-click-crouches',{type:'crouch'},()=>page.getByTestId('btn-crouch').click());await page.keyboard.press('Escape');await page.getByTestId('map').focus();await input('normal-turn-before-next-free-posture-action',{type:'wait'},()=>page.keyboard.press('.'));await page.keyboard.press('i');await input('next-deliberate-hud-click-stands',{type:'crouch'},()=>page.getByTestId('btn-crouch').click())
 const shirt=player(w).bag.find(i=>i.def==='Item.RagShirt')!,source=await item(shirt.uid).boundingBox();assert.ok(source);await page.mouse.move(source.x+8,source.y+8);await page.mouse.down();await page.mouse.move(source.x+80,source.y+40,{steps:3});await page.keyboard.press('Escape');await page.mouse.up();assert.ok(await page.getByTestId('win-inv').isVisible());await check('drag-escape-cancels-without-closing')
 const floor=await page.locator('[data-floor-uid="'+d.ids.floor+'"]').boundingBox(),occupied=await item(pain.uid).boundingBox();assert.ok(floor&&occupied);await page.mouse.move(floor.x+8,floor.y+8);await page.mouse.down();await page.mouse.move(occupied.x+8,occupied.y+8,{steps:5});await page.mouse.up();await check('invalid-floor-drop-does-not-pick-up')
 const knife=player(w).bag.find(i=>i.def==='Item.BoneKnife')!,cell=freeCell(knife.uid,!knife.rot);await input('actual-valid-rotated-knife-drop',{type:'moveItem',uid:knife.uid,gx:cell.x,gy:cell.y,rot:!knife.rot},()=>dragTo(knife.uid,cell.x,cell.y,{rotate:true}));await shot('1802-rotated-item-stays-in-inventory')
 const split=freeCell(d.ids.wood);await input('actual-ctrl-half-stack-drag',{type:'splitItem',uid:d.ids.wood,n:Math.floor(player(w).bag.find(i=>i.uid===d.ids.wood)!.count/2),gx:split.x,gy:split.y,rot:false},()=>dragTo(d.ids.wood,split.x,split.y,{ctrl:true}))
 const old=player(w).bag.find(i=>i.uid===d.ids.old)!
 await dragTo(d.ids.fresh,old.gx!,old.gy!);await page.getByTestId('food-merge-confirmation').waitFor();await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.ok(await page.getByTestId('food-merge-confirmation').evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Escape');assert.ok(await page.getByTestId('win-inv').isVisible());await check('food-consent-traps-tab-and-escape-cancels-only-consent')
 await dragTo(d.ids.fresh,old.gx!,old.gy!);await page.getByTestId('food-merge-confirmation').waitFor();await shot('1803-food-merge-keyboard-confirmation');const approval=foodMergeQuote(w,player(w),d.ids.fresh,d.ids.old).signature;await input('actual-confirmed-food-merge',{type:'mergeItem',uid:d.ids.fresh,into:d.ids.old,freshnessApproval:approval},()=>page.getByTestId('food-merge-accept').click())
 await item(pain.uid).click({button:'right'});await input('actual-context-menu-assign-hotbar',{type:'hotbar',index:0,ref:{kind:'item',def:pain.def}},()=>page.getByTestId('item-menu').getByRole('button',{name:'빠른 슬롯에',exact:true}).click());await page.keyboard.press('Escape');await page.getByTestId('map').focus()
 await input('held-consumable-key-uses-once',{type:'consume',uid:pain.uid},async()=>{await page.keyboard.down('1');await page.keyboard.down('1');await page.keyboard.down('1');await page.keyboard.up('1')})
 // Every direction in all three layouts, with opposing moves to keep the fixture bounded.
 const keys={default:['ArrowUp','u','ArrowRight','n','ArrowDown','b','ArrowLeft','y'],left:['w','e','d','c','x','z','a','q'],right:['o','p',';','/','.',',','k','i']}
 for(const side of ['default','left','right']as const){await preset(side);for(const dir of [0,4,1,5,2,6,3,7])await input(side+'-direction-'+dir,{type:'move',dir},()=>page.keyboard.press(keys[side][dir]));await shot('1804-'+side+'-eight-directions')}
 await preset('default');for(let i=0;i<4;i++)assert.equal(playerAct(w,{type:'move',dir:2}),null);await page.getByTestId('map').focus();for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');await check('four-rapid-taps-execute-four-moves');actions.push({name:'four-rapid-taps',moves:4,tu:400});await repeatMode('once');await input('once-mode-first-held-wait',{type:'wait'},async()=>{await page.keyboard.down('.');await page.keyboard.down('.');await page.keyboard.down('.');await page.keyboard.up('.')});await input('once-mode-release-repress',{type:'wait'},()=>page.keyboard.press('.'))
 await repeatMode('limited');await input('limited-first-press-and-rejected-repeats',{type:'wait'},async()=>{await page.keyboard.down('.');await page.keyboard.down('.');await page.keyboard.down('.')});await page.waitForTimeout(2100);await input('limited-delay-accepts-one-repeat',{type:'wait'},async()=>{await page.keyboard.down('.');await page.keyboard.down('.');await page.keyboard.up('.')})
 await repeatMode('system');await input('system-first-wait',{type:'wait'},()=>page.keyboard.down('.'));await input('system-held-wait',{type:'wait'},()=>page.keyboard.down('.'));await page.keyboard.up('.')
 await page.keyboard.press('p');await page.keyboard.press('i');await page.keyboard.press('Escape');await page.getByTestId('map').focus();await input('opening-window-clears-old-shove-prefix',{type:'move',dir:2},()=>page.keyboard.press('ArrowRight'))
 await input('held-ctrl-direction-faces-only-once',{type:'face',dir:2},async()=>{await page.keyboard.down('Control');await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');await page.keyboard.up('Control')});
 await input('ctrl-right-click-faces-with-one-turn',{type:'face',dir:4},()=>clickTile({x:player(w).pos.x,y:player(w).pos.y+2},'right',true))
 // Explicit clicked targets must not be replaced by a different nearby container/body.
 await initial('objects');await input('click-exact-east-container',{type:'search',includeEmpty:true,pos:d.containerPositions[1]},()=>clickTile(d.containerPositions[1]));assert.deepEqual(w.s.loot?.pos,d.containerPositions[1]);await page.keyboard.press('Escape')
 const body=w.s.creatures.find(c=>c.id===d.corpseIds[1])!;await input('click-exact-southeast-corpse',{type:'search',includeEmpty:true,target:body.id},()=>clickTile(body.pos));assert.equal(w.s.loot?.id,body.id);assert.ok(await page.getByTestId('win-inv').isVisible());const corpseItem=body.bag[0];assert.ok(await item(corpseItem.uid).isVisible());await shot('1805-exact-clicked-corpse');await input('take-original-item-from-clicked-corpse',{type:'lootTake',uid:corpseItem.uid},()=>item(corpseItem.uid).dblclick());await page.keyboard.press('Escape')
 await page.getByTestId('map').focus();await input('bump-exact-closed-door',{type:'move',dir:6},()=>page.keyboard.press('ArrowLeft'));await page.keyboard.press('o');await input('prefix-closes-selected-door',{type:'closeDoor',dir:6},()=>page.keyboard.press('ArrowLeft'))
 // Aim selection is free; confirmation, firing, throwing and maneuvers use the real action.
 await initial('combat');await page.keyboard.press('f');await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await page.keyboard.press('Escape');await check('shoot-cycle-and-cancel-no-turn');await page.keyboard.press('f');await page.keyboard.press('Tab');await shot('1806-actual-aim-and-target-cycle');await input('shoot-selected-second-target',{type:'shoot',target:d.enemyIds[1]},()=>page.keyboard.press('Enter'))
 await page.keyboard.press('1');await clickTile(player(w).pos,'right');await check('throw-right-click-cancels-no-turn');await page.keyboard.press('1');const stone=player(w).bag.find(i=>i.def==='Item.Stone')!;await input('throw-one-real-stone',{type:'throwAttack',uid:stone.uid,target:d.enemyIds[0]},()=>page.keyboard.press('Enter'))
 await page.getByTestId('btn-trip').click();await check('hud-trip-aim-is-free');await input('hud-trip-enter-confirms-on-map',{type:'trip',target:d.enemyIds[0]},()=>page.keyboard.press('Enter'));await page.keyboard.press('Shift+o');await input('keyboard-disarm-enter-confirms',{type:'disarm',target:d.enemyIds[0]},()=>page.keyboard.press('Enter'));await shot('1807-combat-input-confirmation')
 // Cancellation is timing-dependent; reconstruct every completed move independently.
 for(const stop of ['inventory','space','tab','blur']as const){
  await initial();const start={...player(w).pos},target={x:start.x+13,y:start.y},path=findPath(w,start,target,{avoidCreatures:true,selfId:player(w).id,preferStraight:true})!;assert.equal(path.length,13);const snap=autoSnap(w);const dest=await point(target);await page.mouse.click(dest.x,dest.y)
  await page.waitForFunction(at=>(window as unknown as Hook).__ashveil.world().s.time>at,w.s.time,{polling:25})
  if(stop==='inventory')await page.keyboard.press('i');else if(stop==='space')await page.keyboard.press('Space');else if(stop==='tab')await page.keyboard.press('Tab');else await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
  await idle();const stopped=await read(),pos=stopped.creatures.find((c:{id:number})=>c.id===stopped.playerId).pos,moves=path.findIndex(p=>p.x===pos.x&&p.y===pos.y)+1;assert.ok(moves>0&&moves<path.length,'must cancel before destination: '+stop+'/'+moves)
  for(const next of path.slice(0,moves)){const p=player(w).pos,dir=DIRS.findIndex(d=>d.x===next.x-p.x&&d.y===next.y-p.y);assert.equal(playerAct(w,{type:'move',dir}),null);assert.equal(autoStop(w,snap),null);w.s.fx=[]}
  await check('autowalk-'+stop+'-completed-'+moves);await page.waitForTimeout(450);await check('autowalk-'+stop+'-remains-stopped');actions.push({name:'cancel-autowalk-'+stop,moves,tu:moves*100,signal:stop==='blur'?'synthetic browser lifecycle blur notification; no core mutation':'trusted keyboard'})
  if(stop==='inventory')await shot('1808-window-pauses-automatic-walking')
 }
 await initial('danger');await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await check('critical-warning-and-held-repeats-do-not-move');await page.keyboard.up('ArrowRight');await input('critical-warning-requires-release-and-new-press',{type:'move',dir:2},()=>page.keyboard.press('ArrowRight'));await shot('1809-critical-warning-explicit-ack')
 // Same save, fresh screen: no old targeting/window state may leak into Continue.
 await page.keyboard.press('i');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('final-save204-whole-restored');assert.equal(await page.locator('.window-shell').count(),0);roundtrips++
 await page.keyboard.press('i');const win=page.getByTestId('win-inv'),head=await win.locator('.window-heading').boundingBox();assert.ok(head);await page.mouse.move(head.x+80,head.y+15);await page.mouse.down();await page.mouse.move(width-15,height-20,{steps:6});await page.mouse.up();await page.setViewportSize({width:800,height:600});await page.waitForTimeout(250);const rect=await win.boundingBox();assert.ok(rect&&rect.x>=8&&rect.y>=8&&rect.x+rect.width<=792);const close=await win.locator('.window-close').boundingBox();assert.ok(close&&close.x+close.width<=800&&close.y+close.height<=600);await shot('1810-resized-window-close-remains-reachable');await page.keyboard.press('Escape');await check('window-drag-resize-no-world-change')
 await page.keyboard.press('i');const narrow=page.getByTestId('win-inv'),heading=await narrow.locator('.window-heading').boundingBox();assert.ok(heading);await page.mouse.move(heading.x+60,heading.y+15);await page.mouse.down();await page.mouse.move(68,23,{steps:5});await page.mouse.up();await item(d.ids.bottle).click({button:'right'});const popup=await page.getByTestId('item-menu').boundingBox();assert.ok(popup&&popup.x>=8&&popup.y>=8&&popup.x+popup.width<=792&&popup.y+popup.height<=592);await shot('1811-context-menu-clamped-to-small-viewport');await page.keyboard.press('Escape');assert.ok(await narrow.isVisible());await page.keyboard.press('Escape');await check('small-menu-viewport-and-escape-no-turn')
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({version:304,width,height,wholePairs:checks.length,screenshots:images.length,roundtrips,checks,images,actions,rows,errors,limits:'Finite declared input scenes, independent Node whole states after real Title/keys/mouse. Autowalk move count is observed at cancellation and each completed move independently replayed, not fixed wall-clock timing. Blur notification intentionally dispatched as browser lifecycle signal. No postload world/time/RNG injection; healthy body/art scene is not injury or ordinary acquisition evidence.'},null,2));console.log(JSON.stringify({width,wholePairs:checks.length,screenshots:images.length,roundtrips,actions:actions.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read().catch(()=>null)));console.error('FAILED after',checks.at(-1));throw error}finally{await page.close();await browser.close();server.stop()}
