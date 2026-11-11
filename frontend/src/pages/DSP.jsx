import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Activity,AlertTriangle,CheckCircle2,Headphones,Pause,Play,RotateCcw,
  Save,Search,SlidersHorizontal,Volume2,PowerOff} from 'lucide-react';
import {DSP_DEFAULTS,DSP_MODES,normalizeBroadcasterMode,DSP_COMPRESSOR_DEFAULTS,PEAK_WARNING_DBFS,
  normalizeDSPSettings,normalizeDSPCompressor,normalizeDSPClipper,compressorForPreset,calculateHeadroomDb,
  createDSPGraph,applyDSPGraph,measurePeakDbfs} from '../utils/dspEngine';

const blank=()=>({dspPreset:'OFF',dspSettings:{...DSP_DEFAULTS},
  dspCompressor:{...DSP_COMPRESSOR_DEFAULTS},dspClipper:normalizeDSPClipper()});
const fromStation=station=>({
  dspPreset:normalizeBroadcasterMode(station?.dspPreset),
  dspSettings:normalizeDSPSettings(station?.dspSettings),
  dspCompressor:normalizeDSPCompressor(station?.dspCompressor),
  dspClipper:normalizeDSPClipper(station?.dspClipper)
});
const formatDb=value=>(value>0?'+':'')+value.toFixed(1)+' dB';
const meterWidth=value=>Math.max(0,Math.min(100,((value+60)/60)*100));
const shell='rounded-[26px] border border-white/10 bg-[#131719] shadow-lg';
const inputStyle='w-full accent-[#caff00] cursor-pointer';

