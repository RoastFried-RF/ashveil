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
 eyes?:Partial<Record<HumanSide,HumanPoint>>
 neckStartY?:number
 mouth?:HumanPoint
 /** Visible lens/attachment point; separate from the size/orientation span a/b. */
 mount?:HumanPoint
 scale?:number
 /** Source-only part ownership when an original contains a whole limb. */
 clip?:readonly HumanPoint[]
 tint?:number
 opening?:{center:HumanPoint;rx:number;ry:number;rotation?:number}
 waistBreadth?:number
 beltSplitY?:number
 breadth?:number
 palmBreadth?:number
 handTip?:HumanPoint
 wornShoulders?:Record<HumanSide,HumanPoint>
 jointOverlap?:number
 material?:'flesh-with-underclothing'
 /** Uniform original footprint at its observed lower silhouette, not an ankle-to-toe rotation. */
 solePinned?:boolean
}
export interface HumanBaseDirection {
 hipHeight?:number
 head:HumanSource
 torso:HumanSource&{neck:HumanPoint;waist:number;chestEnd:number;shoulders:Record<HumanSide,HumanPoint>;hips:Record<HumanSide,HumanPoint>}
 upper:Record<HumanSide,HumanSource>
 forearm:Record<HumanSide,HumanSource&{wrist:HumanPoint}>
 /** Authored sewn underclothing, not a generated bare thigh or an equipped armor item. */
 legs:Record<HumanSide,HumanSource&{knee:HumanPoint}>
 foot:HumanSource
 /** Separate original anatomical sides; old shared foot remains the clothing fallback. */
 feet?:Record<HumanSide,HumanSource>
}
export interface HumanDetailCut {polygon:HumanPoint[];triangles?:HumanPoint[][];cap:HumanPoint;width:number}
export interface HumanDetailSpec {
 patches:Record<string,HumanSource&{size:[number,number];opaqueWidth:number;opaqueBottom:number}>
 hands:Record<string,Partial<Record<string,HumanDetailCut>>>
 handCleanup?:Record<string,HumanPoint[][][]>
 handAllDigitsCut?:Record<string,HumanPoint[]>
 footDetails:Record<string,{cuts:Partial<Record<string,HumanDetailCut>>;orphanTrianglesByMask?:HumanPoint[][][];soleYByMissingMask:number[];alphaThreshold:number;baseSoleY:number}>
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
 skinTint?:number
 motionScale?:number
 base:Record<HumanDirection,HumanBaseDirection>
 pieces:Record<HumanGarmentKind,Record<HumanDirection,HumanSource>>
 wardrobe:Record<string,HumanWardrobeRule>
 /** Existing actual prosthetic object sources are explicitly shared, not four new facings. */
 replacements:Record<string,HumanReplacementSource>
 heads?:Record<string,Record<HumanDirection,HumanSource>>
 details?:HumanDetailSpec
}
export const humanDirections:readonly HumanDirection[]=['down','left','right','up']
/** Profile eye ownership follows the same anatomical near side as arms/legs. */
export function humanProfileNearSide(direction:HumanDirection):HumanSide|undefined{return direction==='left'?'left':direction==='right'?'right':undefined}
export const humanOwners= ['Skull','Chest','Abdomen','Pelvis','Neck','LeftEye','RightEye','Nose','LeftEar','RightEar','Jaw','LeftUpperArm','LeftForearm','LeftHand','RightUpperArm','RightForearm','RightHand','LeftThigh','LeftShin','LeftFoot','RightThigh','RightShin','RightFoot']as const
export const humanDigitSuffixes=['Thumb','Index','Middle','Ring','Pinky']as const
export const humanToeSuffixes=['Toe1','Toe2','Toe3','Toe4','Toe5']as const
export const humanFineOwners=['Left','Right'].flatMap(side=>[...humanDigitSuffixes,...humanToeSuffixes].map(suffix=>side+suffix))
export const humanVisibleOwners=[...humanOwners,...humanFineOwners]
export const humanFootSource=(base:HumanBaseDirection,side:HumanSide)=>base.feet?.[side]??base.foot
export function humanSpecFrameKeys(spec:HumanSpec){
 const keys=new Set<string>()
 for(const direction of humanDirections){const b=spec.base[direction];for(const p of [b.head,b.torso,b.foot,...Object.values(b.feet??{}),...Object.values(b.upper),...Object.values(b.forearm),...Object.values(b.legs)])keys.add(p.frame)}
 for(const views of Object.values(spec.pieces))for(const p of Object.values(views))keys.add(p.frame)
 for(const source of Object.values(spec.replacements)){keys.add(source.frame);if(source.distal)keys.add(source.distal.frame)}
 for(const views of Object.values(spec.heads??{}))for(const source of Object.values(views))keys.add(source.frame)
 for(const source of Object.values(spec.details?.patches??{}))keys.add(source.frame)
 return [...keys]
}
export function humanWithHead(spec:HumanSpec,role?:string):HumanSpec{
 const heads=role?spec.heads?.[role]:undefined
 return heads?{...spec,base:Object.fromEntries(humanDirections.map(direction=>[direction,{...spec.base[direction],head:heads[direction]}]))as HumanSpec['base']}:spec
}
export function humanEndpointOwner(root:string){const side=root.startsWith('Right')?'Right':'Left';return /(?:UpperArm|Forearm|Hand)$/.test(root)?side+'Hand':/(?:Thigh|Shin|Foot)$/.test(root)?side+'Foot':undefined}
