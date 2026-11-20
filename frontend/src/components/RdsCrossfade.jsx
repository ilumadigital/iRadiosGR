import React from 'react';
import '../styles/rds-transition.css';

// Keep both panes mounted so the view can crossfade instead of swapping nodes.
export default function RdsCrossfade({children,secondary,showSecondary=false,className=''}) {
  if(!secondary)return children;
  return <div className={`ir-rds-crossfade ${className}`}>
    <div className={`ir-rds-crossfade-pane ${showSecondary?'is-inactive':'is-active'}`}
      aria-hidden={Boolean(showSecondary)}>{children}</div>
    <div className={`ir-rds-crossfade-pane ${showSecondary?'is-active':'is-inactive'}`}
      aria-hidden={!showSecondary}>{secondary}</div>
  </div>;
}
