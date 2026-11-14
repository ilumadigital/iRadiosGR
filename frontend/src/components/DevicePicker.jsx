import React,{useEffect,useState} from 'react';
import {MonitorSpeaker,Smartphone,Tablet,Monitor,Tv,Gamepad2,Radio,
  X,RefreshCw,Pencil,Trash2,Check,ArrowRight,Loader2} from 'lucide-react';
import {connectError} from '../hooks/usePlayDevices';
const iconFor={mobile:Smartphone,tablet:Tablet,desktop:Monitor,tv:Tv,console:Gamepad2};
export default function DevicePicker({open,onClose,devices=[],localDeviceId,premium,
  connected,onRefresh,onTransfer,onRename,onForget,currentStation}){
  const [busy,setBusy]=useState('');
  const [editing,setEditing]=useState('');
  const [name,setName]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{if(open)void onRefresh?.();else{setError('');setEditing('');}},[open,onRefresh]);
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==='Escape')onClose?.();};
    document.addEventListener('keydown',onKey);
    return ()=>document.removeEventListener('keydown',onKey);
  },[open,onClose]);
  if(!open)return null;
  async function run(id,call){
    if(busy)return;
    setBusy(id);setError('');
    try{
      const result=await call();
      if(!result?.ok)throw Error(connectError(result?.error));
      return true;
    }catch(e){setError(e.message||'Η ενέργεια απέτυχε.');return false;}
    finally{setBusy('');}
  }
  return <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-5">
    <button type="button" className="absolute inset-0 cursor-default" aria-label="Κλείσιμο συσκευών" onClick={onClose}/>
    <section role="dialog" aria-modal="true" aria-labelledby="connect-heading" className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/15 bg-[#11151b] p-5 text-white shadow-2xl sm:rounded-[28px] sm:p-6">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-[#ccff00]/10 p-3 text-[#ccff00]"><MonitorSpeaker size={24}/></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ccff00]">iRadios Connect</p>
            <h2 id="connect-heading" className="text-xl font-black">Οι συσκευές μου</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>void onRefresh?.()} aria-label="Ανανέωση συσκευών" className="rounded-full p-2 text-zinc-300 hover:bg-white/10"><RefreshCw size={20}/></button>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="rounded-full p-2 text-zinc-300 hover:bg-white/10"><X size={20}/></button>
        </div>
      </header>
      <p className="mt-3 text-sm text-zinc-400">
        {premium?'Premium · Μία ενεργή αναπαραγωγή σε όλες τις συσκευές σου.':
          'Free · Μπορείς να ακούς από περισσότερες συσκευές ταυτόχρονα.'}
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
        <span className={'h-2 w-2 rounded-full '+(connected?'bg-emerald-400':'bg-amber-500')}/>
        {connected?'Συγχρονισμός ενεργός':'Σύνδεση στο iRadios Connect…'}
      </div>
      {error&&<p role="alert" className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
      <div className="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
        {!devices.length&&<div className="rounded-xl border border-white/10 p-6 text-center text-sm text-zinc-400">Δεν υπάρχουν ακόμη αποθηκευμένες συσκευές. Οι συσκευές προστίθενται όταν συνδέονται στον λογαριασμό.</div>}
        {devices.map(device=>{
          const local=device.deviceId===localDeviceId;
          const Icon=iconFor[device.deviceType]||Monitor;
          const playing=device.isPlaying===true;
          const paused=device.playbackState==='paused';
          const hasOwnerElsewhere=premium&&devices.some(d=>d.online&&d.playbackState&&d.deviceId!==localDeviceId);
          const owner=Boolean(device.playbackState);
          const online=device.online===true;
          const sub=device.clientType==='app'?'App':'Browser';
          return <div key={device.deviceId} className={'rounded-2xl border p-3 transition-colors '+(playing?'border-[#ccff00]/30 bg-[#ccff00]/10':'border-white/10 bg-white/[.035]')}>
            <div className="flex items-center gap-3">
              <Icon size={25} className={playing?'shrink-0 text-[#ccff00]':'shrink-0 text-zinc-300'}/>
              <div className="min-w-0 flex-1">
                {editing===device.deviceId?
                  <form className="flex gap-2" onSubmit={async e=>{e.preventDefault();if(await run('rename',()=>onRename(device.deviceId,name))){setEditing('');void onRefresh?.();}}}>
                    <input aria-label="Όνομα συσκευής" maxLength={120} value={name} onChange={e=>setName(e.target.value)} required className="min-w-0 flex-1 rounded-md bg-zinc-800 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#ccff00]"/>
                    <button aria-label="Αποθήκευση ονόματος" type="submit"><Check size={19}/></button>
                  </form>:
                  <p className="truncate text-sm font-bold">{device.deviceName||'Συσκευή'} {local&&<span className="text-[10px] font-normal text-[#ccff00]">· Αυτή η συσκευή</span>}</p>}
                <p className="mt-0.5 text-xs text-zinc-400">{sub}{device.clientType==='browser'&&device.browser?' · '+device.browser:''}</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {playing?'Παίζει τώρα':paused?'Σε παύση':device.isPending?'Αναμονή έναρξης':online?'Online':'Offline'}
                  {!online&&device.lastSeenAt?' · Τελευταία σύνδεση '+new Date(device.lastSeenAt).toLocaleDateString('el-GR'):''}
                </p>
              </div>
              <span className={'h-2.5 w-2.5 shrink-0 rounded-full '+(playing?'bg-[#ccff00]':online?'bg-emerald-400':'bg-zinc-600')}/>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
              {(!local||hasOwnerElsewhere)&&!owner&&<button type="button" disabled={!connected||!online||!!busy} onClick={async()=>{
                if(await run('transfer:'+device.deviceId,()=>onTransfer(device.deviceId)))onClose?.();
              }} className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#ccff00] px-3 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-30">
                {busy==='transfer:'+device.deviceId?<Loader2 className="animate-spin" size={15}/>:<ArrowRight size={15}/>}
                Μεταφορά εδώ
              </button>}
              {local&&!hasOwnerElsewhere&&<span className="flex-1 text-xs text-zinc-500">{playing?'Η συσκευή που παίζει':paused?'Η συσκευή σε παύση':'Τρέχουσα συσκευή'}</span>}
              {owner&&!local&&<span className="flex-1 text-xs font-semibold text-[#ccff00]">Ενεργή συσκευή ήχου</span>}
              <button type="button" title="Μετονομασία" aria-label="Μετονομασία συσκευής" onClick={()=>{setEditing(device.deviceId);setName(device.deviceName||'');}} className="rounded-lg border border-white/10 p-2 text-zinc-300"><Pencil size={16}/></button>
              {!local&&<button type="button" disabled={!!busy} title="Αφαίρεση συσκευής" aria-label="Αφαίρεση συσκευής" onClick={async()=>{
                if(window.confirm('Να αφαιρεθεί αυτή η συσκευή από τον λογαριασμό;'))
                  void run('forget',()=>onForget(device.deviceId));
              }} className="rounded-lg border border-white/10 p-2 text-rose-300"><Trash2 size={16}/></button>}
            </div>
          </div>;
        })}
      </div>
      <p className="mt-4 text-xs text-zinc-500">Οι offline συσκευές παραμένουν αποθηκευμένες. Για απομακρυσμένη αναπαραγωγή πρέπει να είναι online. Σε ορισμένα iPhone και Smart TV απαιτείται να πατήσεις Play στην άλλη συσκευή.</p>
    </section>
  </div>;
}
