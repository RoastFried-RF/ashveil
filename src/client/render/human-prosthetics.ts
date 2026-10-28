import type { HumanDirection, HumanReplacementPart, HumanReplacementView, HumanSource, HumanSpec } from './human-spec'

export function humanReplacementView(spec:HumanSpec,def:string,direction:HumanDirection){
 return spec.replacements[def]?.views?.[direction]
}

/** Original UID stays shared, while each installed anatomical owner gets its own drawn part. */
export function humanReplacementPieces(root:string,view:HumanReplacementView):{owner:string;source:HumanSource}[]{
 if(view.whole)return[{owner:root,source:root.endsWith('Foot')&&view.distal?view.distal:view.whole}]
 const side=root.startsWith('Right')?'Right':'Left',suffix=root.slice(side.length)
 const chain:HumanReplacementPart[]=suffix==='UpperArm'||suffix==='Forearm'||suffix==='Hand'
  ?['UpperArm','Forearm','Hand']:suffix==='Thigh'||suffix==='Shin'||suffix==='Foot'?['Thigh','Shin','Foot']:[]
 const start=chain.indexOf(suffix as HumanReplacementPart)
 return start<0?[]:chain.slice(start).flatMap(part=>view.parts[part]?[{owner:side+part,source:view.parts[part]!}]:[])
}
