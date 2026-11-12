import React, {useEffect, useRef} from 'react';

// Stable component identity: re-rendering a list must never count another view.
// One impression is emitted when >=50% of each creative slot becomes visible.
// Re-rendering parent cards must not fabricate additional impression events.
const seenInPageSession=new Set();
export default function AdPlacementLink({banner,placement,children,className='',slotKey}) {
  const node=useRef(null),viewed=useRef(false);
  useEffect(()=>{
    viewed.current=false;
    if(!banner?._id||!node.current)return;
    const track=()=>{
      const slot=[window.location.pathname,placement||banner.placement?.[0],banner._id,slotKey||'primary'].join(':');
      if(viewed.current||seenInPageSession.has(slot))return;
      viewed.current=true;
      if(seenInPageSession.size>5000)seenInPageSession.clear();
      seenInPageSession.add(slot);
      fetch(`/api/banners/${banner._id}/impression`,{method:'POST'}).catch(()=>{});
    };
    if(typeof IntersectionObserver==='undefined'){track();return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=0.5)){
        track();observer.disconnect();
      }
    },{threshold:0.5});
    observer.observe(node.current);
    return()=>observer.disconnect();
  },[banner?._id]);

  if(!banner||!/^https?:\/\//i.test(banner.targetUrl||''))return null;
  const slot=placement||banner.placement?.[0]||'home';
  const query=new URLSearchParams({
    ref:'iradiosapp',utm_source:'iradios',utm_medium:'banner',
    utm_campaign:slot,utm_content:String(banner._id)
  });
  const href=banner.targetUrl+(banner.targetUrl.includes('?')?'&':'?')+query.toString();
  return <a ref={node} href={href} target="_blank" rel="noopener noreferrer"
    className={className} aria-label={`Sponsored: ${banner.title}`}
    onClick={event=>{
      event.stopPropagation();
      fetch(`/api/banners/${banner._id}/click`,{method:'POST'}).catch(()=>{});
    }}>{children}</a>;
}
