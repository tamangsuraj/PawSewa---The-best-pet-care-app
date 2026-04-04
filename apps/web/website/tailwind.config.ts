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
        primary: "#4B3621",
        secondary: "#FAF7F2",
        cream: "#FAF7F2",
        careTeal: "#0d9488",
        accent: "#64748b",
        "accent-blue": "#3b82f6",
        paw: {
          ink: "var(--paw-ink)",
          bark: "var(--paw-bark)",
          clay: "var(--paw-clay)",
          cream: "var(--paw-cream)",
          sand: "var(--paw-sand)",
          haze: "var(--paw-haze)",
          teal: "var(--paw-teal)",
          "teal-mid": "var(--paw-teal-mid)",
          umber: "var(--paw-umber)",
          /** Shop / section canvas */
          panel: "#F8F6F0",
          /** Body copy brown (shop cards) */
          foreground: "#4A2E1B",
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
        paw: "0 24px 60px rgba(61, 46, 36, 0.1)",
        "paw-lg": "0 32px 80px rgba(61, 46, 36, 0.14)",
        "paw-glow": "0 0 0 1px rgba(255,255,255,0.5), 0 18px 48px rgba(13, 148, 136, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
