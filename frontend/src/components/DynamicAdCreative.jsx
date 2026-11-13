import React from 'react';
import {ArrowUpRight, Megaphone} from 'lucide-react';
import AdPlacementLink from './AdPlacementLink';
import {adDesignFor} from '../utils/adVisualDesign';
import '../styles/dynamic-ad-creative.css';

const validColor = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));
const safeLabel = value => String(value || 'Μάθε περισσότερα').trim().slice(0, 45);

/**
 * One structured creative, rendered natively in each listener placement.
 * Text, CTA and logo stay accessible HTML rather than being baked into pixels.
 * The same card geometry is shared by genre, region and home catalog grids.
 */
export default function DynamicAdCreative({
  banner, variant='card', placement='radio_feed', slotKey='', className='', preview=false, previewMobile=false
}) {
  if (!banner || !banner.imageUrl) return null;
  const accent = validColor(banner.brandColor) ? banner.brandColor : '#a855f7';
  const image = (variant==='card'||variant==='list') ?
    (banner.squareImageUrl || banner.imageUrl) : banner.imageUrl;
  const wide=['hero','strip','profile','news'].includes(variant);
  const design=wide?adDesignFor(banner,variant):null;
  const position=wide?`${design.imageX}% ${design.imageY}%`:
    `${Math.min(100,Math.max(0,Number(banner.focalX ?? 50)))}% ${Math.min(100,Math.max(0,Number(banner.focalY ?? 50)))}%`;
  const rgba=(hex,alpha)=>`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;
  const style={'--ir-ad-accent':accent};
  if(design)Object.assign(style,{
    '--ir-ad-desktop-height':design.desktopHeight+'px',
    '--ir-ad-mobile-height':design.mobileHeight+'px',
    '--ir-ad-visual-width':design.visualWidth+'%',
    '--ir-ad-zoom':design.zoom,
    '--ir-ad-opacity':design.overlay/100,
    '--ir-ad-shade-strong':rgba(design.overlayColor,design.overlay/100),
    '--ir-ad-shade-soft':rgba(design.overlayColor,Math.max(.08,design.overlay/250)),
    '--ir-ad-glow-layer':rgba(accent,design.glowIntensity/100),
    '--ir-ad-shade':design.overlayColor,
    '--ir-ad-secondary':design.secondaryColor,
    '--ir-ad-title-scale':design.titleScale/100,
    '--ir-ad-glow-opacity':design.glowIntensity/100,
  });
  const title = String(banner.title||'').trim();
  const description = String(banner.description||'').trim();
  const text = <>
    <span className="ir-dynamic-ad-eyebrow"><Megaphone size={11}/> Διαφήμιση</span>
    {banner.logoUrl && <img className="ir-dynamic-ad-logo" src={banner.logoUrl} alt="" loading="lazy"/>}
    <span className="ir-dynamic-ad-title">{title}</span>
    {variant!=='card'&&<span className="ir-dynamic-ad-description">{description}</span>}
  </>;
  const modifiers=wide?
    ` ir-dynamic-ad--layout-${design.layout} ir-dynamic-ad--effect-${design.effect} ir-dynamic-ad--align-${design.textAlign}${design.heightMode==='auto'?' ir-dynamic-ad--auto-height':''}${previewMobile?' ir-dynamic-ad--simulate-mobile':''}`: '';
  const props={banner,placement,slotKey,style,
    className:`ir-dynamic-ad ir-dynamic-ad--${variant}${modifiers} ${className}`.trim()};
  const Wrapper = preview ? 'div' : AdPlacementLink;
  const wrapperProps = preview ? {className:props.className,style:props.style} : props;
  if (variant==='card') return (
    <Wrapper {...wrapperProps} >
      <span className="ir-dynamic-ad-square">
        <img src={image} loading="lazy" alt="" style={{objectPosition:position}}/>
        <span className="ir-dynamic-ad-square-badge">ΔΙΑΦΗΜΙΣΗ</span>
      </span>
      <span className="ir-dynamic-ad-card-title">{title}</span>
      <span className="ir-dynamic-ad-card-detail">Sponsored · {description || 'Προτεινόμενη προσφορά'}</span>
      <span className="ir-dynamic-ad-card-cta" style={{backgroundColor:accent}}>
        {safeLabel(banner.ctaLabel)} <ArrowUpRight size={14}/>
      </span>
    </Wrapper>
  );
  if (variant==='list') return (
    <Wrapper {...wrapperProps} >
      <span className="ir-dynamic-ad-list-image"><img src={image} alt="" loading="lazy" style={{objectPosition:position}}/></span>
      <span className="ir-dynamic-ad-list-copy">{text}</span>
      <span className="ir-dynamic-ad-list-action" style={{color:accent}}>
        {safeLabel(banner.ctaLabel)} <ArrowUpRight size={17}/>
      </span>
    </Wrapper>
  );
  return (
    <Wrapper {...wrapperProps}>
      <img className="ir-dynamic-ad-cover" src={image} loading="lazy" alt="" style={{objectPosition:position}}/>
      <span className="ir-dynamic-ad-shade"/>
      <span className="ir-dynamic-ad-content">
        {text}
        <span className="ir-dynamic-ad-action" style={{backgroundColor:accent}}>
          {safeLabel(banner.ctaLabel)} <ArrowUpRight size={17}/>
        </span>
      </span>
    </Wrapper>
  );
}
