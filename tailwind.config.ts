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
    },
  },
  plugins: [],
};
export default config;
