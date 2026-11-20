// The embed may read a personalized snapshot only via the SAME protected
// /api/metadata endpoint as the App. Public embeds never expose Premium AI.
export function widgetSnapshot(publicData,accountData){
  const base=publicData&&typeof publicData==='object'?publicData:{};
  const native=base.source==='station'&&typeof base.title==='string'?base.title.trim():'';
  const hint=typeof base.broadcastHint==='string'?base.broadcastHint:'';
  const authenticated=accountData&&typeof accountData==='object'&&
    accountData.premiumOnly!==true&&
    typeof accountData.title==='string'&&accountData.title.trim()&&
    ['station','acrcloud'].includes(accountData.source)&&
    (accountData.source!=='acrcloud'||accountData.foundWithAI===true);
  if(authenticated){
    // Never fall back to an old private recognition after its server deadline.
    const expires=Date.parse(accountData.expiresAt||'');
    if(accountData.source!=='acrcloud'||
       (Number.isFinite(expires)&&expires>Date.now())){
      return {title:accountData.title.trim(),source:accountData.source,
        foundWithAI:accountData.source==='acrcloud',
        ...(accountData.source==='acrcloud'?{expiresAt:accountData.expiresAt}:{}),
        broadcastHint:typeof accountData.broadcastHint==='string'?
          accountData.broadcastHint:hint};
    }
  }
  return {title:native,source:native?'station':'none',foundWithAI:false,
    ...(hint?{broadcastHint:hint}:{})};
}

// Every verified track/show pair alternates track for 20s, show for 20s.
// Absence of a producer photo does not suppress the scheduled show.
export function widgetShowProducerNow(song,show,at=Date.now(),intervalMs=20000){
  return Boolean(show&&(!song||Math.floor(at/intervalMs)%2===1));
}

export function widgetOnAirPresentation({song,broadcast,showProducer,station}={}){
  const show=Boolean(broadcast?.recognizedShow&&(showProducer||!song));
  if(show)return {title:broadcast.title||station?.name||'Στον αέρα',
    artist:broadcast.artist||station?.name||'',kind:'show',image:broadcast.imageUrl||null};
  if(song)return {title:song.title,artist:song.artist,kind:'song'};
  if(broadcast?.show)return {
    title:broadcast.show.title||station?.name||'Στον αέρα',
    artist:broadcast.show.host||station?.name||'',kind:'show',
    image:broadcast.show.imageUrl||null
  };
  return {title:station?.slogan||station?.name||'Live Radio',
    artist:station?.name||'iRadios',kind:'station',image:null};
}
