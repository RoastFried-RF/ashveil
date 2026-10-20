export default defineMod({
 hooks:{
  onDayStart(ctx){
   if(ctx.modState.used)return []
   const self=ctx.view.creatures.find(c=>c.id===ctx.view.playerId)
   ctx.modState.used=true
   return[ctx.cmd.applyWound(self.id,'Wound.Cut','LeftForearm',1),ctx.cmd.spawnItem('Item.Bandage',1,self.pos),ctx.cmd.queueEvent('Event.ReaverPatrol',3,self.pos),ctx.cmd.log('info','선택한 명령 예제가 작은 상처와 바닥 붕대 한 개를 만들고 기존 순찰을 예약했다.')]
  },
  onWoundInflicted(ctx,event){ctx.modState.wound=event.woundId;return []},
  onEventFired(ctx,event){ctx.modState.party=event.actorIds;return[ctx.cmd.log('info','예약한 사건의 원래 인원이 순찰 경로로 출발했다.')]}
 }
})
