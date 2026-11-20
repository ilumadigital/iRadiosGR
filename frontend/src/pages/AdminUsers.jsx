import {adminFetch as fetch} from '../utils/adminFetch';
import {Link} from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import {useLiveRevision} from '../utils/liveUpdates';
import { 
  Search, Grid, List, Edit, Trash2, X, Shield, Radio, 
  User as UserIcon, Star, CheckCircle2, KeyRound, Settings, Crown,
  Target, SlidersHorizontal, Sparkles, Infinity, HardDrive, Mail, Phone, Calendar, Loader2,
  BarChart3, MessageSquare, Filter, Mic2, LayoutGrid, Megaphone
} from 'lucide-react';

export default function AdminUsers({ API_URL, currentUser }) {
  const [users, setUsers] = useState([]);
  const liveBackofficeRevision=useLiveRevision(['backoffice','stations']);
  const [stations, setStations] = useState([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); 
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(false);
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // 🟢 ΝΕΑ STATES ΓΙΑ ΤΑ AGENCY CAMPAIGNS
  const [agencyCampaigns, setAgencyCampaigns] = useState({ banners: [], audio: [] });
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [isFullEditOpen, setIsFullEditOpen] = useState(false);
  const [fullEditForm, setFullEditForm] = useState({
    fname: '', lname: '', email: '', username: '', birthdate: '', phone: ''
  });

  const [editForm, setEditForm] = useState({
    role: 'user', 
    isPremium: false,
    assignedStation: '', 
    broadcasterProfile: {
      tier: 'free',
      maxStations: 3,
      features: { adControl: false, dspEngine: false, analytics: false }
    }
  });

  useEffect(() => { 
    fetchUsers(); 
    fetchStations();
  }, [liveBackofficeRevision]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`);
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error("Σφάλμα φόρτωσης χρηστών:", err); }
  };

  const fetchStations = async () => {
    try {
      const res = await fetch(`${API_URL}/stations`);
      const data = await res.json();
      if (Array.isArray(data)) setStations(data);
    } catch (err) { console.error("Error fetching stations:", err); }
  };

  // 🟢 FETCH AGENCY CAMPAIGNS (Όταν ο admin βλέπει Agency)
  useEffect(() => {
    if (isModalOpen && selectedUser && editForm.role === 'agency') {
      const fetchAgencyData = async () => {
        setLoadingCampaigns(true);
        try {
          const resBanners = await fetch(`${API_URL}/agency/${selectedUser._id}/banners`);
          const resAudio = await fetch(`${API_URL}/agency/${selectedUser._id}/audio-ads`);
          
          const banners = resBanners.ok ? await resBanners.json() : [];
          const audio = resAudio.ok ? await resAudio.json() : [];
          
          setAgencyCampaigns({ banners, audio });
        } catch (err) {
          console.error("Σφάλμα φόρτωσης καμπανιών:", err);
        }
        setLoadingCampaigns(false);
      };
      fetchAgencyData();
    }
  }, [isModalOpen, selectedUser, editForm.role, API_URL]);

  const handleFullEditClick = (user) => {
    setSelectedUser(user);
    setFullEditForm({
      fname: user.fname || '',
      lname: user.lname || '',
      email: user.email || '',
      username: user.username || '',
      phone: user.phone || '',
      birthdate: user.birthdate ? user.birthdate.split('T')[0] : '',
      newPassword: ''
    });
    setIsFullEditOpen(true);
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setEditForm({ 
      role: user.role || 'user', 
      isPremium: user.isPremium || false,
      assignedStation: user.assignedStation?._id || user.assignedStation || '',
      broadcasterProfile: {
        tier: user.broadcasterProfile?.tier || 'free',
        maxStations: user.broadcasterProfile?.maxStations || 3,
        features: {
          adControl: user.broadcasterProfile?.features?.adControl || false,
          dspEngine: user.broadcasterProfile?.features?.dspEngine || false,
          analytics: user.broadcasterProfile?.features?.analytics || false
        }
      }
    });
    setIsModalOpen(true);
  };

  const handleSaveRole = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${selectedUser._id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editForm.role,
          isPremium: editForm.role === 'user' ? editForm.isPremium : false,
          assignedStation: editForm.role === 'producer' ? editForm.assignedStation : null
        })
      });
      if (res.ok) {
        fetchUsers();
        setIsModalOpen(false);
      } else {
        alert("Αποτυχία ενημέρωσης.");
      }
    } catch (err) { 
      alert("Σφάλμα σύνδεσης.");
    }
    setLoading(false);
  };

  const handleFullSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/admin/users/${selectedUser._id}/full-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullEditForm)
      });
      if (res.ok) {
        fetchUsers();
        setIsFullEditOpen(false);
      }
    } catch (err) { console.error(err); }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/admin/users/${selectedUser._id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) {
        setPasswordMessage('✅ Επιτυχία!');
        setTimeout(() => setShowPasswordModal(false), 1500);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Οριστική διαγραφή λογαριασμού; Θα ακυρωθούν πρώτα ΟΛΕΣ οι ενεργές συνδρομές και οι επόμενες χρεώσεις του στο ILUMA Gateway (Premium, Broadcaster και add-ons).')) return;
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Η διαγραφή ακυρώθηκε. Δεν έχει επιβεβαιωθεί η διακοπή των χρεώσεων στο Gateway.');
        return;
      }
      setUsers(prev => prev.filter(u => u._id !== userId));
      alert(data.message || 'Ο χρήστης διαγράφηκε και η αυτόματη χρέωση σταμάτησε.');
    } catch (err) {
      console.error(err);
      alert('Σφάλμα σύνδεσης. Η διαγραφή δεν επιβεβαιώθηκε.');
    }
  };

  // 🟢 DELETE AGENCY CAMPAIGN
  const handleDeleteCampaign = async (campaignId, type) => {
    if (!window.confirm("ΠΡΟΣΟΧΗ: Είστε σίγουροι; Αυτό θα διαγράψει οριστικά την καμπάνια. Τα συνδρομητικά δικαιώματα ελέγχονται χωριστά από τον διαχειριστή.")) return;
    try {
      const res = await fetch(`${API_URL}/agency/${selectedUser._id}/campaign/${type}/${campaignId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // Ενημέρωση του local state για να εξαφανιστεί
        setAgencyCampaigns(prev => ({
          ...prev,
          [type === 'audio' ? 'audio' : 'banners']: prev[type === 'audio' ? 'audio' : 'banners'].filter(c => c._id !== campaignId)
        }));
      } else {
        alert('Σφάλμα διαγραφής.');
      }
    } catch (err) {
      console.error(err);
      alert('Σφάλμα δικτύου.');
    }
  };

  // 🟢 ΕΝΗΜΕΡΩΜΕΝΟ ΦΙΛΤΡΑΡΙΣΜΑ ΜΕ PREMIUM ROLE
  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      (u.username?.toLowerCase() || '').includes(query) || 
      (u.email?.toLowerCase() || '').includes(query) ||
      (u.fname?.toLowerCase() || '').includes(query) ||
      (u.lname?.toLowerCase() || '').includes(query)
    );
    
    let matchesRole = false;
    if (roleFilter === 'all') {
      matchesRole = true;
    } else if (roleFilter === 'premium') {
      matchesRole = u.isPremium || u.broadcasterProfile?.tier === 'premium';
    } else {
      matchesRole = u.role === roleFilter;
    }
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="admin-legacy-page space-y-6 text-white">
      
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#ccff00]/10 rounded-xl"><UserIcon className="text-[#ccff00]" size={28} /></div>
          <h1 className="text-3xl font-black italic uppercase tracking-wider">Όλοι οι χρήστες</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-full md:w-64">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Αναζήτηση..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full bg-zinc-900/50 border border-white/10 h-11 rounded-xl pl-12 pr-4 text-sm focus:outline-none focus:border-[#ccff00]/50 transition-all text-white" 
            />
          </div>
          <div className="flex bg-zinc-900/50 border border-white/10 rounded-xl p-1">
            <button aria-label="Προβολή λίστας" title="Προβολή λίστας" onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#ccff00] text-black' : 'text-zinc-500 hover:text-white'}`}><List size={18} /></button>
            <button aria-label="Προβολή καρτών" title="Προβολή καρτών" onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#ccff00] text-black' : 'text-zinc-500 hover:text-white'}`}><Grid size={18} /></button>
          </div>
        </div>
      </div>

      {/* 🟢 ROLE FILTERS (Προστέθηκε το premium) */}
      <div className="flex flex-wrap items-center gap-2 mb-5 bg-zinc-900/30 p-2 rounded-2xl border border-white/5">
        {['all', 'admin', 'broadcaster', 'producer', 'agency', 'user', 'premium'].map(role => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
              roleFilter === role 
                ? 'bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.2)]' 
                : 'text-zinc-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {role === 'premium' && <Crown size={12} className={roleFilter === role ? 'text-black' : 'text-[#ccff00]'} />}
            {role}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-zinc-300" role="status">
          {filteredUsers.length} από {users.length} λογαριασμούς
        </p>
        {(searchQuery||roleFilter!=='all')&&<button type="button"
          className="rounded-xl border border-[#caff00]/25 px-3 py-2 text-xs font-bold text-[#caff00]"
          onClick={()=>{setSearchQuery('');setRoleFilter('all');}}>
          Καθαρισμός φίλτρων
        </button>}
      </div>
      {!filteredUsers.length&&<div className="mb-4 rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-10 text-center text-sm text-zinc-400">
        Δεν βρέθηκαν χρήστες. Δοκίμασε άλλη αναζήτηση ή καθάρισε τα φίλτρα.
      </div>}

      {/* VIEW RENDER (LIST) */}
      {viewMode === 'list' ? (
        <div className="bo-legacy-scroll bg-zinc-900/30 border border-white/5 rounded-2xl backdrop-blur-sm">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 bg-zinc-900/50">
              <tr>
                <th className="px-6 py-4">Στοιχεία χρήστη</th>
                <th className="px-6 py-4">Ρόλος & σταθμός</th>
                <th className="px-6 py-4">Πρόσβαση Premium</th>
                <th className="px-6 py-4 text-right">Ενέργειες</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map(user => (
                <tr key={user._id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    {/* 🟢 Προθήκη Κορωνίδας στο Όνομα */}
                    <div className="font-bold text-white flex items-center gap-2">
                      {user.fname} {user.lname}
                      {user.isPremium && <Crown size={14} className="text-[#ccff00]" title="Premium User" />}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">@{user.username} • {user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                        user.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                        user.role === 'broadcaster' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        user.role === 'producer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        user.role === 'agency' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>{user.role}</span>
                      
                      {user.role === 'producer' && user.assignedStation && (
                        <div className="text-[9px] text-emerald-500 font-bold flex items-center gap-1">
                          <Radio size={10} /> {user.assignedStation?.name || 'Assigned'}
                        </div>
                      )}
                      
                      {user.role==='broadcaster'&&<span className="text-[9px] font-bold text-zinc-400">Premium: Billing Engine</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.role==='broadcaster'?
                      <Link to={'/backoffice/admin/addons?accountId='+encodeURIComponent(user._id)}
                        className="text-xs font-bold text-[#ccff00] hover:underline">
                        Προβολή πραγματικών Addons
                      </Link>:
                      <span className="text-xs text-zinc-500">—</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" aria-label={'Στοιχεία λογαριασμού '+user.email} title="Στοιχεία λογαριασμού" onClick={() => handleFullEditClick(user)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg"><Settings size={16} /></button>
                      <button type="button" aria-label={'Δικαιώματα '+user.email} title="Δικαιώματα" onClick={() => handleEditClick(user)} className="p-2 text-[#ccff00] hover:bg-[#ccff00]/10 rounded-lg"><Edit size={16} /></button>
                      {user.role==='broadcaster'&&<Link
                        to={'/backoffice/admin/addons?accountId='+encodeURIComponent(user._id)}
                        aria-label={'Addons σταθμών '+user.email} title="Addons ανά σταθμό"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#ccff00]/30 px-2 py-2 text-[11px] font-bold text-[#ccff00]">
                        <SlidersHorizontal size={15}/> Addons
                      </Link>}
                      <button type="button" aria-label={'Διαγραφή '+user.email} title="Διαγραφή χρήστη" onClick={() => handleDeleteUser(user._id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredUsers.map(user => (
            <div key={user._id} className="bg-zinc-900/50 border border-white/5 p-6 rounded-[32px] group hover:border-white/10 transition-all">
               <div className="flex items-center justify-between mb-4">
                  {/* 🟢 Προθήκη Κορωνίδας στο Όνομα */}
                  <h3 className="font-bold text-lg truncate pr-2 flex items-center gap-2">
                    {user.fname} {user.lname}
                    {user.isPremium && <Crown size={16} className="text-[#ccff00] shrink-0" title="Premium User" />}
                  </h3>
                  {user.role === 'admin' ? <Shield className="text-red-400 shrink-0" size={18} /> : 
                   user.role === 'broadcaster' ? <Radio className="text-blue-400 shrink-0" size={18} /> : 
                   user.role === 'producer' ? <Mic2 className="text-emerald-400 shrink-0" size={18} /> : 
                   user.role === 'agency' ? <Target className="text-purple-400 shrink-0" size={18} /> : 
                   <UserIcon className="text-zinc-600 shrink-0" size={18} />}
               </div>
               <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                  <button type="button" aria-label={'Στοιχεία λογαριασμού '+user.email} title="Στοιχεία λογαριασμού" onClick={() => handleFullEditClick(user)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg transition-colors"><Settings size={16} /></button>
                  <button type="button" aria-label={'Δικαιώματα '+user.email} title="Δικαιώματα" onClick={() => handleEditClick(user)} className="p-2 text-[#ccff00] bg-[#ccff00]/10 rounded-lg transition-colors"><Edit size={16} /></button>
                  {user.role==='broadcaster'&&<Link
                    to={'/backoffice/admin/addons?accountId='+encodeURIComponent(user._id)}
                    aria-label={'Addons σταθμών '+user.email} title="Addons ανά σταθμό"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#ccff00]/30 px-2 py-2 text-xs font-bold text-[#ccff00]">
                    <SlidersHorizontal size={15}/> Addons
                  </Link>}
                  <button type="button" aria-label={'Διαγραφή '+user.email} title="Διαγραφή χρήστη" onClick={() => handleDeleteUser(user._id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-auto"><Trash2 size={16} /></button>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL: PERMISSIONS & MODULES --- */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-start justify-center z-[120] p-4 pt-12 md:pt-24 overflow-y-auto custom-scrollbar">
          <div className="bg-[#111] border border-white/10 rounded-[48px] w-full max-w-2xl p-8 md:p-12 relative shadow-2xl animate-in slide-in-from-bottom-5 mb-12 shrink-0">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white bg-white/5 p-2 rounded-full transition-colors z-10"><X size={20} /></button>
            <h2 className="text-3xl font-black italic uppercase mb-2">Permissions</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-10">Manage Access for: <span className="text-[#ccff00]">{selectedUser.username}</span></p>
            {selectedUser.role==='broadcaster'&&<div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-300">
              Τα station-scoped Addons και οι δωρεάν παραχωρήσεις διαχειρίζονται χωριστά από τους legacy λογαριασμούς.
              <Link className="mt-3 flex items-center gap-2 font-bold text-[#ccff00]"
                to={'/backoffice/admin/addons?accountId='+encodeURIComponent(selectedUser._id)}
                onClick={()=>setIsModalOpen(false)}><SlidersHorizontal size={15}/> Διαχείριση Addons ανά σταθμό</Link>
            </div>}

            <div className="space-y-10">
              {/* SYSTEM ROLE SELECTION */}
              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-4 block tracking-widest">Base System Role</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['user', 'producer', 'broadcaster', 'agency', 'admin'].map((r) => (
                    <button 
                      key={r} 
                      onClick={() => setEditForm({...editForm, role: r})} 
                      className={`p-4 rounded-3xl border text-[10px] font-black uppercase flex flex-col items-center gap-3 transition-all ${
                        editForm.role === r 
                          ? (r === 'agency' ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'bg-[#ccff00]/10 border-[#ccff00] text-[#ccff00] shadow-[0_0_20px_rgba(204,255,0,0.1)]')
                          : 'bg-zinc-900 border-white/5 text-zinc-600 hover:border-white/10'
                      }`}
                    >
                      {r === 'admin' ? <Shield size={20} /> : r === 'broadcaster' ? <Radio size={20} /> : r === 'producer' ? <Mic2 size={20} /> : r === 'agency' ? <Target size={20} /> : <UserIcon size={20} />}
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* AGENCY CAMPAIGN TAB */}
              {editForm.role === 'agency' && (
                <div className="bg-purple-500/5 border border-purple-500/20 p-6 rounded-[32px] space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-3 mb-2 border-b border-white/5 pb-4">
                    <Megaphone className="text-purple-400" size={20} />
                    <span className="text-xs font-black uppercase tracking-widest text-purple-400">Ενεργες Καμπανιες Agency</span>
                  </div>
                  
                  {loadingCampaigns ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-purple-400" size={24} /></div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {/* Combine Banners & Audio into one list for display */}
                      {[...agencyCampaigns.banners.map(c => ({...c, _type: 'banner'})), ...agencyCampaigns.audio.map(c => ({...c, _type: 'audio'}))].length === 0 ? (
                        <div className="text-center text-zinc-500 text-xs italic py-6">Δεν βρέθηκαν καμπάνιες για αυτόν τον χρήστη.</div>
                      ) : (
                        [...agencyCampaigns.banners.map(c => ({...c, _type: 'banner'})), ...agencyCampaigns.audio.map(c => ({...c, _type: 'audio'}))].map(campaign => (
                          <div key={campaign._id} className="flex items-center justify-between bg-black border border-white/10 p-4 rounded-2xl hover:border-purple-500/30 transition-colors">
                            <div>
                              <div className="text-sm font-bold text-white truncate max-w-[200px] md:max-w-[300px]">{campaign.title}</div>
                              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                                <span className={campaign._type === 'banner' ? 'text-blue-400' : 'text-[#ccff00]'}>
                                  {campaign._type === 'banner' ? 'Visual Ad' : 'Audio Spot'}
                                </span> 
                                • <span className={campaign.status === 'active' ? 'text-emerald-400' : campaign.status === 'pending' ? 'text-orange-400' : 'text-red-400'}>{campaign.status}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteCampaign(campaign._id, campaign._type)} 
                              title="Διαγραφή καμπάνιας"
                              className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PRODUCER ASSIGNMENT TAB */}
              {editForm.role === 'producer' && (
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-[32px] space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-3 mb-2">
                    <LayoutGrid className="text-emerald-400" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Station Assignment</span>
                  </div>
                  <div className="relative">
                    <select 
                      value={editForm.assignedStation} 
                      onChange={e => setEditForm({...editForm, assignedStation: e.target.value})}
                      className="w-full bg-black border border-white/10 h-14 rounded-2xl px-5 text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer text-xs font-bold"
                    >
                      <option value="">Επιλέξτε Σταθμό...</option>
                      {stations.map(s => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.broadcasterId?.username || 'System'})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 italic text-[10px]">SELECT</div>
                  </div>
                </div>
              )}

              {/* Broadcaster subscriptions are always Billing Engine managed. */}
              {editForm.role === 'broadcaster' && selectedUser?.role === 'broadcaster' && (
                <div className="rounded-3xl border border-[#ccff00]/20 bg-[#ccff00]/5 p-6 text-sm text-zinc-300">
                  <h3 className="mb-2 text-base font-black text-white">Premium και Addons</h3>
                  <p className="leading-6">Τα παλιά χειροκίνητα Premium, DSP, Analytics και Ad Control
                    δεν χορηγούν πλέον δικαιώματα. Διαχειρίσου ενεργές πληρωμές και
                    δωρεάν παραχωρήσεις μόνο από το νέο Billing Engine.</p>
                  <Link to={'/backoffice/admin/addons?accountId='+encodeURIComponent(selectedUser._id)}
                    onClick={()=>setIsModalOpen(false)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-4 py-3 text-xs font-black text-black">
                    <SlidersHorizontal size={15}/> Διαχείριση Addons ανά σταθμό
                  </Link>
                </div>
              )}

              {/* LISTENER PREMIUM TOGGLE */}
              {editForm.role === 'user' && <div className="flex items-center justify-between p-6 bg-zinc-900 border border-white/5 rounded-[30px] group hover:border-[#ccff00]/30 transition-all">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#ccff00]/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Crown className="text-[#ccff00]" size={24} /></div>
                    <div>
                      <span className="text-xs font-black uppercase block">Premium Listener</span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Global Ad-Free Experience</span>
                    </div>
                 </div>
                 <input type="checkbox" className="w-6 h-6 rounded-lg border-zinc-700 text-[#ccff00] focus:ring-[#ccff00] bg-black cursor-pointer" checked={editForm.isPremium} onChange={e => setEditForm({...editForm, isPremium: e.target.checked})} />
              </div>}
            </div>

            <button onClick={handleSaveRole} disabled={loading} className="w-full bg-[#ccff00] text-black font-black py-5 rounded-[24px] uppercase tracking-widest text-xs mt-12 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Save Account Permissions"}
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL: FULL PROFILE EDIT --- */}
      {isFullEditOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-start justify-center z-[120] p-4 pt-12 md:pt-24 overflow-y-auto custom-scrollbar">
          <div className="bg-[#111] border border-white/10 rounded-[40px] w-full max-w-2xl p-8 md:p-12 relative shadow-2xl animate-in zoom-in-95 mb-12 shrink-0">
            <button onClick={() => setIsFullEditOpen(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white bg-white/5 p-2 rounded-full transition-colors z-10"><X size={20} /></button>
            <h2 className="text-3xl font-black uppercase italic mb-8 flex items-center gap-3">
              <Settings className="text-[#ccff00]" /> Edit Profile
            </h2>
            <form onSubmit={handleFullSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Υπάρχοντα Πεδία */}
               <div className="space-y-6 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black mb-2 block ml-1">First Name</label>
                    <input type="text" value={fullEditForm.fname} onChange={e => setFullEditForm({...fullEditForm, fname: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-2xl px-4 text-sm focus:border-[#ccff00] outline-none text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black mb-2 block ml-1">Last Name</label>
                    <input type="text" value={fullEditForm.lname} onChange={e => setFullEditForm({...fullEditForm, lname: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-2xl px-4 text-sm focus:border-[#ccff00] outline-none text-white font-bold" />
                  </div>
               </div>
               
               <div className="md:col-span-2">
                  <label className="text-[10px] text-zinc-500 uppercase font-black mb-2 block ml-1">Email</label>
                  <input type="email" value={fullEditForm.email} onChange={e => setFullEditForm({...fullEditForm, email: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-2xl px-4 text-sm focus:border-[#ccff00] outline-none text-white font-bold" />
               </div>

               {/* 🟢 ΝΕΟ: ΠΕΔΙΟ ΑΛΛΑΓΗΣ ΚΩΔΙΚΟΥ */}
               <div className="md:col-span-2 mt-4 p-6 bg-red-500/5 border border-red-500/20 rounded-3xl">
                  <div className="flex items-center gap-3 mb-4">
                    <KeyRound className="text-red-400" size={20} />
                    <label className="text-[12px] text-red-400 uppercase font-black block tracking-widest">Force Password Reset</label>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Αφήστε κενό για να ΜΗΝ αλλάξει..." 
                    value={fullEditForm.newPassword} 
                    onChange={e => setFullEditForm({...fullEditForm, newPassword: e.target.value})} 
                    className="w-full bg-black/50 border border-white/10 h-14 rounded-2xl px-5 text-white font-mono text-center tracking-[0.2em] focus:border-red-500 outline-none transition-colors" 
                  />
                  <p className="text-[9px] font-bold text-zinc-500 text-center mt-3 uppercase tracking-widest">
                    *Για λόγους ασφαλείας ο παλιός κωδικός είναι κρυπτογραφημένος. Γράψτε εδώ αν θέλετε να τον αντικαταστήσετε.*
                  </p>
               </div>

               <button type="submit" className="md:col-span-2 bg-[#ccff00] text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs mt-6 hover:scale-[1.02] transition-all shadow-[0_10px_30px_rgba(204,255,0,0.2)]">
                  Update Information
               </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: PASSWORD RESET --- */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-start justify-center z-[130] p-4 pt-12 md:pt-32 overflow-y-auto">
          <div className="bg-zinc-900 border border-white/10 p-10 rounded-[40px] w-full max-w-md shadow-2xl relative animate-in zoom-in-95 mb-12 shrink-0">
            <button onClick={() => setShowPasswordModal(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full"><X size={24} /></button>
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6"><KeyRound className="text-blue-400" size={32} /></div>
            <h3 className="text-2xl font-black uppercase italic text-white mb-2">Reset Password</h3>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-black border border-white/10 h-16 rounded-2xl px-5 mb-4 outline-none focus:border-blue-500 text-white font-mono text-center tracking-[0.2em]" placeholder="NEW PASSWORD" />
            {passwordMessage && <p className="text-xs font-black text-blue-400 mb-6 bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 text-center uppercase tracking-widest">{passwordMessage}</p>}
            <button onClick={handlePasswordReset} className="w-full bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs hover:bg-blue-400 transition-all shadow-xl">Force Update Password</button>
          </div>
        </div>
      )}
    </div>
  );
}
