import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Helmet} from 'react-helmet-async';
import {Activity,ArrowRight,AudioLines,Check,ChevronDown,Crown,Headphones,
  Pause,Play,Radio,ShieldCheck,Sparkles,Volume2,Waveform,Zap} from 'lucide-react';
import {DSP_DEFAULTS,DSP_COMPRESSOR_DEFAULTS,normalizeBroadcasterMode,
  createDSPGraph,applyDSPGraph,applyListenerMode,updateAdaptiveDSP,resetAdaptiveDSP,
  measurePeakDbfs} from '../utils/dspEngine';

// New headline on refresh, with immediate-repeat avoidance per browser session.
// The broadcaster's actual station name comes only from the scoped API response.
const HEADLINES=[
  name=>'Ο '+name+' μπορεί να ακουστεί καλύτερα.',
  name=>'Φαντάσου τον '+name+' να ακούγεται... κόκκαλο!',
  name=>'Ο '+name+' όπως τον ξέρεις. Αλλά όχι όπως τον έχεις ακούσει.',
  name=>'Μη φαντάζεσαι τη διαφορά στον '+name+'. Άκουσέ την.',
  name=>'Ο '+name+' έχει χαρακτήρα. Δώσε του και τον ήχο που αξίζει.',
  name=>'Πώς θα ακουγόταν ο '+name+' με WebDSP; Πάτα Play.',
  name=>'Μια νέα ηχητική εμπειρία περιμένει τον '+name+'.',
  name=>'Τον '+name+' τον ξέρεις. Τον ήχο του, όχι ακόμη.'
];
const HEADLINE_KEY='iradios-webdsp-preview-last-headline';
function chooseHeadline(){
  try{
    const last=Number(sessionStorage.getItem(HEADLINE_KEY));
    const current=Number.isInteger(last)&&last>=0&&last<HEADLINES.length?last:-1;
    const next=(current+1+Math.floor(Math.random()*(HEADLINES.length-1)))%HEADLINES.length;
    sessionStorage.setItem(HEADLINE_KEY,String(next));
    return next;
  }catch{return Math.floor(Math.random()*HEADLINES.length);}
}
const money=cents=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(Number(cents)/100);
const db=value=>value<=-119?'−∞':(value>0?'+':'')+value.toFixed(1)+' dB';
const surface='rounded-[28px] border border-white/10 bg-[#13191b]';
function drawWaveform(canvas,data,color){
  if(!canvas||!data)return;
  const context=canvas.getContext('2d');
  if(!context)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(w<1||h<1)return;
  const ratio=Math.min(2,window.devicePixelRatio||1);
  const cw=Math.round(w*ratio),ch=Math.round(h*ratio);
  if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
  context.setTransform(ratio,0,0,ratio,0,0);
  context.clearRect(0,0,w,h);
  context.strokeStyle='rgba(255,255,255,.12)';
  context.lineWidth=1;
  for(const y of [h*.17,h*.5,h*.83]){
    context.beginPath();context.moveTo(0,y);context.lineTo(w,y);context.stroke();
  }
  context.strokeStyle=color;
  context.lineWidth=1.5;
  context.beginPath();
  const width=Math.max(1,Math.floor(w));
  for(let x=0;x<width;x++){
    const sample=data[Math.min(data.length-1,Math.floor(x*data.length/width))];
    const y=h/2-sample*h*.43;
    if(x===0)context.moveTo(x,y);else context.lineTo(x,y);
  }
  context.stroke();
}
function SoundPanel({title,color,value,canvasRef}){
  return <div className="min-w-0 rounded-[25px] border border-white/10 bg-[#101416] p-4 md:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[.12em] text-zinc-300">
      <span>{title}</span><span className="tabular-nums" style={{color}}>{db(value)}</span>
    </div>
    <div className="relative h-[125px] overflow-hidden rounded-xl bg-black/40 md:h-[155px]">
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full"/>
    </div>
  </div>;
}
function SubscriptionCTA({station,price,kind='dsp',large=false}){
  const premium=kind==='premium';
  const href='/backoffice/pro-features?sku='+(premium?'B-PREM':'ADD-DSP')+
    '&station='+encodeURIComponent(station._id);
  return <Link to={href} className={'inline-flex items-center justify-center gap-2 rounded-2xl font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff00] '+
    (premium?'border border-white/20 bg-white/[.06] text-white hover:bg-white/15':
      'bg-[#caff00] text-[#111700] shadow-[0_14px_35px_rgba(202,255,0,.15)] hover:bg-[#e6ff8d] ')+
    (large?'px-6 py-4 text-sm':'px-5 py-3.5 text-xs')}>
    {premium?<Crown size={18}/>:<Zap size={18}/>}
    {premium?'Απόκτησε Broadcaster Premium':
      'Ενεργοποίησε WebDSP για τον '+station.name}
    <ArrowRight size={17}/>
    {price&&<span className="sr-only">{price} τον μήνα</span>}
  </Link>;
}

