export default defineMod({workers:{FoodNotebook:{
 kind:'ItemCompWorker',
 onConsume(ctx,event){
  ctx.modState.calls=(ctx.modState.calls??0)+1
  ctx.modState.last=event
  return[ctx.cmd.log('info','음식 수첩에 원래 육포를 먹은 기록을 남겼다.')]
 }
}}})
