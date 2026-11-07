import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Send, MessageSquare, Radio, Users, Crown, Loader2 } from 'lucide-react';

const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:5011' : window.location.origin, {
  path: '/api/socket.io', 
  transports: ['websocket', 'polling']
});

// 🟢 MODERATION RULES
const BAD_WORDS = [
  'μαλακ', 'πουταν', 'γαμω', 'γαμώ', 'μουνι', 'μουνί', 'πουτσ', 'σκατα', 'σκατά', 'καριολ', 'αρχιδ',
  'malak', 'poutan', 'gamo', 'mouni', 'pouts', 'skat', 'kariol', 'arxid', 'gamw',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'slut', 'whore'
];

const containsProfanity = (text) => {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(word => lower.includes(word));
};

const isAllowedLanguage = (text) => {
  const forbiddenRegex = /[\u0400-\u04FF\u0500-\u052F\u0600-\u06FF\u0590-\u05FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;
  return !forbiddenRegex.test(text);
};

export default function MyChat({ currentUser, API_URL }) {
  const [myStations, setMyStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); // 🟢 State για τα errors
  
  const messagesEndRef = useRef(null);
  const isProducer = currentUser?.role === 'producer';

  useEffect(() => {
    const fetchMyStations = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('iluma_token');
        let endpoint;

        if (currentUser?.role === 'admin') endpoint = `${API_URL}/stations/all`;
        else if (isProducer) endpoint = `${API_URL}/producers/my-station`;
        else endpoint = `${API_URL}/broadcaster/${currentUser?._id || currentUser?.id}/stations`;

        const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        if (isProducer) {
          if (data.station) {
            setMyStations([data.station]);
            setSelectedStation(data.station);
          }
        } else {
          if (Array.isArray(data)) {
            setMyStations(data);
            if (data.length > 0) setSelectedStation(data[0]);
          }
        }
      } catch (err) { console.error("Chat station load error:", err); }
      setLoading(false);
    };

    if (currentUser) fetchMyStations();
  }, [currentUser, API_URL, isProducer]);

  useEffect(() => {
    if (!selectedStation) return;
    setIsConnected(false);
    setMessages([]);

    const joinRoom = () => socket.emit('join_station', selectedStation._id);
    if (socket.connected) joinRoom();

    socket.on('connect', joinRoom);
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('chat_history', (history) => {
      setMessages(history);
      setIsConnected(true);
      scrollToBottom();
    });

    socket.on('receive_message', (message) => {
      if (message.stationId === selectedStation._id) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.off('disconnect');
      socket.emit('leave_station', selectedStation._id);
      socket.off('chat_history');
      socket.off('receive_message');
    };
  }, [selectedStation]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setMessages((prev) => {
        const oneHourAgo = new Date(Date.now() - 3600 * 1000);
        return prev.filter(msg => {
           if (!msg.createdAt) return true; 
           return new Date(msg.createdAt) > oneHourAgo;
        });
      });
    }, 60000);
    return () => clearInterval(cleanupInterval);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedStation || !isConnected) return;

    // 🟢 ΕΛΕΓΧΟΣ MODERATION
    if (!isAllowedLanguage(text)) {
      setError('Επιτρέπονται μόνο Ελληνικά & Αγγλικά.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (containsProfanity(text)) {
      setError('Το μήνυμά σας περιέχει ακατάλληλες λέξεις.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const messageData = {
      stationId: selectedStation._id,
      userId: currentUser._id || currentUser.id,
      username: `${selectedStation.name} 🎙️`, 
      text: text
    };

    socket.emit('send_message', messageData);
    setInputText('');
    setError(''); // Καθαρισμός error
  };

  if (loading) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-[#ccff00]">
      <Loader2 size={40} className="animate-spin mb-4" />
      <p className="font-black uppercase tracking-widest text-xs">Connecting to Studio Chat...</p>
    </div>
  );

  if (myStations.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
        <Radio size={48} className="text-zinc-600 mb-4" />
        <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Δεν βρεθηκαν Σταθμοι</h2>
        <p className="text-zinc-400">Πρέπει να σας ανατεθεί ένας σταθμός για να αποκτήσετε πρόσβαση στο Live Chat.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto h-[calc(100vh-100px)] lg:h-[calc(100vh-2rem)] flex flex-col animate-fade-in">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
            <MessageSquare className="text-blue-500" size={32} />
            {isProducer ? 'Producer Live Chat' : 'Studio Live Chat'}
          </h1>
          <p className="text-sm text-zinc-400 font-medium mt-1">
            Αλληλεπιδράστε σε πραγματικό χρόνο με τους ακροατές.
          </p>
        </div>

        {myStations.length > 1 && (
          <div className="flex gap-2 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 overflow-x-auto custom-scrollbar">
            {myStations.map(station => (
              <button
                key={station._id}
                onClick={() => setSelectedStation(station)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  selectedStation?._id === station._id 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <img src={station.logo} alt="" className="w-5 h-5 rounded-full object-cover" />
                {station.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl relative">
        <div className="bg-[#111] border-b border-white/5 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            {selectedStation && (
              <>
                <div className="relative">
                  <img src={selectedStation.logo} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-white/10 p-0.5 bg-white" />
                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-[#111] rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </div>
                <div>
                  <h2 className="text-white font-black text-lg leading-tight uppercase tracking-tighter italic">{selectedStation.name}</h2>
                  <p className="text-[10px] font-bold text-[#ccff00] uppercase tracking-widest flex items-center gap-1">
                    <Users size={12} /> {isConnected ? 'Live Audience Room' : 'Disconnected...'}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full text-[10px] font-black uppercase border border-blue-500/20 tracking-widest">
            <Crown size={14} /> Official {currentUser?.role} channel
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-black/50 to-[#050505] custom-scrollbar">
          {!isConnected ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600">
              <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-center">Entering Room...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600">
              <MessageSquare size={48} className="mb-4 opacity-30" />
              <h3 className="text-white font-black text-xl mb-1 italic tracking-tighter uppercase">Silence is Gold</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 text-center max-w-sm">
                No listener messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.userId === (currentUser._id || currentUser.id);
              const isHost = msg.username.includes('🎙️'); 

              return (
                <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in zoom-in-95 duration-200`}>
                  <span className={`text-[9px] font-black mb-1.5 px-2 uppercase tracking-widest ${isHost ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {isMe ? 'YOU (STUDIO)' : msg.username}
                  </span>
                  <div 
                    className={`px-5 py-3 rounded-2xl max-w-[85%] text-sm font-medium shadow-xl ${
                      isMe 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : isHost 
                        ? 'bg-zinc-800 text-blue-400 border border-blue-500/20 rounded-tl-sm'
                        : 'bg-zinc-900 text-zinc-200 border border-white/5 rounded-tl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-[#111] border-t border-white/5 z-10 relative">
          {/* 🟢 MODERATION ERROR POPUP */}
          {error && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-md text-white border border-red-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.3)] whitespace-nowrap z-50 animate-bounce-in">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex items-center gap-3 relative">
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] animate-pulse ${isConnected ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'}`}></div>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Send message as ${selectedStation?.name || 'Studio'}...`} 
              disabled={!isConnected}
              className="flex-1 h-14 bg-black border border-white/10 rounded-2xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50 font-bold"
            />
            <button 
              type="submit" 
              disabled={!inputText.trim() || !isConnected}
              className="h-14 w-14 flex items-center justify-center bg-blue-600 text-white rounded-2xl hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all active:scale-95 shadow-lg"
            >
              <Send size={20} className="-ml-0.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
