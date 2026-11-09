import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, MailCheck, Radio, ShieldCheck, AlertTriangle } from 'lucide-react';

// Accepting a station never uses the URL by itself as proof of ownership.
// The backend additionally requires a verified matching email, broadcaster role
// and current B2B terms acceptance.
export default function BroadcasterInvitation({ API_URL, currentUser, setCurrentUser }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const next = encodeURIComponent(token);
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [details, setDetails] = useState({ businessType: 'individual', companyName: '', vatNumber: '', confirmBroadcaster: false });
  const claimedOnce = useRef('');
  const base = API_URL || '/api';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMessage('');
    fetch(`${base}/broadcaster-invitations/preview?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Η πρόσκληση δεν είναι διαθέσιμη.');
        return data;
      }).then(data => { if (alive) setInvitation(data); })
      .catch(error => { if (alive) setMessage(error.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [base, token]);

  useEffect(() => {
    if (!invitation || !currentUser || currentUser.role !== 'broadcaster' ||
        !currentUser.isVerified || currentUser.hasAcceptedCurrentBroadcasterTerms !== true ||
        claimedOnce.current === token) return;
    claimedOnce.current = token;
    setClaiming(true);
    fetch(`${base}/broadcaster-invitations/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('iluma_token')}` },
      body: JSON.stringify({ token })
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Δεν ολοκληρώθηκε η ανάθεση.');
      setClaimed(true);
      setMessage(data.message);
    }).catch(error => setMessage(error.message))
      .finally(() => setClaiming(false));
  }, [base, token, currentUser, invitation]);

  const upgrade = async event => {
    event.preventDefault();
    setUpgradeBusy(true);
    setMessage('');
    try {
      const res = await fetch(`${base}/broadcaster-invitations/activate-broadcaster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('iluma_token')}` },
        body: JSON.stringify({ ...details, token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Αποτυχία ενεργοποίησης.');
      if (data.user && setCurrentUser) setCurrentUser(data.user);
      navigate(`/broadcaster-terms?invite=${next}`);
    } catch (error) { setMessage(error.message); setUpgradeBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#090909] text-white flex items-center justify-center p-4">
      <section className="w-full max-w-xl rounded-[32px] border border-white/10 bg-zinc-950 p-6 md:p-10 shadow-2xl">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ccff00]/10 text-[#ccff00]"><Radio size={30} /></div>
        <p className="text-xs uppercase tracking-[.2em] text-[#ccff00] font-black">iRadiosGR · Broadcaster Invitation</p>
        <h1 className="text-3xl font-black mt-2 mb-3">Πρόσκληση διαχείρισης σταθμού</h1>
        {loading ? <p className="flex gap-2 items-center text-zinc-400"><Loader2 className="animate-spin" /> Έλεγχος πρόσκλησης…</p> : (
          <>
            {invitation && <div className="mb-5 flex items-center gap-4 rounded-2xl border border-[#ccff00]/25 bg-[#0c121c] p-4 sm:p-5">
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                {invitation.station.logo
                  ? <img src={invitation.station.logo} alt={`Λογότυπο ${invitation.station.name}`} className="h-full w-full object-contain" />
                  : <Radio className="text-zinc-500" size={30} aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.17em] text-zinc-400">Σταθμός προς ανάθεση</p>
                <p className="break-words text-lg font-black leading-tight text-[#ccff00] sm:text-xl">{invitation.station.name}</p>
                <p className="mt-2 break-all text-xs text-zinc-400">Πρόσκληση για {invitation.email}</p>
              </div>
            </div>}
            {message && <p role="status" className={`mb-5 rounded-xl p-4 text-sm border ${claimed ? 'border-lime-500/30 bg-lime-500/10 text-lime-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>{message}</p>}
            {claimed ? (
              <div className="space-y-4">
                <p className="flex items-center gap-2 text-lime-300 font-bold"><CheckCircle2 /> Ο σταθμός είναι πλέον στη διαχείρισή σου.</p>
                <Link to="/backoffice" className="block text-center bg-[#ccff00] text-black font-black rounded-xl px-5 py-4">Άνοιγμα Broadcaster Backoffice</Link>
              </div>
            ) : invitation && claiming ? <p className="flex items-center gap-2 text-zinc-300"><Loader2 className="animate-spin" /> Ολοκλήρωση ασφαλούς ανάθεσης…</p>
              : invitation && !currentUser ? (
                <div className="space-y-3">
                  <p className="text-zinc-400 text-sm">Για να αποκτήσεις τον σταθμό, πρέπει να ολοκληρώσεις εγγραφή Broadcaster και επαλήθευση email.</p>
                  <Link className="block text-center bg-[#ccff00] text-black font-black p-4 rounded-xl" to={`/broadcast?invite=${next}`}><MailCheck className="inline mr-2" size={18} />Δημιουργία λογαριασμού Broadcaster</Link>
                  <Link className="block text-center bg-white/10 text-white font-bold p-4 rounded-xl" to={`/login?invite=${next}`}>Έχω ήδη λογαριασμό · Σύνδεση</Link>
                </div>
              ) : invitation && currentUser?.role === 'broadcaster' && !currentUser.hasAcceptedCurrentBroadcasterTerms ? (
                <div className="space-y-3">
                  <p className="text-zinc-300 text-sm">Αποδέξου τους ισχύοντες όρους Broadcaster για να ολοκληρωθεί η ανάθεση.</p>
                  <Link className="block text-center bg-[#ccff00] text-black font-black p-4 rounded-xl" to={`/broadcaster-terms?invite=${next}`}><ShieldCheck className="inline mr-2" size={18} />Συνέχεια στους όρους Broadcaster</Link>
                </div>
              ) : invitation && currentUser?.role === 'user' ? (
                <form onSubmit={upgrade} className="space-y-4">
                  <p className="text-zinc-400 text-sm">Έχεις λογαριασμό ακροατή. Συμπλήρωσε τα στοιχεία για να τον μετατρέψεις σε λογαριασμό Broadcaster. Η διαχείριση του σταθμού θα ενεργοποιηθεί μετά την αποδοχή των όρων.</p>
                  <label className="block text-sm">Ιδιότητα
                    <select value={details.businessType} onChange={e => setDetails({ ...details, businessType:e.target.value })} className="block w-full bg-black border border-white/20 rounded-xl p-3 mt-2">
                      <option value="individual">Φυσικό πρόσωπο</option><option value="company">Επιχείρηση</option>
                    </select>
                  </label>
                  {details.businessType === 'company' && <>
                    <input className="w-full p-3 bg-black border border-white/20 rounded-xl" required placeholder="Επωνυμία επιχείρησης" value={details.companyName} onChange={e=>setDetails({...details,companyName:e.target.value})} />
                    <input className="w-full p-3 bg-black border border-white/20 rounded-xl" required minLength={8} placeholder="ΑΦΜ" value={details.vatNumber} onChange={e=>setDetails({...details,vatNumber:e.target.value})} />
                  </>}
                  <label className="flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" className="mt-1" required checked={details.confirmBroadcaster} onChange={e=>setDetails({...details,confirmBroadcaster:e.target.checked})} />Επιβεβαιώνω τη μετατροπή του λογαριασμού μου σε Broadcaster.</label>
                  <button disabled={upgradeBusy} className="w-full bg-[#ccff00] text-black font-black p-4 rounded-xl disabled:opacity-50">{upgradeBusy ? 'Ενεργοποίηση…' : 'Συνέχεια στην εγγραφή Broadcaster'}</button>
                </form>
              ) : invitation && currentUser?.role !== 'broadcaster' && (
                <p className="flex gap-2 items-center text-amber-400 text-sm"><AlertTriangle size={18} /> Συνδέσου με λογαριασμό Broadcaster στο email της πρόσκλησης.</p>
              )}
          </>
        )}
      </section>
    </main>
  );
}
