import React from 'react';

// The official, designer-supplied PNG masters in frontend/public are the only
// application logo assets. Do not trace or reconstruct them from SVG geometry.
const LOGO_ASSETS = Object.freeze({
  full: '/iradios-app-logo.png',
  wordmark: '/noicon-iradios-app-logo.png',
  icon: '/icon-tr.png',
});

export default function BrandLogo({
  variant = 'full',
  className = '',
  title = 'iRadios GR',
  style,
  ...rest
}) {
  const icon = variant === 'icon';
  const src = LOGO_ASSETS[variant] || LOGO_ASSETS.full;
  return (
    <img
      src={src}
      alt={title}
      width={icon ? 48 : 200}
      height={icon ? 48 : 56}
      className={className}
      style={{ objectFit: 'contain', ...style }}
      loading="eager"
      decoding="async"
      draggable={false}
      {...rest}
    />
  );
}
