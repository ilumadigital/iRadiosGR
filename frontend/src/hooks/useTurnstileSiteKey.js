import { useEffect, useState } from 'react';

// The public site key comes from the backend at runtime; secrets never enter Vite.
export default function useTurnstileSiteKey(baseUrl='/api') {
  const [siteKey,setSiteKey]=useState('');
  const [turnstileError,setTurnstileError]=useState('');
  useEffect(()=>{
    let mounted=true;
    const api=baseUrl||'/api';
    fetch(api.replace(/\/$/,'')+'/auth/turnstile-config',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Cloudflare not available');
        return response.json();
      }).then(data=>{
        if(!mounted)return;
        if(data?.ready===true && typeof data.siteKey==='string' && data.siteKey){
          setSiteKey(data.siteKey);
          setTurnstileError('');
        } else {
          setSiteKey('');
          setTurnstileError('Η επαλήθευση Cloudflare δεν έχει ρυθμιστεί. Επικοινώνησε με την υποστήριξη.');
        }
      }).catch(()=>{
        if(!mounted)return;
        setSiteKey('');
        setTurnstileError('Η επαλήθευση Cloudflare δεν φορτώθηκε. Ανανέωσε τη σελίδα.');
      });
    return()=>{mounted=false};
  },[baseUrl]);
  return {siteKey,turnstileError};
}
