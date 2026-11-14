import React, { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo';
import './preloader.css';

// A fast, non-blocking brand reveal. Playback, routes and APIs start independently.
const EQUALIZER_HEIGHTS = [7, 12, 18, 11, 26, 16, 22, 12, 8];

export default function Preloader() {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fade = window.setTimeout(() => setPhase('exit'), reducedMotion ? 120 : 560);
    const remove = window.setTimeout(() => setPhase('removed'), reducedMotion ? 150 : 830);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, []);

  if (phase === 'removed') return null;

  return (
    <div className={`ir-splash ir-splash--${phase}`} role="status" aria-label="Φόρτωση iRadios GR">
      <div className="ir-splash__ambient" aria-hidden="true" />

      <svg
        className="ir-splash__waves"
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path className="ir-splash__wave ir-splash__wave--primary"
          d="M-50 92 C 110 44 220 205 420 166 S 585 106 705 148" />
        <path className="ir-splash__wave ir-splash__wave--secondary"
          d="M-50 109 C 130 67 240 214 413 183 S 578 133 704 158" />
        <path className="ir-splash__wave ir-splash__wave--primary"
          d="M1490 92 C 1330 44 1220 205 1020 166 S 855 106 735 148" />
        <path className="ir-splash__wave ir-splash__wave--secondary"
          d="M1490 109 C 1310 67 1200 214 1027 183 S 862 133 736 158" />
      </svg>

      <div className="ir-splash__content">
        <div className="ir-splash__logo-wrap">
          <span className="ir-splash__beam" aria-hidden="true" />
          <BrandLogo variant="full" className="ir-splash__logo" title="iRadios GR" />
          <span className="ir-splash__glint" aria-hidden="true" />
        </div>
        <span className="ir-splash__tagline">YOUR SOUND. YOUR WORLD.</span>
        <div className="ir-splash__equalizer" aria-hidden="true">
          {EQUALIZER_HEIGHTS.map((height, index) => (
            <span
              key={index}
              style={{ '--bar-height': `${height}px`, '--bar-delay': `${index * -0.075}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
