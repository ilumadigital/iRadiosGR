// Browser counterpart of the stable station title / summary projection.
// Real public HTML is generated on the server; this module powers the editor
// preview and client-side navigation without live-song SEO title churn.
export function stationSeoPreview(station={}) {
  const clean=(value,max=4000)=>String(value??'').replace(/<[^>]*>/g,' ')
    .replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
  const shorten=(value,length)=> {
    const text=clean(value);
    if(text.length<=length)return text;
    const part=text.slice(0,length+1),end=part.lastIndexOf(' ');
    return (end>length*.65?part.slice(0,end):part.slice(0,length)).trimEnd()+'…';
  };
  const name=clean(station.name,100)||'Ραδιοφωνικός σταθμός';
  const frequency=station.transmissionType==='Επίγειο'&&clean(station.frequency,24)?
    ' '+clean(station.frequency,24):'';
  const place=clean(station.city||station.region||'',90);
  const genre=clean(station.genre,90);
  const fallback='Άκου ζωντανά τον '+name+(genre?' με '+genre+' μουσική':'')+
    (place?' από '+place:'')+' στο iRadios.';
  const title=shorten(name+frequency+' — Άκου ζωντανά | iRadios',75);
  const description=shorten(clean(station.description)||
    [clean(station.slogan),fallback].filter(Boolean).join('. '),158);
  const id=encodeURIComponent(String(station.slug||station._id||''));
  const origin=window.location.origin;
  return {title,description,
    url:id?origin+'/station/'+id:'',
    image:id?origin+'/og-image/'+id+'.png':origin+'/og-image.png'};
}
