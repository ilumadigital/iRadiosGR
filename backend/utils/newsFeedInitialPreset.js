'use strict';
// One-time staging migration: replace legacy Newsbeast sources with the user's
// rssnews.io category/publisher selection. Later admin edits are preserved.
const VERSION='rssnews-selected-2026-11-08-v1';
const url=new URL('https://rssnews.io/');
url.searchParams.set('feed','my');
url.searchParams.set('c',"Ελλάδα,Business,Κόσμος,Αθλητικά,Τεχνολογία,Πολιτική,Lifestyle");
url.searchParams.set('s',"cnn.gr,capital.gr,greeco.gr,greekonomics.gr,greenbusiness.gr,in.gr,naftemporiki.gr,newsbeast.gr,newpost.gr,newsit.gr,protothema.gr,real.gr,rthess.gr,skai.gr,tanea.gr,thenewspaper.gr,thepressproject.gr,tovima.gr,unboxholics.com,zougla.gr,enikos.gr,enginepower.gr,eleftherostypos.gr,ertnews.gr,feeds.feedburner.com");
module.exports={VERSION,FEED_URL:url.href,FEED_LABEL:'Επιλεγμένες ειδήσεις'};
