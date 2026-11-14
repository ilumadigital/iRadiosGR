import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, Cookie, LockKeyhole, Settings2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { readConsent, saveConsent } from '../utils/consentMode';

const NOTHING = { analytics: false, ads: false, personalization: false };
const EVERYTHING = { analytics: true, ads: true, personalization: true };

function Choice({ title, detail, checked, onChange, disabled = false, locked = false }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-zinc-400">{detail}</span>
      </span>
      {locked ? <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#ccff00]"><LockKeyhole size={13}/> Πάντα ενεργά</span> :
        <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}
          className="h-5 w-5 shrink-0 cursor-pointer accent-[#ccff00] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={title}/>}
    </label>
  );
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [choices, setChoices] = useState(NOTHING);

  useEffect(() => {
    const stored = readConsent();
    if (!stored) setVisible(true);
    else setChoices(stored);
    const open = () => {
      setChoices(readConsent() || NOTHING);
      setExpanded(true);
      setVisible(true);
    };
    window.addEventListener('iradios:open-cookie-settings', open);
    return () => window.removeEventListener('iradios:open-cookie-settings', open);
  }, []);

  const complete = selection => {
    saveConsent(selection);
    setChoices(selection);
    setExpanded(false);
    setVisible(false);
  };

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
      <section role="region" aria-label="Ρυθμίσεις cookies και απορρήτου"
        className="pointer-events-auto mx-auto max-h-[min(85dvh,720px)] w-full max-w-5xl overflow-y-auto rounded-[24px] border border-white/15 bg-[#141719]/98 px-4 py-4 text-white shadow-[0_-14px_70px_rgba(0,0,0,.7)] backdrop-blur-2xl sm:px-6 sm:py-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ccff00]/15 bg-[#ccff00]/10 text-[#ccff00] sm:h-12 sm:w-12">
            {expanded ? <Settings2 size={23}/> : <Cookie size={23}/>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black tracking-tight sm:text-lg">Το απόρρητό σου, η επιλογή σου.</h2>
              <span className="rounded-md border border-[#ccff00]/25 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#ccff00]">Consent Mode v2</span>
            </div>
            <p className="max-w-3xl text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">
              Χρησιμοποιούμε απαραίτητα cookies για τη λειτουργία του iRadios. Με την άδειά σου,
              ενεργοποιούμε στατιστικά και τεχνολογίες διαφήμισης. Μπορείς να αρνηθείς ή να προσαρμόσεις
              τις επιλογές σου χωρίς να επηρεαστεί η ακρόαση.
              {' '}<Link to="/privacy" className="font-semibold text-zinc-200 underline underline-offset-2 hover:text-[#ccff00]">Πολιτική απορρήτου</Link>
            </p>
          </div>
        </div>

        {expanded && <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
          <Choice title="Απολύτως απαραίτητα" detail="Ασφάλεια, σύνδεση και βασικές λειτουργίες της εφαρμογής." checked locked/>
          <Choice title="Στατιστικά χρήσης" detail="Μέτρηση επισκεψιμότητας και απόδοσης (analytics_storage)."
            checked={choices.analytics} onChange={analytics => setChoices(c => ({ ...c, analytics }))}/>
          <Choice title="Διαφημιστική μέτρηση" detail="Αποθήκευση διαφήμισης και επεξεργασία διαφημιστικών δεδομένων (ad_storage, ad_user_data)."
            checked={choices.ads} onChange={ads => setChoices(c => ({ ...c, ads, personalization: ads ? c.personalization : false }))}/>
          <Choice title="Εξατομίκευση διαφημίσεων" detail="Επιλογή πιο σχετικών διαφημίσεων (ad_personalization)."
            checked={choices.personalization} disabled={!choices.ads}
            onChange={personalization => setChoices(c => ({ ...c, personalization }))}/>
        </div>}

        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="hidden items-center gap-2 text-[11px] text-zinc-500 lg:flex"><ShieldCheck size={15} className="text-[#ccff00]"/> Καμία προαιρετική κατηγορία δεν ενεργοποιείται χωρίς συγκατάθεση.</p>
          <div className="grid w-full grid-cols-1 gap-2 min-[460px]:grid-cols-3 sm:ml-auto sm:max-w-[620px]">
            <button type="button" onClick={() => complete(EVERYTHING)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ccff00] px-3 py-2.5 text-xs font-black text-black transition-colors hover:bg-[#dfff54]">
              <Check size={16}/> Αποδοχή όλων
            </button>
            <button type="button" onClick={() => complete(NOTHING)}
              className="min-h-11 rounded-xl border border-white/25 bg-white/[.05] px-3 py-2.5 text-xs font-black text-white transition-colors hover:bg-white/10">
              Απόρριψη όλων
            </button>
            {expanded ?
              <button type="button" onClick={() => complete(choices)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#ccff00]/45 bg-[#ccff00]/10 px-3 py-2.5 text-xs font-black text-[#ccff00] transition-colors hover:bg-[#ccff00]/20">
                <Check size={16}/> Αποθήκευση επιλογών
              </button> :
              <button type="button" onClick={() => setExpanded(true)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 px-3 py-2.5 text-xs font-black text-white transition-colors hover:bg-white/10">
                Επιλογές <ChevronRight size={15}/>
              </button>}
          </div>
        </div>
      </section>
    </div>
  );
}
