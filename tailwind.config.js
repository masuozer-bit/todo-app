const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, "./src/**/*.{js,ts,jsx,tsx,mdx}"),
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Geist", "system-ui", "sans-serif"],
      },
      colors: {
        white: "#FFFFFF",
        black: "#000000",
        gray: {
          50: "#F5F5F5",
          400: "#A0A0A0",
          900: "#1A1A1A",
        },
      },
      borderRadius: {
        DEFAULT: "1rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
      backdropBlur: {
        xl: "24px",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};
