import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, LockKeyhole, Mail, Send, X } from 'lucide-react';

export default function StationContactModal({ open, onClose, station, currentUser, apiUrl = '/api' }) {
  const navigate = useNavigate();
  const closeButton = useRef(null);
  const sendingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const fullName = [currentUser?.fname, currentUser?.lname].filter(Boolean).join(' ').trim();
  const name = fullName && fullName !== 'iR User' ? fullName : currentUser?.username;

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setSending(false);
    sendingRef.current = false;
    setSent(false);
    setError('');
  }, [open, station?._id]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeydown = event => {
      if (event.key === 'Escape' && !sendingRef.current) closeRef.current?.();
    };
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeydown);
    };
  }, [open]);

  const goToLogin = () => {
    const next = '/station/' + encodeURIComponent(station?.slug || station?._id || '') + '?contact=1';
    navigate('/login?next=' + encodeURIComponent(next));
  };

  const submit = async event => {
    event.preventDefault();
    const clean = message.trim();
    if (!currentUser || sendingRef.current || sent || clean.length < 10 || clean.length > 2000) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      const token = localStorage.getItem('iluma_token');
      if (!token) throw new Error('Η σύνδεσή σου έληξε. Συνδέσου ξανά.');
      const response = await fetch(apiUrl + '/stations/' + encodeURIComponent(station._id) + '/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ message: clean })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || result.message || 'Δεν ήταν δυνατή η αποστολή.');
      setSent(true);
      setMessage('');
    } catch (sendError) {
      setError(sendError.message || 'Δεν ήταν δυνατή η αποστολή.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (!open || !station) return null;
  return createPortal(
    <div className="ir-station-contact-overlay" onMouseDown={event => {
      if (event.target === event.currentTarget && !sendingRef.current) onClose();
    }}>
      <section className="ir-station-contact-dialog" role="dialog" aria-modal="true"
        aria-labelledby="ir-station-contact-title" aria-describedby="ir-station-contact-description">
        <button ref={closeButton} type="button" className="ir-station-contact-close"
          aria-label="Κλείσιμο" onClick={onClose} disabled={sending}><X size={19} /></button>
        <div className="ir-station-contact-icon"><Mail size={25} /></div>
        <div className="ir-station-contact-eyebrow">IRADIOSGR · STATION CONNECT</div>
        <h2 id="ir-station-contact-title">Μήνυμα στο {station.name}</h2>
        <p id="ir-station-contact-description" className="ir-station-contact-muted">
          Επικοινώνησε απευθείας με τον σταθμό, μέσα από το iRadiosGR.
        </p>
        {!currentUser ? (
          <div className="mt-6">
            <div className="ir-station-contact-details">
              <strong className="flex items-center gap-2"><LockKeyhole size={15} className="text-[#ccff00]" /> Μόνο για συνδεδεμένα μέλη</strong>
              <span className="ir-station-contact-muted">Συνδέσου για να στείλεις μήνυμα. Θα επιστρέψεις αυτόματα εδώ.</span>
            </div>
            <button type="button" className="ir-station-contact-button" onClick={goToLogin}>Σύνδεση για αποστολή</button>
          </div>
        ) : sent ? (
          <div role="status" className="mt-7 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-[#ccff00]" />
            <h3 className="text-xl font-black text-white">Το μήνυμά σου στάλθηκε!</h3>
            <p className="ir-station-contact-muted mt-2">Ο σταθμός μπορεί να απαντήσει στο email σου.</p>
            <button type="button" className="ir-station-contact-button" onClick={onClose}>Τέλεια!</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="ir-station-contact-details">
              <span className="text-zinc-400">Αποστολέας</span>
              <strong>{name}</strong>
              <span className="ir-station-contact-muted">{currentUser.email}</span>
              <span className="ir-station-contact-muted">Ο σταθμός θα δει αυτά τα στοιχεία και θα μπορεί να σου απαντήσει.</span>
            </div>
            <label htmlFor="ir-station-contact-message" className="ir-station-contact-label">Το μήνυμά σου</label>
            <textarea id="ir-station-contact-message" className="ir-station-contact-textarea"
              value={message} onChange={event => setMessage(event.target.value)}
              minLength={10} maxLength={2000} required
              placeholder="Γράψε το μήνυμά σου προς τον σταθμό..." />
            <div className="mt-2 flex justify-between gap-3 text-[11px] text-zinc-400">
              <span>10–2.000 χαρακτήρες</span><span>{message.length}/2000</span>
            </div>
            {error && <p className="ir-station-contact-error" role="alert">{error}</p>}
            <button className="ir-station-contact-button" type="submit"
              disabled={sending || message.trim().length < 10 || message.trim().length > 2000}>
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              {sending ? 'Αποστολή...' : 'Αποστολή μηνύματος'}
            </button>
          </form>
        )}
      </section>
    </div>, document.body
  );
}
