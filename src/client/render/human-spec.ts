/** Client-only original-part registration. Graphic landmarks are not physical 3D axes. */
export type HumanDirection='down'|'left'|'right'|'up'
export type HumanSide='left'|'right'
export type HumanPoint=readonly[number,number]
export interface HumanSource {
 frame:string
 /** Source-frame-local, observed graphic attachment points. */
 a:HumanPoint
 b:HumanPoint
 split?:{origin:HumanPoint;normal:HumanPoint}
 /** Observed skin-only area that may occlude an opaque hood lining. */
 face?:readonly HumanPoint[]
 scale?:number
 /** Uniform original footprint at its observed lower silhouette, not an ankle-to-toe rotation. */
 solePinned?:boolean
}
export interface HumanBaseDirection {
 head:HumanSource
 torso:HumanSource&{neck:HumanPoint;waist:number;chestEnd:number;shoulders:Record<HumanSide,HumanPoint>;hips:Record<HumanSide,HumanPoint>}
 upper:Record<HumanSide,HumanSource>
 forearm:Record<HumanSide,HumanSource&{wrist:HumanPoint}>
 /** Authored sewn underclothing, not a generated bare thigh or an equipped armor item. */
 legs:Record<HumanSide,HumanSource&{knee:HumanPoint}>
 foot:HumanSource
}
export type HumanGarmentKind='shirt'|'coat'|'mail'|'hood'|'apron'|'cloak'|'helmet'|'mask'|'goggles'|'quiver'|'belt'|'cuirass'|'upperCloth'|'upperLeather'|'upperMail'|'forearmCloth'|'forearmLeather'|'gloveLeather'|'gloveWool'|'boot'
export interface HumanWardrobeRule {
 torso?:'shirt'|'coat'|'mail'|'apron'|'cuirass'
 upper?:'upperCloth'|'upperLeather'|'upperMail'
 forearm?:'forearmCloth'|'forearmLeather'
 hands?:'gloveLeather'|'gloveWool'
 feet?:'boot'
 accessory?:'hood'|'cloak'|'helmet'|'mask'|'goggles'|'quiver'|'belt'
 tint?:number
}
export interface HumanReplacementSource extends HumanSource {root:HumanPoint;tip:HumanPoint;distal?:HumanSource}
export interface HumanSpec {
 id:string
 base:Record<HumanDirection,HumanBaseDirection>
 pieces:Record<HumanGarmentKind,Record<HumanDirection,HumanSource>>
 wardrobe:Record<string,HumanWardrobeRule>
 /** Existing actual prosthetic object sources are explicitly shared, not four new facings. */
 replacements:Record<string,HumanReplacementSource>
 heads?:Record<string,Record<HumanDirection,HumanSource>>
}
export const humanDirections:readonly HumanDirection[]=['down','left','right','up']
export const humanOwners= ['Skull','Chest','Abdomen','Pelvis','Neck','LeftEye','RightEye','Nose','LeftEar','RightEar','Jaw','LeftUpperArm','LeftForearm','LeftHand','RightUpperArm','RightForearm','RightHand','LeftThigh','LeftShin','LeftFoot','RightThigh','RightShin','RightFoot']as const
export function humanSpecFrameKeys(spec:HumanSpec){
 const keys=new Set<string>()
 for(const direction of humanDirections){const b=spec.base[direction];for(const p of [b.head,b.torso,b.foot,...Object.values(b.upper),...Object.values(b.forearm),...Object.values(b.legs)])keys.add(p.frame)}
 for(const views of Object.values(spec.pieces))for(const p of Object.values(views))keys.add(p.frame)
 for(const source of Object.values(spec.replacements)){keys.add(source.frame);if(source.distal)keys.add(source.distal.frame)}
 for(const views of Object.values(spec.heads??{}))for(const source of Object.values(views))keys.add(source.frame)
 return [...keys]
}
export function humanWithHead(spec:HumanSpec,role?:string):HumanSpec{
 const heads=role?spec.heads?.[role]:undefined
 return heads?{...spec,base:Object.fromEntries(humanDirections.map(direction=>[direction,{...spec.base[direction],head:heads[direction]}]))as HumanSpec['base']}:spec
}
export function humanEndpointOwner(root:string){const side=root.startsWith('Right')?'Right':'Left';return /(?:UpperArm|Forearm|Hand)$/.test(root)?side+'Hand':/(?:Thigh|Shin|Foot)$/.test(root)?side+'Foot':undefined}
