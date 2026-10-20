export default defineMod({workers:{ActualUse:{
 kind:'ItemCompWorker',
 onApplied(ctx,event){
  ctx.modState.applied=(ctx.modState.applied??0)+1
  ctx.modState.lastApplied=event
  return[ctx.cmd.log('info','원래 치료 물품의 실제 적용을 기록했다.')]
 },
 onMaterialConsumed(ctx,event){
  ctx.modState.materials=(ctx.modState.materials??0)+1
  ctx.modState.lastMaterial=event
  return[ctx.cmd.log('info','원래 제작 재료의 실제 소비를 기록했다.')]
 }
}}})
