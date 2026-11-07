// Συνάρτηση για την επαλήθευση του Turnstile Token
const verifyTurnstileToken = async (token, ip) => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Φτιάχνουμε τα δεδομένα που απαιτεί η Cloudflare (x-www-form-urlencoded)
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (ip) {
    formData.append('remoteip', ip); // Προαιρετικό, αλλά καλό για έξτρα ασφάλεια
  }

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await result.json();
    return data.success; // Επιστρέφει true αν περάσει, false αν κοπεί
  } catch (error) {
    console.error('Σφάλμα κατά την επαλήθευση Turnstile:', error);
    return false;
  }
};
