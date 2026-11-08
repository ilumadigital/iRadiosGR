import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, Send, Plus, X, Clock, User, AlignLeft, Type, Search, Link as LinkIcon, CalendarDays, Filter, Users, Star, Eye, Palette, Monitor, Smartphone, Loader2 } from 'lucide-react';

export default function AdminEmails({ API_URL }) {
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewType, setPreviewType] = useState('broadcasterInvite');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const emailTypes = [
    {id:'broadcasterInvite',label:'Πρόσκληση Broadcaster'},
    {id:'producerInvite',label:'Πρόσκληση Producer'},
    {id:'otp',label:'Επαλήθευση OTP'},
    {id:'welcome',label:'Καλωσόρισμα'},
    {id:'passwordReset',label:'Επαναφορά κωδικού'},
    {id:'adPayment',label:'Πληρωμή διαφήμισης'},
    {id:'adminTransaction',label:'Ενημέρωση διαχειριστή'},
    {id:'stationApproved',label:'Έγκριση σταθμού'},
    {id:'stationRejected',label:'Διόρθωση σταθμού'},
    {id:'broadcasterPremium',label:'Premium Broadcaster'},
    {id:'listenerPremium',label:'Premium Listener'},
    {id:'notification',label:'Email ειδοποίησης'},
    {id:'custom',label:'Δικό μου email'}
  ];


  // --- Search & Filter State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // --- Form State ---
  const [sendMethod, setSendMethod] = useState('dropdown'); // dropdown, manual, role
  const [selectedUser, setSelectedUser] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  const bodyRef = useRef(null);

  // 🟢 ΔΙΟΡΘΩΣΗ: Πλέον τα groups έχουν δική τους λογική φιλτραρίσματος (filterFn)
  const availableGroups = [
    { id: 'user', label: 'Απλοί Χρήστες (Users)', filterFn: (u) => u.role === 'user' && !u.isPremium },
    { id: 'premium_user', label: 'Premium Χρήστες', filterFn: (u) => u.isPremium === true }, // 👈 Εδώ είναι το μυστικό!
    { id: 'broadcaster', label: 'Ραδιοφωνικοί Σταθμοί', filterFn: (u) => u.role === 'broadcaster' },
    { id: 'producer', label: 'Παραγωγοί (Producers)', filterFn: (u) => u.role === 'producer' },
    { id: 'agency', label: 'Διαφημιστικές (Agencies)', filterFn: (u) => u.role === 'agency' },
    { id: 'all_users', label: 'Όλοι οι εγγεγραμμένοι χρήστες', filterFn: (u) => true } // Bonus: Αποστολή σε ΟΛΟΥΣ
  ];

  const getAuthHeaders = () => {
    const token = localStorage.getItem('iluma_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [histRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/admin/emails`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/users`, { headers: getAuthHeaders() })
      ]);

      if (histRes.ok) setHistory(await histRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (err) {
      console.error('Σφάλμα φόρτωσης δεδομένων:', err);
    }
    setLoading(false);
  };

  const openPreview = async (type = 'broadcasterInvite') => {
    setPreviewType(type);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewHtml('');
    try {
      const res = await fetch(`${API_URL}/admin/emails/preview`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type, subject, body })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Αδυναμία προεπισκόπησης.');
      setPreviewSubject(data.subject);
      setPreviewHtml(data.html);
    } catch (error) {
      setPreviewError(error.message || 'Αδυναμία σύνδεσης με τον server.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleInsertLink = () => {
    const url = prompt('Εισάγετε το URL (π.χ. __IRADIOS_SITE_ORIGIN__):');
    if (!url) return;
    const text = prompt('Εισάγετε το κείμενο που θα εμφανίζεται:', 'Κάντε κλικ εδώ');
    const linkText = text || 'Κάντε κλικ εδώ';
    
    const linkHTML = `<a href="${url}" target="_blank" style="color: #ccff00; text-decoration: underline;">${linkText}</a>`;
    
    if (bodyRef.current) {
      const startPos = bodyRef.current.selectionStart;
      const endPos = bodyRef.current.selectionEnd;
      const newBody = body.substring(0, startPos) + linkHTML + body.substring(endPos, body.length);
      setBody(newBody);
      
      setTimeout(() => {
        bodyRef.current.focus();
        bodyRef.current.selectionStart = startPos + linkHTML.length;
        bodyRef.current.selectionEnd = startPos + linkHTML.length;
      }, 0);
    } else {
      setBody(body + ' ' + linkHTML);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setSending(true);

    let payload = {
      bcc,
      subject,
      body,
      sendType: sendMethod // 'dropdown', 'manual', 'role'
    };

    if (sendMethod === 'role') {
      if (!selectedRole) {
        alert('Επίλεξε ομάδα / ρόλο.');
        setSending(false);
        return;
      }
      payload.targetRole = selectedRole;
      
      // 🟢 Χρησιμοποιούμε το filterFn για να βρούμε πόσοι είναι
      const activeGroup = availableGroups.find(g => g.id === selectedRole);
      const count = users.filter(activeGroup.filterFn).length;

      if (count === 0) {
        alert('Δεν υπάρχουν χρήστες σε αυτήν την ομάδα.');
        setSending(false);
        return;
      }

      if (!window.confirm(`Αυτό το email θα σταλεί σε ${count} χρήστες (${activeGroup.label}). Συνέχεια;`)) {
        setSending(false);
        return;
      }
    } else if (sendMethod === 'dropdown') {
      const u = users.find(user => user._id === selectedUser);
      if (!u) { alert('Επίλεξε έγκυρο χρήστη.'); setSending(false); return; }
      payload.to = u.email;
      payload.userId = selectedUser;
    } else {
      if (!manualEmail) { alert('Πληκτρολόγησε ένα έγκυρο email.'); setSending(false); return; }
      payload.to = manualEmail;
    }

    try {
      const res = await fetch(`${API_URL}/admin/emails/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        alert('Η αποστολή ολοκληρώθηκε επιτυχώς!');
        fetchData();
        setIsModalOpen(false);
        setSubject(''); setBody(''); setBcc(''); setManualEmail(''); setSelectedRole('');
      } else {
        alert(data.error || 'Σφάλμα κατά την αποστολή.');
      }
    } catch (err) {
      alert('Σφάλμα δικτύου. Ελέγξτε τη σύνδεσή σας.');
    }
    setSending(false);
  };

  const getProcessedHistory = () => {
    let processed = history.map(item => {
      const matchedUser = users.find(u => u._id === item.toUser || u.email === item.to);
      const fname = matchedUser?.fname || '';
      const lname = matchedUser?.lname || '';
      const company = matchedUser?.agencyProfile?.companyName || matchedUser?.broadcasterProfile?.companyName || '';
      const fullName = `${fname} ${lname}`.trim();
      return { ...item, enhancedData: { fullName, company } };
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      processed = processed.filter(item => {
        const { fullName, company } = item.enhancedData;
        const targetDesc = item.to || item.targetRole || '';
        
        switch (searchBy) {
          case 'email': return targetDesc.toLowerCase().includes(term);
          case 'name': return fullName.toLowerCase().includes(term);
          case 'company': return company.toLowerCase().includes(term);
          case 'subject': return item.subject.toLowerCase().includes(term);
          default:
            return (
              targetDesc.toLowerCase().includes(term) ||
              item.subject.toLowerCase().includes(term) ||
              fullName.toLowerCase().includes(term) ||
              company.toLowerCase().includes(term)
            );
        }
      });
    }

    processed.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return processed;
  };

  const displayHistory = getProcessedHistory();

  return (
    <div className="admin-legacy-page space-y-6 relative">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Mail className="text-[#ccff00]" size={28} />
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Emails & επικοινωνία</h2>
          </div>
          <p className="text-zinc-500 text-sm font-medium">Διαχείριση και αποστολή απευθείας emails στους χρήστες.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => openPreview()}
            className="flex items-center gap-2 border border-white/10 hover:border-[#ccff00]/50 bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl font-black text-xs transition-all">
            <Palette size={18} className="text-[#ccff00]"/> Email Design Preview
          </button>
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#ccff00] hover:bg-white text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95 whitespace-nowrap">
            <Plus size={18} /> Νέα αποστολή
          </button>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl mb-8 flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="relative w-full lg:w-1/2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Αναζήτηση email, ονόματος, θέματος..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white text-sm outline-none focus:border-[#ccff00]/50 transition-colors"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2">
            <Filter size={14} className="text-zinc-500" />
            <select value={searchBy} onChange={(e) => setSearchBy(e.target.value)} className="bg-transparent text-xs font-bold text-zinc-300 outline-none cursor-pointer uppercase tracking-widest">
              <option value="all">Όλα τα πεδία</option>
              <option value="email">Ομαδα/Email</option>
              <option value="name">Μονο Ονομα</option>
              <option value="company">Μονο Επωνυμια</option>
              <option value="subject">Μονο Θεμα</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2">
            <CalendarDays size={14} className="text-zinc-500" />
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-transparent text-xs font-bold text-zinc-300 outline-none cursor-pointer uppercase tracking-widest">
              <option value="newest">Πιο πρόσφατα</option>
              <option value="oldest">Παλαιότερα</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-zinc-400" />
            <h3 className="text-white font-bold uppercase tracking-widest text-sm">Ιστορικό αποστολών</h3>
          </div>
          <span className="text-xs font-mono text-zinc-500">{displayHistory.length} Αποτελέσματα</span>
        </div>
        
        {loading ? (
          <div className="p-10 text-center text-[#ccff00] animate-pulse">Φόρτωση ιστορικού...</div>
        ) : displayHistory.length === 0 ? (
          <div className="p-20 text-center text-zinc-500 font-medium">Δεν βρέθηκαν emails.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {displayHistory.map((email) => (
              <div key={email._id} className="p-6 hover:bg-white/5 transition-colors flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div>
                  <div className="text-white font-bold text-lg mb-1">{email.subject}</div>
                  <div className="flex items-center flex-wrap gap-3 text-xs text-zinc-400 font-medium">
                    
                    <span className="flex items-center gap-1 font-bold text-[#ccff00]">
                      {email.targetRole ? <><Users size={12}/> {availableGroups.find(g => g.id === email.targetRole)?.label || email.targetRole.toUpperCase()}</> : <><User size={12}/> {email.to}</>}
                    </span>

                    {email.enhancedData.fullName && <span className="text-zinc-500">({email.enhancedData.fullName})</span>}
                    {email.enhancedData.company && <span className="text-zinc-500">[{email.enhancedData.company}]</span>}
                    {email.bcc && <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/10">BCC: {email.bcc}</span>}
                    
                    {/* Νέο Badge για τον αριθμό παραληπτών (αν είναι Bulk) */}
                    {email.sendType === 'role' && email.recipientCount > 0 && (
                      <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 text-[10px] uppercase font-black tracking-wider">
                        Παραληπτες: {email.recipientCount}
                      </span>
                    )}

                  </div>
                </div>
                <div className="text-left md:text-right text-xs font-mono text-zinc-500">
                  {new Date(email.createdAt).toLocaleString('el-GR')}
                  <div className="mt-2 flex justify-start md:justify-end">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-[10px] uppercase font-black tracking-wider">Εσταλη</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exact server-rendered templates, not a lookalike React mockup. */}
      {previewOpen && (
        <div className="fixed inset-0 z-[350] bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 md:p-6" role="dialog" aria-modal="true" aria-label="Προεπισκόπηση email">
          <div className="w-full max-w-6xl max-h-[96dvh] flex flex-col rounded-[28px] bg-[#0e121a] border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-4 md:p-5 border-b border-white/10 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <p className="text-[10px] uppercase text-[#ccff00] tracking-widest font-black">iRadiosGR · Email Design System</p>
                <h3 className="text-lg md:text-xl font-black text-white">Προεπισκόπηση branded email</h3>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Κλείσιμο προεπισκόπησης"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"><X size={20}/></button>
            </div>
            <div className="px-4 md:px-5 py-3 border-b border-white/10 flex flex-wrap items-center gap-3">
              <select aria-label="Επιλογή τύπου email" value={previewType} onChange={e => openPreview(e.target.value)}
                className="bg-[#090d14] border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#ccff00] max-w-full">
                {emailTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <div className="flex rounded-xl p-1 bg-black/40 border border-white/10 gap-1" aria-label="Προεπισκόπηση συσκευής">
                <button type="button" aria-label="Desktop" aria-pressed={previewDevice === 'desktop'} onClick={() => setPreviewDevice('desktop')}
                  className={`p-2 rounded-lg ${previewDevice === 'desktop' ? 'bg-[#ccff00] text-black' : 'text-zinc-400 hover:text-white'}`}><Monitor size={17}/></button>
                <button type="button" aria-label="Mobile" aria-pressed={previewDevice === 'mobile'} onClick={() => setPreviewDevice('mobile')}
                  className={`p-2 rounded-lg ${previewDevice === 'mobile' ? 'bg-[#ccff00] text-black' : 'text-zinc-400 hover:text-white'}`}><Smartphone size={17}/></button>
              </div>
              <p className="text-xs text-zinc-400 flex-1 truncate">Θέμα: <span className="text-white">{previewSubject || '—'}</span></p>
            </div>
            <p className="px-5 py-2 text-xs bg-amber-500/5 text-amber-200 border-b border-white/5">
              Δοκιμαστική προεπισκόπηση · Δεν αποστέλλεται email. Οι demo σύνδεσμοι δεν είναι ενεργές προσκλήσεις.
            </p>
            <div className="flex-1 overflow-auto flex justify-center bg-[#070a0f] p-3 md:p-6">
              {previewLoading ? <div className="my-auto flex items-center gap-2 text-zinc-400"><Loader2 className="animate-spin" size={20}/> Φόρτωση προεπισκόπησης…</div> :
                previewError ? <p role="alert" className="my-auto text-red-400">{previewError}</p> :
                <iframe
                  title="iRadiosGR HTML email preview"
                  sandbox=""
                  srcDoc={previewHtml}
                  className="border-0 bg-[#080B12] rounded-xl shadow-2xl shrink-0 transition-all"
                  style={{ width: previewDevice === 'mobile' ? 'min(100%, 390px)' : 'min(100%, 760px)', height: '700px' }}
                />}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-10 md:pt-20 pb-10 px-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto custom-scrollbar">
          <div className="bg-zinc-950 border border-white/10 w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col my-auto">
            
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
              <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Send size={20} className="text-[#ccff00]"/> Νεο Email
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 border-b border-white/10">
              <form id="emailForm" onSubmit={handleSendEmail} className="space-y-6">
                
                <div>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400">Παραληπτης (To)</label>
                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/5 w-fit">
                      <button type="button" onClick={() => setSendMethod('dropdown')} className={`px-4 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-md transition-colors ${sendMethod === 'dropdown' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}>Ενας Χρηστης</button>
                      <button type="button" onClick={() => setSendMethod('role')} className={`px-4 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-md transition-colors ${sendMethod === 'role' ? 'bg-purple-500 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}>Ομαδα (Bulk)</button>
                      <button type="button" onClick={() => setSendMethod('manual')} className={`px-4 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-md transition-colors ${sendMethod === 'manual' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}>Χειροκινητα</button>
                    </div>
                  </div>
                  
                  {sendMethod === 'dropdown' && (
                    <select required value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#ccff00]/50 text-sm font-medium transition-colors">
                      <option value="">-- Επίλεξε Χρήστη --</option>
                      {users.map(u => {
                        const company = u.agencyProfile?.companyName || u.broadcasterProfile?.companyName;
                        const display = company ? `[${company}] ${u.fname} ${u.lname}` : `${u.fname} ${u.lname}`;
                        return (
                          <option key={u._id} value={u._id}>
                            {u.isPremium ? '⭐ ' : ''}{display} ({u.email})
                          </option>
                        );
                      })}
                    </select>
                  )}

                  {/* 🟢 ΤΟ ΝΕΟ DROPDOWN ΓΙΑ ΤΙΣ ΟΜΑΔΕΣ (Με σωστό filtering) */}
                  {sendMethod === 'role' && (
                    <div className="flex flex-col gap-2">
                      <select required value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-white outline-none focus:border-purple-500 text-sm font-medium transition-colors">
                        <option value="">-- Επίλεξε Ομάδα / Ρόλο --</option>
                        {availableGroups.map(group => {
                          const count = users.filter(group.filterFn).length;
                          return (
                            <option key={group.id} value={group.id} disabled={count === 0}>
                              {group.label} ({count} χρήστες)
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-[10px] text-zinc-500">
                        Τα emails θα σταλούν με ασφάλεια μέσω Bcc. Οι χρήστες δεν θα βλέπουν τα emails των υπολοίπων.
                      </p>
                    </div>
                  )}

                  {sendMethod === 'manual' && (
                    <input type="email" required placeholder="π.χ. client@domain.com" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#ccff00]/50 text-sm transition-colors" />
                  )}
                </div>

                {sendMethod !== 'role' && (
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">Κρυφη Κοινοποιηση (BCC) - Προαιρετικο</label>
                    <input type="email" placeholder="π.χ. admin@iradios.gr" value={bcc} onChange={(e) => setBcc(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#ccff00]/50 text-sm transition-colors" />
                  </div>
                )}

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2"><Type size={14}/> Θεμα</label>
                  <input type="text" required placeholder="Γράψε το θέμα του email..." value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#ccff00]/50 text-sm font-bold transition-colors" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"><AlignLeft size={14}/> Κειμενο (Υποστηριζει HTML)</label>
                    <button 
                      type="button" 
                      onClick={handleInsertLink}
                      className="flex items-center gap-1.5 text-xs text-[#ccff00] hover:text-white bg-[#ccff00]/10 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors font-bold"
                    >
                      <LinkIcon size={14} /> Εισαγωγη Link
                    </button>
                  </div>
                  
                  <textarea 
                    ref={bodyRef}
                    required 
                    rows="10" 
                    placeholder="Γράψε το μήνυμά σου... Μπορείς να χρησιμοποιήσεις <br> ή <b> αν θέλεις μορφοποίηση." 
                    value={body} 
                    onChange={(e) => setBody(e.target.value)} 
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#ccff00]/50 text-sm leading-relaxed transition-colors min-h-[200px] resize-y"
                  ></textarea>
                </div>
              </form>
            </div>

            <div className="p-6 bg-zinc-900/50 flex flex-wrap justify-end gap-3 rounded-b-[32px]">
              <button type="button" onClick={() => openPreview('custom')}
                className="px-5 py-3 rounded-xl font-bold text-sm text-[#ccff00] hover:bg-[#ccff00]/10 border border-[#ccff00]/30 flex items-center gap-2">
                <Eye size={16}/> Προεπισκόπηση
              </button>
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">Ακυρωση</button>
              <button type="submit" form="emailForm" disabled={sending} className={`flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg ${sendMethod === 'role' ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'bg-[#ccff00] hover:bg-[#aacc00] text-black'}`}>
                {sending ? 'Αποστολη...' : <><Send size={16}/> Αποστολη {sendMethod === 'role' && 'Ομαδας'}</>}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
