import React from 'react';
import {useNavigate} from 'react-router-dom';
import {AudioLines, MapPin, Mic2, Radio, SignalHigh} from 'lucide-react';
import StationListenButton, {stationIsPlaying} from './StationListenButton';
import {formatStationTransmission} from '../utils/stationFrequency';
import {catalogStationInfo} from '../utils/catalogLive';

// Keep playback and station profile as two separate accessible actions.
export default function StationCatalogCard({
  station,currentStation,isPlaying,onPlayStation,onPlayPause,mode='grid',
  nowPlaying,clock
}){
  const navigate=useNavigate();
  const active=stationIsPlaying(station,currentStation,isPlaying);
  const offline=station?.isOffline === true;
  const profile=()=>navigate('/station/'+(station.slug||station._id));
  const meta=formatStationTransmission(station);
  const info=catalogStationInfo(station,nowPlaying,clock);
  const listen=<StationListenButton station={station} currentStation={currentStation}
    isPlaying={isPlaying} onPlayStation={onPlayStation} onPlayPause={onPlayPause}
    className={mode==='grid'?'w-full':'w-full sm:w-auto'}/>;
  if(mode==='list')return (
    <article className={'ir-catalog-row flex w-full min-w-0 flex-col gap-3 rounded-2xl border p-3 transition-colors sm:p-4 lg:flex-row lg:items-center lg:gap-5 '+
      (active?'border-[#ccff00]/45 bg-[#ccff00]/[.055]':'border-white/10 bg-[#141a20] hover:border-[#ccff00]/30')}>
      <button type="button" onClick={profile}
        className="grid w-full min-w-0 flex-1 grid-cols-1 items-center gap-3 text-left min-[540px]:grid-cols-2 lg:grid-cols-[minmax(190px,1.35fr)_minmax(115px,.7fr)_minmax(180px,1.25fr)_minmax(140px,1fr)] lg:gap-5"
        aria-label={'Προφίλ '+station.name}>
        <span className="flex min-w-0 items-center gap-3">
          <img src={station.logo||'/iradios-logo.png'} alt="" loading="lazy"
            className="size-14 shrink-0 rounded-xl border border-white/10 bg-white object-contain p-1 sm:size-16"/>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-white sm:text-base">{station.name}</span>
            {offline && <span className="text-[10px] font-black text-red-400">OFFLINE</span>}
            <span className="mt-1 flex items-center gap-1 truncate text-[11px] text-zinc-400">
              <SignalHigh size={13} className="shrink-0 text-[#ccff00]/80"/><span className="truncate">{meta}</span>
            </span>
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
          <MapPin size={14} className="shrink-0 text-[#ccff00]/70"/>
          <span className="truncate">{station.city||station.region||'Online'}</span>
        </span>
        <span className="flex min-w-0 items-start gap-2">
          <AudioLines size={15} className={'mt-0.5 shrink-0 '+(info.song?'text-[#ccff00]':'text-zinc-600')}/>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">Παίζει τώρα{info.song&&info.foundWithAI?' · AI':''}</span>
            {info.song?
              <span className="mt-0.5 block truncate text-xs font-semibold text-white" title={info.song.artist+' - '+info.song.title}>{info.song.artist} — {info.song.title}</span>
              :<span className="mt-0.5 block text-xs text-zinc-600">—</span>}
          </span>
        </span>
        <span className="flex min-w-0 items-start gap-2">
          <Mic2 size={15} className={'mt-0.5 shrink-0 '+(info.host||info.showTitle?'text-[#ccff00]':'text-zinc-600')}/>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">Στον αέρα</span>
            {info.host||info.showTitle?
              <span className="mt-0.5 block truncate text-xs font-semibold text-white" title={info.host||info.showTitle}>{info.host||info.showTitle}</span>
              :<span className="mt-0.5 block text-xs text-zinc-600">—</span>}
            {info.host&&info.showTitle&&info.host!==info.showTitle&&
              <span className="mt-0.5 block truncate text-[10px] text-zinc-400" title={info.showTitle}>{info.showTitle}</span>}
          </span>
        </span>
      </button>
      <div className="w-full shrink-0 sm:w-auto lg:ml-auto">{listen}</div>
    </article>
  );
  return (
    <article className={'ir-catalog-card group min-w-0 rounded-[22px] border p-2.5 transition-all hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,0,0,.35)] sm:p-3 '+
      (active?'border-[#ccff00]/50 bg-[#ccff00]/[.065]':'border-white/10 bg-[#141a20] hover:border-[#ccff00]/45')}>
      <button type="button" onClick={profile} className="block w-full text-left" aria-label={'Προφίλ '+station.name}>
        <div className="relative aspect-square overflow-hidden rounded-[17px] border border-white/10 bg-white">
          <img src={station.logo||'/iradios-logo.png'} alt="" loading="lazy"
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.035]"/>
          <span className={'absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black '+
            (offline?'bg-red-600 text-white':active?'bg-[#ccff00] text-black':'bg-black/80 text-white')}>
            {offline?null:<Radio size={10}/>} {offline?'OFFLINE':active?'LIVE':'RADIO'}
          </span>
        </div>
        <h3 className="mt-3 truncate text-sm font-black text-white group-hover:text-[#ccff00]">{station.name}</h3>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-400">
          <SignalHigh size={12} className="shrink-0 text-[#ccff00]/75"/><span className="truncate">{meta}</span>
        </div>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-zinc-500">
          <MapPin size={11} className="shrink-0"/><span className="truncate">{station.city||station.region||'Online'}</span>
        </p>
      </button>
      <div className="mt-3">{listen}</div>
    </article>
  );
}
