import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, CarFront, ShieldCheck, X} from 'lucide-react';
import {CAR_AUDIO_CHANGE_EVENT, detectCarAudioConnection, isPhoneClient}
  from '../utils/carAudioDetection';

const DISMISS_KEY = 'carModeDismissed';
const isDismissed = () => {
  try { return sessionStorage.getItem(DISMISS_KEY) === 'true'; }
  catch { return false; }
};
const dismissForSession = () => {
  try { sessionStorage.setItem(DISMISS_KEY, 'true'); }
  catch { /* Private browsing must not break the modal. */ }
};

/**
 * Confirmed car route only. Mobile browsers generally cannot inspect the
 * system's default Bluetooth route or CarPlay/Android Auto connection state.
 * Native wrappers can implement window.iRadiosCarAudioBridge.getConnectionState()
 * and dispatch "iradios:car-audio-change" on connect/disconnect.
 */
export default function CarModePrompt({onAccept, isPremium, audioRef}) {
  const [isVisible, setIsVisible] = useState(false);
  const primaryRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    if (!isPremium || !isPhoneClient(navigator) || isDismissed()) {
      setIsVisible(false);
      return undefined;
    }

    const evaluate = async () => {
      const currentRevision = ++revision;
      const result = await detectCarAudioConnection({
        nav: navigator, win: window, audioElement: audioRef?.current
      });
      if (!mounted || currentRevision !== revision) return;
      setIsVisible(result === 'connected' && !isDismissed());
    };
    const onResume = () => {
      if (document.visibilityState !== 'hidden') void evaluate();
    };
    void evaluate();
    window.addEventListener(CAR_AUDIO_CHANGE_EVENT, onResume);
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);
    navigator.mediaDevices?.addEventListener?.('devicechange', onResume);
    // No geolocation watcher, orientation heuristic, broad device-name
    // matching, device permission prompt or polling timer.
    return () => {
      mounted = false;
      revision++;
      window.removeEventListener(CAR_AUDIO_CHANGE_EVENT, onResume);
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
      navigator.mediaDevices?.removeEventListener?.('devicechange', onResume);
    };
  }, [isPremium, audioRef]);

  useEffect(() => {
    if (!isVisible) return undefined;
    primaryRef.current?.focus();
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setIsVisible(false);
        dismissForSession();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isVisible]);

  const dismiss = () => {
    setIsVisible(false);
    dismissForSession();
  };
  const activate = () => {
    setIsVisible(false);
    dismissForSession();
    onAccept?.();
  };

  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#040708]/85 p-4 backdrop-blur-xl sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="ir-car-mode-title"
        aria-describedby="ir-car-mode-description"
        className="relative isolate w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/15 bg-[#11181c] px-6 pb-6 pt-7 text-white shadow-[0_32px_100px_rgba(0,0,0,.65)] sm:rounded-[36px] sm:px-8 sm:pb-8 sm:pt-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 -z-10 size-72 rounded-full bg-[#ccff00]/[.09] blur-[70px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -left-24 -z-10 size-64 rounded-full bg-teal-400/[.07] blur-[80px]" />

        <button type="button" onClick={dismiss} aria-label="Κλείσιμο"
          className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ccff00]">
          <X size={18}/>
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6 flex size-24 items-center justify-center rounded-[29px] border border-[#ccff00]/20 bg-[#ccff00]/[.10] text-[#ccff00] shadow-[0_14px_45px_rgba(204,255,0,.1)]">
            <div aria-hidden="true" className="absolute inset-2 rounded-[22px] border border-[#ccff00]/15"/>
            <CarFront size={49} strokeWidth={1.7} aria-hidden="true"/>
            <div className="absolute -bottom-2 -right-2 flex size-8 items-center justify-center rounded-xl border-4 border-[#11181c] bg-[#ccff00] text-[#11181c]">
              <ShieldCheck size={19} strokeWidth={2.5} aria-hidden="true"/>
            </div>
          </div>

          <span className="mb-3 rounded-full border border-[#ccff00]/20 bg-[#ccff00]/[.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-[#ccff00]">
            iRadiosGR · Car Mode
          </span>
          <h2 id="ir-car-mode-title" className="max-w-[350px] text-[25px] font-black leading-[1.17] tracking-tight text-white sm:text-[29px]">
            Οδήγηση και κινητό, δεν πάνε μαζί!
          </h2>
          <p id="ir-car-mode-description" className="mt-4 max-w-[340px] text-[15px] font-medium leading-7 text-zinc-300">
            Βάλε τη λειτουργία οδήγησης και έχε τα μάτια σου στο δρόμο! Καλή Διαδρομή!
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <button ref={primaryRef} type="button" onClick={activate}
            className="flex min-h-[60px] w-full items-center justify-center gap-3 rounded-[18px] bg-[#ccff00] px-4 text-sm font-black text-[#0b1408] shadow-[0_12px_35px_rgba(204,255,0,.17)] transition hover:bg-[#deff54] active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <CarFront size={22} aria-hidden="true"/>
            Ενεργοποίηση Car Mode
            <ArrowRight size={19} aria-hidden="true"/>
          </button>
          <button type="button" onClick={dismiss}
            className="flex min-h-12 w-full items-center justify-center rounded-[16px] border border-white/10 bg-white/[.05] px-4 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/[.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ccff00]">
            Όχι τώρα
          </button>
        </div>
      </section>
    </div>
  );
}
