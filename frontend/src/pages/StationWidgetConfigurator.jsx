import React,{useMemo,useState} from 'react';
import {Helmet} from 'react-helmet-async';
import {ArrowLeft,ArrowUpRight,Check,Code2,Copy,ExternalLink,LayoutGrid,Monitor,Radio,Smartphone,Square,Text,Volume2} from 'lucide-react';
import {Link} from 'react-router-dom';

const WIDGETS=[
  {id:'player-square',name:'Player Square',info:'Premium player με εναλλαγή τραγουδιού / εκπομπής ανά 20″. Spotify/Apple Music μόνο με ενεργή συνδρομή σταθμού.',icon:Square,shape:'square'},
  {id:'player-mini',name:'Player Mini',info:'Compact player με το εξώφυλλο σε μικρό πλαίσιο και χρωματικό φόντο σταθμού.',icon:Volume2,shape:'mini'},
  {id:'program-square',name:'Program Square',info:'Τρέχουσα live εκπομπή και κουμπί για πλήρες πρόγραμμα με επιλογή ημέρας.',icon:LayoutGrid,shape:'square'},
  {id:'program-mini',name:'Program Mini',info:'Compact πρόγραμμα με φωτογραφία παραγωγού σε μικρό πλαίσιο, χρωματικό φόντο και live controls.',icon:Text,shape:'mini'},
  {id:'hero',name:'HERO 100vh',info:'Fullscreen Now Playing και εκπομπή ανά 20″, με πλήρες Πρόγραμμα και Playlist σε αναδυόμενες λίστες.',icon:Monitor,shape:'hero'}
];
function embedSnippet(url,shape){
  const attrs=shape==='hero'
    ?'width:100%;height:100vh;height:100dvh;display:block;border:0;'
    :shape==='square'
      ?'width:100%;max-width:480px;aspect-ratio:1/1;display:block;border:0;border-radius:24px;overflow:hidden;'
      :'width:100%;max-width:650px;height:285px;display:block;border:0;border-radius:18px;overflow:hidden;';
  return '<iframe\n  src="'+url+'"\n  title="iRadios Station Widget"\n  loading="lazy"\n  allow="autoplay; encrypted-media"\n  style="'+attrs+'"\n></iframe>';
}
export default function StationWidgetConfigurator({stations=[]}){
  const approved=useMemo(()=>stations.filter(s=>s.status==='approved'),[stations]);
  const [stationId,setStationId]=useState('');
  const [kind,setKind]=useState('player-square');
  const [mobile,setMobile]=useState(false);
  const [copied,setCopied]=useState(false);
  const station=approved.find(s=>s._id===stationId)||approved[0];
  const widget=WIDGETS.find(item=>item.id===kind)||WIDGETS[0];
  const origin=typeof window==='undefined'?'':window.location.origin;
  const previewUrl=station?
    origin+'/widget-embed/'+widget.id+'/'+encodeURIComponent(station.slug||station._id):'';
  const code=previewUrl?embedSnippet(previewUrl,widget.shape):'';
  const square=widget.shape==='square',hero=widget.shape==='hero';
  const previewWidth=mobile?390:hero?1060:square?480:650;
  const previewHeight=mobile?(hero?720:square?390:285):hero?600:square?480:285;
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
            {WIDGETS.map(item=><button type="button" key={item.id} onClick={()=>{setKind(item.id);setCopied(false);}}
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
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 text-[11px] font-black text-violet-200 transition hover:bg-violet-500/20">
                <ExternalLink size={15}/> Νέο tab
              </a>
            </div>
          </div>
          <div className="flex w-full justify-center overflow-x-auto rounded-2xl border border-white/5 bg-[#07090c] px-2 py-6 md:px-5">
            <iframe key={previewUrl} src={previewUrl} title={'Live widget preview: '+widget.name}
              allow="autoplay; encrypted-media" loading="eager"
              style={{width:'100%',maxWidth:previewWidth,height:previewHeight,border:0,borderRadius:hero?22:20,display:'block',background:'#101315'}}/>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">Τα Mini χρησιμοποιούν χρωματικό φόντο και μικρή φωτογραφία τραγουδιού ή παραγωγού (με fallback στο station logo). Τα Square και HERO διατηρούν το artwork background. Όλα τα widgets είναι Dark. Ο ήχος ξεκινά μόνο με Play. Το HERO έχει ύψος 100dvh.</p>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111519] p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-black text-white">Κώδικας ενσωμάτωσης</h2>
              <p className="mt-1 text-[11px] text-zinc-500">Έτοιμο responsive HTML iframe για αντιγραφή.</p></div>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-violet-100">Προβολή <ArrowUpRight size={14}/></a>
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
