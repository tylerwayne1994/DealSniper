/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        atlas: {
          indigo: '#4f46e5',
          slate: '#1f2937'
        }
      }
    }
  },
  plugins: []
};
