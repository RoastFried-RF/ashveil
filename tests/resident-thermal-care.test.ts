import{describe,it,expect}from'vitest'
import{pilgrimFieldsFixture}from'./pilgrim-fields-fixture'
import{ownedThermalClothingAction,residentCoolingDecision}from'../src/core/resident-thermal-care'
import{serialize,deserialize}from'../src/core/save'
import{allItems,itemDef}from'../src/core/items'
import{perform}from'../src/core/actions'
import{finishBase}from'./base-camp-fixture'
import{playerAct}from'../src/core/game'
import{tileAt,turnOf,type World}from'../src/core/ctx'
import{canSee,hasLos,invalidateLights}from'../src/core/fov'
import{loadMods,type PatchOp}from'../src/core/defs'
import{readPackages}from'../tools/loadContent'
import{projectThermalState}from'../src/core/thermal'
import{npcRestDef}from'../src/core/resident-rest'

function tiredCourtyard(bare=true){
 const d=pilgrimFieldsFixture();d.c.pos={x:30,y:25};d.c.needs.bodyTemp=38.2;d.c.needs.fatigue=85;d.s.wind={x:0,y:0}
 if(bare)for(const slot of Object.keys(d.c.equip)as (keyof typeof d.c.equip)[]){const it=d.c.equip[slot];if(it&&itemDef(d.w,it).apparel){d.c.bag.push(it);delete d.c.equip[slot]}}
 const forecast=projectThermalState(d.w,d.c,'sleep');expect(forecast.feels).toBeGreaterThanOrEqual(forecast.low);expect(forecast.feels).toBeLessThanOrEqual(forecast.high)
 return d
}

