import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, AlertTriangle, Trash2, ShieldAlert, 
  CreditCard, Crown, Loader2, Zap, Mic2, Building2, X, AlertCircle, XCircle,
  Target, SlidersHorizontal, BarChart3
} from 'lucide-react';

export default function Settings({ API_URL, currentUser }) {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [localUser, setLocalUser] = useState(currentUser);
  const [loading, setLoading] = useState(!currentUser);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('iluma_token')}`
  });

  useEffect(() => {
    const fetchFreshUserData = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: getAuthHeaders() });
        if (res.ok) setLocalUser(await res.json());
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    fetchFreshUserData();
  }, [API_URL]);

  if (loading || !localUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-[#ccff00]" size={40} />
      </div>
    );
  }

  const isAdmin = localUser.role === 'admin';
  const isBroadcaster = localUser.role === 'broadcaster';
  const isAgency = localUser.role === 'agency';

  // 🟢 ΕΞΑΓΩΓΗ ΣΥΝΔΡΟΜΩΝ ΜΕ ΑΠΟΛΥΤΗ ΑΚΡΙΒΕΙΑ
  const getSubData = (planId, manualCondition) => {
    const sub = localUser.activeSubscriptions?.find(s => s.planId === planId);
    if (sub) return sub; 
    if (manualCondition) return { isManual: true, status: 'active' }; 
    return null;
  };

  const listenerSub = getSubData('listener_premium', localUser.isPremium);
  const proSub = getSubData('full_premium', localUser.broadcasterProfile?.tier === 'premium');
  
  // Προσοχή: Στα Addons, θεωρούμε ότι είναι Manual ΜΟΝΟ αν ΔΕΝ έχει το Pro Plan (γιατί το Pro Plan τα έχει όλα by default)
  const isNotPro = localUser.broadcasterProfile?.tier !== 'premium';
  const adSub = getSubData('ad_control_solo', localUser.broadcasterProfile?.features?.adControl && isNotPro);
  const dspSub = getSubData('dsp_solo', localUser.broadcasterProfile?.features?.dspEngine && isNotPro);
  const radarSub = getSubData('analytics_solo', localUser.broadcasterProfile?.features?.analytics && isNotPro);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/users/me`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        localStorage.removeItem('iluma_token');
        window.location.href = '/'; 
      } else {
        setIsDeleting(false);
      }
    } catch (err) { setIsDeleting(false); }
  };

  // 🟢 COMPONENT ΕΜΦΑΝΙΣΗΣ STATUS (ΛΗΓΕΙ vs ΑΝΑΝΕΩΝΕΤΑΙ)
  const SubscriptionStatusUI = ({ subData }) => {
    if (!subData) return null;

    if (subData.isManual || !subData.currentPeriodEnd) {
      return (
        <div className="mt-4 bg-purple-500/10 border border-purple-500/30 px-4 py-3 rounded-xl inline-flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
          <div>
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><ShieldAlert size={12}/> Admin Granted</p>
            <p className="text-xs text-white">Manual Πρόσβαση</p>
          </div>
        </div>
      );
    }

    if (subData.status === 'canceled') {
      return (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-xl inline-flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
          <div>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><AlertCircle size={12}/> Ακυρωθηκε</p>
            <p className="text-sm font-medium text-white">Λήγει στις: <span className="font-black text-red-400">{subData.currentPeriodEnd ? new Date(subData.currentPeriodEnd).toLocaleDateString('el-GR') : '-'}</span></p>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 bg-[#ccff00]/5 border border-[#ccff00]/20 px-4 py-3 rounded-xl inline-flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
        <div>
          <p className="text-[10px] font-black text-[#ccff00] uppercase tracking-widest mb-1 flex items-center gap-1.5"><Zap size={12}/> Ενεργη</p>
          <p className="text-sm font-medium text-white">Λήγει: <span className="font-black text-[#ccff00]">{subData.currentPeriodEnd ? new Date(subData.currentPeriodEnd).toLocaleDateString('el-GR') : '-'}</span></p>
        </div>
        <span className="text-xs text-amber-300">Δεν υπάρχει ενεργή αυτόματη ανανέωση.</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 lg:p-12 font-sans pb-32 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/10 shrink-0"><SettingsIcon className="text-zinc-400" size={32} /></div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase">Ρυθμισεις Λογαριασμου</h1>
            <p className="text-zinc-500 font-medium mt-1">Διαχειριστείτε τις συνδρομές και την ασφάλεια του προφίλ σας.</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#ccff00]"></div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-6">
              <CreditCard size={18} className="text-[#ccff00]" /> Ενεργες Συνδρομες & Ρολος
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Premium Listener */}
              {localUser.isPremium ? (
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-[#ccff00]/20 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#ccff00]/10 blur-[40px] rounded-full pointer-events-none"></div>
                  <div>
                    <Crown className="text-[#ccff00] mb-3" size={24} />
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">Premium Listener</h4>
                    <p className="text-xs text-zinc-400 mt-1">Απολαμβάνετε μουσική χωρίς διαφημίσεις και HQ ήχο.</p>
                  </div>
                  <SubscriptionStatusUI subData={listenerSub} />
                </div>
              ) : !isBroadcaster && !isAgency && !isAdmin && (
                <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6">
                  <h4 className="text-lg font-black text-white uppercase tracking-tight">Free Listener</h4>
                  <button onClick={() => navigate('/premium')} className="mt-4 text-[10px] bg-white text-black px-4 py-2 rounded-full font-black uppercase hover:bg-[#ccff00]">ΑΝΑΒΑΘΜΙΣΗ</button>
                </div>
              )}

              {/* Broadcaster Area */}
              {isBroadcaster && (
                <div className="md:col-span-2 bg-gradient-to-br from-zinc-900 to-black border border-blue-500/20 rounded-3xl p-6 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none"></div>
                  <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-6">
                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20"><Mic2 className="text-blue-400" size={24} /></div>
                    <div><h4 className="text-xl font-black text-white uppercase tracking-tight">Broadcaster Subscriptions</h4></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    
                    {proSub && (
                      <div className="p-5 bg-black/60 border border-[#ccff00]/30 rounded-2xl md:col-span-2">
                        <h5 className="text-[#ccff00] font-black text-xs uppercase mb-2 flex items-center gap-2"><Crown size={14}/> THE PRO PACK</h5>
                        <SubscriptionStatusUI subData={proSub} />
                      </div>
                    )}

                    {adSub && (
                      <div className="p-5 bg-black/40 border border-emerald-500/20 rounded-2xl">
                        <h5 className="text-emerald-500 font-black text-xs uppercase mb-2 flex items-center gap-2"><Target size={14}/> MONEY MAKER (AdControl)</h5>
                        <SubscriptionStatusUI subData={adSub} />
                      </div>
                    )}

                    {dspSub && (
                      <div className="p-5 bg-black/40 border border-purple-500/20 rounded-2xl">
                        <h5 className="text-purple-500 font-black text-xs uppercase mb-2 flex items-center gap-2"><SlidersHorizontal size={14}/> STUDIO EVOLUTION (DSP)</h5>
                        <SubscriptionStatusUI subData={dspSub} />
                      </div>
                    )}

                    {radarSub && (
                      <div className="p-5 bg-black/40 border border-blue-500/20 rounded-2xl">
                        <h5 className="text-blue-500 font-black text-xs uppercase mb-2 flex items-center gap-2"><BarChart3 size={14}/> AUDIENCE RADAR</h5>
                        <SubscriptionStatusUI subData={radarSub} />
                      </div>
                    )}

                    {!proSub && !adSub && !dspSub && !radarSub && (
                      <div className="col-span-2 mt-2">
                         <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-4">Είστε στο Free Tier. Δεν υπάρχουν ενεργά Add-ons.</span>
                         <button onClick={() => navigate('/broadcaster-dashboard')} className="text-[10px] bg-blue-500/20 text-blue-400 px-6 py-3 rounded-xl font-black uppercase">DASHBOARD</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isAgency && (
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-purple-500/20 rounded-3xl p-6">
                  <Building2 className="text-purple-400 mb-3" size={24} /><h4 className="text-lg font-black text-white uppercase tracking-tight">Ad Agency</h4>
                </div>
              )}
              {isAdmin && (
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-red-500/20 rounded-3xl p-6">
                  <ShieldAlert className="text-red-500 mb-3" size={24} /><h4 className="text-lg font-black text-red-500 uppercase tracking-tight">Administrator</h4>
                </div>
              )}
            </div>
          </div>
          
          {!isAdmin && (
            <div className="bg-red-500/5 border border-red-500/10 rounded-[32px] p-8 relative overflow-hidden">
              <h3 className="text-red-500 font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-2"><AlertTriangle size={18} /> Επικινδυνη Ζωνη</h3>
              <p className="text-zinc-400 text-sm mb-6">Η διαγραφή του λογαριασμού είναι μη αναστρέψιμη.</p>
              <button onClick={() => setShowDeleteModal(true)} className="bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-3 rounded-xl font-black uppercase text-xs hover:bg-red-500 hover:text-white flex items-center gap-2"><Trash2 size={16} /> Διαγραφη Λογαριασμου</button>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-red-500/30 rounded-[32px] w-full max-w-md p-8 relative">
            <button onClick={() => { setShowDeleteModal(false); setDeleteInput(''); }} className="absolute top-6 right-6 text-zinc-500 hover:text-white bg-white/5 p-2 rounded-full"><X size={20}/></button>
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32} /></div>
            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Ειστε σιγουροι;</h3>
            <p className="text-zinc-400 text-sm mb-6">Πληκτρολογήστε <span className="text-red-500 font-bold select-all">ΔΙΑΓΡΑΦΗ</span>.</p>
            <input type="text" placeholder="ΔΙΑΓΡΑΦΗ" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm text-white focus:border-red-500 outline-none text-center font-black" />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteInput(''); }} className="flex-1 py-4 bg-white/5 text-white rounded-xl text-xs font-black uppercase">Ακυρωση</button>
              <button onClick={handleDeleteAccount} disabled={deleteInput !== 'ΔΙΑΓΡΑΦΗ' || isDeleting} className="flex-1 py-4 bg-red-600 text-white font-black uppercase text-xs rounded-xl disabled:opacity-30">Οριστικη Διαγραφη</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
