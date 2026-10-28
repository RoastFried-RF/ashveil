/** Optional display-only straight-shaft fit. Call only for an explicitly enabled item
 * and two visually reviewed source palms. No arm IK, source edits, scale changes or Core rules. */
export type ShaftPoint = {x:number;y:number}
export interface TwoHandShaftInput {
 enabled:boolean
 main:ShaftPoint
 off:ShaftPoint|null|undefined
 intendedAngle:number
 /** Pixel coordinates within the weapon's registered crop, before rotation. */
 sourceGrip:ShaftPoint
 sourceShaft:readonly[ShaftPoint,ShaftPoint]
 /** The existing fixed item.length * bodyRatio / max(texture.width,texture.height). */
 scale:number
 maxCorrectionDegrees?:number
 /** Keep the support palm away from end fittings; display heuristic, not physics. */
 endInsetWorld?:number
}
export interface TwoHandShaftFit {
 angle:number
 applied:boolean
 reason:'disabled'|'missing-palm'|'invalid'|'palms-too-close'|'outside-shaft'|'angle-limit'|'aligned'
 correctionRadians:number
 supportAlongSource:number|null
 supportSourcePoint:ShaftPoint|null
}
const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle))
export function fitTwoHandShaft(input:TwoHandShaftInput):TwoHandShaftFit {
 const unchanged=(reason:TwoHandShaftFit['reason']):TwoHandShaftFit=>({angle:input.intendedAngle,applied:false,reason,correctionRadians:0,supportAlongSource:null,supportSourcePoint:null})
 if(!input.enabled)return unchanged('disabled')
 if(!input.off)return unchanged('missing-palm')
 const {main,off,sourceGrip,sourceShaft,scale}=input,[a,b]=sourceShaft
 const values=[main.x,main.y,off.x,off.y,sourceGrip.x,sourceGrip.y,a.x,a.y,b.x,b.y,scale,input.intendedAngle,input.maxCorrectionDegrees??60,input.endInsetWorld??.8]
 if(!values.every(Number.isFinite)||scale<=0||(input.maxCorrectionDegrees??60)<0||(input.endInsetWorld??.8)<0)return unchanged('invalid')
 const sx=b.x-a.x,sy=b.y-a.y,sourceLength=Math.hypot(sx,sy)
 if(sourceLength<1e-6)return unchanged('invalid')
 const dx=off.x-main.x,dy=off.y-main.y,separation=Math.hypot(dx,dy)
 if(separation<1)return unchanged('palms-too-close')
 const forward=Math.atan2(dy,dx),candidates=[forward,forward+Math.PI]
 const angle=candidates.reduce((best,next)=>Math.abs(wrap(next-input.intendedAngle))<Math.abs(wrap(best-input.intendedAngle))?next:best)
 const correction=wrap(angle-input.intendedAngle)
 if(Math.abs(correction)>(input.maxCorrectionDegrees??60)*Math.PI/180)return unchanged('angle-limit')
 const ux=sx/sourceLength,uy=sy/sourceLength,alongWorld=dx*Math.cos(angle)+dy*Math.sin(angle),along=alongWorld/scale
 const project=(p:ShaftPoint)=>(p.x-sourceGrip.x)*ux+(p.y-sourceGrip.y)*uy
 const start=project(a)+(input.endInsetWorld??.8)/scale,end=project(b)-(input.endInsetWorld??.8)/scale
 if(along<start||along>end)return unchanged('outside-shaft')
 // Preserve main anchor and all source/world scales. The support hand may slide
 // along the wood; a second separately painted leather grip is not required.
 return{angle:input.intendedAngle+correction,applied:true,reason:'aligned',correctionRadians:correction,supportAlongSource:along,
  supportSourcePoint:{x:sourceGrip.x+ux*along,y:sourceGrip.y+uy*along}}
}
