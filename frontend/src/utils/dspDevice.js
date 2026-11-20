// Only desktop browsers should instantiate the listener WebAudio DSP graph.
// Use device identity, NOT viewport size: narrow desktops still qualify.
export function isDesktopDSPDevice(nav=typeof navigator==='undefined'?null:navigator){
  if(!nav)return false;
  const ua=nav.userAgent||'';
  const ipadDesktopUA=nav.platform==='MacIntel'&&nav.maxTouchPoints>1;
  const mobileUA=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi|Tablet|Silk|Kindle/i.test(ua);
  const televisionUA=/Xbox|SMART-TV|Tizen|Web0S|WebOS|TV/i.test(ua);
  return nav.userAgentData?.mobile!==true&&!ipadDesktopUA&&!mobileUA&&!televisionUA;
}
