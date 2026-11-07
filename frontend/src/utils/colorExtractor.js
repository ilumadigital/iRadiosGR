export const getProminentColor = (imgUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Παίρνουμε το χρώμα από ένα σημείο της εικόνας (κέντρο-δεξιά συνήθως έχει το βασικό χρώμα)
      const data = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      resolve(`rgb(${data[0]}, ${data[1]}, ${data[2]})`);
    };
    img.onerror = () => resolve('#ccff00'); // Fallback στο lime σου
  });
};