function Fader({label,value,min,max,step=.5,sub,onChange}){
  return <div className="flex min-w-0 flex-col items-center rounded-[22px] border border-white/10 bg-[#0d1113] px-3 py-6 text-center">
    <div className="text-[11px] font-black uppercase tracking-[.12em] text-zinc-300">{label}</div>
    <div className="mt-3 text-xl font-extrabold text-white tabular-nums">{formatDb(value)}</div>
    <div className="mt-7 flex flex-1 flex-col items-center justify-center gap-2">
      <span className="text-[10px] text-zinc-500">+{max}</span>
      <input aria-label={label} type="range" min={min} max={max} step={step}
        value={value} onChange={event=>onChange(Number(event.target.value))}
        style={{writingMode:'vertical-lr',direction:'rtl',height:180,accentColor:'#c5d0d5'}}
        className="w-7 cursor-pointer"/>
      <span className="text-[10px] text-zinc-500">{min}</span>
    </div>
    <div className="mt-5 text-xs font-bold text-white">{sub[0]}</div>
    <div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500">{sub[1]}</div>
  </div>;
}
function PeakBar({label,db}){
  return <div className="space-y-2">
    <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
      <span>{label}</span><span className="tabular-nums">{db<=-119?'−∞':formatDb(db)}</span>
    </div>
    <div className="h-3 rounded-full bg-black/60 border border-white/10 overflow-hidden">
      <div className="h-full transition-[width] duration-100"
        style={{width:meterWidth(db)+'%',background:db>=PEAK_WARNING_DBFS?'#fb7185':'linear-gradient(90deg,#94a3b8,#caff00)'}}/>
    </div>
    <div className="flex justify-between text-[10px] text-zinc-500"><span>−60 dBFS</span><span>−0.4 dBFS · WARNING</span><span>0 dBFS · CLIP</span></div>
  </div>;
}
function drawWaveform(canvas,samples,color){
  if(!canvas||!samples)return;
  const context=canvas.getContext('2d');
  if(!context)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(w<1||h<1)return;
  const ratio=Math.min(2,window.devicePixelRatio||1),pixelW=Math.round(w*ratio),pixelH=Math.round(h*ratio);
  if(canvas.width!==pixelW||canvas.height!==pixelH){
    canvas.width=pixelW;canvas.height=pixelH;
  }
  context.setTransform(ratio,0,0,ratio,0,0);
  context.clearRect(0,0,w,h);
  context.strokeStyle='rgba(255,255,255,.12)';
  context.lineWidth=1;
  for(const y of [h*.15,h*.5,h*.85]){
    context.beginPath();context.moveTo(0,y);context.lineTo(w,y);context.stroke();
  }
  context.strokeStyle=color;
  context.lineWidth=1.5;
  context.beginPath();
  const half=h*.43,middle=h/2,columns=Math.max(1,Math.floor(w));
  for(let x=0;x<columns;x++){
    const index=Math.min(samples.length-1,Math.floor(x*samples.length/columns));
    const y=middle-samples[index]*half;
    if(x===0)context.moveTo(x,y);else context.lineTo(x,y);
  }
  context.stroke();
}
export default function DSP({API_URL='/api',currentUser,onUpdateDSP}){
  const [stations,setStations]=useState([]);
  const [stationId,setStationId]=useState('');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [retryCount,setRetryCount]=useState(0);
  const [error,setError]=useState('');
  const [draft,setDraft]=useState(blank);
  const [saved,setSaved]=useState(blank);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  const [bypass,setBypass]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [monitor,setMonitor]=useState(100);
  const [meter,setMeter]=useState({before:-120,after:-120,final:-120});
  const [gainReduction,setGainReduction]=useState(0);
  const audioRef=useRef(null);
  const graphRef=useRef(null);
  const ctxRef=useRef(null);
  const beforeWaveRef=useRef(null);
  const afterWaveRef=useRef(null);

  const station=useMemo(()=>stations.find(item=>String(item._id)===String(stationId)),
    [stations,stationId]);
  const filtered=useMemo(()=>stations.filter(item=>
    (item.name||'').toLocaleLowerCase().includes(search.toLocaleLowerCase())),[stations,search]);
  const needsMigration=Boolean(station&&station.dspPreset&&
    station.dspPreset!==normalizeBroadcasterMode(station.dspPreset));
  const dirty=JSON.stringify(draft)!==JSON.stringify(saved)||needsMigration;
  const displayedCompressor=draft.dspCompressor.mode==='preset'?
    compressorForPreset(draft.dspPreset):draft.dspCompressor;
  const activeMaster=draft.dspPreset==='OFF'?null:draft.dspClipper[draft.dspPreset];
  const automaticHeadroom=calculateHeadroomDb(draft.dspPreset,draft.dspSettings,draft.dspCompressor,draft.dspClipper);
  const token=()=>localStorage.getItem('iluma_token')||'';

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      setLoading(true);setError('');
      try{
        const res=await fetch(API_URL+'/stations/dsp-access',{
          headers:{Authorization:'Bearer '+token()},cache:'no-store'
        });
        const body=await res.json().catch(()=>({}));
        if(!res.ok)throw Error((body.error||body.message||'Δεν φορτώθηκαν οι σταθμοί WebDSP.')+
          ' (HTTP '+res.status+')');
        if(!Array.isArray(body))throw Error('Μη έγκυρη απάντηση WebDSP.');
        if(cancelled)return;
        setStations(body);
        const fromUrl=new URLSearchParams(window.location.search).get('station');
        setStationId(current=>body.find(s=>s._id===current)?current:
          (body.find(s=>s._id===fromUrl)?fromUrl:body[0]?._id||''));
      }catch(e){if(!cancelled){setStations([]);setError(e.message);}}
      finally{if(!cancelled)setLoading(false);}
    }
    if(currentUser?.role==='admin'||currentUser?.role==='broadcaster')load();
    else {setError('Απαιτείται λογαριασμός διαχειριστή ή broadcaster.');setLoading(false);}
    return()=>{cancelled=true;};
  },[API_URL,currentUser?._id,currentUser?.role,retryCount]);

  // A station switch is an intentional boundary: never continue playing
  // another station or carry its unsaved settings into the new station.
  useEffect(()=>{
    const config=fromStation(station);
    setSaved(config);setDraft(config);setBypass(false);setNotice('');
    setMeter({before:-120,after:-120,final:-120});setGainReduction(0);
    const audio=audioRef.current;
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();}
    setPlaying(false);
  },[stationId,station?._id]);

  useEffect(()=>{
    return ()=>{
      audioRef.current?.pause();
      if(ctxRef.current&&ctxRef.current.state!=='closed')ctxRef.current.close().catch(()=>{});
    };
  },[]);

  const apply=useCallback((config,bypassed)=>{
    if(!graphRef.current)return;
    applyDSPGraph(graphRef.current,config.dspPreset,config.dspSettings,
      config.dspCompressor,bypassed,config.dspClipper);
  },[]);
  useEffect(()=>{apply(draft,bypass);},[draft,bypass,apply]);

  const updateSetting=(key,value)=>{
    const next={...draft,dspSettings:{...draft.dspSettings,[key]:value}};
    apply(next,bypass);setDraft(next);setNotice('');
  };
  const selectPreset=key=>{
    const next={...draft,dspPreset:key};
    apply(next,bypass);setDraft(next);setNotice('');
  };
  const setCompressorMode=mode=>{
    const next={...draft,dspCompressor:mode==='manual'&&draft.dspCompressor.mode==='preset'?
      {...compressorForPreset(draft.dspPreset),mode:'manual'}:
      {...draft.dspCompressor,mode}};
    apply(next,bypass);setDraft(next);setNotice('');
  };
  const updateCompressor=(key,value)=>{
    const prior=draft.dspCompressor.mode==='manual'?draft.dspCompressor:
      {...compressorForPreset(draft.dspPreset),mode:'manual'};
    const next={...draft,dspCompressor:{...prior,[key]:value}};
    apply(next,bypass);setDraft(next);setNotice('');
  };

  const updateBooster=level=>{
    if(draft.dspPreset==='OFF')return;
    const mode=draft.dspPreset;
    const next={...draft,dspClipper:{...draft.dspClipper,
      [mode]:{...draft.dspClipper[mode],headroomEnabled:true,level}}};
    apply(next,bypass);setDraft(next);setNotice('');
  };

  const stop=()=>{
    audioRef.current?.pause();
    setPlaying(false);
  };
  const togglePreview=async()=>{
    if(playing){stop();return;}
    const audio=audioRef.current;
    if(!station?.stream||!audio||station.isOffline){
      setError('Ο σταθμός δεν διαθέτει ενεργό stream για ακρόαση.');return;
    }
    setError('');
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)throw Error('Ο browser δεν υποστηρίζει Web Audio.');
      if(!graphRef.current){
        const ctx=new Ctx({latencyHint:'interactive'});
        ctxRef.current=ctx;
        graphRef.current=createDSPGraph(ctx,ctx.createMediaElementSource(audio));
      }
      // Real DSP processing (never a preset curve simulation).
      apply(draft,bypass);
      const stream=station.streamUrl||station.stream;
      const requested=API_URL+'/proxy-stream?url='+encodeURIComponent(stream);
      if(audio.dataset.stationId!==String(station._id)||!audio.src){
        audio.src=requested;
        audio.dataset.stationId=String(station._id);
      }
      audio.volume=monitor/100;
      const contextStart=ctxRef.current.resume();
      const started=audio.play();
      await Promise.all([contextStart,started]);
      setPlaying(true);
    }catch(e){
      stop();
      setError('Δεν ξεκίνησε το live preview: '+(e.message||'Άγνωστο σφάλμα')+
        '. Έλεγξε το stream και το Web Audio proxy.');
    }
  };
  useEffect(()=>{
    if(audioRef.current)audioRef.current.volume=monitor/100;
  },[monitor]);

  useEffect(()=>{
    if(!playing||!graphRef.current)return;
    const graph=graphRef.current;
    const pre=new Float32Array(graph.beforePeak.fftSize);
    const post=new Float32Array(graph.postPeak.fftSize);
    const final=new Float32Array(graph.afterPeak.fftSize);
    let animation=0,lastDraw=0,lastMeter=0,active=true;
    const tick=now=>{
      if(!active)return;
      if(now-lastDraw>=33){
        graph.beforePeak.getFloatTimeDomainData(pre);
        graph.postPeak.getFloatTimeDomainData(post);
        if(!bypass&&draft.dspPreset!=='OFF'){
          drawWaveform(beforeWaveRef.current,pre,'#fb7185');
          drawWaveform(afterWaveRef.current,post,'#caff00');
        }
        lastDraw=now;
      }
      if(now-lastMeter>=90){
        setMeter({before:measurePeakDbfs(graph.beforePeak,pre),
          after:measurePeakDbfs(graph.postPeak,post),
          final:measurePeakDbfs(graph.afterPeak,final)});
        setGainReduction((!bypass&&draft.dspPreset==='FM_MODE')?
          Math.max(0,-Number(graph.compressor.reduction||0)):0);
        lastMeter=now;
      }
      animation=requestAnimationFrame(tick);
    };
    animation=requestAnimationFrame(tick);
    return()=>{active=false;cancelAnimationFrame(animation);};
  },[playing,stationId,bypass,draft.dspPreset]);

  const save=async()=>{
    if(!station||saving)return;
    setSaving(true);setError('');setNotice('');
    try{
      const res=await fetch(API_URL+'/stations/'+station._id+'/dsp',{
        method:'PUT',headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},
        body:JSON.stringify(draft)
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||'Αποτυχία αποθήκευσης.');
      const updated=fromStation(data);
      setStations(prev=>prev.map(item=>item._id===data._id?{...item,...data}:item));
      setSaved(updated);setDraft(updated);
      apply(updated,bypass);
      setNotice('Οι ρυθμίσεις αποθηκεύτηκαν για τον συγκεκριμένο σταθμό.');
      onUpdateDSP?.(data._id,data.dspPreset,data.dspSettings);
    }catch(e){setError(e.message||'Σφάλμα σύνδεσης.');}
    finally{setSaving(false);}
  };

  if(loading)return <div className="p-8 text-[#caff00]">Φόρτωση DSP Engine…</div>;
  return <main className="mx-auto max-w-[1550px] space-y-5 px-3 py-6 pb-32 text-white md:px-7">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl border border-[#caff00]/20 bg-[#caff00]/10 p-3"><SlidersHorizontal className="text-[#caff00]"/></div>
        <div><h1 className="text-3xl font-black">WebDSP Audio Engine</h1>
          <p className="mt-1 text-sm text-zinc-400">OFF, Enhancer και FM Mode · EQ, Stereo, Compressor, Booster και σταθερό Headroom −0.5 dBFS.</p>
        </div>
      </div>
      <div className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-widest text-zinc-300">
        {currentUser?.role==='admin'?'Admin · all stations':'Broadcaster · entitled stations'}
      </div>
    </header>

    <section className={shell+' p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-lg font-bold">Επιλογή σταθμού</h2>
          <p className="text-xs text-zinc-400">Οι αλλαγές και η ακρόαση αφορούν αποκλειστικά τον επιλεγμένο σταθμό.</p></div>
        <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 text-zinc-500" size={16}/>
          <input aria-label="Αναζήτηση σταθμού" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Αναζήτηση…" className="w-full rounded-xl border border-white/10 bg-[#0c0e10] p-2.5 pl-10 text-sm text-white"/></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {filtered.map(item=><button key={item._id} type="button" disabled={saving}
          onClick={()=>setStationId(item._id)}
          aria-pressed={stationId===item._id}
          className={'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors '+
            (stationId===item._id?'border-[#caff00] bg-[#caff00]/10 text-white':'border-white/10 bg-black/20 text-zinc-300 hover:border-white/30')}>
          {item.logo&&<img src={item.logo} alt="" className="h-7 w-7 rounded object-cover"/>}
          <span>{item.name}</span>
          {item.isOffline&&<span className="text-[10px] text-amber-300">OFFLINE</span>}
        </button>)}
        {!stations.length&&!error&&<p className="text-sm text-zinc-400">
          {currentUser?.role==='admin'?
            'Δεν υπάρχουν καταχωρισμένοι σταθμοί.':
            'Δεν υπάρχει ενεργή νέα συνδρομή ή δωρεάν παραχώρηση WebDSP για τους σταθμούς σου. Οι παλιές χειροκίνητες άδειες δεν ισχύουν.'}
        </p>}
      </div>
    </section>

    {station&&<>
      <section className={shell+' p-5 md:p-7'}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><span className="text-[11px] font-bold tracking-widest text-zinc-500">00 / AUDIO MODES</span>
            <h2 className="mt-1 text-2xl font-bold">Audio Mode</h2>
            <p className="mt-1 text-sm text-zinc-400">OFF: raw stream · Enhancer: EQ + Stereo · FM Mode: EQ + Stereo + Compressor.</p>
          </div>
          <div className="rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-300">{draft.dspPreset}</div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Object.entries(DSP_MODES).map(([key,value])=><button key={key} type="button"
            onClick={()=>selectPreset(key)} aria-pressed={draft.dspPreset===key}
            className={'min-h-20 rounded-xl border p-3 text-left text-xs font-bold transition-colors '+
              (draft.dspPreset===key?'border-[#caff00] bg-[#caff00]/10 text-[#caff00]':'border-white/10 bg-[#0d1113] text-zinc-300 hover:border-white/40')}>
            {value.label}</button>)}
        </div>
      </section>

      {draft.dspPreset==='OFF'&&
        <div className="rounded-2xl border border-[#caff00]/20 bg-[#caff00]/5 p-5 text-sm text-zinc-200">
          <strong className="text-[#caff00]">BYPASS / RAW STREAM</strong>
          <p className="mt-2">EQ, Stereo Expander και Compressor έχουν απενεργοποιηθεί.
          Ακούς το αρχικό stream χωρίς ψηφιακή επεξεργασία.</p>
        </div>}
      {draft.dspPreset==='FM_MODE'&&<>
      <section className={shell+' p-5 md:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">01 / DYNAMICS</span>
            <h2 className="mt-2 text-2xl font-bold">Compressor Settings</h2>
            <p className="mt-2 text-sm text-zinc-400">Προσαρμόζεις τα πατήματα του FM compressor χωρίς να επηρεάζεις EQ και Stereo. Χωρίς master limiter.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[[ 'preset','FM DEFAULTS'],['manual','MANUAL'],['off','COMP OFF']].map(([mode,label])=>
              <button key={mode} type="button" onClick={()=>setCompressorMode(mode)}
                aria-pressed={draft.dspCompressor.mode===mode}
                className={'rounded-xl border px-3 py-2 text-xs font-black '+
                  (draft.dspCompressor.mode===mode?'border-[#caff00] bg-[#caff00]/10 text-[#caff00]':'border-white/15 bg-white/5 text-zinc-300')}>
                {label}
              </button>)}
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {key:'threshold',label:'Threshold',min:-42,max:0,step:1,suffix:' dB',scale:1},
            {key:'ratio',label:'Ratio',min:1,max:8,step:.1,suffix:':1',scale:1},
            {key:'attack',label:'Attack',min:3,max:200,step:1,suffix:' ms',scale:1000},
            {key:'release',label:'Release',min:80,max:1200,step:10,suffix:' ms',scale:1000},
            {key:'makeup',label:'Makeup',min:-6,max:6,step:.5,suffix:' dB',scale:1}
          ].map(field=>{
            const v=displayedCompressor[field.key]*field.scale;
            return <div key={field.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                <span>{field.label}</span><span className="tabular-nums text-[#caff00]">{Number(v.toFixed(1))}{field.suffix}</span>
              </div>
              <input aria-label={'Compressor '+field.label} className={inputStyle+' mt-5'}
                type="range" min={field.min} max={field.max} step={field.step}
                value={v} disabled={draft.dspCompressor.mode==='off'}
                onChange={e=>updateCompressor(field.key,Number(e.target.value)/field.scale)}/>
              <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
                <span>{field.min}</span><span>{field.max}</span>
              </div>
            </div>;
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
          <span>Live gain reduction: <strong className="text-white tabular-nums">{gainReduction.toFixed(1)} dB</strong></span>
          <span>Peak Ceiling: <strong className="text-white tabular-nums">{automaticHeadroom?automaticHeadroom.toFixed(1)+' dBFS':'OFF'}</strong></span>
          <span>Οι δυναμικές ρυθμίσεις αφορούν μόνο το FM Mode.</span>
        </div>
      </section>

      </>}
      {draft.dspPreset!=='OFF'&&(
      <div className="grid gap-5 xl:grid-cols-[1.43fr_1fr]">
        <section className={shell+' p-5 md:p-7'}>
          <div className="mb-8 flex items-start justify-between gap-3">
            <div><span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">02 / EQUALIZER</span>
              <h2 className="mt-2 text-2xl font-bold">Tone control</h2></div>
            <span className="rounded-full border border-white/10 px-3 py-2 text-[10px] tracking-widest text-zinc-400">3 BAND EQ</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fader label="Bass" value={draft.dspSettings.bass} min={-12} max={12}
              sub={['180 Hz','Low shelf']} onChange={v=>updateSetting('bass',v)}/>
            <Fader label="Mid" value={draft.dspSettings.mid} min={-12} max={12}
              sub={['1.3 kHz','Presence']} onChange={v=>updateSetting('mid',v)}/>
            <Fader label="Treble" value={draft.dspSettings.treble} min={-12} max={12}
              sub={['4.3 kHz','High shelf']} onChange={v=>updateSetting('treble',v)}/>
            <Fader label="Output" value={draft.dspSettings.output} min={-7} max={7}
              sub={['MASTER','Trim']} onChange={v=>updateSetting('output',v)}/>
          </div>
        </section>

        <section className={shell+' p-5 md:p-7'}>
          <div className="flex items-start justify-between gap-3">
            <div><span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">03 / SPATIAL FIELD</span>
              <h2 className="mt-2 text-2xl font-bold">Stereo expander</h2></div>
            <span className="rounded-full border border-white/10 px-3 py-2 text-[10px] tracking-widest text-zinc-400">MID / SIDE</span>
          </div>
          <div aria-hidden="true" className="relative mx-auto mt-7 flex h-48 max-w-md items-center justify-center overflow-hidden">
            {[95,78,61,44].map((width,i)=><div key={width}
              className="absolute rounded-[100%] border border-slate-400/15"
              style={{width:width+'%',height:(50+i*11)+'%',transform:'scaleX('+Math.max(.35,draft.dspSettings.stereoWidth/100)+')'}}/>)}
            <span className="relative z-10 text-5xl font-black tabular-nums">{draft.dspSettings.stereoWidth}%</span>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-widest">
            <span>Stereo width</span><span className="text-xl">{draft.dspSettings.stereoWidth}%</span>
          </div>
          <input aria-label="Stereo width" className={inputStyle+' mt-6'} type="range"
            min="0" max="150" step="1" value={draft.dspSettings.stereoWidth}
            onChange={event=>updateSetting('stereoWidth',Number(event.target.value))}/>
          <div className="mt-3 flex justify-between text-[10px] text-zinc-500"><span>MONO / 0%</span><span>NATURAL / 100%</span><span>WIDE / 150%</span></div>
          <div className="mt-7 grid grid-cols-3 gap-2">
            {[[0,'MONO'],[100,'STEREO'],[125,'EXPAND']].map(([width,label])=><button
              type="button" key={label} onClick={()=>updateSetting('stereoWidth',width)}
              className={'rounded-xl border px-2 py-3 text-[11px] font-black '+(draft.dspSettings.stereoWidth===width?
                'border-[#caff00] text-[#caff00] bg-[#caff00]/10':'border-white/10 text-zinc-300 bg-white/5')}>{label}</button>)}
          </div>
          <p className="mt-5 text-xs leading-6 text-zinc-500">100% = αυθεντικό stereo • 0% = mono • πάνω από 100% = διεύρυνση. Το Headroom προστατεύει μόνιμα τα peaks στα −0.5 dBFS στα ενεργά DSP modes.</p>
        </section>
      </div>

      )}

      {draft.dspPreset!=='OFF'&&<section className={shell+' p-5 md:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">04 / MASTER PROCESSING</span>
            <h2 className="mt-2 text-2xl font-bold">Booster &amp; Headroom</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Headroom: μόνιμα ενεργό στα −0.5 dBFS σε Enhancer και FM Mode, χωρίς διακόπτη.
              Booster: ρυθμιζόμενη ένταση 0–8 ανά mode, πριν από το τελικό peak ceiling.
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-300">
            {DSP_MODES[draft.dspPreset].label} · MASTER
          </span>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0d1113] p-5">
            <div className="flex items-center justify-between gap-4">
              <div><h3 className="font-bold">Peak Headroom</h3>
                <p className="mt-1 text-xs text-zinc-500">Μόνιμο sample-peak ceiling · χωρίς σταθερή μείωση gain.</p>
              </div>
              <span className="rounded-xl border border-[#caff00]/40 bg-[#caff00]/10 px-4 py-2 text-xs font-black text-[#caff00]">
                ALWAYS ON
              </span>
            </div>
            <p className="mt-5 text-3xl font-black tabular-nums">{automaticHeadroom.toFixed(1)}
              <span className="text-base text-zinc-400"> dBFS peak</span></p>
            <p className="mt-2 text-xs text-amber-300">
              Το Headroom δεν απενεργοποιείται σε Enhancer ή FM Mode. Περιορίζει μόνο τις πολύ υψηλές κορυφές.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d1113] p-5">
            <div className="flex items-center justify-between gap-4">
              <div><h3 className="font-bold">Booster</h3>
                <p className="mt-1 text-xs text-zinc-500">Soft clipping · 4× oversampling · προοδευτική ένταση.</p></div>
              <span className="text-3xl font-black tabular-nums text-[#caff00]">{activeMaster.level}<span className="text-base text-zinc-500"> / 8</span></span>
            </div>
            <input type="range" aria-label="Booster level" min="0" max="8" step="1"
              value={activeMaster.level} onChange={e=>updateBooster(Number(e.target.value))}
              className={inputStyle+' mt-7'}/>
            <div className="mt-3 flex justify-between text-xs text-zinc-400"><span>0 · BYPASS</span><span>4 · MEDIUM</span><span>8 · STRONG</span></div>
            <p className="mt-5 text-xs text-zinc-500">Ο Booster λειτουργεί πριν από το πάντα ενεργό Headroom −0.5 dBFS. Δεν αποτελεί πιστοποιημένο true-peak limiter.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0d1113] p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-bold text-zinc-300">
              <span>BEFORE · EQ / STEREO / COMP</span><span className="tabular-nums">{meter.before<=-119?'−∞':formatDb(meter.before)}</span>
            </div>
            <canvas ref={beforeWaveRef} role="img" aria-label="Live waveform before master processing"
              className="h-36 w-full rounded-lg bg-black/30"/>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d1113] p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-bold text-zinc-300">
              <span>AFTER · BOOSTER / HEADROOM</span><span className="tabular-nums">{meter.after<=-119?'−∞':formatDb(meter.after)}</span>
            </div>
            <canvas ref={afterWaveRef} role="img" aria-label="Live waveform after master processing"
              className="h-36 w-full rounded-lg bg-black/30"/>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Οι κυματομορφές προέρχονται από πραγματικά audio samples του Live Prelisten, όχι προσομοίωση.
          Πάτησε LISTEN LIVE παρακάτω για να τις δεις. Οι αλλαγές εφαρμόζονται αμέσως, και αποθηκεύονται μόνο με Save.
        </p>
      </section>}

      <section className={shell+' p-5 md:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">05 / LIVE PRELISTEN</span>
            <h2 className="mt-2 text-2xl font-bold">Live sound preview</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">Άκου το πραγματικό live stream του επιλεγμένου σταθμού. Κάθε αλλαγή εφαρμόζεται αμέσως μόνο στην ακρόασή σου μέχρι να πατήσεις Save.</p></div>
          <span className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-zinc-300">{playing?'LIVE PREVIEW':'READY TO PREVIEW'}</span>
        </div>
        <audio ref={audioRef} crossOrigin="anonymous" preload="none" playsInline
          onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}
          onError={()=>{setPlaying(false);setError('Το stream δεν είναι διαθέσιμο για preview.');}}/>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button type="button" onClick={togglePreview} disabled={station.isOffline}
            className="inline-flex items-center gap-2 rounded-xl bg-[#c5d0d5] px-5 py-3 text-xs font-black text-black disabled:opacity-40">
            {playing?<Pause size={16}/>:<Play size={16}/>} {playing?'PAUSE PREVIEW':'LISTEN LIVE'}
          </button>
          {draft.dspPreset!=='OFF'&&<button type="button" onClick={()=>{const next=!bypass;setBypass(next);apply(draft,next);}}
            aria-pressed={bypass}
            className={'inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-xs font-bold '+(bypass?'border-amber-400 text-amber-300':'border-white/20 text-zinc-300')}>
            <PowerOff size={15}/> {bypass?'FX BYPASSED':'BYPASS FX'}
          </button>}
          <label className="ml-auto flex min-w-48 items-center gap-3 text-xs text-zinc-300">
            <Volume2 size={18}/><span>MONITOR</span>
            <input aria-label="Monitor level" type="range" min="0" max="100" step="1"
              value={monitor} onChange={e=>setMonitor(Number(e.target.value))} className={inputStyle}/>
            <span className="tabular-nums">{monitor}%</span>
          </label>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0d1113] p-5">
            <div className="mb-5 flex items-center gap-2 text-sm font-bold"><Activity size={18}/> Live peak monitoring</div>
            <PeakBar label="FX OUTPUT / πριν το auto headroom" db={meter.before}/>
            <div className="mt-6"><PeakBar label="FINAL OUTPUT / sample peak" db={meter.final}/></div>
            <div className={'mt-5 flex items-center gap-2 text-xs '+(playing&&meter.final>=PEAK_WARNING_DBFS?'text-rose-300':'text-zinc-400')}>
              {playing&&meter.final>=PEAK_WARNING_DBFS?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}
              {playing&&meter.final>=PEAK_WARNING_DBFS?
                'PEAK WARNING: η τελική στάθμη πλησιάζει τα 0 dBFS. Έλεγξε το αρχικό stream και τις ρυθμίσεις.':
                'Μόνιμο Headroom −0.5 dBFS και ρυθμιζόμενο Booster · έλεγξε το τελικό sample peak.'}
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-[#0d1113] p-5">
            <Headphones className="mb-4 text-[#caff00]" size={28}/>
            <h3 className="text-lg font-bold">Peak control χωρίς πτώση στάθμης</h3>
            <p className="mt-2 text-sm leading-7 text-zinc-400">Με μόνιμο Headroom διατηρείται η στάθμη και περιορίζονται μόνο οι κορυφές κοντά στο 0 dBFS προς −0.5 dBFS. Ο Booster 0–8 παραμένει ρυθμιζόμενος. Οι μετρητές δείχνουν sample peaks, όχι πιστοποιημένα true peaks. Καμία ρύθμιση δεν διορθώνει ήδη παραμορφωμένο stream.</p>
            <p className="mt-3 text-xs text-zinc-500">Το Headroom είναι μόνιμο στα ενεργά DSP modes. Μόνο το OFF και το πλήρες BYPASS FX περνούν το αρχικό stream ανεπεξέργαστο.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#111517] p-4">
        {draft.dspPreset!=='OFF'&&<button type="button" onClick={()=>{const next={...draft,dspSettings:{...DSP_DEFAULTS}};setDraft(next);apply(next,bypass);}}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs font-bold text-zinc-300">
          <RotateCcw size={16}/> RESET EQ / WIDTH</button>}
        <button type="button" disabled={!dirty||saving} onClick={save}
          className="inline-flex items-center gap-2 rounded-xl bg-[#caff00] px-6 py-3 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40">
          <Save size={16}/> {saving?'SAVING…':'SAVE SETTINGS'}</button>
        <span className="text-xs text-zinc-400">{needsMigration?'Παλιό DSP preset: αποθήκευσέ το ως FM Mode.':
          dirty?'Μη αποθηκευμένες αλλαγές':'Οι αλλαγές έχουν αποθηκευτεί.'}</span>
      </div>
    </>}

    {notice&&<p role="status" className="rounded-xl border border-[#caff00]/20 bg-[#caff00]/5 p-3 text-sm text-[#caff00]">{notice}</p>}
    {error&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
      <span>{error}</span>
      <button type="button" className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-bold"
        onClick={()=>setRetryCount(n=>n+1)}>Επανάληψη φόρτωσης</button>
    </div>}
  </main>;
}
