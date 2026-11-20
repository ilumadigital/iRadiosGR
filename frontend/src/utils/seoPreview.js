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
  // Keep the client preview in step with the public server-side description.
  // Only approved public programme facts, never authenticated playlist history.
  const validTime=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const schedule=(Array.isArray(station.schedule)?station.schedule:[])
    .filter(show=>show&&clean(show.title,130)&&validTime.test(show.startTime)&&
      (validTime.test(show.endTime)||show.endTime==='24:00'))
    .sort((a,b)=>Number(a.day)-Number(b.day)||a.startTime.localeCompare(b.startTime));
  const source=clean(station.description)||clean(station.slogan,400)||
    'Άκου ζωντανά τον '+name+' στο iRadios.';
  const existing=source.toLocaleLowerCase('el-GR'),facts=[];
  const show=clean(schedule[0]?.title,130);
  if(show&&!existing.includes(show.toLocaleLowerCase('el-GR')))facts.push('Εκπομπή: '+show);
  if(genre&&!existing.includes(genre.toLocaleLowerCase('el-GR')))facts.push(genre);
  if(place&&!existing.includes(place.toLocaleLowerCase('el-GR')))facts.push('από '+place);
  const extra=shorten(facts.join(' · '),78);
  const title=shorten(name+frequency+' — Άκου ζωντανά | iRadios',75);
  const lead=shorten(source,extra?155-extra.length:158);
  const description=shorten(lead+(extra?' · '+extra:''),158);
  const id=encodeURIComponent(String(station.slug||station._id||''));
  const origin=window.location.origin;
  return {title,description,
    url:id?origin+'/station/'+id:'',
    image:id?origin+'/og-image/'+id+'.png':origin+'/og-image.png'};
}
