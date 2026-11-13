import React,{useEffect,useState} from 'react';
import {AlertTriangle,Headphones,Loader2} from 'lucide-react';

/** Previews must never trigger public ad impressions.
 * JWT stays in the fetch header (never in a public media URL).
 * Creating a blob only happens after a deliberate operator click.
 */
export default function ProtectedAudioPreview({adId,scope='admin',sourceUrl='',className='',pending=false}) {
  const stage=typeof window!=='undefined'&&window.location.hostname==='stage.iradios.gr';
  const [resource,setResource]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>()=>{if(resource)URL.revokeObjectURL(resource);},[resource]);
  useEffect(()=>{setResource(null);setError('');},[adId,scope,sourceUrl,pending]);
  const handleLoad=async()=>{
    if(!adId||loading)return;
    setLoading(true);setError('');
    try {
      const endpoint=scope==='agency'
        ?'/api/agency/audio-ads/'+encodeURIComponent(adId)+'/preview-audio'
        :'/api/admin/ads/'+encodeURIComponent(adId)+(pending?'/preview-pending-audio':'/preview-audio');
      const response=await fetch(endpoint,{headers:{
        Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')
      }});
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        throw new Error(data.error||'Δεν φορτώθηκε το spot (HTTP '+response.status+').');
      }
      const blob=await response.blob();
      if(!blob.size)throw new Error('Το αρχείο ήχου είναι κενό.');
      setResource(URL.createObjectURL(blob));
    }catch(e){setError(e.message||'Αποτυχία προεπισκόπησης.');}
    finally{setLoading(false);}
  };
  if(!sourceUrl)return null;
  if(!stage)return <audio controls preload="none" src={sourceUrl} className={'w-full '+className}/>;
  return <div className={'space-y-2 '+className}>
    {resource?<audio controls preload="metadata" src={resource} className="w-full"
      onError={()=>setError('Το αρχείο δεν αναπαράγεται από τον browser. Ανέβασε έγκυρο MP3/WAV.')}/>:
    <button type="button" disabled={loading||!adId} onClick={handleLoad}
      className="inline-flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-200 hover:bg-purple-500/20 disabled:opacity-50">
      {loading?<Loader2 size={15} className="animate-spin"/>:<Headphones size={15}/>}
      {loading?'Φόρτωση ηχητικού...':'Φόρτωση Audio Preview'}
    </button>}
    {error&&<p role="alert" className="flex items-center gap-2 text-xs text-amber-300"><AlertTriangle size={14}/>{error}</p>}
    <p className="text-[10px] text-zinc-500">Προεπισκόπηση χωρίς χρέωση ή καταμέτρηση plays.</p>
  </div>;
}
