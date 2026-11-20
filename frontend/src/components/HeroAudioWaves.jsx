import React,{useEffect,useRef} from 'react';
import {heroColor,heroAudioBands,heroWavePoints} from '../utils/heroAudioWaves';

// Visual-only, no second audio destination or DSP processing. WebDSP uses its
// existing output analyser. Raw playback is tapped via captureStream (where
// available), never createMediaElementSource on a cross-origin raw <audio>:
// doing that can mute a stream that does not publish CORS headers.
export default function HeroAudioWaves({audio,brandRgb}){
  const canvasRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)return;
    const rgb=heroColor(brandRgb);
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const activeAudio=Boolean(audio.playing);
    let alive=true,raf=0,sourceCtx=null,rawAnalyser=null,frequency=null,observed=null;
    let w=0,h=0,lastFrame=-Infinity,phase=0,smoothed={bass:0,mid:0,high:0};
    let resizeObserver=null;
    const resize=()=>{
      if(!alive)return;
      const rect=canvas.getBoundingClientRect();
      w=Math.max(1,rect.width);h=Math.max(1,rect.height);
      const dpr=Math.min(1.7,window.devicePixelRatio||1);
      canvas.width=Math.max(1,Math.round(w*dpr));
      canvas.height=Math.max(1,Math.round(h*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
      paint(0,true);
    };
    const analyzer=()=>{
      const current=audio.processing?audio.analyserRef?.current:rawAnalyser;
      if(current!==observed){
        observed=current||null;
        frequency=current?new Uint8Array(current.frequencyBinCount):null;
      }
      return current;
    };
    function paint(now,still=false){
      if(!w||!h)return;
      const noMotion=Boolean(reduced?.matches);
      let bass=0,mid=0,high=0,actualSignal=false;
      const meter=activeAudio&&!noMotion?analyzer():null;
      if(meter&&frequency){
        try{
          meter.getByteFrequencyData(frequency);
          const sample=heroAudioBands(frequency,meter.context?.sampleRate||48000,meter.fftSize);
          bass=sample.bass;mid=sample.mid;high=sample.high;
          actualSignal=sample.energy>.007;
        }catch{ /* Unsupported analyser: leave a calm ambient. */ }
      }
      const smooth=(previous,target)=>previous*.76+target*.24;
      smoothed={
        bass:smooth(smoothed.bass,bass),
        mid:smooth(smoothed.mid,mid),
        high:smooth(smoothed.high,high)
      };
      if(activeAudio&&!still&&!noMotion){
        // The waveform swells with ACTUAL sampled energy; a stream that cannot
        // be analysed only drifts softly and never fabricates artificial beats.
        phase+=actualSignal?.024+.058*smoothed.bass:.004;
      }
      ctx.clearRect(0,0,w,h);
      for(let layer=3;layer>=0;layer--){
        const alpha=[.68,.42,.32,.25][layer];
        const points=heroWavePoints(w,h,smoothed.bass,smoothed.mid,smoothed.high,
          layer,phase+layer*.23);
        const color='rgba('+rgb.join(',')+',';
        const gradient=ctx.createLinearGradient(0,h*.28,0,h*.95);
        gradient.addColorStop(0,color+'0)');
        gradient.addColorStop(.33,color+(alpha*.18)+')');
        gradient.addColorStop(.76,color+(alpha*.34)+')');
        gradient.addColorStop(1,color+'0)');
        ctx.beginPath();
        points.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
        ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();
        ctx.fillStyle=gradient;ctx.fill();
        ctx.beginPath();
        points.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
        ctx.strokeStyle=color+(alpha*.75)+')';
        ctx.lineWidth=Math.max(1,1.2+smoothed.bass*2.8);
        ctx.stroke();
      }
    }
    const tick=now=>{
      if(!alive||document.hidden)return;
      if(now-lastFrame>=32){
        paint(now);
        lastFrame=now;
      }
      raf=requestAnimationFrame(tick);
    };
    const onVisibility=()=>{
      cancelAnimationFrame(raf);
      if(!document.hidden&&activeAudio&&!reduced?.matches)raf=requestAnimationFrame(tick);
      else paint(0,true);
    };
    const onMotion=()=>onVisibility();
    if(activeAudio&&!audio.processing){
      const media=audio.rawRef?.current;
      const Ctx=window.AudioContext||window.webkitAudioContext;
      try{
        const capture=media?.captureStream||media?.mozCaptureStream;
        const stream=capture?.call(media);
        if(stream?.getAudioTracks?.().length&&Ctx){
          sourceCtx=new Ctx({latencyHint:'interactive'});
          const source=sourceCtx.createMediaStreamSource(stream);
          rawAnalyser=sourceCtx.createAnalyser();
          rawAnalyser.fftSize=2048;
          rawAnalyser.smoothingTimeConstant=.78;
          source.connect(rawAnalyser); // monitor only, do not route to speakers
          void sourceCtx.resume().catch(()=>{});
        }
      }catch{
        // Raw audio always continues normally even without spectrum access.
        void sourceCtx?.close()?.catch(()=>{});
        sourceCtx=null;rawAnalyser=null;
      }
    }
    resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
    resizeObserver?.observe(canvas);
    window.addEventListener('resize',resize);
    document.addEventListener('visibilitychange',onVisibility);
    reduced?.addEventListener?.('change',onMotion);
    resize();
    onVisibility();
    return()=>{
      alive=false;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener('resize',resize);
      document.removeEventListener('visibilitychange',onVisibility);
      reduced?.removeEventListener?.('change',onMotion);
      if(sourceCtx)void sourceCtx.close().catch(()=>{});
    };
  },[audio.playing,audio.processing,audio.analyserRef,audio.rawRef,brandRgb]);
  return <div className="ir-embed__hero-wave" aria-hidden="true">
    <canvas ref={canvasRef} className="ir-embed__hero-wave-canvas"/>
  </div>;
}
