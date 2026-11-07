import React, { useRef, useEffect } from 'react';

export default function CircularVU({ analyser, isPlaying, customColor = '#ccff00' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!analyser || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    // Ρυθμίζουμε τον αναλυτή (128 fftSize δίνει 64 frequency bins)
    analyser.fftSize = 128;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 26; // Η ακτίνα για να είναι ακριβώς έξω από το κουμπί play (48px)

      // Θέλουμε 32 μπάρες σε κάθε πλευρά για τέλεια συμμετρία
      const bars = 32; 
      const angleStep = Math.PI / bars; // Βήμα μισού κύκλου

      // Προσθήκη Glow (Neon Effect)
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ccff00';

      for (let i = 0; i < bars; i++) {
        // Διαβάζουμε τις χαμηλές και μεσαίες συχνότητες
        const value = dataArray[i]; 
        // Ύψος μπάρας (από 2px minimum έως 14px maximum ανάλογα το volume)
        const barHeight = 2 + (value / 255) * 14; 

        // Σχεδιάζουμε τη δεξιά και την αριστερή πλευρά ταυτόχρονα (Συμμετρία)
        // Ξεκινάμε από το κάτω μέρος (Math.PI / 2)
        const angleRight = (Math.PI / 2) - (i * angleStep);
        const angleLeft  = (Math.PI / 2) + (i * angleStep);

        const drawBar = (angle) => {
          const xStart = centerX + Math.cos(angle) * baseRadius;
          const yStart = centerY + Math.sin(angle) * baseRadius;
          const xEnd = centerX + Math.cos(angle) * (baseRadius + barHeight);
          const yEnd = centerY + Math.sin(angle) * (baseRadius + barHeight);

          ctx.beginPath();
          ctx.moveTo(xStart, yStart);
          ctx.lineTo(xEnd, yEnd);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = customColor;
          ctx.shadowColor = customColor;
          ctx.lineCap = 'round';
          ctx.stroke();
        };

        drawBar(angleRight);
        drawBar(angleLeft);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [analyser, isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      width={100} 
      height={100} 
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-500 z-0 ${isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} 
    />
  );
}
