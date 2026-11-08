'use strict';
// Canonical weekly schedule: 1=Monday ... 7=Sunday, 24:00 is an end-only midnight boundary.
// Old iRadios schedules used 0=Monday ... 6=Sunday. Never silently rewrite
// ambiguous legacy data: detect the old format, show a review hint in the UI,
// and tag the station with scheduleDayBase=1 only after an explicit save.
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MINUTES_PER_DAY=1440;
const nextDay=day=>day===7?1:day+1;
function minutes(time,allowEnd=false){
  if(allowEnd&&time==='24:00')return MINUTES_PER_DAY;
  if(!TIME.test(time))return NaN;
  const [h,m]=time.split(':').map(Number);
  return h*60+m;
}
function scheduleDayBase(entries,tag){
  if(tag===0||tag===1)return tag;
  if((entries||[]).some(show=>Number(show.day)===0))return 0;
  if((entries||[]).some(show=>Number(show.day)===7))return 1;
  return 0; // Existing historical schedules without a marker are zero-based.
}
function toCanonical(entries,base){
  return (entries||[]).map(show=>({
    ...show,day:base===0?Number(show.day)+1:Number(show.day),
    endTime:show.endTime==='24:00'?'00:00':show.endTime
  }));
}
function normalize(entries){
  if(!Array.isArray(entries)||entries.length>160)throw new Error('Το πρόγραμμα δέχεται έως 160 εγγραφές.');
  const result=[];
  let split=0;
  for(const source of entries){
    if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('Μη έγκυρη εκπομπή.');
    const day=Number(source.day);
    const startTime=String(source.startTime||''),endTime=String(source.endTime||'');
    const title=typeof source.title==='string'?source.title.trim():'';
    const host=typeof source.host==='string'?source.host.trim():'';
    const from=minutes(startTime),to=minutes(endTime,true);
    if(!Number.isInteger(day)||day<1||day>7||!Number.isFinite(from)||
      !Number.isFinite(to)||!title||title.length>120||host.length>100)
      throw new Error('Έλεγξε την ημέρα, τις ώρες, τον τίτλο και τον παραγωγό της εκπομπής.');
    if(from===to&&startTime!=='00:00')
      throw new Error('Η έναρξη και η λήξη δεν μπορούν να είναι ίδιες.');
    if(from===to&&startTime==='00:00'){
      result.push({day,startTime:'00:00',endTime:'24:00',title,host});
    }else if(to<from){
      result.push({day,startTime,endTime:'24:00',title,host});
      if(endTime!=='00:00'){
        result.push({day:nextDay(day),startTime:'00:00',endTime,title,host});
      }
      split++;
    }else{
      result.push({day,startTime,endTime,title,host});
    }
  }
  if(result.length>160)throw new Error('Οι εκπομπές μετά τον διαχωρισμό ξεπερνούν το όριο των 160.');
  result.sort((a,b)=>a.day-b.day||a.startTime.localeCompare(b.startTime)||a.endTime.localeCompare(b.endTime));
  for(let i=1;i<result.length;i++){
    const prev=result[i-1],cur=result[i];
    if(prev.day===cur.day&&minutes(cur.startTime)<minutes(prev.endTime,true))
      throw new Error('Οι εκπομπές «'+prev.title+'» και «'+cur.title+'» επικαλύπτονται. Άλλαξε ώρες ή διόρθωσε τη σειρά.');
  }
  return {schedule:result,split};
}
module.exports={minutes,scheduleDayBase,toCanonical,normalize,nextDay};
