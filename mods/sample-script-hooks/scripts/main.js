export default defineMod({
 hooks:{
  modifyHitChance(ctx){ctx.modState.hitCalculations=(ctx.modState.hitCalculations??0)+1;return 2},
  onDayStart(ctx,event){ctx.modState.days=(ctx.modState.days??0)+1;return[ctx.cmd.log('info','새로운 날을 스크립트 수첩에 기록했다. '+(event.dayIndex+1)+'일차.')]}
 }
})
