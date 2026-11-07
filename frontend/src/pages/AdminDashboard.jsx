import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Euro, PlayCircle, MousePointerClick, Users, Activity, Crown, Radio, Mic, Briefcase, Puzzle,
  TrendingUp, Award, RefreshCw, Image as ImageIcon, Percent
} from 'lucide-react';

export default function AdminDashboard({ API_URL, globalSocket }) {
  const [stats, setStats] = useState({
    revenueData: [], roleData: [], topStations: [], topAds: [], topBanners: [], activityFeed: [],
    totals: { revenue: 0, users: 0, premiumUsers: 0 },
    roleCounts: { listeners: 0, broadcasters: 0, producers: 0, agencies: 0 },
    stationStats: { activeStations: 0 },
    adStats: {
      audio: { plays: 0, clicks: 0, ctr: 0 },
      banner: { views: 0, clicks: 0, ctr: 0 }
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 🟢 Live Listeners State
  const [liveListeners, setLiveListeners] = useState(0);

  const COLORS = ['#ccff00', '#ffffff', '#ff00cc', '#00e6ff', '#f97316'];

  // 🟢 HTTP Polling για τα Συνολικά Στατιστικά (Network)
  const fetchLiveNetworkStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats/network`); 
      if (res.ok) {
        const data = await res.json();
        // Ενημερώνουμε τα live listeners. Τους χρήστες τους παίρνουμε και από το dashboard-stats,
        // αλλά για απόλυτη σιγουριά τα ανανεώνουμε κι εδώ.
        if (data.totals?.liveListeners !== undefined) {
          setLiveListeners(data.totals.liveListeners);
        }
      }
    } catch (err) {
      console.error("Failed to fetch live network stats", err);
    }
  };

  const fetchDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('iluma_token');
      const res = await fetch(`${API_URL}/admin/dashboard-stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        
        setStats(prev => ({
          ...prev,
          ...data,
          adStats: data.adStats || {
            audio: { plays: data.totals?.plays || 0, clicks: data.totals?.clicks || 0, ctr: data.totals?.plays ? ((data.totals.clicks / data.totals.plays) * 100).toFixed(2) : 0 },
            banner: { views: data.totals?.bannerViews || 0, clicks: data.totals?.bannerClicks || 0, ctr: data.totals?.bannerViews ? ((data.totals.bannerClicks / data.totals.bannerViews) * 100).toFixed(2) : 0 }
          },
          roleCounts: data.roleCounts || {
             listeners: data.roleData?.find(r => r.name === 'Ακροατές')?.value || 0,
             broadcasters: data.roleData?.find(r => r.name === 'Broadcasters')?.value || 0,
             producers: data.roleData?.find(r => r.name === 'Producers')?.value || 0,
             agencies: data.roleData?.find(r => r.name === 'Agencies')?.value || 0,
          }
        }));
      }
    } catch (err) { 
      console.error("Error fetching stats:", err); 
    }

    // Κλήση και στο public stats endpoint για το Live
    await fetchLiveNetworkStats();

    if (globalSocket && globalSocket.connected) {
      globalSocket.emit('get_live_count');
    }

    setLoading(false);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // 🟢 Initial Load & HTTP Polling Setup
  useEffect(() => {
    fetchDashboardData();
    
    // Ανανέωση κάθε 15 δευτερόλεπτα (backup σε περίπτωση που κοπεί το socket)
    const interval = setInterval(fetchLiveNetworkStats, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // 🟢 Το Socket για την ακαριαία (real-time) ενημέρωση
  useEffect(() => {
    if (!globalSocket) return;

    const handleLiveCount = (count) => {
      setLiveListeners(count);
    };

    // Ακούμε και στα δύο events για απόλυτη σιγουριά
    globalSocket.on('admin_live_listeners', handleLiveCount);
    globalSocket.on('global_live_listeners', handleLiveCount);

    if (globalSocket.connected) {
      globalSocket.emit('get_live_count');
    } else {
      globalSocket.on('connect', () => globalSocket.emit('get_live_count'));
    }

    return () => {
      globalSocket.off('admin_live_listeners', handleLiveCount);
      globalSocket.off('global_live_listeners', handleLiveCount);
    };
  }, [globalSocket]);

  if (loading) return <div className="p-12 text-[#ccff00] text-center animate-pulse font-black text-xl tracking-widest uppercase">Φορτωση Control Center...</div>;

  const freePremiumData = [
    { name: 'Free Users', value: Math.max(0, stats.totals.users - stats.totals.premiumUsers) },
    { name: 'Premium', value: stats.totals.premiumUsers }
  ];

  const b2bData = [
    { name: 'Broadcasters', value: stats.roleCounts.broadcasters },
    { name: 'Producers', value: stats.roleCounts.producers },
    { name: 'Agencies', value: stats.roleCounts.agencies }
  ].filter(d => d.value > 0);

  return (
    <div className="p-4 lg:p-8 max-w-full pb-40 animate-fade-in">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <Activity className="text-[#ccff00]" size={36} />
          <h2 className="text-3xl lg:text-4xl font-black text-white uppercase italic tracking-tighter">Control Center</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 border border-red-500/30 px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute"></div>
            <div className="w-3 h-3 bg-red-500 rounded-full relative z-10"></div>
            <span className="text-red-400 font-black tracking-widest text-sm hidden sm:inline">Ακροατές Live:</span>
            <span className="text-white font-black text-xl font-mono">{liveListeners.toLocaleString()}</span>
          </div>
          <button 
            onClick={fetchDashboardData}
            disabled={isRefreshing}
            className={`p-3 bg-zinc-900 border border-white/10 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-all shadow-lg active:scale-90 ${isRefreshing ? 'animate-spin text-[#ccff00] border-[#ccff00]/50' : ''}`}
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {[
          { icon: <Euro/>, label: "Εσοδα", val: `€${stats.totals.revenue.toFixed(2)}`, c: "text-[#ccff00]" },
          { icon: <Users/>, label: "Χρηστες", val: stats.totals.users.toLocaleString(), c: "text-emerald-400" },
          { icon: <Crown/>, label: "Premium", val: stats.totals.premiumUsers.toLocaleString(), c: "text-orange-400" },
          { icon: <Mic/>, label: "Broadcasters", val: stats.roleCounts.broadcasters.toLocaleString(), c: "text-purple-400" },
          { icon: <Radio/>, label: "Σταθμοι", val: stats.stationStats.activeStations.toLocaleString(), c: "text-blue-400" },
          { icon: <Puzzle/>, label: "Producers", val: stats.roleCounts.producers.toLocaleString(), c: "text-fuchsia-400" },
          { icon: <Briefcase/>, label: "Agencies", val: stats.roleCounts.agencies.toLocaleString(), c: "text-pink-400" }
        ].map((kpi, i) => (
          <div key={i} className="bg-zinc-900/50 border border-white/5 p-4 rounded-[20px] flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors">
            <div className={`mb-2 ${kpi.c}`}>{kpi.icon}</div>
            <div className="text-2xl font-black text-white leading-none mb-1">{kpi.val}</div>
            <div className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[24px]">
          <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-[#ccff00]"/> Εσοδα ανα Μηνα</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.revenueData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#666" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(204,255,0,0.3)', borderRadius: '12px', color: '#fff' }} itemStyle={{ color: '#ccff00' }} formatter={(v) => [`€${v}`, 'Έσοδα']} />
                <Bar dataKey="amount" fill="#ccff00" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🟢 ΔΙΟΡΘΩΜΕΝΟ PIE CHART 1 */}
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[24px] flex flex-col items-center justify-center">
          <h3 className="text-white font-bold uppercase tracking-widest text-xs mb-2 self-start flex items-center gap-2"><Briefcase size={16} className="text-purple-400"/> B2B Πελατες</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie cy="45%" data={b2bData.length ? b2bData : [{name: 'Κενό', value: 1}]} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                  {b2bData.map((e, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '11px', color: '#aaa' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🟢 ΔΙΟΡΘΩΜΕΝΟ PIE CHART 2 */}
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[24px] flex flex-col items-center justify-center">
          <h3 className="text-white font-bold uppercase tracking-widest text-xs mb-2 self-start flex items-center gap-2"><Crown size={16} className="text-orange-400"/> Free vs Premium</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie cy="45%" data={freePremiumData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                  <Cell fill="#ffffff" />
                  <Cell fill="#f97316" />
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '11px', color: '#aaa' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Audio Plays", val: stats.adStats.audio.plays.toLocaleString(), icon: <PlayCircle size={18}/>, c: "text-blue-400" },
          { label: "Audio Clicks", val: stats.adStats.audio.clicks.toLocaleString(), icon: <MousePointerClick size={18}/>, c: "text-blue-400" },
          { label: "Audio CTR", val: `${stats.adStats.audio.ctr}%`, icon: <Percent size={18}/>, c: "text-blue-400" },
          { label: "Banner Views", val: stats.adStats.banner.views.toLocaleString(), icon: <ImageIcon size={18}/>, c: "text-fuchsia-400" },
          { label: "Banner Clicks", val: stats.adStats.banner.clicks.toLocaleString(), icon: <MousePointerClick size={18}/>, c: "text-fuchsia-400" },
          { label: "Banner CTR", val: `${stats.adStats.banner.ctr}%`, icon: <Percent size={18}/>, c: "text-fuchsia-400" }
        ].map((metric, i) => (
          <div key={i} className="bg-zinc-900/30 border border-white/5 p-4 rounded-[16px] flex items-center justify-between">
            <div>
              <div className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-1">{metric.label}</div>
              <div className={`text-xl font-black ${metric.c}`}>{metric.val}</div>
            </div>
            <div className={`opacity-20 ${metric.c}`}>{metric.icon}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[24px]">
          <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2"><Radio size={16} className="text-[#ccff00]"/> Top 10 Σταθμοι</h3>
          <div className="divide-y divide-white/5">
            {stats.topStations.length > 0 ? stats.topStations.map((s, i) => (
              <div key={s.id || i} className="flex justify-between items-center py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-zinc-600 font-black text-sm w-4 shrink-0">{i + 1}.</span>
                  <span className="text-white font-bold text-xs truncate">{s.name}</span>
                </div>
                <span className="text-[#ccff00] font-mono text-[10px] font-bold shrink-0">{Number(s.plays || 0).toLocaleString()} plays</span>
              </div>
            )) : <div className="text-zinc-600 text-xs py-2">Δεν υπάρχουν δεδομένα</div>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[24px]">
          <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2"><ImageIcon size={16} className="text-fuchsia-400"/> Top 10 Banners</h3>
          <div className="divide-y divide-white/5">
            {stats.topBanners && stats.topBanners.length > 0 ? stats.topBanners.map((b, i) => (
              <div key={b.id || i} className="flex justify-between items-center py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-zinc-600 font-black text-sm w-4 shrink-0">{i + 1}.</span>
                  <div className="min-w-0">
                    <div className="text-white font-bold text-xs truncate">{b.title}</div>
                    <div className="text-zinc-500 text-[9px] uppercase truncate">{b.company}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-fuchsia-400 font-black text-xs block">{b.ctr}%</span>
                  <span className="text-zinc-600 text-[9px] font-mono">{Number(b.views || 0).toLocaleString()} views</span>
                </div>
              </div>
            )) : <div className="text-zinc-600 text-xs py-2">Δεν υπάρχουν δεδομένα</div>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[24px]">
          <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2"><Award size={16} className="text-blue-400"/> Top 10 Audio Ads</h3>
          <div className="divide-y divide-white/5">
            {stats.topAds.length > 0 ? stats.topAds.map((ad, i) => (
              <div key={ad.id || i} className="flex justify-between items-center py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-zinc-600 font-black text-sm w-4 shrink-0">{i + 1}.</span>
                  <div className="min-w-0">
                    <div className="text-white font-bold text-xs truncate">{ad.title}</div>
                    <div className="text-zinc-500 text-[9px] uppercase truncate">{ad.company}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-blue-400 font-black text-xs block">{ad.ctr}%</span>
                  <span className="text-zinc-600 text-[9px] font-mono">{Number(ad.plays || 0).toLocaleString()} plays</span>
                </div>
              </div>
            )) : <div className="text-zinc-600 text-xs py-2">Δεν υπάρχουν δεδομένα</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
