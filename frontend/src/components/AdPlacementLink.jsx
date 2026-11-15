import React,{useEffect,useMemo,useRef,useState} from 'react';
import {startVisualViewabilityTracking} from '../utils/adViewability';

// Identity is a CREATIVE + PLACEMENT + PHYSICAL SLOT, never a React re-render.
const seenInPageSession=new Set();
const adHeaders=()=>{
 const token=localStorage.getItem('iluma_token');
 return {'Content-Type':'application/json',
  ...(token?{Authorization:'Bearer '+token}:{})};
};
const postPaid=(endpoint,body)=>fetch('/api/advertising/v2/'+endpoint,{
 method:'POST',headers:adHeaders(),body:JSON.stringify(body),keepalive:true
}).then(r=>r.ok?r.json():null).catch(()=>null);

export default function AdPlacementLink({banner,placement,children,className='',slotKey,style}){
 const node=useRef(null),viewed=useRef(false),ticket=useRef(null);
 const [authorization,setAuthorization]=useState({id:'',checked:false,capability:null});
 const id=String(banner?._id||''),slot=placement||banner?.placement?.[0]||'home';
 const slotId=useMemo(()=>[window.location.pathname,slot,id,slotKey||'primary'].join(':'),
  [slot,id,slotKey]);
 const paid=banner?.paidDeliveryRequired===true;
 useEffect(()=>{
  let live=true;
  viewed.current=false;
  ticket.current=null;
  if(!id||!paid){setAuthorization({id,checked:true,capability:null});return;}
  setAuthorization({id,checked:false,capability:null});
  if(seenInPageSession.has(slotId)){
   setAuthorization({id,checked:true,capability:null});return;
  }
  void postPaid('tickets',{creativeId:id,kind:'visual',placement:slot}).then(data=>{
   if(!live)return;
   const capability=typeof data?.capability==='string'?data.capability:null;
   ticket.current=capability;
   setAuthorization({id,checked:true,capability});
  });
  return ()=>{
   live=false;
   const capability=ticket.current;
   if(capability)void postPaid('release',{capability,reason:'finished'});
  };
 },[id,slot,slotId,paid]);
 useEffect(()=>{
  if(!id||!node.current||!authorization.checked||
    (paid&&(!authorization.capability||authorization.id!==id)))return;
  if(seenInPageSession.has(slotId))return;
  let startRequest=null;
  const report=(ratio)=>postPaid('heartbeat',{
   capability:authorization.capability,
   report:{ratio,foreground:document.visibilityState==='visible'}});
  const onQualified=()=>{
   if(viewed.current||seenInPageSession.has(slotId))return;
   viewed.current=true;
   if(seenInPageSession.size>5000)seenInPageSession.clear();
   seenInPageSession.add(slotId);
   if(paid){
    void Promise.resolve(startRequest).then(()=>report(1));
   }else{
    // Historical counters are intentionally non-billable; never call them
    // for a funded campaign.
    fetch('/api/banners/'+id+'/impression',{method:'POST'}).catch(()=>{});
   }
  };
  return startVisualViewabilityTracking(node.current,{
   minimumMs:300,threshold:0.5,
   onVisibleStart:paid?()=>{startRequest=report(1)}:undefined,
   onQualified
  });
 },[id,slotId,paid,authorization.checked,authorization.capability,authorization.id]);
 if(!banner||!/^https?:\/\//i.test(banner.targetUrl||''))return null;
 if(paid&&(!authorization.checked||authorization.id!==id||
   !authorization.capability))return null;
 const query=new URLSearchParams({
  ref:'iradiosapp',utm_source:'iradios',utm_medium:'banner',
  utm_campaign:slot,utm_content:id
 });
 const href=banner.targetUrl+(banner.targetUrl.includes('?')?'&':'?')+query.toString();
 return <a ref={node} href={href} target="_blank" rel="noopener noreferrer"
  className={className} style={style} aria-label={`Sponsored: ${banner.title}`}
  onClick={event=>{
   event.stopPropagation();
   if(paid&&authorization.capability)
    void postPaid('click',{capability:authorization.capability});
   else fetch('/api/banners/'+id+'/click',{method:'POST'}).catch(()=>{});
  }}>{children}</a>;
}
