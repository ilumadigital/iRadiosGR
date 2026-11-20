/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        iluma: {
          dark: '#050505',     // Το βασικό background (Spotify style)
          surface: '#111111',  // Τα cards και τα sidebar
          accent: '#ccff00',   // Το "Next Gen" γαλάζιο/neon της ILUMA
          text: '#ffffff',
          gray: '#555555'
        }
      }
    },
  },
  plugins: [],
}
