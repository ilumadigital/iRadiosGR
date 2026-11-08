import {useEffect,useState} from 'react';
import {getAthensClock} from '../utils/schedule';
// One catalog snapshot per minute; never one request per station.
export default function useCatalogNowPlaying(){
  const [byId,setById]=useState({});
  const [clock,setClock]=useState(()=>getAthensClock());
  useEffect(()=>{
    let active=true,inFlight=false,request;
    const load=async()=>{
      if(!active||inFlight||document.hidden)return;
      inFlight=true;
      request=new AbortController();
      try{
        const response=await fetch('/api/catalog/now-playing',{signal:request.signal});
        if(!response.ok)throw new Error('Catalog now-playing unavailable');
        const data=await response.json();
        if(active)setById(data?.stations&&typeof data.stations==='object'?data.stations:{});
      }catch(error){
        if(active&&error.name!=='AbortError')setById({});
      }finally{inFlight=false;}
    };
    load();
    const timer=setInterval(load,60000);
    const onVisible=()=>{if(!document.hidden)load();};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{
      active=false;request?.abort();clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[]);
  useEffect(()=>{
    const timer=setInterval(()=>setClock(getAthensClock()),60000);
    return()=>clearInterval(timer);
  },[]);
  return {byId,clock};
}
