import data from './human-art.json'
import fit from './human-fit.json'
import heads from './human-heads.json'
import type {HumanDirection,HumanGarmentKind,HumanPoint,HumanReplacementSource,HumanSource,HumanSpec} from './human-spec'
const registered=data as unknown as HumanSpec
const replacementSources=fit.replacementSources as unknown as Record<string,Partial<HumanReplacementSource>>
const facePolygons=fit.facePolygons as unknown as Partial<Record<HumanDirection,HumanPoint[]>>
const pieceSources=fit.pieceSources as unknown as Partial<Record<HumanGarmentKind,Partial<Record<HumanDirection,Partial<HumanSource>>>>>
export const humanArt:HumanSpec={...registered,heads:heads.heads as unknown as HumanSpec['heads'],base:Object.fromEntries(Object.entries(registered.base).map(([direction,base])=>[direction,{...base,head:{...base.head,face:facePolygons[direction as HumanDirection]}}])) as HumanSpec['base'],pieces:Object.fromEntries(Object.entries(registered.pieces).map(([kind,views])=>[kind,Object.fromEntries(Object.entries(views).map(([direction,source])=>[direction,{...source,...pieceSources[kind as HumanGarmentKind]?.[direction as HumanDirection]}]))]))as HumanSpec['pieces'],replacements:Object.fromEntries(Object.entries(registered.replacements).map(([id,source])=>[id,{...source,...replacementSources[id]}]))}
