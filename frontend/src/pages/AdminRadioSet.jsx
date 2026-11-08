import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useState, useEffect } from 'react';
import { 
  Search, Radio, UserPlus, X, Save, Mic2, ShieldAlert, CheckCircle2, AlertTriangle, Loader2,
  Mail, Send, RefreshCw, Ban
} from 'lucide-react';

export default function AdminRadioSet({ API_URL }) {
  const [stations, setStations] = useState([]);
  const [broadcasters, setBroadcasters] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedBroadcasterId, setSelectedBroadcasterId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [modalTab, setModalTab] = useState('assign');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState(null);
  const getLatestInvite = stationId => invitations.find(i => String(i.stationId) === String(stationId));


  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('iluma_token')}`
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 🟢 ΔΙΟΡΘΩΣΗ: Το σωστό endpoint για όλους τους σταθμούς είναι το /stations/all
      const resStations = await fetch(`${API_URL}/stations/all`, { headers: getAuthHeaders() });
      const resUsers = await fetch(`${API_URL}/admin/users`, { headers: getAuthHeaders() });
      const resInvites = await fetch(`${API_URL}/admin/broadcaster-invitations`, { headers: getAuthHeaders() });
      if (resInvites.ok) {
        const data = await resInvites.json();
        setInvitations(data.invitations || []);
      } else {
        setInvitations([]);
      }

      if (resStations.ok && resUsers.ok) {
        const stationsData = await resStations.json();
        const usersData = await resUsers.json();

        setStations(stationsData);
        // Κρατάμε ΜΟΝΟ όσους έχουν ρόλο 'broadcaster' για το Select του Modal
        setBroadcasters(usersData.filter(u => u.role === 'broadcaster'));
      }
    } catch (error) {
      console.error("Σφάλμα φόρτωσης δεδομένων:", error);
    }
    setLoading(false);
  };

  const handleOpenModal = (station) => {
    setSelectedStation(station);
    setSelectedBroadcasterId(station.broadcasterId?._id || station.broadcasterId || '');
    setModalTab(station.broadcasterId ? 'assign' : 'invite');
    setInviteEmail(getLatestInvite(station._id)?.email || station.email || '');
    setInviteFeedback(null);
    setIsModalOpen(true);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/stations/${selectedStation._id}/assign`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ broadcasterId: selectedBroadcasterId || null }) // Αν είναι κενό, τον κάνει unassign
      });

      if (res.ok) {
        await fetchData(); // Ανανεώνουμε τα δεδομένα
        setIsModalOpen(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Σφάλμα κατά την ανάθεση.');
      }
    } catch (error) {
      alert('Αποτυχία επικοινωνίας με τον server.');
    }
    setActionLoading(false);
  };

  const handleSendInvite = async (event) => {
    event.preventDefault();
    if (!selectedStation || selectedStation.broadcasterId) return;
    setActionLoading(true);
    setInviteFeedback(null);
    try {
      const res = await fetch(`${API_URL}/admin/stations/${selectedStation._id}/broadcaster-invitations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: inviteEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Η αποστολή απέτυχε.');
      setInviteFeedback({ success: true, text: 'Η πρόσκληση στάλθηκε στο ' + inviteEmail.trim() });
      await fetchData();
    } catch (error) {
      setInviteFeedback({ success: false, text: error.message });
    } finally { setActionLoading(false); }
  };

  const handleRevokeInvite = async (invitationId) => {
    if (!window.confirm('Θέλεις να ανακαλέσεις την εκκρεμή πρόσκληση;')) return;
    setActionLoading(true);
    setInviteFeedback(null);
    try {
      const res = await fetch(`${API_URL}/admin/broadcaster-invitations/${invitationId}`, {
        method: 'DELETE', headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Η ανάκληση απέτυχε.');
      setInviteFeedback({ success: true, text: 'Η πρόσκληση ανακλήθηκε.' });
      await fetchData();
    } catch (error) {
      setInviteFeedback({ success: false, text: error.message });
    } finally { setActionLoading(false); }
  };

  const filteredStations = stations.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.genre?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-legacy-page space-y-6 text-white">
      
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-[#ccff00]/10 rounded-2xl border border-[#ccff00]/20">
            <Radio className="text-[#ccff00]" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-wider">Αναθέσεις σταθμών</h1>
            <p className="text-zinc-500 text-sm font-medium mt-1">Επίλεξε σταθμό, διάλεξε τον υπεύθυνο Broadcaster και αποθήκευσε την ανάθεση.</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Αναζήτηση σταθμού (όνομα, είδος)..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-zinc-900/50 border border-white/10 h-12 rounded-xl pl-12 pr-4 text-sm focus:outline-none focus:border-[#ccff00]/50 transition-all text-white font-bold" 
          />
        </div>
      </div>

      <p role="status" className="mb-4 text-xs font-semibold text-zinc-400">
        {filteredStations.length} από {stations.length} σταθμούς
      </p>
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-[#ccff00]" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStations.map(station => {
            
            // 🟢 ΛΟΓΙΚΗ ΓΙΑ TO STATUS ΤΟΥ ΣΤΑΘΜΟΥ
            const broadcaster = station.broadcasterId;
            const isOrphan = !broadcaster; // Δεν υπάρχει καθόλου (π.χ. διεγράφη ο χρήστης)
            const isAdmin = broadcaster?.role === 'admin'; // Ανήκει σε Admin
            const pendingInvite = isOrphan && getLatestInvite(station._id)?.status === 'pending'
              ? getLatestInvite(station._id) : null;
            
            return (
              <div key={station._id} className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-white/10 transition-all flex flex-col justify-between min-h-[220px]">
                
                {/* Background Glow */}
                <div className={`absolute -top-10 -right-10 w-32 h-32 blur-[50px] rounded-full pointer-events-none transition-all ${isOrphan ? 'bg-red-500/10' : isAdmin ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}></div>
                
                <div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {station.logo ? (
                        <img src={station.logo} alt={station.name} className="w-full h-full object-cover" />
                      ) : (
                        <Radio className="text-zinc-600" size={20} />
                      )}
                    </div>
                    
                    {/* 🟢 ΔΥΝΑΜΙΚΟ STATUS BADGE */}
                    {pendingInvite ? (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <Mail size={10} /> Πρόσκληση εκκρεμεί
                      </span>
                    ) : isOrphan ? (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <AlertTriangle size={10} /> NOT Assigned
                      </span>
                    ) : isAdmin ? (
                      <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <ShieldAlert size={10} /> By Admin
                      </span>
                    ) : (
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 size={10} /> Assigned
                      </span>
                    )}
                  </div>

                  <h3 className="font-black text-xl text-white truncate pr-2 relative z-10">{station.name}</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1 relative z-10">{station.genre || 'ΓΕΝΙΚΟ'}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Mic2 size={14} className={isOrphan ? "text-red-500 shrink-0" : isAdmin ? "text-purple-400 shrink-0" : "text-blue-400 shrink-0"} />
                      
                      {/* 🟢 ΔΥΝΑΜΙΚΟ ΚΕΙΜΕΝΟ ΙΔΙΟΚΤΗΤΗ */}
                      <span className={`text-xs font-bold truncate ${isOrphan ? 'text-red-400 italic' : isAdmin ? 'text-purple-400' : 'text-white'}`}>
                        {pendingInvite ? pendingInvite.email : isOrphan ? 'NOT Assigned (Ορφανό)' : isAdmin ? 'Καταχωρήθηκε από ADMIN' : broadcaster.username}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => handleOpenModal(station)}
                      className="p-2.5 bg-white/5 hover:bg-[#ccff00] hover:text-black text-white rounded-xl transition-all shrink-0 ml-2"
                      title={isOrphan ? "Πρόσκληση ή ανάθεση Broadcaster" : "Ανάθεση"}
                    >
                      <UserPlus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredStations.length === 0 && (
            <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-3xl">
              <ShieldAlert className="mx-auto text-zinc-600 mb-4" size={48} />
              <h3 className="text-xl font-black text-white uppercase tracking-widest">Δεν βρεθηκαν σταθμοι</h3>
              <p className="text-zinc-500 mt-2">Δοκιμάστε να αλλάξετε τους όρους αναζήτησης.</p>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL ΑΝΑΘΕΣΗΣ --- */}
      {isModalOpen && selectedStation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-950 border border-white/10 rounded-[32px] w-full max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl relative p-6 md:p-10 animate-in zoom-in-95">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full"><X size={20}/></button>
            
            <div className="w-16 h-16 bg-[#ccff00]/10 text-[#ccff00] rounded-2xl flex items-center justify-center mb-6 border border-[#ccff00]/20">
              <Radio size={32} />
            </div>
            
            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-1">Ανάθεση σταθμού</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Διαχείριση για τον σταθμό: <span className="text-white font-bold">{selectedStation.name}</span>
            </p>

            {!selectedStation.broadcasterId && <div className="grid grid-cols-2 p-1 bg-black rounded-xl border border-white/10 mb-6">
              <button type="button" onClick={() => { setModalTab('invite'); setInviteFeedback(null); }}
                className={`rounded-lg p-3 text-xs font-black transition-colors ${modalTab === 'invite' ? 'bg-[#ccff00] text-black' : 'text-zinc-400 hover:text-white'}`}>
                <Mail className="inline mr-1" size={15} /> Πρόσκληση Email
              </button>
              <button type="button" onClick={() => { setModalTab('assign'); setInviteFeedback(null); }}
                className={`rounded-lg p-3 text-xs font-black transition-colors ${modalTab === 'assign' ? 'bg-[#ccff00] text-black' : 'text-zinc-400 hover:text-white'}`}>
                <UserPlus className="inline mr-1" size={15} /> Χειροκίνητα
              </button>
            </div>}

            {!selectedStation.broadcasterId && modalTab === 'invite' ? (
              <form onSubmit={handleSendInvite} className="space-y-5">
                <p className="text-zinc-400 text-sm">Ο παραλήπτης θα εγγραφεί ως Broadcaster, θα επιβεβαιώσει το email και θα αποδεχθεί τους όρους πριν αποκτήσει τον σταθμό.</p>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Email σταθμού / νέου Broadcaster
                  <input type="email" required maxLength={254} autoComplete="off" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="station@example.com"
                    className="block w-full bg-black text-white border border-white/10 h-14 rounded-2xl px-5 mt-3 outline-none focus:border-[#ccff00] text-sm" />
                </label>
                {(() => {
                  const invitation = getLatestInvite(selectedStation._id);
                  return invitation ? <div className="rounded-xl border border-white/10 p-4 space-y-2">
                    <p className="text-xs font-black text-zinc-300">
                      {invitation.status === 'pending' ? 'Εκκρεμής πρόσκληση' :
                        invitation.status === 'accepted' ? 'Έχει γίνει αποδεκτή' :
                        invitation.status === 'expired' ? 'Η πρόσκληση έληξε' : 'Η προηγούμενη πρόσκληση ανακλήθηκε'}
                    </p>
                    <p className="text-xs text-zinc-500 break-all">{invitation.email}</p>
                    {invitation.status === 'pending' && <>
                      <p className="text-xs text-zinc-500">Λήγει: {new Date(invitation.expiresAt).toLocaleString('el-GR')}</p>
                      <button type="button" disabled={actionLoading} onClick={() => handleRevokeInvite(invitation._id)}
                        className="flex gap-2 text-red-400 text-xs font-bold hover:text-red-300"><Ban size={14}/> Ανάκληση πρόσκλησης</button>
                    </>}
                  </div> : null;
                })()}
                {inviteFeedback && <p role="status" className={`rounded-xl p-3 text-xs font-semibold ${inviteFeedback.success ? 'bg-lime-500/10 text-lime-300' : 'bg-red-500/10 text-red-300'}`}>{inviteFeedback.text}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-white/10 hover:bg-white/15 rounded-xl p-4 text-xs font-black">Κλείσιμο</button>
                  <button type="submit" disabled={actionLoading} className="flex-1 bg-[#ccff00] text-black rounded-xl p-4 text-xs font-black disabled:opacity-40 flex items-center justify-center gap-2">
                    {actionLoading ? <Loader2 className="animate-spin" size={16}/> : getLatestInvite(selectedStation._id)?.status === 'pending' ? <RefreshCw size={16}/> : <Send size={16}/>}
                    {getLatestInvite(selectedStation._id)?.status === 'pending' ? 'Επαναποστολή' : 'Αποστολή'}
                  </button>
                </div>
              </form>
            ) : <form onSubmit={handleAssign}>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-3 ml-1">Επιλογη Broadcaster</label>
              <div className="relative mb-8">
                <select 
                  value={selectedBroadcasterId}
                  onChange={(e) => setSelectedBroadcasterId(e.target.value)}
                  className="w-full bg-black border border-white/10 h-14 rounded-2xl px-5 text-white focus:border-[#ccff00] outline-none appearance-none cursor-pointer text-sm font-bold"
                >
                  <option value="">-- Χωρίς Ανάθεση (NOT Assigned) --</option>
                  {broadcasters.map(b => (
                    <option key={b._id} value={b._id}>
                      {b.username} {b.email ? `(${b.email})` : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  ▼
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                >
                  Ακυρωση
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-4 bg-[#ccff00] hover:scale-[1.02] text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(204,255,0,0.15)]"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Αποθηκευση
                </button>
              </div>
            </form>}

          </div>
        </div>
      )}

    </div>
  );
}
