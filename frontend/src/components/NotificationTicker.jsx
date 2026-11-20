import React, { useEffect, useState } from 'react';
import { BellRing, Check, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

// Only shown after successful account creation, never on a timed page visit.
// Browser permission MUST be requested from the user's click, not from an effect.
const ONBOARDING_KEY = 'iradios_push_onboarding_user';
const supportsPush = () => typeof window !== 'undefined' &&
  window.isSecureContext && 'Notification' in window &&
  'serviceWorker' in navigator && 'PushManager' in window;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: 'Bearer ' + (localStorage.getItem('iluma_token') || '')
});

function vapidBytes(key) {
  const value = key.trim();
  const base64 = (value + '='.repeat((4 - value.length % 4) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

export default function NotificationTicker({ API_URL = '/api', currentUser }) {
  const userId = String(currentUser?._id || currentUser?.id || '');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dismiss = () => {
    sessionStorage.removeItem(ONBOARDING_KEY);
    setVisible(false);
  };

  useEffect(() => {
    let active = true;
    setVisible(false);
    setError('');
    if (!userId || currentUser?.role !== 'user' ||
        sessionStorage.getItem(ONBOARDING_KEY) !== userId) return undefined;
    if (!supportsPush() || Notification.permission === 'denied') {
      sessionStorage.removeItem(ONBOARDING_KEY);
      return undefined;
    }
    const check = async () => {
      // Do not prompt a device already linked to this account.
      try {
        const worker = await navigator.serviceWorker.getRegistration();
        const subscription = await worker?.pushManager?.getSubscription();
        if (subscription) {
          const response = await fetch(API_URL + '/notifications/my-device/status', {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
          if (response.ok && (await response.json()).registered) {
            sessionStorage.removeItem(ONBOARDING_KEY);
            return;
          }
        }
      } catch { /* Offer the manual opt-in when the check is temporarily unavailable. */ }
      if (active) setVisible(true);
    };
    check();
    return () => { active = false; };
  }, [userId, currentUser?.role, API_URL]);

  const enable = async () => {
    if (busy || !supportsPush()) return;
    setBusy(true);
    setError('');
    try {
      // First asynchronous operation is the native permission request.
      // Never invoke requestPermission automatically on mount or after a timer.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { dismiss(); return; }

      const registration = await navigator.serviceWorker.register('/sw.js');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const response = await fetch(API_URL + '/notifications/vapidPublicKey', { cache: 'no-store' });
        if (!response.ok) throw new Error('Η υπηρεσία Push δεν είναι διαθέσιμη.');
        const key = await response.text();
        if (!key.trim()) throw new Error('Δεν έχει ρυθμιστεί το Push.');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: vapidBytes(key)
        });
      }
      const saved = await fetch(API_URL + '/notifications/my-device', {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });
      const result = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error(result.error || 'Δεν αποθηκεύτηκε η συσκευή.');
      dismiss();
    } catch (failure) {
      setError(failure.message || 'Η ενεργοποίηση απέτυχε. Δοκίμασε ξανά.');
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <aside aria-label="Ενεργοποίηση ειδοποιήσεων" className="pointer-events-none fixed inset-x-3 top-[max(.75rem,env(safe-area-inset-top))] z-[180] sm:inset-x-5">
      <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-[#ccff00]/25 bg-[#131819]/95 px-4 py-3 text-white shadow-[0_12px_44px_rgba(0,0,0,.55)] backdrop-blur-xl sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-8 sm:pr-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ccff00]/12 text-[#ccff00]"><BellRing size={19}/></span>
          <div className="min-w-0">
            <strong className="block text-[13px] font-extrabold sm:text-sm">Ειδοποιήσεις iRadios</strong>
            <p className="text-[11px] leading-5 text-zinc-400 sm:text-xs">Νέα shows, αγαπημένοι σταθμοί και ενημερώσεις στο browser σου.</p>
            {error && <p role="alert" className="mt-1 text-xs text-red-300">{error} <Link to="/profile?tab=notifications" className="underline">Ρυθμίσεις</Link></p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={enable} disabled={busy}
            className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#ccff00] px-4 py-2 text-xs font-black text-black transition-colors hover:bg-[#dfff58] disabled:cursor-wait disabled:opacity-70 sm:flex-none">
            {busy ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
            Ενεργοποίηση
          </button>
          <button type="button" onClick={dismiss} disabled={busy} aria-label="Όχι τώρα"
            className="min-h-9 rounded-lg px-3 py-2 text-xs font-bold text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50">
            Όχι τώρα
          </button>
        </div>
        <button type="button" onClick={dismiss} disabled={busy} aria-label="Κλείσιμο ειδοποίησης"
          className="absolute right-5 top-4 text-zinc-500 transition-colors hover:text-white sm:static sm:ml-1 sm:shrink-0"><X size={16}/></button>
      </div>
    </aside>
  );
}
