import React,{useCallback,useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {findProgramFollow,programFollowKey} from '../utils/programFollowKeys.mjs';
import { CalendarDays, Clock3, Heart, Loader2, Music2, Radio } from 'lucide-react';

const DAYS=['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'];
function Cover({imageUrl,fallback,title}){
  return <div className="ir-program-art">
    <img src={imageUrl||fallback||'/icon-tr.svg'} alt={title||'Εικόνα εκπομπής'}
      loading="lazy" onError={e=>{
        const safe=fallback||'/icon-tr.svg';
        if(e.currentTarget.src!==new URL(safe,window.location.href).href)e.currentTarget.src=safe;
        else e.currentTarget.style.opacity='0.2';
      }}/>
    {!imageUrl&&<span className="ir-program-art-icon"><Radio size={17}/></span>}
  </div>;
}
export default function StationScheduleTimeline({station,shows,selectedDay,onSelectDay,currentShow,today,currentUser}){
  const navigate=useNavigate();
  const [follows,setFollows]=useState([]);
  const [busyKey,setBusyKey]=useState('');
  const [followError,setFollowError]=useState('');
  const auth=()=>({'Content-Type':'application/json',
    Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')});
  // Match the exact server identity, never a partially normalized label.
  const getFollow=(kind,label)=>findProgramFollow(follows,kind,station._id,label);
  useEffect(()=>{
    if(!currentUser?._id){setFollows([]);return undefined;}
    const controller=new AbortController();
    fetch('/api/users/me/follows',{headers:auth(),signal:controller.signal})
      .then(r=>r.ok?r.json():Promise.reject(Error('Δεν φορτώθηκαν οι παρακολουθήσεις.')))
      .then(data=>{if(!controller.signal.aborted)setFollows(data.follows||[]);})
      .catch(error=>{if(!controller.signal.aborted)setFollowError(error.message);});
    return()=>controller.abort();
  },[currentUser?._id,station._id]);

  const toggleFollow=async(kind,label)=>{
    if(!currentUser){navigate('/login');return;}
    const existing=getFollow(kind,label);
    const key=programFollowKey(kind,station._id,label);
    if(!key){setFollowError('Μη έγκυρος τίτλος εκπομπής.');return;}
    if(busyKey)return;
    setBusyKey(key);setFollowError('');
    try{
      const response=await fetch(existing
        ?'/api/users/me/follows/'+encodeURIComponent(existing.id)
        :'/api/users/me/follows',{
        method:existing?'DELETE':'POST',headers:auth(),
        ...(!existing?{body:JSON.stringify({kind,stationId:station._id,label})}:{})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(payload.error||'Δεν αποθηκεύτηκε η παρακολούθηση.');
      setFollows(payload.follows||[]);
    }catch(error){setFollowError(error.message||'Αποτυχία ενημέρωσης.');}
    finally{setBusyKey('');}
  };
  const currentShows=shows.filter(s=>Number(s.day)===selectedDay)
    .sort((a,b)=>a.startTime.localeCompare(b.startTime));
  return <section className="ir-station-program mt-9" aria-label={'Πρόγραμμα του '+station.name}>
    <div className="ir-station-program-header">
      <div>
        <p className="ir-program-eyebrow"><CalendarDays size={15}/> Ο ΕΒΔΟΜΑΔΙΑΙΟΣ ΟΔΗΓΟΣ ΣΟΥ</p>
        <h2>Πρόγραμμα του {station.name}</h2>
        <p className="ir-program-subtitle">Ανακάλυψε εκπομπές, παραγωγούς και ώρες μετάδοσης.</p>
      </div>
      {followError&&<p role="status" className="ir-program-follow-error">{followError}</p>}
      <div className="ir-program-live-status"><span className="ir-program-live-dot"/>
        {currentShow?'Τώρα στον αέρα: '+currentShow.title:'Ζωντανό ραδιόφωνο'}
      </div>
    </div>
    <div className="ir-program-day-tabs" role="tablist" aria-label="Ημέρες προγράμματος">
      {DAYS.map((name,index)=>{
        const day=index+1,active=selectedDay===day,hasShows=shows.some(s=>Number(s.day)===day);
        return <button type="button" key={name} role="tab" aria-selected={active}
          aria-controls="ir-station-schedule-day" onClick={()=>onSelectDay(day)}
          className={'ir-program-day-tab'+(active?' is-selected':'')}>
          {name}{today.day===day&&<small>Σήμερα</small>}
          {hasShows&&<span className="ir-program-day-dot" aria-hidden="true"/>}
        </button>;
      })}
    </div>
    <div className="ir-program-rows" id="ir-station-schedule-day" role="tabpanel">
      {currentShows.length?currentShows.map((show,index)=>{
        const live=today.day===selectedDay&&Boolean(currentShow)&&
          show.title===currentShow.title&&show.startTime===currentShow.startTime;
        return <div key={[show.day,show.startTime,show.title,index].join('-')}
          className={'ir-program-row'+(live?' is-live':'')}>
          <span className="ir-program-line-dot" aria-hidden="true"/>
          <div className="ir-program-time">
            {live&&<span className="ir-program-onair">● ΤΩΡΑ ΣΤΟΝ ΑΕΡΑ</span>}
            <strong>{show.startTime} – {show.endTime==='24:00'?'00:00':show.endTime}</strong>
          </div>
          <Cover key={show.imageUrl||show.title} imageUrl={show.imageUrl} fallback={station.logo} title={show.title}/>
          <div className="ir-program-show-info">
            <h3>{show.title}</h3>
            {show.host&&<p className="ir-program-host"><Music2 size={13}/> Με {show.host}</p>}
            {show.description&&<p className="ir-program-description">{show.description}</p>}
            <div className="ir-program-follow-actions">
              {[
                {kind:'show',label:show.title,text:'Εκπομπή'},
                ...(show.host?[{kind:'dj',label:show.host,text:'Παραγωγό'}]:[])
              ].map(item=>{
                const followed=Boolean(getFollow(item.kind,item.label));
                const waiting=busyKey===programFollowKey(item.kind,station._id,item.label);
                return <button type="button" key={item.kind+':'+item.label}
                  aria-pressed={followed} disabled={Boolean(busyKey)}
                  aria-label={(followed?'Σταμάτα να ακολουθείς ':'Ακολούθησε ')+item.text+': '+item.label}
                  className={'ir-program-follow-button '+(followed?'ir-program-follow-button--active':'')}
                  onClick={()=>toggleFollow(item.kind,item.label)}>
                  {waiting?<Loader2 size={12} className="animate-spin"/>:<Heart size={12} fill={followed?'currentColor':'none'}/>}
                  {followed?'Ακολουθείς '+item.text:'Ακολούθησε '+item.text}
                </button>;
              })}
            </div>
          </div>
          {live&&<span className="ir-program-equalizer" aria-label="Ζωντανή εκπομπή">
            <i/><i/><i/><i/><i/>
          </span>}
        </div>;
      }):<div className="ir-program-empty">
        <Clock3 size={25}/>
        <strong>Δεν υπάρχει καταχωρισμένο πρόγραμμα για {DAYS[selectedDay-1]}.</strong>
        <span>Μπορείς να ακούσεις τον σταθμό ζωντανά οποιαδήποτε στιγμή.</span>
      </div>}
    </div>
  </section>;
}
