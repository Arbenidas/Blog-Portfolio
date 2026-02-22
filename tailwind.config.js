/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#008f99",
        "primary-light": "#e0f7fa",
        "accent-orange": "#d94e1e",
        "paper-cream": "#f2f0e4",
        "paper-white": "#f9f8f3",
        "charcoal": "#1a1a1a",
        "ink-black": "#050505",
        "blueprint-blue": "#e1e8ed",
      },
      fontFamily: {
        "display": ["Space Grotesk", "sans-serif"],
        "body": ["Noto Sans", "sans-serif"],
        "hand": ["Rock Salt", "cursive"], 
        "marker": ["Permanent Marker", "cursive"],
        "mono": ["Share Tech Mono", "monospace"],
        "nixie": ["VT323", "monospace"],
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #e5e5e5 1px, transparent 1px), linear-gradient(to bottom, #e5e5e5 1px, transparent 1px)",
        'blueprint': "linear-gradient(#008f9910 1px, transparent 1px), linear-gradient(90deg, #008f9910 1px, transparent 1px)",
        'halftone': "radial-gradient(circle, #008f99 1px, transparent 1px)",
      },
      boxShadow: {
        'sketch': '3px 3px 0px 0px #1a1a1a, 2px 2px 0px 0px #1a1a1a',
        'sketch-lg': '6px 6px 0px 0px #1a1a1a, 4px 4px 0px 0px #1a1a1a',
        'paper': '1px 1px 5px rgba(0,0,0,0.1), 5px 5px 0 rgba(0,0,0,0.05)',
        'hard': '4px 4px 0px 0px #d94e1e'
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
