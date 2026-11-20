import {compareCatalogPopularity} from './catalogLive.js';

// These are real iRadios primary/secondary labels, not additional categories.
// The graph is deliberately directional: a Greek-pop listener may discover
// international pop without turning every Greek genre into "foreign music".
const PRIMARY_NEIGHBORS = {
  'Dance':['Ηλεκτρονική','Διεθνή Mainstream','Εναλλακτικά'],
  'Ηλεκτρονική':['Dance','Εναλλακτικά','Διεθνή Mainstream'],
  'Διεθνή Mainstream':['Dance','Ελληνικά Επιτυχίες','Εναλλακτικά'],
  'Ροκ':['Εναλλακτικά','Έντεχνα'],
  'Εναλλακτικά':['Ροκ','Ηλεκτρονική','Έντεχνα'],
  'Ελληνικά Επιτυχίες':['Ελληνικά Λαϊκά','Έντεχνα','Διεθνή Mainstream'],
  'Ελληνικά Λαϊκά':['Ελληνικά Επιτυχίες','Έντεχνα','Παραδοσιακά'],
  'Έντεχνα':['Ελληνικά Επιτυχίες','Ροκ','Εναλλακτικά','Ελληνικά Λαϊκά'],
  'Παραδοσιακά':['Ελληνικά Λαϊκά','Έντεχνα','Θρησκευτικά'],
  'Ειδησεογραφικά':['Αθλητικά'],
  'Αθλητικά':['Ειδησεογραφικά'],
  'Θρησκευτικά':['Παραδοσιακά']
};
const SECONDARY_FAMILIES = [
  ['House','Afro House','Deep House','Tech House','Organic House','Melodic House','Progressive House'],
  ['Dance Pop','EDM','Disco','Pop','Indie Dance'],
  ['Electronica','Techno','Trance','EDM','Indie Dance'],
  ['Ambient','Chillout','Downtempo','Lounge','Organic House'],
  ['Cosmopolitan','Sophisticated','Lounge','Jazz','Soul','Funk','R&B'],
  ['Pop','Dance Pop','Indie Pop','Ελληνική Pop','80s','90s','00s'],
  ['Hip Hop','Rap','R&B','Funk','Soul'],
  ['Indie Rock','Alternative Rock','Classic Rock','Hard Rock','Blues','Ελληνικό Ροκ'],
  ['Indie Pop','Indie Rock','Alternative Rock','Ελληνικό Ροκ','Έντεχνο'],
  ['Reggae','Latin','Funk','Soul','Disco'],
  ['Classical','Jazz','Ambient','Sophisticated'],
  ['Ελληνική Pop','Έντεχνο','Ελληνικό Ροκ','Pop','Indie Pop'],
  ['Ρεμπέτικα','Σμυρναίικα','Έντεχνο','Ελληνική Pop'],
  ['Δημοτικά','Κρητικά','Νησιώτικα','Ποντιακά','Ηπειρώτικα','Θρακιώτικα','Μακεδονίτικα','Κυπριακά','Σμυρναίικα'],
  ['Βυζαντινά','Εκκλησιαστικά'],
  ['Πολιτική','Οικονομία','Τοπικές Ειδήσεις','Podcasts'],
  ['Αθλητικές Μεταδόσεις','Podcasts','Τοπικές Ειδήσεις']
];
const relations=new Map();
const addRelation=(a,b)=>{if(!a||!b||a===b)return; if(!relations.has(a))relations.set(a,new Set());relations.get(a).add(b);};
for(const [primary,others] of Object.entries(PRIMARY_NEIGHBORS)){
  for(const other of others)addRelation(primary,other);
}
for(const family of SECONDARY_FAMILIES){
  for(const item of family)for(const other of family)addRelation(item,other);
}
// Cross-language bridges for specific styles; these do not make all Greek
// radio a direct match for all international mainstream radio.
for(const [a,b] of [
  ['Ελληνική Pop','Διεθνή Mainstream'],['Ελληνικό Ροκ','Ροκ'],
  ['Έντεχνο','Έντεχνα'],['Αθλητικές Μεταδόσεις','Αθλητικά'],
  ['Πολιτική','Ειδησεογραφικά'],['Οικονομία','Ειδησεογραφικά'],
  ['Τοπικές Ειδήσεις','Ειδησεογραφικά'],['Εκκλησιαστικά','Θρησκευτικά'],
  ['Βυζαντινά','Θρησκευτικά'],['Dance Pop','Dance'],
  ['House','Ηλεκτρονική'],['EDM','Dance'],['Indie Rock','Εναλλακτικά']
]){addRelation(a,b);addRelation(b,a);}