export default function BroadcasterWebDSPPreview({stations=[],API_URL='/api'}){
  // The parent backoffice supplies an authenticated, no-store, approved AND
  // unsubscribed station list. Never trust a URL station id as authorization.
  const [stationId,setStationId]=useState(stations[0]?._id||'');
  const [headlineIndex]=useState(chooseHeadline);
  const [playing,setPlaying]=useState(false);
  const [bypass,setBypass]=useState(false);
  const [meter,setMeter]=useState({before:-120,after:-120});
  const [error,setError]=useState('');
  const [catalog,setCatalog]=useState({});
  const audioRef=useRef(null),ctxRef=useRef(null),graphRef=useRef(null);
  const beforeRef=useRef(null),afterRef=useRef(null);
  const station=useMemo(()=>stations.find(s=>String(s._id)===String(stationId))||stations[0],
    [stations,stationId]);
  const liveStationId=station?._id||'';
  const price=sku=>catalog[sku]?money(catalog[sku].priceCents):null;
  const promoName=station?.name||'σταθμός σου';
  const stop=useCallback(()=>{
    audioRef.current?.pause();
    setPlaying(false);
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    fetch(API_URL+'/billing/catalog',{signal:controller.signal,cache:'no-store'})
      .then(r=>r.ok?r.json():Promise.reject(Error('catalog unavailable')))
      .then(body=>{if(!controller.signal.aborted)
        setCatalog(Object.fromEntries((body.products||[]).map(item=>[item.sku,item])));})
      .catch(()=>{});
    return()=>controller.abort();
  },[API_URL]);

  // A switch is a hard stream boundary, not a second simultaneous audio feed.
  useEffect(()=>{
    const audio=audioRef.current;
    if(audio){
      audio.pause();audio.removeAttribute('src');delete audio.dataset.stationId;audio.load();
    }
    setPlaying(false);setBypass(false);setMeter({before:-120,after:-120});setError('');
    resetAdaptiveDSP(graphRef.current);
  },[liveStationId]);

  useEffect(()=>()=>{audioRef.current?.pause();
    if(ctxRef.current&&ctxRef.current.state!=='closed')ctxRef.current.close().catch(()=>{});
  },[]);

  const apply=useCallback((dry)=>{
    const graph=graphRef.current;
    if(!graph||!station)return;
    applyDSPGraph(graph,normalizeBroadcasterMode(station.dspPreset||'AUTO_MODE'),
      station.dspSettings||DSP_DEFAULTS,station.dspCompressor||DSP_COMPRESSOR_DEFAULTS,
      dry,station.dspClipper,station.dspAutoBalance||0);
    applyListenerMode(graph,'DEFAULT');
  },[station]);

  useEffect(()=>{apply(bypass);},[apply,bypass]);

  const togglePlayback=async()=>{
    if(playing){stop();return;}
    if(!station||station.isOffline||!station.stream){
      setError('Το stream του σταθμού δεν είναι διαθέσιμο αυτή τη στιγμή.');return;
    }
    const audio=audioRef.current;
    if(!audio)return;
    setError('');
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)throw Error('Ο browser δεν υποστηρίζει Web Audio.');
      if(!graphRef.current){
        const ctx=new Ctx({latencyHint:'interactive'});
        ctxRef.current=ctx;
        graphRef.current=createDSPGraph(ctx,ctx.createMediaElementSource(audio));
      }
      apply(bypass);
      if(audio.dataset.stationId!==String(station._id)||!audio.src){
        audio.src=API_URL+'/proxy-stream?url='+encodeURIComponent(station.stream);
        audio.dataset.stationId=String(station._id);
      }
      audio.volume=1;
      await Promise.all([ctxRef.current.resume(),audio.play()]);
      setPlaying(true);
    }catch(err){
      stop();setError('Δεν ξεκίνησε το Preview: '+(err.message||'Αδυναμία σύνδεσης στο stream.')+
        '. Έλεγξε την προσβασιμότητα του stream.');
    }
  };
  const toggleBypass=()=>{
    const next=!bypass;
    apply(next);setBypass(next);
  };
  useEffect(()=>{
    if(!playing||!graphRef.current)return;
    const graph=graphRef.current;
    const pre=new Float32Array(graph.beforePeak.fftSize);
    const post=new Float32Array(graph.postPeak.fftSize);
    const actual=new Float32Array(graph.afterPeak.fftSize);
    let frame=0,lastDraw=0,lastMeter=0,active=true;
    const tick=time=>{
      if(!active)return;
      const inAnalyser=bypass?graph.afterPeak:graph.beforePeak;
      const outAnalyser=bypass?graph.afterPeak:graph.postPeak;
      if(time-lastDraw>=33){
        inAnalyser.getFloatTimeDomainData(bypass?actual:pre);
        outAnalyser.getFloatTimeDomainData(bypass?actual:post);
        drawWaveform(beforeRef.current,bypass?actual:pre,'#fb7185');
        drawWaveform(afterRef.current,bypass?actual:post,'#caff00');
        lastDraw=time;
      }
      if(time-lastMeter>=90){
        if(!bypass&&graph.preset==='AUTO_MODE')updateAdaptiveDSP(graph);
        setMeter({before:measurePeakDbfs(inAnalyser,bypass?actual:pre),
          after:measurePeakDbfs(outAnalyser,bypass?actual:post)});
        lastMeter=time;
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{active=false;cancelAnimationFrame(frame);};
  },[playing,bypass,liveStationId]);

  if(!station)return null; // Parent controls the route/menu using fresh entitlement checks.
  return <div className="mx-auto max-w-[1340px] space-y-6 pb-16 text-white">
    <Helmet><title>{station.name} | Hear the WebDSP Difference · iRadiosGR</title></Helmet>
    <header className="relative isolate overflow-hidden rounded-[34px] border border-[#caff00]/20 bg-gradient-to-br from-[#27321c] via-[#171e1d] to-[#090c0d] p-6 shadow-[0_30px_100px_rgba(0,0,0,.25)] md:p-10 lg:p-12">
      <div className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full bg-[#caff00]/10 blur-[90px]"/>
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#caff00]/25 bg-[#caff00]/10 px-4 py-2 text-[10px] font-black tracking-[.2em] text-[#caff00]">
          <AudioLines size={15}/> IRADIOS · YOUR SOUND UPGRADED
        </span>
        <span className="inline-flex items-center gap-2 text-xs font-bold text-zinc-300"><ShieldCheck size={17} className="text-[#caff00]"/> Δοκιμή χωρίς αγορά</span>
      </div>
      <div className="relative mt-8 grid items-center gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
        <div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.1] tracking-[-.055em] md:text-5xl xl:text-6xl">
            {HEADLINES[headlineIndex](promoName)}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-300 md:text-base">
            Preview your stream with our WebDSP Addon. Άκου τον πραγματικό ήχο του
            <strong className="text-white"> {promoName}</strong> πριν και μετά την επεξεργασία.
            Οι ρυθμίσεις είναι αυτές που έχει επιλέξει ο διαχειριστής του iRadios.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <SubscriptionCTA station={station} price={price('ADD-DSP')} large/>
            <Link to={'/backoffice/pro-features?sku=B-PREM&station='+encodeURIComponent(station._id)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-5 py-4 text-xs font-black text-white transition hover:bg-white/10">
              Δες το Broadcaster Premium <ArrowRight size={17}/></Link>
          </div>
        </div>
        <div className="relative rounded-[27px] border border-white/15 bg-black/25 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#1f2929]">
              {station.logo?<img src={station.logo} alt="" className="h-full w-full object-contain p-1"/>:<Radio size={27} className="text-[#caff00]"/>}
            </div>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-zinc-400">YOUR STATION</p>
              <p className="mt-1 truncate text-lg font-black">{station.name}</p></div>
            <span className="ml-auto rounded-full bg-[#caff00]/10 px-3 py-1 text-[10px] font-black text-[#caff00]">APPROVED</span>
          </div>
          {stations.length>1&&<label className="relative mt-5 block">
            <span className="mb-2 block text-[11px] font-bold text-zinc-300">Άκου άλλον δικό σου σταθμό</span>
            <select value={station._id} onChange={event=>setStationId(event.target.value)}
              className="w-full appearance-none rounded-xl border border-white/20 bg-[#131919] px-4 py-3.5 pr-10 text-sm font-bold text-white focus:border-[#caff00] focus:outline-none">
              {stations.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
            </select><ChevronDown size={17} className="pointer-events-none absolute bottom-4 right-4 text-[#caff00]"/>
          </label>}
          <p className="mt-5 text-xs leading-6 text-zinc-400">
            Η δοκιμή είναι προσωπική. Οι ακροατές σου συνεχίζουν να ακούν τον αρχικό ήχο μέχρι να ενεργοποιηθεί η συνδρομή.</p>
        </div>
      </div>
    </header>

    <section className={surface+' p-5 md:p-8'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#caff00]">LIVE SOUND EXPERIENCE</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-.04em] md:text-3xl">Άκου τη διαφορά. Στο δικό σου stream.</h2>
          <p className="mt-2 text-sm text-zinc-400">Δύο ήχοι, το ίδιο τραγούδι, η ίδια ακριβώς στιγμή.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-[11px] font-bold text-zinc-300">
          <span className={'size-2 rounded-full '+(playing?'animate-pulse bg-[#caff00]':'bg-zinc-600')}/>
          {playing?'LIVE PREVIEW':'READY TO LISTEN'}
        </span>
      </div>
      <audio ref={audioRef} crossOrigin="anonymous" preload="none" playsInline
        onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}
        onError={()=>{if(audioRef.current?.src)setError('Το stream δεν ανταποκρίνεται. Δοκίμασε ξανά.');}}/>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,.65fr)_minmax(0,1.35fr)]">
        <div className="flex flex-col justify-center gap-4 rounded-[25px] border border-[#caff00]/15 bg-[#1d2921] p-5">
          <button type="button" onClick={()=>void togglePlayback()} disabled={station.isOffline}
            className="flex items-center gap-4 rounded-2xl border border-[#caff00]/20 bg-[#caff00]/10 p-4 text-left transition hover:bg-[#caff00]/20 disabled:cursor-not-allowed disabled:opacity-40">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#caff00] text-[#101600]">
              {playing?<Pause size={25} fill="currentColor"/>:<Play size={25} fill="currentColor"/>}
            </span>
            <span className="min-w-0"><span className="block text-lg font-black">{playing?'Pause Preview':'Play Live Preview'}</span>
              <span className="mt-1 block text-[11px] text-zinc-300">{playing?'Ο ήχος σου παίζει live':'Ξεκίνα να ακούς τον '+station.name}</span></span>
          </button>
          <button type="button" onClick={toggleBypass} aria-pressed={bypass}
            className={'flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition '+
              (bypass?'border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15':
                'border-[#caff00]/25 bg-[#caff00]/10 text-[#d9ff7e] hover:bg-[#caff00]/20')}>
            <span className="flex items-center gap-3"><Volume2 size={21}/>
              <span className="text-sm font-black">{bypass?'Ακούς χωρίς DSP · BYPASS':'Ακούς με το WebDSP'}</span></span>
            <span className="rounded-lg border border-current/20 px-2 py-1 text-[10px] font-black">{bypass?'FX OFF':'FX ON'}</span>
          </button>
          <p className="text-xs leading-6 text-zinc-400">
            Πάτησε το δεύτερο κουμπί για άμεση εναλλαγή, χωρίς να σταματήσει το τραγούδι.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SoundPanel title="BEFORE · EQ / STEREO / COMP" color="#fb7185" value={meter.before} canvasRef={beforeRef}/>
          <SoundPanel title="AFTER · BOOSTER / HEADROOM" color="#caff00" value={meter.after} canvasRef={afterRef}/>
        </div>
      </div>
      {bypass&&<p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs font-bold text-zinc-300">
        BYPASS ενεργό · τα δύο γραφήματα δείχνουν τον ίδιο, μη επεξεργασμένο ήχο.</p>}
      {error&&<p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
      <p className="mt-4 text-[11px] leading-5 text-zinc-500">Οι κυματομορφές προέρχονται από το live Web Audio stream. Οι ενδείξεις είναι sample peaks, όχι πιστοποιημένη true-peak μέτρηση.</p>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <div className={surface+' p-6 md:p-8'}>
        <div className="flex items-center gap-2 text-[#caff00]"><Sparkles size={20}/><span className="text-[11px] font-black uppercase tracking-wider">UNLOCK YOUR SIGNATURE SOUND</span></div>
        <h2 className="mt-4 text-3xl font-black tracking-[-.04em]">300+ συνδυασμοί ρυθμίσεων. Ένας ήχος που είναι δικός σου.</h2>
        <p className="mt-4 text-sm leading-7 text-zinc-300">
          Ρύθμισε τον ήχο όπως θέλεις ή άφησε το Auto Mode να αναλάβει. EQ,
          stereo expander, δυναμική επεξεργασία, Booster και αυτόματο headroom.
          Όλα διαθέσιμα στον πλήρη WebDSP editor μετά την ενεργοποίηση.</p>
        <div className="mt-6 flex flex-wrap gap-2">{['AUTO MODE','FM MODE','ENHANCER','LIVE MONITORING','MASTER PEAK CONTROL'].map(tag=>
          <span key={tag} className="rounded-full border border-white/10 bg-white/[.05] px-3 py-2 text-[10px] font-black text-zinc-300">{tag}</span>)}</div>
      </div>
      <div className="rounded-[28px] border border-[#caff00]/25 bg-gradient-to-br from-[#28351f] to-[#121a17] p-6 md:p-8">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#caff00]">ΑΥΤΟ ΠΟΥ ΑΚΟΥΣ ΕΙΝΑΙ ΕΤΟΙΜΟ</p>
        <h2 className="mt-4 text-3xl font-black tracking-[-.04em]">Ενεργοποίησέ το για τον {station.name}.</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          Η εφαρμογή WebDSP στους ακροατές του iRadios γίνεται αποκλειστικά με ενεργή μηνιαία συνδρομή WebDSP ή Broadcaster Premium, μετά την επιβεβαίωση της πληρωμής.</p>
        <p className="mt-6 text-3xl font-black text-[#caff00]">{price('ADD-DSP')||'—'}<span className="ml-2 text-sm font-medium text-zinc-400">/ μήνα / σταθμό</span></p>
        <div className="mt-4"><SubscriptionCTA station={station} large/></div>
        <div className="mt-5 border-t border-white/15 pt-5">
          <div className="flex items-center gap-2 text-sm font-bold"><Crown size={18} className="text-[#caff00]"/> Ή Broadcaster Premium</div>
          <p className="mt-2 text-xl font-black">{price('B-PREM')||'—'} <span className="text-sm font-normal text-zinc-400">/ μήνα / λογαριασμό</span></p>
          <div className="mt-4"><SubscriptionCTA station={station} kind="premium"/></div>
        </div>
        <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-zinc-400"><Check size={15} className="mt-0.5 shrink-0 text-[#caff00]"/> Τιμές καταλόγου με ΦΠΑ. Οι αγορές και οι ανανεώσεις γίνονται από το ασφαλές Billing checkout.</p>
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[25px] border border-white/10 bg-[#101516] p-6">
      <div className="flex items-center gap-3"><Headphones size={24} className="text-[#caff00]"/>
        <div><p className="text-base font-black">Δεν χρειάζεται να μαντεύεις αν αξίζει.</p>
          <p className="mt-1 text-xs text-zinc-400">Άκου πρώτα τη διαφορά στον {station.name}. Μετά αποφασίζεις.</p></div></div>
      <SubscriptionCTA station={station}/>
    </div>
  </div>;
}
