import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, FileText, CheckCircle, Circle, Building2, User, 
  Mail, Phone, Calendar, CreditCard, AlertCircle, Check 
} from 'lucide-react';

export default function AdminPaid({ API_URL }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('iluma_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // 🟢 1. Φόρτωση Συναλλαγών
  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Υποθέτουμε ότι έχεις φτιάξει ένα endpoint /api/admin/transactions
      const res = await fetch(`${API_URL}/admin/transactions`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error("Σφάλμα φόρτωσης πληρωμών:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // 🟢 2. Αλλαγή Κατάστασης Τιμολογίου (Απεστάλη)
  const handleToggleInvoice = async (transactionId, currentStatus) => {
    if (!window.confirm(currentStatus ? 'Να ακυρωθεί η αποστολή τιμολογίου;' : 'Επιβεβαιώνεις ότι έστειλες το τιμολόγιο σε αυτόν τον πελάτη;')) return;
    
    try {
      // Υποθέτουμε ότι έχεις φτιάξει ένα endpoint PUT /api/admin/transactions/:id/invoice
      const res = await fetch(`${API_URL}/admin/transactions/${transactionId}/invoice`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ invoiceSent: !currentStatus })
      });
      
      if (res.ok) {
        // Ενημερώνουμε το state τοπικά για να αλλάξει αμέσως το UI
        setTransactions(prev => prev.map(tx => 
          tx._id === transactionId ? { ...tx, invoiceSent: !currentStatus } : tx
        ));
      } else {
        alert('Υπήρξε σφάλμα κατά την ενημέρωση.');
      }
    } catch (err) {
      console.error(err);
      alert('Σφάλμα δικτύου.');
    }
  };

  // 🟢 3. Universal Search Logic
  const filteredTransactions = transactions.filter(tx => {
    const search = searchTerm.toLowerCase();
    // 🟢 Ψάχνουμε μέσα στο tx.user (είτε στο agencyProfile είτε στο billingInfo)
    const company = (tx.user?.agencyProfile?.companyName || tx.user?.billingInfo?.companyName || '').toLowerCase();
    const afm = (tx.user?.agencyProfile?.vatNumber || tx.user?.billingInfo?.vatNumber || '').toLowerCase();
    const email = tx.user?.email?.toLowerCase() || '';
    const phone = tx.user?.phone?.toLowerCase() || '';
    const plan = tx.planName?.toLowerCase() || '';
    const role = tx.user?.role?.toLowerCase() || '';

    return company.includes(search) || 
           afm.includes(search) || 
           email.includes(search) || 
           phone.includes(search) || 
           plan.includes(search) ||
           role.includes(search);
  });

  return (
    <div className="admin-legacy-page space-y-6">
      
      <div className="flex justify-end gap-3 flex-wrap">
        <Link to="/backoffice/admin/billing/sandbox" className="rounded-xl border border-white/20 bg-white/5 text-zinc-100 px-4 py-3 font-bold text-sm hover:bg-white/10">
          Nexi Sandbox πληρωμές & logs
        </Link>
        <Link to="/backoffice/admin/billing/grants" className="rounded-xl border border-lime-500/30 bg-[#ccff00]/10 text-[#ccff00] px-4 py-3 font-bold text-sm hover:bg-[#ccff00]/20">
          Διαχείριση δωρεάν συνδρομών
        </Link>
      </div>
            {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FileText className="text-[#ccff00]" size={28} />
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Συναλλαγές & παραστατικά</h2>
          </div>
          <p className="text-zinc-500 text-sm font-medium">
            Διαχειριστείτε τις πληρωμές από Agencies & Broadcasters και εκδώστε τα τιμολόγιά τους.
          </p>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[24px]">
          <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Σύνολο συναλλαγών</div>
          <div className="text-3xl font-black text-white">{transactions.length}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-[24px]">
          <div className="text-orange-400 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1"><AlertCircle size={12}/> Εκκρεμή παραστατικά</div>
          <div className="text-3xl font-black text-orange-400">{transactions.filter(t => !t.invoiceSent).length}</div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative w-full max-w-md mb-8">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input 
          type="text" 
          placeholder="Αναζήτηση με Επωνυμία, ΑΦΜ, Email, Τηλέφωνο..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="w-full bg-zinc-900/50 border border-white/10 h-14 rounded-2xl pl-12 pr-10 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-all placeholder:text-zinc-600 font-medium" 
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs font-semibold text-zinc-400">{filteredTransactions.length} από {transactions.length} συναλλαγές</p>
        {searchTerm&&<button type="button" onClick={()=>setSearchTerm('')}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-[#caff00]">
          Καθαρισμός αναζήτησης</button>}
      </div>
      {/* LIST / GRID */}
      {loading ? (
        <div className="flex justify-center p-20 text-[#ccff00] animate-pulse">Φόρτωση δεδομένων...</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[32px]">
          <FileText size={48} className="mx-auto text-zinc-700 mb-4" />
          <h3 className="text-xl font-black text-zinc-400 mb-2">Δεν βρέθηκαν συναλλαγές</h3>
          <p className="text-zinc-600 text-sm">Δεν υπάρχουν πληρωμές που να ταιριάζουν στην αναζήτηση.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTransactions.map((tx) => (
            <div 
              key={tx._id} 
              className={`p-5 md:p-6 rounded-[24px] border flex flex-col xl:flex-row xl:items-center justify-between gap-6 transition-all shadow-lg ${
                tx.invoiceSent 
                  ? 'bg-zinc-900/30 border-white/5 hover:border-white/10' 
                  : 'bg-orange-950/10 border-orange-500/30 hover:border-orange-500/50'
              }`}
            >
              
              {/* ΑΡΙΣΤΕΡΑ: Στοιχεία Εταιρείας & Χρήστη */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Company Info */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 size={16} className={tx.invoiceSent ? "text-zinc-500" : "text-orange-400"} />
                    <h3 className="font-black text-white text-lg tracking-tight uppercase">
                      {
                        tx.billingInfo?.companyName || 
                        tx.user?.agencyProfile?.companyName || 
                        tx.user?.broadcasterProfile?.companyName || 
                        tx.user?.billingInfo?.companyName || 
                        tx.user?.companyName || 
                        (tx.user?.fname ? `${tx.user.fname} ${tx.user.lname}` : 'ΑΓΝΩΣΤΗ ΕΤΑΙΡΕΙΑ')
                      }
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className="bg-white/10 text-white px-2 py-1 rounded border border-white/5 font-bold font-mono tracking-widest">
                      ΑΦΜ: {
                        tx.billingInfo?.vatNumber || 
                        tx.user?.agencyProfile?.vatNumber || 
                        tx.user?.broadcasterProfile?.vatNumber || 
                        tx.user?.billingInfo?.vatNumber || 
                        tx.user?.vatNumber || 
                        'ΜΗ ΔΙΑΘΕΣΙΜΟ'
                      }
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                      tx.user?.role === 'agency' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {tx.user?.role || 'User'}
                    </span>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="flex flex-col justify-center space-y-2 border-l border-white/5 pl-0 md:pl-6">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Mail size={14} className="text-zinc-600" /> {tx.user?.email || '-'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Phone size={14} className="text-zinc-600" /> {tx.user?.phone || '-'}
                  </div>
                </div>
              </div>

              {/* ΜΕΣΗ: Πληροφορίες Πληρωμής */}
              <div className="flex flex-col justify-center border-t xl:border-t-0 xl:border-l border-white/5 pt-4 xl:pt-0 xl:pl-6 shrink-0 min-w-[200px]">
                <div className="flex items-center gap-2 text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                  <CreditCard size={14} /> Υπηρεσια / Πακετο
                </div>
                <div className="text-white font-bold text-sm mb-2">{tx.planName || 'Custom Plan'}</div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#ccff00]">
                  <Calendar size={14} /> 
                  {new Date(tx.createdAt).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-2xl font-black text-white mt-2">
                  {tx.amount}€
                </div>
              </div>

              {/* ΔΕΞΙΑ: Κουμπί Τιμολογίου */}
              <div className="shrink-0 flex flex-col items-end border-t xl:border-t-0 xl:border-l border-white/5 pt-4 xl:pt-0 xl:pl-6">
                {!tx.invoiceSent ? (
                  <button 
                    onClick={() => handleToggleInvoice(tx._id, tx.invoiceSent)}
                    className="w-full xl:w-auto flex flex-col items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-black px-6 py-4 rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(249,115,22,0.3)] group"
                  >
                    <AlertCircle size={24} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Στειλε Τιμολογιο</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleToggleInvoice(tx._id, tx.invoiceSent)}
                    className="w-full xl:w-auto flex flex-col items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-4 rounded-xl transition-all"
                  >
                    <CheckCircle size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Τιμολογιο Εσταλη</span>
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
