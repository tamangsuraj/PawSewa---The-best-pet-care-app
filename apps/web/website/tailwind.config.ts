import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#703418",
        secondary: "#FAF7F2",
        cream: "#FAF7F2",
        careTeal: "#0d9488",
        accent: "#64748b",
        "accent-blue": "#3b82f6",
        paw: {
          ink: "rgb(var(--paw-ink-rgb) / <alpha-value>)",
          bark: "rgb(var(--paw-bark-rgb) / <alpha-value>)",
          clay: "rgb(var(--paw-clay-rgb) / <alpha-value>)",
          cream: "rgb(var(--paw-cream-rgb) / <alpha-value>)",
          sand: "rgb(var(--paw-sand-rgb) / <alpha-value>)",
          haze: "rgb(var(--paw-haze-rgb) / <alpha-value>)",
          teal: "rgb(var(--paw-teal-rgb) / <alpha-value>)",
          "teal-mid": "rgb(var(--paw-teal-mid-rgb) / <alpha-value>)",
          umber: "rgb(var(--paw-umber-rgb) / <alpha-value>)",
          /** Shop / section canvas */
          panel: "#F8F6F0",
          /** Body copy brown (shop cards) */
          foreground: "rgb(var(--paw-ink-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        /** Legacy class names — map to Outfit for consistency */
        poppins: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        inter: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        paw: "0 24px 60px rgba(112, 52, 24, 0.1)",
        "paw-lg": "0 32px 80px rgba(112, 52, 24, 0.14)",
        "paw-glow": "0 0 0 1px rgba(255,255,255,0.5), 0 18px 48px rgba(13, 148, 136, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
