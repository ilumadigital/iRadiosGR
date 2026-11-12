import React,{useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import StationEmbed from './StationEmbed';

const inFrame=()=>{
  try{return window.self!==window.top;}catch{return true;}
};

// Public iframe embeds always work without credentials. Top-level navigation
// is a *separate* 3-minute preview capability, issued through Station Console.
// A user can always embed the public iframe on a website: this restriction
// deliberately does not claim to make publicly embeddable media uncopyable.
export default function WidgetEmbedAccess(){
  const {variant,stationId}=useParams();
  const embedded=inFrame();
  const [access,setAccess]=useState(embedded?'allowed':'checking');
  useEffect(()=>{
    if(embedded)return undefined;
    let alive=true,controller=null;
    const storageKey='iradios.widget.preview:'+variant+':'+stationId;
    const received=new URLSearchParams(window.location.hash.slice(1)).get('preview');
    if(received){
      // Fragment never reaches the web server or referrer; remove it from the
      // visible address immediately. Keep capability in tab-local storage only.
      window.history.replaceState(window.history.state,'',
        window.location.pathname+window.location.search);
      try{window.sessionStorage.setItem(storageKey,received);}catch{}
    }
    let token=received;
    try{token=token||window.sessionStorage.getItem(storageKey)||'';}catch{}
    if(!token||token.length>1200){
      setAccess('denied');
      return undefined;
    }
    setAccess('checking');
    const revoke=()=>{
      try{window.sessionStorage.removeItem(storageKey);}catch{}
      if(alive)setAccess('denied');
    };
    const check=async()=>{
      controller?.abort();
      controller=new AbortController();
      try{
        const response=await fetch('/api/widget-previews/verify',{
          method:'POST',cache:'no-store',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({token,variant,stationId}),
          signal:controller.signal
        });
        if(!alive||controller.signal.aborted)return;
        if(!response.ok)return revoke();
        const result=await response.json();
        if(result?.valid===true)setAccess('allowed');
        else revoke();
      }catch{
        if(alive&&!controller?.signal.aborted)revoke();
      }
    };
    void check();
    // Re-check continuously: after three minutes the station player unmounts
    // and playback stops, including when the tab remains open.
    const timer=window.setInterval(check,10000);
    const visible=()=>{if(!document.hidden)void check();};
    window.addEventListener('pageshow',visible);
    document.addEventListener('visibilitychange',visible);
    return()=>{
      alive=false;controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('pageshow',visible);
      document.removeEventListener('visibilitychange',visible);
    };
  },[embedded,variant,stationId]);
  if(access==='allowed')return <StationEmbed/>;
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#101315] p-8 text-center text-zinc-200">
    <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
      <h1 className="text-xl font-black">
        {access==='checking'?'Έλεγχος προσωρινής προεπισκόπησης…':'Η προεπισκόπηση δεν είναι διαθέσιμη'}
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        {access==='checking'?'Ελέγχουμε την προσωρινή πρόσβασή σου.':
          'Το Νέο tab ανοίγει αποκλειστικά από το Station Widgets Configurator και ισχύει για 3 λεπτά. Το κανονικό iframe συνεχίζει να λειτουργεί χωρίς token.'}
      </p>
    </div>
  </main>;
}
