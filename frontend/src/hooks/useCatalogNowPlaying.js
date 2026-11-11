import {useEffect,useState} from 'react';
import {getAthensClock} from '../utils/schedule';
// One catalog snapshot per minute; never one request per station.
export default function useCatalogNowPlaying(currentUser){
  const [byId,setById]=useState({});
  const [clock,setClock]=useState(()=>getAthensClock());
  useEffect(()=>{
    setById({}); // Purge old account's song titles on logout or entitlement changes.
    let active=true,inFlight=false,request;
    const load=async()=>{
      if(!active||inFlight||document.hidden)return;
      inFlight=true;
      request=new AbortController();
      try{
        const token=localStorage.getItem('iluma_token');
        const response=await fetch('/api/catalog/now-playing',{
          signal:request.signal,cache:'no-store',
          ...(token?{headers:{Authorization:'Bearer '+token}}:{})
        });
        if(!response.ok)throw new Error('Catalog now-playing unavailable');
        const data=await response.json();
        if(active)setById(data?.stations&&typeof data.stations==='object'?data.stations:{});
      }catch(error){
        if(active&&error.name!=='AbortError')setById({});
      }finally{inFlight=false;}
    };
    load();
    const timer=setInterval(load,20000);
    const onVisible=()=>{if(!document.hidden)load();};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{
      active=false;request?.abort();clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[currentUser?._id,currentUser?.isPremium,currentUser?.broadcasterProfile?.tier]);
  // Drop ACRCloud titles at the server's exact four-minute deadline,
  // even if the catalog GET is cached or the next polling cycle has not run.
  useEffect(()=>{
    const expiries=Object.values(byId).filter(item=>item?.source==='acrcloud')
      .map(item=>Date.parse(item.expiresAt||'')).filter(Number.isFinite);
    if(!expiries.length)return;
    const timer=setTimeout(()=>{
      setById(previous=>{
        let modified=false;
        const next={...previous};
        for(const [id,item] of Object.entries(previous)){
          if(item?.source!=='acrcloud')continue;
          const expires=Date.parse(item.expiresAt||'');
          if(!Number.isFinite(expires)||expires>Date.now())continue;
          modified=true;
          if(item.broadcastHint)next[id]={broadcastHint:item.broadcastHint};
          else delete next[id];
        }
        return modified?next:previous;
      });
    },Math.max(0,Math.min(...expiries)-Date.now()+100));
    return ()=>clearTimeout(timer);
  },[byId]);
  useEffect(()=>{
    const timer=setInterval(()=>setClock(getAthensClock()),60000);
    return()=>clearInterval(timer);
  },[]);
  return {byId,clock};
}
