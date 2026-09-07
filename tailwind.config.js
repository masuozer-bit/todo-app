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
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      // Every colour comes from a token in globals.css, so light and dark
      // stay a single set. Opacity modifiers do not apply to var() colours,
      // which is intended: the design has three text colours and no others.
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-faint": "var(--text-faint)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-soft": "var(--accent-soft)",
        "accent-contrast": "var(--accent-contrast)",
        danger: "var(--danger)",
        "danger-solid": "var(--danger-solid)",
        warning: "var(--warning)",
        success: "var(--success)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      // Three radii, nothing else. xl and 2xl stay as aliases of 8px so the
      // markup that still carries them from the old design does not fall back
      // to square corners before its phase rewrites it.
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "8px",
        "2xl": "8px",
        "3xl": "8px",
        full: "999px",
      },
      boxShadow: {
        popover: "var(--shadow-popover)",
      },
      spacing: {
        row: "var(--row-h)",
        header: "var(--header-h)",
        control: "var(--control-h)",
        nav: "var(--nav-w)",
        detail: "var(--detail-w)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};
