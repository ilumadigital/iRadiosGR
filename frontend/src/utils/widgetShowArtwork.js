// Public producer photos have a strictly scoped same-origin fallback. The
// backend checks the photo URL against the approved station's schedule before
// retrieving anything, so this cannot become an open remote-image proxy.
export function widgetShowImageProxy(station,source){
  const id=String(station?._id||'');
  if(!/^[a-f0-9]{24}$/i.test(id)||
    typeof source!=='string'||!source||source.length>800)return null;
  let url;
  try{
    url=new URL(source);
    if(!['http:','https:'].includes(url.protocol))return null;
  }catch{return null;}
  return '/api/catalog/widget-show-image/'+encodeURIComponent(id)+
    '?image='+encodeURIComponent(source);
}