const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const stationId=station=>String(station?._id||station?.id||'');

export function buildListeningInterests(stations,{listeningProfile={},favoriteStations=[],recentStations=[]}={},now=Date.now()){
  const byId=new Map(stations.map(s=>[stationId(s),s]));
  const weights=new Map();
  const add=(label,points)=>{if(label&&points>0)weights.set(label,(weights.get(label)||0)+points);};
  const mark=(station,points)=>{
    if(!station)return;
    add(station.genre,points);
    // Specific tastes (e.g. Deep House versus general Dance) matter most.
    add(station.secondaryGenre,points*1.65);
  };
  for(const [id,stat] of Object.entries(listeningProfile.stations||{})){
    const station=byId.get(id);
    if(!station)continue;
    const seconds=clamp(stat?.seconds,0,31_536_000);
    const sessions=clamp(stat?.sessions,0,100_000);
    if(seconds<30&&sessions===0)continue;
    const ageDays=Math.max(0,(now-clamp(stat.lastPlayedAt,0,now))/86_400_000);
    const recency=0.3+0.7*Math.exp(-ageDays/75);
    const points=(Math.min(55,Math.log1p(seconds/60)*9)+Math.min(24,sessions*4))*recency;
    mark(station,points);
  }
  for(const station of favoriteStations)mark(station,30);
  recentStations.forEach((station,i)=>mark(station,Math.max(1,8-i)));
  for(const [label,count] of Object.entries(listeningProfile.categories||{})){
    add(label,Math.min(25,clamp(count,0,20)*5));
  }
  return weights;
}
function orderByPopularity(stations){
  return [...stations].sort((a,b)=>compareCatalogPopularity(a,b));
}
function coldStart(stations){
  // One genre at a time per pass; stable, popularity-ranked within genres.
  const queues=new Map();
  for(const s of orderByPopularity(stations)){
    const category=s.genre||'Other';
    if(!queues.has(category))queues.set(category,[]);
    queues.get(category).push(s);
  }
  const result=[];
  while(result.length<stations.length){
    for(const queue of queues.values())if(queue.length)result.push(queue.shift());
  }
  return result;
}

// A repeating ten-card cadence: seven personal, two adjacent, one discovery.
// Missing buckets fall back to the best remaining candidate, never duplicates.
const MIX=['direct','direct','direct','related','direct','explore','direct','direct','related','direct'];
export function selectForYouStations(stations,options={}){
  const available=(stations||[]).filter(s=>stationId(s));
  const online=available.filter(s=>s.isOffline!==true);
  const offline=available.filter(s=>s.isOffline===true);
  const interests=buildListeningInterests(available,options);
  if(!interests.size)return [...coldStart(online),...coldStart(offline)];
  const score=station=>{
    const labels=[station.genre,station.secondaryGenre].filter(Boolean);
    const direct=labels.reduce((sum,label)=>sum+(interests.get(label)||0)*(label===station.secondaryGenre?1.25:1),0);
    let adjacent=0;
    for(const [label,points] of interests){
      if(relations.get(label)?.has(station.genre)||relations.get(label)?.has(station.secondaryGenre)){
        adjacent+=points*0.3;
      }
    }
    const own=options.listeningProfile?.stations?.[stationId(station)];
    // Reward taste, but make space for new radio from the same genres.
    const repeated=own?.sessions?Math.min(12,Math.log1p(own.sessions)*3):0;
    return {station,direct,adjacent,rank:direct*2+adjacent-repeated};
  };
  const arrange=items=>{
    const buckets={direct:[],related:[],explore:[]};
    for(const station of items){
      const item=score(station);
      buckets[item.direct>0?'direct':item.adjacent>0?'related':'explore'].push(item);
    }
    for(const pool of Object.values(buckets))pool.sort((a,b)=>b.rank-a.rank||compareCatalogPopularity(a.station,b.station));
    const result=[];
    for(let i=0;result.length<items.length;i++){
      const target=MIX[i%MIX.length];
      const next=(buckets[target].shift()||
        ['direct','related','explore'].map(k=>buckets[k][0]&&{key:k,item:buckets[k][0]}).filter(Boolean)
          .sort((a,b)=>b.item.rank-a.item.rank)[0]?.item);
      if(!next)break;
      if(buckets[target].includes(next))buckets[target].shift();
      else for(const pool of Object.values(buckets)){const index=pool.indexOf(next);if(index>=0){pool.splice(index,1);break;}}
      result.push(next.station);
    }
    return result;
  };
  return [...arrange(online),...arrange(offline)];
}
