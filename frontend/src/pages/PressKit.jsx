import React, { useState } from 'react';
import { FileText, Download, X } from 'lucide-react'; // Πρόσθεσα μερικά εικονίδια για πιο ωραίο UI

const PressKit = () => {
  const [selectedImage, setSelectedImage] = useState(null);

  // Εδώ βάζεις τα ονόματα των αρχείων που έχεις ρίξει στον φάκελο /public/presskit-assets/ (ή /public/presskit/)
  const pressImages = [
    '/presskit/iradios_fbcover-logo.png',
    '/presskit/iradios_fbcover-mockups.png',
    '/presskit/iradios-app-logo.png',
    '/presskit/noicon-iradios-app-logo.png',
    '/presskit/iradios-logo.png',
    '/presskit/iradios-wall.png',
    '/presskit/iradios-app-broadcaster-guide.png',
    '/presskit/iradios-app-agency-guide.png',
    '/presskit/station-profile-mockup.png',
    '/presskit/ads.png'
  ];

  // Βοηθητική συνάρτηση για την παραγωγή του HTML κώδικα
  const generateHtmlCode = (imgSrc, altText) => {
    const fullImgUrl = `__IRADIOS_SITE_ORIGIN__${imgSrc}`;
    return `<a href="__IRADIOS_SITE_ORIGIN__" target="_blank" rel="noopener noreferrer">\n  <img src="${fullImgUrl}" alt="${altText}" width="200" style="border-radius: 8px;" />\n</a>`;
  };

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto pt-32 pb-40 animate-fade-in">
      
      {/* 🟢 HEADERS & PRESS RELEASE CTA */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-black tracking-[0.3em] uppercase mb-4 shadow-[0_0_20px_rgba(204,255,0,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
            Media & Assets
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter mb-2">iRadios <span className="text-[#ccff00]">Press Kit</span></h1>
          <p className="text-zinc-400 font-medium max-w-2xl leading-relaxed">
            Επίσημο υλικό από την <a href="https://iluma.gr" target="_blank" rel="noreferrer" className="text-white hover:text-[#ccff00] underline decoration-white/30 underline-offset-4 transition-colors">ILUMA Digital Agency</a>. Κατεβάστε λογότυπα και γραφικά υψηλής ανάλυσης για τις προωθητικές σας ενέργειες.
          </p>
        </div>
        
        {/* 🚀 GLOWING PRESS RELEASE BUTTON */}
        <div className="relative group shrink-0">
            <div className="absolute -inset-1 bg-[#ccff00] rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-500 group-hover:duration-200"></div>
            <a 
              href="https://iradios.gr/press-release.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="relative bg-zinc-950 border border-[#ccff00]/50 text-[#ccff00] px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3 hover:bg-[#ccff00] hover:text-black transition-all active:scale-95"
            >
              <FileText size={18} /> Διαβαστε το Δελτιο Τυπου
            </a>
        </div>
      </div>

      {/* 🟢 IMAGE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
        {pressImages.map((img, index) => (
          <div 
            key={index} 
            className="bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden group cursor-pointer hover:border-[#ccff00]/50 transition-all shadow-xl hover:shadow-[0_0_30px_rgba(204,255,0,0.1)] flex flex-col"
            onClick={() => setSelectedImage(img)}
          >
            <div className="h-56 w-full flex items-center justify-center p-8 bg-black/50 relative overflow-hidden">
              {/* Checkboard pattern background for transparent PNGs */}
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(-45deg, #fff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #fff 75%), linear-gradient(-45deg, transparent 75%, #fff 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}></div>
              
              <img 
                src={img} 
                alt={`Press Kit Image ${index + 1}`} 
                className="max-h-full max-w-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500 ease-out"
              />
            </div>
            <div className="p-5 flex justify-between items-center border-t border-white/5 bg-zinc-900/80">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate pr-4">
                {img.split('/').pop()}
              </span>
              <button className="text-[#ccff00] text-[10px] font-black uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                ΠΡΟΒΟΛΗ
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 🟢 HTML BADGES SECTION */}
      <div className="border-t border-white/5 pt-16">
        <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter mb-4">HTML Badges</h2>
        <p className="text-zinc-400 mb-10 max-w-3xl leading-relaxed">
          Αντιγράψτε τον παρακάτω κώδικα για να προσθέσετε τα επίσημα badges του iRadios στο site του σταθμού σας. Τα links οδηγούν απευθείας στην πλατφόρμα.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Badge 1: Κανονικό Logo */}
          <div className="flex flex-col gap-6 bg-zinc-900/30 p-8 rounded-[32px] border border-white/5 hover:border-white/10 transition-colors">
            <div className="w-full flex items-center justify-center bg-black p-8 rounded-2xl border border-white/5 shadow-inner h-40">
              <img src="/presskit/iradios-app-logo.png" alt="iRadios App Logo" className="max-h-full max-w-[200px] object-contain" />
            </div>
            <div className="w-full flex flex-col flex-1">
              <h3 className="text-[#ccff00] text-xs font-black uppercase tracking-widest mb-3">Standard App Logo</h3>
              <div className="relative flex-1 flex flex-col">
                <textarea 
                  readOnly 
                  className="w-full flex-1 min-h-[100px] bg-black/50 text-zinc-400 font-mono text-[10px] p-5 rounded-xl border border-white/10 focus:outline-none focus:border-[#ccff00]/50 transition-colors resize-none custom-scrollbar"
                  value={generateHtmlCode('/presskit/iradios-app-logo.png', 'Listen on iRadios App')}
                  onClick={(e) => e.target.select()}
                  title="Κάντε κλικ για επιλογή κειμένου"
                />
              </div>
            </div>
          </div>

          {/* Badge 2: Logo χωρίς εικονίδιο */}
          <div className="flex flex-col gap-6 bg-zinc-900/30 p-8 rounded-[32px] border border-white/5 hover:border-white/10 transition-colors">
            <div className="w-full flex items-center justify-center bg-black p-8 rounded-2xl border border-white/5 shadow-inner h-40">
              <img src="/presskit/noicon-iradios-app-logo.png" alt="iRadios Logo Text" className="max-h-full max-w-[200px] object-contain" />
            </div>
            <div className="w-full flex flex-col flex-1">
              <h3 className="text-[#ccff00] text-xs font-black uppercase tracking-widest mb-3">Text-Only Logo</h3>
              <div className="relative flex-1 flex flex-col">
                <textarea 
                  readOnly 
                  className="w-full flex-1 min-h-[100px] bg-black/50 text-zinc-400 font-mono text-[10px] p-5 rounded-xl border border-white/10 focus:outline-none focus:border-[#ccff00]/50 transition-colors resize-none custom-scrollbar"
                  value={generateHtmlCode('/presskit/noicon-iradios-app-logo.png', 'Powered by iRadios')}
                  onClick={(e) => e.target.select()}
                  title="Κάντε κλικ για επιλογή κειμένου"
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 🟢 IMAGE MODAL */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative max-w-5xl w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
            
            <button 
              className="absolute -top-12 right-0 md:-right-12 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-full transition-all"
              onClick={() => setSelectedImage(null)}
            >
              <X size={24} />
            </button>

            <div className="w-full bg-zinc-900/50 border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl mb-8 relative overflow-hidden flex items-center justify-center min-h-[40vh]">
              {/* Checkerboard for transparency */}
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(-45deg, #fff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #fff 75%), linear-gradient(-45deg, transparent 75%, #fff 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}></div>
              <img 
                src={selectedImage} 
                alt="Selected Press Kit" 
                className="max-h-[60vh] object-contain relative z-10 drop-shadow-2xl"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <a 
                href={selectedImage} 
                download
                className="bg-[#ccff00] text-black px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_15px_30px_rgba(204,255,0,0.2)] w-full sm:w-auto"
              >
                <Download size={18} /> ΛΗΨΗ ΑΡΧΕΙΟΥ
              </a>
              <button 
                onClick={() => setSelectedImage(null)}
                className="bg-transparent border border-white/20 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/5 transition-colors w-full sm:w-auto"
              >
                ΚΛΕΙΣΙΜΟ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PressKit;
