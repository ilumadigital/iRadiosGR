'use strict';
// Only approved, public Station fields: never import or inspect playlist,
// accounts, billing, unpublished edits or protected now-playing metadata.
const {pick,short,links,stationSeo,stationUrl,stationId,urlFor,homeSeo} = require('./seo2Core');
const DAYS=['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'];
const LLMS_STATION_FIELDS=[
  '_id','slug','name','slogan','description','genre','secondaryGenre','secondaryGenres',
  'country','region','prefecture','city','transmissionType','frequency','website',
  'facebook','instagram','twitter','tiktok','logo','cover','isOffline',
  'schedule','scheduleDayBase','seoUpdatedAt'
].join(' ');
const APP_DESCRIPTION='Το iRadios είναι διαδικτυακή εφαρμογή για ανακάλυψη και '+
  'ζωντανή ακρόαση ελληνικών και διαδικτυακών ραδιοφωνικών σταθμών. '+
  'Διαθέτει δημόσια προφίλ, κατηγορίες, περιοχές, χάρτη και δημοσιευμένα προγράμματα.';
function md(value,max=12000){
  // One line, no raw HTML, markdown injection or generated link targets.
  return pick(value,max).replace(/([\\*_\[\]{}()!#>|~\x60])/g,'\\$1')
    .replace(/(^| )([-+])(?= )/g,'$1\\$2');
}
function httpsUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port?url.toString():'';
  }catch{return '';}
}
function mdLink(label,url){
  const target=httpsUrl(url);
  return target?'['+md(label,170)+']('+target.replace(/[()]/g,encodeURIComponent)+')':md(label,170);
}
function publicImage(value){
  if(typeof value!=='string'||value.length>2048)return '';
  if(value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\'))
    return /^\/(?:media\/(?:logo|visuals|radioassets)\/|iradios-|favicon)/.test(value)?
      urlFor(value):'';
  const url=httpsUrl(value);
  if(!url)return '';
  const host=new URL(url).hostname;
  return /^(?:localhost|.*\.local|127\..*|10\..*|192\.168\..*|169\.254\..*)$/i.test(host)?'':url;
}
function categories(st){
  return [...new Set([st.genre,st.secondaryGenre,
    ...(Array.isArray(st.secondaryGenres)?st.secondaryGenres:[])]
    .map(x=>pick(x,100)).filter(Boolean))];
}
function headline(){
  return [
    '# iRadios — ο πλήρης δημόσιος κατάλογος ραδιοφωνικών σταθμών',
    '',
    '> '+APP_DESCRIPTION,
    '',
    '## Πηγές για AI εργαλεία',
    '- '+mdLink('Οδηγός εφαρμογής',urlFor('/llms/application.md')),
    '- '+mdLink('Αναλυτικός πλήρης κατάλογος',urlFor('/llms-full.txt')),
    '- '+mdLink('Schema εφαρμογής (JSON-LD)',urlFor('/llms/schema/application.jsonld')),
    '- '+mdLink('Αρχική',urlFor('/')),
    '- '+mdLink('Χάρτης σταθμών',urlFor('/map')),
    '- '+mdLink('XML sitemap',urlFor('/sitemap.xml')),
    '',
    '## Όρια δημοσιευμένης πληροφορίας',
    'Περιλαμβάνονται μόνο εγκεκριμένοι σταθμοί. Ώρες προγράμματος: Europe/Athens.',
    'Οι περιγραφές, περιοχές και συχνότητες προέρχονται από δηλώσεις των σταθμών.',
    'Τα now-playing στοιχεία δεν αποτελούν μόνιμη playlist.',
    'Προστατευμένη playlist 30 λεπτών, Premium AI τραγούδια, προσωπικά στοιχεία, '+
      'δεδομένα χρεώσεων, κλειδιά και ανεγκεκριμένες αλλαγές δεν δημοσιεύονται.',
    ''
  ].join('\n');
}
function indexes(genres,regions){
  return ['## Μουσικές κατηγορίες',
    ...genres.map(x=>'- '+mdLink(x,urlFor('/llms/categories/'+encodeURIComponent(x)+'.md'))+
      ' · '+urlFor('/genre/'+encodeURIComponent(x))),
    '','## Περιοχές και πόλεις',
    ...regions.map(x=>'- '+mdLink(x,urlFor('/llms/regions/'+encodeURIComponent(x)+'.md'))+
      ' · '+urlFor('/region/'+encodeURIComponent(x))),'' ].join('\n');
}
function stationEntry(st){
  const facts=[
    categories(st).join(' / '),
    [pick(st.city,100),pick(st.region,100)].filter(Boolean).join(', '),
    st.transmissionType==='Επίγειο'?pick(st.frequency,30):''
  ].filter(Boolean).map(x=>md(x,250));
  const description=pick(st.description,4000)||pick(st.slogan,400);
  return '- '+mdLink(st.name,stationUrl(st))+
    (facts.length?' — '+facts.join(' · '):'')+
    (description?' — '+md(short(description,250),260):'')+
    ' · '+mdLink('Αναλυτικά',urlFor('/llms/stations/'+stationId(st)+'.md'))+'\n';
}
function stationDetails(st){
  const seo=stationSeo(st);
  const lines=[
    '# '+md(st.name,170),'',
    '- Canonical: '+seo.url,
    '- Markdown: '+urlFor('/llms/stations/'+stationId(st)+'.md'),
    '- JSON-LD: '+urlFor('/llms/schema/stations/'+stationId(st)+'.jsonld'),
    '- SEO title: '+md(seo.title,150),
    '- SEO description: '+md(seo.description,200),
    '- OG image: '+seo.image
  ];
  if(st.seoUpdatedAt&&!Number.isNaN(new Date(st.seoUpdatedAt).getTime()))
    lines.push('- Τελευταία αλλαγή δημόσιου προφίλ: '+new Date(st.seoUpdatedAt).toISOString());
  if(pick(st.slogan,400))lines.push('- Slogan: '+md(st.slogan,400));
  if(pick(st.description,12000))lines.push('','## Περιγραφή',md(st.description,12000));
  if(categories(st).length)lines.push('','## Δηλωμένες κατηγορίες',
    ...categories(st).map(x=>'- '+mdLink(x,urlFor('/genre/'+encodeURIComponent(x)))));
  const location=[st.city,st.prefecture,st.region,st.country]
    .map(x=>pick(x,100)).filter(Boolean);
  if(location.length)lines.push('','## Τοποθεσία','- '+md(location.join(', '),440));
  if(pick(st.transmissionType,40))lines.push('- Τύπος μετάδοσης: '+md(st.transmissionType,40));
  if(st.transmissionType==='Επίγειο'&&pick(st.frequency,30))
    lines.push('- Επίγεια συχνότητα: '+md(st.frequency,30));
  if(st.isOffline===true)lines.push('- Ο σταθμός έχει σημανθεί προσωρινά offline');
  const logo=publicImage(st.logo),cover=publicImage(st.cover);
  if(logo||cover)lines.push('','## Εικόνες');
  if(logo)lines.push('- Logo: '+logo);
  if(cover)lines.push('- Cover: '+cover);
  const publicLinks=links(st).map(httpsUrl).filter(Boolean);
  if(publicLinks.length)lines.push('','## Επίσημοι σύνδεσμοι',
    ...publicLinks.map(x=>'- '+mdLink(new URL(x).hostname,x)));
  if(seo.schedule.length)lines.push('','## Δημοσιευμένο εβδομαδιαίο πρόγραμμα (Europe/Athens)',
    ...seo.schedule.map(show=>'- '+DAYS[show.day-1]+' '+show.startTime+'–'+show.endTime+
      ' · '+md(show.title,130)+(show.host?' · '+md(show.host,100):'')+
      (show.description?' · '+md(show.description,600):'')));
  if(seo.faq.length)lines.push('','## Δημόσιες συχνές ερωτήσεις',
    ...seo.faq.flatMap(x=>['- **'+md(x.q,270)+'**','  '+md(x.a,1300)]));
  lines.push('','## Structured data',
    'Το canonical HTML περιέχει WebPage, RadioStation, BreadcrumbList, FAQPage'+
    (seo.schedule.length?', BroadcastService και BroadcastEvent.':'.'),
    'Ακριβές JSON-LD: '+urlFor('/llms/schema/stations/'+stationId(st)+'.jsonld'),
    'Δεν περιλαμβάνεται προστατευμένο ιστορικό playlist ή προσωπικά δεδομένα.','');
  return lines.join('\n')+'\n';
}
function applicationDocument(){
  return [
    '# iRadios — εφαρμογή, λειτουργίες και δημόσια δεδομένα','',
    APP_DESCRIPTION,'','## Δημόσιες λειτουργίες',
    '- Αρχική και live radio: '+urlFor('/'),
    '- Κατηγορίες: '+urlFor('/categories'),
    '- Χάρτης: '+urlFor('/map'),
    '- Εγκεκριμένα station profiles με περιγραφή, κατηγορίες και πραγματικό πρόγραμμα.',
    '- Το πρόγραμμα εμφανίζεται σε Europe/Athens, χωρίς εγγύηση ότι κάθε εκπομπή μεταδόθηκε.',
    '- Η playlist τελευταίων 30 λεπτών είναι διαθέσιμη σε συνδεδεμένους χρήστες '+
      'με τους ισχύοντες κανόνες επιβεβαίωσης. Ορισμένα AI τραγούδια απαιτούν Premium.',
    '- Πληροφορίες broadcasters: '+urlFor('/broadcast'),
    '- Πληροφορίες agencies: '+urlFor('/go-ads'),'',
    '## SEO και Schema.org',
    '- '+mdLink('Αρχική: Organization, WebSite, WebApplication, CollectionPage',
      urlFor('/llms/schema/application.jsonld')),
    '- Σταθμοί: WebPage, RadioStation, BreadcrumbList, FAQPage και, όπου υπάρχουν '+
      'εκπομπές, BroadcastService / BroadcastEvent.',
    '- Κατηγορίες / περιοχές: CollectionPage και ItemList στα HTML URL.',
    '- Sitemaps: '+urlFor('/sitemap.xml'),'',
    '## Αρχές ακρίβειας και προστασίας',
    '- Μόνο εγκεκριμένα δημόσια δεδομένα σταθμών, ποτέ pending ή rejected.',
    '- Τα δεδομένα δήλωσης ανήκουν στα δημοσιευμένα προφίλ των σταθμών.',
    '- Καμία δημόσια δημοσίευση προσωπικών στοιχείων λογαριασμών, '+
      'κρυφών streams, ιστορικού ακρόασης ή προστατευμένων AI τραγουδιών.',
    '- Οι FAQ έως 5 ανά σταθμό προέρχονται από την ίδια πηγή με το canonical JSON-LD.',
    '- Τα έγγραφα είναι δυναμικά, όχι χειροκίνητα αποσπάσματα.','',
    '## Κατάλογοι',
    '- '+urlFor('/llms.txt'),
    '- '+urlFor('/llms-full.txt'),
    '- '+urlFor('/sitemap.xml'),''
  ].join('\n');
}
function directoryIntro(kind,name){
  return ['# '+(kind==='category'?'Κατηγορία: ':'Περιοχή: ')+md(name,150),
    '',
    '- Canonical: '+urlFor((kind==='category'?'/genre/':'/region/')+
      encodeURIComponent(name)),
    '- Σταθμοί με εγκεκριμένο δημόσιο προφίλ.','',
    '## Σταθμοί',''].join('\n');
}
module.exports={LLMS_STATION_FIELDS,APP_DESCRIPTION,md,mdLink,categories,headline,
  indexes,stationEntry,stationDetails,applicationDocument,directoryIntro,
  schemaForApplication:stations=>homeSeo(stations).ld,
  schemaForStation:station=>stationSeo(station).ld};
