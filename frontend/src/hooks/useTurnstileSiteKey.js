import { useCallback, useEffect, useState } from 'react';

// Fetch the PUBLIC widget key only; Cloudflare Siteverify remains backend-only.
export default function useTurnstileSiteKey(baseUrl='/api') {
  const [siteKey,setSiteKey]=useState('');
  const [turnstileError,setTurnstileError]=useState('');
  const [retryIndex,setRetryIndex]=useState(0);

  const retryTurnstile=useCallback(()=>{
    setSiteKey('');
    setTurnstileError('');
    setRetryIndex(current=>current+1);
  },[]);

  useEffect(()=>{
    let active=true;
    let retryTimer;
    let controller;
    let attempt=0;
    const url=(baseUrl||'/api').replace(/\/$/,'')+'/auth/turnstile-config';

    async function load(){
      controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6500);
      try{
        const response=await fetch(url,{
          cache:'no-store',credentials:'omit',
          headers:{Accept:'application/json'},
          signal:controller.signal
        });
        if(response.status===503){
          const data=await response.json().catch(()=>null);
          if(data?.error==='turnstile_not_configured'){
            if(active){
              setSiteKey('');
              setTurnstileError('Η επαλήθευση Cloudflare δεν έχει ρυθμιστεί στον διακομιστή. Επικοινώνησε με την υποστήριξη.');
            }
            return;
          }
        }
        if(!response.ok){
          const error=new Error('Turnstile config HTTP '+response.status);
          error.status=response.status;
          throw error;
        }
        const data=await response.json();
        if(data?.ready!==true || typeof data.siteKey!=='string' || !data.siteKey.trim()){
          if(active){
            setSiteKey('');
            setTurnstileError('Η επαλήθευση Cloudflare δεν έχει ρυθμιστεί στον διακομιστή. Επικοινώνησε με την υποστήριξη.');
          }
          return;
        }
        if(active){
          setSiteKey(data.siteKey);
          setTurnstileError('');
        }
      }catch(error){
        if(!active)return;
        const status=error?.status;
        // Retry temporary proxy/network failures, not permanent auth or 404.
        if(attempt<2 && (!status || status===429 || status>=500)){
          attempt++;
          retryTimer=setTimeout(load,750*attempt);
          return;
        }
        setSiteKey('');
        setTurnstileError(status===401 || status===403
          ? 'Η πρόσβαση στην επαλήθευση Cloudflare αποκλείστηκε από τον server.'
          : status===404
            ? 'Η υπηρεσία επαλήθευσης Cloudflare δεν βρέθηκε στον server.'
            : 'Η επαλήθευση Cloudflare δεν φορτώθηκε. Δοκίμασε ξανά.');
      }finally{
        clearTimeout(timeout);
      }
    }
    load();
    return()=>{
      active=false;
      clearTimeout(retryTimer);
      controller?.abort();
    };
  },[baseUrl,retryIndex]);

  return {siteKey,turnstileError,retryTurnstile};
}
