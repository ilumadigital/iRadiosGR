import React from 'react';
import {PRIMARY_CATEGORIES,SECONDARY_CATEGORIES,isPrimaryCategory,isSecondaryCategory} from '../utils/stationCategories';

// Legacy values stay in the database until explicitly reclassified.
export function PrimaryCategorySelect({value,onChange,className=''}){
  const valid=isPrimaryCategory(value);
  return <select required className={className} value={valid?value:''} onChange={e=>onChange(e.target.value)}>
    <option value="">{value&&!valid?`Παλιό είδος: ${value} — επίλεξε νέα κατηγορία`:'Επιλογή βασικής κατηγορίας...'}</option>
    {PRIMARY_CATEGORIES.map(item=><option key={item} value={item}>{item}</option>)}
  </select>;
}

export function SecondaryCategorySelect({value,onChange,className=''}){
  const valid=isSecondaryCategory(value);
  return <select required className={className} value={valid?value:''} onChange={e=>onChange(e.target.value)}>
    <option value="">{value&&!valid?`Παλιό υποείδος: ${value} — επίλεξε νέο`:'Επιλογή δευτερεύουσας κατηγορίας...'}</option>
    {SECONDARY_CATEGORIES.map(item=><option key={item} value={item}>{item}</option>)}
  </select>;
}
