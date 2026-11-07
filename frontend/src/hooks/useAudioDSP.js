import { useEffect, useRef, useCallback, useState } from 'react';

export default function useAudioDSP(audioRef, currentStation, currentAdInfo, isPlayingAd, isMobile, currentUser, userOverrides = {}) {
  const audioCtxRef = useRef(null); 
  const inputGainRef = useRef(null);
  const hpfRef = useRef(null);
  const lpfRef = useRef(null);
  const agcRef = useRef(null);
  const makeupGainRef = useRef(null);
  const limiterRef = useRef(null);
  const fadeGainRef = useRef(null);   
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const isUnlocked = useRef(false);
  
  // 🟢 ΝΕΟ: State για να ξέρει το React πότε φτιάχτηκε το κύκλωμα
  const [isDspReady, setIsDspReady] = useState(false);

  // Ανιχνευτής iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // 🔊 FADE ENGINE
  const fadeAudio = (targetVolume, duration = 1) => {
    if (!fadeGainRef.current || !audioCtxRef.current) return;
    try {
      const fadeNode = fadeGainRef.current.gain;
      const currTime = audioCtxRef.current.currentTime;
      fadeNode.cancelScheduledValues(currTime);
      fadeNode.setValueAtTime(fadeNode.value, currTime);
      fadeNode.linearRampToValueAtTime(targetVolume, currTime + duration);
    } catch(e) {
      fadeGainRef.current.gain.value = targetVolume;
    }
  };

  const resetVolumeToZero = () => { if (fadeGainRef.current) fadeGainRef.current.gain.value = 0; };
  const setVolumeToOne = () => { if (fadeGainRef.current) fadeGainRef.current.gain.value = 1; };

  // 🔓 THE ULTIMATE UNLOCKER
  const unlockAudioContext = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || isUnlocked.current) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const oscillator = ctx.createOscillator();
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0; 
    oscillator.connect(silentGain);
    silentGain.connect(ctx.destination);
    oscillator.start(0);
    oscillator.stop(ctx.currentTime + 0.001);
    isUnlocked.current = true;
  }, []);

  // 🎛️ CORE INITIALIZATION
  const initDSP = useCallback(() => {
    // 🛑 ΦΡΕΝΟ ΓΙΑ iOS: Το iOS παίζει καλύτερα με Hardware Decode (Raw URL)
    if (isIOS) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.crossOrigin = "anonymous"; 

    if (!audioCtxRef.current) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext({
          latencyHint: 'playback' 
        });
        audioCtxRef.current = ctx;

        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 128;

        sourceRef.current = ctx.createMediaElementSource(audio);
        
        inputGainRef.current = ctx.createGain(); 
        hpfRef.current = ctx.createBiquadFilter(); hpfRef.current.type = 'highpass'; 
        lpfRef.current = ctx.createBiquadFilter(); lpfRef.current.type = 'lowpass';  
        agcRef.current = ctx.createDynamicsCompressor(); 
        makeupGainRef.current = ctx.createGain();        
        limiterRef.current = ctx.createDynamicsCompressor(); 
        fadeGainRef.current = ctx.createGain();          
        fadeGainRef.current.gain.value = 1;

        sourceRef.current.connect(inputGainRef.current);
        inputGainRef.current.connect(hpfRef.current);
        hpfRef.current.connect(lpfRef.current);
        inputGainRef.current.connect(agcRef.current);
        agcRef.current.connect(makeupGainRef.current);
        makeupGainRef.current.connect(limiterRef.current);
        limiterRef.current.connect(fadeGainRef.current); 
        fadeGainRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);

        // 🟢 Ενημερώνουμε το React ότι το κύκλωμα είναι έτοιμο!
        setIsDspReady(true);

      } catch (error) { 
        console.error("DSP Init Error:", error); 
      }
    }
    unlockAudioContext();
  }, [audioRef, unlockAudioContext, isIOS]);

  useEffect(() => {
    const handleGlobalInteraction = () => { initDSP(); };
    window.addEventListener('touchstart', handleGlobalInteraction, { once: true });
    window.addEventListener('click', handleGlobalInteraction, { once: true });
    return () => {
      window.removeEventListener('touchstart', handleGlobalInteraction);
      window.removeEventListener('click', handleGlobalInteraction);
    };
  }, [initDSP]);

  const resumeDSP = useCallback(() => {
    initDSP();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(()=>{});
    }
  }, [initDSP]);

  // 🎚️ PRESETS ENGINE
  useEffect(() => {
    // 🛑 Σταματάμε αν το DSP δεν έχει αρχικοποιηθεί πλήρως
    if (!audioCtxRef.current || !inputGainRef.current || !isDspReady) return;

    let finalPreset = 'OFF';
    if (isPlayingAd && currentAdInfo) {
      finalPreset = currentAdInfo.dspPreset || 'OFF';
    } else if (currentStation) {
      finalPreset = currentStation.dspPreset || 'OFF';
      if (currentUser?.isPremium && currentUser?.favorites?.includes(currentStation._id)) {
        const userChoice = userOverrides[currentStation._id];
        if (userChoice && userChoice !== 'Station Default') finalPreset = userChoice;
      }
    }
    
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(()=>{});
    }

    const inputGain = inputGainRef.current.gain;
    const hpf = hpfRef.current.frequency;
    const lpf = lpfRef.current.frequency;
    const agc = agcRef.current;
    const makeupGain = makeupGainRef.current.gain;
    const limiter = limiterRef.current;

    // ΒΑΡΒΑΡΗ ΑΝΑΘΕΣΗ (Χωρίς scheduling που μπλοκάρει)
    const setDSP = (param, val) => {
      if (!param) return;
      try { param.value = val; } catch(e) {}
    };

    switch (finalPreset) {
      case 'OFF':
        setDSP(inputGain, 1.0); setDSP(hpf, 10.0); setDSP(lpf, 22000.0);
        setDSP(agc.threshold, 0.0); setDSP(agc.ratio, 1.0);
        setDSP(makeupGain, 1.0); setDSP(limiter.threshold, 0.0); setDSP(limiter.ratio, 1.0);
        break;
      case 'SOFT':
        setDSP(inputGain, 0.85); setDSP(hpf, 28.0); setDSP(lpf, 17800.0); 
        setDSP(agc.threshold, -28.0); setDSP(agc.ratio, 4.5); setDSP(agc.knee, 22.0); 
        setDSP(agc.attack, 0.1); setDSP(agc.release, 0.5); 
        setDSP(makeupGain, 1.55); setDSP(limiter.threshold, -1.0); setDSP(limiter.ratio, 15.0); 
        setDSP(limiter.attack, 0.003); setDSP(limiter.release, 0.08); 
        break;
      case 'NORMALIZE':
        setDSP(inputGain, 0.75); setDSP(hpf, 25.0); setDSP(lpf, 17500.0);
        setDSP(agc.threshold, -20.0); setDSP(agc.ratio, 3.5); setDSP(agc.knee, 15.0);
        setDSP(agc.attack, 0.05); setDSP(agc.release, 0.3);
        setDSP(makeupGain, 1.35); setDSP(limiter.threshold, -1.5); setDSP(limiter.ratio, 10.0); 
        setDSP(limiter.attack, 0.005); setDSP(limiter.release, 0.1);
        break;
      case 'ULTRABAND':
        setDSP(inputGain, 0.7); setDSP(hpf, 30.0); setDSP(lpf, 16500.0); 
        setDSP(agc.threshold, -25.0); setDSP(agc.ratio, 4.5); setDSP(agc.knee, 10.0);
        setDSP(agc.attack, 0.02); setDSP(agc.release, 0.25);
        setDSP(makeupGain, 1.55); setDSP(limiter.threshold, -1.0); setDSP(limiter.ratio, 12.0); 
        setDSP(limiter.attack, 0.003); setDSP(limiter.release, 0.08);
        break;
      case 'ULTRA':
        setDSP(inputGain, 0.65); setDSP(hpf, 35.0); setDSP(lpf, 16000.0); 
        setDSP(agc.threshold, -28.0); setDSP(agc.ratio, 5.5); setDSP(agc.knee, 8.0); 
        setDSP(agc.attack, 0.01); setDSP(agc.release, 0.2); 
        setDSP(makeupGain, 1.7); setDSP(limiter.threshold, -1.0); setDSP(limiter.ratio, 15.0); 
        setDSP(limiter.attack, 0.002); setDSP(limiter.release, 0.06); 
        break;
      case 'OMNIA':
        setDSP(inputGain, 0.8); setDSP(hpf, 40.0); setDSP(lpf, 17500.0); 
        setDSP(agc.threshold, -32.0); setDSP(agc.ratio, 7.0); setDSP(agc.knee, 7.0); 
        setDSP(agc.attack, 0.005); setDSP(agc.release, 0.15); 
        setDSP(makeupGain, 1.85); setDSP(limiter.threshold, -0.5); setDSP(limiter.ratio, 17.0); 
        setDSP(limiter.attack, 0.001); setDSP(limiter.release, 0.05); 
        break;
      case '0DB_LEVELER':
        setDSP(inputGain, 1.0); setDSP(hpf, 30.0); setDSP(lpf, 18000.0); 
        setDSP(agc.threshold, -35.0); setDSP(agc.ratio, 6.0); setDSP(agc.knee, 30.0); 
        setDSP(agc.attack, 0.2); setDSP(agc.release, 0.8); 
        setDSP(makeupGain, 1.8); setDSP(limiter.threshold, -0.3); setDSP(limiter.ratio, 20.0); 
        setDSP(limiter.attack, 0.001); setDSP(limiter.release, 0.05); 
        break;
      case 'HomeTheater':
        setDSP(inputGain, 0.8); setDSP(hpf, 20.0); setDSP(lpf, 18500.0); 
        setDSP(agc.threshold, -20.0); setDSP(agc.ratio, 3.0); setDSP(agc.knee, 20.0); 
        setDSP(agc.attack, 0.05); setDSP(agc.release, 0.3);
        setDSP(makeupGain, 1.25); setDSP(limiter.threshold, -1.5); setDSP(limiter.ratio, 10.0); 
        setDSP(limiter.attack, 0.005); setDSP(limiter.release, 0.1);
        break;
      case 'HiRes':
        setDSP(inputGain, 0.9); setDSP(hpf, 15.0); setDSP(lpf, 21000.0); 
        setDSP(agc.threshold, -15.0); setDSP(agc.ratio, 2.0); setDSP(agc.knee, 30.0); 
        setDSP(agc.attack, 0.1); setDSP(agc.release, 0.5);
        setDSP(makeupGain, 1.1); setDSP(limiter.threshold, -0.5); setDSP(limiter.ratio, 5.0); 
        setDSP(limiter.attack, 0.01); setDSP(limiter.release, 0.2);
        break;
      case 'Immersive3D':
        setDSP(inputGain, 0.85); setDSP(hpf, 25.0); setDSP(lpf, 22000.0); 
        setDSP(agc.threshold, -25.0); setDSP(agc.ratio, 1.5); setDSP(agc.knee, 25.0); 
        setDSP(agc.attack, 0.15); setDSP(agc.release, 0.80); 
        setDSP(makeupGain, 1.35); setDSP(limiter.threshold, -2.0); setDSP(limiter.ratio, 8.0); 
        setDSP(limiter.attack, 0.01); setDSP(limiter.release, 0.15);
        break;
      default:
        setDSP(inputGain, 1.0);
        break;
    }
  // 🟢 Προστέθηκε το isDspReady στο τέλος!
  }, [currentStation, isPlayingAd, currentAdInfo, currentUser, userOverrides, isDspReady]);

  return { analyserRef, fadeAudio, resetVolumeToZero, setVolumeToOne, resumeDSP };
}
