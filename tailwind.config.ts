import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0F7B8A",
          dark: "#0A2540",
        },
        surface: {
          primary: "#FFFFFF",
          secondary: "#F7F8FA",
          hover: "#EEF0F4",
        },
        text: {
          primary: "#1A1D23",
          secondary: "#6B7280",
          muted: "#9CA3AF",
        },
        border: "#E5E7EB",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        urgent: "#DC2626",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "8px",
        btn: "6px",
        input: "4px",
      },
      width: {
        sidebar: "260px",
      },
      keyframes: {
        // Idle "suspended in space" drift for the What We Do floating service cards -- runs on
        // a layer separate from both the scroll-driven transform and the hover transform, so it
        // never fights either. Per-card duration/delay (inline style) keeps the three out of sync.
        "aequora-float": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg)" },
          "50%": { transform: "translate3d(5px, -9px, 0) rotate(1deg)" },
        },
      },
      animation: {
        "aequora-float": "aequora-float 9s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
