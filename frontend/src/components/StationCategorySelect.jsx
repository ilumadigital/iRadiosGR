import React from 'react';
import {PRIMARY_CATEGORIES,SECONDARY_CATEGORIES,isPrimaryCategory,isSecondaryCategory,
  normalizePrimaryCategory,secondaryForPrimary,normalizeSelectedSecondaries} from '../utils/stationCategories';

// Legacy "Έντεχνα" is displayed as "Έντεχνη"; database migration is not required.
export function PrimaryCategorySelect({value,onChange,className=''}) {
  const canonical=normalizePrimaryCategory(value);
  const valid=isPrimaryCategory(canonical);
  return <select required className={className} value={valid?canonical:''} onChange={e=>onChange(e.target.value)}>
    <option value="">{value&&!valid?`Παλιό είδος: ${value} — επίλεξε νέα κατηγορία`:'Επιλογή βασικής κατηγορίας...'}</option>
    {PRIMARY_CATEGORIES.map(item=><option key={item} value={item}>{item}</option>)}
  </select>;
}

// Multi-select is dependent on the primary category, with an enforced maximum of three.
export function SecondaryCategoriesSelect({primary,value,onChange,className=''}) {
  const options=secondaryForPrimary(primary);
  const chosen=normalizeSelectedSecondaries(primary,value);
  return <fieldset className={className} aria-label="Δευτερεύουσες κατηγορίες">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-semibold text-zinc-300">Επίλεξε έως 3 υποείδη</span>
      <span className="text-xs font-bold text-[#ccff00]" aria-live="polite">{chosen.length}/3</span>
    </div>
    {!primary?<p className="text-xs text-zinc-500">Επίλεξε πρώτα μία βασική κατηγορία.</p>:
      <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {options.map(item=>{
          const checked=chosen.includes(item);
          const disabled=chosen.length>=3&&!checked;
          return <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition ${checked?'border-[#ccff00]/60 bg-[#ccff00]/10 text-white':'border-white/10 bg-black/20 text-zinc-300'} ${disabled?'cursor-not-allowed opacity-40':'hover:border-white/30'}`}>
            <input type="checkbox" checked={checked} disabled={disabled}
              className="size-4 accent-[#ccff00]"
              onChange={e=>onChange(e.target.checked?[...chosen,item]:chosen.filter(name=>name!==item))}/>
            <span>{item}</span>
          </label>;
        })}
      </div>}
    {primary&&chosen.length===0&&<p className="mt-2 text-xs text-amber-300">Απαιτείται τουλάχιστον μία δευτερεύουσα κατηγορία.</p>}
  </fieldset>;
}

// Required commercial-break disclosure is about the station's own broadcast,
// NOT the iRadios network's audio or visual advertising.
export function CommercialAdsDisclosure({value,onChange}) {
  return <fieldset className="rounded-xl border border-white/10 bg-black/20 p-4">
    <legend className="px-1 text-xs font-bold text-white">Ο Σταθμός Μεταδίδει Κερδοσκοπικές Διαφημίσεις; *</legend>
    <div className="mt-2 flex flex-wrap gap-3">
      {[[true,'Ναι'],[false,'Όχι']].map(([answer,label])=>
        <label key={label} className={`inline-flex min-w-24 cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${value===answer?'border-[#ccff00] bg-[#ccff00]/10 text-white':'border-white/10 bg-black/30 text-zinc-300'}`}>
          <input type="radio" name="station-commercial-ads" required checked={value===answer}
            onChange={()=>onChange(answer)} className="accent-[#ccff00]"/>
          {label}
        </label>)}
    </div>
    <p className="mt-2 text-xs text-zinc-500">Αφορά τις εμπορικές διαφημίσεις που μεταδίδει ο ίδιος ο σταθμός.</p>
    {value===false&&<p className="mt-2 text-xs font-semibold text-[#ccff00]">Ο σταθμός θα εμφανίζεται και στη σελίδα «Χωρίς Διαφημίσεις».</p>}
  </fieldset>;
}

// Legacy single-select retained for old integrations; new registration/edit screens
// must use SecondaryCategoriesSelect to enforce the three-genre limit.
export function SecondaryCategorySelect({value,onChange,className=''}) {
  const valid=isSecondaryCategory(value);
  return <select required className={className} value={valid?value:''} onChange={e=>onChange(e.target.value)}>
    <option value="">Επιλογή δευτερεύουσας κατηγορίας...</option>
    {SECONDARY_CATEGORIES.map(item=><option key={item} value={item}>{item}</option>)}
  </select>;
}
