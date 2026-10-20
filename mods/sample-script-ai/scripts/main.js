export default defineMod({workers:{GuardPriority:{
 kind:'AIConsiderationWorker',
 score(ctx,event){
  ctx.modState.calls=(ctx.modState.calls??0)+1
  ctx.modState.lastActor=event.actorId
  ctx.modState.candidates=event.options.map(o=>o.targetId)
  return event.options.map(option=>({targetId:option.targetId,bonus:ctx.view.creatures.find(c=>c.id===option.targetId).faction==='coalition'?30:0}))
 }
}}})
