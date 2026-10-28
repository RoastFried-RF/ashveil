export default defineMod({
 hooks:{onDayStart(ctx){if(ctx.modState.queued)return [];ctx.modState.queued=true;const p=ctx.view.creatures.find(c=>c.id===ctx.view.playerId);return[ctx.cmd.queueEvent('Event.ReaverPatrol',3,p.pos)]}},
 workers:{CampPatrol:{
  kind:'PlaceEventWorker',
  canFire(ctx,event){ctx.modState.attempts=(ctx.modState.attempts??0)+1;return event.members>=2&&ctx.view.creatures.some(c=>c.id===ctx.view.playerId&&c.alive)},
  execute(ctx,event){ctx.modState.departures=(ctx.modState.departures??0)+1;ctx.modState.party=event.actorIds;return[ctx.cmd.log('info','장소 워커가 실제 야영지 순찰대의 출발을 장부에 기록했다.')]}
 }}
})
