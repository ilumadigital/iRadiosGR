'use strict';
const {createCanvas, loadImage} = require('canvas');
const {origin,pick,normalizedSchedule,athensDate} = require('./seo2Core');

function approvedImage(value) {
  if (typeof value !== 'string' || !value || value.length > 1500) return null;
  try {
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
      if (!/^\/(?:media\/(?:logo|visuals|radioassets)\/|uploads\/|iradios-|favicon)/.test(value)) return null;
      return origin() + value;
    }
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.toLowerCase();
    const ownHost = new URL(origin()).hostname.toLowerCase();
    const approved = [ownHost, 'play.iradios.gr', 'stage.iradios.gr',
      ...(process.env.SEO_OG_IMAGE_HOSTS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)];
    return approved.includes(host) ? parsed.toString() : null;
  } catch {return null;}
}
async function safeLoadImage(url) {
  const safe = approvedImage(url);
  if (!safe) return null;
  try {
    // canvas remote loader sees only explicitly trusted hosts. No arbitrary user URLs.
    return await loadImage(safe);
  } catch {return null;}
}
function rounded(ctx,x,y,w,h,r,fill) {
  ctx.fillStyle=fill;ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x,y,w,h,r);
  else ctx.rect(x,y,w,h);
  ctx.fill();
}
function wrap(ctx,text,maxWidth,maxLines=2) {
  const words=pick(text,220).split(/\s+/).filter(Boolean);
  const rows=[];
  let line='';
  for(const word of words) {
    const next = line ? line+' '+word : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      rows.push(line); line=word;
      if(rows.length>=maxLines-1)break;
    } else line=next;
  }
  if(line)rows.push(line);
  return rows.slice(0,maxLines);
}
function todayShow(st) {
  const schedule=normalizedSchedule(st);
  if(!schedule.length)return null;
  const now=new Date();
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',weekday:'short',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const v=type=>parts.find(p=>p.type===type)?.value || '';
  const day=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(v('weekday'))+1;
  const minute=Number(v('hour'))*60+Number(v('minute'));
  return schedule.find(x=>{
    const [h,m]=x.startTime.split(':').map(Number),start=h*60+m;
    const end=x.endTime==='24:00'?1440:
      x.endTime.split(':').map(Number).reduce((a,b,i)=>i===0?a+b*60:a+b,0);
    return x.day===day && minute>=start && minute<end;
  }) || null;
}
async function generateStationOgImage(station) {
  const canvas=createCanvas(1200,630),c=canvas.getContext('2d');
  const gradient=c.createLinearGradient(0,0,1200,630);
  gradient.addColorStop(0,'#080d16');gradient.addColorStop(1,'#1b2530');
  c.fillStyle=gradient;c.fillRect(0,0,1200,630);
  const cover=await safeLoadImage(station?.cover);
  if(cover){
    const s=Math.max(1200/cover.width,630/cover.height);
    c.save();c.globalAlpha=.14;
    c.drawImage(cover,(1200-cover.width*s)/2,(630-cover.height*s)/2,cover.width*s,cover.height*s);
    c.restore();
  }
  rounded(c,54,54,180,40,18,'#caff00');
  c.textBaseline='middle';c.textAlign='left';
  c.fillStyle='#0c1700';c.font='bold 22px sans-serif';c.fillText('iRadios LIVE',75,75);
  rounded(c,820,102,305,340,34,'#1f2937');
  const logo=await safeLoadImage(station?.logo);
  if(logo){
    const ratio=Math.min(255/logo.width,265/logo.height);
    const w=logo.width*ratio,h=logo.height*ratio;
    c.drawImage(logo,972-w/2,265-h/2,w,h);
  } else {
    c.font='bold 155px sans-serif';c.fillStyle='#caff00';c.textAlign='center';c.fillText('♫',972,270);
    c.textAlign='left';
  }
  c.font='bold 55px sans-serif';c.fillStyle='#ffffff';
  const name=pick(station?.name||'iRadios',110);
  const lines=wrap(c,name,710,2);
  lines.forEach((line,index)=>c.fillText(line,55,200+index*72));
  c.font='28px sans-serif';c.fillStyle='#b7c4d1';
  const detail=[station?.genre,station?.city].map(x=>pick(x,55)).filter(Boolean).join('  ·  ');
  c.fillText(detail.slice(0,85),58,360,710);
  const show=todayShow(station||{});
  rounded(c,55,440,690,82,22,'#26323e');
  c.fillStyle='#caff00';c.font='bold 19px sans-serif';
  c.fillText(show?'ΣΤΟΝ ΑΕΡΑ':'ΑΚΟΥΣΕ ΖΩΝΤΑΝΑ',79,466);
  c.fillStyle='#ffffff';c.font='26px sans-serif';
  c.fillText(pick(show?show.title:(station?.slogan||'Συντονίσου στο iRadios'),120),79,500,630);
  c.strokeStyle='rgba(202,255,0,.3)';c.lineWidth=2;
  c.beginPath();c.moveTo(55,560);c.lineTo(1140,560);c.stroke();
  c.fillStyle='#d4dee9';c.font='22px sans-serif';c.fillText('iRadios · Online ραδιόφωνο',55,592);
  return canvas.toBuffer('image/png');
}
module.exports={approvedImage,todayShow,generateStationOgImage};
