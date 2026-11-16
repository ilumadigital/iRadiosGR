'use strict';
// User-facing emails must never inherit the host timezone or US month/day order.
const tz='Europe/Athens';
const date=new Intl.DateTimeFormat('en-GB',{
  timeZone:tz,day:'2-digit',month:'2-digit',year:'numeric'
});
const time=new Intl.DateTimeFormat('en-GB',{
  timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
function formatAthensDateTime(value,fallback='—'){
  if(value==null||value==='')return fallback;
  const parsed=value instanceof Date?value:new Date(value);
  return Number.isFinite(parsed.getTime())?date.format(parsed)+' '+time.format(parsed):fallback;
}
module.exports={formatAthensDateTime};
