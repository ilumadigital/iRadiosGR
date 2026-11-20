'use strict';
// Editorial starting lineup for the staging Newsfeed (14 section-specific feeds).
// A one-time staging migration installs them; future admin changes stay intact.
const VERSION='newsbeast-sections-14-v1';
const sections=[
 ['greece','Ελλάδα'],['world','Κόσμος'],['politiki','Πολιτική'],
 ['financial','Οικονομία'],['sports','Αθλητικά'],['society','Κοινωνία'],
 ['environment','Περιβάλλον'],['media','Media'],['entertainment','Διασκέδαση'],
 ['travel','Ταξίδι'],['lifestyle','Lifestyle'],['technology','Τεχνολογία'],
 ['car','Auto'],['moto','Μότο']
];
const feeds=Object.freeze(sections.map(([slug,category])=>Object.freeze({
  slug,category,url:'https://www.newsbeast.gr/'+slug+'/feed'
})));
const categoryOfUrl=value=>{
  try{
    const u=new URL(value);
    if(u.hostname!=='www.newsbeast.gr'&&u.hostname!=='newsbeast.gr')return '';
    const slug=u.pathname.split('/').filter(Boolean)[0];
    return feeds.find(f=>f.slug===slug)?.category||'';
  }catch{return '';}
};
const sources=()=>feeds.map(f=>({
  id:'newsbeast-'+f.slug,type:'direct_rss',
  url:f.url,domain:'www.newsbeast.gr',category:f.category,
  label:'Newsbeast · '+f.category,enabled:true
}));
module.exports={VERSION,feeds,categoryOfUrl,sources};
