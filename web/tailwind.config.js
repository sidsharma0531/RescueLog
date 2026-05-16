/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Second Servings brand palette
        rescue: {
          green: '#2D7D46',
          'green-dark': '#1F5A32',
          'green-light': '#E8F3EC',
          orange: '#E8832A',
          'orange-light': '#FBEFE2',
          ink: '#2A2E2B',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
