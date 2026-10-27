import data from './human-art.json'
import fit from './human-fit.json'
import headData from './human-heads.json'
import detailData from './human-details.json'
import mutantData from './human-mutants.json'
import mutantDetails from './human-mutant-details.json'
import wearFit from './human-wear-fit.json'
import type {HumanDetailSpec,HumanDirection,HumanGarmentKind,HumanPoint,HumanReplacementSource,HumanSource,HumanSpec,HumanSide} from './human-spec'
const wearPieces=wearFit.pieces as unknown as Partial<Record<HumanGarmentKind,Partial<Record<HumanDirection,Partial<HumanSource>>>>>
const registered=data as unknown as HumanSpec
const anatomicalFeet=detailData.feet as unknown as Record<HumanDirection,Record<HumanSide,HumanSource>>
const replacementSources=fit.replacementSources as unknown as Record<string,Partial<HumanReplacementSource>>
const facePolygons=fit.facePolygons as unknown as Partial<Record<HumanDirection,HumanPoint[]>>
const pieceSources=fit.pieceSources as unknown as Partial<Record<HumanGarmentKind,Partial<Record<HumanDirection,Partial<HumanSource>>>>>
type Eyes=Partial<Record<HumanSide,HumanPoint>>
const headEyes=fit.headEyes as unknown as Partial<Record<HumanDirection,Eyes>>,roleEyes=fit.roleEyes as unknown as Record<string,Partial<Record<HumanDirection,Eyes>>>,headMouths=fit.headMouths as unknown as Partial<Record<HumanDirection,HumanPoint>>,roleMouths=fit.roleMouths as unknown as Record<string,Partial<Record<HumanDirection,HumanPoint>>>
const heads=Object.fromEntries(Object.entries(headData.heads).map(([role,views])=>[role,Object.fromEntries(Object.entries(views).map(([direction,head])=>[direction,{...head,eyes:roleEyes[role]?.[direction as HumanDirection],mouth:roleMouths[role]?.[direction as HumanDirection]}]))]))as unknown as HumanSpec['heads']
const originalHumanArt:HumanSpec={...registered,heads,details:detailData as unknown as HumanDetailSpec,base:Object.fromEntries(Object.entries(registered.base).map(([direction,base])=>[direction,{...base,feet:anatomicalFeet[direction as HumanDirection],head:{...base.head,face:facePolygons[direction as HumanDirection],eyes:headEyes[direction as HumanDirection],mouth:headMouths[direction as HumanDirection]}}])) as HumanSpec['base'],pieces:Object.fromEntries(Object.entries(registered.pieces).map(([kind,views])=>[kind,Object.fromEntries(Object.entries(views).map(([direction,source])=>[direction,{...source,...pieceSources[kind as HumanGarmentKind]?.[direction as HumanDirection],...wearPieces[kind as HumanGarmentKind]?.[direction as HumanDirection]}]))]))as HumanSpec['pieces'],replacements:Object.fromEntries(Object.entries(registered.replacements).map(([id,source])=>[id,{...source,...replacementSources[id]}]))}

type BreadthFit=Pick<HumanSource,'breadth'|'palmBreadth'|'handTip'|'waistBreadth'>
const wearBodies=wearFit.models as unknown as Record<string,Record<HumanDirection,{torso:BreadthFit;upper:Record<HumanSide,BreadthFit>;forearm:Record<HumanSide,BreadthFit>}>>
const wearHeads=wearFit.heads as unknown as Record<string,Partial<HumanSource>>
function fittedBody(spec:HumanSpec,key:string):HumanSpec{
 const heads=Object.fromEntries(Object.entries(spec.heads??{}).map(([role,views])=>[role,Object.fromEntries(Object.entries(views).map(([direction,source])=>[direction,{...source,...wearHeads[source.frame]}]))]))as HumanSpec['heads']
 const base=Object.fromEntries(Object.entries(spec.base).map(([direction,body])=>{
  const fit=wearBodies[key][direction as HumanDirection]
  const upper=Object.fromEntries(Object.entries(body.upper).map(([side,source])=>[side,{...source,...fit.upper[side as HumanSide]}]))
  const forearm=Object.fromEntries(Object.entries(body.forearm).map(([side,source])=>[side,{...source,...fit.forearm[side as HumanSide]}]))
  return[direction,{...body,head:{...body.head,...wearHeads[body.head.frame]},torso:{...body.torso,...fit.torso},upper,forearm}]
 }))as HumanSpec['base']
 return{...spec,base,heads}
}
export const humanArt=fittedBody(originalHumanArt,'human')
const mutantArt=Object.fromEntries(Object.entries(mutantData).map(([key,value])=>[key,fittedBody({...humanArt,...value,details:{...humanArt.details,hands:{...humanArt.details!.hands,...mutantDetails.hands},handCleanup:{...humanArt.details!.handCleanup,...mutantDetails.handCleanup},handAllDigitsCut:{...humanArt.details!.handAllDigitsCut,...mutantDetails.handAllDigitsCut}}}as unknown as HumanSpec,key)]))
export const humanModels:Readonly<Record<string,HumanSpec>>={human:humanArt,...mutantArt}
export function humanArtFor(key?:string):HumanSpec{if(key&&!humanModels[key])throw Error('Unknown registered human body: '+key);return humanModels[key??'human']}
