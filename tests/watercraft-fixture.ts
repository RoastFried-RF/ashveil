import { syncRegionalWeather } from '../src/core/environment'
import { updatePlayerVision } from '../src/core/fov'
import { saltrimFixture } from './saltrim-fixture'
export function watercraftFixture(){
 const d=saltrimFixture();d.p.pos={x:14,y:21};d.p.needs.bodyTemp=37;d.s.weather='clear';d.s.weatherUntil=1e12;d.s.wind={x:0,y:0};syncRegionalWeather(d.w,true)
 const hull=d.add('Item.CoracleKit');updatePlayerVision(d.w,d.p)
 const sea=[{x:d.site.cell.x-1,y:d.site.cell.y},{x:d.site.cell.x+1,y:d.site.cell.y},{x:d.site.cell.x,y:d.site.cell.y-1},{x:d.site.cell.x,y:d.site.cell.y+1}].find(p=>p.x>=0&&p.y>=0&&p.x<d.m.w&&p.y<d.m.h&&d.m.cells[p.y*d.m.w+p.x].sea)!
 return{...d,hull,sea}
}
