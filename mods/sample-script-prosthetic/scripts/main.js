export default defineMod({workers:{ActualLimb:{
 kind:'ItemCompWorker',
 onProstheticInstalled(ctx,event){
  ctx.modState.events=[...(ctx.modState.events??[]),{kind:'onProstheticInstalled',...event}].slice(-32)
  return[ctx.cmd.log('info','원래 의수족의 실제 설치 완료를 기록했다.')]
 },
 onProstheticRemoved(ctx,event){
  ctx.modState.events=[...(ctx.modState.events??[]),{kind:'onProstheticRemoved',...event}].slice(-32)
  return[ctx.cmd.log('info','원래 의수족의 실제 분리 완료를 기록했다.')]
 },
 onProstheticServiced(ctx,event){
  ctx.modState.events=[...(ctx.modState.events??[]),{kind:'onProstheticServiced',...event}].slice(-32)
  return[ctx.cmd.log('info','원래 의수족의 실제 정비 완료를 기록했다.')]
 },
 onProstheticCharged(ctx,event){
  ctx.modState.events=[...(ctx.modState.events??[]),{kind:'onProstheticCharged',...event}].slice(-32)
  return[ctx.cmd.log('info','원래 의수족의 실제 전원셀 교체 완료를 기록했다.')]
 },
 onProstheticBroken(ctx,event){
  ctx.modState.events=[...(ctx.modState.events??[]),{kind:'onProstheticBroken',...event}].slice(-32)
  return[ctx.cmd.log('info','원래 의수족의 실제 파손 완료를 기록했다.')]
 },
 onMaterialConsumed(ctx,event){
  ctx.modState.events=[...(ctx.modState.events??[]),{kind:'onMaterialConsumed',...event}].slice(-32)
  return[ctx.cmd.log('info','원래 의수족의 실제 정비 재료 소비 완료를 기록했다.')]
 }
}}})
