/** Natural initial bodies/items; finite declared outside-site position, no post-load relocation. */
import {newGame,playerAct} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {db} from './helpers'
const template=newGame(db,{seed:'release-region-tour-v396',background:'Bg.Hunter',overworld:true})
export function regionTourFixture(siteId:string){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find(site=>site.id===siteId);if(!site)throw Error('site not generated: '+siteId)
 p.pos={...s.map.exits[0]};const error=playerAct(w,{type:'leave'});if(error)throw Error(error)
 m.position={...site.cell};s.map.worldCell={...site.cell};s.fx=[]
 return{w,s,p,m,site}
}
export const regionTourSites=template.overworld!.sites.map(s=>s.id).sort()
