import { watercraftFixture } from './watercraft-fixture'
import { addToBag, makeItem } from '../src/core/items'
import { updatePlayerVision } from '../src/core/fov'
export function aquaticFixture(heavy=false){const d=watercraftFixture();d.p.pos={x:12,y:21};d.p.equip={};d.p.bag=[];d.p.traits=[];d.p.effects=[];d.p.age=undefined;d.p.needs.bodyTemp=37;d.p.needs.energy=100;d.p.nextAct=d.s.time;const mail=heavy?makeItem(d.w,'Item.ScrapMail'):undefined;if(mail)d.p.equip.chest=mail;const add=(id:string,count=1)=>{const i=makeItem(d.w,id,count);if(addToBag(d.w,d.p,i))throw Error('bag');return i};updatePlayerVision(d.w,d.p);return{...d,mail,add,deep:{x:11,y:21},shore:{x:12,y:21}}}