describe('original residents use owned clothes and visible cooler ground without instant temperature writes',()=>{
 it('chooses actual sleep on comfortable ordinary floor without changing the query world or original bed',()=>{
  const d=tiredCourtyard(),before=serialize(d.s);expect(residentCoolingDecision(d.w,d.c)).toEqual({action:{type:'sleep'}});expect(serialize(d.s)).toBe(before)
 })
 it('a real fever target does not prevent prepared sleep on thermally safe floor',()=>{
  const d=tiredCourtyard();d.c.effects.push({kind:'fever',magnitude:38.5,untilTurn:turnOf(d.w)+28800});const before=serialize(d.s)
  expect(residentCoolingDecision(d.w,d.c)).toEqual({action:{type:'sleep'}});expect(serialize(d.s)).toBe(before)
 })
 it('repays actual sleep debt through normal sleep, preserving the same bed and exact saved continuation',()=>{
  const d=tiredCourtyard();d.c.needs.fatigue=0;d.c.needs.sleepDebt=2;const beds=structuredClone(d.s.map.residentBeds);let slept=false
  for(let i=0;i<4;i++){expect(playerAct(d.w,{type:'rest',turns:200})).toBeNull();slept||=!!d.c.asleep}
  expect(slept).toBe(true);expect(d.c.needs.sleepDebt).toBeLessThan(2);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))}
  for(let i=0;i<28;i++){expect(playerAct(d.w,{type:'rest',turns:200})).toBeNull();expect(playerAct(copy,{type:'rest',turns:200})).toBeNull()}
  expect(serialize(copy.s)).toBe(serialize(d.s));expect(d.c.alive).toBe(true);expect(d.c.needs.sleepDebt).toBeLessThan(npcRestDef(d.w)!.debtAt);expect(d.c.needs.bodyTemp).toBeLessThan(39);expect(d.s.map.residentBeds).toEqual(beds)
 },60000)
 it('ordinary sleep reduces actual fatigue without replacing the body values or creating bedding',()=>{
  const d=tiredCourtyard(),beds=structuredClone(d.s.map.residentBeds);let slept=false
  for(let i=0;i<24;i++){expect(playerAct(d.w,{type:'rest',turns:200})).toBeNull();slept||=!!d.c.asleep}
  expect(slept).toBe(true);expect(d.c.needs.fatigue).toBeLessThan(npcRestDef(d.w)!.sleepAt);expect(d.c.alive).toBe(true);expect(d.s.map.residentBeds).toEqual(beds)
 },60000)
 for(const terrain of ['Terrain.DoorOpen','Terrain.ResidentDepot','Terrain.SettlementWell','Terrain.OatPlot'])it('does not sleep on the public passage/facility '+terrain,()=>{
  const d=tiredCourtyard();tileAt(d.w,d.c.pos).t=terrain;const before=serialize(d.s);expect(residentCoolingDecision(d.w,d.c)?.action?.type).not.toBe('sleep');expect(serialize(d.s)).toBe(before)
 })
 it('does not turn ordinary cooling into sleep without fatigue or sleep debt',()=>{
  const d=tiredCourtyard();d.c.needs.fatigue=0;d.c.needs.sleepDebt=0;expect(residentCoolingDecision(d.w,d.c)?.action?.type).not.toBe('sleep')
 })
 it('queries preserve the complete world and actually removing/swapping original clothes preserves all UIDs',()=>{
  const d=pilgrimFieldsFixture();d.c.needs.bodyTemp=38.2;const before=serialize(d.s),uids=allItems(d.c).map(i=>i.uid).sort(),next=d.s.nextId
  const action=ownedThermalClothingAction(d.w,d.c,d.c.pos,'rest');expect(action).toBeDefined();expect(['equip','unequip']).toContain(action!.type);expect(residentCoolingDecision(d.w,d.c)).not.toBeNull();expect(serialize(d.s)).toBe(before)
  const temperature=d.c.needs.bodyTemp;expect(perform(d.w,d.c,action!).ok).toBe(true);finishBase(d.w,d.c);expect(d.c.needs.bodyTemp).toBe(temperature);expect(allItems(d.c).map(i=>i.uid).sort()).toEqual(uids);expect(d.s.nextId).toBe(next)
 })
 it('ordinary actual time, clothes and walking prevent the observed warm-hearth runaway rather than replacing body values',()=>{
  const d=pilgrimFieldsFixture();let maximum=d.c.needs.bodyTemp,moved=false,changed=false;const original=d.c.equip.chest?.uid,pos={...d.c.pos}
  for(let i=0;i<32;i++){expect(playerAct(d.w,{type:'rest',turns:200})).toBeNull();maximum=Math.max(maximum,d.c.needs.bodyTemp);moved||=d.c.pos.x!==pos.x||d.c.pos.y!==pos.y;changed||=d.c.equip.chest?.uid!==original}
  expect(d.c.alive).toBe(true);expect(maximum).toBeLessThan(39);expect(moved||changed).toBe(true);expect(d.c.residentPlot).toBeDefined()
 },60000)
 it('an unseen heater around a corner cannot change a plan for currently visible ground',()=>{
  const d=pilgrimFieldsFixture(),w=d.w,c=d.c;c.pos={x:30,y:18};c.home={...c.pos};c.facing=5;c.traits=[];c.effects=[];c.needs.bodyTemp=38.2;w.s.creatures=[d.p,c];d.p.pos={x:24,y:18};w.s.wind={x:1,y:0}
  const clothes=allItems(c).filter(i=>itemDef(w,i).apparel);c.bag=c.bag.filter(i=>!clothes.includes(i));for(const key of Object.keys(c.equip)as (keyof typeof c.equip)[])if(c.equip[key]&&clothes.includes(c.equip[key]!))delete c.equip[key]
  for(const tile of w.s.map.tiles){tile.t='Terrain.KtWall';tile.roof=true;delete tile.cultivation;tile.items=[]}
  const floor=(x:number,y:number,roof=false)=>{const t=tileAt(w,{x,y});t.t='Terrain.Earth';t.roof=roof}
  for(let y=18;y<=23;y++)floor(30,y)
  for(let x=24;x<=30;x++)floor(x,18,x<30)
  for(let y=22;y<=23;y++)for(let x=30;x<=32;x++)floor(x,y)
  tileAt(w,c.pos).roof=true;tileAt(w,c.pos).items.push(...clothes);w.s.map.lights=[{pos:{...c.pos},kind:'campfire',radius:8}];invalidateLights(w)
  const before=residentCoolingDecision(w,c);expect(before?.goal).toBeDefined();const target=before!.goal!;expect(canSee(w,c,target)).toBe(true);expect(canSee(w,c,{x:25,y:18})).toBe(true);const felt=projectThermalState(w,c,'rest',target).feels
  const hidden={x:32,y:23};w.s.map.lights.push({pos:hidden,kind:'campfire',radius:8});invalidateLights(w);expect(canSee(w,c,hidden)).toBe(false);expect(hasLos(w,target,hidden)).toBe(true);expect(projectThermalState(w,c,'rest',target).feels).toBeGreaterThan(felt)
  const raw=serialize(w.s);expect(residentCoolingDecision(w,c)).toEqual(before);expect(serialize(w.s)).toBe(raw)
 })
 for(const mode of ['cold','sleep','activity','foreignFaction','player']as const)it('does not direct '+mode+' into cooling actions',()=>{
  const d=pilgrimFieldsFixture();d.c.needs.bodyTemp=38.2;if(mode==='cold')d.c.needs.bodyTemp=37;if(mode==='sleep')d.c.asleep=true;if(mode==='activity')d.c.activity={kind:'rest',remaining:100,label:'실제 진행 중 휴식'};if(mode==='foreignFaction')d.c.faction='coalition'
  const c=mode==='player'?d.p:d.c,raw=serialize(d.s);expect(residentCoolingDecision(d.w,c)).toBeNull();expect(serialize(d.s)).toBe(raw)
 })
 for(const[path,value]of [['at',36],['radius',0],['restTurns',0],['minimumImprovement',0],['roles',[]],['factions',['unknown']]]as const)it('rejects invalid cooling '+path,()=>{
  const id='cooling-test',patches:PatchOp[]=[{op:'replace',target:'ResidentWarmth.Hearth',path:'/cooling/'+path,value}],m=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches}],[id]);expect(m.report.errors.some(e=>e.includes('cooling'))).toBe(true)
 })
})
