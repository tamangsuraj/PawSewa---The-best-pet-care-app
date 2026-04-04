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
        /** Premium home / brand brown (image_10) */
        primary: '#4B3621',
        /** Soft cream surfaces */
        secondary: '#FAF7F2',
        cream: '#FAF7F2',
        /** Pet Care+ / chat accent (teal) */
        careTeal: '#0d9488',
        accent: '#64748b',
        'accent-blue': '#3b82f6',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
