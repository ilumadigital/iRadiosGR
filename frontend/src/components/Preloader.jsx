import React, { useEffect, useState } from 'react';
import './preloader.css';
import BrandLogo from './BrandLogo';

// Branding transition only: never holds playback, navigation or API startup.
export default function Preloader() {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const fade = window.setTimeout(() => setPhase('exit'), 700);
    const remove = window.setTimeout(() => setPhase('removed'), 1120);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, []);

  if (phase === 'removed') return null;

  return (
    <div className={'ir-splash ir-splash--' + phase} role="status" aria-label="Φόρτωση iRadios GR">
      <div className="ir-splash__aura" aria-hidden="true" />
      <div className="ir-splash__content">
        <div className="ir-splash__symbol" aria-hidden="true">
          <span className="ir-splash__orbit" />
          <BrandLogo variant="icon" title="iRadios GR" />
        </div>
        <BrandLogo variant="full" className="ir-splash__brand" title="iRadios GR" />
        <span className="ir-splash__tagline">YOUR SOUND. YOUR WORLD.</span>
        <div className="ir-splash__track" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
