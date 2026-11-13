/**
 * Non-billable visual viewability observer for existing listener banners.
 * It improves legacy analytics; it NEVER authorizes Advertising v2 CPM.
 *
 * IntersectionObserver proves geometry only, not human attention. Missing
 * browser APIs fail closed instead of counting a page load as an impression.
 */
export function startVisualViewabilityTracking(target,{
  minimumMs=1000,threshold=0.5,onQualified,
  Observer=typeof IntersectionObserver==='undefined'?null:IntersectionObserver,
  visibility=typeof document==='undefined'?null:document,
  now=()=>performance.now(),
  schedule=(fn,ms)=>setTimeout(fn,ms),
  cancel=id=>clearTimeout(id)
}={}){
  if(!target||!Observer||!visibility||
     typeof visibility.addEventListener!=='function'||
     typeof visibility.removeEventListener!=='function'||
     typeof onQualified!=='function'||
     !Number.isFinite(minimumMs)||minimumMs<1||
     !Number.isFinite(threshold)||threshold<=0||threshold>1)return ()=>{};
  let ratio=0,startedAt=null,timer=null,observer=null;
  let stopped=false,qualified=false;
  const foreground=()=>visibility.hidden!==true&&
    visibility.visibilityState==='visible';
  const clear=()=>{if(timer!==null){cancel(timer);timer=null;}};
  const reset=()=>{clear();startedAt=null;};
  function stop(){
    if(stopped)return;
    stopped=true;reset();
    observer?.disconnect();
    visibility.removeEventListener('visibilitychange',onVisibility);
  }
  function sample(){
    timer=null;
    if(stopped||qualified)return;
    if(target.isConnected===false||!foreground()||ratio<threshold){
      reset();return;
    }
    const current=now();
    if(!Number.isFinite(current)){reset();return;}
    if(startedAt===null)startedAt=current;
    const elapsed=Math.max(0,current-startedAt);
    if(elapsed>=minimumMs){
      qualified=true;stop();onQualified();return;
    }
    clear();
    timer=schedule(sample,Math.max(1,Math.ceil(minimumMs-elapsed)));
  }
  function onVisibility(){
    if(!foreground())reset();
    else if(ratio>=threshold)sample();
  }
  observer=new Observer(entries=>{
    const entry=entries.find(item=>item.target===target);
    if(!entry)return;
    const nextRatio=entry.isIntersecting&&Number.isFinite(entry.intersectionRatio)?
      entry.intersectionRatio:0;
    if(nextRatio<threshold)reset();
    ratio=nextRatio;
    if(ratio>=threshold)sample();
  },{threshold:[0,threshold,1]});
  visibility.addEventListener('visibilitychange',onVisibility);
  observer.observe(target);
  return stop;
}
