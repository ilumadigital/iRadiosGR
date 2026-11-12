import React from 'react';
import {CheckCircle2, CircleAlert, Clock3, ShieldAlert} from 'lucide-react';

/** Database state is not proof of a successful delivery to a listener. */
export function campaignDeliveryState(campaign,kind='banner',stage=false,now=Date.now()) {
  if(!campaign)return {tone:'warn',title:'Άγνωστη',reason:'Δεν βρέθηκε καμπάνια.'};
  if(stage&&campaign.isStageCreative!==true)return {
    tone:'warn',title:'Δεν προβάλλεται στο staging',
    reason:'Εισαγμένη καμπάνια παραγωγής. Χρησιμοποίησε «Δοκιμή στο Staging» για ασφαλές αντίγραφο.'
  };
  if(campaign.status!=='active')return {
    tone:'warn',title:campaign.status==='pending'?'Αναμονή έγκρισης':'Ανενεργή',
    reason:campaign.status==='expired'?'Η καμπάνια έχει λήξει.':'Η καμπάνια δεν έχει ενεργοποιηθεί.'
  };
  if(campaign.expiresAt&&Date.parse(campaign.expiresAt)<=now)return {
    tone:'warn',title:'Έληξε',reason:'Η ημερομηνία λήξης έχει περάσει.'
  };
  if(kind==='banner'&&(!campaign.imageUrl||!campaign.targetUrl||!campaign.placement?.length))return {
    tone:'warn',title:'Ελλιπές creative',reason:'Χρειάζεται cover, URL προορισμού και placement.'
  };
  if(kind==='audio'&&!campaign.audioUrl)return {
    tone:'warn',title:'Λείπει ήχος',reason:'Δεν έχει οριστεί αρχείο MP3/WAV.'
  };
  return {tone:'ready',title:'Επιλέξιμη για προβολή',
    reason:'Η καμπάνια περνά τους κανόνες ενεργοποίησης. Η εμφάνιση εξαρτάται από placement, στόχευση, χρόνο και αναπαραγωγή.'};
}
export default function CampaignDeliveryStatus({campaign,kind='banner',stage=false}) {
  const state=campaignDeliveryState(campaign,kind,stage);
  const ready=state.tone==='ready';
  const Icon=ready?CheckCircle2:state.title==='Έληξε'?Clock3:stage&&!campaign?.isStageCreative?ShieldAlert:CircleAlert;
  return <span className={'inline-flex max-w-full items-start gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold leading-5 '+(ready?'border-emerald-500/20 bg-emerald-500/5 text-emerald-300':'border-amber-400/25 bg-amber-500/5 text-amber-200')} title={state.reason}>
    <Icon size={15} className="mt-0.5 shrink-0"/>
    <span>{state.title}<span className="ml-1 font-normal opacity-70">· {state.reason}</span></span>
  </span>;
}
