'use strict';
/**
 * Audio creatives remain private in /uploads/audio. The public delivery route
 * resolves ONLY the local media owned by an active Ad document; callers never
 * provide a filename, path or URL. No external/production URL is fetched.
 */
const fs=require('node:fs/promises');
const path=require('node:path');

const ID_SEGMENT=/^[a-zA-Z0-9_-]{1,80}$/;
const FILE_SEGMENT=/^[a-zA-Z0-9_.-]{1,180}\.(mp3|wav|ogg)$/i;
const AUDIO_LIMIT=20*1024*1024;

function resolveAdAudioPath(storedUrl,{uploadRoot=path.join(process.cwd(),'uploads'),
  siteOrigin=process.env.FRONTEND_URL||'__IRADIOS_SITE_ORIGIN__'}={}) {
  if(typeof storedUrl!=='string'||!storedUrl.trim())return null;
  try {
    const origin=new URL(siteOrigin);
    const parsed=new URL(storedUrl,origin);
    // Never read an imported production path or use the server as an SSRF proxy.
    if(!['https:','http:'].includes(parsed.protocol)||parsed.origin!==origin.origin||
      parsed.username||parsed.password||parsed.search||parsed.hash)return null;
    const match=/^\/media\/audio\/([^/]+)\/([^/]+)$/.exec(parsed.pathname);
    if(!match||!ID_SEGMENT.test(match[1])||!FILE_SEGMENT.test(match[2])||
      match[2].includes('..'))return null;
    const base=path.resolve(uploadRoot,'audio');
    const file=path.resolve(base,match[1],match[2]);
    return file.startsWith(base+path.sep)?file:null;
  }catch{return null;}
}
async function localAudioFile(storedUrl,options={}) {
  const candidate=resolveAdAudioPath(storedUrl,options);
  if(!candidate)return null;
  const root=path.resolve(options.uploadRoot||path.join(process.cwd(),'uploads'),'audio');
  try{
    const [realRoot,realFile]=await Promise.all([fs.realpath(root),fs.realpath(candidate)]);
    // Symlink traversal is forbidden even when the candidate path looks safe.
    if(!realFile.startsWith(realRoot+path.sep))return null;
    const stat=await fs.stat(realFile);
    return stat.isFile()&&stat.size>=128&&stat.size<=AUDIO_LIMIT ? realFile:null;
  }catch{return null;}
}
async function sendAdAudio(res,storedUrl,{preview=false}={}){
  const file=await localAudioFile(storedUrl);
  if(!file){
    res.status(404).json({error:preview?'Το αρχείο δεν υπάρχει στον staging server. Ανέβασέ το ξανά.':'Audio unavailable'});
    return false;
  }
  res.set({
    'Cache-Control':preview?'private, no-store':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Accept-Ranges':'bytes'
  });
  return new Promise(resolve=>{
    // Express sendFile implements byte ranges, HEAD and partial 206 responses.
    res.sendFile(file,{acceptRanges:true,dotfiles:'deny'},err=>{
      if(err){
        if(!res.headersSent)res.status(err.status===416?416:404)
          .json({error:preview?'Το αρχείο δεν είναι διαθέσιμο στο staging. Ανέβασέ το ξανά.':'Audio unavailable'});
        resolve(false);
      }else resolve(true);
    });
  });
}
module.exports={resolveAdAudioPath,localAudioFile,sendAdAudio,AUDIO_LIMIT};
