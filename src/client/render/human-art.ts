import data from './human-art.json'
import fit from './human-fit.json'
import headData from './human-heads.json'
import type {HumanDirection,HumanGarmentKind,HumanPoint,HumanReplacementSource,HumanSource,HumanSpec,HumanSide} from './human-spec'
const registered=data as unknown as HumanSpec
const replacementSources=fit.replacementSources as unknown as Record<string,Partial<HumanReplacementSource>>
const facePolygons=fit.facePolygons as unknown as Partial<Record<HumanDirection,HumanPoint[]>>
const pieceSources=fit.pieceSources as unknown as Partial<Record<HumanGarmentKind,Partial<Record<HumanDirection,Partial<HumanSource>>>>>
type Eyes=Partial<Record<HumanSide,HumanPoint>>
const headEyes=fit.headEyes as unknown as Partial<Record<HumanDirection,Eyes>>,roleEyes=fit.roleEyes as unknown as Record<string,Partial<Record<HumanDirection,Eyes>>>,headMouths=fit.headMouths as unknown as Partial<Record<HumanDirection,HumanPoint>>,roleMouths=fit.roleMouths as unknown as Record<string,Partial<Record<HumanDirection,HumanPoint>>>
const heads=Object.fromEntries(Object.entries(headData.heads).map(([role,views])=>[role,Object.fromEntries(Object.entries(views).map(([direction,head])=>[direction,{...head,eyes:roleEyes[role]?.[direction as HumanDirection],mouth:roleMouths[role]?.[direction as HumanDirection]}]))]))as unknown as HumanSpec['heads']
export const humanArt:HumanSpec={...registered,heads,base:Object.fromEntries(Object.entries(registered.base).map(([direction,base])=>[direction,{...base,head:{...base.head,face:facePolygons[direction as HumanDirection],eyes:headEyes[direction as HumanDirection],mouth:headMouths[direction as HumanDirection]}}])) as HumanSpec['base'],pieces:Object.fromEntries(Object.entries(registered.pieces).map(([kind,views])=>[kind,Object.fromEntries(Object.entries(views).map(([direction,source])=>[direction,{...source,...pieceSources[kind as HumanGarmentKind]?.[direction as HumanDirection]}]))]))as HumanSpec['pieces'],replacements:Object.fromEntries(Object.entries(registered.replacements).map(([id,source])=>[id,{...source,...replacementSources[id]}]))}
