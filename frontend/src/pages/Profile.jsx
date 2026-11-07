import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Bell, Save, Shield, Mail, Phone, Calendar, AtSign, Crown, CreditCard, 
  AlertCircle, XCircle, Zap, Megaphone, Loader2, Music, CheckCircle2, 
  Settings as SettingsIcon, LogOut 
} from 'lucide-react';
import { useAlert } from '../context/AlertContext'; 

export default function Profile({ API_URL, onLogout }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert() || { showAlert: alert }; 

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState('details'); 
  const [cancelLoading, setCancelLoading] = useState(false);
  
  const [subscriptionData, setSubscriptionData] = useState(null);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fname: '',
    lname: '',
    phone: '',
    birthdate: '',
    pushNotifications: true,
    isPremium: false,
    stripeSubscriptionId: null 
  });

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('iluma_token')}`
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setFormData({
            username: data.username || '',
            email: data.email || '',
            fname: data.fname || '',
            lname: data.lname || '',
            phone: data.phone || '',
            birthdate: data.birthdate ? new Date(data.birthdate).toISOString().split('T')[0] : '',
            pushNotifications: data.pushNotifications ?? true,
            isPremium: data.isPremium || false,
            stripeSubscriptionId: data.stripeSubscriptionId || null
          });
          
          if (data.stripeSubscriptionId) {
             setSubscriptionData({
                status: data.subscriptionStatus || 'active', 
                currentPeriodEnd: data.currentPeriodEnd || null
             });
          }
        }
      } catch (err) {
        console.error("Σφάλμα φόρτωσης προφίλ:", err);
      }
    };
    fetchUserData();
  }, [API_URL]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();

      if (res.ok) {
        setMessage({ text: 'Τα στοιχεία σου ενημερώθηκαν επιτυχώς!', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Υπήρξε ένα πρόβλημα κατά την αποθήκευση.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Σφάλμα δικτύου.', type: 'error' });
    }
    setLoading(false);
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm("Είστε σίγουροι ότι θέλετε να ακυρώσετε την ανανέωση της συνδρομής σας; Θα διατηρήσετε τα προνόμια μέχρι τη λήξη της περιόδου.")) return;
    
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_URL}/payments/cancel-subscription`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        showAlert('Επιτυχία!', 'Η συνδρομή σας ακυρώθηκε. Δεν θα υπάρξει μελλοντική χρέωση.', 'success');
        setSubscriptionData(prev => ({ ...prev, status: 'canceled' }));
      } else {
        const err = await res.json();
        showAlert('Σφάλμα', err.error || 'Αποτυχία ακύρωσης.', 'error');
      }
    } catch (err) {
      showAlert('Σφάλμα', 'Δεν ήταν δυνατή η επικοινωνία με τον server.', 'error');
    }
    setCancelLoading(false);
  };

  return (
    <div className="p-6 lg:p-12 max-w-4xl mx-auto pb-40 animate-fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#ccff00]/10 flex items-center justify-center border border-[#ccff00]/20 shrink-0">
            {formData.isPremium ? <Crown className="text-[#ccff00]" size={32} /> : <User className="text-[#ccff00]" size={32} />}
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter">
              {formData.username || 'Το Προφιλ μου'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {formData.isPremium ? (
                 <span className="bg-[#ccff00]/20 text-[#ccff00] text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[#ccff00]/30 flex items-center gap-1.5 w-fit">
                    <Crown size={12} /> Premium Member
                 </span>
              ) : (
                 <span className="bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-zinc-700 w-fit">
                    Free Plan
                 </span>
              )}
            </div>
          </div>
        </div>

        {/* 🔴 ΚΟΥΜΠΙ LOGOUT */}
        <button 
          onClick={onLogout}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 hover:border-red-500/40 transition-all font-black uppercase tracking-widest text-[10px] md:text-xs active:scale-95 shrink-0"
        >
          <LogOut size={16} />
          Αποσυνδεση
        </button>
      </div>

      {/* 🟢 TABS (Με το νέο κουμπί "Ρυθμίσεις") */}
      <div className="flex items-center gap-2 mb-8 bg-zinc-900/50 p-1.5 rounded-2xl w-fit border border-white/5 flex-wrap">
        <button 
          onClick={() => setActiveTab('details')} 
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'details' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          <Shield size={14}/> Στοιχεια Λογαριασμου
        </button>
        <button 
          onClick={() => setActiveTab('subscription')} 
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'subscription' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          <CreditCard size={14}/> Πλανο & Χρεωσεις
        </button>
        
        {/* ΝΕΟ ΚΟΥΜΠΙ SETTINGS */}
        <button 
          onClick={() => navigate('/settings')} 
          className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 text-zinc-500 hover:text-white hover:bg-white/5 ml-2"
        >
          <SettingsIcon size={14}/> Ρυθμισεις
        </button>
      </div>

      <div className="bg-[#0f0f0f] border border-white/5 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#ccff00]"></div>
        
        {message.text && (
          <div className={`mb-8 p-4 rounded-xl border font-bold text-sm ${
            message.type === 'success' 
              ? 'bg-[#ccff00]/10 border-[#ccff00]/20 text-[#ccff00]' 
              : 'bg-red-500/10 border-red-500/20 text-red-500'
          }`}>
            {message.text}
          </div>
        )}

        {/* TAB 1: ACCOUNT DETAILS */}
        {activeTab === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-10 animate-in slide-in-from-right-4">
            
            {/* BASIC DETAILS */}
            <div className="space-y-6">
              <h4 className="text-white font-black text-[12px] uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
                <Shield size={16} className="text-[#ccff00]" /> Στοιχεια Συνδεσης
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-2 block flex items-center gap-1">
                    <AtSign size={10} /> Username
                  </label>
                  <input type="text" required value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-2 block flex items-center gap-1">
                    <Mail size={10} /> Email
                  </label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors" />
                </div>
              </div>
            </div>

            {/* PERSONAL DETAILS */}
            <div className="space-y-6">
              <h4 className="text-white font-black text-[12px] uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
                <User size={16} className="text-[#ccff00]" /> Προσωπικα Στοιχεια
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-2 block">Ονομα</label>
                  <input type="text" required value={formData.fname} onChange={(e) => setFormData({...formData, fname: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-2 block">Επωνυμο</label>
                  <input type="text" value={formData.lname} onChange={(e) => setFormData({...formData, lname: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-2 block flex items-center gap-1">
                    <Phone size={10} /> Τηλεφωνο (Προαιρετικο)
                  </label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-2 block flex items-center gap-1">
                    <Calendar size={10} /> Ημερομηνια Γεννησης
                  </label>
                  <input type="date" value={formData.birthdate} onChange={(e) => setFormData({...formData, birthdate: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors [color-scheme:dark]" />
                </div>
              </div>
            </div>

            {/* NOTIFICATIONS */}
            <div className="space-y-6">
              <h4 className="text-white font-black text-[12px] uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
                <Bell size={16} className="text-[#ccff00]" /> Ειδοποιησεις
              </h4>
              <div className="bg-black border border-white/5 rounded-2xl p-6 flex items-center justify-between group hover:border-white/10 transition-colors">
                <div>
                  <p className="text-white font-bold text-sm">Push Notifications</p>
                  <p className="text-zinc-500 text-xs mt-1">Λάβε ειδοποιήσεις για νέα σποτ, εκπομπές και updates της ILUMA.</p>
                </div>
                <button type="button" onClick={() => setFormData({...formData, pushNotifications: !formData.pushNotifications})} className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-300 focus:outline-none ${formData.pushNotifications ? 'bg-[#ccff00]' : 'bg-zinc-700'}`}>
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-black transition duration-300 ${formData.pushNotifications ? 'translate-x-9' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-8 mt-8 border-t border-white/10">
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-8 py-4 bg-[#ccff00] text-black text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-[0_10px_30px_rgba(204,255,0,0.2)] disabled:opacity-50 disabled:hover:scale-100">
                <Save size={18} /> {loading ? 'Αποθηκευση...' : 'Αποθηκευση Αλλαγων'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: SUBSCRIPTION & BILLING */}
        {activeTab === 'subscription' && (
          <div className="animate-in slide-in-from-right-4 space-y-8">
            
            <h4 className="text-white font-black text-[12px] uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
              <CreditCard size={16} className="text-[#ccff00]" /> Πλανο & Διαχειριση
            </h4>

            {formData.isPremium ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#ccff00]/10 blur-[80px] rounded-full pointer-events-none"></div>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-[#ccff00]/20 flex items-center justify-center border border-[#ccff00]/30 shadow-[0_0_20px_rgba(204,255,0,0.2)]">
                          <Crown size={20} className="text-[#ccff00]"/>
                        </div>
                        <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter">Premium Plan</h3>
                      </div>
                      <p className="text-zinc-400 text-sm font-medium">Έχετε πλήρη πρόσβαση σε όλα τα προνόμια του iRadios.</p>
                    </div>

                    {formData.stripeSubscriptionId ? (
                      <div className="text-right">
                        {subscriptionData?.status === 'canceled' ? (
                          <div className="bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-xl inline-block">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-end"><AlertCircle size={12}/> Ακυρωθηκε</p>
                            <p className="text-xs text-white">Λήγει στις {subscriptionData.currentPeriodEnd ? new Date(subscriptionData.currentPeriodEnd).toLocaleDateString('el-GR') : 'το τέλος του μήνα'}.</p>
                          </div>
                        ) : (
                          <div className="bg-[#ccff00]/5 border border-[#ccff00]/20 px-4 py-2 rounded-xl inline-block">
                            <p className="text-[10px] font-black text-[#ccff00] uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-end"><Zap size={12}/> Ενεργη</p>
                            <p className="text-xs text-white">Ανανεώνεται: {subscriptionData?.currentPeriodEnd ? new Date(subscriptionData.currentPeriodEnd).toLocaleDateString('el-GR') : '-'}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-purple-500/10 border border-purple-500/30 px-4 py-2 rounded-xl text-right inline-block">
                        <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-end"><Shield size={12}/> Admin Granted</p>
                        <p className="text-xs text-white">Lifetime Πρόσβαση</p>
                      </div>
                    )}
                  </div>
                </div>

                {formData.stripeSubscriptionId && subscriptionData?.status !== 'canceled' && (
                  <div className="flex justify-end pt-4">
                    <button 
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                      className="text-red-500 hover:text-white hover:bg-red-500 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-red-500/30 disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      {cancelLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                      Ακυρωση Ανανεωσης
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#050505] border border-white/5 rounded-[32px] p-10 md:p-12 relative overflow-hidden group">
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-48 h-48 bg-orange-500/10 blur-[80px] rounded-full pointer-events-none transition-opacity group-hover:opacity-100 opacity-50"></div>
                
                <div className="flex flex-col items-start gap-10 relative z-10">
                    <div className="flex-1 space-y-8">
                        <div className="space-y-2">
                            <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase leading-tight max-w-2xl">
                                UNLEASH <span className="text-[#ccff00]">PURE</span> SOUND.
                            </h3>
                            <p className="text-zinc-400 text-base font-medium leading-relaxed max-w-2xl">
                                Σταμάτα απλά να ακούς. Ξεκίνα να νιώθεις. Μηδέν διαφημίσεις, ζωντανή αναγνώριση τραγουδιών και απόλυτος έλεγχος στον ήχο σου.
                            </p>
                        </div>
                    </div>

                    <div className="w-full">
                      <button 
                        onClick={() => navigate('/premium')}
                        className="w-full px-10 py-5 bg-gradient-to-r from-[#ccff00] to-[#51ff00] text-black rounded-full font-black tracking-[0.2em] text-lg hover:scale-[1.03] active:scale-95 transition-all shadow-[0_15px_40px_rgba(204,255,0,0.25)] flex items-center justify-center gap-3"
                      >
                        Γίνε premium με 3.99€/μήνα <Zap size={14} className="animate-pulse" />
                      </button>
                    </div>

                    <div className="flex-1 space-y-8 w-full">
                        <div className="w-full h-px bg-white/5 my-6"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                            {[
                                { title: "ΜΗΔΕΝ ΔΙΑΦΗΜΙΣΕΙΣ", desc: "Σκοτώνουμε κάθε ηχητικό σποτ του app. Μόνο εσύ και η μουσική.", icon: <ZeroIcon size={18}/>},
                                { title: "AI MUSIC RADAR", desc: "Τέρμα το \"Άγνωστο Κομμάτι\". Βρες ακαριαία τίτλο και καλλιτέχνη.", icon: <RadarIcon size={18}/>},
                                { title: "CUSTOM DSP EQ", desc: "Studio-Grade 10-band ισοσταθμιστής για απόλυτο έλεγχο.", icon: <EqIcon size={18}/>},
                                { title: "CAR MODE PRO", desc: "Minimal UI για μέγιστη ασφάλεια κατά την οδήγηση.", icon: <CarIcon size={18}/>},
                                { title: "HI-RES THEATER", desc: "Βελτιστοποιημένος ήχος hi-fi για live arena εμπειρία.", icon: <SpeakerIcon size={18}/>},
                            ].map((feat, i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 mt-1 shrink-0 text-white group-hover:border-[#ccff00]/30 transition-colors group-hover:text-[#ccff00]">
                                        {feat.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h5 className="text-[11px] font-black text-white uppercase tracking-widest">{feat.title}</h5>
                                        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">{feat.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full pt-4">
                      <button 
                        onClick={() => navigate('/premium')}
                        className="w-full px-10 py-5 bg-gradient-to-r from-[#ccff00] to-[#51ff00] text-black rounded-full font-black tracking-[0.2em] text-lg hover:scale-[1.03] active:scale-95 transition-all shadow-[0_15px_40px_rgba(204,255,0,0.25)] flex items-center justify-center gap-3"
                      >
                        Γίνε premium με 3.99€/μήνα <Zap size={14} className="animate-pulse" />
                      </button>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// Custom Icons for showcase
const ZeroIcon = ({ size }) => (
    <div style={{width: size, height: size}} className="text-inherit">
        <svg fill="none" viewBox="0 0 16 16"><path fill="currentColor" d="M11 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM2.5 8a2.5 2.5 0 0 1 2.5-2.5h2s-3-2.5-3-2.5-2 2.5-2 2.5a2.5 2.5 0 0 1 0 5s2 2.5 2 2.5 3-2.5 3-2.5H5a2.5 2.5 0 0 1-2.5-2.5Zm8.5-4a2.5 2.5 0 0 0-2.5 2.5s-2 2.5-2 2.5H8A2.5 2.5 0 0 0 11 11s3 2.5 3 2.5 2-2.5 2-2.5a2.5 2.5 0 0 0 0-5S14 4 14 4s2-2.5 2-2.5-2.5-2.5-2.5-2.5H11Z" opacity=".5"/></svg>
    </div>
)
const RadarIcon = ({ size }) => (
    <div style={{width: size, height: size}} className="text-inherit">
        <svg fill="none" viewBox="0 0 16 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M12.667 8A4.667 4.667 0 1 1 8 3.333M8 6a2 2 0 1 1-2 2"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M12.667 12.667 14.667 14.667"/></svg>
    </div>
)
const EqIcon = ({ size }) => (
    <div style={{width: size, height: size}} className="text-inherit">
        <svg fill="none" viewBox="0 0 16 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M1.333 11.333H10M12.667 11.333H14.667M10 9.333V13.333M1.333 4.667H3.333M6 4.667H14.667M6 2.667V6.667"/></svg>
    </div>
)
const CarIcon = ({ size }) => (
    <div style={{width: size, height: size}} className="text-inherit">
        <svg fill="none" viewBox="0 0 16 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M3.333 12h9.334V5.333s-2.667-.666-4.667-.666C6 4.667 3.333 5.333 3.333 5.333V12Zm0-2V8m9.334 2V8m-11.334 0h13.334"/></svg>
    </div>
)
const SpeakerIcon = ({ size }) => (
    <div style={{width: size, height: size}} className="text-inherit">
        <svg fill="none" viewBox="0 0 16 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M8 6a2 2 0 1 1-2 2"/><rect width="13.333" height="13.333" x="1.333" y="1.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" rx="1.333"/></svg>
    </div>
)
