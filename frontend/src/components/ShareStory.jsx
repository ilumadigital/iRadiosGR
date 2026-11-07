import React, { useState } from 'react';
import { Instagram, Loader2 } from 'lucide-react';
import { FastAverageColor } from 'fast-average-color';
import { cleanMetadata } from '../utils/cleanMetadata';

export default function ShareStory({ currentStation, nowPlaying }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const API_URL = '__IRADIOS_SITE_ORIGIN__/api';

  const generateStoryImage = async () => {
    return new Promise(async (resolve, reject) => {
      try {
        if (!currentStation || !currentStation.logo) {
          throw new Error('Δεν βρέθηκαν πληροφορίες σταθμού.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        const fac = new FastAverageColor();

        // 1. ΚΑΘΑΡΙΣΜΟΣ ΚΑΙ ΑΝΑΖΗΤΗΣΗ COVER ART
        const cleanTitle = cleanMetadata(nowPlaying);
        let fetchedCoverArt = null;

        if (cleanTitle) {
          try {
            const res = await fetch(`${API_URL}/cover-art?term=${encodeURIComponent(cleanTitle)}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.artworkUrl) {
                fetchedCoverArt = data.artworkUrl;
              }
            }
          } catch (e) {
            console.error("Story Cover Fetch Error:", e);
          }
        }

        // Λογικές μεταβλητές 
        const hasCustomCover = !!fetchedCoverArt && fetchedCoverArt !== currentStation.logo;
        const mainImageUrl = hasCustomCover ? fetchedCoverArt : currentStation.logo;

        // Custom Helper Function για τη σχεδίαση Rounded Rect Path
        const pathRoundedRect = (context, x, y, width, height, radius) => {
          context.beginPath();
          context.moveTo(x + radius, y);
          context.arcTo(x + width, y, x + width, y + height, radius);
          context.arcTo(x + width, y + height, x, y + height, radius);
          context.arcTo(x, y + height, x, y, radius);
          context.arcTo(x, y, x + width, y, radius);
          context.closePath();
        }

        // Helper για load image με CORS proxy
        const loadImage = (url) => {
          return new Promise((res, rej) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent(url)}`;
            img.onload = () => res(img);
            img.onerror = () => rej(new Error(`Αποτυχία φόρτωσης εικόνας: ${url}`));
            img.src = proxiedUrl;
          });
        };

        // 2. ΦΟΡΤΩΣΗ ΕΙΚΟΝΩΝ
        const mainImg = await loadImage(mainImageUrl);
        let stationImg = null;
        if (hasCustomCover) {
           stationImg = await loadImage(currentStation.logo);
        }
        const iradiosLogo = await loadImage('__IRADIOS_SITE_ORIGIN__/presskit/iradios-app-logo.png');

        // Ανάλυση χρώματος από την ΚΥΡΙΑ εικόνα 
        const colorInfo = await fac.getColorAsync(mainImg);
        const accentColor = colorInfo.hex;

        // 3. ΣΧΕΔΙΑΣΗ ΣΤΑΤΙΚΟΥ GRADIENT BACKGROUND
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1080, 1920);

        const radialGradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0, 
          canvas.width / 2, canvas.height / 2, canvas.height / 1.1 
        );
        radialGradient.addColorStop(0, '#151515'); 
        radialGradient.addColorStop(1, '#000000'); 
        ctx.fillStyle = radialGradient;
        ctx.fillRect(0, 0, 1080, 1920);

        const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
        gradient.addColorStop(0, 'rgba(5, 5, 5, 0.4)');    
        gradient.addColorStop(0.4, 'rgba(5, 5, 5, 0.1)');    
        gradient.addColorStop(0.8, 'rgba(5, 5, 5, 0.6)');    
        gradient.addColorStop(1, 'rgba(5, 5, 5, 0.9)');     
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1920);

        // 4. STATION LOGO (Top Left) ΜΟΝΟ ΑΝ ΕΧΟΥΜΕ CUSTOM COVER
        if (hasCustomCover && stationImg) {
            const topLogoSize = 140;
            const topLogoX = 80;
            const topLogoY = 120;
            
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 30;
            ctx.fillStyle = '#ffffff';
            pathRoundedRect(ctx, topLogoX, topLogoY, topLogoSize, topLogoSize, 30);
            ctx.fill();
            ctx.restore();

            ctx.save();
            pathRoundedRect(ctx, topLogoX, topLogoY, topLogoSize, topLogoSize, 30);
            ctx.clip();
            const ratio = Math.min(topLogoSize / stationImg.width, topLogoSize / stationImg.height);
            const nw = stationImg.width * ratio;
            const nh = stationImg.height * ratio;
            ctx.drawImage(stationImg, topLogoX + (topLogoSize - nw)/2, topLogoY + (topLogoSize - nh)/2, nw, nh);
            ctx.restore();
        }

        // 5. ΚΕΝΤΡΙΚΗ ΕΙΚΟΝΑ (Cover Art ή Logo)
        const mainSize = hasCustomCover ? 700 : 540; 
        const mainX = 540;
        const mainY = hasCustomCover ? 700 : 660; 
        const mainRadius = 40; 

        ctx.save();
        ctx.shadowColor = accentColor; 
        ctx.shadowBlur = 120;
        ctx.globalAlpha = 0.4;
        const bgSize = mainSize + 4; 
        pathRoundedRect(ctx, mainX - bgSize/2, mainY - bgSize/2, bgSize, bgSize, mainRadius + 2);
        ctx.fillStyle = accentColor;
        ctx.fill();
        ctx.restore();

        ctx.save();
        pathRoundedRect(ctx, mainX - mainSize/2, mainY - mainSize/2, mainSize, mainSize, mainRadius);
        ctx.clip();
        
        if (hasCustomCover) {
            const ratio = Math.max(mainSize / mainImg.width, mainSize / mainImg.height);
            const nw = mainImg.width * ratio;
            const nh = mainImg.height * ratio;
            ctx.drawImage(mainImg, mainX - nw/2, mainY - nh/2, nw, nh);
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(mainX - mainSize/2, mainY - mainSize/2, mainSize, mainSize);
            const ratio = Math.min(mainSize / mainImg.width, mainSize / mainImg.height);
            const nw = mainImg.width * ratio;
            const nh = mainImg.height * ratio;
            ctx.drawImage(mainImg, mainX - nw/2, mainY - nh/2, nw, nh);
        }
        ctx.restore();

        // --- 6. ΤΥΠΟΓΡΑΦΙΑ & NEON BADGE ---
        ctx.save();
        // Το badge λέει ΠΑΝΤΑ "NOW PLAYING" εφόσον υπάρχει τραγούδι
        const badgeText = cleanTitle ? 'NOW PLAYING' : 'LIVE BROADCAST';
        
        ctx.font = '900 32px sans-serif';
        ctx.letterSpacing = '8px'; 
        const textMetrics = ctx.measureText(badgeText);
        const textWidth = textMetrics.width;

        const pillHeight = 76;
        const paddingX = 40;
        const dotRadius = 9;
        const dotGap = 24;

        const pillWidth = paddingX * 2 + (dotRadius * 2) + dotGap + textWidth;
        const pillX = 540 - (pillWidth / 2);
        const pillY = mainY + (mainSize / 2) + 60; 

        // Background του Pill
        pathRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
        ctx.fillStyle = 'rgba(20, 20, 20, 0.8)'; 
        ctx.fill();
        
        ctx.lineWidth = 2;
        // Αν έχουμε title, το περίγραμμα παίρνει το accent χρώμα, αλλιώς πράσινο
        ctx.strokeStyle = cleanTitle ? accentColor : '#ccff00';
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1;

        const dotColor = cleanTitle ? accentColor : '#ccff00';
        const dotX = pillX + paddingX + dotRadius;
        const dotY = pillY + (pillHeight / 2);
        
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.shadowColor = dotColor;
        ctx.shadowBlur = 18; 
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = dotColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, dotX + dotRadius + dotGap, dotY + 4); 
        ctx.restore();

        // Helper για word-wrap
        const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
          const words = text.split(' ');
          let line = ''; let currentY = y;
          context.letterSpacing = '0px';
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            if (context.measureText(testLine).width > maxWidth && n > 0) {
              context.fillText(line, x, currentY);
              line = words[n] + ' '; currentY += lineHeight;
            } else { line = testLine; }
          }
          context.fillText(line, x, currentY);
          return currentY;
        };

        // 🟢 ΕΔΩ Η ΜΑΓΕΙΑ! Αν υπάρχει cleanTitle, το δείχνει ως mainTitle, ΑΣΧΕΤΑ αν βρήκε εικόνα ή όχι.
        const mainTitle = cleanTitle ? cleanTitle : currentStation.name;
        const subTitle = cleanTitle ? currentStation.name : (currentStation.slogan || 'Web Radio');

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 64px sans-serif'; 
        const titleY = wrapText(ctx, mainTitle, 540, pillY + pillHeight + 90, 920, 85);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; 
        ctx.font = '500 42px sans-serif';
        ctx.fillText(subTitle, 540, titleY + 90);

        // 7. BRANDING iRadios (Κάτω μέρος)
        const bottomY = 1680;
        
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 32px sans-serif';
        ctx.fillText('Άκου τώρα στο', 540, bottomY);
        
        const logoTargetHeight = 100;
        const iRadiosRatio = logoTargetHeight / iradiosLogo.height;
        const iRadiosW = iradiosLogo.width * iRadiosRatio;
        const iRadiosH = logoTargetHeight;
        
        ctx.drawImage(iradiosLogo, 540 - iRadiosW/2, bottomY + 30, iRadiosW, iRadiosH);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '700 20px sans-serif';
        ctx.letterSpacing = '4px';
        ctx.fillText('POWERED BY ILUMA DIGITAL AGENCY', 540, bottomY + 180);

        // ΤΕΛΟΣ
        canvas.toBlob((blob) => {
          const file = new File([blob], `iradios-${currentStation.slug || 'story'}.png`, { type: 'image/png' });
          resolve(file);
        }, 'image/png');

      } catch (error) {
        reject(error);
      }
    });
  };

  const handleShare = async () => {
    if (!currentStation) return;
    setIsGenerating(true);
    try {
      const storyImage = await generateStoryImage();
      
      if (navigator.canShare && navigator.canShare({ files: [storyImage] })) {
        await navigator.share({
          files: [storyImage],
          title: 'iRadios',
          text: `Ακούω ${currentStation.name} στο @iradios! 🎧`
        });
      } else {
        const url = URL.createObjectURL(storyImage);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iradios-${currentStation.name}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error(error);
      if (error.name !== 'AbortError') alert('Σφάλμα δημιουργίας εικόνας.');
    }
    setIsGenerating(false);
  };

  return (
    <button 
      onClick={handleShare}
      disabled={isGenerating || !currentStation}
      className={`transition-colors p-2 rounded-full ${isGenerating ? 'text-[#ccff00]' : 'text-zinc-400 hover:text-white hover:bg-white/5'} active:scale-95`}
      title="Share to Story"
    >
      {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Instagram size={20} />}
    </button>
  );
}
