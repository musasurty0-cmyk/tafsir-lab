import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:   ["var(--font-sans)", "system-ui", "sans-serif"],
        serif:  ["var(--font-serif)", "Georgia", "serif"],
        mono:   ["var(--font-mono)", "monospace"],
        arabic: ["var(--font-arabic)", "serif"],
      },
      colors: {
        bg:           "var(--bg)",
        "bg-elev":    "var(--bg-elev)",
        panel:        "var(--panel)",
        ink:          "var(--ink)",
        "ink-2":      "var(--ink-2)",
        "ink-3":      "var(--ink-3)",
        "ink-4":      "var(--ink-4)",
        accent:       "var(--accent)",
        "accent-soft":"var(--accent-soft)",
        "accent-ink": "var(--accent-ink)",
        line:         "var(--line)",
        "line-strong":"var(--line-strong)",
      },
    },
  },
  plugins: [],
};

export default config;
