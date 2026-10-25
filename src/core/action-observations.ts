// Optional, bounded domain observations. Never stored in GameState or saves.
import type {World} from './ctx'
import type {Action} from './actions'
import type {Creature,ItemInst,Activity} from './types'
import type {Pos} from './geom'

export interface ActionObservation {id:number;at:number;action:Action;item?:ItemInst;target?:Pos;activity?:Activity['kind']}
interface Channel {events:ActionObservation[];running:Set<number>;primary:number}
export interface ObservationToken {channel:Channel;event:ActionObservation;actor:Creature}
const channels=new WeakMap<World,Channel>()
/** An observer opts in; headless simulation does not allocate action records. */
export function startActionObservation(w:World){
 const channel:Channel={events:[],running:new Set(),primary:w.s.playerId};channels.set(w,channel)
 return()=>{if(channels.get(w)===channel)channels.delete(w)}
}
export function beginActionObservation(w:World,c:Creature,action:Action):ObservationToken|undefined{
 const channel=channels.get(w);if(!channel||channel.running.has(c.id))return
 channel.running.add(c.id)
 const uid='uid'in action?action.uid:'toolUid'in action?action.toolUid:undefined,item=typeof uid==='number'?[...c.bag,...Object.values(c.equip)].find(item=>item?.uid===uid):undefined
 const target='target'in action?(typeof action.target==='number'?w.s.creatures.find(actor=>actor.id===action.target)?.pos??(action.type==='captureSwarm'?w.s.map.swarms?.find(s=>s.uid===action.target)?.pos:undefined):action.target):undefined
 return{channel,actor:c,event:{id:c.id,at:w.s.time,action:{...action},item:item?{...item}:undefined,target:target?{...target}:undefined}}
}
function append(channel:Channel,event:ActionObservation){
 channel.events.push(event)
 if(channel.events.length>64){const index=channel.events.findIndex(e=>e.id!==channel.primary);channel.events.splice(index<0?0:index,1)}
}
export function finishActionObservation(token:ObservationToken|undefined,success:boolean){
 if(!token)return
 token.channel.running.delete(token.event.id)
 if(!success)return
 token.event.activity=token.actor.activity?.kind
 append(token.channel,token.event)
}
export function takeActionObservations(w:World){return channels.get(w)?.events.splice(0)??[]}
