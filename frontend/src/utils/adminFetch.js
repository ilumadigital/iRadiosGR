// One request boundary for legacy Admin tools inside the player-free Backoffice.
// Only same-origin /api/ requests receive the session JWT. File uploads retain
// their original FormData/multipart handling; external URLs never receive tokens.
export function adminFetch(input,init={}){
  const requestUrl=typeof input==='string'?input:input?.url;
  let url;
  try{url=new URL(requestUrl,window.location.origin);}
  catch{return globalThis.fetch(input,init);}
  if(url.origin!==window.location.origin||
    (url.pathname!=='/api'&&!url.pathname.startsWith('/api/')))
    return globalThis.fetch(input,init);
  const token=localStorage.getItem('iluma_token');
  if(!token)return globalThis.fetch(input,init);
  const headers=new Headers(typeof Request!=='undefined'&&input instanceof Request?
    input.headers:undefined);
  new Headers(init.headers||{}).forEach((value,key)=>headers.set(key,value));
  headers.set('Authorization','Bearer '+token);
  return globalThis.fetch(input,{...init,headers});
}
