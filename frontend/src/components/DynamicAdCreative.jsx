import React from 'react';
import {ArrowUpRight, Megaphone} from 'lucide-react';
import AdPlacementLink from './AdPlacementLink';
import '../styles/dynamic-ad-creative.css';

const validColor = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));
const safeLabel = value => String(value || 'Μάθε περισσότερα').trim().slice(0, 45);

/**
 * One structured creative, rendered natively in each listener placement.
 * Text, CTA and logo stay accessible HTML rather than being baked into pixels.
 * The same card geometry is shared by genre, region and home catalog grids.
 */
export default function DynamicAdCreative({
  banner, variant='card', placement='radio_feed', slotKey='', className=''
}) {
  if (!banner || !banner.imageUrl) return null;
  const accent = validColor(banner.brandColor) ? banner.brandColor : '#a855f7';
  const image = (variant==='card'||variant==='list') ?
    (banner.squareImageUrl || banner.imageUrl) : banner.imageUrl;
  const position = `${Math.min(100,Math.max(0,Number(banner.focalX ?? 50)))}% ${Math.min(100,Math.max(0,Number(banner.focalY ?? 50)))}%`;
  const title = String(banner.title||'').trim();
  const description = String(banner.description||'').trim();
  const text = <>
    <span className="ir-dynamic-ad-eyebrow"><Megaphone size={11}/> Διαφήμιση</span>
    {banner.logoUrl && <img className="ir-dynamic-ad-logo" src={banner.logoUrl} alt="" loading="lazy"/>}
    <span className="ir-dynamic-ad-title">{title}</span>
    {variant!=='card'&&<span className="ir-dynamic-ad-description">{description}</span>}
  </>;
  const props = {banner,placement,slotKey,className:`ir-dynamic-ad ir-dynamic-ad--${variant} ${className}`.trim()};
  if (variant==='card') return (
    <AdPlacementLink {...props} >
      <span className="ir-dynamic-ad-square">
        <img src={image} loading="lazy" alt="" style={{objectPosition:position}}/>
        <span className="ir-dynamic-ad-square-badge">ΔΙΑΦΗΜΙΣΗ</span>
      </span>
      <span className="ir-dynamic-ad-card-title">{title}</span>
      <span className="ir-dynamic-ad-card-detail">Sponsored · {description || 'Προτεινόμενη προσφορά'}</span>
      <span className="ir-dynamic-ad-card-cta" style={{backgroundColor:accent}}>
        {safeLabel(banner.ctaLabel)} <ArrowUpRight size={14}/>
      </span>
    </AdPlacementLink>
  );
  if (variant==='list') return (
    <AdPlacementLink {...props} >
      <span className="ir-dynamic-ad-list-image"><img src={image} alt="" loading="lazy" style={{objectPosition:position}}/></span>
      <span className="ir-dynamic-ad-list-copy">{text}</span>
      <span className="ir-dynamic-ad-list-action" style={{color:accent}}>
        {safeLabel(banner.ctaLabel)} <ArrowUpRight size={17}/>
      </span>
    </AdPlacementLink>
  );
  return (
    <AdPlacementLink {...props}>
      <img className="ir-dynamic-ad-cover" src={image} loading="lazy" alt="" style={{objectPosition:position}}/>
      <span className="ir-dynamic-ad-shade"/>
      <span className="ir-dynamic-ad-content">
        {text}
        <span className="ir-dynamic-ad-action" style={{backgroundColor:accent}}>
          {safeLabel(banner.ctaLabel)} <ArrowUpRight size={17}/>
        </span>
      </span>
    </AdPlacementLink>
  );
}
