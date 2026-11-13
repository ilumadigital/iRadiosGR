import React, { useState } from 'react';
import '../styles/fullscreen-player.css';

// Pure presentation: never touches the audio stream, recognized song, or playlist.
// Keep the artwork and DJ portrait mounted for a smooth, synchronized 20s RDS fade.
export default function FullscreenArtwork({
  station, songCover, producerImage, showProducer=false, adImage=null,
  onAdClick, onStationClick, className=''
}) {
  const [failedCover,setFailedCover]=useState('');
  const [failedProducer,setFailedProducer]=useState('');
  const selectedCover=adImage||songCover||station?.logo||'';
  const coverFailed=failedCover===selectedCover;
  const baseImage=coverFailed?(station?.logo||''):selectedCover;
  const hasArtwork=Boolean(!coverFailed&&(adImage||songCover));
  const activeProducer=Boolean(!adImage&&producerImage&&producerImage!==failedProducer);
  return (
    <div className={'ir-showcase-art relative '+className} onClick={adImage?onAdClick:undefined}>
      <img key={baseImage} src={baseImage} alt={hasArtwork?'Εξώφυλλο τρέχοντος τραγουδιού':'Λογότυπο '+(station?.name||'σταθμού')}
        className={'ir-showcase-art__base '+(hasArtwork?'':'ir-showcase-art__base--fallback')}
        onError={()=>{if(!coverFailed)setFailedCover(selectedCover);}}/>
      {activeProducer&&<img key={producerImage} src={producerImage}
        alt="" aria-hidden="true" className={'ir-showcase-art__dj '+(showProducer?'is-active':'')}
        onError={()=>setFailedProducer(producerImage)}/>}
      {(hasArtwork||activeProducer)&&<div className="ir-showcase-art__scrim" aria-hidden="true"/>}
      {!adImage&&station?.logo&&(
        onStationClick
          ? <button type="button" className="ir-showcase-art__brand ir-showcase-art__brand--link"
              title={'Άνοιγμα προφίλ '+station.name}
              aria-label={'Άνοιγμα προφίλ σταθμού '+station.name}
              onClick={event=>{event.stopPropagation();onStationClick();}}>
              <img src={station.logo} alt="" aria-hidden="true"/>
            </button>
          : <div className="ir-showcase-art__brand" title={station.name}>
              <img src={station.logo} alt={'Λογότυπο '+station.name}/>
            </div>
      )}
    </div>
  );
}
