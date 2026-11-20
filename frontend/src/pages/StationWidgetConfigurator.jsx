import React,{useMemo,useState} from 'react';
import {Helmet} from 'react-helmet-async';
import {ArrowLeft,ArrowUpRight,Check,Code2,Copy,ExternalLink,LayoutGrid,Monitor,Radio,Smartphone,Square,Text,Volume2,Loader2} from 'lucide-react';
import {Link} from 'react-router-dom';

const WIDGETS=[
  {id:'player-square',name:'Player Square',info:'Premium player με εναλλαγή τραγουδιού / εκπομπής ανά 20″. Spotify/Apple Music μόνο με ενεργή συνδρομή σταθμού.',icon:Square,shape:'square'},
  {id:'player-mini',name:'Player Mini',info:'Compact player με το εξώφυλλο σε μικρό πλαίσιο και χρωματικό φόντο σταθμού.',icon:Volume2,shape:'mini'},
  {id:'program-square',name:'Program Square',info:'Τρέχουσα live εκπομπή και κουμπί για πλήρες πρόγραμμα με επιλογή ημέρας.',icon:LayoutGrid,shape:'square'},
  {id:'program-mini',name:'Program Mini',info:'Compact πρόγραμμα με φωτογραφία παραγωγού σε μικρό πλαίσιο, χρωματικό φόντο και live controls.',icon:Text,shape:'mini'},
  {id:'hero',name:'HERO 100vh',info:'Fullscreen Now Playing και εκπομπή ανά 20″, με πλήρες Πρόγραμμα και Playlist σε αναδυόμενες λίστες.',icon:Monitor,shape:'hero'}
];
const DEFAULT_SIZES={
  'player-square':{width:480,height:480,minHeight:260},
  'player-mini':{width:650,height:285,minHeight:180},
  'program-square':{width:480,height:480,minHeight:260},
  'program-mini':{width:650,height:285,minHeight:180},
  hero:{width:1060,height:720,minHeight:320}
};
function embedSnippet(url,shape,{widthAuto=true,heightAuto=true,width=480,height=480}={}){
  const widthCss=widthAuto
    ?shape==='hero'?'width:100%;':shape==='square'?
      'width:100%;max-width:480px;':'width:100%;max-width:650px;'
    :'width:'+width+'px;max-width:100%;';
  const heightCss=heightAuto?
    shape==='hero'?'height:100vh;height:100dvh;':
      shape==='square'?'height:auto;aspect-ratio:1/1;':'height:285px;':
    'height:'+height+'px;';
  const radius=shape==='hero'?'0':shape==='square'?'24px':'18px';
  return '<iframe\n  src="'+url+'"\n  title="iRadios Station Widget"\n'+
    '  loading="lazy"\n  allow="autoplay; encrypted-media"\n'+
    '  style="'+widthCss+heightCss+
    'display:block;border:0;border-radius:'+radius+';overflow:hidden;"\n></iframe>';
}
export default function StationWidgetConfigurator({stations=[]}){
  const approved=useMemo(()=>stations.filter(s=>s.status==='approved'),[stations]);
  const [stationId,setStationId]=useState('');
  const [kind,setKind]=useState('player-square');
  const [mobile,setMobile]=useState(false);
  const [widthAuto,setWidthAuto]=useState(true);
  const [heightAuto,setHeightAuto]=useState(true);
  const [width,setWidth]=useState(480);
  const [height,setHeight]=useState(480);
  const [autoplay,setAutoplay]=useState(false);
  const [opening,setOpening]=useState(false);
  const [previewError,setPreviewError]=useState('');
  const [copied,setCopied]=useState(false);
  const station=approved.find(s=>s._id===stationId)||approved[0];
  const widget=WIDGETS.find(item=>item.id===kind)||WIDGETS[0];
  const origin=typeof window==='undefined'?'':window.location.origin;
  const previewUrl=station?
    origin+'/widget-embed/'+widget.id+'/'+encodeURIComponent(station.slug||station._id)+
    (autoplay?'?autoplay=1':''):'';
  const code=previewUrl?embedSnippet(previewUrl,widget.shape,{
    widthAuto,heightAuto,width,height
  }):'';
  const square=widget.shape==='square',hero=widget.shape==='hero';
  const sizes=DEFAULT_SIZES[widget.id];
  const maxWidth=mobile?390:hero?1060:square?480:650;
  const previewWidth=widthAuto?maxWidth:Math.min(width,mobile?390:1800);
  const previewHeight=heightAuto?(mobile?(hero?720:square?390:285):
    hero?600:square?480:285):height;
  async function openTemporaryPreview(){
    if(!station||opening)return;
    setPreviewError('');
    // Open synchronously from the click so Safari/Chrome popup blockers do
    // not turn the authenticated async token request into a blocked popup.
    const tab=window.open('about:blank','_blank');
    if(!tab){setPreviewError('Επέτρεψε τα αναδυόμενα παράθυρα για το preview.');return;}
    try{tab.opener=null;}catch{}
    setOpening(true);
    try{
      const token=localStorage.getItem('iluma_token');
      if(!token)throw new Error('Απαιτείται σύνδεση στο Station Console.');
      const response=await fetch('/api/backoffice/widget-previews',{
        method:'POST',cache:'no-store',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({stationId:String(station._id),variant:widget.id})
      });
      const data=await response.json();
      if(!response.ok||typeof data?.token!=='string')
        throw new Error(data?.error||'Δεν ήταν δυνατή η δημιουργία preview.');
      const path='/widget-embed/'+encodeURIComponent(widget.id)+'/'+
        encodeURIComponent(station._id)+(autoplay?'?autoplay=1':'');
      // A fragment is not included in HTTP requests or referrers; the new tab
      // consumes it immediately, keeps it in sessionStorage and removes the URL hash.
      if(!tab.closed)tab.location.replace(origin+path+'#preview='+encodeURIComponent(data.token));
    }catch(error){
      if(!tab.closed)tab.close();
      setPreviewError(error.message||'Το προσωρινό preview δεν άνοιξε.');
    }finally{setOpening(false);}
  }
  async function copyCode(){
    if(!code)return;
    try{
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),2300);
    }catch{
      const field=document.getElementById('iradios-widget-code');
      if(field){field.focus();field.select();document.execCommand('copy');setCopied(true);}
    }
  }
  if(!station)return <div className="mx-auto max-w-2xl rounded-[30px] border border-violet-400/20 bg-[#16121e] p-10 text-center">
    <Radio className="mx-auto mb-5 text-violet-400" size={36}/>
    <h1 className="text-2xl font-black">Station Widgets</h1>
    <p className="mt-3 text-sm leading-7 text-zinc-400">Τα Widgets γίνονται διαθέσιμα μόλις προστεθεί και εγκριθεί ένας σταθμός σου.</p>
    <Link to="/backoffice/stations" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-black text-white"><ArrowLeft size={16}/> Οι σταθμοί μου</Link>
  </div>;
  return <div className="mx-auto max-w-[1380px] space-y-7 pb-16">
    <Helmet><title>Station Widgets Configurator · iRadiosGR</title></Helmet>
    <header className="relative isolate overflow-hidden rounded-[32px] border border-violet-400/20 bg-gradient-to-br from-[#2c1949] via-[#171322] to-[#101116] p-6 shadow-[0_22px_90px_rgba(0,0,0,.2)] md:p-10">
      <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-violet-400/10 blur-[75px]"/>
      <div className="relative">
        <Link to="/backoffice" className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-violet-200/80 hover:text-white"><ArrowLeft size={15}/> Station Console</Link>
        <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.24em] text-violet-300"><Code2 size={15}/> iRadios / Widgets</p>
        <h1 className="text-3xl font-black tracking-[-.05em] text-white md:text-5xl">Station <span className="text-violet-400">Widgets Configurator</span></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">Διάλεξε έναν από τους πέντε τύπους, έλεγξε τη ζωντανή προεπισκόπηση και αντέγραψε τον έτοιμο κώδικα για το website του σταθμού σου.</p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1.5 text-[10px] font-black text-violet-200">5 WIDGETS · LIVE DATA · RESPONSIVE</span>
      </div>
    </header>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,440px)_minmax(0,1fr)]">
      <section className="space-y-5 rounded-[28px] border border-white/10 bg-[#111519] p-5 md:p-7">
        <div>
          <label htmlFor="widget-station" className="mb-2 block text-[11px] font-black uppercase tracking-widest text-zinc-400">Σταθμός</label>
          <select id="widget-station" value={station._id} onChange={e=>{setStationId(e.target.value);setCopied(false);}}
            className="w-full rounded-xl border border-white/10 bg-[#080a0e] px-4 py-3 text-sm font-bold text-white outline-none focus:border-violet-400">
            {approved.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-zinc-400">Επιλογή Widget</h2>
          <div className="space-y-2">
            {WIDGETS.map(item=><button type="button" key={item.id} onClick={()=>{
              setKind(item.id);
              setWidth(DEFAULT_SIZES[item.id].width);
              setHeight(DEFAULT_SIZES[item.id].height);
              setWidthAuto(true);setHeightAuto(true);
              setCopied(false);setPreviewError('');
            }}
              aria-pressed={kind===item.id}
              className={'flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition '+(kind===item.id?
                'border-violet-400/70 bg-violet-500/15 shadow-[0_8px_32px_rgba(139,92,246,.1)]':
                'border-white/10 bg-white/[.025] hover:border-violet-400/30 hover:bg-white/[.05]')}>
              <span className={'flex size-10 shrink-0 items-center justify-center rounded-xl '+(kind===item.id?'bg-violet-500 text-white':'bg-white/5 text-zinc-400')}><item.icon size={19}/></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-white">{item.name}</span>
                <span className="mt-1 block text-[11px] leading-5 text-zinc-400">{item.info}</span>
              </span>
              {kind===item.id&&<Check size={18} className="mt-2 shrink-0 text-violet-300"/>}
            </button>)}
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-violet-400/15 bg-[#090b10] p-4">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-violet-300">
            Διαστάσεις & Αναπαραγωγή
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="widget-width" className="text-xs font-bold text-zinc-200">Width</label>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <input type="checkbox" checked={widthAuto}
                  onChange={event=>{setWidthAuto(event.target.checked);setCopied(false);}}
                  className="accent-violet-500"/> Auto
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input type="range" id="widget-width" min="260" max="1800" step="10"
                disabled={widthAuto} value={width}
                onChange={event=>{setWidth(Number(event.target.value));setCopied(false);}}
                className="min-w-0 flex-1 accent-violet-500 disabled:opacity-30"/>
              <output htmlFor="widget-width" className="w-16 text-right text-xs font-black text-white">
                {widthAuto?'Auto':width+' px'}
              </output>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="widget-height" className="text-xs font-bold text-zinc-200">Height</label>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <input type="checkbox" checked={heightAuto}
                  onChange={event=>{setHeightAuto(event.target.checked);setCopied(false);}}
                  className="accent-violet-500"/> Auto
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input type="range" id="widget-height" min={sizes.minHeight} max="1500" step="10"
                disabled={heightAuto} value={height}
                onChange={event=>{setHeight(Number(event.target.value));setCopied(false);}}
                className="min-w-0 flex-1 accent-violet-500 disabled:opacity-30"/>
              <output htmlFor="widget-height" className="w-16 text-right text-xs font-black text-white">
                {heightAuto?'Auto':height+' px'}
              </output>
            </div>
            <p className="text-[10px] text-zinc-500">
              {hero?'Auto: πλήρες ύψος οθόνης (100dvh).':
                square?'Auto: τετράγωνο με αναλογία 1:1.':'Auto: ύψος 285px.'}
            </p>
          </div>
          <div className="border-t border-white/10 pt-3">
            <label className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-xs font-black text-white">Autoplay</span>
                <span className="mt-1 block text-[11px] leading-5 text-zinc-400">
                  Προσπάθεια αυτόματης εκκίνησης με τη φόρτωση. Αν ο browser μπλοκάρει
                  τον ήχο, χρειάζεται πάτημα Play.
                </span>
              </span>
              <input type="checkbox" checked={autoplay}
                onChange={event=>{setAutoplay(event.target.checked);setCopied(false);}}
                className="mt-1 size-4 shrink-0 accent-violet-500"/>
            </label>
          </div>
        </div>
        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[.06] p-4">
          <p className="text-xs font-bold text-violet-200">Υποχρεωτικό backlink</p>
          <p className="mt-1 text-[11px] leading-5 text-zinc-400">Κάθε widget περιλαμβάνει ορατό σύνδεσμο προς το δημόσιο station profile του {station.name} στο iRadios.</p>
        </div>
      </section>
      <section className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111519] p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Live Preview</h2>
              <p className="mt-1 text-xs text-zinc-500">{widget.name} · {station.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={()=>setMobile(false)} aria-label="Desktop Preview" aria-pressed={!mobile}
                className={'rounded-xl border p-2.5 '+(!mobile?'border-violet-400 bg-violet-500/20 text-violet-200':'border-white/10 text-zinc-400')}><Monitor size={17}/></button>
              <button type="button" onClick={()=>setMobile(true)} aria-label="Mobile Preview" aria-pressed={mobile}
                className={'rounded-xl border p-2.5 '+(mobile?'border-violet-400 bg-violet-500/20 text-violet-200':'border-white/10 text-zinc-400')}><Smartphone size={17}/></button>
              <button type="button" onClick={openTemporaryPreview} disabled={opening}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 text-[11px] font-black text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50">
                {opening?<Loader2 size={15} className="animate-spin"/>:<ExternalLink size={15}/>}
                Νέο tab · 3 λεπτά
              </button>
            </div>
          </div>
          <div className="flex w-full justify-center overflow-x-auto rounded-2xl border border-white/5 bg-[#07090c] px-2 py-6 md:px-5">
            <iframe key={previewUrl} src={previewUrl} title={'Live widget preview: '+widget.name}
              allow="autoplay; encrypted-media" loading="eager"
              style={{width:'100%',maxWidth:previewWidth,height:previewHeight,border:0,borderRadius:hero?22:20,display:'block',background:'#101315'}}/>
          </div>
          {previewError&&<p role="alert" className="mt-3 text-xs font-semibold text-amber-300">{previewError}</p>}
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">
            Το Νέο tab απαιτεί προσωρινή εξουσιοδότηση και κλείνει μετά από 3 λεπτά.
            Το iframe παραμένει δημόσιο χωρίς token. Το autoplay με ήχο εξαρτάται από
            την πολιτική του browser. Τα Mini έχουν χρωματικό φόντο, ενώ τα Square/HERO artwork.
          </p>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111519] p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-black text-white">Κώδικας ενσωμάτωσης</h2>
              <p className="mt-1 text-[11px] text-zinc-500">Έτοιμο responsive HTML iframe για αντιγραφή.</p></div>
            <button type="button" onClick={openTemporaryPreview} disabled={opening}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-violet-100 disabled:opacity-50">
              Προβολή 3′ <ArrowUpRight size={14}/>
            </button>
          </div>
          <textarea id="iradios-widget-code" readOnly rows={7} value={code}
            aria-label="HTML κώδικας widget" className="w-full resize-none rounded-2xl border border-white/10 bg-[#06080c] p-4 font-mono text-[11px] leading-6 text-zinc-300 outline-none focus:border-violet-400"/>
          <button type="button" onClick={copyCode}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-violet-400">
            {copied?<><Check size={17}/> Αντιγράφηκε</>:<><Copy size={17}/> Αντιγραφή κώδικα</>}
          </button>
        </div>
      </section>
    </div>
  </div>;
}
