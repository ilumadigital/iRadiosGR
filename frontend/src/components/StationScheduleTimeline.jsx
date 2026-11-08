import React from 'react';
import { CalendarDays, Clock3, Music2, Radio, ImageOff } from 'lucide-react';

const DAYS=['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'];
function Cover({imageUrl,fallback,title}){
  return <div className="ir-program-art">
    <img src={imageUrl||fallback||'/iradios-app-logo.png'} alt={title||'Εικόνα εκπομπής'}
      loading="lazy" onError={e=>{
        const safe=fallback||'/iradios-app-logo.png';
        if(e.currentTarget.src!==new URL(safe,window.location.href).href)e.currentTarget.src=safe;
        else e.currentTarget.style.opacity='0.2';
      }}/>
    {!imageUrl&&<span className="ir-program-art-icon"><Radio size={17}/></span>}
  </div>;
}
export default function StationScheduleTimeline({station,shows,selectedDay,onSelectDay,currentShow,today}){
  const currentShows=shows.filter(s=>Number(s.day)===selectedDay)
    .sort((a,b)=>a.startTime.localeCompare(b.startTime));
  return <section className="ir-station-program mt-9" aria-label={'Πρόγραμμα του '+station.name}>
    <div className="ir-station-program-header">
      <div>
        <p className="ir-program-eyebrow"><CalendarDays size={15}/> Ο ΕΒΔΟΜΑΔΙΑΙΟΣ ΟΔΗΓΟΣ ΣΟΥ</p>
        <h2>Πρόγραμμα του {station.name}</h2>
        <p className="ir-program-subtitle">Ανακάλυψε εκπομπές, παραγωγούς και ώρες μετάδοσης.</p>
      </div>
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
