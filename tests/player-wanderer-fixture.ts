import {prisonerFixture} from './prisoner-fixture'
import {tileAt} from '../src/core/ctx'
import {makeItem} from '../src/core/items'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {creatureSprite} from '../src/client/render/creature-sprite'
/** 표시 검사를 위한 유한한 초기 방. 실제 생성된 몸/장비/UID를 사용하고 NPC 행동만 정지한다. */
export function playerWandererFixture(){
 const d=prisonerFixture(),{w,s,p,target}=d
 s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='떠돌이 원본·동일한 주민과 발 위치';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
 p.bag=[];p.equip={main:makeItem(w,'Item.RustyKnife')};p.hotbar=Array(10).fill(null);p.needs.nutritionDay=Math.floor(s.time/(1200*100))
 target.pos={x:22,y:20};target.home=undefined;target.nextAct=1e12;target.ai.mode='hunt';target.ai.target=p.id;target.ai.alertTurn=Math.floor(s.time/100);target.reactPolicy='none'
 const people=[]
 for(const[def,x,y]of[['Creature.Settler',19,18],['Creature.RetiredWanderer',23,22]]as const){const c=createCreature(w,def,{x,y});c.met=true;c.nextAct=1e12;c.home=undefined;c.facing=4;s.creatures.push(c);people.push({id:c.id,def,storedSprite:c.sprite,displaySprite:creatureSprite(w,c)})}
 for(let y=16;y<=24;y++)for(let x=17;x<=25;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.KtFloor',roof:true,items:[]})
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 return{...d,people}
}
