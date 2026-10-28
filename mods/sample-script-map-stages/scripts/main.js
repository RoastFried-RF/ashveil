export default defineMod({workers:{NearEntryMud:{
 kind:'MapGenStepWorker',
 execute(ctx,event){
  const m=event.map,protectedCells=new Set(m.protectedCells)
  for(const [dx,dy]of [[1,0],[-1,0],[0,-1],[1,-1],[-1,-1],[0,1]]){
   const x=m.start.x+dx,y=m.start.y+dy
   if(x<1||y<1||x>=m.w-1||y>=m.h-1||protectedCells.has(y*m.w+x))continue
   const terrain=m.palette[parseInt(m.terrainRows[y].slice(x*2,x*2+2),36)]
   if(!['Terrain.Earth','Terrain.Path','Terrain.Grass','Terrain.StoneFloor','Terrain.KtFloor','Terrain.CdFloor'].includes(terrain))continue
   ctx.modState.calls=(ctx.modState.calls??0)+1
   ctx.modState.changed={x,y,from:terrain,to:'Terrain.Mud',map:m.id,layout:event.layoutId,region:event.regionId};ctx.modState.maps=[...(ctx.modState.maps??[]),m.id]
   return[{type:'setTerrain',x,y,terrain:'Terrain.Mud'}]
  }
  return []
 }
}}})
