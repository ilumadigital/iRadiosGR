import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Send, X, MessageSquare, Loader2 } from 'lucide-react';

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
  // Απαγορεύει Κυριλλικά, Αραβικά, Εβραϊκά, Ασιατικά αλφάβητα κλπ.
  const forbiddenRegex = /[\u0400-\u04FF\u0500-\u052F\u0600-\u06FF\u0590-\u05FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;
  return !forbiddenRegex.test(text);
};

export default function LiveChat({ currentStation, currentUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(''); // 🟢 State για τα errors
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!currentStation || !currentUser) return;
    setIsConnected(false);

    const joinRoom = () => socket.emit('join_station', currentStation._id);
    if (socket.connected) joinRoom();
    
    socket.on('connect', joinRoom);
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('chat_history', (history) => {
      setMessages(history);
      setIsConnected(true);
      scrollToBottom();
    });

    socket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.off('disconnect');
      socket.emit('leave_station', currentStation._id);
      socket.off('chat_history');
      socket.off('receive_message');
    };
  }, [currentStation, currentUser]);

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
    if (!text || !isConnected) return;

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

    let displayName = `Ακροατής του ${currentStation.name}`;
    if (currentUser.fname) {
      displayName = currentUser.fname;
      if (currentUser.lname) {
        displayName += ` ${currentUser.lname.charAt(0)}.`;
      }
    }

    const messageData = {
      stationId: currentStation._id,
      userId: currentUser._id,
      username: displayName, 
      text: text
    };

    socket.emit('send_message', messageData);
    setInputText('');
    setError(''); // Καθαρισμός error αν όλα πήγαν καλά
  };

  return (
    <div className="fixed bottom-24 right-4 md:bottom-28 md:right-8 w-[350px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[60vh] bg-[#0a0a0a] border border-[#ccff00]/30 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden z-[100] animate-in slide-in-from-bottom-10">
      
      {/* Header */}
      <div className="bg-[#111] p-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={currentStation.logo} alt="Station" className="w-8 h-8 rounded-full object-cover border border-[#ccff00]" />
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[#111] rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
          </div>
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">LIVE CHAT</h3>
            <p className="text-[#ccff00] text-[10px] font-bold">{currentStation.name}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors bg-white/5 p-1.5 rounded-full">
          <X size={18} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/50">
        {!isConnected ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600">
            <Loader2 size={24} className="animate-spin mb-2 text-[#ccff00]" />
            <p className="text-xs font-bold uppercase tracking-widest">Συνδεση...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600">
            <MessageSquare size={32} className="mb-2 opacity-50" />
            <p className="text-xs font-bold uppercase tracking-widest text-center">Δεν υπαρχουν μηνυματα.<br/>Στειλε το πρωτο!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.userId === currentUser._id;
            const isHost = msg.username.includes('🎙️');
            
            return (
              <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in zoom-in-95 duration-200`}>
                <span className={`text-[9px] font-black mb-1 ml-1 ${isHost ? 'text-blue-400' : 'text-zinc-500'}`}>
                  {isMe ? 'ΕΣΥ' : msg.username}
                </span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm font-medium ${
                  isMe ? 'bg-[#ccff00] text-black rounded-tr-sm' 
                  : isHost ? 'bg-zinc-800 text-blue-400 border border-blue-500/30 rounded-tl-sm' 
                  : 'bg-zinc-800 text-white rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#111] border-t border-white/5 relative">
        {/* 🟢 MODERATION ERROR POPUP */}
        {error && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-md text-white border border-red-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.3)] whitespace-nowrap z-50 animate-bounce-in">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Γράψε ένα μήνυμα..." 
            disabled={!isConnected}
            className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ccff00] transition-colors disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!inputText.trim() || !isConnected}
            className="bg-[#ccff00] text-black p-3 rounded-xl hover:bg-[#b3e600] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
