/** One authored dorsal view, six immutable source regions; rotations are display reuse. */
export interface CrawlerPoint {x:number;y:number}
export interface CrawlerSpec {
 art:{
  headClosed:{frame:string;pivot:CrawlerPoint}
  headOpen:{frame:string;pivot:CrawlerPoint}
  middle:{frame:string;pivot:CrawlerPoint;left:CrawlerPoint;right:CrawlerPoint}
  tail:{frame:string;pivot:CrawlerPoint;left:CrawlerPoint;right:CrawlerPoint}
  upper:{frame:string;proximal:CrawlerPoint;distal:CrawlerPoint}
  lower:{frame:string;proximal:CrawlerPoint;distal:CrawlerPoint}
 }
 /** Presentation pixels, not a measured physical skeleton or gameplay occupancy. */
 layout:{bodyScale:number;headScale:number;pitch:number;firstOffset:number;tailOffset:number;upper:number;lower:number;outreach:number;stride:number;swingTravel:number;settleSeconds:number;ceilingLift:number}
}
export function crawlerSpecFrameKeys(spec:CrawlerSpec){return [...new Set(Object.values(spec.art).map(part=>part.frame))]}
export const crawlerBodyId=(index:number)=>index===7?'TailSegment8':`Segment${index+1}`
export const crawlerLegId=(index:number,side:number)=>`Segment${index+1}${side<0?'Left':'Right'}Leg`
export const crawlerPartIds=['Head',...Array.from({length:8},(_,i)=>crawlerBodyId(i)),...Array.from({length:8},(_,i)=>[-1,1].map(side=>crawlerLegId(i,side))).flat()]
