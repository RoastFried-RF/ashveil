const eventId='Sample.Event.CampCircuit'
export default defineMod({
 hooks:{
  onDayStart(ctx,event){
   if(ctx.modState.queuedDay===event.day||!ctx.view.queueableEvents.includes(eventId))return []
   const p=ctx.view.creatures.find(c=>c.id===ctx.view.playerId)
   ctx.modState.queuedDay=event.day
   return[ctx.cmd.queueEvent(eventId,1,p.pos)]
  },
  onEventResolved(ctx,event){
   if(event.event!==eventId)return []
   ctx.modState.resolutions=(ctx.modState.resolutions??0)+1
   ctx.modState.returned=event.returned
   return[ctx.cmd.log('info','원래 순찰대의 실제 귀환과 결과를 기록했다.')]
  }
 },
 workers:{CampCircuit:{
  kind:'PlaceEventWorker',
  canFire(ctx,event){return event.members>=2},
  execute(ctx,event){
   ctx.modState.dispatches=(ctx.modState.dispatches??0)+1
   ctx.modState.party=event.actorIds
   ctx.modState.departedAt=ctx.view.turn
   return[ctx.cmd.log('info','원래 야영지 두 사람의 실제 출발을 기록했다.')]
  }
 }}
})
