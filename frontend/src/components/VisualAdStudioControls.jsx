import React from 'react';
import {AD_DESIGN_LIMITS,designPreset} from '../utils/adVisualDesign';

const selectClass='mt-1 w-full rounded-xl border border-white/10 bg-[#090b10] px-3 py-2.5 text-sm text-white focus:border-purple-400';
const layouts=[
  ['background','Full background'],['image-right','Εικόνα δεξιά'],
  ['image-left','Εικόνα αριστερά'],['center','Centered creative']
];
const effects=[
  ['clean','Clean'],['soft','Soft'],['glow','Glow'],
  ['vignette','Vignette'],['glass','Glass']
];
function Picker({label,value,items,onChange}){
  return <label className="block min-w-0 text-xs font-semibold text-zinc-300">{label}
    <select className={selectClass} value={value} onChange={e=>onChange(e.target.value)}>
      {items.map(([id,name])=><option key={id} value={id}>{name}</option>)}
    </select>
  </label>;
}
function Slider({label,value,min,max,step=1,onChange,unit=''}){
  return <label className="block min-w-0 text-xs font-semibold text-zinc-300">
    <span className="flex items-center justify-between gap-2"><span>{label}</span>
      <span className="font-mono text-purple-200">{value}{unit}</span></span>
    <input type="range" className="mt-2 w-full accent-purple-500" min={min} max={max} step={step}
      value={value} onChange={e=>onChange(Number(e.target.value))}/>
  </label>;
}
function Color({label,value,onChange}){
  return <label className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-300">
    {label}<span className="flex items-center gap-2"><span className="font-mono text-[10px] text-zinc-500">{value}</span>
    <input aria-label={label} type="color" value={value} onChange={e=>onChange(e.target.value)}
      className="h-9 w-12 cursor-pointer rounded-lg border border-white/10"/></span>
  </label>;
}
/** One saveable configuration per wide-placement, shared by Agency and Admin.
 * Height constraints are displayed and also validated by the backend.
 */
export default function VisualAdStudioControls({placement,design,onChange}){
  const bounds=AD_DESIGN_LIMITS[placement]||AD_DESIGN_LIMITS.home;
  const set=(field,value)=>onChange({...design,[field]:value});
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-zinc-400">Οι ρυθμίσεις αποθηκεύονται μόνο για το συγκεκριμένο placement.</p>
      <button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:text-white"
        onClick={()=>onChange(designPreset('default',placement))}>Reset to Recommended</button>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        ['default','Recommended'],['cinema','Cinema'],
        ['minimal','Minimal'],['spotlight','Spotlight']
      ].map(([value,label])=><button key={value} type="button" onClick={()=>onChange(designPreset(value,placement))}
        className="rounded-xl border border-purple-500/25 bg-purple-500/10 px-3 py-2.5 text-[11px] font-bold text-purple-100 hover:border-purple-400">
        {label}
      </button>)}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Picker label="Διάταξη εικόνας" value={design.layout} items={layouts} onChange={v=>set('layout',v)}/>
      <Picker label="Ευθυγράμμιση κειμένου" value={design.textAlign}
        items={ [['left','Αριστερά'],['center','Κέντρο'],['right','Δεξιά']] }
        onChange={v=>set('textAlign',v)}/>
      <Picker label="Ύψος" value={design.heightMode}
        items={ [['auto','Auto · προτεινόμενο'],['custom','Custom ύψος']] }
        onChange={v=>set('heightMode',v)}/>
      <Picker label="Εφέ" value={design.effect} items={effects} onChange={v=>set('effect',v)}/>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Slider label="Desktop ύψος" value={design.desktopHeight} min={bounds.desktop[0]} max={bounds.desktop[1]}
        step={10} unit="px" onChange={v=>set('desktopHeight',v)}/>
      <Slider label="Mobile ύψος" value={design.mobileHeight} min={bounds.mobile[0]} max={bounds.mobile[1]}
        step={10} unit="px" onChange={v=>set('mobileHeight',v)}/>
    </div>
    <p className="text-[11px] text-zinc-500">Όρια: Desktop {bounds.desktop[0]}–{bounds.desktop[1]}px · Mobile {bounds.mobile[0]}–{bounds.mobile[1]}px. Σε Auto το περιεχόμενο προσαρμόζεται μέσα στα ίδια όρια.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Slider label="Θέση εικόνας Χ" value={design.imageX} min={0} max={100} unit="%" onChange={v=>set('imageX',v)}/>
      <Slider label="Θέση εικόνας Υ" value={design.imageY} min={0} max={100} unit="%" onChange={v=>set('imageY',v)}/>
      <Slider label="Zoom εικόνας" value={design.zoom} min={1} max={1.6} step={0.05} unit="×" onChange={v=>set('zoom',v)}/>
      <Slider label="Πλάτος εικόνας" value={design.visualWidth} min={35} max={75} unit="%" onChange={v=>set('visualWidth',v)}/>
      <Slider label="Ένταση overlay" value={design.overlay} min={20} max={95} unit="%" onChange={v=>set('overlay',v)}/>
      <Slider label="Μέγεθος τίτλου" value={design.titleScale} min={85} max={120} step={5} unit="%" onChange={v=>set('titleScale',v)}/>
      <Slider label="Glow intensity" value={design.glowIntensity} min={0} max={70} step={5} unit="%" onChange={v=>set('glowIntensity',v)}/>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Color label="Overlay χρώμα" value={design.overlayColor} onChange={v=>set('overlayColor',v)}/>
      <Color label="Δεύτερο χρώμα" value={design.secondaryColor} onChange={v=>set('secondaryColor',v)}/>
    </div>
  </div>;
}
