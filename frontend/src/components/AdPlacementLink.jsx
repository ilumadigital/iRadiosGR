import React, {useEffect, useRef} from 'react';
import {startVisualViewabilityTracking} from '../utils/adViewability';

// Stable component identity: re-rendering a list must never count another view.
// One impression is emitted when >=50% of each creative slot becomes visible.
// Re-rendering parent cards must not fabricate additional impression events.
const seenInPageSession=new Set();
export default function AdPlacementLink({banner,placement,children,className='',slotKey,style}) {
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
      // This remains a NON-BILLABLE legacy counter. V2 campaigns never use
      // the unaudited /impression endpoint for financial settlement.
      fetch('/api/banners/'+banner._id+'/impression',{method:'POST'}).catch(()=>{});
    };
    // Fail closed without IntersectionObserver. A page request never earns an
    // impression: require 50% continuous foreground visibility for 1s (2s hero).
    return startVisualViewabilityTracking(node.current,{
      minimumMs:(placement||banner.placement?.[0])==='hero'?2000:1000,
      onQualified:track
    });
  },[banner?._id,placement,slotKey]);

  if(!banner||!/^https?:\/\//i.test(banner.targetUrl||''))return null;
  const slot=placement||banner.placement?.[0]||'home';
  const query=new URLSearchParams({
    ref:'iradiosapp',utm_source:'iradios',utm_medium:'banner',
    utm_campaign:slot,utm_content:String(banner._id)
  });
  const href=banner.targetUrl+(banner.targetUrl.includes('?')?'&':'?')+query.toString();
  return <a ref={node} href={href} target="_blank" rel="noopener noreferrer"
    className={className} style={style} aria-label={`Sponsored: ${banner.title}`}
    onClick={event=>{
      event.stopPropagation();
      fetch(`/api/banners/${banner._id}/click`,{method:'POST'}).catch(()=>{});
    }}>{children}</a>;
}
