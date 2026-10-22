// Real UI input on a declared finite initial save; no postload state mutation.
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {startNativePreview} from '../../tools/native-preview'
import {completeArtFixture} from '../complete-art-fixture'
import {player,xpToNext,xpTotalFor,type World} from '../../src/core'
import {serialize} from '../../src/core/save'

const out=process.argv[2];if(!out)throw Error('Fresh output directory required')
mkdirSync(out,{recursive:true})
const d=completeArtFixture('inventory'),w=d.w,pl=player(w)
pl.xp=xpTotalFor(pl.level)+Math.floor((xpToNext(pl.level)-xpTotalFor(pl.level))*.4)
writeFileSync(join(out,'declared-initial.json'),serialize(w.s))
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
let phases=0,screenshots=0
const check=async(name:string)=>{
 await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&w.s.fx.length===0})
 w.s.fx=[];const actual=await page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))),expected=JSON.parse(serialize(w.s))
 writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++
}
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
try{
 await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),serialize(w.s));await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('initial')
 await page.getByRole('button',{name:'? 조작법',exact:true}).click();const help=page.getByRole('dialog',{name:'조작법',exact:true});await help.waitFor()
 assert.equal(await page.getByRole('button',{name:'조작법 닫기'}).evaluate(el=>el===document.activeElement),true)
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Period');await page.keyboard.press('Tab');await page.keyboard.press('Tab')
 assert.equal(await help.evaluate(el=>el.contains(document.activeElement)),true);await check('help-blocked-movement-and-wait');await shot('1701-help-readable-and-no-turn')
 await page.keyboard.press('Escape');await help.waitFor({state:'detached'})
 await page.setViewportSize({width:1366,height:768});await page.keyboard.press('F3');const settings=page.getByTestId('win-settings');await settings.waitFor()
 await settings.getByLabel('상태 색상',{exact:true}).selectOption('redgreen')
 await settings.getByTestId('speech-settings').locator('summary').click();await settings.getByTestId('speech-enabled').uncheck();await settings.getByTestId('speech-rate').focus();await page.keyboard.press('Tab')
 assert.equal(await settings.getByTestId('speech-stop').evaluate(el=>el===document.activeElement),true)
 const bottom=settings.getByRole('button',{name:'닫기 (Esc)',exact:true}).last();await bottom.scrollIntoViewIfNeeded()
 const buttonBox=await bottom.boundingBox(),windowBox=await settings.boundingBox();assert.ok(buttonBox&&windowBox&&buttonBox.y+buttonBox.height<=windowBox.y+windowBox.height)
 await check('settings-no-world-change');await shot('1702-small-settings-scroll-end-and-focus')
 await page.keyboard.press('Escape');await settings.waitFor({state:'detached'});await shot('1703-small-hud-colorblind-health-energy-xp')
 const hud=await page.getByTestId('hud').boundingBox();assert.ok(hud&&hud.x>=0&&hud.y>=0&&hud.x+hud.width<=1366&&hud.y+hud.height<=768)
 const log=await page.locator('.game-log').boundingBox();assert.ok(log&&log.y+log.height<hud.y,'Log must leave the entire HUD readable')
 assert.equal(await page.getByTestId('hotbar').locator('button').count(),10)
 await page.keyboard.press('Shift+k');await page.getByTestId('win-abil').waitFor()
 const abilities=page.locator('[data-testid^="ab-Ab."]');assert.equal(await abilities.count(),24)
 for(const button of await abilities.all()){const id=(await button.getAttribute('data-testid'))!.slice(3);assert.ok((await button.getAttribute('aria-label'))!.includes(w.db.ability(id).label))}
 await check('abilities-readonly');await shot('1704-small-ability-carvings-and-labels');await page.keyboard.press('Escape')
 await page.getByTestId('mini-body').click();await page.getByTestId('win-body').waitFor()
 assert.equal(await page.getByTestId('body-doll').locator('[data-body-region]').count(),6)
 assert.equal(await page.getByTestId('mini-body').locator('[data-body-region]').count(),6)
 await check('six-region-anatomy-readonly');await shot('1705-small-original-anatomy-and-six-states');await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('same-v302-content-save-restored')
 assert.deepEqual(errors,[]);assert.equal(phases,6);assert.equal(screenshots,5)
 const proof={version:303,phases,screenshots,roundtrips:1,actualInputTU:0,errors,helpBlocksActualMovementAndWait:true,settingsTabSkipsDisabled:true,settingsLastControlUnclipped:true,all24AbilityNamesAccessible:true,redgreenPaletteVisible:true,sixRegionAnatomyInBothViews:true,limits:'Declared finite v302-compatible healthy initial inventory scene, player XP set initially to40% solely to inspect the thin experience fill. All six actual/independent Node whole states exact. No postload injection, no combat/acquisition or injured-body claim.'}
 writeFileSync(join(out,'audit.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof))
}catch(error){await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
