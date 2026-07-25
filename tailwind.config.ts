import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        body: "#475569",
        meta: "#94A3B8",
        line: "#E2E8F0",
        bg: "#F8FAFC",
        brand: { DEFAULT: "#2563EB", dark: "#1D4ED8", tint: "#EFF6FF" },
        success: { DEFAULT: "#16A34A", tint: "#F0FDF4" },
        warn: { DEFAULT: "#EAB308", tint: "#FEFCE8" },
        danger: { DEFAULT: "#DC2626", tint: "#FEF2F2" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { card: "8px" },
    },
  },
  plugins: [],
};
export default config;
