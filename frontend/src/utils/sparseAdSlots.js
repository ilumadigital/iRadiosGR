/** Sparse, session-stable ad injection. No ad before 12 stations, 12–18
 * organic stations between slots, and no reshuffling on player updates. */
const bounded=(value,min,max)=>Math.min(max,Math.max(min,value));
const randomStep=(state)=>{
  let x=state|0;
  x^=x<<13;x^=x>>>17;x^=x<<5;
  return x|0;
};
export function sparseAdSlots(stationCount,{seed=1,minGap=12,maxGap=18,maxAds=Infinity}={}){
  const size=Math.max(0,Math.floor(Number(stationCount)||0));
  const lo=bounded(Math.floor(minGap),1,100);
  const hi=bounded(Math.floor(maxGap),lo,100);
  const slots=[];
  if(size<lo||maxAds<=0)return slots;
  let state=(Number(seed)|0)||0x6d2b79f5;
  let index=0;
  while(slots.length<maxAds){
    state=randomStep(state);
    const gap=lo+((state>>>0)%(hi-lo+1));
    index+=gap;
    if(index>=size)break;
    slots.push(index);
  }
  return slots;
}
export function sparseAdMap(stationCount,banners,seed){
  const count=Array.isArray(banners)?banners.length:0;
  if(!count)return new Map();
  const slots=sparseAdSlots(stationCount,{seed});
  const result=new Map();
  slots.forEach((index,ordinal)=>{
    const offset=((seed|0)>>>0)%count;
    result.set(index,banners[(offset+ordinal)%count]);
  });
  return result;
}
