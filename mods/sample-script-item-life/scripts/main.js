function remember(ctx,event,kind){
 ctx.modState.calls=(ctx.modState.calls??0)+1
 ctx.modState.last={...event,kind,api:ctx.apiVersion}
 return [ctx.cmd.log('info','원래 물품의 실제 '+kind+' 완료를 기록했다.')]
}
export default defineMod({workers:{ItemNotebook:{
 kind:'ItemCompWorker',
 onEquip(ctx,event){return remember(ctx,event,'착용')},
 onUnequip(ctx,event){return remember(ctx,event,'탈의')},
 onCrafted(ctx,event){return remember(ctx,event,'제작')}
}}})
